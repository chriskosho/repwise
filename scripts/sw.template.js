/* Repwise service worker. Generated into dist/sw.js at build time: the version and file
   list below are filled in by the offline plugin in vite.config.js. It keeps a full copy
   of the app so it opens without a connection. Your data is never cached here; it lives in
   IndexedDB, and requests to other sites (Supabase) are left alone. */
const VERSION = '__VERSION__';
const CACHE = `repwise-${VERSION}`;
const ASSETS = __ASSETS__;
const SCOPE = self.registration.scope; // e.g. https://chriskosho.github.io/repwise/
const SCOPE_PATH = new URL(SCOPE).pathname;
const NAV_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  // addAll is all-or-nothing: if any file fails, this version doesn't install and the
  // previous one keeps working.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Keep this version and the one before it: a tab left open across an update can still
      // ask for the old version's lazy-loaded files.
      const keys = (await caches.keys()).filter((k) => k.startsWith('repwise-'));
      const others = keys.filter((k) => k !== CACHE);
      const keep = new Set([CACHE, others[others.length - 1]]);
      await Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

// Pages: ask the network first so updates show up, but fall back to the saved copy when
// offline or slow. (Every route is the same single-page app.)
async function navigate(request) {
  try {
    return await withTimeout(fetch(request), NAV_TIMEOUT_MS);
  } catch {
    const saved = (await caches.match(SCOPE, { ignoreSearch: true })) || (await caches.match(`${SCOPE}index.html`, { ignoreSearch: true }));
    return saved || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  // Files: the saved copy first. Their names change whenever their contents do.
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
});
