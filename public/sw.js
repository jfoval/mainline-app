const CACHE_VERSION = 9;
const CACHE_NAME = `mainline-v${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/actions',
  '/inbox',
  '/reference',
  '/projects',
  '/process',
  '/shutdown',
  '/disciplines',
  '/review',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API GET requests: try network, return offline signal on failure
  if (url.pathname.startsWith('/api/')) {
    if (request.method !== 'GET') return; // Let mutations pass through
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ offline: true, message: 'Device is offline' }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'X-Offline': 'true',
          },
        });
      })
    );
    return;
  }

  // App shell & assets: network-first with cache fallback
  if (request.method === 'GET') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
  }
});

// Background sync: notify client tabs to process queue
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});

// Listen for sync registration from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC') {
    self.registration.sync?.register('sync-mutations').catch(() => {});
  }
});
