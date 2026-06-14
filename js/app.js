// Hark — app shell, router, persistent chrome.
import { el, clear, icon, iconEl } from './ui.js';
import { get } from './state.js';
import { loadManifest } from './content.js';
import * as audio from './audio.js';
import { init as initAnalytics, track } from './analytics.js';
import { showPrivacyNotice, showOwnerDashboard } from './probes.js';

import { mount as coldopen } from './screens/coldopen.js';
import { mount as feed } from './screens/feed.js';
import { mount as snap } from './screens/snap.js';
import { mount as noise } from './screens/noiseornature.js';
import { mount as haul } from './screens/haul.js';
import { mount as grove } from './screens/grove.js';

const SCREENS = { feed, snap, noise, haul, grove };
const NAV = [
  { name: 'feed', label: 'Feed', icon: 'home' },
  { name: 'snap', label: 'Snap', icon: 'ear' },
  { name: 'noise', label: 'Noise', icon: 'leaf' },
  { name: 'haul', label: 'Haul', icon: 'moon' },
  { name: 'grove', label: 'Grove', icon: 'tree' },
];

const appRoot = document.getElementById('app');
let shell = null;
let cleanup = null;
let mentorTimer = null;
let brandTaps = 0;
let brandTapTimer = null;

const app = { go, mentor };

function buildShell() {
  if (shell) return shell;
  const topbar = el('div', { class: 'topbar' });
  const body = el('div', { class: 'body' });
  const nav = el('div', { class: 'nav' });
  NAV.forEach((item) => {
    const b = el('button', { html: icon(item.icon, 22) + `<span>${item.label}</span>` });
    b.dataset.name = item.name;
    b.addEventListener('click', () => go(item.name));
    nav.appendChild(b);
  });
  appRoot.appendChild(topbar);
  appRoot.appendChild(body);
  appRoot.appendChild(nav);
  shell = { topbar, body, nav };
  return shell;
}

function updateChrome(active) {
  if (!shell) return;
  const s = get();
  shell.topbar.innerHTML = '';
  const brand = el('div', { class: 'brand', text: 'HARK' });
  brand.addEventListener('click', () => {
    brandTaps++;
    if (brandTaps >= 5) { brandTaps = 0; showOwnerDashboard(); }
    clearTimeout(brandTapTimer);
    brandTapTimer = setTimeout(() => { brandTaps = 0; }, 1500);
  });
  shell.topbar.appendChild(brand);
  const stats = el('div', { class: 'stats' });
  stats.appendChild(el('div', { class: 'stat', html: `${icon('flame', 16)} <b>${s.streak}</b>` }));
  stats.appendChild(el('div', { class: 'stat', html: `${icon('sparkle', 15)} <b>${s.xp}</b>` }));
  shell.topbar.appendChild(stats);
  shell.nav.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.name === active);
  });
}

function go(name, params = {}) {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  audio.stopAll();

  if (name === 'coldopen') {
    if (shell) { shell.topbar.remove(); shell.body.remove(); shell.nav.remove(); shell = null; }
    clear(appRoot);
    cleanup = coldopen(appRoot, app);
    return;
  }
  buildShell();
  clear(shell.body);
  cleanup = SCREENS[name](shell.body, app, params);
  updateChrome(name);
  track('screen_view', { screen: name });
}

function mentor(html, ms = 6500) {
  const old = appRoot.querySelector('.mentor');
  if (old) old.remove();
  if (mentorTimer) clearTimeout(mentorTimer);
  const m = el('div', { class: 'mentor' });
  m.appendChild(el('div', { class: 'who', html: icon('ear', 18) }));
  m.appendChild(el('div', { class: 'msg', html }));
  m.addEventListener('click', () => m.remove());
  appRoot.appendChild(m);
  mentorTimer = setTimeout(() => m.remove(), ms);
}

// boot
async function boot() {
  initAnalytics();
  await loadManifest();
  const s = get();
  if (!s.onboarded) go('coldopen');
  else { go('feed'); showPrivacyNotice(); }
}
boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
