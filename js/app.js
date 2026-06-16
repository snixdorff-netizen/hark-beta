// Hark — app shell, router, persistent chrome.
import { el, clear, icon, iconEl } from './ui.js';
import { get, save, touchStreak, today, getQuest, addXp } from './state.js';
import { loadManifest, byId, creatureEmoji, GROUPS } from './content.js';
import { rankProgress } from './rank.js';
import * as audio from './audio.js';
import { init as initAnalytics, track } from './analytics.js';
import { showPrivacyNotice, showOwnerDashboard } from './probes.js';
import { shareGrove } from './sharecard.js';

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

const app = { go, mentor, toast, milestone: showMilestone, collection: showCollection };

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

  // Quest strip — thin progress bar below topbar, visible on feed only
  const existingStrip = appRoot.querySelector('.quest-strip');
  if (existingStrip) existingStrip.remove();
  if (active === 'feed') {
    const q = getQuest();
    const pct = Math.min(1, q.progress / q.goal);
    const LABELS = { snap: `Play Snap ${q.goal}×`, discover: `Discover ${q.goal} sounds`, challenge: 'Challenge a friend' };
    const strip = el('div', { class: 'quest-strip' });
    strip.style.cssText = 'position:absolute;top:var(--topbar-h,52px);left:0;right:0;z-index:9;padding:4px 16px 5px;background:linear-gradient(var(--bg) 70%,transparent)';
    const inner = el('div', { style: 'display:flex;align-items:center;gap:8px' });
    inner.appendChild(el('div', { style: 'font-size:10px;color:var(--teal);font-weight:600;letter-spacing:.05em;white-space:nowrap', text: q.done ? '✓ Mission done' : 'MISSION' }));
    const bar = el('div', { style: 'flex:1;height:3px;background:rgba(62,201,159,.15);border-radius:2px;overflow:hidden' });
    const fill = el('div', { style: `height:100%;width:${Math.round(pct*100)}%;background:${q.done ? 'var(--teal)' : 'rgba(62,201,159,.6)'};border-radius:2px` });
    bar.appendChild(fill);
    inner.appendChild(bar);
    inner.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);white-space:nowrap', text: q.done ? '' : `${q.progress}/${q.goal} · ${LABELS[q.type]}` }));
    strip.appendChild(inner);
    appRoot.appendChild(strip);
  }
}

let _lastRankTitle = null;

