const CACHE_NAME = 'fitspace-cache-v1';

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => self.clients.claim());

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(networkResponse => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
    )
  );
});