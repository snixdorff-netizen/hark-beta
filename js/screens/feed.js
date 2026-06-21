// Hark — the Wild Feed. A swipeable scroll of wild sounds. Delight first; the
// micro-game (Tap to ID) is woven into the scroll; every card is shareable.
import { el, clear, icon, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { viralFeed, CREATURES, GROUPS, creatureEmoji, rarityPct, seededShuffle, WREN_QUOTES } from '../content.js';
import { get, discover, addXp, save, today, getQuest, bumpQuestDiscover, markQuestDone, checkMilestone, checkCollectionComplete, checkRankUp } from '../state.js';
import { track, challengeUrl } from '../analytics.js';
import { shareCreature } from '../sharecard.js';

export function mount(host, app) {
  const root = el('div', { class: 'screen' });
  const feed = el('div', { class: 'feed' });
  root.appendChild(feed);
  host.appendChild(root);

  const DAILY_TIPS = [
    'Listen for the silence between notes — that\'s where the field recordist earns their keep.',
    'If you can name a sound in 3 seconds, you\'ve truly learned it. Time yourself.',
    'Lyrebirds have been recorded imitating flute music heard once, decades prior.',
    'The 67 kHz signal is still unidentified. No one has named it. Keep it.',
    'A wolf pack harmonizes deliberately — each shifts pitch to avoid matching another.',
    'Spring peepers are louder, pound-for-pound, than any power tool ever made.',
    'The barn owl has no vocal apparatus for hooting — its screech is entirely its own.',
    'Real field recordists say the ear trains faster than the eye. Keep going.',
    'Nighthawks make sound with air over their feathers — no syrinx involved at all.',
    'The cuckoo\'s two-note call is one of the most recognized sounds on Earth. Why?',
  ];

  // Day-seeded tip so users see a different one each day
  const dayN = Math.floor(Date.now() / 86400000);
  const dailyTip = DAILY_TIPS[dayN % DAILY_TIPS.length];

  const baseList = viralFeed();
  const s = get();
  const dailyDone = s.challengeDay === today();

  // Rotate Sound of the Day through viral creatures by calendar day
  const viralPool = baseList.filter((c) => c.viral);
  const todayCreature = viralPool.length ? viralPool[dayN % viralPool.length] : baseList[0];
  const orderedList = todayCreature
    ? [todayCreature, ...baseList.filter((c) => c.id !== todayCreature.id)]
    : baseList;

  let cards = orderedList.map((c, i) => buildCard(c, app, i === 0, dailyDone, i === 0 ? dailyTip : null));
  const _lastDate = s.lastPlayed ? new Date(s.lastPlayed) : null;
  const _daysAway = _lastDate ? Math.round((Date.now() - _lastDate) / 86400000) : 0;
  const showWelcomeBack = _daysAway >= 3 && Object.keys(s.discovered).length >= 3;

  const weekN = Math.floor(dayN / 7);
  const undiscovered = CREATURES.filter((c) => !c.isNoise && !s.discovered[c.id]);
  const mysteryCreature = undiscovered.length > 0 ? undiscovered[(weekN * 7919) % undiscovered.length] : null;

  cards.forEach((c, i) => {
    feed.appendChild(c.node);
    if (i === 1 && showWelcomeBack) feed.appendChild(buildWelcomeBack(app, s, _daysAway));
    if (i === 3) feed.appendChild(buildSnapPullCard(app));
    if (i === 5 && mysteryCreature) feed.appendChild(buildMysteryCard(mysteryCreature, app));
    if (i === 8 && Object.keys(s.discovered).length >= 2) feed.appendChild(buildFieldLog(dayN));
  });

  // Sentinal sentinel div at the bottom — when it enters view, append another loop pass
  let loopPass = 0;
  const sentinel = el('div', { style: 'height:1px' });
  feed.appendChild(sentinel);

  function appendLoop() {
    loopPass++;
    const sep = el('div', { style: 'text-align:center;padding:32px 0 16px;font-size:12px;color:rgba(159,178,170,0.45);letter-spacing:.08em' });
    sep.textContent = '— back at the top —';
    if (loopPass === 1) {
      const disc = Object.keys(get().discovered).length;
      setTimeout(() => app.mentor(`<b>Wren:</b> You've heard them all. Now see if you can name them — try <b>Snap</b> and find out how much your ear has learned. 🎧`, 8000), 600);
      track('feed_loop_complete', { discovered: disc });
    }
    feed.insertBefore(sep, sentinel);
    const seed = loopPass * 7919;
    const shuffled = seededShuffle(orderedList.filter((c) => !c.isNoise), seed);
    const newCards = shuffled.map((c) => buildCard(c, app, false, dailyDone, null));
    newCards.forEach((c) => { feed.insertBefore(c.node, sentinel); io.observe(c.node); });
    cards = cards.concat(newCards);
  }

  // Lazy: only render a card's spectrogram (and decode its clip) when it nears
  // view — so 100+ clips don't all decode at once. Autoplay the centered card.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.target === sentinel && e.isIntersecting) { appendLoop(); return; }
      const card = cards.find((c) => c.node === e.target);
      if (!card) return;
      if (e.isIntersecting && !card.rendered) {
        card.rendered = true;
        mountSpectrogram(card.sg, card.creature, card.sg.clientWidth || 320, 84);
      }
      if (e.intersectionRatio > 0.6) {
        const wasNew = !get().discovered[card.creature.id];
        discover(card.creature.id);
        if (wasNew) {
          addXp(5);
          haptic(8);
          app.toast('🌿 ' + card.creature.name + ' rehomed to your grove');
          const wrQ = WREN_QUOTES[card.creature.id];
          const isDaily = todayCreature && card.creature.id === todayCreature.id;
          if (wrQ) {
            setTimeout(() => app.mentor('<b>Wren:</b> ' + wrQ, 9000), 900);
          } else if (card.creature.rare) {
            setTimeout(() => app.mentor('<b>Wren: Rare find.</b> ' + creatureEmoji(card.creature) + ' ' + card.creature.name + ' — only ' + Math.round(rarityPct(card.creature)) + '% of listeners ever find this one.', 8000), 800);
          }
          if (isDaily) {
            setTimeout(() => app.mentor('<b>Wren:</b> That\'s today\'s Sound of the Day. Can you name it blind? Try the <b>Daily Snap Challenge</b> 🎧', 7000), 5500);
          }
          const hit = checkMilestone();
          if (hit) setTimeout(() => app.milestone(hit), 1400);
          const colHit = checkCollectionComplete(CREATURES);
          if (colHit) setTimeout(() => app.collection(colHit), hit ? 5000 : 1800);
          const rankHit = checkRankUp();
          if (rankHit) {
            const RANK_LINES = {
              'Curious':     'You\'re now <b>Curious</b>. That\'s the hardest rank to earn — most people don\'t even start.',
              'Listener':    '🎧 <b>Listener.</b> Six sounds you can name on hearing. That\'s not nothing.',
              'Fieldworker': '🎤 <b>Fieldworker.</b> You\'re starting to separate signal from noise. Sixteen creatures — the field is opening up.',
              'Naturalist':  '🌿 <b>Naturalist.</b> Thirty-one sounds. You\'ve covered the main biomes. The world sounds different to you now.',
              'Recordist':   '📻 <b>Recordist.</b> Fifty-one sounds. At this level you\'re not just listening — you\'re archiving. The forest knows you.',
              'Ecologist':   '🌲 <b>Ecologist.</b> Seventy-six. I\'ve run out of things to teach you. Keep the haul running.',
            };
            const delay = (hit ? 8000 : colHit ? 8000 : 2200);
            const line = RANK_LINES[rankHit.title] || ('<b>' + rankHit.title + '</b>. Keep going.');
            setTimeout(() => app.mentor('<b>Wren:</b> ' + line, 10000), delay);
            track('rank_up', { rank: rankHit.title });
          }
          const q = getQuest();
          if (q.type === 'discover' && !q.done) {
            const n = bumpQuestDiscover();
            if (n >= q.goal) { markQuestDone(); addXp(75); app.mentor('<b>Quest complete!</b> +75 XP. Your ears are getting sharper every day. 🌿', 6000); track('quest_complete', { type: 'discover' }); }
          }
          const total2 = CREATURES.filter((c2) => !c2.isNoise).length;
          const found2 = Object.keys(get().discovered).length;
          const s3 = get();
          if (found2 >= total2 && !s3.endgameSeen) {
            s3.endgameSeen = true; save(); addXp(500);
            const endDelay = (hit || colHit || rankHit) ? 10000 : 2000;
            setTimeout(() => app.mentor('<b>Wren:</b> Every creature. Every continent. You\'ve archived the living world. But that 67 kHz signal is still out there — nobody\'s been able to name it. Keep the haul running.', 14000), endDelay);
            track('endgame_complete', { total: total2 });
          }
          if (app.checkThemeUnlock) app.checkThemeUnlock();
        }
        audio.play(card.creature).catch(() => {});
      }
    });
  }, { threshold: [0, 0.5, 0.6, 1] });
  cards.forEach((c) => io.observe(c.node));
  io.observe(sentinel);

  return () => { io.disconnect(); audio.stopAll(); root.remove(); };
}

