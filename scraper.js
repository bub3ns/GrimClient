const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const url = require('url');

const TARGET_URL = 'https://grimclient.pl';
const OUTPUT_DIR = path.join(__dirname, 'downloaded_site');
const REPORT_FILE = path.join(__dirname, 'crawl_report.json');

// Ensure output directories
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const capturedResources = new Map();
const apiCalls = [];
const visitedUrls = new Set();
const urlsToVisit = [TARGET_URL];
const discoveredLinks = new Set();

function sanitizePath(urlPath) {
  let decoded = decodeURIComponent(urlPath);
  decoded = decoded.replace(/^\/+/, '');
  if (!decoded || decoded.endsWith('/')) {
    decoded += 'index.html';
  } else if (!path.extname(decoded)) {
    decoded += '.html';
  }
  // Sanitize Windows invalid filename characters
  return decoded.replace(/[:*?"<>|]/g, '_');
}

async function run() {
  console.log(`[START] Starting extraction for: ${TARGET_URL}`);

  const browser = await chromium.launchPersistentContext('', {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = browser.pages()[0] || await browser.newPage();

  // Intercept responses
  page.on('response', async (response) => {
    try {
      const req = response.request();
      const resUrl = response.url();
      const status = response.status();
      const contentType = response.headers()['content-type'] || '';
      const resourceType = req.resourceType();

      // Log API / Fetch / XHR
      if (resourceType === 'fetch' || resourceType === 'xhr') {
        let postData = req.postData();
        let resBody = null;
        try {
          resBody = await response.text();
        } catch (e) {}

        apiCalls.push({
          url: resUrl,
          method: req.method(),
          status,
          headers: req.headers(),
          requestBody: postData,
          contentType,
          responseBodyPreview: resBody ? resBody.substring(0, 500) : null
        });
        console.log(`[API ${req.method()} ${status}] ${resUrl}`);
      }

      // Check if resource belongs to target domain or CDN
      const parsed = new URL(resUrl);
      const isTargetDomain = parsed.hostname === 'grimclient.pl' || parsed.hostname.endsWith('.grimclient.pl');

      if (isTargetDomain && status === 200 && !capturedResources.has(resUrl)) {
        try {
          const buffer = await response.body();
          const relativePath = sanitizePath(parsed.pathname);
          const fullDiskPath = path.join(OUTPUT_DIR, parsed.hostname, relativePath);

          fs.mkdirSync(path.dirname(fullDiskPath), { recursive: true });
          fs.writeFileSync(fullDiskPath, buffer);

          capturedResources.set(resUrl, {
            localPath: fullDiskPath,
            size: buffer.length,
            contentType,
            resourceType
          });
          console.log(`[SAVED] (${(buffer.length / 1024).toFixed(1)} KB) ${parsed.pathname}`);
        } catch (err) {
          // Some responses might fail to buffer (redirects, streams)
          capturedResources.set(resUrl, { error: err.message, status });
        }
      }
    } catch (e) {
      // response lifecycle errors
    }
  });

  // Crawl target URLs
  const maxPages = 15;
  let pageCount = 0;

  while (urlsToVisit.length > 0 && pageCount < maxPages) {
    const currentUrl = urlsToVisit.shift();
    if (visitedUrls.has(currentUrl)) continue;
    visitedUrls.add(currentUrl);
    pageCount++;

    console.log(`\n[NAVIGATE ${pageCount}/${maxPages}] -> ${currentUrl}`);

    try {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Check for Cloudflare Challenge
      for (let w = 0; w < 30; w++) {
        const title = await page.title();
        if (title.includes('Cierpliwo') || title.includes('Just a moment')) {
          console.log(`[CF DETECTED] Title: "${title}". Waiting for challenge completion... (${w}s)`);
          await page.waitForTimeout(1000);
        } else {
          console.log(`[PAGE READY] Title: "${title}"`);
          break;
        }
      }

      // Wait for network to settle and hydration
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(2000);

      // Smooth scroll to bottom to trigger lazy loading / animations / images
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 300;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, 150);
        });
      });

      await page.waitForTimeout(1500);

      // Extract metadata, links, frameworks
      const pageInfo = await page.evaluate(() => {
        const nextData = window.__NEXT_DATA__ || null;
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(h => h.startsWith('http'));
        const images = Array.from(document.querySelectorAll('img')).map(i => i.src);
        const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
        const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
        const fullHtml = document.documentElement.outerHTML;

        return {
          title: document.title,
          links,
          images,
          scripts,
          stylesheets,
          nextData,
          fullHtml
        };
      });

      // Save rendered HTML
      const parsedUrl = new URL(currentUrl);
      let htmlFileName = parsedUrl.pathname === '/' ? 'index.html' : sanitizePath(parsedUrl.pathname);
      if (!htmlFileName.endsWith('.html')) htmlFileName += '.html';
      const renderedHtmlPath = path.join(OUTPUT_DIR, parsedUrl.hostname, 'rendered', htmlFileName);
      fs.mkdirSync(path.dirname(renderedHtmlPath), { recursive: true });
      fs.writeFileSync(renderedHtmlPath, pageInfo.fullHtml, 'utf8');
      console.log(`[RENDERED HTML SAVED] ${renderedHtmlPath}`);

      if (pageInfo.nextData) {
        const nextDataPath = path.join(OUTPUT_DIR, parsedUrl.hostname, 'rendered', htmlFileName.replace('.html', '_nextdata.json'));
        fs.writeFileSync(nextDataPath, JSON.stringify(pageInfo.nextData, null, 2), 'utf8');
        console.log(`[NEXT_DATA SAVED] buildId: ${pageInfo.nextData.buildId}`);
      }

      // Add new discovered internal links to crawl queue
      for (const link of pageInfo.links) {
        try {
          const lUrl = new URL(link);
          if (lUrl.hostname === 'grimclient.pl' || lUrl.hostname.endsWith('.grimclient.pl')) {
            discoveredLinks.add(link);
            const cleanUrl = lUrl.origin + lUrl.pathname;
            if (!visitedUrls.has(cleanUrl) && !urlsToVisit.includes(cleanUrl)) {
              // Avoid non-html downloads in page navigation
              if (!/\.(png|jpg|jpeg|gif|svg|zip|jar|exe|pdf)$/i.test(lUrl.pathname)) {
                urlsToVisit.push(cleanUrl);
              }
            }
          }
        } catch (e) {}
      }

    } catch (err) {
      console.error(`[ERROR visiting ${currentUrl}]:`, err.message);
    }
  }

  // Summary Report
  const report = {
    target: TARGET_URL,
    timestamp: new Date().toISOString(),
    visitedPages: Array.from(visitedUrls),
    discoveredLinks: Array.from(discoveredLinks),
    apiCallsCount: apiCalls.length,
    apiCalls,
    capturedResourcesCount: capturedResources.size,
    capturedResources: Array.from(capturedResources.entries()).map(([u, d]) => ({
      url: u,
      ...d
    }))
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n[COMPLETE] Report saved to ${REPORT_FILE}`);
  console.log(`Total visited pages: ${visitedUrls.size}`);
  console.log(`Total captured resources: ${capturedResources.size}`);
  console.log(`Total API calls logged: ${apiCalls.length}`);

  await browser.close();
}

run().catch(console.error);

