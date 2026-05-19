// public/sw.js — Readle PWA Service Worker
// NOTE: For offline to work properly this SW must be tested against the
// production build (npm run build && npm run preview), NOT the Vite dev
// server. In dev mode, Vite injects @vite/client (a live WebSocket module)
// that cannot run offline.

const CACHE_NAME = 'readle-v4';

// Pre-cache the full app shell: HTML + all production JS/CSS bundles.
// Update the hashed filenames here after every `npm run build`.
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index-CACZvR5y.js',
  '/assets/index-Dwmp08TO.css',
];

// ─── INSTALL ─────────────────────────────────────────────────────────────────
// Cache each asset individually — atomic addAll() fails everything on one error.
self.addEventListener('install', (event) => {
  console.log('[SW] Installing... cache:', CACHE_NAME);

  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      let cached = 0;

      for (const url of STATIC_ASSETS) {
        try {
          await cache.add(url);
          console.log('[SW] ✓ Pre-cached:', url);
          cached++;
        } catch (err) {
          console.warn('[SW] ✗ Pre-cache failed:', url, '—', err.message);
        }
      }

      const keys = await cache.keys();
      console.log(`[SW] Install complete — ${cached}/${STATIC_ASSETS.length} assets cached (${keys.length} total entries)`);

      // Force this SW to activate without waiting for existing clients to close
      self.skipWaiting();
    })()
  );
});

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');

  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', name);
            return caches.delete(name);
          }
        })
      )
    )
  );

  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests from our own origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Skip Vite dev-server internal paths (no-op in production)
  if (url.pathname.startsWith('/@') || url.pathname.startsWith('/__')) {
    return;
  }

  // ── Navigate (page load / hard refresh) ────────────────────────────────────
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Cache the fresh HTML AND store it under '/' for hard-refresh fallback
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone.clone());
              cache.put('/', clone);
            });
          }
          return response;
        })
        .catch(async () => {
          console.warn('[SW] Offline — serving from cache');
          // Try: exact URL → '/' → '/index.html'
          const shell =
            (await caches.match(request)) ||
            (await caches.match('/')) ||
            (await caches.match('/index.html'));

          if (shell) return shell;

          return new Response(
            'Offline — open the app once while online to enable offline mode.',
            {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            }
          );
        })
    );
    return;
  }

  // ── All other assets: cache-first, network fallback ─────────────────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => new Response('', { status: 503 }));
    })
  );
});

// ─── MESSAGES ────────────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared');
      event.ports[0]?.postMessage({ type: 'CACHE_CLEARED' });
    });
  }
});
