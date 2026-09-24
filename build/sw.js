/* Service worker ALCM : garde l'application (HTML, JS, CSS, images, polices)
   pour qu'elle s'ouvre hors connexion. Les paroles sont gardées par
   l'application elle-même (localStorage). L'API et l'audio ne sont jamais
   mis en cache ici : l'audio n'est pas disponible hors connexion. */
const CACHE = 'alcm-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.json', '/cross.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// The page sends the files it loaded before this worker was active (first visit).
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(event.data.urls.map((href) => {
    const url = new URL(href, self.location.href);
    if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return null;
    if (url.origin !== self.location.origin && !FONT_HOSTS.includes(url.hostname)) return null;
    const request = new Request(url.href, { mode: url.origin === self.location.origin ? 'same-origin' : 'no-cors' });
    return cache.match(request).then((hit) => hit || fetch(request).then((response) => putInCache(request, response)).catch(() => null));
  }))));
});

const putInCache = (request, response) => {
  if (response && (response.ok || response.type === 'opaque')) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;
  if (request.destination === 'audio' || request.destination === 'video') return;
  if (sameOrigin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/sockjs-node'))) return;

  // Pages: network first so a new deployment is picked up, cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => putInCache('/index.html', response))
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static files (hashed by the build) and fonts: cache first, refreshed in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => putInCache(request, response)).catch(() => cached);
      return cached || network;
    })
  );
});
