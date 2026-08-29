// Local static server that behaves like Vercel/Netlify: extensionless clean
// URLs resolve to <path>/index.html and are served WITHOUT a redirect to a
// trailing slash.
//
// This matters. The Framer runtime writes RELATIVE links ("./projects/x") and
// resolves them against document.baseURI, so they only resolve correctly from a
// slash-less path. `python3 -m http.server` 301s /about to /about/, which
// silently breaks every onward link on the page. Use this instead, or you will
// verify a mirror that cannot be navigated.
//
//   node docs/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname — the latter leaves %20 in place, so any repo
// living under a directory with a space in it resolves to nothing and every
// route 404s while still rendering Framer's client-side shell.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || 8477);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.mp4': 'video/mp4',
  '.framercms': 'application/octet-stream',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  const rel = path.normalize(clean).replace(/^(\.\.[/\\])+/, '');
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null;
  for (const c of [abs, abs + '.html', path.join(abs, 'index.html')]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

http.createServer((req, res) => {
  const file = resolveFile(req.url === '/' ? '/index.html' : req.url);
  if (!file) {
    const nf = path.join(ROOT, '404.html');
    if (fs.existsSync(nf)) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      return res.end(fs.readFileSync(nf));
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404');
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));
