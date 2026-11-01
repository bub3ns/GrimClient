const fs = require('fs');
const html = fs.readFileSync('downloaded_site/grimclient.pl/rendered/pl.html', 'utf8');

const scripts = html.match(/src="(\/_next\/[^"]+)"/g) || [];
const missingScripts = [];

for (const s of scripts) {
  const urlPath = s.replace('src="', '').replace('"', '');
  const localFile = 'downloaded_site/grimclient.pl' + urlPath.replace(/\//g, '\\');
  if (!fs.existsSync(localFile)) {
    missingScripts.push(urlPath);
  }
}

console.log('Missing Next.js scripts from rendered pl.html:');
console.log(missingScripts);
