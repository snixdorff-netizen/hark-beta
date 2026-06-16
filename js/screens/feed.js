// Hark — the Wild Feed. A swipeable scroll of wild sounds. Delight first; the
// micro-game (Tap to ID) is woven into the scroll; every card is shareable.
import { el, clear, icon, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { viralFeed, CREATURES, GROUPS, creatureEmoji, rarityPct, seededShuffle } from '../content.js';
import { get, discover, addXp, save, today, getQuest, bumpQuestDiscover, markQuestDone, checkMilestone, checkCollectionComplete } from '../state.js';
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

  let cards = baseList.map((c, i) => buildCard(c, app, i === 0, dailyDone, i === 0 ? dailyTip : null));
  cards.forEach((c, i) => {
    feed.appendChild(c.node);
    if (i === 3) feed.appendChild(buildSnapPullCard(app));
  });

  // Sentinal sentinel div at the bottom — when it enters view, append another loop pass
  let loopPass = 0;
  const sentinel = el('div', { style: 'height:1px' });
  feed.appendChild(sentinel);

  function appendLoop() {
    loopPass++;
    const sep = el('div', { style: 'text-align:center;padding:32px 0 16px;font-size:12px;color:rgba(159,178,170,0.45);letter-spacing:.08em' });
    sep.textContent = '— back at the top —';
    feed.insertBefore(sep, sentinel);
    const seed = loopPass * 7919;
    const shuffled = seededShuffle(baseList.filter((c) => !c.isNoise), seed);
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
          app.toast('🌿 ' + card.creature.name + ' rehomed to your grove');
          if (card.creature.rare) {
            setTimeout(() => app.mentor('<b>Wren: Rare find.</b> ' + creatureEmoji(card.creature) + ' ' + card.creature.name + ' — only ' + Math.round(rarityPct(card.creature)) + '% of listeners ever find this one.', 8000), 800);
          }
          const hit = checkMilestone();
          if (hit) setTimeout(() => app.milestone(hit), 1400);
          const colHit = checkCollectionComplete(CREATURES);
          if (colHit) setTimeout(() => app.collection(colHit), hit ? 5000 : 1800);
          const q = getQuest();
          if (q.type === 'discover' && !q.done) {
            const n = bumpQuestDiscover();
            if (n >= q.goal) { markQuestDone(); addXp(75); app.mentor('<b>Quest complete!</b> +75 XP. Your ears are getting sharper every day. 🌿', 6000); track('quest_complete', { type: 'discover' }); }
          }
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

function buildQuestCard(app) {
  const q = getQuest();
  const QUEST_META = {
    snap:     { icon: '👂', label: 'Play Snap',     desc: `Play ${q.goal} rounds of Snap today`, action: () => app.go('snap') },
    discover: { icon: '🌿', label: 'Explore sounds', desc: `Discover ${q.goal} new sounds in the feed`, action: null },
    challenge: { icon: '🎧', label: 'Challenge a friend', desc: 'Send a sound challenge to a friend today', action: () => app.go('feed') },
  };
  const meta = QUEST_META[q.type];
  const pct = Math.min(1, q.progress / q.goal);
  const done = q.done || q.progress >= q.goal;

  const node = el('div', { style: 'background:rgba(62,201,159,.07);border:.5px solid rgba(62,201,159,.2);border-radius:16px;padding:14px 16px' });
  const header = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' });
  const badge = el('div', { style: 'font-size:13px;font-weight:600;color:var(--teal);letter-spacing:.04em', text: "TODAY'S MISSION" });
  if (done) {
    const tick = el('div', { style: 'margin-left:auto;font-size:12px;color:var(--teal);font-weight:600', text: '✓ Complete +75 XP' });
    header.appendChild(badge); header.appendChild(tick);
  } else {
    header.appendChild(badge);
  }
  node.appendChild(header);

  const body = el('div', { style: 'display:flex;align-items:center;gap:10px' });
  const emoDiv = el('div', { style: 'font-size:28px;line-height:1;flex-shrink:0' });
  emoDiv.textContent = meta.icon;
  body.appendChild(emoDiv);
  const right = el('div', { style: 'flex:1;min-width:0' });
  right.appendChild(el('div', { style: 'font-size:14px;font-weight:600;color:var(--ink)', text: meta.label }));
  right.appendChild(el('div', { style: 'font-size:12px;color:var(--muted);margin-top:1px', text: meta.desc }));
  // Progress bar
  const bar = el('div', { style: 'height:4px;background:rgba(62,201,159,.15);border-radius:2px;margin-top:8px;overflow:hidden' });
  const fill = el('div', { style: `height:100%;width:${Math.round(pct * 100)}%;background:var(--teal);border-radius:2px;transition:width .4s` });
  bar.appendChild(fill);
  right.appendChild(bar);
  right.appendChild(el('div', { style: 'font-size:10px;color:var(--muted);margin-top:3px', text: done ? 'Done for today' : `${q.progress}/${q.goal}` }));
  body.appendChild(right);
  if (!done && meta.action) {
    const btn = el('button', { style: 'padding:6px 12px;border-radius:20px;background:rgba(62,201,159,.15);border:.5px solid rgba(62,201,159,.3);color:var(--teal);font-size:12px;font-weight:600;flex-shrink:0;cursor:pointer', text: 'Go →' });
    btn.addEventListener('click', meta.action);
    body.appendChild(btn);
  }
  node.appendChild(body);
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
