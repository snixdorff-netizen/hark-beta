// Hark — service worker. Offline-first cache for the app shell.
const CACHE = 'hark-v63';
const ASSETS = [
  './', './index.html', './css/styles.css', './manifest.webmanifest',
  './js/app.js', './js/ui.js', './js/state.js', './js/audio.js',
  './js/spectrogram.js', './js/content.js', './js/difficulty.js',
  './js/analytics.js', './js/probes.js', './js/rank.js', './js/sharecard.js', './js/notifications.js',
  './js/screens/feed.js', './js/screens/snap.js', './js/screens/noiseornature.js',
  './js/screens/haul.js', './js/screens/grove.js', './js/screens/coldopen.js', './js/screens/ambient.js',
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

// ── Notifications ────────────────────────────────────────────────────────
// No backend exists to send real push today; this handler exists so a future
// server (or third-party push service) can drop in without touching the SW.
self.addEventListener('push', (e) => {
  let data = { title: 'Hark', body: 'Something new in the field.' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './assets/img/icon.svg',
    badge: './assets/img/icon.svg',
    tag: data.tag || 'hark-push',
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

// Periodic Background Sync — Chrome/Android installed PWAs only. Reads the
// streak snapshot mirrored to IndexedDB by notifications.js (a service worker
// can't touch localStorage) and fires a local reminder if the streak is at
// risk. No network call, no server — everything needed is already on-device.
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'streak-check') e.waitUntil(checkStreakAndNotify());
});

function readStreakData() {
  return new Promise((resolve) => {
    const req = indexedDB.open('hark-notify', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('kv'); };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('kv', 'readonly');
        const get = tx.objectStore('kv').get('streakData');
        get.onsuccess = () => resolve(get.result || null);
        get.onerror = () => resolve(null);
      } catch (err) { resolve(null); }
    };
    req.onerror = () => resolve(null);
  });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function checkStreakAndNotify() {
  const data = await readStreakData();
  if (!data || !data.streak || data.streak < 1) return;
  if (data.lastPlayed === todayStr()) return; // already played today
  const hour = new Date().getHours();
  if (hour < 17) return; // only nudge in the evening
  await self.registration.showNotification('🔥 Day ' + data.streak + ' streak', {
    body: 'You haven\'t played today — it resets at midnight. One round keeps it alive.',
    icon: './assets/img/icon.svg',
    badge: './assets/img/icon.svg',
    tag: 'streak-reminder',
  });
}
