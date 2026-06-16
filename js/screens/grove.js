// Hark — the Grove. Every sound you learn is rehomed here.
import { el, icon } from '../ui.js';
import { byId, CREATURES, creatureEmoji, rarityPct } from '../content.js';
import { get } from '../state.js';
import { feedbackLink, showCredits } from '../probes.js';
import { shareGrove } from '../sharecard.js';

export function mount(host, app) {
  const s = get();
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad', style: 'overflow-y:auto;height:100%' });
  root.appendChild(pad);

  const discovered = Object.keys(s.discovered).map(byId).filter(Boolean);
  const total = CREATURES.filter((c) => !c.isNoise).length;

  // ── Header ──────────────────────────────────────────────────────────────
  const head = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' });
  head.appendChild(el('div', { style: 'font-size:20px;font-weight:600', text: 'Your Grove' }));
  head.appendChild(el('div', { style: 'font-size:13px;color:var(--teal)', text: discovered.length + '/' + total + ' rehomed' }));
  pad.appendChild(head);

  // Restoration progress bar
  const bar = el('div', { class: 'bar', style: 'margin-bottom:16px' });
  bar.appendChild(el('i', { style: `width:${Math.round(s.grove)}%` }));
  pad.appendChild(bar);

  // ── Creature mosaic ──────────────────────────────────────────────────────
  const mosaic = el('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px' });

  // Show discovered creatures
  discovered.forEach((c) => {
    const crowns = s.crowns[c.id] || 0;
    const pct = rarityPct(c);
    const isRare = c.rare;
    const isMastered = crowns >= 3;
    const cell = el('div', {
      title: c.name + ' · ' + pct + '% find this',
      style: [
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px',
        'border-radius:12px;padding:8px 4px;cursor:default',
        isMastered ? 'background:rgba(224,164,77,.12);border:.5px solid rgba(224,164,77,.35)' :
          isRare ? 'background:rgba(111,139,255,.1);border:.5px solid rgba(111,139,255,.3)' :
          'background:var(--panel);border:.5px solid var(--line)',
      ].join(';'),
    });
    const emoDiv = el('div', { style: `font-size:${isMastered ? 26 : 22}px;line-height:1` });
    emoDiv.textContent = creatureEmoji(c);
    cell.appendChild(emoDiv);
    if (crowns > 0) {
      const starDiv = el('div', { style: 'font-size:9px;color:var(--amber);letter-spacing:1px', text: '★'.repeat(crowns) });
      cell.appendChild(starDiv);
    }
    const pctDiv = el('div', { style: 'font-size:8px;color:var(--muted);text-align:center', text: pct + '%' });
    cell.appendChild(pctDiv);
    mosaic.appendChild(cell);
  });

  // Empty slots for undiscovered creatures
  const undiscovered = total - discovered.length;
  for (let i = 0; i < Math.min(undiscovered, 10); i++) {
    const empty = el('div', {
      style: 'display:flex;align-items:center;justify-content:center;border-radius:12px;padding:8px 4px;background:rgba(255,255,255,.03);border:.5px dashed var(--line);height:60px',
      html: `<span style="font-size:16px;opacity:.2">${icon('leaf', 16)}</span>`,
    });
    mosaic.appendChild(empty);
  }
  if (undiscovered > 10) {
    const more = el('div', {
      style: 'grid-column:span 2;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);padding:8px',
      text: '+' + (undiscovered - 10) + ' more out there',
    });
    mosaic.appendChild(more);
  }

  pad.appendChild(mosaic);

  // ── Share + actions ──────────────────────────────────────────────────────
  if (discovered.length > 0) {
    const shareBtn = el('button', {
      class: 'cta',
      style: 'width:100%',
      text: '📤 Share your grove',
    });
    shareBtn.addEventListener('click', () => shareGrove(discovered, s, app));
    pad.appendChild(shareBtn);
  } else {
    pad.appendChild(el('p', { style: 'font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px', text: 'Play the feed to bring sounds home.' }));
  }

  const actions = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;border-top:.5px solid var(--line);padding-top:10px;margin-top:4px' });
  actions.appendChild(feedbackLink());
  const creditsBtn = el('button', { style: 'font-size:11px;color:var(--muted);padding:6px 0', text: 'Sound credits' });
  creditsBtn.addEventListener('click', showCredits);
  actions.appendChild(creditsBtn);
  pad.appendChild(actions);

  host.appendChild(root);
  return () => root.remove();
}
