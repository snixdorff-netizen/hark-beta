// Hark — app shell, router, persistent chrome.
import { el, clear, icon, iconEl } from './ui.js';
import { get, save, touchStreak, today, getQuest, addXp } from './state.js';
import { loadManifest, byId, creatureEmoji, GROUPS } from './content.js';
import { rankProgress, earScore } from './rank.js';
import * as audio from './audio.js';
import { init as initAnalytics, track } from './analytics.js';
import { showPrivacyNotice, showOwnerDashboard } from './probes.js';
import { shareGrove } from './sharecard.js';
import { mirrorState, hasAskedPermission, markPromptSeen, requestPermission, isNotificationSupported } from './notifications.js';

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

// ── Scoped timers ────────────────────────────────────────────────────────
// Screens schedule delayed mentor/overlay/state-mutation callbacks (e.g. "show
// a rare-find toast 800ms after discovery"). If the user navigates away before
// a timer fires, the callback would otherwise still run against a torn-down
// screen — showing the wrong screen's toast, or double-firing state mutations
// like touchStreak()/growGrove(). scopedTimeout() tracks every pending timer;
// go() clears them all before mounting the next screen.
let pendingTimers = [];
function scopedTimeout(fn, ms) {
  const id = setTimeout(() => {
    pendingTimers = pendingTimers.filter((x) => x !== id);
    fn();
  }, ms);
  pendingTimers.push(id);
  return id;
}
function clearPendingTimers() {
  pendingTimers.forEach((id) => clearTimeout(id));
  pendingTimers = [];
}

// ── Theme system ──────────────────────────────────────────────────────────
const THEMES = ['nightwood', 'daylight', 'instrument'];
const THEME_ICONS = { nightwood: 'moon', daylight: 'sun', instrument: 'wave' };
const THEME_LABELS = { nightwood: 'Nightwood', daylight: 'Daylight', instrument: 'Instrument' };
const THEME_UNLOCK = { nightwood: 0, daylight: 15, instrument: 40 };
let currentTheme = localStorage.getItem('hark.theme') || 'nightwood';

const THEME_COLORS = { nightwood: '#0d1110', daylight: '#f4efe6', instrument: '#0b1018' };

function unlockedThemes() {
  const disc = Object.keys(get().discovered).length;
  return THEMES.filter((t) => disc >= THEME_UNLOCK[t]);
}

function applyTheme(t) {
  currentTheme = t;
  localStorage.setItem('hark.theme', t);
  document.documentElement.dataset.theme = t === 'nightwood' ? '' : t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLORS[t] || '#0d1110';
}

function cycleTheme() {
  const available = unlockedThemes();
  const idx = available.indexOf(currentTheme);
  const next = available[(idx + 1) % available.length];
  applyTheme(next);
  updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
}

function checkThemeUnlock() {
  const disc = Object.keys(get().discovered).length;
  let unlocked;
  try { unlocked = JSON.parse(localStorage.getItem('hark.themesUnlocked') || '["nightwood"]'); } catch (e) { unlocked = ['nightwood']; }
  if (!Array.isArray(unlocked)) unlocked = ['nightwood'];
  for (const t of THEMES) {
    if (disc >= THEME_UNLOCK[t] && !unlocked.includes(t)) {
      unlocked.push(t);
      localStorage.setItem('hark.themesUnlocked', JSON.stringify(unlocked));
      scopedTimeout(() => mentor('<b>Wren:</b> New look unlocked — <b>' + THEME_LABELS[t] + '</b>. Tap the theme button in the top bar to try it.', 8000), 3500);
      track('theme_unlock', { theme: t });
      return;
    }
  }
}

const app = { go, mentor, toast, milestone: showMilestone, collection: showCollection, checkThemeUnlock, setTimeout: scopedTimeout, pulseRankBadge };

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

let _timeGreetShown = false;

// The authoritative rank-up detection (persisted, flavorful per-rank Wren
// lines) lives in state.js's checkRankUp() and is called from feed.js's
// discovery handler. This used to duplicate that with its own in-memory
// tracker that fired a second, generic "Rank up!" toast on the next
// navigation — now it's just the visual badge-pulse, triggered by the real
// detection instead of a second independent one.
function pulseRankBadge() {
  const badge = appRoot.querySelector('.rank-badge');
  if (badge) { badge.classList.add('rankup'); scopedTimeout(() => badge.classList.remove('rankup'), 1400); }
}

