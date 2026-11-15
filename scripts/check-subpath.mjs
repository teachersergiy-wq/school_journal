import { cp, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, extname, join, normalize, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
const build = spawnSync(process.execPath, ['scripts/build.mjs'], {
  cwd: projectRoot,
  encoding: 'utf8'
});
if (build.stdout) process.stdout.write(build.stdout);
if (build.stderr) process.stderr.write(build.stderr);
if (build.status !== 0) process.exit(build.status ?? 1);

const html = await readFile(join(projectRoot, 'dist', 'index.html'), 'utf8');
const manifestText = await readFile(join(projectRoot, 'dist', 'manifest.webmanifest'), 'utf8');
const manifest = JSON.parse(manifestText);
const rootRelativeHtmlPaths = [...html.matchAll(/\b(?:href|src|action)\s*=\s*(["'])(.*?)\1/gi)]
  .map((match) => match[2])
  .filter((value) => value.startsWith('/'));
const manifestStrings = [];
function collectStrings(value) {
  if (typeof value === 'string') manifestStrings.push(value);
  else if (Array.isArray(value)) value.forEach(collectStrings);
  else if (value && typeof value === 'object') Object.values(value).forEach(collectStrings);
}
collectStrings(manifest);
const rootRelativeManifestPaths = manifestStrings.filter((value) => value.startsWith('/'));
if (rootRelativeHtmlPaths.length || rootRelativeManifestPaths.length) {
  throw new Error(
    'Root-relative path found: ' +
      JSON.stringify({ html: rootRelativeHtmlPaths, manifest: rootRelativeManifestPaths })
  );
}
console.log('PASS index.html and manifest.webmanifest contain no root-relative paths.');

const temporaryParent = resolve(tmpdir());
const temporaryRoot = await mkdtemp(join(temporaryParent, 'school-journal-subpath-'));
const resolvedTemporaryRoot = resolve(temporaryRoot);
if (
  !resolvedTemporaryRoot.startsWith(temporaryParent + sep) ||
  !basename(resolvedTemporaryRoot).startsWith('school-journal-subpath-')
) {
  throw new Error('Refusing to use a temporary directory outside the expected location.');
}
const siteRoot = join(resolvedTemporaryRoot, 'school_journal');
await cp(join(projectRoot, 'dist'), siteRoot, { recursive: true });
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png'
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const prefix = '/school_journal/';
    if (!pathname.startsWith(prefix)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const relative = normalize(pathname.slice(prefix.length)).replace(/^([.][.][/\\])+/, '');
    const file = resolve(siteRoot, relative || 'index.html');
    if (file !== siteRoot && !file.startsWith(siteRoot + sep)) {
      response.writeHead(400);
      response.end('Invalid path');
      return;
    }
    const info = await stat(file);
    const target = info.isDirectory() ? join(file, 'index.html') : file;
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(await readFile(target));
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
});

try {
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const address = server.address();
  const origin = 'http://127.0.0.1:' + address.port;
  const checks = [
    ['/school_journal/', 'text/html; charset=utf-8'],
    ['/school_journal/src/main.js', 'text/javascript; charset=utf-8'],
    ['/school_journal/src/styles.css', 'text/css; charset=utf-8'],
    ['/school_journal/manifest.webmanifest', 'application/manifest+json'],
    ['/school_journal/service-worker.js', 'text/javascript; charset=utf-8'],
    ['/school_journal/icon.svg', 'image/svg+xml'],
    ['/school_journal/icon-192.png', 'image/png', 192],
    ['/school_journal/icon-512.png', 'image/png', 512],
    ['/school_journal/icon-maskable-512.png', 'image/png', 512],
    ['/school_journal/apple-touch-icon.png', 'image/png', 180]
  ];
  for (const [path, expectedType, expectedWidth] of checks) {
    const response = await fetch(origin + path);
    const actualType = response.headers.get('content-type');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (response.status !== 200) {
      throw new Error(path + ': expected HTTP 200, got ' + response.status);
    }
    if (actualType !== expectedType) {
      throw new Error(path + ': expected Content-Type ' + expectedType + ', got ' + actualType);
    }
    if (expectedWidth && (
      bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' ||
      bytes.readUInt32BE(16) !== expectedWidth ||
      bytes.readUInt32BE(20) !== expectedWidth
    )) {
      throw new Error(path + ': PNG signature or dimensions are incorrect');
    }
    console.log('PASS ' + path + ' -> ' + response.status + ' (' + actualType + ')');
  }
  console.log('GitHub Pages subpath check passed (10 resources).');
} finally {
  await new Promise((resolveClose, rejectClose) =>
    server.close((error) => error ? rejectClose(error) : resolveClose())
  );
  await rm(temporaryRoot, { recursive: true, force: true });
}
