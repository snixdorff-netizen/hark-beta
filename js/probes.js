// Hark — beta probes: privacy notice, priced WTP probe, feedback link, owner dashboard, credits.
import { el, icon, haptic, clear } from './ui.js';
import { track, recordWtp, wtpAnswered, recordSatisfaction, satisfactionAnswered, exportData, shareUrl, CONFIG, noticeSeen, markNotice } from './analytics.js';
import { CREATURES } from './content.js';

function overlay(child, { dismissable = true } = {}) {
  const host = document.getElementById('app');
  const back = el('div', { class: 'ovl' });
  if (dismissable) back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  back.appendChild(child);
  host.appendChild(back);
  return back;
}

export function showPrivacyNotice() {
  if (noticeSeen()) return;
  markNotice();
  const host = document.getElementById('app');
  const note = el('div', { class: 'privacy' });
  note.appendChild(el('span', { class: 'msg', html: 'This beta logs anonymous play events (no name, no email, no contacts) to improve Hark. <a href="privacy.html" target="_blank" rel="noopener" style="color:var(--teal);text-decoration:underline">Full policy</a>' }));
  const ok = el('button', { class: 'lnk', text: 'OK' });
  ok.addEventListener('click', () => note.remove());
  note.appendChild(ok);
  host.appendChild(note);
  setTimeout(() => note.remove(), 12000);
}

const WTP_OPTS = [
  { label: 'Keep it free', price: 0 },
  { label: '$3 / mo', price: 3 },
  { label: '$5 / mo', price: 5 },
  { label: '$8 / mo', price: 8 },
];

export function maybeShowWtp(app, reason = 'unknown') {
  if (wtpAnswered()) return;
  track('wtp_probe_shown', { reason });
  const card = el('div', { class: 'sheet' });
  card.appendChild(el('div', { class: 'sheet-h', text: 'Hark will always be free to play.' }));
  card.appendChild(el('p', {
    class: 'sheet-p',
    text: 'If there were a “Hark Pro” — deeper sound packs, real expert spectrograms, and your IDs feeding real science — would it be worth it to you? (Just planning. Nothing to buy.)',
  }));
  const opts = el('div', { class: 'sheet-opts' });
  WTP_OPTS.forEach((o) => {
    const b = el('button', { class: 'sheet-opt' + (o.price ? '' : ' muted'), text: o.label });
    b.addEventListener('click', () => {
      recordWtp({ price: o.price });
      haptic(12);
      back.remove();
      app && app.mentor && app.mentor('<b>Wren:</b> thank you — that genuinely helps us decide what to build next.');
    });
    opts.appendChild(b);
  });
  card.appendChild(opts);
  const back = overlay(card, { dismissable: true });
}

// The one real, growing measurement behind "make this a 4.5-star game" —
// fires once, at a genuinely positive moment the caller chooses (a streak
// milestone, a collection complete), never right after onboarding or on a
// cold session. Low ratings route to direct feedback instead of a public
// review, since there's no real app-store listing for this to manipulate;
// it's just an honest channel back to whoever's building this.
export function maybeShowSatisfaction(app, reason = 'unknown') {
  if (satisfactionAnswered()) return;
  track('satisfaction_prompt_shown', { reason });
  const card = el('div', { class: 'sheet' });
  card.appendChild(el('div', { class: 'sheet-h', text: 'Enjoying Hark so far?' }));
  card.appendChild(el('p', { class: 'sheet-p', text: 'One tap — helps us know if this is actually working for you.' }));

  const stars = el('div', { style: 'display:flex;justify-content:center;gap:10px;margin-bottom:6px' });
  for (let n = 1; n <= 5; n++) {
    const s = el('button', { 'aria-label': n + ' star' + (n > 1 ? 's' : ''), style: 'font-size:32px;line-height:1;padding:4px', text: '☆' });
    s.dataset.n = n;
    s.addEventListener('mouseenter', () => paintStars(n));
    s.addEventListener('click', () => choose(n));
    stars.appendChild(s);
  }
  card.appendChild(stars);

  function paintStars(upTo) {
    [...stars.children].forEach((s, i) => { s.textContent = i < upTo ? '★' : '☆'; });
  }

  function choose(n) {
    paintStars(n);
    haptic(10);
    recordSatisfaction(n);
    clear(card);
    card.appendChild(el('div', { style: 'font-size:32px;line-height:1;margin-bottom:8px', text: n >= 4 ? '🌿' : '👂' }));
    if (n >= 4) {
      card.appendChild(el('div', { class: 'sheet-h', text: 'That means a lot.' }));
      card.appendChild(el('p', { class: 'sheet-p', text: 'If you know someone who\'d like this, sending it their way is the best thing you could do for us.' }));
      const share = el('button', { class: 'sheet-opt', style: 'width:100%', text: '🎧 Tell a friend about Hark' });
      share.addEventListener('click', () => { shareInvite(); back.remove(); });
      card.appendChild(share);
      const close = el('button', { class: 'lnk', style: 'margin-top:12px', text: 'Close' });
      close.addEventListener('click', () => back.remove());
      card.appendChild(close);
    } else {
      card.appendChild(el('div', { class: 'sheet-h', text: 'Thanks for being honest.' }));
      card.appendChild(el('p', { class: 'sheet-p', text: 'What would make it better? A real reply goes straight to the person building this — not a support queue.' }));
      const fb = el('button', { class: 'sheet-opt', style: 'width:100%', text: '✉️ Tell us what\'s missing' });
      fb.addEventListener('click', () => { track('feedback_click', { source: 'satisfaction_low' }); try { window.location.href = CONFIG.FEEDBACK_URL; } catch (e) {} back.remove(); });
      card.appendChild(fb);
      const close = el('button', { class: 'lnk', style: 'margin-top:12px', text: 'Not now' });
      close.addEventListener('click', () => back.remove());
      card.appendChild(close);
    }
  }

  const back = overlay(card, { dismissable: true });
}

