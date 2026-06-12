const CACHE_NAME = 'fleet-app-shell-v1';

const APP_SHELL = [
  './fleet_mobile.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Live data (Google Sheets CSV, Apps Script entry API): always network, never cache
// - Everything else (app shell, fonts, CDN libs): cache-first, fall back to network and cache the result
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  const isLiveData =
    url.includes('docs.google.com') ||
    url.includes('script.google.com');

  if (isLiveData) {
    // Always go to the network for live data
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response('Offline — live data unavailable', { status: 503 })
      )
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Only cache successful, basic/cors responses
          if (response.ok && (response.type === 'basic' || response.type === 'cors')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // If navigation request fails offline, serve the cached app shell
          if (event.request.mode === 'navigate') {
            return caches.match('./fleet_mobile.html');
          }
          return new Response('Offline', { status: 503 });
        });
    })
  );
});
