const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const missing = [
  'static/chunks/pages/2fa-2fbd3dd9d4ca83fb.js',
  'static/chunks/pages/_error-e5df1dc985230fe1.js',
  'static/chunks/pages/change-password/[token]-fddca5e987f4a17c.js',
  'static/css/14007d8464bd06aa.css',
  'static/chunks/pages/changelog-5bdeab1ce72e0065.js',
  'static/chunks/pages/confirm-device-cec9fabd34bb5b77.js',
  'static/chunks/pages/dashboard/support/ticket/[id]-a18d6b87d09a99b3.js',
  'static/chunks/pages/status/[uid]-de01cd9b07d02fe7.js'
];

const baseDir = path.join(__dirname, 'downloaded_site', 'grimclient.pl', '_next');

async function run() {
  const browser = await chromium.launchPersistentContext('', {
    channel: 'msedge',
    headless: false,
    viewport: { width: 1280, height: 720 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation']
  });

  const page = browser.pages()[0] || await browser.newPage();
  await page.goto('https://grimclient.pl/', { waitUntil: 'domcontentloaded' });
  
  // wait for challenge
  for (let i = 0; i < 20; i++) {
    const title = await page.title();
    if (!title.includes('Cierpliwo') && !title.includes('Just a moment')) {
      console.log('Challenge passed:', title);
      break;
    }
    await page.waitForTimeout(1000);
  }

  for (const item of missing) {
    const encodedItem = item.replace(/\[/g, '%5B').replace(/\]/g, '%5D');
    const targetUrl = `https://grimclient.pl/_next/${encodedItem}`;
    console.log(`Fetching: ${targetUrl}`);

    try {
      const data = await page.evaluate(async (url) => {
        const res = await fetch(url);
        if (!res.ok) return { error: res.status };
        const text = await res.text();
        return { text };
      }, targetUrl);

      if (data && data.text) {
        const localFile = path.join(baseDir, item.replace(/\//g, path.sep));
        fs.mkdirSync(path.dirname(localFile), { recursive: true });
        fs.writeFileSync(localFile, data.text, 'utf8');
        console.log(`[SUCCESS] Saved ${item} (${(data.text.length / 1024).toFixed(1)} KB)`);
      } else {
        console.log(`[FAILED ${data?.error}] ${targetUrl}`);
      }
    } catch (e) {
      console.error(`[ERROR] ${item}:`, e.message);
    }
  }

  // Also fetch changelog page HTML
  try {
    console.log('Navigating to changelog...');
    await page.goto('https://grimclient.pl/pl/changelog', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const changelogHtml = await page.content();
    fs.writeFileSync(path.join(__dirname, 'downloaded_site', 'grimclient.pl', 'rendered', 'pl', 'changelog.html'), changelogHtml, 'utf8');
    console.log('[SUCCESS] Saved changelog.html');
  } catch (e) {
    console.error('Changelog error:', e.message);
  }

  await browser.close();
}

run().catch(console.error);
