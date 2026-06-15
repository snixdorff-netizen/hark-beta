// Hark — content manifest.
// Each creature carries a synth "recipe" (events). The SAME recipe drives both
// the audible sound (audio.js) and the spectrogram image (spectrogram.js), so the
// picture always matches the sound — which is what makes Spectrogram Snap honest.
//
// PLACEHOLDER AUDIO: these are procedurally synthesized stand-ins. Real licensed
// recordings drop into /assets/audio/<id>.mp3 and set `clip: true`. See ASSET_TRACKER.md.

export const GROUPS = {
  bird:        { label: 'Bird',        color: '#3ec99f' },
  mammal:      { label: 'Mammal',      color: '#e0a44d' },
  amphibian:   { label: 'Amphibian',   color: '#7fc4ff' },
  insect:      { label: 'Insect',      color: '#c9a23e' },
  marine:      { label: 'Marine',      color: '#6f8bff' },
  geophony:    { label: 'Earth & weather', color: '#b4b2a9' },
};

// event types: tone | sweep | pulse | noise | chirp
// f in Hz, t/dur in seconds, gain 0..1
export const CREATURES = [
  {
    id: 'lyrebird', name: 'Superb lyrebird', group: 'bird', region: 'SE Australia', viral: true, rare: true,
    fact: 'The superb lyrebird mimics anything — other birds, camera shutters, even chainsaws. It is one of the most accurate vocal mimics on Earth.',
    duration: 3.0,
    events: [
      { t: 0.0, dur: 0.4, type: 'sweep', f0: 1800, f1: 3600, gain: 0.4, wave: 'sine' },
      { t: 0.45, dur: 0.35, type: 'sweep', f0: 3800, f1: 1500, gain: 0.4, wave: 'sine' },
      { t: 0.9, dur: 0.25, type: 'chirp', f0: 2500, f1: 5200, gain: 0.42 },
      { t: 1.2, dur: 0.5, type: 'noise', f0: 1200, f1: 5000, gain: 0.18 },
      { t: 1.8, dur: 0.3, type: 'sweep', f0: 800, f1: 4200, gain: 0.4, wave: 'triangle' },
      { t: 2.2, dur: 0.3, type: 'chirp', f0: 3000, f1: 1800, gain: 0.4 },
      { t: 2.6, dur: 0.35, type: 'sweep', f0: 2200, f1: 4800, gain: 0.4, wave: 'sine' },
    ],
  },
  {
    id: 'barredowl', name: 'Barred owl', group: 'bird', region: 'E North America', viral: false,
    fact: 'Its call is often written as “who cooks for you, who cooks for you-all?” — a rhythm birders learn by ear before they ever see the bird.',
    duration: 2.8,
    events: [
      { t: 0.0, dur: 0.22, type: 'tone', f0: 360, gain: 0.5, wave: 'sine', harm: 3 },
      { t: 0.3, dur: 0.22, type: 'tone', f0: 380, gain: 0.5, wave: 'sine', harm: 3 },
      { t: 0.62, dur: 0.22, type: 'tone', f0: 340, gain: 0.5, wave: 'sine', harm: 3 },
      { t: 0.9, dur: 0.3, type: 'sweep', f0: 360, f1: 250, gain: 0.5, wave: 'sine' },
      { t: 1.5, dur: 0.22, type: 'tone', f0: 360, gain: 0.5, wave: 'sine', harm: 3 },
      { t: 1.8, dur: 0.22, type: 'tone', f0: 380, gain: 0.5, wave: 'sine', harm: 3 },
      { t: 2.1, dur: 0.5, type: 'sweep', f0: 360, f1: 230, gain: 0.5, wave: 'sine' },
    ],
  },
  {
    id: 'treefrog', name: 'Pacific tree frog', group: 'amphibian', region: 'W North America', viral: false,
    fact: 'The two-part “kreck-ek” is the classic movie frog — Hollywood used it everywhere, even in places these frogs have never lived.',
    duration: 2.4,
    events: [
      { t: 0.0, dur: 0.16, type: 'chirp', f0: 1700, f1: 2100, gain: 0.45 },
      { t: 0.2, dur: 0.22, type: 'chirp', f0: 2100, f1: 1600, gain: 0.5 },
      { t: 0.8, dur: 0.16, type: 'chirp', f0: 1700, f1: 2100, gain: 0.45 },
      { t: 1.0, dur: 0.22, type: 'chirp', f0: 2100, f1: 1600, gain: 0.5 },
      { t: 1.6, dur: 0.16, type: 'chirp', f0: 1700, f1: 2100, gain: 0.45 },
      { t: 1.8, dur: 0.22, type: 'chirp', f0: 2100, f1: 1600, gain: 0.5 },
    ],
  },
  {
    id: 'cicada', name: 'Summer cicada', group: 'insect', region: 'Worldwide', viral: false,
    fact: 'A cicada makes its wall of sound with tymbals — ribbed membranes it buckles hundreds of times a second, the body acting as a drum.',
    duration: 3.0,
    events: [
      { t: 0.0, dur: 3.0, type: 'noise', f0: 4000, f1: 9000, gain: 0.22, am: 28 },
      { t: 0.0, dur: 3.0, type: 'tone', f0: 6500, gain: 0.12, wave: 'sawtooth', harm: 2, am: 28 },
    ],
  },
  {
    id: 'foxscream', name: 'Red fox', group: 'mammal', region: 'N hemisphere', viral: true, rare: true,
    fact: 'The red fox’s night “scream” is a contact and mating call — unsettling if you don’t know it, ordinary conversation if you do.',
    duration: 2.0,
    events: [
      { t: 0.0, dur: 0.5, type: 'sweep', f0: 900, f1: 1400, gain: 0.45, wave: 'sawtooth', harm: 3 },
      { t: 0.7, dur: 0.5, type: 'sweep', f0: 1000, f1: 1500, gain: 0.45, wave: 'sawtooth', harm: 3 },
      { t: 1.4, dur: 0.5, type: 'sweep', f0: 950, f1: 1300, gain: 0.4, wave: 'sawtooth', harm: 3 },
    ],
  },
  {
    id: 'wind', name: 'Wind through pines', group: 'geophony', region: 'Anywhere', viral: false,
    fact: 'Wind is geophony — the non-living half of a soundscape. Learning to hear past it is the first skill every field recordist builds.',
    duration: 3.2,
    events: [
      { t: 0.0, dur: 3.2, type: 'noise', f0: 250, f1: 2200, gain: 0.3, am: 1.5 },
    ],
  },
  {
    id: 'springpeeper', name: 'Spring peeper', group: 'amphibian', region: 'E North America', viral: false,
    fact: 'A chorus of spring peepers is one of the loudest signs of spring — each tiny frog louder, pound for pound, than a power tool.',
    duration: 2.4,
    events: [
      { t: 0.0, dur: 0.18, type: 'sweep', f0: 2600, f1: 3100, gain: 0.5, wave: 'sine' },
      { t: 0.6, dur: 0.18, type: 'sweep', f0: 2600, f1: 3100, gain: 0.5, wave: 'sine' },
      { t: 1.2, dur: 0.18, type: 'sweep', f0: 2600, f1: 3100, gain: 0.5, wave: 'sine' },
      { t: 1.8, dur: 0.18, type: 'sweep', f0: 2600, f1: 3100, gain: 0.5, wave: 'sine' },
    ],
  },
  {
    id: 'wren', name: 'Winter wren', group: 'bird', region: 'Holarctic', viral: false, rare: true,
    fact: 'A bird the size of a ping-pong ball delivers a torrent of 100+ notes — a song so dense it sounds sped up. Hark’s mentor takes her name from it.',
    duration: 3.0,
    events: [
      { t: 0.0, dur: 0.3, type: 'chirp', f0: 4200, f1: 6200, gain: 0.36 },
      { t: 0.3, dur: 0.3, type: 'chirp', f0: 5800, f1: 3800, gain: 0.36 },
      { t: 0.6, dur: 0.3, type: 'chirp', f0: 4600, f1: 6600, gain: 0.36 },
      { t: 0.9, dur: 0.3, type: 'chirp', f0: 6000, f1: 4200, gain: 0.36 },
      { t: 1.2, dur: 0.5, type: 'noise', f0: 4000, f1: 7000, gain: 0.14 },
      { t: 1.7, dur: 0.3, type: 'chirp', f0: 4400, f1: 6400, gain: 0.36 },
      { t: 2.0, dur: 0.3, type: 'chirp', f0: 6200, f1: 4000, gain: 0.36 },
      { t: 2.3, dur: 0.3, type: 'chirp', f0: 4800, f1: 6800, gain: 0.36 },
      { t: 2.6, dur: 0.35, type: 'chirp', f0: 5600, f1: 4200, gain: 0.36 },
    ],
  },
  {
    id: 'nighthawk', name: 'Common nighthawk', group: 'bird', region: 'Americas', viral: false, rare: true,
    fact: 'Beyond its nasal “peent,” the nighthawk makes a booming “wing-rush” with air over its feathers as it dives — sound made without a voice.',
    duration: 2.2,
    events: [
      { t: 0.0, dur: 0.25, type: 'noise', f0: 1500, f1: 3000, gain: 0.32 },
      { t: 1.0, dur: 0.6, type: 'sweep', f0: 900, f1: 180, gain: 0.5, wave: 'triangle' },
    ],
  },
  {
    id: 'engine', name: 'Distant engine', group: 'geophony', region: 'Anthrophony', viral: false,
    fact: 'Engine drone is anthrophony — human noise. Telling it from biophony is a core skill, and the reason “Noise or Nature” exists.',
    duration: 3.0, isNoise: true,
    events: [
      { t: 0.0, dur: 3.0, type: 'tone', f0: 120, gain: 0.4, wave: 'sawtooth', harm: 5, am: 6 },
      { t: 0.0, dur: 3.0, type: 'noise', f0: 80, f1: 600, gain: 0.18 },
    ],
  },
];