function go(name, params = {}) {
  if (cleanup) { try { cleanup(); } catch (e) {} cleanup = null; }
  clearPendingTimers();
  clearMentorQueue();
  clearOverlayQueue();
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
  mirrorState(s);
  cleanup = SCREENS[name](shell.body, app, params);
  updateChrome(name);
  track('screen_view', { screen: name });
  // Streak break — returning after >2 days absent; streak is still the old value (reset happens on next touchStreak)
  const _lastP = s.lastPlayed ? new Date(s.lastPlayed) : null;
  const _daysGone = _lastP ? Math.round((Date.now() - _lastP) / 86400000) : 0;
  if (name === 'feed' && _daysGone > 2 && s.streak > 1) {
    scopedTimeout(() => mentor(`<b>Wren:</b> Your ${s.streak}-day streak ended. The field is still here — start again.`, 8000), 1000);
  }
  // Streak urgency — user hasn't played today yet (streak still alive)
  else if (name === 'feed' && s.streak >= 1 && s.lastPlayed !== today() && _daysGone <= 2) {
    scopedTimeout(() => mentor(`<b>🔥 Day ${s.streak} streak.</b> Play a round to keep it alive — or it resets at midnight.`, 7000), 1000);
  }
  // Welcome-back message for streak players who already played today
  else if (name === 'feed' && s.streak >= 3 && s.lastPlayed === today()) {
    const streakMsg = s.streak === 7 ? '<b>Wren:</b> Seven days. A full week of wild listening. This is habit now. Your grove has memory.'
      : s.streak === 14 ? '<b>Wren:</b> Two weeks straight. You\'re hearing things most people walk right past.'
      : s.streak === 30 ? '<b>Wren:</b> Thirty days. A month of field work. Most naturalists take years to get here.'
      : s.streak === 60 ? '<b>Wren:</b> Sixty days. I don\'t have anything left to teach you. The field is yours now.'
      : null;
    if (streakMsg) {
      scopedTimeout(() => mentor(streakMsg, 10000), 900);
    } else {
      const msgs = [
        `<b>Day ${s.streak}.</b> The forest is glad you're back.`,
        `<b>Wren:</b> ${s.streak} days straight. Most people don't make it this far.`,
        `<b>Wren:</b> Back again. Your ear remembers more than you think.`,
      ];
      scopedTimeout(() => mentor(msgs[s.streak % msgs.length], 5000), 900);
    }
  }
  // Notification opt-in — asked once, after the streak is real enough to be worth protecting
  if (name === 'feed' && s.streak >= 3 && isNotificationSupported() && !hasAskedPermission()) {
    scopedTimeout(() => promptNotifications(), 2600);
  }
  // Time-aware atmospheric greeting — once per session for listeners who've found things
  else if (name === 'feed' && !_timeGreetShown && Object.keys(s.discovered).length >= 1) {
    _timeGreetShown = true;
    const h = new Date().getHours();
    const greet = h >= 5 && h < 8
      ? '<b>Wren:</b> Dawn chorus. Everything is competing at once — the most sound per square meter you\'ll ever hear.'
      : h >= 8 && h < 12
      ? '<b>Wren:</b> Morning. Migrants are active. The soundscape shifts faster in the first three hours than any other time.'
      : h >= 12 && h < 17
      ? '<b>Wren:</b> Midday. Heat quiets most birds. The insects take over. Different ears needed.'
      : h >= 17 && h < 20
      ? '<b>Wren:</b> Golden hour. Thrushes and robins hold out longest — they always sing the last song before dark.'
      : h >= 20 && h < 23
      ? '<b>Wren:</b> Dusk. Night shift taking over. Owls are warming up — listen for the first hoot.'
      : '<b>Wren:</b> Deep night. This is when I do my best listening. Foxes, owls, nighthawks. The world quiets and what\'s left is wild.';
    scopedTimeout(() => mentor(greet, 7000), 800);
  }

  if (name === 'feed') {
    // Haul-ready nudge
    if (s.haul && Date.now() > s.haul.readyAt) {
      const unsorted = s.haul.items.filter((id) => !s.haul.sorted.includes(id)).length;
      if (unsorted > 0) {
        scopedTimeout(() => mentor('<b>Wren:</b> Your overnight haul is ready — something unusual showed up. Check the Haul tab. 🌙', 7000), 1800);
      }
    }
    // Progressive feature discovery tips (shown once each)
    const discovered = Object.keys(s.discovered).length;
    const shownTips = (() => { try { return JSON.parse(localStorage.getItem('hark.tips') || '[]'); } catch (e) { return []; } })();
    const tip = (key, html, delay) => {
      if (shownTips.includes(key)) return;
      shownTips.push(key);
      localStorage.setItem('hark.tips', JSON.stringify(shownTips));
      scopedTimeout(() => mentor(html, 8000), delay);
    };
    if (discovered >= 3 && discovered < 8) tip('snap_tip', '<b>Wren:</b> You\'ve found a few. Now test yourself — try <b>Snap</b> and see if you can ID them by spectrogram alone.', 2500);
    else if (discovered >= 8 && discovered < 15) tip('grove_tip', '<b>Wren:</b> Your Grove is growing. Tap the <b>Grove</b> tab to see every sound you\'ve collected.', 2500);
    else if (discovered >= 15) tip('haul_tip', '<b>Wren:</b> Deploy the <b>Haul</b> recorder tonight. It listens while you sleep and brings back whatever the forest says.', 2500);
    if (discovered >= 5 && s.streak === 0) tip('streak_tip', '<b>Wren:</b> Play one round of <b>Snap</b> to start a streak. Come back every day — streaks grow into something worth sharing. 🔥', 2800);
    const masteredCount = Object.values(s.crowns).filter((v) => v >= 3).length;
    if (discovered >= 10 && masteredCount === 0) tip('mastery_tip', '<b>Wren:</b> Name a sound correctly three times in <b>Snap</b> to master it. ★★★ Mastered sounds get a golden home in your grove.', 3200);
    const rp = rankProgress(discovered);
    if (rp.next && (rp.next.min - discovered) <= 2) {
      const away = rp.next.min - discovered;
      tip('near_rank_' + rp.next.title, `<b>Wren:</b> ${rp.next.emoji} ${away === 1 ? 'One more sound' : 'Two more sounds'} and you reach <b>${rp.next.title}</b>. Keep going.`, 3000);
    }
  }
}

