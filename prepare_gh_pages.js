const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'downloaded_site', 'grimclient.pl');
const rootDir = __dirname;

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('1. Copying static directories (_next, images, external_assets)...');
copyDirRecursive(path.join(srcDir, '_next'), path.join(rootDir, '_next'));
copyDirRecursive(path.join(srcDir, 'images'), path.join(rootDir, 'images'));
copyDirRecursive(path.join(srcDir, 'external_assets'), path.join(rootDir, 'external_assets'));

if (fs.existsSync(path.join(srcDir, 'favicon.ico'))) {
  fs.copyFileSync(path.join(srcDir, 'favicon.ico'), path.join(rootDir, 'favicon.ico'));
}

// 2. Create .nojekyll
fs.writeFileSync(path.join(rootDir, '.nojekyll'), '');
console.log('2. Created .nojekyll');

// 3. Helper to patch HTML for GitHub Pages compatibility
const ghScript = `
  <script>
    // GitHub Pages Compatibility Script
    (function() {
      // Auto-detect if running on GitHub Pages subpath (e.g. /GrimClient/)
      var pathSegments = window.location.pathname.split('/').filter(Boolean);
      var isGhPages = window.location.hostname.endsWith('github.io') && pathSegments.length > 0;
      var repoBase = isGhPages ? '/' + pathSegments[0] + '/' : '/';

      // Fix image URLs that use Next.js dynamic image optimizer
      function fixImages() {
        var imgs = document.querySelectorAll('img');
        imgs.forEach(function(img) {
          var src = img.getAttribute('src');
          if (src && src.indexOf('/_next/image') !== -1) {
            try {
              var urlParam = (src.match(/[?&]url=([^&]+)/) || [])[1];
              if (urlParam) {
                var decoded = decodeURIComponent(urlParam);
                if (decoded.indexOf('api.grimclient.pl/uploads/') !== -1) {
                  var filename = decoded.split('/uploads/')[1];
                  img.src = repoBase + 'external_assets/api.grimclient.pl/uploads/' + filename;
                } else if (decoded.startsWith('/images/')) {
                  img.src = repoBase + decoded.replace(/^\\/+/, '');
                }
                img.removeAttribute('srcset');
              }
            } catch (e) {}
          }
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fixImages);
      } else {
        fixImages();
      }
      setTimeout(fixImages, 500);
      setTimeout(fixImages, 2000);
    })();
  </script>
`;

function patchHtml(htmlContent, isRoot = false) {
  let patched = htmlContent;

  // Insert compatibility script before </head>
  if (patched.includes('</head>')) {
    patched = patched.replace('</head>', `${ghScript}\n</head>`);
  } else {
    patched = ghScript + patched;
  }

  // Pre-replace Next.js image optimizer URLs to direct static assets
  patched = patched.replace(/\/_next\/image\?url=%2Fimages%2F([^&"]+)&amp;[^"]+/g, (match, p1) => `images/${decodeURIComponent(p1)}`);
  patched = patched.replace(/\/_next\/image\?url=https%3A%2F%2Fapi\.grimclient\.pl%2Fuploads%2F([^&"]+)&amp;[^"]+/g, (match, p1) => `external_assets/api.grimclient.pl/uploads/${decodeURIComponent(p1)}`);

  return patched;
}

// 4. Create root index.html from rendered/pl.html
console.log('3. Generating index.html for GitHub Pages root...');
const mainHtml = fs.readFileSync(path.join(srcDir, 'rendered', 'pl.html'), 'utf8');
fs.writeFileSync(path.join(rootDir, 'index.html'), patchHtml(mainHtml, true), 'utf8');

// 5. Create pl/ subpages
const plSubDir = path.join(rootDir, 'pl');
fs.mkdirSync(plSubDir, { recursive: true });

const pages = [
  'login',
  'register',
  'documents',
  'changelog',
  'recover-account',
  'recover-email',
  'pomoc'
];

for (const p of pages) {
  const pFile = path.join(srcDir, 'rendered', 'pl', `${p}.html`);
  if (fs.existsSync(pFile)) {
    const raw = fs.readFileSync(pFile, 'utf8');
    fs.writeFileSync(path.join(plSubDir, `${p}.html`), patchHtml(raw), 'utf8');
    // Also create folder with index.html for pretty URLs (e.g. /pl/login/ -> /pl/login/index.html)
    const folderPath = path.join(plSubDir, p);
    fs.mkdirSync(folderPath, { recursive: true });
    fs.writeFileSync(path.join(folderPath, 'index.html'), patchHtml(raw), 'utf8');
    console.log(`  - Created pl/${p}.html & pl/${p}/index.html`);
  }
}

// Also create pl/index.html
fs.writeFileSync(path.join(plSubDir, 'index.html'), patchHtml(mainHtml), 'utf8');

// 6. Create 404.html (for GitHub Pages routing)
const pomocPath = path.join(srcDir, 'rendered', 'pl', 'pomoc.html');
if (fs.existsSync(pomocPath)) {
  fs.writeFileSync(path.join(rootDir, '404.html'), patchHtml(fs.readFileSync(pomocPath, 'utf8')), 'utf8');
  console.log('4. Created 404.html');
}

console.log('[COMPLETE] GitHub Pages assets and pages ready!');
