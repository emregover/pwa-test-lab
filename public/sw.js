const shell = 'pwa-lab-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(shell).then(cache => cache.addAll(['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' && new URL(event.request.url).origin === self.location.origin
      && !new URL(event.request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request).catch(() => new Response('PWA Test Laboratuvarı için internet bağlantısı gerekiyor.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })));
  }
});
