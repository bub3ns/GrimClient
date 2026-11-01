const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const polyfill = 'static/chunks/polyfills-42372ed130431b0a.js';
const baseDir = path.join(__dirname, 'downloaded_site', 'grimclient.pl');

// Extract all avatar URLs from rendered/pl.html
const html = fs.readFileSync(path.join(baseDir, 'rendered', 'pl.html'), 'utf8');
const avatarRegex = /_next\/image\?url=([^"&]+)/g;
let m;
const rawUrls = new Set();
while ((m = avatarRegex.exec(html)) !== null) {
  rawUrls.add(decodeURIComponent(m[1]));
}

console.log(`Found ${rawUrls.size} unique image URLs in pl.html`);

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
  
  for (let i = 0; i < 20; i++) {
    const title = await page.title();
    if (!title.includes('Cierpliwo') && !title.includes('Just a moment')) break;
    await page.waitForTimeout(1000);
  }

  // 1. Download polyfill
  try {
    const res = await page.evaluate(async (url) => {
      const r = await fetch(url);
      if (!r.ok) return { error: r.status };
      return { text: await r.text() };
    }, `https://grimclient.pl/_next/${polyfill}`);

    if (res && res.text) {
      const pPath = path.join(baseDir, '_next', polyfill.replace(/\//g, path.sep));
      fs.mkdirSync(path.dirname(pPath), { recursive: true });
      fs.writeFileSync(pPath, res.text, 'utf8');
      console.log('[SAVED] polyfills-42372ed130431b0a.js');
    }
  } catch (e) {
    console.error('Polyfill error:', e.message);
  }

  // 2. Download all images
  for (const rawUrl of rawUrls) {
    let localSavePath;
    let fetchUrl;

    if (rawUrl.startsWith('http')) {
      const parsed = new URL(rawUrl);
      localSavePath = path.join(baseDir, 'external_assets', parsed.hostname, parsed.pathname.replace(/^\/+/, '').replace(/\//g, path.sep));
      // fetch via _next/image optimized or direct
      fetchUrl = `https://grimclient.pl/_next/image?url=${encodeURIComponent(rawUrl)}&w=256&q=75`;
    } else {
      localSavePath = path.join(baseDir, rawUrl.replace(/^\/+/, '').replace(/\//g, path.sep));
      fetchUrl = `https://grimclient.pl${rawUrl}`;
    }

    if (fs.existsSync(localSavePath) && fs.statSync(localSavePath).size > 0) {
      continue;
    }

    try {
      const data = await page.evaluate(async (url) => {
        const r = await fetch(url);
        if (!r.ok) return { error: r.status };
        const blob = await r.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ base64: reader.result.split(',')[1] });
          reader.readAsDataURL(blob);
        });
      }, fetchUrl);

      if (data && data.base64) {
        fs.mkdirSync(path.dirname(localSavePath), { recursive: true });
        fs.writeFileSync(localSavePath, Buffer.from(data.base64, 'base64'));
        console.log(`[SAVED IMG] ${path.basename(localSavePath)} (${(data.base64.length * 0.75 / 1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      console.error('Error img:', rawUrl, e.message);
    }
  }

  await browser.close();
  console.log('Done downloading remaining assets!');
}

run().catch(console.error);
