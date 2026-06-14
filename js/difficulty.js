// Hark — flow difficulty. Builds a Spectrogram Snap round whose challenge sits
// just above the player's current skill. Difficulty rises through SUBTLETY
// (more options, closer-looking distractors) — never through a clock.

import { CREATURES, byId, seededShuffle } from './content.js';
import { get } from './state.js';

export function optionCount(skill) {
  if (skill < 1.3) return 2;
  if (skill < 2.1) return 3;
  return 4;
}

// pick distractors. At low skill: different group (easy to tell apart).
// At high skill: same group / similar frequency (a real ear test).
export function buildRound(target, skill, seed) {
  const n = optionCount(skill);
  const pool = CREATURES.filter((c) => c.id !== target.id);
  const sameGroup = pool.filter((c) => c.group === target.group);
  const diffGroup = pool.filter((c) => c.group !== target.group);

  let distractors = [];
  if (skill < 1.3) {
    distractors = seededShuffle(diffGroup, seed).slice(0, n - 1);
  } else if (skill < 2.1) {
    distractors = seededShuffle(sameGroup, seed).slice(0, 1)
      .concat(seededShuffle(diffGroup, seed + 7).slice(0, n - 2));
  } else {
    distractors = seededShuffle(sameGroup.length >= n - 1 ? sameGroup : pool, seed).slice(0, n - 1);
  }
  while (distractors.length < n - 1) {
    const extra = seededShuffle(pool, seed + distractors.length + 3)[0];
    if (extra && !distractors.find((d) => d.id === extra.id)) distractors.push(extra);
    else break;
  }
  const options = seededShuffle([target, ...distractors], seed + 11);
  return { target, options, correctIndex: options.findIndex((o) => o.id === target.id) };
}

// the 5-round session, ending on a "stretch" (one notch harder than your current skill)
export function sessionTargets(seed, preferIds) {
  const base = preferIds && preferIds.length
    ? preferIds.map(byId).filter(Boolean)
    : seededShuffle(CREATURES.filter((c) => !c.isNoise), seed).slice(0, 5);
  return base.slice(0, 5);
}
