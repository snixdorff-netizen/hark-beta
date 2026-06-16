// Hark — persistent game state (localStorage). Calm-first: no lives, no losses.
// Progress accrues; nothing is taken away.

const KEY = 'hark.save.v1';

const DEFAULT = {
  onboarded: false,
  xp: 0,
  streak: 0,
  lastPlayed: null,        // YYYY-MM-DD
  crowns: {},              // creatureId -> 0..3 (bronze/silver/gold mastery)
  discovered: {},          // creatureId -> true
  grove: 0,                // 0..100 restoration %
  rehomed: 0,              // count of sounds added to the Grove
  haul: null,              // { deployedAt, readyAt, sorted, items:[ids], unknownSeen }
  skill: 1.0,              // adaptive flow difficulty (0.5 easy .. 3 hard)
  challengeDay: null,      // last Daily Field Challenge date completed
  questDate: null,         // date of current daily quest
  questSnap: 0,            // snap rounds completed today (for snap quest)
  questDiscover: 0,        // new creatures discovered today (for discover quest)
  questDone: false,        // daily quest completed
  milestones: [],          // creature-count thresholds already celebrated
  collectionsComplete: [], // group keys where every creature has been found
  settings: { sound: true, captions: true, highContrast: false },
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT);
    return Object.assign(structuredClone(DEFAULT), JSON.parse(raw));
  } catch (e) {
    return structuredClone(DEFAULT);
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

export function get() { return state; }

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function touchStreak() {
  const t = today();
  if (state.lastPlayed === t) return state.streak;
  // grace-day streak: yesterday OR the day before keeps it alive
  const last = state.lastPlayed ? new Date(state.lastPlayed) : null;
  const now = new Date(t);
  const days = last ? Math.round((now - last) / 86400000) : 99;
  if (days <= 2) state.streak += 1; else state.streak = 1;
  state.lastPlayed = t;
  save();
  return state.streak;
}

export function addXp(n) { state.xp += n; save(); }

export function discover(id) {
  if (!state.discovered[id]) {
    state.discovered[id] = Date.now();
    save();
  }
}

// Bump mastery toward gold. Returns { level, isNew } — isNew when crossing a threshold.
export function awardCrown(id) {
  const cur = state.crowns[id] || 0;
  if (cur < 3) { state.crowns[id] = cur + 1; save(); return { level: state.crowns[id], isNew: true }; }
  return { level: state.crowns[id], isNew: false };
}

export function growGrove(pct) {
  state.grove = Math.min(100, state.grove + pct);
  state.rehomed += 1;
  save();
}

// Flow difficulty: nudge skill up on wins, gently down on misses. Never below 0.5.
export function adjustSkill(correct) {
  if (correct) state.skill = Math.min(3, state.skill + 0.12);
  else state.skill = Math.max(0.5, state.skill - 0.18);
  save();
}

// Reset daily quest counters if it's a new day
function ensureQuestDay() {
  const t = today();
  if (state.questDate !== t) {
    state.questDate = t;
    state.questSnap = 0;
    state.questDiscover = 0;
    state.questDone = false;
    save();
  }
}

export function bumpQuestSnap() {
  ensureQuestDay();
  state.questSnap += 1;
  save();
  return state.questSnap;
}

export function bumpQuestDiscover() {
  ensureQuestDay();
  state.questDiscover += 1;
  save();
  return state.questDiscover;
}

export function markQuestDone() {
  ensureQuestDay();
  state.questDone = true;
  save();
}

export function getQuest() {
  ensureQuestDay();
  const dayN = Math.floor(Date.now() / 86400000);
  const types = ['snap', 'discover', 'challenge'];
  const type = types[dayN % types.length];
  const goal = type === 'snap' ? 3 : type === 'discover' ? 5 : 1;
  const progress = type === 'snap' ? state.questSnap : type === 'discover' ? state.questDiscover : (state.challengeDay === today() ? 1 : 0);
  return { type, goal, progress, done: state.questDone };
}

// Returns { group, creatures } for the first newly-completed collection, or null.
// allCreatures: the full CREATURES array (passed in to avoid circular imports).
export function checkCollectionComplete(allCreatures) {
  if (!state.collectionsComplete) state.collectionsComplete = [];
  const done = state.collectionsComplete;
  const byGroup = {};
  allCreatures.filter((c) => !c.isNoise).forEach((c) => {
    if (!byGroup[c.group]) byGroup[c.group] = { all: [], found: 0 };
    byGroup[c.group].all.push(c);
    if (state.discovered[c.id]) byGroup[c.group].found++;
  });
  const hit = Object.keys(byGroup).find((g) => {
    const gr = byGroup[g];
    return gr.all.length >= 3 && gr.found === gr.all.length && !done.includes(g);
  });
  if (hit) {
    state.collectionsComplete.push(hit);
    save();
    return { group: hit, creatures: byGroup[hit].all };
  }
  return null;
}

// Returns the first uncelebrated milestone threshold crossed, or null.
export function checkMilestone() {
  const THRESHOLDS = [5, 10, 25, 50, 75];
  const count = Object.keys(state.discovered).length;
  const seen = state.milestones || [];
  const hit = THRESHOLDS.find((n) => n <= count && !seen.includes(n));
  if (hit) {
    if (!state.milestones) state.milestones = [];
    state.milestones.push(hit);
    save();
    return hit;
  }
  return null;
}

export function reset() {
  state = structuredClone(DEFAULT);
  save();
}