function buildCard(c, app, isDaily, dailyDone, dailyTip) {
  const g = GROUPS[c.group];
  const node = el('div', { class: 'card', style: `background:radial-gradient(120% 80% at 50% 35%, ${hex(g.color, .22)} 0%, #0d1110 70%)` });

  node.appendChild(el('div', { class: 'grp', html: `<span style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block"></span> ${g.label} · ${c.region}` }));

  const stage = el('div', { class: 'stage' });
  const emoEl = el('div', { style: 'font-size:92px;line-height:1;user-select:none;filter:drop-shadow(0 2px 16px rgba(0,0,0,.4))' });
  emoEl.textContent = creatureEmoji(c);
  stage.appendChild(emoEl);
  node.appendChild(stage);
  if (isDaily) {
    const badgeText = dailyDone ? '✅ Sound of the Day — done' : '⭐ Sound of the Day';
    const badge = el('div', {
      class: 'daily-badge' + (dailyDone ? ' done' : ''),
      text: badgeText,
    });
    node.appendChild(badge);
  }
  if (c.rare) {
    const rareBadge = el('div', { class: 'rare-badge', text: '✨ Rare find' });
    node.appendChild(rareBadge);
  }

  // action rail
  const rail = el('div', { class: 'rail' });
  const like = el('button', { 'aria-label': 'Like', html: icon('heart', 26) + '<span>like</span>' });
  like.addEventListener('click', () => { like.classList.toggle('liked'); haptic(); track('feed_like', { id: c.id }); });
  const share = el('button', { 'aria-label': 'Share', html: icon('share', 24) + '<span>share</span>' });
  share.addEventListener('click', async () => {
    if (isDaily && !dailyDone) {
      const s = get();
      s.challengeDay = today(); save();
      addXp(25);
      app.mentor('<b>Daily Challenge!</b> +25 XP for sharing today\'s Sound of the Day 🌿', 6000);
      track('daily_challenge_complete', { id: c.id });
    }
    const url = challengeUrl(c.id);
    const text = 'Can you name this sound? 🎧 ' + url;
    try {
      if (navigator.share) await navigator.share({ title: 'Hark — name this sound', text, url });
      else await navigator.clipboard.writeText(text);
      track('feed_challenge_share', { id: c.id });
    } catch (e) {
      if (e.name !== 'AbortError') shareCreature(c, app);
    }
  });
  rail.appendChild(like); rail.appendChild(share);
  node.appendChild(rail);

  // foreground
  node.appendChild(el('h2', { text: c.name }));
  node.appendChild(el('div', { class: 'sub', text: prettyGroup(c) }));
  const sg = el('div', { class: 'specwrap' });
  node.appendChild(sg);

  const line = el('div', { class: 'playline' });
  const play = el('button', { class: 'playbtn', 'aria-label': 'Play', html: icon('play', 22) });
  play.addEventListener('click', () => { audio.unlock(); haptic(); audio.play(c); track('feed_play', { id: c.id }); });
  const idb = el('button', { class: 'idbtn', html: icon('ear', 18) + ' Tap to ID' });
  idb.addEventListener('click', () => { track('feed_tap_id', { id: c.id }); app.go('snap', { preferIds: [c.id] }); });
  line.appendChild(play); line.appendChild(idb);
  node.appendChild(line);

  if (isDaily && dailyTip) {
    const tipEl = el('div', { style: 'font-size:11px;color:rgba(62,201,159,.7);font-style:italic;margin:4px 0;padding:6px 10px;border-left:2px solid rgba(62,201,159,.3)', text: 'Wren: ' + dailyTip });
    node.appendChild(tipEl);
  }
  node.appendChild(el('div', { class: 'fact', text: c.fact }));
  if (c.author) {
    const credit = el('a', { class: 'fact', href: c.source || '#', target: '_blank', rel: 'noopener',
      style: 'opacity:.55;font-size:10.5px;margin-top:4px;color:inherit;text-decoration:underline;display:block',
      text: `rec ${String(c.author).replace(/\s+/g, ' ').trim()} · ${c.license} · ${c.sourceName || ''} (trimmed)` });
    node.appendChild(credit);
  }

  return { node, creature: c, sg, rendered: false };
}


