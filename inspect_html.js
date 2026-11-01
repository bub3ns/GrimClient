const fs = require('fs');
const html = fs.readFileSync('downloaded_site/grimclient.pl/rendered/pl.html', 'utf8');

const scriptMatches = html.match(/src="[^"]+"/g) || [];
console.log('Sample script src:', scriptMatches.slice(0, 5));

const linkMatches = html.match(/href="[^"]+"/g) || [];
console.log('Sample link href:', linkMatches.slice(0, 5));

const imgMatches = html.match(/<img[^>]+>/g) || [];
console.log('Sample img tags:');
imgMatches.slice(0, 5).forEach(img => console.log(img));
