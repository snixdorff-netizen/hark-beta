// Hark — the Grove. Every sound you learn is rehomed here.
import { el, icon } from '../ui.js';
import { byId, CREATURES, GROUPS, creatureEmoji, rarityPct, WREN_QUOTES } from '../content.js';
import { get } from '../state.js';
import { rankProgress, earScore } from '../rank.js';
import { feedbackLink, showCredits } from '../probes.js';
import { shareGrove, shareCreature, shareWrapped } from '../sharecard.js';
import * as audio from '../audio.js';
import { track, challengeUrl } from '../analytics.js';
import { showAmbient } from './ambient.js';

export function mount(host, app) {
  const s = get();
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad', style: 'overflow-y:auto;height:100%' });
  root.appendChild(pad);

  const discovered = Object.keys(s.discovered).map(byId).filter(Boolean);
  const total = CREATURES.filter((c) => !c.isNoise).length;

  // ── Header ──────────────────────────────────────────────────────────────
  const head = el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px' });
  const headLeft = el('div');
  headLeft.appendChild(el('div', { style: 'font-size:20px;font-weight:600', text: 'Your Grove' }));
  if (discovered.length >= 10) {
    const pct = discovered.length >= 75 ? 2 : discovered.length >= 50 ? 5 : discovered.length >= 25 ? 12 : 30;
    headLeft.appendChild(el('div', { style: 'font-size:11px;color:var(--amber);font-weight:600;letter-spacing:.03em;margin-top:2px', text: 'Top ' + pct + '% of listeners' }));
  }
  head.appendChild(headLeft);
  const headRight = el('div', { style: 'text-align:right' });
  headRight.appendChild(el('div', { style: 'font-size:13px;color:var(--teal)', text: discovered.length + '/' + total + ' rehomed' }));
  const mastered = discovered.filter((c) => (s.crowns[c.id] || 0) >= 3).length;
  if (mastered > 0 || discovered.length >= 10) {
    headRight.appendChild(el('div', { style: 'font-size:11px;color:var(--amber);margin-top:2px', text: '★ ' + mastered + '/' + total + ' mastered' }));
  }
  head.appendChild(headRight);
  pad.appendChild(head);

  // Restoration progress bar
  const bar = el('div', { class: 'bar', style: 'margin-bottom:8px' });
  bar.appendChild(el('i', { style: `width:${Math.round(s.grove)}%` }));
  pad.appendChild(bar);

  // Rank progress row
  const rp = rankProgress(discovered.length);
  const rankRow = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:16px' });
  rankRow.appendChild(el('div', { style: 'font-size:16px;line-height:1', text: rp.rank.emoji }));
  rankRow.appendChild(el('div', { style: 'font-size:11px;color:var(--muted)', text: rp.rank.title }));
  if (rp.next) {
    const track2 = el('div', { style: 'flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden' });
    track2.appendChild(el('div', { style: `height:100%;width:${Math.round(rp.pct * 100)}%;background:var(--teal);border-radius:2px` }));
    rankRow.appendChild(track2);
    rankRow.appendChild(el('div', { style: 'font-size:11px;color:var(--muted)', text: rp.next.emoji }));
    rankRow.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);white-space:nowrap', text: (rp.next.min - discovered.length) + ' more' }));
  } else {
    rankRow.appendChild(el('div', { style: 'font-size:10px;color:var(--teal);font-weight:600;margin-left:4px', text: 'Max rank' }));
  }
  pad.appendChild(rankRow);

  // ── Creature mosaic ──────────────────────────────────────────────────────
  const mosaic = el('div', { style: 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px' });

  // Show discovered creatures
  discovered.forEach((c) => {
    const crowns = s.crowns[c.id] || 0;
    const pct = rarityPct(c);
    const isRare = c.rare;
    const isMastered = crowns >= 3;
    const cell = el('div', {
      title: c.name + ' · ' + pct + '% find this',
      style: [
        'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px',
        'border-radius:12px;padding:8px 4px;cursor:pointer;transition:transform .12s',
        isMastered ? 'background:rgba(224,164,77,.12);border:.5px solid rgba(224,164,77,.35)' :
          isRare ? 'background:rgba(111,139,255,.1);border:.5px solid rgba(111,139,255,.3)' :
          'background:var(--panel);border:.5px solid var(--line)',
      ].join(';'),
    });
    cell.addEventListener('click', () => showCreatureDetail(c, s, app));
    const emoDiv = el('div', { style: `font-size:${isMastered ? 26 : 22}px;line-height:1` });
    emoDiv.textContent = creatureEmoji(c);
    cell.appendChild(emoDiv);
    if (crowns > 0) {
      const starDiv = el('div', { style: 'font-size:9px;color:var(--amber);letter-spacing:1px', text: '★'.repeat(crowns) });
      cell.appendChild(starDiv);
    }
    const pctDiv = el('div', { style: 'font-size:8px;color:var(--muted);text-align:center', text: pct + '%' });
    cell.appendChild(pctDiv);
    mosaic.appendChild(cell);
  });

  // Empty slots for undiscovered creatures
  const undiscovered = total - discovered.length;
  for (let i = 0; i < Math.min(undiscovered, 10); i++) {
    const empty = el('div', {
      style: 'display:flex;align-items:center;justify-content:center;border-radius:12px;padding:8px 4px;background:rgba(255,255,255,.03);border:.5px dashed var(--line);height:60px',
      html: `<span style="font-size:16px;opacity:.2">${icon('leaf', 16)}</span>`,
    });
    mosaic.appendChild(empty);
  }
  if (undiscovered > 10) {
    const more = el('div', {
      style: 'grid-column:span 2;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--muted);padding:8px',
      text: '+' + (undiscovered - 10) + ' more out there',
    });
    mosaic.appendChild(more);
  }

  pad.appendChild(mosaic);

  // ── Group progress ───────────────────────────────────────────────────────
  const discoveredIds = new Set(Object.keys(s.discovered));
  const groupKeys = Object.keys(GROUPS);
  const groupRows = groupKeys.map((gKey) => {
    const g = GROUPS[gKey];
    const inGroup = CREATURES.filter((c) => !c.isNoise && c.group === gKey);
    const foundCount = inGroup.filter((c) => discoveredIds.has(c.id)).length;
    return { g, total: inGroup.length, found: foundCount };
  }).filter((r) => r.total > 0);

  if (groupRows.length > 0) {
    const gpSection = el('div', { style: 'margin-bottom:18px' });
    gpSection.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);letter-spacing:.07em;margin-bottom:10px', text: 'BY GROUP' }));
    groupRows.forEach(({ g, total, found }) => {
      const pct = Math.round((found / total) * 100);
      const complete = found >= total;
      const row = el('div', { style: 'margin-bottom:10px' });
      const hdr = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px' });
      const lbl = el('div', { style: 'display:flex;align-items:center;gap:6px' });
      const dot = el('div', { style: `width:7px;height:7px;border-radius:50%;background:${g.color};flex-shrink:0` });
      lbl.appendChild(dot);
      lbl.appendChild(el('span', { style: 'font-size:12px;color:var(--ink)', text: g.label }));
      if (complete) lbl.appendChild(el('span', { style: 'font-size:10px;color:var(--teal);font-weight:600;margin-left:4px', text: '✓ Complete' }));
      const oneAway = !complete && found === total - 1;
      hdr.appendChild(lbl);
      const countEl = el('div', { style: `font-size:11px;${oneAway ? 'color:var(--amber);font-weight:600' : 'color:var(--muted)'}` });
      countEl.textContent = found + '/' + total + (oneAway ? ' · 1 away' : '');
      hdr.appendChild(countEl);
      row.appendChild(hdr);
      const track = el('div', { style: 'height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden' });
      const fill = el('div', { style: `height:100%;width:${pct}%;background:${g.color};border-radius:2px` });
      track.appendChild(fill);
      row.appendChild(track);
      gpSection.appendChild(row);
    });
    pad.appendChild(gpSection);
  }

  // ── Ear Score ────────────────────────────────────────────────────────────
  if (discovered.length >= 3) {
    const score = earScore(s);
    const scoreCard = el('div', { style: 'background:radial-gradient(120% 80% at 50% 35%, rgba(224,164,77,.08) 0%, var(--panel) 70%);border:.5px solid rgba(224,164,77,.25);border-radius:14px;padding:18px 20px;text-align:center;margin-bottom:16px' });
    scoreCard.appendChild(el('div', { style: 'font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--amber);margin-bottom:6px', text: 'EAR SCORE' }));
    scoreCard.appendChild(el('div', { style: 'font-size:48px;font-weight:700;color:var(--ink);line-height:1', text: String(score) }));
    const tier = score >= 80 ? 'Legendary' : score >= 60 ? 'Expert' : score >= 40 ? 'Sharp' : score >= 20 ? 'Growing' : 'Beginner';
    scoreCard.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:4px', text: tier + ' · out of 100' }));
    const scoreSections = el('div', { style: 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:10px' });
    const chip = (label, val, max) => {
      const pct = Math.round((val / max) * 100);
      return el('div', { style: 'font-size:10px;color:var(--muted);background:rgba(255,255,255,.05);border-radius:10px;padding:3px 8px', text: label + ' ' + pct + '%' });
    };
    scoreSections.appendChild(chip('Discovery', Math.min(50, Math.round((discovered.length / 93) * 50)), 50));
    scoreSections.appendChild(chip('Mastery', Math.min(25, Math.round((Object.values(s.crowns).filter(v => v >= 3).length / 30) * 25)), 25));
    scoreSections.appendChild(chip('Streak', Math.min(15, Math.round(Math.min(s.longestStreak || 0, 30) / 30 * 15)), 15));
    scoreCard.appendChild(scoreSections);
    const scoreShareBtn = el('button', { style: 'margin-top:12px;font-size:12px;color:var(--teal);padding:6px 16px;border-radius:20px;background:rgba(62,201,159,.1);border:.5px solid rgba(62,201,159,.25)', text: '📤 Share your Ear Score' });
    scoreShareBtn.addEventListener('click', async () => {
      track('ear_score_share', { score });
      const url = (await import('../analytics.js')).shareUrl();
      const text = 'My Hark Ear Score: ' + score + '/100 ' + rp.rank.emoji + ' ' + rp.rank.title + '. Can you beat it? 🎧 ' + url;
      try {
        if (navigator.share) await navigator.share({ title: 'Hark Ear Score', text, url });
        else { await navigator.clipboard.writeText(text); app.mentor('✓ Copied to clipboard', 2000); }
      } catch (e) {}
    });
    scoreCard.appendChild(scoreShareBtn);
    if (discovered.length >= 5) {
      const wrappedBtn = el('button', { style: 'display:block;margin:8px auto 0;font-size:12px;color:#6f8bff;padding:6px 16px;border-radius:20px;background:rgba(111,139,255,.08);border:.5px solid rgba(111,139,255,.2)', text: '🎧 My Hark Wrapped' });
      wrappedBtn.addEventListener('click', () => shareWrapped(app));
      scoreCard.appendChild(wrappedBtn);
    }
    pad.appendChild(scoreCard);
  }

  // ── Share + actions ──────────────────────────────────────────────────────
  if (discovered.length > 0) {
    const shareBtn = el('button', {
      class: 'cta',
      style: 'width:100%',
      text: '📤 Share your grove',
    });
    shareBtn.addEventListener('click', () => shareGrove(discovered, s, app));
    pad.appendChild(shareBtn);

    if (discovered.length >= 3) {
      const ambientBtn = el('button', {
        style: 'width:100%;text-align:center;padding:12px;font-size:13px;font-weight:500;color:var(--ink);background:rgba(62,201,159,.06);border:.5px solid rgba(62,201,159,.15);border-radius:12px;margin-top:8px',
        text: '🌙 Ambient Listen — play your grove',
      });
      ambientBtn.addEventListener('click', () => showAmbient(app));
      pad.appendChild(ambientBtn);
    }

    const inviteBtn = el('button', { style: 'width:100%;text-align:center;padding:10px;font-size:13px;color:var(--teal)', text: '🎧 Invite a friend to Hark' });
    inviteBtn.addEventListener('click', async () => {
      track('grove_invite');
      const url = (await import('../analytics.js')).shareUrl();
      const text = 'I\'ve been listening to wild sounds on Hark — it\'s weirdly addictive. 93 sounds to find. 🌿 ' + url;
      try {
        if (navigator.share) await navigator.share({ title: 'Hark — wild sounds', text, url });
        else await navigator.clipboard.writeText(text);
      } catch (e) {}
    });
    pad.appendChild(inviteBtn);
  } else {
    pad.appendChild(el('p', { style: 'font-size:13px;color:var(--muted);text-align:center;margin-bottom:16px', text: 'Play the feed to bring sounds home.' }));
  }

  const actions = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;border-top:.5px solid var(--line);padding-top:10px;margin-top:4px' });
  actions.appendChild(feedbackLink());
  const creditsBtn = el('button', { style: 'font-size:11px;color:var(--muted);padding:6px 0', text: 'Sound credits' });
  creditsBtn.addEventListener('click', showCredits);
  actions.appendChild(creditsBtn);
  pad.appendChild(actions);

  host.appendChild(root);
  return () => root.remove();
}

function showCreatureDetail(c, s, app) {
  const crowns = s.crowns[c.id] || 0;
  const pct = rarityPct(c);
  const groupLabel = (GROUPS[c.group] || {}).label || c.group;

  const ovl = el('div', { class: 'ovl' });
  const sheet = el('div', { class: 'sheet', style: 'text-align:left;padding:22px 20px calc(env(safe-area-inset-bottom,0px) + 22px)' });

  // Header: emoji + name + close
  const header = el('div', { style: 'display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px' });
  const left = el('div', { style: 'display:flex;gap:14px;align-items:center' });
  const emoDiv = el('div', { style: 'font-size:52px;line-height:1' });
  emoDiv.textContent = creatureEmoji(c);
  left.appendChild(emoDiv);
  const nameCol = el('div');
  nameCol.appendChild(el('div', { style: 'font-size:18px;font-weight:600;color:var(--ink)', text: c.name }));
  nameCol.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:3px', text: groupLabel + ' · ' + c.region }));
  left.appendChild(nameCol);
  header.appendChild(left);
  const closeBtn = el('button', { style: 'color:var(--muted);font-size:22px;padding:0 4px;line-height:1;flex-shrink:0', text: '×' });
  closeBtn.addEventListener('click', () => ovl.remove());
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  // Rarity + mastery chips
  const chips = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px' });
  const rarColor = c.rare ? 'rgba(111,139,255,.12);color:#6f8bff;border:.5px solid rgba(111,139,255,.25)' : 'var(--panel);color:var(--muted);border:.5px solid var(--line)';
  chips.appendChild(el('div', { style: `font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${rarColor};letter-spacing:.03em`, text: c.rare ? '✨ Rare · ' + pct + '% find this' : pct + '% find this' }));
  if (crowns > 0) {
    const crownText = crowns === 3 ? '★★★ Mastered' : '★'.repeat(crowns) + ' Mastery';
    chips.appendChild(el('div', { style: 'font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:rgba(224,164,77,.12);color:var(--amber);border:.5px solid rgba(224,164,77,.25)', text: crownText }));
  }
  sheet.appendChild(chips);

  // Play sound row
  const playRow = el('div', { style: 'display:flex;align-items:center;gap:12px;background:var(--panel);border-radius:12px;padding:10px 14px;margin-bottom:14px;border:.5px solid var(--line)' });
  const pb = el('button', { class: 'playbtn', style: 'width:38px;height:38px;flex-shrink:0', html: icon('play', 18) });
  pb.addEventListener('click', () => { audio.unlock(); audio.play(c); });
  playRow.appendChild(pb);
  playRow.appendChild(el('div', { style: 'font-size:13px;color:var(--muted)', text: 'Play the real field recording' }));
  sheet.appendChild(playRow);

  // Discovery date
  const discoveredAt = s.discovered[c.id];
  const dateStr = (typeof discoveredAt === 'number')
    ? new Date(discoveredAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  if (dateStr) {
    sheet.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);letter-spacing:.04em;margin-bottom:14px', text: 'FOUND · ' + dateStr }));
  }

  // Wren field note
  const wrQ = WREN_QUOTES[c.id];
  if (wrQ) {
    const note = el('div', { style: 'border-left:2px solid rgba(62,201,159,.4);padding:8px 12px;margin-bottom:14px;background:rgba(62,201,159,.05);border-radius:0 8px 8px 0' });
    note.appendChild(el('div', { style: 'font-size:10px;font-weight:600;color:var(--teal);letter-spacing:.06em;margin-bottom:4px', text: 'WREN' }));
    note.appendChild(el('div', { style: 'font-size:12px;color:var(--ink);line-height:1.6;font-style:italic', text: wrQ }));
    sheet.appendChild(note);
  }

  // Fact
  sheet.appendChild(el('p', { style: 'font-size:13px;color:var(--ink);line-height:1.65;margin:0 0 18px', text: c.fact }));

  // Challenge CTA
  const challengeBtn = el('button', { class: 'cta', style: 'width:100%;margin-bottom:10px', text: '🎧 Challenge a friend with this sound' });
  challengeBtn.addEventListener('click', async () => {
    const url = challengeUrl(c.id);
    const text = 'Can you name this wild sound? 🎧 ' + url;
    try {
      if (navigator.share) await navigator.share({ title: 'Hark sound challenge', text, url });
      else await navigator.clipboard.writeText(text);
      track('grove_challenge', { id: c.id });
    } catch (e) { if (e.name !== 'AbortError') shareCreature(c, app); }
    ovl.remove();
  });
  sheet.appendChild(challengeBtn);

  const shareBtn = el('button', { style: 'width:100%;text-align:center;padding:10px;font-size:13px;color:var(--teal)', text: '📤 Share this creature' });
  shareBtn.addEventListener('click', () => { track('grove_share_creature', { id: c.id }); shareCreature(c, app); ovl.remove(); });
  sheet.appendChild(shareBtn);

  ovl.appendChild(sheet);
  ovl.addEventListener('click', (e) => { if (e.target === ovl) ovl.remove(); });
  document.getElementById('app').appendChild(ovl);
}