// Queued rather than clobbering: a rare-find quote, a milestone, and a rank-up
// can all fire within seconds of one discovery. Instantly replacing the toast
// meant only the last-to-fire message was ever actually readable — the rest
// vanished before anyone saw them. Each message now gets its full duration
// (or a tap to skip ahead) before the next one shows.
let mentorQueue = [];
let mentorShowing = false;
const MENTOR_QUEUE_CAP = 4;

function mentor(html, ms = 6500) {
  mentorQueue.push({ html, ms });
  if (mentorQueue.length > MENTOR_QUEUE_CAP) mentorQueue.shift();
  if (!mentorShowing) advanceMentorQueue();
}

function advanceMentorQueue() {
  if (mentorTimer) { clearTimeout(mentorTimer); mentorTimer = null; }
  if (mentorQueue.length === 0) { mentorShowing = false; return; }
  mentorShowing = true;
  const { html, ms } = mentorQueue.shift();
  const old = appRoot.querySelector('.mentor');
  if (old) old.remove();
  const m = el('div', { class: 'mentor' });
  m.appendChild(el('div', { class: 'who', html: icon('ear', 18) }));
  m.appendChild(el('div', { class: 'msg', html }));
  m.addEventListener('click', () => { m.remove(); advanceMentorQueue(); });
  appRoot.appendChild(m);
  mentorTimer = setTimeout(() => { m.remove(); advanceMentorQueue(); }, ms);
}

function clearMentorQueue() {
  mentorQueue = [];
  mentorShowing = false;
  if (mentorTimer) { clearTimeout(mentorTimer); mentorTimer = null; }
  const old = appRoot.querySelector('.mentor');
  if (old) old.remove();
}

// Same problem as the mentor toast, for full-screen milestone/collection
// overlays: scrolling past several milestone-crossing discoveries in one pass
// could previously stack multiple '.milestone-ovl' divs on top of each other.
let overlayQueue = [];
let overlayShowing = false;

function queueOverlay(renderFn) {
  if (overlayShowing) { overlayQueue.push(renderFn); return; }
  overlayShowing = true;
  renderFn();
}

function dismissOverlay(ovl) {
  ovl.remove();
  updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  overlayShowing = false;
  if (overlayQueue.length) {
    const next = overlayQueue.shift();
    overlayShowing = true;
    next();
  }
}