function buildMysteryCard(creature, app) {
  const g = GROUPS[creature.group];
  const node = el('div', { class: 'card', style: `background:radial-gradient(120% 80% at 50% 35%, rgba(111,139,255,.15) 0%, #0d1110 70%);border:.5px solid rgba(111,139,255,.25)` });

  node.appendChild(el('div', { class: 'grp', html: `<span style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block"></span> ${g.label} · ???` }));

  const stage = el('div', { class: 'stage' });
  const emoEl = el('div', { style: 'font-size:92px;line-height:1;user-select:none;filter:drop-shadow(0 2px 16px rgba(0,0,0,.4)) blur(2px)' });
  emoEl.textContent = '❓';
  stage.appendChild(emoEl);
  node.appendChild(stage);

  const badge = el('div', { style: 'text-align:center;font-size:11px;font-weight:600;letter-spacing:.08em;color:#6f8bff;margin:-4px 0 8px', text: '🔮 MYSTERY SOUND · Changes weekly' });
  node.appendChild(badge);

  node.appendChild(el('h2', { text: '???' }));
  node.appendChild(el('div', { class: 'sub', text: 'Can you identify this sound?' }));

  const sg = el('div', { class: 'specwrap' });
  node.appendChild(sg);
  mountSpectrogram(sg, creature, 320, 84);

  const line = el('div', { class: 'playline' });
  const play = el('button', { class: 'playbtn', 'aria-label': 'Play', html: icon('play', 22) });
  play.addEventListener('click', () => { audio.unlock(); haptic(); audio.play(creature); track('mystery_play', { id: creature.id }); });
  const idb = el('button', { class: 'idbtn', style: 'background:rgba(111,139,255,.18);border-color:rgba(111,139,255,.4)', html: icon('ear', 18) + ' Name this sound' });
  idb.addEventListener('click', () => { track('mystery_snap', { id: creature.id }); app.go('snap', { preferIds: [creature.id] }); });
  line.appendChild(play); line.appendChild(idb);
  node.appendChild(line);

  node.appendChild(el('div', { class: 'fact', style: 'color:rgba(111,139,255,.6);font-style:italic', text: 'Listen carefully. The spectrogram holds clues. Take it to Snap when you\'re ready.' }));

  track('mystery_shown', { id: creature.id });
  return node;
}

