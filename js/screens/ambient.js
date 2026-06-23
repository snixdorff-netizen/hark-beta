import { el, icon } from '../ui.js';
import { get } from '../state.js';
import { byId, creatureEmoji, GROUPS, seededShuffle } from '../content.js';
import * as audio from '../audio.js';
import { track } from '../analytics.js';

const PRESETS = [
  { key: 'grove', label: 'My Grove', desc: 'Your discovered sounds', filter: (c, s) => !!s.discovered[c.id] },
  { key: 'bird', label: 'Birdsong', desc: 'Birds only', filter: (c) => c.group === 'bird' && c.clip },
  { key: 'night', label: 'Night Sounds', desc: 'Owls, foxes, frogs', filter: (c) => ['barredowl', 'foxscream', 'greathornedowl', 'tawnyowl', 'morepork'].includes(c.id) },
  { key: 'rain', label: 'Earth & Water', desc: 'Rain, wind, streams', filter: (c) => c.group === 'geophony' },
];

export function showAmbient(app) {
  const s = get();
  const discovered = Object.keys(s.discovered).map(byId).filter(Boolean);
  if (discovered.length < 3) return;

  const ovl = el('div', { class: 'ovl' });
  const sheet = el('div', { class: 'sheet', style: 'text-align:center;padding:22px 20px calc(env(safe-area-inset-bottom,0px) + 22px);max-height:85vh;overflow-y:auto' });

  sheet.appendChild(el('div', { style: 'font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--teal);margin-bottom:6px', text: 'AMBIENT LISTEN' }));
  sheet.appendChild(el('div', { style: 'font-size:18px;font-weight:600;color:var(--ink);margin-bottom:4px', text: 'Nature Sounds' }));
  sheet.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-bottom:18px', text: 'Continuous playback from your grove' }));

  let playing = false;
  let stopFlag = false;
  let currentPreset = null;
  let timerHandle = null;
  let remaining = 0;
  let timerInterval = null;

  const nowPlaying = el('div', { style: 'display:none;margin-bottom:18px;padding:14px;background:var(--panel);border:.5px solid var(--line);border-radius:14px' });
  const npEmoji = el('div', { style: 'font-size:42px;line-height:1;margin-bottom:4px' });
  const npName = el('div', { style: 'font-size:14px;font-weight:600;color:var(--ink)' });
  const npTimer = el('div', { style: 'font-size:11px;color:var(--muted);margin-top:4px' });
  nowPlaying.appendChild(npEmoji);
  nowPlaying.appendChild(npName);
  nowPlaying.appendChild(npTimer);

  const stopBtn = el('button', { style: 'margin-top:10px;font-size:12px;color:#ff6b6b;padding:6px 20px;border-radius:20px;background:rgba(255,107,107,.08);border:.5px solid rgba(255,107,107,.2)', text: '⏹ Stop' });
  stopBtn.addEventListener('click', () => {
    stopFlag = true; playing = false;
    audio.stopAll();
    clearTimeout(timerHandle);
    clearInterval(timerInterval);
    nowPlaying.style.display = 'none';
    presetGrid.style.display = 'grid';
    timerRow.style.display = 'flex';
    track('ambient_stop', { preset: currentPreset });
  });
  nowPlaying.appendChild(stopBtn);
  sheet.appendChild(nowPlaying);

  const TIMERS = [
    { min: 5, label: '5 min' },
    { min: 15, label: '15 min' },
    { min: 30, label: '30 min' },
    { min: 60, label: '1 hr' },
  ];
  let selectedTimer = 15;

  const timerRow = el('div', { style: 'display:flex;gap:6px;justify-content:center;margin-bottom:18px;flex-wrap:wrap' });
  TIMERS.forEach((t) => {
    const btn = el('button', {
      style: `font-size:11px;padding:5px 14px;border-radius:16px;border:.5px solid ${t.min === selectedTimer ? 'var(--teal)' : 'var(--line)'};background:${t.min === selectedTimer ? 'rgba(62,201,159,.12)' : 'var(--panel)'};color:${t.min === selectedTimer ? 'var(--teal)' : 'var(--muted)'}`,
      text: t.label,
    });
    btn.addEventListener('click', () => {
      selectedTimer = t.min;
      timerRow.querySelectorAll('button').forEach((b, i) => {
        const active = TIMERS[i].min === selectedTimer;
        b.style.borderColor = active ? 'var(--teal)' : 'var(--line)';
        b.style.background = active ? 'rgba(62,201,159,.12)' : 'var(--panel)';
        b.style.color = active ? 'var(--teal)' : 'var(--muted)';
      });
    });
    timerRow.appendChild(btn);
  });
  sheet.appendChild(timerRow);

  const presetGrid = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px' });
  PRESETS.forEach((p) => {
    const validCreatures = discovered.filter((c) => c.clip && p.filter(c, s));
    const count = validCreatures.length;
    const disabled = count < 2;
    const card = el('div', {
      style: `padding:14px 12px;border-radius:12px;cursor:${disabled ? 'default' : 'pointer'};opacity:${disabled ? '.4' : '1'};background:var(--panel);border:.5px solid var(--line);text-align:center`,
    });
    card.appendChild(el('div', { style: 'font-size:13px;font-weight:600;color:var(--ink)', text: p.label }));
    card.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);margin-top:2px', text: p.desc + (count > 0 ? ' · ' + count : '') }));
    if (!disabled) {
      card.addEventListener('click', () => startAmbient(p.key, validCreatures));
    }
    presetGrid.appendChild(card);
  });
  sheet.appendChild(presetGrid);

  const closeBtn = el('button', { style: 'color:var(--muted);font-size:12px;padding:8px 24px', text: 'Close' });
  closeBtn.addEventListener('click', () => {
    if (playing) { stopFlag = true; audio.stopAll(); clearTimeout(timerHandle); clearInterval(timerInterval); }
    ovl.remove();
  });
  sheet.appendChild(closeBtn);

  async function startAmbient(presetKey, creatures) {
    currentPreset = presetKey;
    playing = true;
    stopFlag = false;
    presetGrid.style.display = 'none';
    timerRow.style.display = 'none';
    nowPlaying.style.display = 'block';
    remaining = selectedTimer * 60;
    track('ambient_start', { preset: presetKey, timer: selectedTimer, count: creatures.length });

    timerInterval = setInterval(() => {
      remaining--;
      const m = Math.floor(remaining / 60);
      const sec = remaining % 60;
      npTimer.textContent = m + ':' + String(sec).padStart(2, '0') + ' remaining';
      if (remaining <= 0) {
        stopFlag = true; playing = false;
        audio.stopAll();
        clearInterval(timerInterval);
        clearTimeout(timerHandle);
        nowPlaying.style.display = 'none';
        presetGrid.style.display = 'grid';
        timerRow.style.display = 'flex';
        app.mentor('<b>Wren:</b> Ambient session complete. The forest quiets down.', 6000);
        track('ambient_complete', { preset: presetKey, timer: selectedTimer });
      }
    }, 1000);

    const seed = Date.now() % 10000;
    const shuffled = seededShuffle([...creatures], seed);
    let idx = 0;

    async function playNext() {
      if (stopFlag) return;
      const c = shuffled[idx % shuffled.length];
      idx++;
      npEmoji.textContent = creatureEmoji(c);
      npName.textContent = c.name;
      try {
        const dur = await audio.playAmbient(c);
        const gap = Math.max(2, dur) + 1.5;
        timerHandle = setTimeout(playNext, gap * 1000);
      } catch (e) {
        timerHandle = setTimeout(playNext, 3000);
      }
    }
    playNext();
  }

  ovl.appendChild(sheet);
  ovl.addEventListener('click', (e) => {
    if (e.target === ovl) {
      if (playing) { stopFlag = true; audio.stopAll(); clearTimeout(timerHandle); clearInterval(timerInterval); }
      ovl.remove();
    }
  });
  document.getElementById('app').appendChild(ovl);
}
