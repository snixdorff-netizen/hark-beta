// Hark — tiny UI helpers (no framework).

export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'style') n.setAttribute('style', v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

const ICONS = {
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
  heart: '<path d="M12 21s-7.5-4.6-9.6-9C.8 8.6 2.4 5 6 5c2 0 3.2 1.2 4 2.3C10.8 6.2 12 5 14 5c3.6 0 5.2 3.6 3.6 7-2.1 4.4-9.6 9-9.6 9z"/>',
  share: '<path d="M14 9V5l7 7-7 7v-4C8 12 5 14 3 18c0-7 4-9 11-9z"/>',
  flame: '<path d="M12 2c1 3-2 4-2 7a2 2 0 104 0c2 2 3 4 3 6a5 5 0 11-10 0c0-4 4-6 5-13z"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  sparkle: '<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>',
  leaf: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19c2-4 5-7 9-9"/>',
  moon: '<path d="M20 14A8 8 0 119 3a7 7 0 1011 11z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  wave: '<path d="M2 12c1.5-4 3-6 5-6s3.5 4 5 8 3.5 6 5 6 3.5-4 5-8"/>',
  ear: '<path d="M7 9a5 5 0 0110 0c0 3-3 4-3 7a3 3 0 11-6 0M10 9a2 2 0 014 0"/>',
  home: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>',
  mic: '<path d="M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4"/>',
  tree: '<path d="M12 3l5 7h-3l4 6H6l4-6H7z M12 16v5"/>',
  trophy: '<path d="M7 4h10v3a5 5 0 01-10 0zM5 4H3v2a3 3 0 003 3M19 4h2v2a3 3 0 01-3 3M9 14h6l-1 5h-4z"/>',
  help: '<path d="M9 9a3 3 0 114 2.8c-1 .5-1 1.2-1 2.2M12 17h.01"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
};

export function icon(name, size = 22, stroke = false) {
  const fill = stroke ? 'none' : 'currentColor';
  const sw = stroke ? 'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${fill}" ${sw} aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function iconEl(name, size = 22, stroke = false) {
  const span = el('span', { class: 'ic', html: icon(name, size, stroke) });
  return span;
}

export function haptic(ms = 8) { if (navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }

// gentle confetti-light burst (calm, not arcade)
export function sparkleBurst(host) {
  const n = 10;
  for (let i = 0; i < n; i++) {
    const s = el('span', { class: 'spark' });
    const ang = (i / n) * Math.PI * 2;
    s.style.setProperty('--dx', `${Math.cos(ang) * 60}px`);
    s.style.setProperty('--dy', `${Math.sin(ang) * 60}px`);
    host.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}
