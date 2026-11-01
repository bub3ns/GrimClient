const fs = require('fs');
const content = fs.readFileSync('downloaded_site/grimclient.pl/_next/static/qGwJ2KYIlLj8ghC92z9ja/_buildManifest.js', 'utf8');

// The file has a function call. Let's extract all quoted strings that contain "static/"
const regex = /"([^"]*static\/[^"]*)"/g;
let m;
const list = new Set();
while ((m = regex.exec(content)) !== null) {
  list.add(m[1]);
}

// Also get the arguments at the end of the file: ("static/chunks/...", ...)
const argMatches = content.match(/"static\/[^"]+"/g) || [];
for (const a of argMatches) {
  list.add(a.replace(/"/g, ''));
}

console.log('Total extracted assets:', list.size);
fs.writeFileSync('all_manifest_assets.json', JSON.stringify([...list], null, 2));
console.log('Saved all_manifest_assets.json');

