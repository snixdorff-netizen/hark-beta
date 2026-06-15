// Hark — Spectrogram Snap. Hear it, match the picture. No clock, no fail-state.
// Difficulty rises through subtlety; the session ends on a stretch-win.
import { el, clear, icon, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { buildRound, sessionTargets } from '../difficulty.js';
import { get, addXp, adjustSkill, awardCrown, discover, growGrove, touchStreak } from '../state.js';
import { track } from '../analytics.js';
import { maybeShowWtp } from '../probes.js';
import { creatureEmoji, rarityPct } from '../content.js';
import { shareCreature, shareStreak } from '../sharecard.js';

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
      adjustSkill(true);
      const { level: crownLevel, isNew: crownUp } = awardCrown(target.id);
      discover(target.id); addXp(10);
      const reveal = el('div', { style: 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--panel);border-radius:13px;pointer-events:none;animation:fade .2s ease' });
      const rEmo = el('div', { style: 'font-size:38px;line-height:1' });
      rEmo.textContent = creatureEmoji(target);
      reveal.appendChild(rEmo);
      reveal.appendChild(el('div', { style: 'font-size:11px;color:var(--teal);font-weight:600;letter-spacing:.03em', text: target.name }));
      if (target.rare) {
        reveal.appendChild(el('div', { style: 'font-size:10px;color:#6f8bff;font-weight:600;letter-spacing:.04em;margin-top:2px', text: '✨ RARE' }));
        setTimeout(() => {
          track('rare_found', { id: target.id });
          shareCreature(target, app);
        }, 1200);
      } else if (crownUp && crownLevel === 3) {
        reveal.appendChild(el('div', { style: 'font-size:10px;color:var(--amber);font-weight:600;letter-spacing:.04em;margin-top:2px', text: '👑 MASTERED' }));
        setTimeout(() => {
          app.mentor('<b>Mastered!</b> ' + target.name + ' — you know this one cold. ' + rarityPct(target) + '% of listeners ever get here.', 7000);
        }, 800);
      }
      card.style.position = 'relative';
      card.appendChild(reveal);
      setTimeout(next, (target.rare || (crownUp && crownLevel === 3)) ? 1800 : 950);
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

  const STREAK_MILESTONES = [3, 7, 14, 30];

  function finish() {
    const newStreak = touchStreak();
    growGrove(4);
    track('snap_complete', { correct: correctCount, total: targets.length });
    const isMilestone = STREAK_MILESTONES.includes(newStreak);
    clear(pad);
    const wrap = el('div', { class: 'cold', style: 'position:relative' });
    wrap.appendChild(el('span', { class: 'ic', html: icon('trophy', 44), style: 'color:var(--amber)' }));
    if (gotRight.length) {
      const emoRow = el('div', { style: 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap' });
      gotRight.forEach(c => {
        const chip = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:2px' });
        const emo = el('span', { style: 'font-size:28px;line-height:1' });
        emo.textContent = creatureEmoji(c);
        chip.appendChild(emo);
        const pct = el('div', { style: 'font-size:9px;color:var(--muted)' });
        pct.textContent = rarityPct(c) + '% find this';
        chip.appendChild(pct);
        emoRow.appendChild(chip);
      });
      wrap.appendChild(emoRow);
    }
    wrap.appendChild(el('h1', { html: `Nice ears.<br><span>${correctCount}/${targets.length} this round.</span>` }));
    wrap.appendChild(el('p', { text: 'Each one you name makes the next easier to hear. Your Grove grew a little.' }));
    if (isMilestone) {
      const milestoneDiv = el('div', { style: 'background:rgba(224,164,77,.12);border:.5px solid rgba(224,164,77,.4);border-radius:14px;padding:14px 18px;text-align:center;width:100%' });
      milestoneDiv.appendChild(el('div', { style: 'font-size:28px;margin-bottom:4px', text: '🔥' }));
      milestoneDiv.appendChild(el('div', { style: 'font-size:15px;font-weight:600;color:var(--amber)', text: newStreak + '-day streak!' }));
      milestoneDiv.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:4px', text: 'Most people don\'t make it this far.' }));
      const streakShareBtn = el('button', { class: 'cta', style: 'margin-top:10px', text: '📤 Share your streak' });
      streakShareBtn.addEventListener('click', () => shareStreak(newStreak, app));
      milestoneDiv.appendChild(streakShareBtn);
      wrap.appendChild(milestoneDiv);
    } else if (gotRight.length) {
      const shareBtn = el('button', { class: 'cta', text: '📤 Share your catch' });
      shareBtn.addEventListener('click', () => {
        track('snap_share', { count: gotRight.length });
        shareCreature(gotRight[gotRight.length - 1], app);
      });
      wrap.appendChild(shareBtn);
    }
    const again = el('button', { class: 'ghost', text: 'Another round' });
    again.addEventListener('click', () => { track('one_more', { from: 'snap' }); app.go('snap'); });
    wrap.appendChild(again);
    const home = el('button', { class: 'ghost', text: 'Back to the feed' });
    home.addEventListener('click', () => app.go('feed'));
    wrap.appendChild(home);
    pad.appendChild(wrap);
    sparkleBurst(wrap);
    const s2 = get();
    const discovered2 = Object.keys(s2.discovered).length;
    const total = 93;
    const pctFound = Math.round((discovered2 / total) * 100);
    const comebackMsgs = [
      `<b>Wren:</b> ${pctFound}% of wild sounds found. The rarest ones only show up in the haul. Come back tonight.`,
      `<b>Wren:</b> your recorder is listening right now. Deploy a haul and something unexpected might show up.`,
      `<b>Wren:</b> ${total - discovered2} sounds still out there. Some only come at dawn. Check back tomorrow.`,
    ];
    const msgIdx = s2.xp % comebackMsgs.length;
    setTimeout(() => app.mentor(comebackMsgs[msgIdx], 8000), 1200);
    if (s2.xp > 60) setTimeout(() => maybeShowWtp(app, 'snap_finish'), 2600);
  }

  return () => { audio.stopAll(); root.remove(); };
}
