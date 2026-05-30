/* Service Worker for "אלוף הידע" — Hebrew trivia PWA.
 * Served under a sub-path (/lucy02/quiz-game/) on GitHub Pages,
 * so every URL here is RELATIVE to the SW's scope. No leading slashes. */

// Bump this version whenever the precached assets change.
const CACHE = 'aluf-hadaat-v1';

// App-shell assets to precache. All relative to the SW scope.
const PRECACHE_URLS = [
  './',
  './index.html',
  './data.js',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// --- Install: precache the app shell --------------------------------------
// cache.addAll() rejects atomically if ANY request 404s, which would break
// the whole install. Instead we cache each entry individually with
// Promise.allSettled so a single missing file is tolerated.
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          try {
            // cache: 'reload' bypasses the HTTP cache so we store fresh copies.
            const response = await fetch(url, { cache: 'reload' });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            // Ignore individual failures — install still succeeds.
          }
        })
      );
      // Activate this SW immediately without waiting for old tabs to close.
      await self.skipWaiting();
    })()
  );
});

// --- Activate: drop stale caches and take control -------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.map((name) => (name !== CACHE ? caches.delete(name) : undefined))
      );
      // Start controlling open clients right away.
      await self.clients.claim();
    })()
  );
});

// --- Fetch: stale-while-revalidate for same-origin GETs -------------------
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  // Only handle same-origin requests; leave cross-origin alone.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(handleRequest(request));
});

/**
 * Cache-first with background revalidation (stale-while-revalidate):
 * serve the cached copy immediately if present, while fetching a fresh
 * copy to update the cache. Fall back to the network when not cached.
 * For failed navigations, fall back to the cached app shell / offline page.
 */
async function handleRequest(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  // Kick off a network fetch that also refreshes the cache on success.
  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        // Clone before caching — a response body can only be read once.
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => undefined);

  // If we have a cached copy, return it now and update in the background.
  if (cached) {
    return cached;
  }

  // Nothing cached — wait for the network.
  const networkResponse = await networkFetch;
  if (networkResponse) {
    return networkResponse;
  }

  // Network failed and nothing cached. For page navigations, fall back to
  // the cached app shell, then the offline page.
  if (request.mode === 'navigate') {
    const fallback =
      (await cache.match('./index.html')) ||
      (await cache.match('./offline.html'));
    if (fallback) return fallback;
  }

  // Last resort: a basic offline error response.
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
