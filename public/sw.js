// Minimal service worker — enables PWA install. Network-first passthrough;
// never caches the IPTV proxy or provider streams.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('/api/proxy') || event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
