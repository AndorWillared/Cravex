// Cache-first Service Worker. Bump VERSION on every change to app files.
const VERSION = 'spectrack-v1';
const FILES = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  './css/style.css',
  './js/app.js', './js/config.js', './js/dates.js', './js/store.js', './js/score.js', './js/ui.js', './js/stats.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
