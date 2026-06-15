// Hark — the Wild Feed. A swipeable scroll of wild sounds. Delight first; the
// micro-game (Tap to ID) is woven into the scroll; every card is shareable.
import { el, clear, icon, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { viralFeed, GROUPS, creatureEmoji } from '../content.js';
import { get, discover, addXp, save, today } from '../state.js';
import { track, shareUrl } from '../analytics.js';
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

  const list = viralFeed();
  const s = get();
  const dailyDone = s.challengeDay === today();
  const cards = list.map((c, i) => buildCard(c, app, i === 0, dailyDone, i === 0 ? dailyTip : null));
  cards.forEach((c) => feed.appendChild(c.node));

  // Lazy: only render a card's spectrogram (and decode its clip) when it nears
  // view — so 100+ clips don't all decode at once. Autoplay the centered card.
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const card = cards.find((c) => c.node === e.target);
      if (!card) return;
      if (e.isIntersecting && !card.rendered) {
        card.rendered = true;
        mountSpectrogram(card.sg, card.creature, card.sg.clientWidth || 320, 84);
      }
      if (e.intersectionRatio > 0.6) {
        discover(card.creature.id);
        audio.play(card.creature).catch(() => {});
      }
    });
  }, { threshold: [0, 0.5, 0.6, 1] });
  cards.forEach((c) => io.observe(c.node));

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
  share.addEventListener('click', () => {
    if (isDaily && !dailyDone) {
      const s = get();
      s.challengeDay = today(); save();
      addXp(25);
      app.mentor('<b>Daily Challenge!</b> +25 XP for sharing today\'s Sound of the Day 🌿', 6000);
      track('daily_challenge_complete', { id: c.id });
    }
    shareCreature(c, app);
    track('feed_share', { id: c.id });
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
