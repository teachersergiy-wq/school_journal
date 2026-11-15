import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png'
};

createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const safe = normalize(p).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
    let f = join(root, safe || 'index.html');
    try {
      if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
    } catch {
      f = join(root, 'index.html');
    }
    res.writeHead(200, {
      'Content-Type': types[extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(await readFile(f));
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(port, host, () => {
  console.log(`School Journal: http://${host}:${port}`);
  console.log('For phone on LAN set HOST=0.0.0.0');
});
