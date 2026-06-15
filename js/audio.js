// Hark — audio engine. Plays a creature's synth recipe through Web Audio.
// If creature.clip is true, plays the licensed file from /assets/audio/<id>.mp3 instead.

let ctx = null;
let master = null;
let active = [];
const buffers = {};

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

export function unlock() {
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
}

export function stopAll() {
  active.forEach((n) => { try { n.stop(); } catch (e) {} });
  active = [];
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let x = 12345;
  for (let i = 0; i < len; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (x / 0x3fffffff) - 1;
  }
  return buf;
}

function envGain(startT, dur, peak) {
  const g = ctx.createGain();
  const a = Math.min(0.04, dur * 0.25);
  const r = Math.min(0.12, dur * 0.4);
  g.gain.setValueAtTime(0.0001, startT);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), startT + a);
  g.gain.setValueAtTime(Math.max(0.001, peak), startT + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, startT + dur);
  return g;
}

function scheduleEvent(ev, t0) {
  const start = t0 + ev.t;
  const dur = ev.dur;
  const peak = (ev.gain ?? 0.4) * 0.5;

  if (ev.type === 'noise') {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const center = Math.sqrt((ev.f0 || 400) * (ev.f1 || 2000));
    bp.frequency.value = center;
    bp.Q.value = 0.6;
    const g = envGain(start, dur, peak);
    if (ev.am) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = ev.am;
      lg.gain.value = peak * 0.6;
      g.gain.setValueAtTime(peak * 0.5, start);
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(start); lfo.stop(start + dur);
      active.push(lfo);
    }
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(start); src.stop(start + dur);
    active.push(src);
    return;
  }

  // tonal: tone | pulse | sweep | chirp
  const osc = ctx.createOscillator();
  osc.type = ev.wave || 'sine';
  const g = envGain(start, dur, peak);
  if (ev.type === 'sweep' || ev.type === 'chirp') {
    osc.frequency.setValueAtTime(ev.f0, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, ev.f1 || ev.f0), start + dur);
  } else {
    osc.frequency.setValueAtTime(ev.f0, start);
    if (ev.am) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = ev.am;
      lg.gain.value = ev.f0 * 0.04;
      lfo.connect(lg); lg.connect(osc.frequency);
      lfo.start(start); lfo.stop(start + dur);
      active.push(lfo);
    }
  }
  osc.connect(g); g.connect(master);
  osc.start(start); osc.stop(start + dur);
  active.push(osc);

  // a couple of quiet harmonics for body
  const harm = ev.harm || 0;
  for (let h = 2; h <= harm; h++) {
    if (h > 4) break;
    const o2 = ctx.createOscillator();
    o2.type = ev.wave || 'sine';
    const g2 = envGain(start, dur, peak / (h * 2));
    const f = (ev.f0 || 300) * h;
    o2.frequency.setValueAtTime(f, start);
    if (ev.type === 'sweep' || ev.type === 'chirp') {
      o2.frequency.exponentialRampToValueAtTime(Math.max(20, (ev.f1 || ev.f0) * h), start + dur);
    }
    o2.connect(g2); g2.connect(master);
    o2.start(start); o2.stop(start + dur);
    active.push(o2);
  }
}

async function loadClip(creature) {
  if (buffers[creature.id]) return buffers[creature.id];
  const res = await fetch(`assets/audio/${creature.id}.mp3`);
  const arr = await res.arrayBuffer();
  const buf = await ctx.decodeAudioData(arr);
  buffers[creature.id] = buf;
  return buf;
}

// Decode a clip to an AudioBuffer (for spectrogram analysis) without playing it.
export async function decode(creature) {
  ensure();
  return loadClip(creature);
}

// Returns the duration scheduled (seconds).
export async function play(creature) {
  ensure();
  if (ctx.state === 'suspended') await ctx.resume();
  stopAll();
  if (creature.clip) {
    try {
      const buf = await loadClip(creature);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain(); g.gain.value = 0.9;
      src.connect(g); g.connect(master);
      src.start();
      active.push(src);
      return buf.duration;
    } catch (e) { /* fall through to synth */ }
  }
  if (!creature.events?.length) return 0;
  const t0 = ctx.currentTime + 0.06;
  creature.events.forEach((ev) => scheduleEvent(ev, t0));
  return creature.duration;
}
