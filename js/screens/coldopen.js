// Hark — cold open. Lead with the creature, earn the spectrogram.
import { el, clear, icon, iconEl, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { byId, creatureEmoji } from '../content.js';
import { get, save, discover } from '../state.js';
import { track, shareUrl } from '../analytics.js';
import { showPrivacyNotice } from '../probes.js';
import { shareCreature } from '../sharecard.js';

export function mount(host, app) {
  const target = byId('lyrebird');
  const decoy  = byId('barredowl');
  const root   = el('div', { class: 'screen' });
  const cold   = el('div', { class: 'cold' });
  root.appendChild(cold);
  host.appendChild(root);

  track('onboarding_start');
  stepListen();

  // ── STEP 1: LISTEN ──────────────────────────────────────────────────────────
  function stepListen() {
    clear(cold);

    const hero = el('div', { class: 'creature-hero', text: creatureEmoji(target) });
    cold.appendChild(hero);

    cold.appendChild(el('h1', { text: 'Listen. What is that?' }));

    const play = el('button', {
      class: 'bigplay',
      'aria-label': 'Play sound',
      html: icon('play', 30),
    });
    play.addEventListener('click', () => {
      audio.unlock();
      audio.play(target).catch(() => {});
      setTimeout(stepGuess, 900);
    });
    cold.appendChild(play);

    cold.appendChild(el('p', { text: 'Tap to hear it' }));
  }

  // ── STEP 2: GUESS ───────────────────────────────────────────────────────────
  function stepGuess() {
    clear(cold);

    cold.appendChild(el('h1', { text: 'Which one did you just hear?' }));

    const replay = el('button', { class: 'ghost', html: icon('play', 16) + ' replay' });
    replay.addEventListener('click', () => audio.play(target).catch(() => {}));
    cold.appendChild(replay);

    const row = el('div', { class: 'emo-opt-row' });
    [target, decoy].forEach(c => {
      const card = el('button', { class: 'emo-opt' });

      const emoDiv = el('div', { text: creatureEmoji(c) });
      emoDiv.style.fontSize = '40px';
      card.appendChild(emoDiv);

      card.appendChild(el('span', { text: c.name }));

      card.addEventListener('click', () => choose(c, card));
      row.appendChild(card);
    });
    cold.appendChild(row);
  }

  function choose(c, card) {
    if (c.id === target.id) {
      card.classList.add('correct');
      haptic(14);
      sparkleBurst(card);
      discover(target.id);
      setTimeout(win, 700);
    } else {
      card.classList.add('wrong');
      haptic(20);
      audio.play(target).catch(() => {});
      setTimeout(() => card.classList.remove('wrong'), 500);
    }
  }

  // ── STEP 3: WIN ─────────────────────────────────────────────────────────────
  function win() {
    clear(cold);

    const hero = el('div', { class: 'creature-hero', text: creatureEmoji(target) });
    hero.style.fontSize = '64px';
    cold.appendChild(hero);

    cold.appendChild(el('h1', { text: 'You found your first creature.' }));

    const nameSpan = el('span', { text: target.name });
    nameSpan.style.color = 'var(--teal)';
    cold.appendChild(nameSpan);

    const sgLabel = el('div', { text: 'This is what it looks like as sound:' });
    cold.appendChild(sgLabel);

    const sg = el('div', { class: 'specwrap', style: 'width:240px' });
    cold.appendChild(sg);
    mountSpectrogram(sg, target, 240, 60);

    cold.appendChild(el('p', { text: target.fact }));
    cold.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:-10px', text: '92 more sounds are waiting in the wild.' }));

    const shareBtn = el('button', { class: 'ghost', style: 'color:var(--teal);font-size:14px', text: '📤 Tell a friend about Hark' });
    shareBtn.addEventListener('click', () => {
      track('onboarding_share');
      shareCreature(target, app);
    });
    cold.appendChild(shareBtn);

    const cta = el('button', { class: 'cta', text: 'Start listening' });
    cta.addEventListener('click', () => {
      const s = get();
      s.onboarded = true;
      save();
      track('onboarding_complete');
      root.remove();
      app.go('feed');
      showPrivacyNotice();
    });
    cold.appendChild(cta);
  }

  return () => root.remove();
}
