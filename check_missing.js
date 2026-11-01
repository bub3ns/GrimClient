const fs = require('fs');
const path = require('path');

const list = JSON.parse(fs.readFileSync('all_manifest_assets.json', 'utf8'));
const baseDir = path.join(__dirname, 'downloaded_site', 'grimclient.pl', '_next');

const missing = [];
const existing = [];

for (const item of list) {
  // item is like "static/chunks/..."
  // on disk on Windows, replace / with path.sep, but inside [token] brackets might need care
  const localFile = path.join(baseDir, item.replace(/\//g, path.sep));
  if (fs.existsSync(localFile) && fs.statSync(localFile).size > 0) {
    existing.push(item);
  } else {
    missing.push(item);
  }
}

console.log(`Existing: ${existing.length} / ${list.length}`);
console.log(`Missing: ${missing.length}`);
console.log('Missing items:', missing);
