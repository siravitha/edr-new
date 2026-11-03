import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve('out');
if (!existsSync(root)) {
  // Server mode (this app's default): no static 'out/' directory is produced.
  // Offline capability is provided by the committed public/sw.js PWA service
  // worker, which Next.js serves at /sw.js and page.tsx registers.
  if (existsSync(resolve('public', 'sw.js'))) {
    console.log('[prepare-offline] static export not enabled — offline PWA shell served from committed public/sw.js at /sw.js.');
  } else {
    console.warn('[prepare-offline] WARNING: no out/ and no public/sw.js found — the service worker registration in page.tsx will 404.');
  }
  process.exit(0);
}
async function walk(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await walk(resolve(dir, entry.name), relative));
    else if (/\.(js|css|html|ico|svg|woff2)$/.test(entry.name) && !relative.includes('404')) paths.push(relative);
  }
  return paths;
}
const files = (await walk(root)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(resolve(root, '.' + file)));
const cache = `uth-demo-${hash.digest('hex').slice(0, 12)}`;
await writeFile(resolve(root, 'sw.js'), `
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(['/', ...files])};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('uth-demo-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
  }
});
`, 'utf8');
console.log(`Offline shell prepared: ${files.length} files (${cache})`);
