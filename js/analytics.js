// Hark — beta instrumentation. Privacy-light: anonymous device id, no PII.
// Events buffer locally AND beacon to a collector you control (BEACON_URL).
// This is the "engine smoke test" rig: it measures the two killing assumptions
// (does it spread = k via share-referral, and retention/WTP) the premortem flagged.

// ---- CONFIG (edit these, then redeploy) -------------------------------------
export const CONFIG = {
  // Supabase collector (preferred). Fill both from your Supabase project settings,
  // run the SQL in SUPABASE_SETUP.md first, then redeploy. Empty = not used.
  SUPABASE_URL: 'https://hcngclkjeclgtlhhiftc.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_WwbJyG0Pz1bcpAV9PQIlBQ_ewRuPSHB',
  // Generic fallback collector (e.g. Google Apps Script). Empty = not used.
  BEACON_URL: '',
  // Where the in-app "Send feedback" link goes.
  FEEDBACK_URL: 'mailto:stuart@intervals.ai?subject=Hark%20beta%20feedback',
  ANALYTICS_ON: true,
};
// -----------------------------------------------------------------------------

const LS = {
  did: 'hark.did', cohort: 'hark.cohort', days: 'hark.days',
  events: 'hark.events', ref: 'hark.ref', wtp: 'hark.wtp', notice: 'hark.notice',
};

let sid = null;
let session2minFired = false;

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'd-' + Math.abs(Date.now() ^ (performance.now() * 1e6 | 0)).toString(36) + Math.floor(Math.random() * 1e9).toString(36);
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayDiff(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

function deviceId() {
  let id = localStorage.getItem(LS.did);
  if (!id) { id = uuid(); localStorage.setItem(LS.did, id); }
  return id;
}
function cohortDay() {
  let c = localStorage.getItem(LS.cohort);
  if (!c) { c = todayStr(); localStorage.setItem(LS.cohort, c); }
  return c;
}
function markActiveDay() {
  let days = [];
  try { days = JSON.parse(localStorage.getItem(LS.days) || '[]'); } catch (e) {}
  const t = todayStr();
  if (!days.includes(t)) { days.push(t); localStorage.setItem(LS.days, JSON.stringify(days)); }
  return days;
}

function base() {
  return {
    did: deviceId(),
    sid,
    cohort: cohortDay(),
    dayN: dayDiff(cohortDay(), todayStr()),
    ref: localStorage.getItem(LS.ref) || null,
    ts: Date.now(),
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ua: navigator.userAgent.slice(0, 120),
    standalone: !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches),
  };
}

function storeLocal(ev) {
  let buf = [];
  try { buf = JSON.parse(localStorage.getItem(LS.events) || '[]'); } catch (e) {}
  buf.push(ev);
  if (buf.length > 500) buf = buf.slice(-500);
  localStorage.setItem(LS.events, JSON.stringify(buf));
}

function beacon(ev) {
  try {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      fetch(`${CONFIG.SUPABASE_URL}/rest/v1/events`, {
        method: 'POST', keepalive: true,
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ name: ev.name, did: ev.did, event: ev }),
      }).catch(() => {});
      return;
    }
    if (CONFIG.BEACON_URL) {
      const body = JSON.stringify(ev);
      if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.BEACON_URL, new Blob([body], { type: 'text/plain' }));
      else fetch(CONFIG.BEACON_URL, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'content-type': 'text/plain' }, body });
    }
  } catch (e) {}
}

export function track(name, props = {}) {
  if (!CONFIG.ANALYTICS_ON) return;
  const ev = Object.assign({ name }, base(), props);
  storeLocal(ev);
  beacon(ev);
}

// ---- session + retention + 2-min KPI ----------------------------------------
function startSession() {
  sid = uuid();
  session2minFired = false;
  markActiveDay();
  track('app_open');
  // "still playing at 2:00" — the core fun-test KPI
  setTimeout(() => {
    if (!session2minFired && document.visibilityState === 'visible') {
      session2minFired = true;
      track('still_playing_2min');
    }
  }, 120000);
}

function captureRef() {
  try {
    const ref = new URLSearchParams(location.search).get('ref');
    if (ref && !localStorage.getItem(LS.did)) {
      // brand-new device arriving via a shared link = a referred install (k signal)
      localStorage.setItem(LS.ref, ref);
      deviceId();
      track('referred_install', { referrer: ref });
    }
  } catch (e) {}
}

export function shareUrl() {
  return `${location.origin}${location.pathname}?ref=${encodeURIComponent(deviceId())}`;
}

export function challengeUrl(id) {
  return `${location.origin}${location.pathname}?challenge=${encodeURIComponent(id)}&ref=${encodeURIComponent(deviceId())}`;
}

export function exportData() {
  return {
    did: deviceId(), cohort: cohortDay(),
    days: JSON.parse(localStorage.getItem(LS.days) || '[]'),
    wtp: JSON.parse(localStorage.getItem(LS.wtp) || 'null'),
    events: JSON.parse(localStorage.getItem(LS.events) || '[]'),
  };
}

export function recordWtp(answer) {
  localStorage.setItem(LS.wtp, JSON.stringify(answer));
  track('wtp_answer', answer);
}
export function wtpAnswered() { return !!localStorage.getItem(LS.wtp); }
export function noticeSeen() { return !!localStorage.getItem(LS.notice); }
export function markNotice() { localStorage.setItem(LS.notice, '1'); }

export function init() {
  captureRef();
  startSession();
  // a fresh session if the app was backgrounded > 30 min
  let lastVis = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (Date.now() - lastVis > 30 * 60000) startSession();
    } else {
      lastVis = Date.now();
      track('app_background');
    }
  });
  window.hark = Object.assign(window.hark || {}, { track, exportData, CONFIG });
}