const FIELD_LOG = [
  { title: 'Dawn recording, day 4', body: 'Set up at 4:47 AM. First bird at 4:52 — a robin, always a robin. By 5:10 there were eleven species overlapping. The mic can\'t separate them the way the ear can. That\'s the gap I keep trying to close.', tag: 'recording' },
  { title: 'On silence', body: 'Recorded four hours of "silence" in a hemlock stand. Playing it back: 340 distinct sound events. Wind through different needle densities. A beetle walking on bark. My own heartbeat through the ground. Silence is a frequency we haven\'t learned to hear yet.', tag: 'philosophy' },
  { title: 'The fox problem', body: 'Three nights staking out a fox den. First night: nothing. Second night: a scream at 2 AM that stopped my heart. Third night: I realized the fox had been watching me the whole time. It screamed when it got bored of my company.', tag: 'fieldwork' },
  { title: 'Spectrogram notes', body: 'A student asked why spectrograms look "wrong." They don\'t. Your eyes are just used to seeing horizontally. Sound moves in time, pitch moves in frequency. The spectrogram is a photograph of something your ears already see perfectly.', tag: 'technique' },
  { title: 'Rain delay', body: 'Rain cancels most recording sessions. But rain on different surfaces — tin, leaves, water, sand — those are some of the most requested sounds in the archive. Geophony doesn\'t care about your schedule.', tag: 'weather' },
  { title: 'Nighthawk watch', body: 'The nighthawk\'s wing-boom isn\'t a call. It\'s air over feathers during a dive — a sound made by architecture, not intention. The bird didn\'t evolve to make it. It evolved to fly, and the sound followed. Most of the best sounds are accidents.', tag: 'biology' },
  { title: 'On mastery', body: 'A colleague can identify 400 species by ear. I asked how long it took. "Twenty years and one good teacher." The teacher was a blind ornithologist who never saw a bird in her life but could name any song within three notes.', tag: 'story' },
  { title: 'Equipment list', body: 'People ask about my mic. It\'s a $200 shotgun condenser from 2014. The $3,000 parabolic I bought in 2018 sits in a closet. The best microphone is the one you carry, pointed at something interesting.', tag: 'gear' },
  { title: 'Wolf notes', body: 'Spent a week with a bioacoustics team tracking wolves. Each pack has a unique harmonic signature — the wolves deliberately shift pitch to avoid matching each other. It makes four wolves sound like twelve. Deception through harmony.', tag: 'fieldwork' },
  { title: 'The 67 kHz question', body: 'Found it on a recording from 2019. 67 kHz — well above human hearing, but the equipment caught it. Consistent, patterned, biological. Not bat, not dolphin, not insect. Three labs have looked at it. Nobody can name it. I listen to it every week.', tag: 'mystery' },
  { title: 'Spring migration', body: 'The first warbler showed up today. I heard it before I saw it — a thin, rising note from the top of a dead ash. By next week there will be twenty species that weren\'t here yesterday. The air changes flavor during migration.', tag: 'season' },
  { title: 'On listening', body: 'The difference between hearing and listening is the same as the difference between seeing and reading. One happens automatically. The other is a skill you build, lose, and rebuild, every day, for the rest of your life.', tag: 'philosophy' },
  { title: 'Cicada emergence', body: 'Measured a cicada chorus at 96 dB from thirty feet. That\'s louder than a motorcycle. Each individual tymbal clicks 300 times per second. The sound has been described as "screaming in unison." I\'d call it a collective prayer for continuity.', tag: 'biology' },
  { title: 'Winter recording', body: 'Cold air carries sound farther. A great horned owl I recorded in January was audible from 1.2 miles. In July, the same owl at the same distance would disappear into the insect floor. Winter is the long-distance listener\'s season.', tag: 'technique' },
];

