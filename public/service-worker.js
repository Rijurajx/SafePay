// Self-destroying service worker to unregister any zombie service workers from previous projects on this origin
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clear all caches created by any previous service worker on this origin
      if (typeof caches !== 'undefined') {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      // Unregister this service worker
      await self.registration.unregister();
      // Inform all open clients
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Never intercept requests - pass through directly
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

