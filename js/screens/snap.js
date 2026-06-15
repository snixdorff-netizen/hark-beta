// Hark — Spectrogram Snap. Hear it, match the picture. No clock, no fail-state.
// Difficulty rises through subtlety; the session ends on a stretch-win.
import { el, clear, icon, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { buildRound, sessionTargets } from '../difficulty.js';
import { get, addXp, adjustSkill, awardCrown, discover, growGrove, touchStreak } from '../state.js';
import { track } from '../analytics.js';
import { maybeShowWtp } from '../probes.js';
import { creatureEmoji } from '../content.js';

export function mount(host, app, params = {}) {
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad' });
  root.appendChild(pad); host.appendChild(root);

  let seed = (get().xp * 131 + 17) >>> 0;
  const targets = sessionTargets(seed, params.preferIds);
  let i = 0, correctCount = 0;
  let gotRight = [];

  renderRound();

  function renderRound() {
    clear(pad);
    const s = get();
    // last round is a "stretch": one notch harder
    const stretch = i === targets.length - 1;
    const skill = stretch ? s.skill + 0.7 : s.skill;
    const target = targets[i];
    const round = buildRound(target, skill, (seed + i * 97) >>> 0);

    const head = el('div', { class: 'q-head' });
    head.appendChild(el('div', { class: 'q-title', text: stretch ? 'One more — trust your ears' : 'Which one is this?' }));
    head.appendChild(el('div', { class: 'pill', html: icon('flame', 14) + ' ' + s.streak }));
    pad.appendChild(head);

    const replay = el('div', { class: 'replay' });
    const pb = el('button', { class: 'playbtn', 'aria-label': 'Replay', html: icon('play', 20) });
    pb.addEventListener('click', () => { audio.unlock(); audio.play(target); });
    replay.appendChild(pb);
    replay.appendChild(el('div', { style: 'font-size:13px;color:var(--muted)', text: 'tap to replay the sound' }));
    pad.appendChild(replay);
    audio.unlock(); audio.play(target);

    const cols = round.options.length <= 2 ? '1fr 1fr' : (round.options.length === 3 ? '1fr 1fr' : '1fr 1fr');
    const opts = el('div', { class: 'opts', style: `grid-template-columns:${cols}` });
    round.options.forEach((c, idx) => {
      const card = el('button', { class: 'opt' });
      const sg = el('div', { class: 'specwrap', style: 'width:100%' });
      card.appendChild(sg);
      card.appendChild(el('div', { class: 'lab', text: String.fromCharCode(65 + idx) }));
      requestAnimationFrame(() => mountSpectrogram(sg, c, sg.clientWidth || 150, 64));
      card.addEventListener('click', () => choose(c, card, target));
      opts.appendChild(card);
    });
    pad.appendChild(opts);

    const foot = el('div', { class: 'foot' });
    foot.appendChild(el('div', { class: 'hint', text: 'no clock — take your time' }));
    const dots = el('div', { class: 'dots' });
    targets.forEach((_, k) => dots.appendChild(el('span', { class: k < i ? 'on' : (k === i ? 'now' : '') })));
    foot.appendChild(dots);
    pad.appendChild(foot);
  }

  function choose(c, card, target) {
    if (card.dataset.done) return;
    if (c.id === target.id) {
      card.dataset.done = '1';
      card.classList.add('correct'); haptic(14); sparkleBurst(card);
      correctCount++;
      gotRight.push(target);
      adjustSkill(true); awardCrown(target.id); discover(target.id); addXp(10);
      const reveal = el('div', { style: 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--panel);border-radius:13px;pointer-events:none;animation:fade .2s ease' });
      const rEmo = el('div', { style: 'font-size:38px;line-height:1' });
      rEmo.textContent = creatureEmoji(target);
      reveal.appendChild(rEmo);
      reveal.appendChild(el('div', { style: 'font-size:11px;color:var(--teal);font-weight:600;letter-spacing:.03em', text: target.name }));
      card.style.position = 'relative';
      card.appendChild(reveal);
      setTimeout(next, 950);
    } else {
      card.classList.add('wrong'); haptic(20); adjustSkill(false);
      audio.play(target);
      setTimeout(() => card.classList.remove('wrong'), 450);
    }
  }

  function next() {
    i++;
    if (i < targets.length) renderRound();
    else finish();
  }

  function finish() {
    touchStreak();
    growGrove(4);
    track('snap_complete', { correct: correctCount, total: targets.length });
    clear(pad);
    const wrap = el('div', { class: 'cold', style: 'position:relative' });
    wrap.appendChild(el('span', { class: 'ic', html: icon('trophy', 44), style: 'color:var(--amber)' }));
    if (gotRight.length) {
      const emoRow = el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;font-size:26px' });
      gotRight.forEach(c => { const s = el('span'); s.textContent = creatureEmoji(c); emoRow.appendChild(s); });
      wrap.appendChild(emoRow);
    }
    wrap.appendChild(el('h1', { html: `Nice ears.<br><span>${correctCount}/${targets.length} this round.</span>` }));
    wrap.appendChild(el('p', { text: 'Each one you name makes the next easier to hear. Your Grove grew a little.' }));
    const again = el('button', { class: 'cta', text: 'Again' });
    again.addEventListener('click', () => { track('one_more', { from: 'snap' }); app.go('snap'); });
    wrap.appendChild(again);
    const home = el('button', { class: 'ghost', text: 'Back to the feed' });
    home.addEventListener('click', () => app.go('feed'));
    wrap.appendChild(home);
    pad.appendChild(wrap);
    sparkleBurst(wrap);
    app.mentor('<b>Wren:</b> your ear is sharpening. Come morning, your recorder will have a fresh haul waiting.');
    if (get().xp > 60) setTimeout(() => maybeShowWtp(app, 'snap_finish'), 2600);
  }

  return () => { audio.stopAll(); root.remove(); };
}
