const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const SITE_DIR = path.join(__dirname, 'downloaded_site', 'grimclient.pl');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API: NextAuth session mock
  if (pathname === '/api/auth/session') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user: null, expires: null }));
    return;
  }

  // 2. Next.js image optimization endpoint: /_next/image?url=...
  if (pathname === '/_next/image') {
    const rawTarget = parsedUrl.query.url;
    if (rawTarget) {
      let candidatePath = null;
      if (rawTarget.startsWith('http')) {
        try {
          const parsedTarget = new URL(rawTarget);
          candidatePath = path.join(SITE_DIR, 'external_assets', parsedTarget.hostname, parsedTarget.pathname.replace(/^\/+/, '').replace(/\//g, path.sep));
        } catch (e) {}
      } else {
        candidatePath = path.join(SITE_DIR, rawTarget.replace(/^\/+/, '').replace(/\//g, path.sep));
      }

      if (candidatePath && fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
        const ext = path.extname(candidatePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'image/webp',
          'Cache-Control': 'public, max-age=31536000'
        });
        fs.createReadStream(candidatePath).pipe(res);
        return;
      }
    }
    // Return empty 1x1 transparent png if not found
    const emptyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    res.writeHead(200, { 'Content-Type': 'image/png' });
    res.end(emptyPng);
    return;
  }

  // 3. Static assets: /_next/..., /images/..., /favicon.ico
  let directFilePath = path.join(SITE_DIR, pathname.replace(/^\/+/, '').replace(/\//g, path.sep));
  if (fs.existsSync(directFilePath) && fs.statSync(directFilePath).isFile()) {
    const ext = path.extname(directFilePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(directFilePath).pipe(res);
    return;
  }

  // 4. HTML Routes mapping
  const routeMap = {
    '/': 'rendered/pl.html',
    '/pl': 'rendered/pl.html',
    '/pl/': 'rendered/pl.html',
    '/login': 'rendered/pl/login.html',
    '/pl/login': 'rendered/pl/login.html',
    '/register': 'rendered/pl/register.html',
    '/pl/register': 'rendered/pl/register.html',
    '/documents': 'rendered/pl/documents.html',
    '/pl/documents': 'rendered/pl/documents.html',
    '/changelog': 'rendered/pl/changelog.html',
    '/pl/changelog': 'rendered/pl/changelog.html',
    '/recover-account': 'rendered/pl/recover-account.html',
    '/pl/recover-account': 'rendered/pl/recover-account.html',
    '/recover-email': 'rendered/pl/recover-email.html',
    '/pl/recover-email': 'rendered/pl/recover-email.html',
    '/pomoc': 'rendered/pl/pomoc.html',
    '/pl/pomoc': 'rendered/pl/pomoc.html',
    '/404': 'rendered/pl/pomoc.html'
  };

  const targetHtmlRel = routeMap[pathname];
  if (targetHtmlRel) {
    const htmlPath = path.join(SITE_DIR, targetHtmlRel);
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  // Check if rendered html exists under rendered/<path>.html
  const renderedCandidate = path.join(SITE_DIR, 'rendered', pathname.replace(/^\/+/, '').replace(/\//g, path.sep) + '.html');
  if (fs.existsSync(renderedCandidate) && fs.statSync(renderedCandidate).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(renderedCandidate).pipe(res);
    return;
  }

  // 5. Fallback 404
  const fallback404 = path.join(SITE_DIR, 'rendered', 'pl', 'pomoc.html');
  if (fs.existsSync(fallback404)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(fallback404).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[LOCAL DEV SERVER RUNNING] http://localhost:${PORT}`);
  console.log(`Available local routes:`);
  console.log(`  - http://localhost:${PORT}/ (Strona główna)`);
  console.log(`  - http://localhost:${PORT}/pl/login (Logowanie)`);
  console.log(`  - http://localhost:${PORT}/pl/register (Rejestracja)`);
  console.log(`  - http://localhost:${PORT}/pl/documents (Regulamin i polityka)`);
  console.log(`  - http://localhost:${PORT}/pl/changelog (Changelog)`);
  console.log(`  - http://localhost:${PORT}/pl/recover-account (Odzyskiwanie konta)`);
  console.log(`  - http://localhost:${PORT}/pl/recover-email (Przypomnienie e-mail)`);
});
