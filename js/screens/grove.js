// Hark — the Grove. Completion you can see. Every sound you learn is rehomed here.
import { el, icon } from '../ui.js';
import { byId, CREATURES, creatureEmoji } from '../content.js';
import { get } from '../state.js';
import { feedbackLink, showCredits } from '../probes.js';
import { shareStreak } from '../sharecard.js';

export function mount(host, app) {
  const s = get();
  const root = el('div', { class: 'screen' });

  const stage = el('div', { class: 'grove-stage' });
  const sizes = [30, 46, 38, 54, 34, 48, 30];
  const litCount = Math.round((s.grove / 100) * sizes.length);
  sizes.forEach((sz, i) => {
    const t = el('span', { class: 'ic tree' + (i < litCount ? ' lit' : ''), html: icon('tree', sz) });
    stage.appendChild(t);
  });
  // a little wren if grove is growing
  if (s.grove > 10) stage.appendChild(el('span', { class: 'ic', html: icon('leaf', 20), style: 'position:absolute;top:30%;right:24%;color:var(--teal)' }));
  root.appendChild(stage);

  const meta = el('div', { class: 'grove-meta' });
  const head = el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px' });
  head.appendChild(el('div', { style: 'font-size:16px;font-weight:500', text: 'Your Grove' }));
  head.appendChild(el('div', { style: 'font-size:13px;color:var(--teal)', text: `${Math.round(s.grove)}% restored` }));
  meta.appendChild(head);
  const bar = el('div', { class: 'bar' });
  bar.appendChild(el('i', { style: `width:${Math.round(s.grove)}%` }));
  meta.appendChild(bar);

  const discovered = Object.keys(s.discovered).map(byId).filter(Boolean);
  meta.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin:12px 0 8px', text: `${discovered.length} of ${CREATURES.length} sounds rehomed` }));
  const chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' });
  discovered.forEach((c) => {
    const crowns = s.crowns[c.id] || 0;
    chips.appendChild(el('span', {
      style: 'font-size:11px;padding:5px 10px;border-radius:20px;background:var(--panel);border:.5px solid var(--line2)',
      html: `<span style="margin-right:3px">${creatureEmoji(c)}</span>${c.name}${crowns ? ' ' + '★'.repeat(crowns) : ''}`
    }));
  });
  if (!discovered.length) chips.appendChild(el('span', { style: 'font-size:12px;color:var(--muted)', text: 'Play the feed to bring sounds home.' }));
  meta.appendChild(chips);

  if (s.streak >= 1) {
    const shareGroveBtn = el('button', {
      class: 'btn primary',
      style: 'width:100%;margin-top:14px;font-size:14px',
      text: '📤 Share your grove (' + s.streak + '-day streak)',
    });
    shareGroveBtn.addEventListener('click', () => shareStreak(s.streak, null));
    meta.appendChild(shareGroveBtn);
  }

  const actions = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-top:18px;border-top:.5px solid var(--line);padding-top:10px' });
  actions.appendChild(feedbackLink());
  meta.appendChild(actions);

  const creditsRow = el('div', { style: 'text-align:center;padding-top:6px' });
  const creditsBtn = el('button', { style: 'font-size:11px;color:var(--muted);padding:6px 12px', text: 'Sound credits & licenses' });
  creditsBtn.addEventListener('click', showCredits);
  creditsRow.appendChild(creditsBtn);
  meta.appendChild(creditsRow);
  root.appendChild(meta);

  host.appendChild(root);
  return () => root.remove();
}