function buildFieldLog(dayN) {
  const entry = FIELD_LOG[dayN % FIELD_LOG.length];
  const node = el('div', { class: 'card', style: 'background:radial-gradient(120% 80% at 50% 35%, rgba(62,201,159,.05) 0%, #0d1110 70%);border:.5px solid rgba(62,201,159,.15);padding:22px 20px' });
  node.appendChild(el('div', { style: 'font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--teal);margin-bottom:10px', text: 'WREN\'S FIELD LOG · #' + (dayN % FIELD_LOG.length + 1) }));
  node.appendChild(el('div', { style: 'font-size:16px;font-weight:600;color:var(--ink);margin-bottom:8px', text: entry.title }));
  node.appendChild(el('div', { style: 'font-size:13px;color:rgba(238,243,240,.75);line-height:1.7;font-style:italic', text: entry.body }));
  node.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);margin-top:10px;letter-spacing:.04em', text: '#' + entry.tag }));
  return node;
}

function buildWelcomeBack(app, s, daysAway) {
  const disc = Object.keys(s.discovered).length;
  const total = CREATURES.filter((c) => !c.isNoise).length;
  const remaining = total - disc;
  const mastered = Object.values(s.crowns).filter((v) => v >= 3).length;
  const streak = s.streak || 0;
  const best = s.longestStreak || streak;
  const lines = [
    'The field never stops recording.',
    'Every species kept singing while you were away.',
    'Silence doesn\'t mean nothing happened.',
    'The forest noticed you were gone.',
  ];
  const line = lines[daysAway % lines.length];

  const node = el('div', { class: 'card', style: 'background:radial-gradient(120% 80% at 50% 35%, rgba(62,201,159,.08) 0%, #0d1110 70%);border:.5px solid rgba(62,201,159,.2);display:flex;flex-direction:column;align-items:center;padding:28px 20px;gap:8px' });
  node.appendChild(el('div', { style: 'font-size:10px;font-weight:600;letter-spacing:.1em;color:var(--teal)', text: 'WELCOME BACK' }));
  const emo = el('div', { style: 'font-size:48px;line-height:1;margin:4px 0' });
  emo.textContent = '🌿';
  node.appendChild(emo);
  node.appendChild(el('div', { style: 'font-size:15px;font-weight:600;color:var(--ink);text-align:center', text: daysAway + ' days away' }));
  node.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);text-align:center;font-style:italic;max-width:260px;margin-bottom:4px', text: line }));

  const stats = el('div', { style: 'display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin:6px 0' });
  const stat = (val, label) => {
    const s2 = el('div', { style: 'text-align:center' });
    s2.appendChild(el('div', { style: 'font-size:18px;font-weight:700;color:var(--ink)', text: String(val) }));
    s2.appendChild(el('div', { style: 'font-size:10px;color:var(--muted)', text: label }));
    return s2;
  };
  stats.appendChild(stat(disc, 'found'));
  stats.appendChild(stat(remaining, 'remaining'));
  if (mastered > 0) stats.appendChild(stat(mastered, 'mastered'));
  if (best > 1) stats.appendChild(stat(best, 'best streak'));
  node.appendChild(stats);

  const cta = el('button', { class: 'cta', text: '🎧 Start a new streak' });
  cta.addEventListener('click', () => { track('welcome_back_snap'); app.go('snap'); });
  node.appendChild(cta);

  track('welcome_back_shown', { days: daysAway, disc });
  return node;
}

