// Hark — notification opt-in + background streak reminders.
// No backend exists for this static PWA, so there is no server-triggered push.
// What IS real: Periodic Background Sync lets an installed Chrome/Android PWA
// wake its service worker on a timer and show a local notification even when
// the app is fully closed. Safari/iOS and non-installed browsers don't support
// this — for them, opting in only buys same-session reminders.

const DB_NAME = 'hark-notify';
const STORE = 'kv';
const PERM_ASKED_KEY = 'hark.notifAsked';
const ENABLED_KEY = 'hark.notifEnabled';

export function isNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function isPeriodicSyncSupported() {
  return 'serviceWorker' in navigator && 'PeriodicSyncManager' in window;
}

export function hasAskedPermission() {
  return localStorage.getItem(PERM_ASKED_KEY) === '1';
}

// Mark the opt-in prompt as seen without triggering the browser permission
// dialog — used when the user dismisses our own pre-prompt with "Not now".
export function markPromptSeen() {
  localStorage.setItem(PERM_ASKED_KEY, '1');
}

export function notificationsEnabled() {
  return isNotificationSupported() && Notification.permission === 'granted' && localStorage.getItem(ENABLED_KEY) !== '0';
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Mirror the bits of state a (backend-less) service worker needs to decide
// whether to fire a streak reminder during periodicsync. Call after any save().
export async function mirrorState(state) {
  if (!('indexedDB' in window)) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      streak: state.streak,
      longestStreak: state.longestStreak || 0,
      lastPlayed: state.lastPlayed,
      discovered: Object.keys(state.discovered || {}).length,
    }, 'streakData');
    db.close();
  } catch (e) {}
}

async function registerPeriodicSync() {
  if (!isPeriodicSyncSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register('streak-check', { minInterval: 20 * 60 * 60 * 1000 });
    return true;
  } catch (e) { return false; }
}

export async function requestPermission() {
  localStorage.setItem(PERM_ASKED_KEY, '1');
  if (!isNotificationSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted') {
    localStorage.setItem(ENABLED_KEY, '1');
    await registerPeriodicSync();
  }
  return result;
}

export function setEnabled(on) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  if (on && Notification.permission === 'granted') registerPeriodicSync();
}
