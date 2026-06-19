// Hark — service worker. Offline-first cache for the app shell.
const CACHE = 'hark-v42';
const ASSETS = [
  './', './index.html', './css/styles.css', './manifest.webmanifest',
  './js/app.js', './js/ui.js', './js/state.js', './js/audio.js',
  './js/spectrogram.js', './js/content.js', './js/difficulty.js',
  './js/analytics.js', './js/probes.js', './js/rank.js', './js/sharecard.js',
  './js/screens/feed.js', './js/screens/snap.js', './js/screens/noiseornature.js',
  './js/screens/haul.js', './js/screens/grove.js', './js/screens/coldopen.js',
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy).catch(() => {}));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
