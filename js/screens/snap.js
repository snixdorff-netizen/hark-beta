// Hark — Spectrogram Snap. Hear it, match the picture. No clock, no fail-state.
// Difficulty rises through subtlety; the session ends on a stretch-win.
import { el, clear, icon, sparkleBurst, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { buildRound, sessionTargets } from '../difficulty.js';
import { get, addXp, adjustSkill, awardCrown, discover, growGrove, touchStreak, getQuest, bumpQuestSnap, markQuestDone, checkMilestone, checkCollectionComplete } from '../state.js';
import { track, challengeUrl } from '../analytics.js';
import { maybeShowWtp } from '../probes.js';
import { creatureEmoji, rarityPct, byId, CREATURES, WREN_QUOTES, viralFeed } from '../content.js';
import { shareCreature, shareStreak, shareSnap } from '../sharecard.js';
import { mirrorState } from '../notifications.js';

// Daily creature — same for all players today (rotates through viral pool by calendar day)
function getDailyCreature() {
  const dayN = Math.floor(Date.now() / 86400000);
  const viralPool = CREATURES.filter((c) => c.viral && !c.isNoise);
  return viralPool.length ? viralPool[dayN % viralPool.length] : null;
}

export function mount(host, app, params = {}) {
  const root = el('div', { class: 'screen' });
  const pad = el('div', { class: 'pad' });
  root.appendChild(pad); host.appendChild(root);

  const challengeCreature = params.challenge ? byId(params.challenge) : null;
  const dailyCreature = (!challengeCreature && !params.preferIds) ? getDailyCreature() : null;
  const isDaily = !!dailyCreature && !params.preferIds;
  const dayN2 = Math.floor(Date.now() / 86400000);
  let seed = isDaily ? (dayN2 * 7919) : ((get().xp * 131 + 17) >>> 0);
  const targets = challengeCreature ? [challengeCreature] : sessionTargets(seed, params.preferIds, dailyCreature);
  let i = 0, correctCount = 0;
  let gotRight = [];
  let dailyNamed = false;
  let dailyWrongCount = 0;
  const roundResults = [];
  let roundAttempts = 0;

  if (challengeCreature) showChallengeIntro();
  else if (!localStorage.getItem('hark.snapSeen')) { localStorage.setItem('hark.snapSeen', '1'); showSnapTutorial(); }
  else renderRound();

  function showSnapTutorial() {
    clear(pad);
    const v = el('div', { class: 'cold' });
    const emoDiv = el('div', { style: 'font-size:52px;line-height:1' });
    emoDiv.textContent = '🎧';
    v.appendChild(emoDiv);
    v.appendChild(el('h1', { text: 'Spectrogram Snap', style: 'font-size:21px;text-align:center' }));
    v.appendChild(el('p', { style: 'color:var(--muted);max-width:270px;text-align:center;line-height:1.6', text: 'You hear a wild sound. Four spectrograms appear — the visual fingerprints of sound. Find the match. No clock. No fail-state.' }));
    const btn = el('button', { class: 'cta', text: "Let's go →" });
    btn.addEventListener('click', renderRound);
    v.appendChild(btn);
    pad.appendChild(v);
  }

  function showChallengeIntro() {
    clear(pad);
    const v = el('div', { class: 'cold' });
    const emoDiv = el('div', { style: 'font-size:64px;line-height:1;margin-bottom:12px' });
    emoDiv.textContent = '🎧';
    v.appendChild(emoDiv);
    v.appendChild(el('h1', { text: 'Someone challenged you.', style: 'font-size:22px;text-align:center' }));
    v.appendChild(el('p', { text: 'Listen to this sound and name it. No clock. Trust your ears.', style: 'text-align:center;color:var(--muted);max-width:260px' }));
    const btn = el('button', { class: 'cta', text: 'Accept the challenge' });
    btn.addEventListener('click', () => renderRound());
    v.appendChild(btn);
    pad.appendChild(v);
  }

  function renderRound() {
    clear(pad);
    const s = get();
    // last round is a "stretch": one notch harder — but only meaningful in a
    // multi-round session. A single-target "Tap to ID"/mystery-card launch
    // has targets.length === 1, so i === targets.length - 1 was always true,
    // silently applying stretch difficulty to a round the player has zero
    // warmup for.
    const stretch = targets.length > 1 && i === targets.length - 1;
    const dailySession = !!dailyCreature && !params.preferIds;
    const skill = dailySession ? 1.5 : (stretch ? s.skill + 0.7 : s.skill);
    const target = targets[i];
    const round = buildRound(target, skill, (seed + i * 97) >>> 0);

    const isDaily = dailyCreature && target.id === dailyCreature.id;
    const head = el('div', { class: 'q-head' });
    head.appendChild(el('div', { class: 'q-title', text: dailySession ? '⭐ Daily — same for everyone' : (stretch ? 'One more — trust your ears' : 'Which one is this?') }));
    const dots = el('div', { style: 'display:flex;gap:4px;align-items:center' });
    for (let d = 0; d < targets.length; d++) {
      const dot = d < roundResults.length ? (roundResults[d] ? '✅' : '❌') : (d === i ? '⚡' : '⚪');
      dots.appendChild(el('span', { style: 'font-size:10px;line-height:1', text: dot }));
    }
    head.appendChild(dots);
    pad.appendChild(head);

    const replay = el('div', { class: 'replay' });
    const pb = el('button', { class: 'playbtn', 'aria-label': 'Replay', html: icon('play', 20) });
    pb.addEventListener('click', () => { audio.unlock(); audio.play(target); });
    replay.appendChild(pb);
    replay.appendChild(el('div', { style: 'font-size:13px;color:var(--muted)', text: 'tap to replay the sound' }));
    pad.appendChild(replay);
    audio.unlock(); audio.play(target);

    const opts = el('div', { class: 'opts', style: 'grid-template-columns:1fr 1fr' });
    const optionCards = [];
    round.options.forEach((c, idx) => {
      const card = el('button', { class: 'opt' });
      const sg = el('div', { class: 'specwrap', style: 'width:100%' });
      card.appendChild(sg);
      card.appendChild(el('div', { class: 'lab', text: String.fromCharCode(65 + idx) }));
      requestAnimationFrame(() => mountSpectrogram(sg, c, sg.clientWidth || 150, 64));
      card.addEventListener('click', () => choose(c, card, target, optionCards));
      opts.appendChild(card);
      optionCards.push(card);
    });
    pad.appendChild(opts);

    const foot = el('div', { class: 'foot' });
    foot.appendChild(el('div', { class: 'hint', text: 'no clock — take your time' }));
    pad.appendChild(foot);
  }

  function choose(c, card, target, optionCards) {
    if (card.dataset.done) return;
    // Once the correct answer is found, lock every option in the round —
    // previously only the tapped card was marked done, so a fast second tap
    // on a different option (before the ~950ms advance-to-next-round timer)
    // could still fire choose() again and double-count adjustSkill/audio.
    if (optionCards && optionCards.some((o) => o.dataset.locked)) return;
    if (c.id === target.id) {
      if (optionCards) optionCards.forEach((o) => { o.dataset.locked = '1'; });
      roundResults.push(roundAttempts === 0);
      roundAttempts = 0;
      card.dataset.done = '1';
      card.classList.add('correct'); haptic(14); sparkleBurst(card);
      correctCount++;
      gotRight.push(target);
      adjustSkill(true);
      const { level: crownLevel, isNew: crownUp } = awardCrown(target.id);
      discover(target.id); addXp(10);
      const snapMilestone = checkMilestone();
      if (snapMilestone) app.setTimeout(() => app.milestone(snapMilestone), 1100);
      const snapColHit = checkCollectionComplete(CREATURES);
      if (snapColHit) app.setTimeout(() => app.collection(snapColHit), snapMilestone ? 5000 : 1800);
      if (app.checkThemeUnlock) app.checkThemeUnlock();
      const reveal = el('div', { style: 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:var(--panel);border-radius:13px;pointer-events:none;animation:fade .2s ease' });
      const rEmo = el('div', { style: 'font-size:38px;line-height:1' });
      rEmo.textContent = creatureEmoji(target);
      reveal.appendChild(rEmo);
      reveal.appendChild(el('div', { style: 'font-size:11px;color:var(--teal);font-weight:600;letter-spacing:.03em', text: target.name }));
      // Daily sound named — fire special share moment (once per day)
      const isDailyTarget = dailyCreature && target.id === dailyCreature.id;
      if (isDailyTarget && !dailyNamed) {
        dailyNamed = true;
        reveal.appendChild(el('div', { style: 'font-size:10px;color:var(--amber);font-weight:600;letter-spacing:.04em;margin-top:2px', text: '⭐ DAILY SOUND' }));
        app.setTimeout(async () => {
          track('daily_snap_named', { id: target.id });
          const url = challengeUrl(target.id);
          const text = 'Named today\'s wild sound on Hark 🎧 Can you? ' + url;
          app.mentor('<b>Daily sound named!</b> ' + creatureEmoji(target) + ' Challenge someone to beat you. 🎧', 8000);
          app.setTimeout(async () => {
            try {
              if (navigator.share) await navigator.share({ title: 'Hark Daily Sound', text, url });
              else await navigator.clipboard.writeText(text);
            } catch (e) {}
          }, 1500);
        }, 1000);
      } else if (target.rare) {
        reveal.appendChild(el('div', { style: 'font-size:10px;color:#6f8bff;font-weight:600;letter-spacing:.04em;margin-top:2px', text: '✨ RARE' }));
        app.setTimeout(() => {
          track('rare_found', { id: target.id });
          const wrQ = WREN_QUOTES[target.id];
          if (wrQ) app.mentor('<b>Wren:</b> ' + wrQ, 9000);
          else shareCreature(target, app);
        }, 1200);
      } else if (crownUp && crownLevel === 3) {
        reveal.appendChild(el('div', { style: 'font-size:10px;color:var(--amber);font-weight:600;letter-spacing:.04em;margin-top:2px', text: '👑 MASTERED' }));
        app.setTimeout(() => {
          app.mentor('<b>Mastered!</b> ' + target.name + ' — you know this one cold. ' + rarityPct(target) + '% of listeners ever get here.', 7000);
        }, 800);
      }
      card.style.position = 'relative';
      card.appendChild(reveal);
      app.setTimeout(next, (target.rare || (crownUp && crownLevel === 3)) ? 1800 : 950);
    } else {
      roundAttempts++;
      card.classList.add('wrong'); haptic(20); adjustSkill(false);
      audio.play(target);
      if (dailyCreature && target.id === dailyCreature.id) dailyWrongCount++;
      app.setTimeout(() => card.classList.remove('wrong'), 450);
    }
  }

  function next() {
    i++;
    if (i < targets.length) renderRound();
    else finish();
  }

  const STREAK_MILESTONES = [3, 7, 14, 30];

  function finish() {
    const newStreak = touchStreak();
    mirrorState(get());
    growGrove(4);
    track('snap_complete', { correct: correctCount, total: targets.length });
    if (!challengeCreature) {
      const q = getQuest();
      if (q.type === 'snap' && !q.done) {
        const n = bumpQuestSnap();
        if (n >= q.goal) { markQuestDone(); addXp(75); app.setTimeout(() => app.mentor('<b>Quest complete!</b> +75 XP. Three rounds down. The wild is starting to sound familiar. 🌿', 7000), 600); track('quest_complete', { type: 'snap' }); }
      }
    }
    const isMilestone = STREAK_MILESTONES.includes(newStreak);
    clear(pad);
    const wrap = el('div', { class: 'cold', style: 'position:relative' });
    wrap.appendChild(el('span', { class: 'ic', html: icon('trophy', 44), style: 'color:var(--amber)' }));
    if (gotRight.length) {
      // Creature cards: emoji + name + rarity + first-sentence fact
      const factList = el('div', { style: 'display:flex;flex-direction:column;gap:10px;width:100%' });
      gotRight.forEach(c => {
        const row = el('div', { style: 'display:flex;gap:12px;align-items:flex-start;background:var(--panel);border:.5px solid var(--line);border-radius:12px;padding:10px 12px' });
        const emoWrap = el('div', { style: 'font-size:26px;line-height:1;flex-shrink:0;padding-top:2px' });
        emoWrap.textContent = creatureEmoji(c);
        row.appendChild(emoWrap);
        const info = el('div', { style: 'flex:1;min-width:0' });
        info.appendChild(el('div', { style: 'font-size:13px;font-weight:600;color:var(--ink)', text: c.name }));
        info.appendChild(el('div', { style: 'font-size:10px;color:var(--teal);margin-top:1px', text: rarityPct(c) + '% of listeners find this' }));
        if (c.fact) {
          const firstSentence = c.fact.split(/[.!?]/)[0].trim() + '.';
          info.appendChild(el('div', { style: 'font-size:11px;color:var(--muted);margin-top:4px;line-height:1.5', text: firstSentence }));
        }
        row.appendChild(info);
        factList.appendChild(row);
      });
      wrap.appendChild(factList);
    }
    const headline = challengeCreature && correctCount > 0
      ? `<span style="color:var(--teal)">${creatureEmoji(challengeCreature)} ${challengeCreature.name}.</span><br>You got it.`
      : `Nice ears.<br><span>${correctCount}/${targets.length} this round.</span>`;
    wrap.appendChild(el('h1', { html: headline }));
    if (newStreak >= 1) {
      wrap.appendChild(el('div', { style: 'font-size:12px;color:var(--amber);font-weight:500;margin-top:-8px', text: `🔥 Day ${newStreak} in the wild` }));
    }
    const remainingCount = CREATURES.filter((c) => !c.isNoise).length - 1;
    wrap.appendChild(el('p', { text: challengeCreature ? (remainingCount + ' more wild sounds are out there. Can you find them all?') : 'Each one you name makes the next easier to hear. Your Grove grew a little.' }));
    if (challengeCreature) {
      const challengeBack = el('button', { class: 'cta', text: '🎧 Challenge someone back' });
      challengeBack.addEventListener('click', async () => {
        const url = challengeUrl(challengeCreature.id);
        const text = 'I named this sound. Can you? 🎧 ' + url;
        try {
          if (navigator.share) await navigator.share({ title: 'Hark sound challenge', text, url });
          else await navigator.clipboard.writeText(text);
          track('challenge_back', { id: challengeCreature.id });
        } catch (e) {}
      });
      wrap.appendChild(challengeBack);
      const exploreBtn = el('button', { class: 'cta', style: 'background:rgba(62,201,159,.15);color:var(--teal)', text: '🌿 Explore the wild →' });
      exploreBtn.addEventListener('click', () => { track('challenge_to_feed'); app.go('feed'); });
      wrap.appendChild(exploreBtn);
    } else if (dailyNamed) {
      // ── Daily Sound Named card — Wordle-style shareable result ──────────────
      const s2 = get();
      const totalFound = Object.keys(s2.discovered).length;
      const daily = dailyCreature;
      const emoResult = '❌'.repeat(dailyWrongCount) + '✅';
      const dayN2 = Math.floor(Date.now() / 86400000);
      const best = s2.longestStreak || newStreak;
      const bestLine = best > newStreak ? ' · 🏆 Best: ' + best : '';
      const shareText2 = 'Hark #' + dayN2 + ' 🎧\n' + creatureEmoji(daily) + ' ' + emoResult + '\nDay ' + newStreak + ' 🔥' + bestLine + ' · ' + totalFound + '/93 🌿';

      const dailyCard = el('div', { style: 'background:rgba(224,164,77,.1);border:.5px solid rgba(224,164,77,.35);border-radius:14px;padding:16px 18px;text-align:center;width:100%' });
      dailyCard.appendChild(el('div', { style: 'font-size:10px;font-weight:600;letter-spacing:.08em;color:var(--amber);margin-bottom:8px', text: '⭐ DAILY SOUND NAMED' }));
      const dEmo = el('div', { style: 'font-size:52px;line-height:1;margin-bottom:4px' });
      dEmo.textContent = creatureEmoji(daily);
      dailyCard.appendChild(dEmo);
      dailyCard.appendChild(el('div', { style: 'font-size:17px;font-weight:600;color:var(--ink)', text: daily.name }));
      dailyCard.appendChild(el('div', { style: 'font-size:18px;letter-spacing:4px;margin:6px 0 2px', text: emoResult }));
      dailyCard.appendChild(el('div', { style: 'font-size:11px;color:var(--muted)', text: '🔥 Day ' + newStreak + ' · ' + totalFound + '/93 sounds found' }));
      const dailyShareBtn = el('button', { class: 'cta', style: 'margin-top:12px', text: '📸 Share your result' });
      dailyShareBtn.addEventListener('click', () => shareSnap(roundResults, daily, newStreak, app));
      dailyCard.appendChild(dailyShareBtn);
      wrap.appendChild(dailyCard);
      // Upcoming streak milestone hook
      const NEXT_MILESTONES = [3, 7, 14, 30];
      const nextM = NEXT_MILESTONES.find((n) => n > newStreak);
      if (nextM && nextM - newStreak === 1) {
        app.setTimeout(() => app.mentor('<b>Wren:</b> Day ' + newStreak + '. One more day and you hit ' + nextM + ' — a milestone most listeners never reach. Come back tomorrow.', 8000), 1400);
      }
    } else if (isMilestone) {
      const milestoneDiv = el('div', { style: 'background:rgba(224,164,77,.12);border:.5px solid rgba(224,164,77,.4);border-radius:14px;padding:14px 18px;text-align:center;width:100%' });
      milestoneDiv.appendChild(el('div', { style: 'font-size:28px;margin-bottom:4px', text: '🔥' }));
      milestoneDiv.appendChild(el('div', { style: 'font-size:15px;font-weight:600;color:var(--amber)', text: newStreak + '-day streak!' }));
      milestoneDiv.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:4px', text: 'Most people don\'t make it this far.' }));
      const streakShareBtn = el('button', { class: 'cta', style: 'margin-top:10px', text: '📤 Share your streak' });
      streakShareBtn.addEventListener('click', () => shareStreak(newStreak, app));
      milestoneDiv.appendChild(streakShareBtn);
      const snapShareBtn2 = el('button', { class: 'ghost', style: 'margin-top:6px;font-size:12px', text: '📸 Share snap results' });
      snapShareBtn2.addEventListener('click', () => shareSnap(roundResults, dailyCreature, newStreak, app));
      milestoneDiv.appendChild(snapShareBtn2);
      wrap.appendChild(milestoneDiv);
    } else if (gotRight.length) {
      const best = gotRight.slice().sort((a, b) => rarityPct(a) - rarityPct(b))[0];
      const shareBtn = el('button', { class: 'cta', text: '🎧 Challenge a friend' });
      shareBtn.addEventListener('click', async () => {
        track('snap_challenge_share', { id: best.id });
        const url = challengeUrl(best.id);
        const text = 'I named this sound on Hark — can you? 🎧 ' + url;
        try {
          if (navigator.share) await navigator.share({ title: 'Hark sound challenge', text, url });
          else await navigator.clipboard.writeText(text);
        } catch (e) { if (e.name !== 'AbortError') shareCreature(best, app); }
      });
      wrap.appendChild(shareBtn);
    }
    const again = el('button', { class: 'ghost', text: 'Another round' });
    again.addEventListener('click', () => { track('one_more', { from: 'snap' }); app.go('snap'); });
    wrap.appendChild(again);
    const home = el('button', { class: 'ghost', text: 'Back to the feed' });
    home.addEventListener('click', () => app.go('feed'));
    wrap.appendChild(home);
    pad.appendChild(wrap);
    sparkleBurst(wrap);
    const s2 = get();
    const discovered2 = Object.keys(s2.discovered).length;
    const total = CREATURES.filter((c) => !c.isNoise).length;
    const pctFound = Math.round((discovered2 / total) * 100);
    const comebackMsgs = [
      `<b>Wren:</b> ${pctFound}% of wild sounds found. The rarest ones only show up in the haul. Come back tonight.`,
      `<b>Wren:</b> your recorder is listening right now. Deploy a haul and something unexpected might show up.`,
      `<b>Wren:</b> ${total - discovered2} sounds still out there. Some only come at dawn. Check back tomorrow.`,
    ];
    const msgIdx = s2.xp % comebackMsgs.length;
    app.setTimeout(() => app.mentor(comebackMsgs[msgIdx], 8000), 1200);
    if (s2.xp > 60) app.setTimeout(() => maybeShowWtp(app, 'snap_finish'), 2600);
  }

  return () => { audio.stopAll(); root.remove(); };
}
