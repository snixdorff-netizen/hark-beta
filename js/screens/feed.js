// Hark — the Wild Feed. A swipeable scroll of wild sounds. Delight first; the
// micro-game (Tap to ID) is woven into the scroll; every card is shareable.
import { el, clear, icon, haptic } from '../ui.js';
import { mountSpectrogram } from '../spectrogram.js';
import * as audio from '../audio.js';
import { viralFeed, GROUPS } from '../content.js';
import { discover } from '../state.js';
import { track, shareUrl } from '../analytics.js';

export function mount(host, app) {
  const root = el('div', { class: 'screen' });
  const feed = el('div', { class: 'feed' });
  root.appendChild(feed);
  host.appendChild(root);

  const list = viralFeed();
  const cards = list.map((c) => buildCard(c, app));
  cards.forEach((c) => feed.appendChild(c.node));

  // autoplay the centered card (if audio already unlocked), and discover it
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.intersectionRatio > 0.6) {
        const idx = cards.findIndex((c) => c.node === e.target);
        if (idx >= 0) {
          discover(cards[idx].creature.id);
          audio.play(cards[idx].creature).catch(() => {});
        }
      }
    });
  }, { threshold: [0, 0.6, 1] });
  cards.forEach((c) => io.observe(c.node));

  return () => { io.disconnect(); audio.stopAll(); root.remove(); };
}

function buildCard(c, app) {
  const g = GROUPS[c.group];
  const node = el('div', { class: 'card', style: `background:radial-gradient(120% 80% at 50% 35%, ${hex(g.color, .22)} 0%, #0d1110 70%)` });

  node.appendChild(el('div', { class: 'grp', html: `<span style="width:8px;height:8px;border-radius:50%;background:${g.color};display:inline-block"></span> ${g.label} · ${c.region}` }));

  // soft stage halo
  const stage = el('div', { class: 'stage' });
  stage.appendChild(el('div', { style: `width:200px;height:200px;border-radius:50%;background:${hex(g.color,.10)};filter:blur(6px)` }));
  node.appendChild(stage);

  // action rail
  const rail = el('div', { class: 'rail' });
  const like = el('button', { 'aria-label': 'Like', html: icon('heart', 26) + '<span>like</span>' });
  like.addEventListener('click', () => { like.classList.toggle('liked'); haptic(); track('feed_like', { id: c.id }); });
  const share = el('button', { 'aria-label': 'Share', html: icon('share', 24) + '<span>share</span>' });
  share.addEventListener('click', () => doShare(c));
  rail.appendChild(like); rail.appendChild(share);
  node.appendChild(rail);

  // foreground
  node.appendChild(el('h2', { text: c.name }));
  node.appendChild(el('div', { class: 'sub', text: prettyGroup(c) }));
  const sg = el('div', { class: 'specwrap' });
  node.appendChild(sg);
  requestAnimationFrame(() => mountSpectrogram(sg, c, sg.clientWidth || 320, 84));

  const line = el('div', { class: 'playline' });
  const play = el('button', { class: 'playbtn', 'aria-label': 'Play', html: icon('play', 22) });
  play.addEventListener('click', () => { audio.unlock(); haptic(); audio.play(c); track('feed_play', { id: c.id }); });
  const idb = el('button', { class: 'idbtn', html: icon('ear', 18) + ' Tap to ID' });
  idb.addEventListener('click', () => { track('feed_tap_id', { id: c.id }); app.go('snap', { preferIds: [c.id] }); });
  line.appendChild(play); line.appendChild(idb);
  node.appendChild(line);

  node.appendChild(el('div', { class: 'fact', text: c.fact }));

  return { node, creature: c };
}

function prettyGroup(c) {
  const map = { koala: 'mating bellow', lyrebird: 'mimic song', barredowl: 'territorial hoot',
    treefrog: 'two-part call', cicada: 'tymbal drone', humpback: 'song phrase',
    foxscream: 'night scream', wind: 'geophony', springpeeper: 'breeding call',
    wren: 'torrent song', nighthawk: 'peent + wing-boom', engine: 'anthrophony' };
  return map[c.id] || 'wild sound';
}

async function doShare(c) {
  track('feed_share', { id: c.id });
  const url = shareUrl();
  const text = `${c.name} — heard it on Hark 🌿 ${url}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Hark', text, url });
    else { await navigator.clipboard.writeText(text); }
  } catch (e) {}
  haptic();
}

function hex(h, a) {
  const n = parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
