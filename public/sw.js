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

self.addEventListener('push', event => {
  let room;
  try { room = event.data?.json()?.room; }
  catch { return; }
  if (typeof room !== 'string' || !/^lab-[0-9a-f]{32}$/.test(room)) return;
  event.waitUntil(self.registration.showNotification('Görüşme daveti', {
    body: 'Odaya katılmak için bildirime dokun.',
    icon: '/icon-192.png',
    tag: 'meeting-invite',
    data: { room },
  }));
});

self.addEventListener('notificationclick', event => {
  const room = event.notification.data?.room;
  if (typeof room !== 'string' || !/^lab-[0-9a-f]{32}$/.test(room)) return;
  event.notification.close();
  const url = new URL('/', self.location.origin);
  url.searchParams.set('room', room);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => client.url === url.href);
    if (existing) await existing.focus();
    else await self.clients.openWindow(url.href);
  })());
});
