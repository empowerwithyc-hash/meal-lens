// Meal Lens service worker
// Bump-friendly: single CACHE constant. Bump this string on every future update
// so phones don't keep serving a stale app shell forever.
const CACHE = 'meal-lens-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

// Domains the service worker must NEVER intercept — Dropbox auth/content
// traffic has to reach the network untouched (oauth redirects, CORS, byte
// range semantics for upload/download all break under a cache-first SW).
const PASSTHROUGH_HOSTS = [
  'dropbox.com',
  'www.dropbox.com',
  'api.dropboxapi.com',
  'content.dropboxapi.com',
  'notify.dropboxapi.com',
  'dropboxusercontent.com'
];

function isPassthrough(url) {
  try {
    const host = new URL(url).hostname;
    return PASSTHROUGH_HOSTS.some(h => host === h || host.endsWith('.' + h));
  } catch (e) {
    return false;
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Hard passthrough: never touch Dropbox traffic. Do not call
  // event.respondWith at all so the browser handles the request natively.
  if (isPassthrough(req.url)) {
    return;
  }

  if (req.method !== 'GET') {
    return;
  }

  // Cache-first for the app shell, falling back to network then caching the
  // response for next time.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
