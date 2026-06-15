// Hark — app shell, router, persistent chrome.
import { el, clear, icon, iconEl } from './ui.js';
import { get, save, touchStreak, today } from './state.js';
import { loadManifest } from './content.js';
import { rankProgress } from './rank.js';
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

// ── Theme system ──────────────────────────────────────────────────────────
const THEMES = ['nightwood', 'daylight', 'instrument'];
const THEME_ICONS = { nightwood: 'moon', daylight: 'sun', instrument: 'wave' };
const THEME_LABELS = { nightwood: 'Nightwood', daylight: 'Daylight', instrument: 'Instrument' };
let currentTheme = localStorage.getItem('hark.theme') || 'nightwood';

const THEME_COLORS = { nightwood: '#0d1110', daylight: '#f4efe6', instrument: '#0b1018' };

function applyTheme(t) {
  currentTheme = t;
  localStorage.setItem('hark.theme', t);
  document.documentElement.dataset.theme = t === 'nightwood' ? '' : t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[t] || '#0d1110';
}

function cycleTheme() {
  const next = THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length];
  applyTheme(next);
  updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
}

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
  const mid = el('div', { style: 'flex:1' });
  shell.topbar.appendChild(mid);
  const stats = el('div', { class: 'stats' });
  const rp = rankProgress(Object.keys(s.discovered).length);
  const rankBadge = el('div', { class: 'rank-badge', title: rp.rank.title });
  rankBadge.textContent = rp.rank.emoji;
  stats.appendChild(rankBadge);
  const discovered = Object.keys(s.discovered).length;
  if (discovered > 0) stats.appendChild(el('div', { class: 'stat', style: 'color:var(--teal);font-size:11px;letter-spacing:.03em', html: `<b>${discovered}</b><span style="opacity:.55">/93</span>` }));
  stats.appendChild(el('div', { class: 'stat', html: `${icon('flame', 16)} <b>${s.streak}</b>` }));
  stats.appendChild(el('div', { class: 'stat', html: `${icon('sparkle', 15)} <b>${s.xp}</b>` }));
  const themeBtn = el('button', {
    'aria-label': `Theme: ${THEME_LABELS[currentTheme]}`,
    style: 'padding:4px 6px;color:var(--muted);border-radius:8px',
    html: icon(THEME_ICONS[currentTheme], 18),
  });
  themeBtn.addEventListener('click', cycleTheme);
  stats.appendChild(themeBtn);
  shell.topbar.appendChild(stats);
  shell.nav.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.name === active);
  });
}

let _lastRankTitle = null;

function checkRankUp(s) {
  const rp = rankProgress(Object.keys(s.discovered).length);
  if (_lastRankTitle && _lastRankTitle !== rp.rank.title) {
    setTimeout(() => mentor(`<b>Rank up!</b> You're now a ${rp.rank.emoji} <b>${rp.rank.title}</b>. Your ears are sharpening.`, 8000), 600);
  }
  _lastRankTitle = rp.rank.title;
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
  const s = get();
  cleanup = SCREENS[name](shell.body, app, params);
  updateChrome(name);
  track('screen_view', { screen: name });
  checkRankUp(s);
  // Welcome-back message for streak players
  if (name === 'feed' && s.streak >= 3 && s.lastPlayed === today()) {
    const msgs = [
      `<b>Day ${s.streak}.</b> The forest is glad you're back.`,
      `<b>Wren:</b> ${s.streak} days straight. Most people don't make it this far.`,
      `<b>Wren:</b> Back again. Your ear remembers more than you think.`,
    ];
    const idx = s.streak % msgs.length;
    setTimeout(() => mentor(msgs[idx], 5000), 900);
  }
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

// PWA install prompt — stored and shown once after 2nd play
let _deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstall = e;
  const s = get();
  if (s.xp >= 20 && !localStorage.getItem('hark.installed')) {
    showInstallBanner();
  }
});
window.addEventListener('appinstalled', () => {
  localStorage.setItem('hark.installed', '1');
  track('pwa_installed');
  const banner = appRoot.querySelector('.install-banner');
  if (banner) banner.remove();
});

function showInstallBanner() {
  if (localStorage.getItem('hark.installed') || appRoot.querySelector('.install-banner')) return;
  const banner = el('div', { class: 'install-banner' });
  banner.innerHTML = '';
  const msg = el('div', { style: 'flex:1;font-size:13px;color:var(--ink)' });
  msg.innerHTML = '🌿 <b>Add Hark to your home screen</b> — plays offline, feels native';
  const addBtn = el('button', { class: 'lnk', style: 'color:var(--teal);font-weight:600;font-size:13px;white-space:nowrap', text: 'Add' });
  addBtn.addEventListener('click', async () => {
    banner.remove();
    if (_deferredInstall) {
      await _deferredInstall.prompt();
      const { outcome } = await _deferredInstall.userChoice;
      track('pwa_prompt', { outcome });
      _deferredInstall = null;
    }
  });
  const dismiss = el('button', { class: 'lnk', style: 'color:var(--muted);font-size:12px', text: '✕' });
  dismiss.addEventListener('click', () => { banner.remove(); localStorage.setItem('hark.installed', 'dismissed'); });
  banner.appendChild(msg); banner.appendChild(addBtn); banner.appendChild(dismiss);
  appRoot.appendChild(banner);
  track('pwa_banner_shown');
}

// boot
async function boot() {
  applyTheme(currentTheme);
  initAnalytics();
  await loadManifest();

  const urlParams = new URLSearchParams(window.location.search);
  const challengeId = urlParams.get('challenge');
  if (challengeId) {
    track('challenge_accepted', { id: challengeId });
    const s = get();
    if (!s.onboarded) { s.onboarded = true; save(); }
    go('snap', { challenge: challengeId });
    return;
  }

  const s = get();
  if (!s.onboarded) go('coldopen');
  else { go('feed'); showPrivacyNotice(); }
}
boot();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
