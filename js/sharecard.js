// Hark — viral share card. Canvas-generated image for iMessage, Instagram, Twitter.
import { getRank } from './rank.js';
import { get } from './state.js';
import { shareUrl, track } from './analytics.js';
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
  ctx.fillText('Can you find one? snixdorff-netizen.github.io/hark-beta/', size / 2, 416);

  track('share_card', { id: creature.id });

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'hark-' + creature.id + '.png', { type: 'image/png' });
    const url = shareUrl();
    const text = 'I found a ' + creature.name + ' on Hark 🌿 Can you hear one? ' + url;
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'Hark — ' + creature.name, text, files: [file] });
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
