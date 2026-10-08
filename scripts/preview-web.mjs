import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.desktop-preview');
const port = Number(process.argv[3] || 8125);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
http.createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/activecard') pathname = '/';
    else if (pathname.startsWith('/activecard/')) pathname = pathname.slice('/activecard'.length);
    const candidate = path.resolve(root, `.${pathname}`);
    if (candidate !== root && !candidate.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    let file;
    for (const location of [candidate, candidate + '.html', path.join(candidate, 'index.html')]) {
      if (await stat(location).then((info) => info.isFile()).catch(() => false)) { file = location; break; }
    }
    if (!file && !path.extname(pathname)) file = path.join(root, 'index.html');
    if (!file) { response.writeHead(404); response.end(); return; }
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cache-Control': 'no-store',
    });
    response.end(body);
  } catch { response.writeHead(404); response.end(); }
}).listen(port, '127.0.0.1', () => console.log(`ActiveCard: http://localhost:${port}/activecard/biblioteca`));
