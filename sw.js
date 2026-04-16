const cacheName = 'total-kalk-v1';
const assets = [
  'index.html',
  'style.css',
  'script.js',
  'manifest.json'
];

// Installerer og lagrer filer i cache
self.addEventListener('install', e => {
  e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});

// Henter filer fra cache hvis offline
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
