// Hark — cold open. Silent-playable onboarding. The sound IS the tutorial.
import { el, clear, icon, iconEl, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { byId } from '../content.js';
import { get, save, discover } from '../state.js';

export function mount(host, app) {
  const target = byId('barredowl');
  const decoy = byId('treefrog');
  const root = el('div', { class: 'screen' });
  const cold = el('div', { class: 'cold' });
  root.appendChild(cold);
  host.appendChild(root);

  stepListen();

  function stepListen() {
    clear(cold);
    cold.appendChild(el('div', { class: 'wm', text: 'HARK' }));
    const sg = el('div', { class: 'specwrap', style: 'width:240px' });
    cold.appendChild(sg);
    mountSpectrogram(sg, target, 240, 86);
    cold.appendChild(el('h1', { html: 'Put on headphones.<br><span>Trust your ears.</span>' }));
    const play = el('button', { class: 'bigplay', 'aria-label': 'Play sound', html: icon('play', 30) });
    play.addEventListener('click', async () => {
      audio.unlock(); haptic();
      await audio.play(target);
      setTimeout(stepGuess, 900);
    });
    cold.appendChild(play);
    cold.appendChild(el('p', { text: 'Tap to hear a sound from the forest.' }));
  }

  function stepGuess() {
    clear(cold);
    cold.appendChild(el('div', { class: 'wm', text: 'HARK' }));
    cold.appendChild(el('h1', { text: 'Which one did you just hear?' }));
    const replay = el('button', { class: 'ghost', html: icon('play', 16) + ' replay' });
    replay.addEventListener('click', () => audio.play(target));
    cold.appendChild(replay);

    const opts = el('div', { class: 'opts', style: 'width:100%;max-width:340px' });
    [target, decoy].sort(() => 0).forEach((c, i) => {
      // keep target first slot deterministic-easy on the very first try
      const card = el('button', { class: 'opt' });
      const sg = el('div', { class: 'specwrap', style: 'width:100%' });
      card.appendChild(sg);
      card.appendChild(el('div', { class: 'lab', text: i === 0 ? 'A' : 'B' }));
      requestAnimationFrame(() => mountSpectrogram(sg, c, sg.clientWidth || 150, 70));
      card.addEventListener('click', () => choose(c, card));
      opts.appendChild(card);
    });
    cold.appendChild(opts);
  }

  function choose(c, card) {
    if (c.id === target.id) {
      card.classList.add('correct'); haptic(14); sparkleBurst(card);
      discover(target.id);
      setTimeout(win, 650);
    } else {
      card.classList.add('wrong'); haptic(20);
      setTimeout(() => card.classList.remove('wrong'), 500);
      audio.play(target);
    }
  }

  function win() {
    clear(cold);
    cold.appendChild(el('div', { class: 'wm', text: 'HARK' }));
    cold.appendChild(el('span', { class: 'ic', html: icon('ear', 44), style: 'color:var(--teal)' }));
    cold.appendChild(el('h1', { html: 'You just read your<br><span>first spectrogram.</span>' }));
    cold.appendChild(el('p', { text: 'A picture of sound — time goes left to right, pitch bottom to top. Your eyes already started learning it.' }));
    const cta = el('button', { class: 'cta', text: 'Start listening' });
    cta.addEventListener('click', () => {
      const s = get(); s.onboarded = true; save();
      root.remove();
      app.go('feed');
    });
    cold.appendChild(cta);
  }

  return () => root.remove();
}
