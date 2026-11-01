const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://grimclient.pl';
const BUILD_ID = 'qGwJ2KYIlLj8ghC92z9ja';
const OUTPUT_DIR = path.join(__dirname, 'downloaded_site', 'grimclient.pl');

// Parse build manifest to get all chunks
const manifestCode = fs.readFileSync(path.join(OUTPUT_DIR, '_next', 'static', BUILD_ID, '_buildManifest.js'), 'utf8');

// Extract all string literals matching "static/..."
const matches = manifestCode.match(/static\/[a-zA-Z0-9_\-\.\/]+/g) || [];
const uniqueChunks = [...new Set(matches)];
console.log(`Found ${uniqueChunks.length} unique chunks/assets in _buildManifest.js`);

// Also collect images from crawl_report.json
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'crawl_report.json'), 'utf8'));
const imagesToFetch = [];

for (const item of report.capturedResources) {
  if (item.url.includes('_next/image')) {
    imagesToFetch.push(item.url);
  }
}

// Additional known static images
const staticImages = [
  '/images/statics/abs_hero_grid.png',
  '/images/img_ocean.webp',
  '/images/statics/abs_hero.svg',
  '/images/logo.png',
  '/images/img_interface_bg.png',
  '/images/statics/abs_particles_inter.png',
  '/images/bg_config2.png',
  '/images/statics/abs_reviews.png',
  '/images/statics/blazecode_logo.png',
  '/favicon.ico'
];

async function fetchAll() {
  const browser = await chromium.launchPersistentContext('', {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Helper to fetch using page.evaluate(fetch)
  async function downloadAsset(urlPath, relativeSavePath) {
    const fullSavePath = path.join(OUTPUT_DIR, relativeSavePath);
    if (fs.existsSync(fullSavePath) && fs.statSync(fullSavePath).size > 0) {
      // already downloaded
      return;
    }

    try {
      const targetUrl = urlPath.startsWith('http') ? urlPath : `${BASE_URL}${urlPath.startsWith('/') ? '' : '/'}${urlPath}`;
      const base64Data = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (!res.ok) return { error: res.status };
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ base64: reader.result.split(',')[1] });
          reader.readAsDataURL(blob);
        });
      }, targetUrl);

      if (base64Data && base64Data.base64) {
        fs.mkdirSync(path.dirname(fullSavePath), { recursive: true });
        fs.writeFileSync(fullSavePath, Buffer.from(base64Data.base64, 'base64'));
        console.log(`[DOWNLOADED] ${relativeSavePath} (${(base64Data.base64.length * 0.75 / 1024).toFixed(1)} KB)`);
      } else {
        console.warn(`[FAILED ${base64Data?.error || 'Unknown'}] ${urlPath}`);
      }
    } catch (e) {
      console.error(`[ERROR] ${urlPath}: ${e.message}`);
    }
  }

  // 1. Download all chunks & css from manifest
  console.log('\n--- Downloading all manifest chunks ---');
  for (const chunk of uniqueChunks) {
    const urlPath = `/_next/${chunk}`;
    const savePath = path.join('_next', chunk.replace(/\//g, path.sep));
    await downloadAsset(urlPath, savePath);
  }

  // 2. Download raw images
  console.log('\n--- Downloading static images ---');
  for (const img of staticImages) {
    const savePath = img.replace(/^\/+/, '').replace(/\//g, path.sep);
    await downloadAsset(img, savePath);
  }

  // 3. Download Next.js optimized images
  console.log('\n--- Downloading Next.js optimized images ---');
  let imgIdx = 1;
  for (const imgUrl of [...new Set(imagesToFetch)]) {
    try {
      const parsed = new URL(imgUrl);
      const originalUrl = parsed.searchParams.get('url');
      if (originalUrl) {
        let savePath;
        if (originalUrl.startsWith('http')) {
          const origParsed = new URL(originalUrl);
          savePath = path.join('external_assets', origParsed.hostname, origParsed.pathname.replace(/^\/+/, '').replace(/\//g, path.sep));
        } else {
          savePath = originalUrl.replace(/^\/+/, '').replace(/\//g, path.sep);
        }
        await downloadAsset(imgUrl, savePath);
      }
    } catch (e) {}
    imgIdx++;
  }

  // 4. Download changelog and other routes JSON data
  const dataRoutes = ['/pl/changelog.json', '/pl/2fa.json', '/pl/confirm-device.json'];
  for (const dr of dataRoutes) {
    const urlPath = `/_next/data/${BUILD_ID}${dr}`;
    const savePath = path.join('_next', 'data', BUILD_ID, dr.replace(/^\/+/, '').replace(/\//g, path.sep));
    await downloadAsset(urlPath, savePath);
  }

  console.log('\n[ASSET DOWNLOAD COMPLETE]');
  await browser.close();
}

fetchAll().catch(console.error);

