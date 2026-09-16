const CACHE_NAME = 'cc-events-v4';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/cc.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - precache core shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE).catch(err => {
        console.log('Cache addAll error:', err);
      });
    })
  );
});

// Activate event - cleanup stale caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from client update prompt
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - Network first for navigations/API, Cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http schemes
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Never cache Firebase Auth, Firestore, or OAuth token endpoints (SEC-07 credential safety)
  if (
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.origin.includes('securetoken.googleapis.com') ||
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('googleapis.com')
  ) {
    return; // Pass through directly to network without caching
  }

  // Always use network-first for navigations so / uses fresh index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put('/index.html', clone);
            });
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For app API endpoints, use network-first strategy with cache fallback
  if (url.pathname.includes('/api') || url.origin !== self.location.origin) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For static local assets (JS, CSS, images, fonts), use cache-first with network fallback
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, clone);
          });
        }
        return networkResponse;
      });
    }).catch(() => {
      // If both fail and request is for an image or svg, return cached cc.svg
      if (request.destination === 'image') {
        return caches.match('/cc.svg');
      }
    })
  );
});
