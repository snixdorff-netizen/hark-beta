// Hark — beta probes: privacy notice, priced WTP probe, feedback link, owner dashboard.
import { el, icon, haptic } from './ui.js';
import { track, recordWtp, wtpAnswered, exportData, shareUrl, CONFIG, noticeSeen, markNotice } from './analytics.js';

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
  note.appendChild(el('span', { class: 'msg', text: 'This beta logs anonymous play events (no name, no email, no contacts) to improve Hark.' }));
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
  card.appendChild(kv('beacon', CONFIG.BEACON_URL ? 'live' : 'local-only'));
  card.appendChild(kv('shares', shares));
  card.appendChild(kv('arrived via ref', d.events.find((e) => e.ref) ? 'yes' : 'no'));
  card.appendChild(kv('WTP answer', d.wtp ? `$${d.wtp.price}/mo` : '—'));
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
