const CACHE_VERSION = 11;
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
  '/ideal-calendar',
  '/settings',
  '/conflicts',
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

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data?.type === 'REGISTER_SYNC') {
    self.registration.sync?.register('sync-mutations').catch(() => {});
  }
  // Clear all caches on logout so no authenticated pages are served after sign-out
  if (event.data?.type === 'LOGOUT') {
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    );
  }
});

// Handle notification clicks — navigate to relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus existing tab or open new one
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
