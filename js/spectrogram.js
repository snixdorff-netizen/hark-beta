// Hark — spectrogram renderer.
// For synth placeholders: draws from the SAME recipe the audio engine plays.
// For real licensed clips (creature.clip): computes a true STFT spectrogram from
// the decoded audio, so the picture still matches the sound.
import * as audio from './audio.js';

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

// ---- real-audio spectrogram (STFT) -----------------------------------------
const clipCache = new Map(); // id@WxH -> source canvas

// in-place iterative radix-2 FFT
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { const tr = re[i]; re[i] = re[j]; re[j] = tr; const ti = im[i]; im[i] = im[j]; im[j] = ti; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cwr - im[i + k + len / 2] * cwi;
        const bi = re[i + k + len / 2] * cwi + im[i + k + len / 2] * cwr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const n2 = cwr * wr - cwi * wi; cwi = cwr * wi + cwi * wr; cwr = n2;
      }
    }
  }
}

function computeSpectrogramCanvas(buffer, w, h) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const N = 1024, half = N / 2;
  const cols = Math.min(240, Math.max(80, w | 0));
  const hop = Math.max(1, Math.floor((data.length - N) / (cols - 1)));
  const hann = new Float32Array(N);
  for (let i = 0; i < N; i++) hann[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));

  const mags = []; let peak = 1e-9;
  for (let c = 0; c < cols; c++) {
    const start = c * hop;
    const re = new Float32Array(N), im = new Float32Array(N);
    for (let i = 0; i < N; i++) { const s = data[start + i] || 0; re[i] = s * hann[i]; }
    fft(re, im);
    const col = new Float32Array(half);
    for (let k = 0; k < half; k++) { const m = Math.hypot(re[k], im[k]); col[k] = m; if (m > peak) peak = m; }
    mags.push(col);
  }

  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#0d1f1b'; ctx.fillRect(0, 0, w, h);

  const colW = w / cols;
  const logPeak = Math.log(peak + 1e-9);
  for (let c = 0; c < cols; c++) {
    const col = mags[c];
    for (let k = 1; k < half; k++) {
      const f = k * sr / N;
      if (f < FMIN || f > FMAX) continue;
      const db = (Math.log(col[k] + 1e-9) - logPeak); // <=0
      const a = Math.max(0, 1 + db / 6.5); // ~ -6.5 log-units dynamic range
      if (a < 0.04) continue;
      const y = freqToY(f, h);
      const yNext = freqToY((k + 1) * sr / N, h);
      const bh = Math.max(1, Math.abs(y - yNext) + 0.6);
      ctx.fillStyle = `rgba(62,201,159,${Math.min(0.95, a)})`;
      ctx.fillRect(c * colW, y - bh, colW + 0.6, bh);
    }
  }
  return canvas;
}

function drawnCopy(src, w, h) {
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function renderClipSpectrogram(creature, w, h) {
  const key = `${creature.id}@${w}x${h}`;
  if (clipCache.has(key)) return drawnCopy(clipCache.get(key), w, h);
  const buffer = await audio.decode(creature);
  const src = computeSpectrogramCanvas(buffer, w, h);
  clipCache.set(key, src);
  return drawnCopy(src, w, h);
}

// Mount a spectrogram. For real clips: show a placeholder immediately, then swap
// in the true STFT image once decoded (cached thereafter).
export function mountSpectrogram(container, creature, w, h) {
  container.innerHTML = '';
  if (creature.clip) {
    const placeholder = creature.events
      ? renderSpectrogram(creature, w, h)
      : (() => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.style.width = w + 'px'; cv.style.height = h + 'px'; const cx = cv.getContext('2d'); cx.fillStyle = '#0d1f1b'; cx.fillRect(0, 0, w, h); return cv; })();
    container.appendChild(placeholder);
    renderClipSpectrogram(creature, w, h)
      .then((cv) => { container.innerHTML = ''; container.appendChild(cv); })
      .catch(() => {});
  } else {
    container.appendChild(renderSpectrogram(creature, w, h));
  }
}