// Patch in real licensed clips from the ingestion manifest (assets/audio/manifest.json).
// Sets clip:true so the audio engine plays the real recording and the spectrogram
// renderer computes a true STFT image. Carries license + attribution for credits.
export async function loadManifest() {
  try {
    const res = await fetch('assets/audio/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const m = await res.json();
    for (const [id, meta] of Object.entries(m)) {
      let c = CREATURES.find((x) => x.id === id);
      if (!c) { c = { id, name: meta.name, group: meta.group, region: meta.region, duration: 3 }; CREATURES.push(c); }
      c.clip = true;
      c.license = meta.license; c.author = meta.author; c.source = meta.source; c.sourceName = meta.sourceName;
      if (meta.viral) c.viral = true;
      if (meta.rare) c.rare = true;
      const groupLabel = ((GROUPS[c.group] || {}).label || c.group || 'sound').toLowerCase();
      c.fact = c.fact || meta.fact || `A ${groupLabel} recorded in ${meta.region}. Listen for what makes its voice unmistakable.`;
    }
  } catch (e) {}
}

const EMOJI_MAP = {
  lyrebird: '🦚',
  barredowl: '🦉',
  greathornedowl: '🦉',
  treefrog: '🐸',
  cicada: '🦗',
  foxscream: '🦊',
  graywolf: '🐺',
  wind: '🌿',
  springpeeper: '🐸',
  wren: '🐦',
  nighthawk: '🌑',
  engine: '⚡',
  commonfrog: '🐸',
  commonloon: '🐦',
  baltimoreoriole: '🟠',
  humpbackwhale: '🐋',
};

const GROUP_EMOJI = { bird: '🐦', mammal: '🦌', amphibian: '🐸', insect: '🦗', marine: '🐋', geophony: '🌿' };

export const creatureEmoji = (c) => EMOJI_MAP[c.id] || GROUP_EMOJI[c.group] || '🔊';

// Deterministic "rarity %" per creature — seeded by id so it's stable across sessions.
// Rare creatures: 2-12%. Common: 22-60%. Creates FOMO without real backend data.
export function rarityPct(c) {
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  if (c.rare) return 2 + (h % 11);
  return 22 + (h % 39);
}

export const byId = (id) => CREATURES.find((c) => c.id === id);
export const inGroup = (g) => CREATURES.filter((c) => c.group === g);

// Feed order: viral first, then rare, then interleaved by group for variety.
// Goal: first 15 cards should be jaw-dropping; no two consecutive from same group.
export function viralFeed() {
  const viral = CREATURES.filter((c) => c.viral && !c.isNoise);
  const rare = CREATURES.filter((c) => c.rare && !c.viral && !c.isNoise);
  const common = CREATURES.filter((c) => !c.viral && !c.rare && !c.isNoise);
  const noise = CREATURES.filter((c) => c.isNoise);
  // Interleave for group variety after the viral block
  const interleaved = [];
  const pools = {};
  [...rare, ...common].forEach((c) => { (pools[c.group] = pools[c.group] || []).push(c); });
  const groups = Object.keys(pools);
  let gi = 0;
  while (groups.some((g) => pools[g].length)) {
    const g = groups[gi % groups.length];
    if (pools[g] && pools[g].length) interleaved.push(pools[g].shift());
    gi++;
  }
  return [...viral, ...interleaved, ...noise];
}

// deterministic shuffle (seeded) so we never call Math.random in a way that breaks replays
export function seededShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
