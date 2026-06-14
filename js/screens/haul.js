// Hark — the overnight Haul. Deploy a recorder, leave, come back to a full net.
// Sorting the catch is the deep loop; the 67 kHz unknown is the story seed.
import { el, clear, icon, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { CREATURES, byId, seededShuffle } from '../content.js';
import { get, save, addXp, growGrove, discover } from '../state.js';

const REDEPLOY_MS = 3 * 60 * 60 * 1000; // 3h real timer on repeat deploys (beta)

export function mount(host, app) {
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad' });
  root.appendChild(pad); host.appendChild(root);
  let tick = null;

  render();

  function render() {
    clear(pad); if (tick) { clearInterval(tick); tick = null; }
    const s = get();
    if (!s.haul) return deployView();
    if (Date.now() < s.haul.readyAt) return recordingView();
    return haulView();
  }

  function deployView() {
    const v = el('div', { class: 'deploy' });
    v.appendChild(el('span', { class: 'ic', html: icon('mic', 40), style: 'color:var(--teal)' }));
    v.appendChild(el('h1', { html: 'Set your recorder.', style: 'font-size:22px;font-weight:500;margin:0' }));
    v.appendChild(el('p', { class: '', style: 'color:var(--muted);max-width:280px;text-align:center', text: 'Drop a ForestMote and leave it overnight. It listens while you sleep — come back to whatever the forest said.' }));
    const btn = el('button', { class: 'cta', text: 'Deploy ForestMote' });
    btn.addEventListener('click', deploy);
    v.appendChild(btn);
    pad.appendChild(v);
  }

  function deploy() {
    const s = get();
    const firstTime = !s.everDeployed;
    const seed = (s.xp * 17 + 41) >>> 0;
    const items = seededShuffle(CREATURES.filter((c) => !c.isNoise), seed).slice(0, 9).map((c) => c.id);
    s.haul = { readyAt: firstTime ? Date.now() : Date.now() + REDEPLOY_MS, items, sorted: [], unknownSeen: false };
    s.everDeployed = true;
    save();
    if (firstTime) app.mentor('<b>Wren:</b> while you slept, the rig pulled in nine sounds. Eight are easy. One… nobody’s been able to name.');
    render();
  }

  function recordingView() {
    const s = get();
    const v = el('div', { class: 'deploy' });
    const ring = el('div', { class: 'ring' });
    v.appendChild(ring);
    v.appendChild(el('h1', { text: 'Recording…', style: 'font-size:20px;font-weight:500;margin:0' }));
    const sub = el('p', { style: 'color:var(--muted)' });
    v.appendChild(sub);
    const ff = el('button', { class: 'ghost', text: 'Fast-forward (beta)' });
    ff.addEventListener('click', () => { s.haul.readyAt = Date.now(); save(); render(); });
    v.appendChild(ff);
    pad.appendChild(v);
    const upd = () => {
      const ms = Math.max(0, s.haul.readyAt - Date.now());
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
      ring.textContent = h > 0 ? `${h}h ${m}m` : `${m}:${String(sec).padStart(2, '0')}`;
      sub.textContent = 'Your ForestMote is listening.';
      if (ms <= 0) render();
    };
    upd(); tick = setInterval(upd, 1000);
  }

  function haulView() {
    const s = get();
    pad.appendChild(el('div', { class: 'q-head', html: `<div class="q-title">${icon('moon', 18)} Last night’s haul</div>` }));
    pad.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:-6px', text: `ForestMote · ${s.haul.items.length} caught` }));

    const listWrap = el('div', { class: 'haul-list' });
    s.haul.items.forEach((id) => {
      const c = byId(id); if (!c) return;
      const sorted = s.haul.sorted.includes(id);
      const row = el('button', { class: 'haul-row' });
      row.appendChild(el('span', { text: sorted ? c.name : 'Unsorted clip' }));
      const right = el('span', { class: 'ic' });
      right.innerHTML = sorted ? `<span class="chk">${icon('check', 18)}</span>` : icon('play', 18);
      row.appendChild(right);
      row.addEventListener('click', () => {
        audio.unlock(); audio.play(c);
        if (!s.haul.sorted.includes(id)) {
          s.haul.sorted.push(id); discover(id); growGrove(1); save(); addXp(5); haptic(10); sparkleBurst(row);
          render();
        }
      });
      listWrap.appendChild(row);
    });
    pad.appendChild(listWrap);

    const allSorted = s.haul.sorted.length >= s.haul.items.length;
    if (allSorted) {
      const u = el('div', { class: 'unknown' });
      u.innerHTML = `<span class="ic" style="color:var(--amber)">${icon('help', 22)}</span>
        <div><div class="t">67 kHz — unidentified</div><div class="d">ultrasonic · nobody’s named this</div></div>`;
      u.addEventListener('click', () => {
        s.haul.unknownSeen = true; save();
        app.mentor('<b>Wren:</b> 67 kHz is above human hearing — bat territory. But this isn’t a bat. Keep it. We’ll need more ears on this one.');
        haptic(16);
      });
      pad.appendChild(u);
    }

    const row = el('div', { class: 'btn-row' });
    const sortBtn = el('button', { class: 'btn', text: allSorted ? 'All sorted ✓' : 'Tap clips to sort' });
    const again = el('button', { class: 'btn primary', text: 'Deploy again' });
    again.addEventListener('click', () => {
      if (allSorted) growGrove(6);
      get().haul = null; save(); render();
    });
    row.appendChild(sortBtn); row.appendChild(again);
    pad.appendChild(row);
  }

  return () => { if (tick) clearInterval(tick); audio.stopAll(); root.remove(); };
}
