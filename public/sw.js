/* UTH Smart Assets — offline PWA service worker (server mode).
 *
 * Registered by app/page.tsx via navigator.serviceWorker.register("/sw.js").
 * In the default (server) runtime Next.js serves public/sw.js at /sw.js.
 *
 * Strategy (safe for a live CRUD app):
 *   - /api/* requests ............ BYPASSED (always hit the network — never serve stale data)
 *   - page navigations ........... network-first, fall back to the cached app shell when offline
 *   - same-origin static assets .. stale-while-revalidate cache (/_next/, js, css, fonts, icons)
 *   - non-GET / cross-origin ..... left untouched
 */
const VERSION = "v1";
const SHELL_CACHE = `uth-shell-${VERSION}`;
const ASSET_CACHE = `uth-assets-${VERSION}`;

const APP_SHELL = ["/", "/index.html"];

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === self.location.origin;
  } catch {
    return false;
  }
};

const isApi = (url) => {
  try {
    return new URL(url).pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

const isCachableAsset = (url) => {
  if (!isSameOrigin(url) || isApi(url)) return false;
  const u = new URL(url);
  return (
    u.pathname.startsWith("/_next/") ||
    /\.(js|mjs|css|woff2?|ttf|eot|otf|svg|ico|png|jpe?g|webp|avif|txt|map)$/i.test(u.pathname)
  );
};

self.addEventListener("install", (event) => {
  // Pre-cache the app shell. allSettled so a single 404 can't fail the whole install.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => Promise.allSettled(APP_SHELL.map((p) => cache.add(p))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Drop stale versioned caches, then take control of all open clients immediately.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (k) =>
              (k.startsWith("uth-shell-") || k.startsWith("uth-assets-")) &&
              k !== SHELL_CACHE &&
              k !== ASSET_CACHE
          )
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !isSameOrigin(request.url)) return;
  if (isApi(request.url)) return; // live data — always to the network

  // App-shell navigation: network-first with offline fallback to the last cached shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match("/index.html")))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (isCachableAsset(request.url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
