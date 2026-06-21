// Hark — rank progression. Identity the player earns and wants to share.
const RANKS = [
  { min: 0,  title: 'First Day Out', emoji: '🌱', color: '#9fb2aa' },
  { min: 1,  title: 'Curious',       emoji: '👂', color: '#3ec99f' },
  { min: 6,  title: 'Listener',      emoji: '🎧', color: '#3ec99f' },
  { min: 16, title: 'Fieldworker',   emoji: '🎤', color: '#e0a44d' },
  { min: 31, title: 'Naturalist',    emoji: '🌿', color: '#e0a44d' },
  { min: 51, title: 'Recordist',     emoji: '📻', color: '#c9a23e' },
  { min: 76, title: 'Ecologist',     emoji: '🌲', color: '#6f8bff' },
];

export function getRank(discoveredCount) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (discoveredCount >= r.min) rank = r;
  }
  return rank;
}

export function getNextRank(discoveredCount) {
  return RANKS.find((r) => r.min > discoveredCount) || null;
}

export function earScore(state) {
  const disc = Object.keys(state.discovered).length;
  const mastered = Object.values(state.crowns).filter((v) => v >= 3).length;
  const streak = state.longestStreak || state.streak || 0;
  const discPts = Math.min(50, Math.round((disc / 93) * 50));
  const mastPts = Math.min(25, Math.round((mastered / 30) * 25));
  const streakPts = Math.min(15, Math.round(Math.min(streak, 30) / 30 * 15));
  const xpPts = Math.min(10, Math.round(Math.min(state.xp, 2000) / 2000 * 10));
  return discPts + mastPts + streakPts + xpPts;
}

export function rankProgress(discoveredCount) {
  const rank = getRank(discoveredCount);
  const next = getNextRank(discoveredCount);
  const pct = next
    ? (discoveredCount - rank.min) / (next.min - rank.min)
    : 1;
  return { rank, next, pct: Math.min(1, Math.max(0, pct)) };
}
