// Hark — viral share card. Canvas-generated image for iMessage, Instagram, Twitter.
import { getRank } from './rank.js';
import { get } from './state.js';
import { shareUrl, challengeUrl, track } from './analytics.js';
import { creatureEmoji } from './content.js';

export async function shareCreature(creature, app) {
  const s = get();
  const discovered = Object.keys(s.discovered).length;
  const rank = getRank(discovered);
  const emo = creatureEmoji(creature);

  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Dark forest gradient
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0d1f1b');
  grad.addColorStop(1, '#060e0b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(62,201,159,0.06)';
  ctx.lineWidth = 1;
  for (let y = 40; y < size; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }

  // HARK wordmark
  ctx.font = '500 13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#3ec99f';
  ctx.textAlign = 'left';
  ctx.fillText('HARK', 28, 44);

  // Rank badge
  ctx.textAlign = 'right';
  ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(rank.emoji + ' ' + rank.title, size - 28, 44);

  // Creature emoji — large, centered
  ctx.textAlign = 'center';
  ctx.font = '110px serif';
  ctx.fillText(emo, size / 2, 218);

  // Creature name
  ctx.font = '600 26px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#eef3f0';
  ctx.fillText(creature.name, size / 2, 284);

  // Region / group
  ctx.font = '13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(159,178,170,0.75)';
  ctx.fillText(creature.region || '', size / 2, 310);

  // Teal divider
  ctx.beginPath();
  ctx.moveTo(size / 2 - 44, 336);
  ctx.lineTo(size / 2 + 44, 336);
  ctx.strokeStyle = '#3ec99f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Streak + discovered count
  ctx.font = '13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(224,164,77,0.8)';
  ctx.fillText('🔥 ' + s.streak + '-day streak · ' + discovered + ' creatures found', size / 2, 372);

  // Footer
  ctx.fillStyle = 'rgba(159,178,170,0.5)';
  ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Can you name this sound? → hark-beta', size / 2, 416);

  track('share_card', { id: creature.id });

  const url = challengeUrl(creature.id);
  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'hark-' + creature.id + '.png', { type: 'image/png' });
    const text = 'Can you name this wild sound? 🎧 ' + url;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Hark — ' + creature.name, text, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: 'Hark', text, url });
    } else {
      showShareOverlay(canvas, url);
    }
  } catch (e) {
    if (e.name !== 'AbortError') showShareOverlay(canvas, url);
  }
}

export async function shareStreak(streak, app) {
  const s = get();
  const discovered = Object.keys(s.discovered).length;
  const rank = getRank(discovered);

  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0d1f1b'); grad.addColorStop(1, '#060e0b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);

  // Flame grid pattern
  ctx.strokeStyle = 'rgba(224,164,77,0.04)';
  ctx.lineWidth = 1;
  for (let y = 40; y < size; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }

  ctx.font = '500 13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#3ec99f'; ctx.textAlign = 'left';
  ctx.fillText('HARK', 28, 44);

  ctx.textAlign = 'right'; ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(rank.emoji + ' ' + rank.title, size - 28, 44);

  ctx.textAlign = 'center';
  ctx.font = '96px serif';
  ctx.fillText('🔥', size / 2, 210);

  ctx.font = '700 52px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#e0a44d';
  ctx.fillText(streak + ' days', size / 2, 282);

  ctx.font = '500 18px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(238,243,240,0.75)';
  ctx.fillText('in the wild', size / 2, 316);

  ctx.beginPath();
  ctx.moveTo(size / 2 - 44, 344); ctx.lineTo(size / 2 + 44, 344);
  ctx.strokeStyle = '#e0a44d'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.font = '13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(159,178,170,0.7)';
  ctx.fillText(discovered + ' creatures heard · ' + discovered + ' rehomed', size / 2, 378);

  ctx.fillStyle = 'rgba(159,178,170,0.5)'; ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Join the wild — snixdorff-netizen.github.io/hark-beta/', size / 2, 420);

  track('streak_share', { streak, discovered });

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'hark-streak-' + streak + '.png', { type: 'image/png' });
    const url = shareUrl();
    const text = '🔥 ' + streak + ' days straight in the wild on Hark. Can you keep up? ' + url;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Hark — ' + streak + ' day streak', text, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: 'Hark', text, url });
    } else {
      showShareOverlay(canvas, url);
    }
  } catch (e) {
    if (e.name !== 'AbortError') showShareOverlay(canvas, shareUrl());
  }
}