function clearOverlayQueue() {
  overlayQueue = [];
  overlayShowing = false;
  const old = appRoot.querySelector('.milestone-ovl');
  if (old) old.remove();
}

function toast(text, ms = 2500) {
  const old = appRoot.querySelector('.toast-disc');
  if (old) old.remove();
  const t = el('div', { class: 'toast-disc', text });
  appRoot.appendChild(t);
  setTimeout(() => { if (t.isConnected) t.remove(); }, ms);
}

function promptNotifications() {
  if (appRoot.querySelector('.notify-prompt')) return;
  const card = el('div', {
    class: 'notify-prompt',
    style: 'position:fixed;left:16px;right:16px;bottom:84px;z-index:50;background:var(--panel);border:.5px solid rgba(62,201,159,.3);border-radius:14px;padding:16px 18px;box-shadow:0 8px 32px rgba(0,0,0,.4)',
  });
  card.appendChild(el('div', { style: 'font-size:14px;font-weight:600;color:var(--ink);margin-bottom:4px', text: '🔔 Keep your streak alive?' }));
  card.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px', text: 'Hark can nudge you in the evening if you haven\'t played yet. No spam — just your streak.' }));
  const row = el('div', { style: 'display:flex;gap:8px' });
  const enableBtn = el('button', { class: 'cta', style: 'flex:1;padding:9px', text: 'Enable' });
  const skipBtn = el('button', { style: 'padding:9px 14px;color:var(--muted);font-size:13px', text: 'Not now' });
  enableBtn.addEventListener('click', async () => {
    card.remove();
    const result = await requestPermission();
    track('notify_opt_in', { result });
    if (result === 'granted') toast('✓ Streak reminders on', 2500);
  });
  skipBtn.addEventListener('click', () => {
    markPromptSeen();
    track('notify_opt_in', { result: 'skipped' });
    card.remove();
  });
  row.appendChild(enableBtn); row.appendChild(skipBtn);
  card.appendChild(row);
  appRoot.appendChild(card);
}

const GROUP_COMPLETE_QUOTES = {
  bird: 'Every bird. It took me years to find them all the first time. You did it faster — and you remembered.',
  mammal: 'Five mammals, all here. Warm blood, different acoustics. Each one solved the same problem — be heard — differently.',
  amphibian: 'The amphibians are complete. They were singing long before birds evolved. You found the oldest chorus on Earth.',
  insect: 'Seven insects. Seven different mechanical solutions to make sound, find a mate, survive. Collection complete.',
  geophony: 'Even the sounds with no mouth. Wind, water, thunder — the world itself, archived in your grove.',
  marine: 'The deep ocean, singing. You found it.',
};

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
  const wrQ = GROUP_COMPLETE_QUOTES[hit.group];
  if (wrQ) {
    const note = el('div', { style: 'font-size:12px;font-style:italic;color:var(--muted);border-left:2px solid rgba(62,201,159,.4);padding:8px 12px;text-align:left;margin-top:12px;background:rgba(62,201,159,.05);border-radius:0 6px 6px 0' });
    note.textContent = 'Wren: “' + wrQ + '”';
    ovl.appendChild(note);
  }

  const shareBtn = el('button', { class: 'cta', style: 'margin-top:12px', text: '📤 Share your collection' });
  shareBtn.addEventListener('click', async () => {
    const s2 = get();
    const disc = Object.keys(s2.discovered).map(byId).filter(Boolean);
    await shareGrove(disc, s2, app);
    dismissOverlay(ovl);
  });
  ovl.appendChild(shareBtn);

  const skip = el('button', { class: 'ghost', text: 'Keep listening →' });
  skip.addEventListener('click', () => dismissOverlay(ovl));
  ovl.appendChild(skip);

  queueOverlay(() => {
    appRoot.appendChild(ovl);
    track('collection_complete', { group: hit.group });
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
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
    dismissOverlay(ovl);
  });
  ovl.appendChild(shareBtn);

  const skip = el('button', { class: 'ghost', text: 'Keep listening →' });
  skip.addEventListener('click', () => dismissOverlay(ovl));
  ovl.appendChild(skip);

  queueOverlay(() => {
    appRoot.appendChild(ovl);
    track('milestone', { n });
    updateChrome(shell?.nav?.querySelector('.active')?.dataset?.name);
  });
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
