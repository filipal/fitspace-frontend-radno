// Osnova: bolje strategije kesiranja i čišćenje starih cacheva
const VERSION = 'v3';
const STATIC_CACHE = `fitspace-static-${VERSION}`;
const RUNTIME_CACHE = `fitspace-runtime-${VERSION}`;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Očisti stare cacheve
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key))
      .map((key) => caches.delete(key))
    );
    // Uključi Navigation Preload (brže prve navigacije)
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    await self.clients.claim();
  })());
});

/**
 * Strategije:
 * - Navigacije (HTML): network-first (svježi HTML sprječava razvučen layout nakon deploya)
 * - Skripte/stilovi (hashirani u Vite buildu): cache-first
 * - Slike/fontovi: stale-while-revalidate
 * - Ostalo i POST/vanjsko: proslijedi na mrežu bez kesiranja
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Ne diraj ne-GET zahtjeve
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Izbjegni Chrome ekstenzije i sam SW
  if (url.protocol === 'chrome-extension:' || url.pathname.endsWith('/sw.js')) return;

  // Navigacije: network-first
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(event));
    return;
  }

  // Samo isti origin keširamo
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // pusti mrežu

  const dest = req.destination;
  if (dest === 'script' || dest === 'style' || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (dest === 'image' || dest === 'font') {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }
  // Default: pusti mrežu
});

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        cache.put(request, res.clone());
        return res;
      });
    })
  );
}

async function handleNavigate(event) {
  // Iskoristi preload ako je omogućen
  const preload = event.preloadResponse ? event.preloadResponse : null;
  // Network-first s timeoutom (npr. 3000ms), pa fallback na cache
  const res = await networkFirstWithTimeout(event.request, { timeoutMs: 3000, cacheHtml: false }).catch(async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    return cache.match(event.request);
  });
  return res || (preload ? await preload : fetch(event.request));
}

function networkFirstWithTimeout(request, { timeoutMs = 3000, cacheHtml = false } = {}) {
  return caches.open(RUNTIME_CACHE).then(async (cache) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(request, { signal: controller.signal });
      clearTimeout(timer);
      if (cacheHtml) {
        try { cache.put(request, res.clone()); } catch {}
      }
      return res;
    } catch (e) {
      clearTimeout(timer);
      const cached = await cache.match(request);
      if (cached) return cached;
      throw e;
    }
  });
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);
      return cached || fetchPromise;
    })
  );
}
