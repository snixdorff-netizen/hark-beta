// Hark — Noise or Nature. Gut-feel swipe: real wild sound, or interference?
import { el, clear, icon, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { CREATURES, seededShuffle, creatureEmoji } from '../content.js';
import { get, addXp, growGrove, touchStreak } from '../state.js';
import { track as analyticsTrack, shareUrl, challengeUrl } from '../analytics.js';

const NOISE = [
  { id: 'static', name: 'Radio static', group: 'geophony', isNoise: true, duration: 2.4, fact: '', events: [{ t: 0, dur: 2.4, type: 'noise', f0: 300, f1: 9000, gain: 0.3 }] },
  { id: 'hum', name: 'Electrical hum', group: 'geophony', isNoise: true, duration: 2.4, fact: '', events: [{ t: 0, dur: 2.4, type: 'tone', f0: 60, gain: 0.4, wave: 'sawtooth', harm: 4 }, { t: 0, dur: 2.4, type: 'tone', f0: 120, gain: 0.2, wave: 'sine' }] },
  { id: 'handling', name: 'Mic handling', group: 'geophony', isNoise: true, duration: 2.0, fact: '', events: [{ t: 0.2, dur: 0.3, type: 'noise', f0: 60, f1: 400, gain: 0.4 }, { t: 1.0, dur: 0.3, type: 'noise', f0: 80, f1: 500, gain: 0.4 }] },
];

export function mount(host, app) {
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad' });
  root.appendChild(pad); host.appendChild(root);

  const seed = (get().xp * 53 + 9) >>> 0;
  const nature = CREATURES.filter((c) => !c.isNoise);
  const deck = seededShuffle(
    seededShuffle(nature, seed).slice(0, 5).concat(seededShuffle(NOISE.concat(CREATURES.filter(c => c.isNoise)), seed + 3).slice(0, 3)),
    seed + 5
  );
  let i = 0, right = 0, lastRightCreature = null;
  renderCard();

  function renderCard() {
    clear(pad);
    const item = deck[i];
    const head = el('div', { class: 'q-head' });
    head.appendChild(el('div', { class: 'q-title', text: 'Noise or nature?' }));
    head.appendChild(el('div', { class: 'pill', html: `${i + 1}/${deck.length}` }));
    pad.appendChild(head);

    const area = el('div', { class: 'swipearea' });
    area.appendChild(el('div', { class: 'side no', html: icon('x', 26) + '<span>noise</span>' }));
    const cardWrap = el('div', { style: 'flex:1' });
    const card = el('div', { class: 'swipecard' });
    const sg = el('div', { class: 'specwrap', style: 'width:100%' });
    card.appendChild(sg);
    card.appendChild(el('div', { class: 'ask', text: 'what do you hear?' }));
    cardWrap.appendChild(card);
    area.appendChild(cardWrap);
    area.appendChild(el('div', { class: 'side yes', html: icon('check', 26) + '<span>nature</span>' }));
    pad.appendChild(area);
    requestAnimationFrame(() => mountSpectrogram(sg, item, sg.clientWidth || 240, 96));
    audio.unlock(); audio.play(item);

    const replay = el('button', { class: 'ghost', html: icon('play', 16) + ' replay', style: 'align-self:center' });
    replay.addEventListener('click', () => audio.play(item));
    pad.appendChild(replay);

    const row = el('div', { class: 'btn-row' });
    const noise = el('button', { class: 'btn', text: 'Noise' });
    const nat = el('button', { class: 'btn primary', text: 'Nature' });
    noise.addEventListener('click', () => answer(true, card));
    nat.addEventListener('click', () => answer(false, card));
    row.appendChild(noise); row.appendChild(nat);
    pad.appendChild(row);

    addSwipe(card, () => answer(false, card), () => answer(true, card));
  }

  function showReveal(item, wasCorrect) {
    clear(pad);
    const stamp = el('div', { class: 'reveal-card' });
    const emo = el('div', { style: 'font-size:56px;line-height:1' });
    emo.textContent = creatureEmoji(item);
    stamp.appendChild(emo);
    stamp.appendChild(el('div', { style: 'font-size:18px;font-weight:500;margin-top:4px', text: item.name }));
    const verdict = el('div', { style: 'font-size:13px;padding:5px 14px;border-radius:20px;margin-top:6px' });
    if (wasCorrect) {
      verdict.textContent = 'Good ear ✓';
      verdict.style.cssText += ';background:rgba(62,201,159,.15);color:var(--teal)';
    } else {
      verdict.textContent = item.isNoise ? 'That was noise' : 'That was nature';
      verdict.style.cssText += ';background:rgba(255,255,255,.08);color:var(--muted)';
    }
    stamp.appendChild(verdict);
    pad.appendChild(stamp);
    setTimeout(() => { i++; if (i < deck.length) renderCard(); else finish(); }, 950);
  }

  function answer(saidNoise, card) {
    if (card.dataset.done) return;
    card.dataset.done = '1';
    const item = deck[i];
    const correct = saidNoise === !!item.isNoise;
    if (correct) { right++; addXp(6); sparkleBurst(card); haptic(12); if (!item.isNoise) lastRightCreature = item; }
    else { haptic(20); }
    card.style.transition = 'transform .25s,opacity .25s';
    card.style.transform = `translateX(${saidNoise ? -120 : 120}px) rotate(${saidNoise ? -8 : 8}deg)`;
    card.style.opacity = '0';
    setTimeout(() => showReveal(item, correct), 260);
  }

  function finish() {
    touchStreak(); growGrove(3);
    analyticsTrack('noise_complete', { right, total: deck.length });
    clear(pad);
    const wrap = el('div', { class: 'cold' });
    wrap.appendChild(el('span', { class: 'ic', html: icon('leaf', 42), style: 'color:var(--teal)' }));
    wrap.appendChild(el('h1', { html: `${right}/${deck.length}<br><span>good ears.</span>` }));
    wrap.appendChild(el('p', { text: 'Telling life from interference is the first skill every field recordist builds.' }));
    if (right >= Math.ceil(deck.length * 0.7)) {
      const scoreShare = el('button', { class: 'cta', text: '📤 Share your score' });
      scoreShare.addEventListener('click', async () => {
        analyticsTrack('noise_share', { right, total: deck.length });
        const url = lastRightCreature ? challengeUrl(lastRightCreature.id) : shareUrl();
        const pct = Math.round((right / deck.length) * 100);
        const text = 'I scored ' + right + '/' + deck.length + ' (' + pct + '%) on Hark\'s Noise or Nature. Can you beat it? 🌿 ' + url;
        try {
          if (navigator.share) await navigator.share({ title: 'Hark — Noise or Nature', text, url });
          else await navigator.clipboard.writeText(text);
        } catch (e) {}
      });
      wrap.appendChild(scoreShare);
    }
    const again = el('button', { class: right >= Math.ceil(deck.length * 0.7) ? 'ghost' : 'cta', text: 'Again' });
    again.addEventListener('click', () => app.go('noise'));
    wrap.appendChild(again);
    const home = el('button', { class: 'ghost', text: 'Back to the feed' });
    home.addEventListener('click', () => app.go('feed'));
    wrap.appendChild(home);
    pad.appendChild(wrap);
  }

  function addSwipe(node, onRight, onLeft) {
    let x0 = null;
    node.addEventListener('pointerdown', (e) => { x0 = e.clientX; node.setPointerCapture(e.pointerId); });
    node.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0;
      node.style.transform = `translateX(${dx}px) rotate(${dx * 0.04}deg)`;
    });
    node.addEventListener('pointerup', (e) => {
      if (x0 == null) return;
      const dx = e.clientX - x0; x0 = null;
      if (dx > 70) onRight();
      else if (dx < -70) onLeft();
      else node.style.transform = '';
    });
  }

  return () => { audio.stopAll(); root.remove(); };
}