function buildSnapPullCard(app) {
  const node = el('div', { class: 'card', style: 'background:radial-gradient(120% 80% at 50% 35%, rgba(62,201,159,.08) 0%, #0d1110 70%);border:.5px solid rgba(62,201,159,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:40px 24px;min-height:220px' });
  const emo = el('div', { style: 'font-size:52px;line-height:1' });
  emo.textContent = '👂';
  node.appendChild(emo);
  node.appendChild(el('h2', { text: 'Can you name them?', style: 'font-size:19px;font-weight:600;text-align:center;margin:0' }));
  node.appendChild(el('p', { text: 'You\'ve heard these sounds. Spectrogram Snap tests if you\'ve learned them.', style: 'font-size:13px;color:var(--muted);text-align:center;max-width:260px;margin:0' }));
  const btn = el('button', { class: 'cta', text: 'Play Snap →', style: 'margin-top:4px' });
  btn.addEventListener('click', () => { track('feed_snap_pull'); app.go('snap'); });
  node.appendChild(btn);
  return node;
}

function prettyGroup(c) {
  const map = { koala: 'mating bellow', lyrebird: 'mimic song', barredowl: 'territorial hoot',
    treefrog: 'two-part call', cicada: 'tymbal drone', humpback: 'song phrase',
    foxscream: 'night scream', wind: 'geophony', springpeeper: 'breeding call',
    wren: 'torrent song', nighthawk: 'peent + wing-boom', engine: 'anthrophony' };
  return map[c.id] || 'wild sound';
}


function hex(h, a) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
