// Hark — spectrogram renderer. Draws a time×frequency heatmap from the SAME
// recipe the audio engine plays, so the image always matches the sound.

const FMIN = 120;
const FMAX = 18000;
const logMin = Math.log(FMIN);
const logSpan = Math.log(FMAX) - logMin;

function freqToY(f, h) {
  const c = (Math.log(Math.max(FMIN, Math.min(FMAX, f))) - logMin) / logSpan;
  return h * (1 - c);
}

// soft teal heat ramp on dark panel
function paint(ctx, x, y, w, h, a) {
  ctx.fillStyle = `rgba(62,201,159,${Math.min(0.95, a)})`;
  ctx.fillRect(x, y, w, h);
}

export function renderSpectrogram(creature, w, h) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0d1f1b';
  ctx.fillRect(0, 0, w, h);

  const dur = creature.duration || 2.5;
  const cols = Math.max(80, Math.floor(w));
  const colW = w / cols;

  for (const ev of creature.events) {
    const x0 = (ev.t / dur) * w;
    const x1 = ((ev.t + ev.dur) / dur) * w;
    const gain = (ev.gain ?? 0.4);
    for (let cx = Math.floor(x0); cx < x1; cx++) {
      const frac = (cx / w * dur - ev.t) / ev.dur; // 0..1 within event
      if (frac < 0 || frac > 1) continue;
      const fade = Math.sin(Math.min(1, Math.max(0, frac)) * Math.PI); // soft attack/decay
      const a = gain * (0.35 + 0.65 * fade);

      if (ev.type === 'noise') {
        const yTop = freqToY(ev.f1 || 2000, h);
        const yBot = freqToY(ev.f0 || 300, h);
        // speckled broadband
        let s = (cx * 2654435761) >>> 0;
        for (let y = yTop; y < yBot; y += 2) {
          s = (s * 1664525 + 1013904223) >>> 0;
          const jitter = (s % 100) / 100;
          if (jitter > 0.45) paint(ctx, cx, y, colW + 0.6, 2, a * 0.5 * jitter);
        }
      } else {
        let f;
        if (ev.type === 'sweep' || ev.type === 'chirp') {
          f = ev.f0 * Math.pow((ev.f1 || ev.f0) / ev.f0, frac);
        } else {
          f = ev.f0;
        }
        const drawBand = (freq, intensity) => {
          const y = freqToY(freq, h);
          const band = 3.5;
          paint(ctx, cx, y - band, colW + 0.8, band * 2, intensity);
          paint(ctx, cx, y - band * 2, colW + 0.8, band, intensity * 0.4);
          paint(ctx, cx, y + band, colW + 0.8, band, intensity * 0.4);
        };
        drawBand(f, a);
        const harm = ev.harm || 0;
        for (let hh = 2; hh <= Math.min(4, harm); hh++) drawBand(f * hh, a / (hh * 1.6));
      }
    }
  }
  return canvas;
}

// Convenience: mount a fresh spectrogram into a container element.
export function mountSpectrogram(container, creature, w, h) {
  container.innerHTML = '';
  container.appendChild(renderSpectrogram(creature, w, h));
}
