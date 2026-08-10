const CACHE_NAME = 'oikos-v10';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/img/favicon.ico',
  '/img/android-chrome-192x192.png',
  '/img/android-chrome-512x512.png'
];

function shouldBypass(urlString) {
  try {
    const { pathname } = new URL(urlString);
    return (
      pathname === '/api'
      || pathname.startsWith('/api/')
      || pathname === '/_/'
      || pathname.startsWith('/_/')
    );
  } catch {
    return false;
  }
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch(() => {
        console.log('Some resources failed to cache');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (shouldBypass(event.request.url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(event.request))
          || (await caches.match('/'))
          || offlineResponse();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response && response.status === 200 && response.type !== 'opaque') {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return offlineResponse();
    }
  })());
});