export async function shareGrove(discovered, s, app) {
  const rank = getRank(discovered.length);
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#0d1f1b'); grad.addColorStop(1, '#060e0b');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(62,201,159,0.05)';
  ctx.lineWidth = 1;
  for (let y = 40; y < size; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke(); }

  ctx.font = '500 13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#3ec99f'; ctx.textAlign = 'left';
  ctx.fillText('HARK', 28, 44);
  ctx.textAlign = 'right'; ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(rank.emoji + ' ' + rank.title, size - 28, 44);

  // Grove heading
  ctx.textAlign = 'center';
  ctx.font = '600 18px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(238,243,240,0.9)';
  ctx.fillText('My Grove', size / 2, 86);

  // Emoji mosaic — up to 25 creatures in a 5-column grid
  const toShow = discovered.slice(0, 25);
  const cols = 5;
  const cellW = 76, cellH = 72;
  const startX = (size - cols * cellW) / 2 + cellW / 2;
  const startY = 116;
  ctx.font = '36px serif';
  toShow.forEach((c, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    if (c.rare) {
      ctx.save();
      ctx.shadowColor = '#6f8bff'; ctx.shadowBlur = 14;
    }
    ctx.fillText(creatureEmoji(c), x, y);
    if (c.rare) ctx.restore();
    const crowns = s.crowns[c.id] || 0;
    if (crowns > 0) {
      ctx.font = '10px serif';
      ctx.fillText('★'.repeat(crowns), x, y + 18);
      ctx.font = '36px serif';
    }
  });

  if (discovered.length > 25) {
    ctx.font = '12px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(159,178,170,0.55)';
    ctx.textAlign = 'center';
    ctx.fillText('+' + (discovered.length - 25) + ' more', size / 2, startY + Math.ceil(toShow.length / cols) * cellH + 10);
  }

  ctx.beginPath();
  ctx.moveTo(64, 418); ctx.lineTo(size - 64, 418);
  ctx.strokeStyle = 'rgba(62,201,159,0.25)'; ctx.lineWidth = 1; ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = '13px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(159,178,170,0.75)';
  ctx.fillText(discovered.length + '/93 sounds found · 🔥 ' + s.streak + '-day streak', size / 2, 440);

  ctx.font = '11px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = 'rgba(159,178,170,0.4)';
  ctx.fillText('snixdorff-netizen.github.io/hark-beta/', size / 2, 466);

  track('grove_share', { count: discovered.length });

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'hark-grove.png', { type: 'image/png' });
    const url = shareUrl();
    const text = 'I\'ve found ' + discovered.length + '/93 wild sounds on Hark 🌿 ' + url;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'My Hark Grove', text, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: 'Hark', text, url });
    } else {
      showShareOverlay(canvas, url);
    }
  } catch (e) {
    if (e.name !== 'AbortError') showShareOverlay(canvas, shareUrl());
  }
}

function showShareOverlay(canvas, url) {
  const host = document.getElementById('app');
  const ovl = document.createElement('div');
  ovl.className = 'share-ovl';
  ovl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;z-index:9999;padding:24px';
  ovl.addEventListener('click', (e) => { if (e.target === ovl) ovl.remove(); });

  canvas.style.cssText = 'border-radius:16px;max-width:min(300px,80vw);max-height:min(300px,80vw);width:100%;height:auto;box-shadow:0 8px 40px rgba(0,0,0,.6)';
  ovl.appendChild(canvas);

  const hint = document.createElement('p');
  hint.style.cssText = 'color:rgba(255,255,255,.55);font-size:13px;text-align:center;margin:0;font-family:-apple-system,sans-serif';
  hint.textContent = 'Screenshot to share 📸';
  ovl.appendChild(hint);

  const close = document.createElement('button');
  close.textContent = 'Done';
  close.style.cssText = 'color:rgba(255,255,255,.45);font-size:13px;padding:10px 24px;border:none;background:none;font-family:-apple-system,sans-serif;cursor:pointer';
  close.addEventListener('click', () => ovl.remove());
  ovl.appendChild(close);
  host.appendChild(ovl);
}
