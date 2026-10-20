self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.registration.unregister().then(() => {
      return caches.keys();
    }).then(keys => {
      return Promise.all(keys.map(k => caches.delete(k)));
    })
  );
});
