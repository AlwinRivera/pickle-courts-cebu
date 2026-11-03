// Caches the app shell so it opens offline and installs as an app.
// Bump VERSION whenever you deploy changes so phones pick up the new files.
const VERSION = 'pickle-courts-v5';
const SHELL = ['./', 'index.html', 'styles.css', 'data.js', 'features.js', 'app.js', 'vendor/leaflet.js', 'vendor/leaflet.css',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // map tiles and fonts go straight to network
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