export function feedbackLink() {
  const a = el('button', { class: 'lnk-row', html: icon('mail', 18) + ' Send feedback' });
  a.addEventListener('click', () => {
    track('feedback_click');
    try { window.location.href = CONFIG.FEEDBACK_URL; } catch (e) {}
  });
  return a;
}

export function shareInvite() {
  const url = shareUrl();
  const text = `Hark — a calm little game that teaches your ears the wild. ${url}`;
  track('invite_share');
  if (navigator.share) navigator.share({ title: 'Hark', text, url }).catch(() => {});
  else navigator.clipboard?.writeText(url).catch(() => {});
}

export function showCredits() {
  track('credits_view');
  const clips = CREATURES.filter((c) => c.clip && c.author != null).slice().sort((a, b) => a.name.localeCompare(b.name));

  const card = el('div', { class: 'sheet', style: 'text-align:left;max-height:80vh;overflow-y:auto;padding-bottom:32px' });
  card.appendChild(el('div', { class: 'sheet-h', text: 'Sound credits' }));
  card.appendChild(el('p', { class: 'sheet-p', text: `${clips.length} real field recordings — licensed CC BY / CC BY-SA / Public Domain. Authors retain copyright; Hark provides attribution per license terms.` }));

  const LIC_URLS = {
    'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
    'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
    'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
    'Public domain': 'https://creativecommons.org/publicdomain/mark/1.0/',
  };

  clips.forEach((c) => {
    const row = el('div', { style: 'padding:9px 0;border-bottom:.5px solid var(--line)' });
    const top = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:8px' });
    top.appendChild(el('span', { style: 'font-size:13px;font-weight:500', text: c.name }));
    const licUrl = LIC_URLS[c.license] || '#';
    top.appendChild(el('a', {
      href: licUrl, target: '_blank', rel: 'noopener',
      style: 'font-size:10px;color:var(--teal);text-decoration:none;white-space:nowrap',
      text: c.license || 'Public domain',
    }));
    row.appendChild(top);
    const bot = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:2px' });
    bot.appendChild(el('span', { style: 'font-size:11px;color:var(--muted)', text: c.author || '' }));
    if (c.source) {
      bot.appendChild(el('a', {
        href: c.source, target: '_blank', rel: 'noopener',
        style: 'font-size:10px;color:var(--muted);text-decoration:none',
        text: c.sourceName || 'source',
      }));
    }
    row.appendChild(bot);
    card.appendChild(row);
  });

  const close = el('button', { class: 'sheet-opt', style: 'width:100%;margin-top:18px', text: 'Close' });
  close.addEventListener('click', () => back.remove());
  card.appendChild(close);
  const back = overlay(card, { dismissable: true });
}

export function showOwnerDashboard() {
  const d = exportData();
  const counts = {};
  d.events.forEach((e) => { counts[e.name] = (counts[e.name] || 0) + 1; });
  const referredInstalls = d.events.filter((e) => e.name === 'referred_install').length;
  const shares = (counts['feed_share'] || 0) + (counts['invite_share'] || 0);

  const card = el('div', { class: 'sheet', style: 'text-align:left;max-height:80vh;overflow:auto' });
  card.appendChild(el('div', { class: 'sheet-h', text: 'Beta metrics (this device)' }));
  const kv = (k, v) => el('div', { class: 'kv', html: `<span>${k}</span><b>${v}</b>` });
  card.appendChild(kv('device', d.did.slice(0, 8)));
  card.appendChild(kv('cohort', d.cohort));
  card.appendChild(kv('active days', d.days.length));
  // beacon() checks Supabase before the generic BEACON_URL fallback — this
  // used to only check BEACON_URL (always empty), so the dashboard told the
  // owner data wasn't beaconing live even while it was actively flowing to
  // Supabase.
  const beaconLive = (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) ? 'live (Supabase)' : (CONFIG.BEACON_URL ? 'live (custom)' : 'local-only');
  card.appendChild(kv('beacon', beaconLive));
  card.appendChild(kv('shares', shares));
  card.appendChild(kv('arrived via ref', d.events.find((e) => e.ref) ? 'yes' : 'no'));
  card.appendChild(kv('WTP answer', d.wtp ? `$${d.wtp.price}/mo` : '—'));
  card.appendChild(kv('satisfaction', d.satisfaction ? `${'★'.repeat(d.satisfaction.rating)}${'☆'.repeat(5 - d.satisfaction.rating)}` : '—'));
  card.appendChild(el('div', { class: 'sheet-p', style: 'margin-top:10px', text: 'Event counts' }));
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => card.appendChild(kv(k, v)));

  const row = el('div', { class: 'sheet-opts', style: 'margin-top:14px' });
  const copy = el('button', { class: 'sheet-opt', text: 'Copy JSON' });
  copy.addEventListener('click', () => { navigator.clipboard?.writeText(JSON.stringify(d)); copy.textContent = 'Copied'; });
  const test = el('button', { class: 'sheet-opt muted', text: 'Send test beacon' });
  test.addEventListener('click', () => { track('owner_test'); test.textContent = CONFIG.BEACON_URL ? 'Sent' : 'No URL'; });
  row.appendChild(copy); row.appendChild(test);
  card.appendChild(row);
  overlay(card, { dismissable: true });
}