function checkRankUp(s) {
  const rp = rankProgress(Object.keys(s.discovered).length);
  if (_lastRankTitle && _lastRankTitle !== rp.rank.title) {
    setTimeout(() => {
      mentor(`<b>Rank up!</b> You're now a ${rp.rank.emoji} <b>${rp.rank.title}</b>. Your ears are sharpening.`, 8000);
      const badge = appRoot.querySelector('.rank-badge');
      if (badge) { badge.classList.add('rankup'); setTimeout(() => badge.classList.remove('rankup'), 1400); }
    }, 600);
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
  // Streak urgency — user hasn't played today yet
  if (name === 'feed' && s.streak >= 1 && s.lastPlayed !== today()) {
    setTimeout(() => mentor(`<b>🔥 Day ${s.streak} streak.</b> Play a round to keep it alive — or it resets at midnight.`, 7000), 1000);
  }
  // Welcome-back message for streak players who already played today
  else if (name === 'feed' && s.streak >= 3 && s.lastPlayed === today()) {
    const msgs = [
      `<b>Day ${s.streak}.</b> The forest is glad you're back.`,
      `<b>Wren:</b> ${s.streak} days straight. Most people don't make it this far.`,
      `<b>Wren:</b> Back again. Your ear remembers more than you think.`,
    ];
    const idx = s.streak % msgs.length;
    setTimeout(() => mentor(msgs[idx], 5000), 900);
  }

  if (name === 'feed') {
    // Haul-ready nudge
    if (s.haul && Date.now() > s.haul.readyAt) {
      const unsorted = s.haul.items.filter((id) => !s.haul.sorted.includes(id)).length;
      if (unsorted > 0) {
        setTimeout(() => mentor('<b>Wren:</b> Your overnight haul is ready — something unusual showed up. Check the Haul tab. 🌙', 7000), 1800);
      }
    }
    // Progressive feature discovery tips (shown once each)
    const discovered = Object.keys(s.discovered).length;
    const shownTips = (() => { try { return JSON.parse(localStorage.getItem('hark.tips') || '[]'); } catch (e) { return []; } })();
    const tip = (key, html, delay) => {
      if (shownTips.includes(key)) return;
      shownTips.push(key);
      localStorage.setItem('hark.tips', JSON.stringify(shownTips));
      setTimeout(() => mentor(html, 8000), delay);
    };
    if (discovered >= 3 && discovered < 8) tip('snap_tip', '<b>Wren:</b> You\'ve found a few. Now test yourself — try <b>Snap</b> and see if you can ID them by spectrogram alone.', 2500);
    else if (discovered >= 8 && discovered < 15) tip('grove_tip', '<b>Wren:</b> Your Grove is growing. Tap the <b>Grove</b> tab to see every sound you\'ve collected.', 2500);
    else if (discovered >= 15) tip('haul_tip', '<b>Wren:</b> Deploy the <b>Haul</b> recorder tonight. It listens while you sleep and brings back whatever the forest says.', 2500);
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

function toast(text, ms = 2500) {
  const old = appRoot.querySelector('.toast-disc');
  if (old) old.remove();
  const t = el('div', { class: 'toast-disc', text });
  appRoot.appendChild(t);
  setTimeout(() => { if (t.isConnected) t.remove(); }, ms);
}

function showCollection(hit) {
  const groupLabel = (GROUPS[hit.group] || {}).label || hit.group;
  addXp(200);
  const ovl = el('div', { class: 'milestone-ovl' });

  ovl.appendChild(el('div', { style: 'font-size:11px;font-weight:600;color:var(--teal);letter-spacing:.1em', text: 'COLLECTION COMPLETE' }));

  const emoRow = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0;font-size:32px;line-height:1' });
  hit.creatures.forEach((c) => {
    const e = document.createElement('div');
    e.textContent = creatureEmoji(c);
    emoRow.appendChild(e);
  });
  ovl.appendChild(emoRow);

  ovl.appendChild(el('div', { style: 'font-size:22px;font-weight:700;color:var(--ink)', text: groupLabel }));
  ovl.appendChild(el('div', { style: 'font-size:13px;color:var(--muted);margin-top:2px', text: 'Every ' + groupLabel.toLowerCase() + ' sound found. 🌿' }));
  ovl.appendChild(el('div', { style: 'font-size:12px;color:var(--amber);margin-top:2px', text: '+200 XP · Full Collection' }));

  const shareBtn = el('button', { class: 'cta', style: 'margin-top:12px', text: '📤 Share your collection' });
  shareBtn.addEventListener('click', async () => {
    const s2 = get();
    const disc = Object.keys(s2.discovered).map(byId).filter(Boolean);
    await shareGrove(disc, s2, app);
    ovl.remove();
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
  ovl.appendChild(shareBtn);

  const skip = el('button', { class: 'ghost', text: 'Keep listening →' });
  skip.addEventListener('click', () => {
    ovl.remove();
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
  ovl.appendChild(skip);

  appRoot.appendChild(ovl);
  track('collection_complete', { group: hit.group });
  updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
}

function showMilestone(n) {
  const s = get();
  addXp(100);
  const discovered = Object.keys(s.discovered).map(byId).filter(Boolean);
  const ovl = el('div', { class: 'milestone-ovl' });

  const leaf = el('div', { style: 'font-size:44px;line-height:1' });
  leaf.textContent = '🌿';
  ovl.appendChild(leaf);

  const num = el('div', { style: 'font-size:72px;font-weight:700;color:var(--teal);line-height:1' });
  num.textContent = n;
  ovl.appendChild(num);

  ovl.appendChild(el('div', { style: 'font-size:17px;font-weight:500;color:var(--ink);margin-top:4px', text: 'sounds rehomed to your grove.' }));
  ovl.appendChild(el('div', { style: 'font-size:12px;color:var(--amber);letter-spacing:.03em', text: '+100 XP · Your grove is growing.' }));

  if (discovered.length > 0) {
    const row = el('div', { style: 'display:flex;gap:10px;margin:4px 0;font-size:32px;line-height:1' });
    discovered.slice(-Math.min(5, discovered.length)).forEach((c) => {
      const e = document.createElement('div');
      e.textContent = creatureEmoji(c);
      row.appendChild(e);
    });
    ovl.appendChild(row);
  }

  const shareBtn = el('button', { class: 'cta', style: 'margin-top:8px', text: '📤 Share your grove' });
  shareBtn.addEventListener('click', async () => {
    const s2 = get();
    const disc = Object.keys(s2.discovered).map(byId).filter(Boolean);
    await shareGrove(disc, s2, app);
    ovl.remove();
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
  ovl.appendChild(shareBtn);

  const skip = el('button', { class: 'ghost', text: 'Keep listening →' });
  skip.addEventListener('click', () => {
    ovl.remove();
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
  ovl.appendChild(skip);

  appRoot.appendChild(ovl);
  track('milestone', { n });
  updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
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
