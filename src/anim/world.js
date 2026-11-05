// Orte, Dinge und Effekte für die Strichmännchen-Animationen.
// Alles wird mit einfachen Formen gezeichnet (flacher 2D-Zeichentrick-Stil).

import { seededRandom, cachedGradient } from '../util.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (p, a, b) => clamp((p - a) / (b - a));

// ------------------------------------------------------------- Farben ---

export function skyColors(time, dark = 0) {
  const sets = {
    day: ['#5fb4ff', '#bfe6ff'],
    sunset: ['#ff7e5f', '#feb47b'],
    night: ['#0b1030', '#26305e'],
    red: ['#7a0d0d', '#ff6a2b'],
    space: ['#03030a', '#0b0b1e'],
  };
  const [a, b] = sets[time] || sets.day;
  return dark > 0 ? [mixHex(a, '#020205', dark), mixHex(b, '#05050a', dark)] : [a, b];
}

function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, clamp(k)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function sky(g, W, H, cols, horizon) {
  const gr = cachedGradient(g, 'linear', [0, 0, 0, horizon], [[0, cols[0]], [1, cols[1]]]);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, horizon + 2);
}

function stars(g, W, H, rnd, alpha, t) {
  if (alpha <= 0) return;
  for (let i = 0; i < 160; i++) {
    const x = rnd() * W;
    const y = rnd() * H * 0.6;
    const r = rnd() * 2.2 + 0.4;
    const tw = 0.6 + 0.4 * Math.sin(t * 2 + i);
    g.fillStyle = `rgba(255,255,255,${alpha * tw})`;
    g.beginPath();
    g.arc(x, y, r * (W / 1080), 0, TAU);
    g.fill();
  }
}

function rect(g, c, x, y, w, h) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function tree(g, x, y, s, c = '#2f8f46') {
  rect(g, '#6b4423', x - s * 0.06, y - s * 0.5, s * 0.12, s * 0.5);
  g.fillStyle = c;
  g.beginPath();
  g.arc(x, y - s * 0.7, s * 0.32, 0, TAU);
  g.arc(x - s * 0.22, y - s * 0.55, s * 0.24, 0, TAU);
  g.arc(x + s * 0.22, y - s * 0.55, s * 0.24, 0, TAU);
  g.fill();
}

function flower(g, x, y, s, c) {
  g.strokeStyle = '#2e7d32';
  g.lineWidth = Math.max(2, s * 0.12);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - s);
  g.stroke();
  g.fillStyle = c;
  for (let k = 0; k < 5; k++) {
    g.beginPath();
    g.arc(x + Math.cos((k / 5) * TAU) * s * 0.28, y - s + Math.sin((k / 5) * TAU) * s * 0.28, s * 0.22, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#ffd60a';
  g.beginPath();
  g.arc(x, y - s, s * 0.18, 0, TAU);
  g.fill();
}

function building(g, x, y, w, h, c, lit, rnd, broken = false) {
  rect(g, c, x, y - h, w, h);
  const cols = Math.max(2, Math.floor(w / (h * 0.09 + 8)));
  const rows = Math.max(3, Math.floor(h / (w * 0.22 + 8)));
  const cw = w / (cols * 2 + 1);
  const rh = h / (rows * 2 + 1);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const on = rnd() < lit;
      g.fillStyle = broken ? (rnd() < 0.3 ? '#111' : '#4a4f57') : on ? '#ffe28a' : 'rgba(0,0,0,0.25)';
      g.fillRect(x + cw * (1 + i * 2), y - h + rh * (1 + j * 2), cw, rh);
    }
  }
  if (broken) {
    g.fillStyle = '#3f8f3a';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(x + rnd() * w, y - rnd() * h * 0.4, w * 0.12, 0, TAU);
      g.fill();
    }
  }
}

// Straßenlaterne mit Lichtkegel
function lamp(g, x, groundY, W, H, on = true) {
  const top = groundY - H * 0.26;
  rect(g, '#1e130d', x - W * 0.008, top, W * 0.016, groundY - top);
  rect(g, '#1e130d', x - W * 0.035, top - H * 0.008, W * 0.05, H * 0.012);
  if (!on) return;
  const cone = cachedGradient(g, 'linear', [0, top, 0, groundY], [[0, 'rgba(255,190,100,0.45)'], [1, 'rgba(255,170,80,0.05)']]);
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(x - W * 0.03, top);
  g.lineTo(x - W * 0.14, groundY);
  g.lineTo(x + W * 0.11, groundY);
  g.lineTo(x + W * 0.0, top);
  g.fill();
  const glow = cachedGradient(g, 'radial', [x - W * 0.015, top, 0, x - W * 0.015, top, W * 0.09], [[0, 'rgba(255,230,170,1)'], [0.25, 'rgba(255,180,90,0.6)'], [1, 'rgba(255,150,60,0)']]);
  g.fillStyle = glow;
  g.fillRect(x - W * 0.11, top - W * 0.1, W * 0.2, W * 0.2);
}

// --------------------------------------------------------------- Orte ---
// Jeder Ort zeichnet Himmel + Boden und liefert Infos (Bodenhöhe, Himmel ja/nein).

export const PLACES = {
  bedroom(g, W, H, c) {
    const floorY = c.groundY;
    const night = c.time === 'night' || c.dark > 0.5;
    rect(g, night ? '#2a2030' : '#d9b48f', 0, 0, W, floorY);
    rect(g, '#8a5a3c', 0, floorY, W, H - floorY);
    rect(g, 'rgba(0,0,0,0.15)', 0, floorY - H * 0.012, W, H * 0.012);
    // Fenster mit Himmel
    const wx = W * 0.5;
    const wy = H * 0.14;
    const ww = W * 0.34;
    const wh = H * 0.2;
    g.save();
    g.beginPath();
    g.rect(wx, wy, ww, wh);
    g.clip();
    sky(g, W, H, skyColors(c.time, c.dark), wy + wh);
    if (c.time === 'night') stars(g, W, H, seededRandom(3), 1, c.t);
    g.restore();
    const light = cachedGradient(g, 'linear', [wx, wy, wx - W * 0.2, floorY], [[0, night ? 'rgba(120,140,255,0.12)' : 'rgba(255,230,180,0.35)'], [1, 'rgba(255,230,180,0)']]);
    g.fillStyle = light;
    g.beginPath();
    g.moveTo(wx, wy);
    g.lineTo(wx + ww, wy);
    g.lineTo(wx + ww - W * 0.1, floorY);
    g.lineTo(wx - W * 0.35, floorY);
    g.fill();
    g.strokeStyle = '#f3e4d0';
    g.lineWidth = W * 0.014;
    g.strokeRect(wx, wy, ww, wh);
    g.beginPath();
    g.moveTo(wx + ww / 2, wy);
    g.lineTo(wx + ww / 2, wy + wh);
    g.stroke();
    // Tür rechts
    rect(g, '#6e3f22', W * 0.85, floorY - H * 0.38, W * 0.15, H * 0.38);
    rect(g, '#e0b070', W * 0.865, floorY - H * 0.2, W * 0.02, H * 0.02);
    // Bett links
    const bx = W * 0.02;
    const bw = W * 0.62;
    const bTop = floorY - H * 0.08;
    rect(g, '#5a3420', bx, bTop, bw, H * 0.08);
    rect(g, '#5a3420', bx, bTop - H * 0.1, W * 0.05, H * 0.1);
    rect(g, '#e9d8c4', bx + W * 0.05, bTop - H * 0.02, bw - W * 0.06, H * 0.028);
    rect(g, '#f5ece0', bx + W * 0.06, bTop - H * 0.045, W * 0.13, H * 0.03);
    c.bed = { x: bx, w: bw, top: bTop - H * 0.015 };
    return { hasSky: false };
  },

  living_room(g, W, H, c) {
    const floorY = c.groundY;
    rect(g, c.dark > 0.5 ? '#25222d' : '#d7e3e8', 0, 0, W, floorY);
    rect(g, '#9c7a5b', 0, floorY, W, H - floorY);
    // Fernseher
    rect(g, '#111', W * 0.6, H * 0.28, W * 0.32, H * 0.13);
    rect(g, c.flicker ? '#7fd1ff' : '#2b3a55', W * 0.615, H * 0.288, W * 0.29, H * 0.114);
    rect(g, '#333', W * 0.74, H * 0.41, W * 0.04, floorY - H * 0.41);
    // Sofa
    rect(g, '#c0392b', W * 0.05, floorY - H * 0.08, W * 0.45, H * 0.08);
    rect(g, '#a93226', W * 0.05, floorY - H * 0.14, W * 0.45, H * 0.07);
    c.seatY = floorY - H * 0.06;
    c.seatX = W * 0.27; // Sofa
    return { hasSky: false };
  },

  lab(g, W, H, c) {
    const floorY = c.groundY;
    rect(g, '#dfe7ee', 0, 0, W, floorY);
    rect(g, '#7f8c8d', 0, floorY, W, H - floorY);
    for (let i = 0; i < 3; i++) {
      const x = W * (0.08 + i * 0.3);
      rect(g, '#1d2733', x, H * 0.2, W * 0.26, H * 0.12);
      g.strokeStyle = c.alarm && Math.sin(c.t * 8) > 0 ? '#ff4d4d' : '#39d98a';
      g.lineWidth = W * 0.006;
      g.beginPath();
      for (let k = 0; k <= 20; k++) {
        const px = x + W * 0.02 + (k / 20) * W * 0.22;
        const py = H * 0.26 + Math.sin(k * 0.9 + c.t * 3 + i) * H * 0.025 * (c.alarm ? 2 : 1);
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    }
    if (c.alarm) {
      g.fillStyle = `rgba(255,0,0,${0.12 + 0.12 * Math.sin(c.t * 8)})`;
      g.fillRect(0, 0, W, H);
    }
    rect(g, '#95a5a6', W * 0.05, floorY - H * 0.07, W * 0.9, H * 0.02);
    c.seatY = floorY - H * 0.035;
    return { hasSky: false };
  },

  street(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY);
    if (c.time === 'night' || c.dark > 0.4) stars(g, W, H, seededRandom(5), Math.max(c.dark, c.time === 'night' ? 1 : 0), c.t);
    c.drawSkyProps();
    const rnd = seededRandom(11);
    for (let i = 0; i < 6; i++) {
      const bw = W * (0.14 + rnd() * 0.1);
      building(g, i * W * 0.18 - W * 0.04, c.groundY, bw, H * (0.14 + rnd() * 0.16), ['#8e9aaf', '#6c7a91', '#a3a9b8'][i % 3], c.time === 'night' ? 0.6 : 0.15, rnd);
    }
    rect(g, '#6f6a66', 0, c.groundY, W, H * 0.03);
    rect(g, '#3b3533', 0, c.groundY + H * 0.03, W, H - c.groundY);
    lamp(g, W * 0.08, c.groundY, W, H, c.time !== 'day' || c.dark > 0.3);
    lamp(g, W * 0.92, c.groundY, W, H, c.time !== 'day' || c.dark > 0.3);
    g.fillStyle = '#f5f5f5';
    for (let x = 0; x < W; x += W * 0.18) g.fillRect(x + ((c.t * W * 0.05) % (W * 0.18)) * 0, c.groundY + H * 0.1, W * 0.09, H * 0.008);
    return { hasSky: true };
  },

  city(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY);
    if (c.time === 'night' || c.dark > 0.4) stars(g, W, H, seededRandom(6), 1, c.t);
    c.drawSkyProps();
    const rnd = seededRandom(21);
    for (let i = 0; i < 9; i++) {
      const bw = W * (0.1 + rnd() * 0.1);
      building(g, i * W * 0.12 - W * 0.05, c.groundY, bw, H * (0.12 + rnd() * 0.28), ['#55607a', '#3f4a63', '#6a7590'][i % 3], c.time === 'night' ? 0.7 : 0.2, rnd);
    }
    rect(g, '#2f2a2b', 0, c.groundY, W, H - c.groundY);
    lamp(g, W * 0.1, c.groundY, W, H, c.time !== 'day' || c.dark > 0.3);
    lamp(g, W * 0.9, c.groundY, W, H, c.time !== 'day' || c.dark > 0.3);
    return { hasSky: true };
  },

  empty_city(g, W, H, c) {
    sky(g, W, H, skyColors(c.time === 'day' ? 'day' : c.time, Math.max(c.dark, 0.15)), c.groundY);
    if (c.time === 'night' || c.dark > 0.4) stars(g, W, H, seededRandom(14), 1, c.t);
    c.drawSkyProps();
    const rnd = seededRandom(31);
    for (let i = 0; i < 8; i++) {
      const bw = W * (0.1 + rnd() * 0.12);
      building(g, i * W * 0.13 - W * 0.05, c.groundY, bw, H * (0.12 + rnd() * 0.25), '#6d6f73', 0, rnd, true);
    }
    rect(g, '#4b4f46', 0, c.groundY, W, H - c.groundY);
    lamp(g, W * 0.12, c.groundY, W, H, false);
    lamp(g, W * 0.88, c.groundY, W, H, false);
    g.fillStyle = '#5f8f3a';
    for (let i = 0; i < 14; i++) {
      g.beginPath();
      g.arc(rnd() * W, c.groundY + rnd() * H * 0.03, W * (0.015 + rnd() * 0.03), Math.PI, TAU);
      g.fill();
    }
    // vorbeiwehendes Papier
    const px = ((c.t * W * 0.15) % (W * 1.3)) - W * 0.15;
    rect(g, '#eee', px, c.groundY - H * 0.04 - Math.abs(Math.sin(c.t * 3)) * H * 0.03, W * 0.03, W * 0.02);
    return { hasSky: true };
  },

  meadow(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY);
    if (c.time === 'night' || c.dark > 0.4) stars(g, W, H, seededRandom(7), Math.max(c.dark, 1), c.t);
    c.drawSkyProps();
    g.fillStyle = c.dark > 0.5 ? '#1f3d22' : '#7ccf6b';
    g.beginPath();
    g.ellipse(W * 0.2, c.groundY + H * 0.02, W * 0.6, H * 0.08, 0, Math.PI, TAU);
    g.ellipse(W * 0.85, c.groundY + H * 0.03, W * 0.55, H * 0.07, 0, Math.PI, TAU);
    g.fill();
    rect(g, c.dark > 0.5 ? '#173018' : '#4caf50', 0, c.groundY, W, H - c.groundY);
    tree(g, W * 0.12, c.groundY, H * 0.2);
    tree(g, W * 0.9, c.groundY, H * 0.16, '#3b9d55');
    if (!c.noFlowers) {
      const rnd = seededRandom(9);
      for (let i = 0; i < 9; i++) flower(g, W * (0.05 + rnd() * 0.9), c.groundY + H * (0.01 + rnd() * 0.06), H * 0.025, ['#ff6fa8', '#ffffff', '#b388ff'][i % 3]);
    }
    // Bank
    rect(g, '#8d6e63', W * 0.3, c.groundY - H * 0.06, W * 0.4, H * 0.015);
    rect(g, '#6d4c41', W * 0.32, c.groundY - H * 0.06, W * 0.02, H * 0.06);
    rect(g, '#6d4c41', W * 0.66, c.groundY - H * 0.06, W * 0.02, H * 0.06);
    c.seatY = c.groundY - H * 0.06;
    c.seatX = W * 0.5; // Parkbank
    return { hasSky: true };
  },

  beach(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY - H * 0.08);
    if (c.time === 'night') stars(g, W, H, seededRandom(8), 1, c.t);
    c.drawSkyProps();
    const seaY = c.groundY - H * 0.08;
    rect(g, '#1e88e5', 0, seaY, W, H * 0.08);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = W * 0.005;
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = 0; x <= W; x += W / 30) {
        const y = seaY + H * (0.015 + k * 0.022) + Math.sin(x * 0.02 + c.t * 2 + k) * H * 0.004;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    rect(g, '#f4d58d', 0, c.groundY, W, H - c.groundY);
    // Palme
    rect(g, '#8d6e63', W * 0.86, c.groundY - H * 0.22, W * 0.025, H * 0.22);
    g.fillStyle = '#2e7d32';
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      g.ellipse(W * 0.87, c.groundY - H * 0.22, W * 0.12, W * 0.03, (k / 5) * Math.PI - 0.2 + Math.sin(c.t) * 0.05, 0, TAU);
      g.fill();
    }
    return { hasSky: true };
  },

  desert(g, W, H, c) {
    sky(g, W, H, skyColors(c.time === 'day' ? 'sunset' : c.time, c.dark), c.groundY);
    c.drawSkyProps();
    g.fillStyle = '#e0a458';
    g.beginPath();
    g.ellipse(W * 0.3, c.groundY + H * 0.02, W * 0.7, H * 0.07, 0, Math.PI, TAU);
    g.fill();
    rect(g, '#d9944a', 0, c.groundY, W, H - c.groundY);
    rect(g, '#2e7d32', W * 0.82, c.groundY - H * 0.12, W * 0.04, H * 0.12);
    rect(g, '#2e7d32', W * 0.78, c.groundY - H * 0.09, W * 0.04, W * 0.02);
    rect(g, '#2e7d32', W * 0.78, c.groundY - H * 0.11, W * 0.015, H * 0.03);
    return { hasSky: true };
  },

  forest(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY);
    c.drawSkyProps();
    for (let i = 0; i < 7; i++) tree(g, W * (i / 6), c.groundY - H * 0.01, H * (0.22 + (i % 3) * 0.04), i % 2 ? '#2f7d43' : '#256b37');
    rect(g, '#3e7b3a', 0, c.groundY, W, H - c.groundY);
    return { hasSky: true };
  },

  snow(g, W, H, c) {
    sky(g, W, H, skyColors(c.time === 'day' ? 'day' : c.time, Math.max(c.dark, 0.2)), c.groundY);
    c.drawSkyProps();
    g.fillStyle = '#dfe9f5';
    g.beginPath();
    g.moveTo(0, c.groundY);
    g.lineTo(W * 0.25, c.groundY - H * 0.18);
    g.lineTo(W * 0.5, c.groundY);
    g.lineTo(W * 0.72, c.groundY - H * 0.24);
    g.lineTo(W, c.groundY);
    g.fill();
    rect(g, '#f4f8ff', 0, c.groundY, W, H - c.groundY);
    return { hasSky: true };
  },

  // Zimmer mit großem Fenster, draußen die leere Straße
  window_view(g, W, H, c) {
    const floorY = c.groundY;
    const night = c.time === 'night';
    rect(g, night ? '#231c2c' : '#cfa983', 0, 0, W, floorY);
    rect(g, '#7a4e33', 0, floorY, W, H - floorY);
    const wx = W * 0.32;
    const wy = H * 0.12;
    const ww = W * 0.62;
    const wh = floorY - H * 0.08 - wy;
    g.save();
    g.beginPath();
    g.rect(wx, wy, ww, wh);
    g.clip();
    const street = wy + wh * 0.72;
    sky(g, W, H, skyColors(c.time, c.dark), street);
    if (night) stars(g, W, H, seededRandom(4), 1, c.t);
    const rnd = seededRandom(61);
    for (let i = 0; i < 6; i++) building(g, wx + i * ww * 0.18 - ww * 0.04, street, ww * 0.16, wh * (0.3 + rnd() * 0.3), '#8e8a99', night ? 0 : 0.1, rnd, true);
    rect(g, '#55505a', wx, street, ww, wh);
    g.fillStyle = '#e8e8e8';
    for (let x = wx; x < wx + ww; x += ww * 0.18) g.fillRect(x, street + wh * 0.12, ww * 0.08, wh * 0.015);
    // ein vorbeiwehendes Blatt Papier = sonst nichts bewegt sich
    const px = wx + ((c.t * ww * 0.12) % (ww * 1.2)) - ww * 0.1;
    rect(g, '#f2f2f2', px, street + wh * 0.06 - Math.abs(Math.sin(c.t * 3)) * wh * 0.04, ww * 0.03, ww * 0.02);
    g.restore();
    // Fensterrahmen + Kreuz + Vorhang
    g.strokeStyle = '#f3e4d0';
    g.lineWidth = W * 0.016;
    g.strokeRect(wx, wy, ww, wh);
    g.beginPath();
    g.moveTo(wx + ww / 2, wy);
    g.lineTo(wx + ww / 2, wy + wh);
    g.moveTo(wx, wy + wh * 0.45);
    g.lineTo(wx + ww, wy + wh * 0.45);
    g.stroke();
    rect(g, '#7c3aed', wx - W * 0.07, wy - H * 0.02, W * 0.08, wh + H * 0.05);
    rect(g, '#6d2fd6', wx + ww - W * 0.01, wy - H * 0.02, W * 0.08, wh + H * 0.05);
    rect(g, '#e9dcc8', wx - W * 0.03, wy + wh, ww + W * 0.06, H * 0.015);
    // Licht von draußen
    const light = cachedGradient(g, 'linear', [wx, wy, wx - W * 0.25, floorY], [[0, night ? 'rgba(120,140,255,0.1)' : 'rgba(255,235,190,0.3)'], [1, 'rgba(255,235,190,0)']]);
    g.fillStyle = light;
    g.fillRect(0, wy, W, floorY - wy);
    return { hasSky: false };
  },

  // Hausfront mit Tür (aus dem Haus treten)
  house_front(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), c.groundY);
    if (c.time === 'night') stars(g, W, H, seededRandom(16), 1, c.t);
    c.drawSkyProps();
    const top = c.groundY - H * 0.42;
    rect(g, '#b58466', W * 0.05, top, W * 0.9, c.groundY - top);
    for (const wx of [0.12, 0.66]) {
      rect(g, '#2c2433', W * wx, top + H * 0.06, W * 0.22, H * 0.11);
      rect(g, '#f3e4d0', W * wx, top + H * 0.115, W * 0.22, H * 0.008);
    }
    // Tür (öffnet sich zu Beginn)
    const dx = W * 0.39;
    const dw = W * 0.22;
    const dh = H * 0.24;
    rect(g, '#1d1520', dx, c.groundY - dh, dw, dh);
    const open = Math.min(1, c.p / 0.25);
    rect(g, '#6e3f22', dx, c.groundY - dh, dw * (1 - open * 0.8), dh);
    rect(g, '#e0b070', dx + dw * (1 - open * 0.8) - W * 0.03, c.groundY - dh * 0.5, W * 0.015, W * 0.015);
    rect(g, '#9a9590', W * 0.34, c.groundY, W * 0.32, H * 0.015);
    rect(g, '#6f6a66', 0, c.groundY + H * 0.015, W, H - c.groundY);
    c.door = { x: dx + dw / 2 };
    return { hasSky: true };
  },

  // Supermarkt von innen: volle Regale, niemand da
  supermarket(g, W, H, c) {
    const floorY = c.groundY;
    rect(g, '#e9e4dc', 0, 0, W, floorY);
    rect(g, '#cfc8bd', 0, floorY, W, H - floorY);
    for (let x = 0; x < W; x += W * 0.12) rect(g, 'rgba(0,0,0,0.04)', x, floorY, W * 0.06, H - floorY);
    // Deckenlampen
    for (const lx of [0.2, 0.5, 0.8]) {
      rect(g, '#fffbe8', W * lx - W * 0.1, H * 0.06, W * 0.2, H * 0.012);
    }
    const rnd = seededRandom(71);
    const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff'];
    for (const [sx, sw] of [[0.02, 0.44], [0.54, 0.44]]) {
      const x = W * sx;
      const w = W * sw;
      rect(g, '#8d6e63', x, H * 0.18, w, floorY - H * 0.18);
      for (let r = 0; r < 5; r++) {
        const y = H * 0.2 + r * (floorY - H * 0.22) / 5;
        rect(g, '#5d4037', x, y + H * 0.065, w, H * 0.008);
        for (let k = 0; k < 7; k++) {
          const ih = H * (0.035 + rnd() * 0.025);
          rect(g, cols[Math.floor(rnd() * cols.length)], x + w * (0.03 + k * 0.137), y + H * 0.065 - ih, w * 0.11, ih);
        }
      }
    }
    // Schild
    g.save();
    g.fillStyle = '#d32f2f';
    g.fillRect(W * 0.3, H * 0.09, W * 0.4, H * 0.05);
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(H * 0.025)}px "Arial Black", system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ALLES GRATIS?', W / 2, H * 0.116);
    g.restore();
    return { hasSky: false };
  },

  black(g, W, H, c) {
    rect(g, '#000000', 0, 0, W, H);
    return { hasSky: false, space: true };
  },

  rooftop(g, W, H, c) {
    sky(g, W, H, skyColors(c.time, c.dark), H);
    if (c.time === 'night' || c.dark > 0.4) stars(g, W, H, seededRandom(15), 1, c.t);
    c.drawSkyProps();
    // Stadt tief unten (Fernsicht)
    const rnd = seededRandom(51);
    const lit = c.time === 'night' ? (c.empty ? 0 : 0.6) : 0.15;
    for (let layer = 0; layer < 2; layer++) {
      for (let i = 0; i < 12; i++) {
        const bw = W * (0.06 + rnd() * 0.06);
        const bh = H * (0.08 + rnd() * 0.16) * (layer ? 1.25 : 0.8);
        const x = i * W * 0.09 - W * 0.04 + layer * W * 0.04;
        building(g, x, c.groundY + H * 0.02, bw, bh, layer ? '#4a4258' : '#6a6178', lit, rnd, c.empty && layer === 1);
      }
    }
    // Dunst über der Stadt
    const haze = cachedGradient(g, 'linear', [0, c.groundY - H * 0.25, 0, c.groundY], [[0, 'rgba(255,200,150,0)'], [1, 'rgba(255,190,140,0.25)']]);
    g.fillStyle = haze;
    g.fillRect(0, c.groundY - H * 0.25, W, H * 0.25);
    // Dachfläche + Geländer + Antenne
    rect(g, '#2b2433', 0, c.groundY, W, H - c.groundY);
    rect(g, '#3a3245', 0, c.groundY, W, H * 0.012);
    g.strokeStyle = '#1a1520';
    g.lineWidth = W * 0.008;
    g.beginPath();
    g.moveTo(0, c.groundY - H * 0.05);
    g.lineTo(W, c.groundY - H * 0.05);
    for (let x = 0; x <= W; x += W * 0.08) {
      g.moveTo(x, c.groundY - H * 0.05);
      g.lineTo(x, c.groundY);
    }
    g.stroke();
    rect(g, '#1a1520', W * 0.88, c.groundY - H * 0.3, W * 0.012, H * 0.3);
    g.fillStyle = Math.sin(c.t * 3) > 0 ? '#ff3b4d' : '#5a1a22';
    g.beginPath();
    g.arc(W * 0.886, c.groundY - H * 0.3, W * 0.012, 0, TAU);
    g.fill();
    return { hasSky: true };
  },

  space(g, W, H, c) {
    rect(g, '#03030b', 0, 0, W, H);
    stars(g, W, H, seededRandom(12), 1, c.t);
    c.drawSkyProps();
    return { hasSky: true, space: true };
  },

  earth(g, W, H, c) {
    rect(g, '#03030b', 0, 0, W, H);
    stars(g, W, H, seededRandom(13), 1, c.t);
    c.drawSkyProps();
    if (!c.hasProp('earth')) {
      // Mit Sonne: Erde kleiner und unten links, damit die Sonne sichtbar bleibt
      if (c.hasProp('sun')) drawEarth(g, W * 0.32, H * 0.56, W * 0.24, c);
      else drawEarth(g, W * 0.5, H * 0.45, W * 0.36, c);
    }
    return { hasSky: true, space: true };
  },
};

// ------------------------------------------------------------- Dinge ---

export function drawEarth(g, x, y, r, c, state = 'normal') {
  const spin = state === 'stop' ? Math.min(c.t, 1.2) * 0.1 : c.t * 0.12;
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.clip();
  const ocean = cachedGradient(g, 'radial', [x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r], [[0, '#4fa3ff'], [1, '#0d47a1']]);
  g.fillStyle = ocean;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.fillStyle = state === 'dead' ? '#8d6e63' : '#43a047';
  const blobs = [
    [0.1, -0.3, 0.35],
    [0.7, 0.2, 0.3],
    [1.4, -0.1, 0.25],
    [2.1, 0.35, 0.3],
    [2.8, -0.35, 0.22],
  ];
  for (const [a, yy, s] of blobs) {
    const px = ((((a + spin) % 3.2) + 3.2) % 3.2) / 3.2;
    const cx = x - r * 1.4 + px * r * 2.8;
    g.beginPath();
    g.ellipse(cx, y + yy * r, s * r, s * r * 0.7, 0.4, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.beginPath();
  g.ellipse(x, y - r * 0.92, r * 0.5, r * 0.12, 0, 0, TAU);
  g.fill();
  const shade = cachedGradient(g, 'radial', [x - r * 0.5, y - r * 0.5, r * 0.2, x, y, r * 1.1], [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,30,0.55)']]);
  g.fillStyle = shade;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
  g.strokeStyle = 'rgba(120,190,255,0.5)';
  g.lineWidth = r * 0.04;
  g.beginPath();
  g.arc(x, y, r * 1.02, 0, TAU);
  g.stroke();
}

function drawSun(g, x, y, r, t, scale = 1, alpha = 1, color = '#ffd60a') {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  const glow = cachedGradient(g, 'radial', [x, y, r * scale * 0.5, x, y, r * scale * 2.2], [[0, 'rgba(255,220,80,0.6)'], [1, 'rgba(255,200,0,0)']]);
  g.fillStyle = glow;
  g.fillRect(x - r * scale * 2.5, y - r * scale * 2.5, r * scale * 5, r * scale * 5);
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r * scale, 0, TAU);
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = r * 0.12 * scale;
  g.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + t * 0.3;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r * scale * 1.25, y + Math.sin(a) * r * scale * 1.25);
    g.lineTo(x + Math.cos(a) * r * scale * 1.55, y + Math.sin(a) * r * scale * 1.55);
    g.stroke();
  }
  g.restore();
}

function drawMoon(g, x, y, r, alpha) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = '#f1f1e6';
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (const [dx, dy, s] of [[-0.3, -0.2, 0.2], [0.25, 0.1, 0.15], [-0.05, 0.35, 0.12]]) {
    g.beginPath();
    g.arc(x + dx * r, y + dy * r, s * r, 0, TAU);
    g.fill();
  }
  g.restore();
}

function drawBee(g, x, y, s, t) {
  g.save();
  g.translate(x, y);
  g.fillStyle = 'rgba(255,255,255,0.8)';
  const flap = Math.sin(t * 60) * 0.5 + 0.5;
  g.beginPath();
  g.ellipse(-s * 0.1, -s * 0.45, s * 0.25, s * 0.35 * flap + s * 0.05, -0.4, 0, TAU);
  g.ellipse(s * 0.2, -s * 0.45, s * 0.25, s * 0.35 * flap + s * 0.05, 0.4, 0, TAU);
  g.fill();
  g.fillStyle = '#ffc107';
  g.beginPath();
  g.ellipse(0, 0, s * 0.55, s * 0.35, 0, 0, TAU);
  g.fill();
  g.fillStyle = '#222';
  g.fillRect(-s * 0.15, -s * 0.33, s * 0.12, s * 0.66);
  g.fillRect(s * 0.15, -s * 0.3, s * 0.12, s * 0.6);
  g.beginPath();
  g.arc(s * 0.55, 0, s * 0.18, 0, TAU);
  g.fill();
  g.restore();
}

function drawCar(g, x, y, s, color) {
  g.fillStyle = color;
  roundRect(g, x - s, y - s * 0.55, s * 2, s * 0.4, s * 0.12);
  g.fill();
  roundRect(g, x - s * 0.55, y - s * 0.85, s * 1.1, s * 0.35, s * 0.12);
  g.fill();
  g.fillStyle = '#bfe3ff';
  g.fillRect(x - s * 0.45, y - s * 0.78, s * 0.4, s * 0.22);
  g.fillRect(x + s * 0.05, y - s * 0.78, s * 0.4, s * 0.22);
  g.fillStyle = '#222';
  for (const dx of [-0.6, 0.6]) {
    g.beginPath();
    g.arc(x + dx * s, y - s * 0.15, s * 0.2, 0, TAU);
    g.fill();
  }
}

function drawBird(g, x, y, s, t) {
  g.strokeStyle = '#222';
  g.lineWidth = Math.max(2, s * 0.15);
  const f = Math.sin(t * 10) * 0.4;
  g.beginPath();
  g.moveTo(x - s, y - s * f);
  g.quadraticCurveTo(x - s * 0.4, y - s * 0.5, x, y);
  g.quadraticCurveTo(x + s * 0.4, y - s * 0.5, x + s, y - s * f);
  g.stroke();
}

function drawRocket(g, x, y, s, t) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#ff7043';
  g.beginPath();
  g.moveTo(-s * 0.25, s * 0.6);
  g.quadraticCurveTo(0, s * (1.2 + Math.sin(t * 30) * 0.2), s * 0.25, s * 0.6);
  g.fill();
  g.fillStyle = '#eceff1';
  g.beginPath();
  g.moveTo(0, -s);
  g.quadraticCurveTo(s * 0.4, -s * 0.4, s * 0.3, s * 0.6);
  g.lineTo(-s * 0.3, s * 0.6);
  g.quadraticCurveTo(-s * 0.4, -s * 0.4, 0, -s);
  g.fill();
  g.fillStyle = '#e53935';
  g.fillRect(-s * 0.5, s * 0.3, s * 0.2, s * 0.3);
  g.fillRect(s * 0.3, s * 0.3, s * 0.2, s * 0.3);
  g.fillStyle = '#4fc3f7';
  g.beginPath();
  g.arc(0, -s * 0.2, s * 0.13, 0, TAU);
  g.fill();
  g.restore();
}

function drawDino(g, x, y, s, t, dir = 1) {
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = '#558b2f';
  const step = Math.sin(t * 5);
  g.fillRect(-s * 0.35, -s * 0.45, s * 0.18, s * 0.45 + step * s * 0.04);
  g.fillRect(s * 0.1, -s * 0.45, s * 0.18, s * 0.45 - step * s * 0.04);
  g.beginPath();
  g.ellipse(0, -s * 0.6, s * 0.6, s * 0.32, -0.1, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.5, -s * 0.65);
  g.quadraticCurveTo(-s * 1.2, -s * 0.6, -s * 1.4, -s * 0.35);
  g.lineTo(-s * 0.5, -s * 0.45);
  g.fill();
  g.beginPath();
  g.moveTo(s * 0.35, -s * 0.8);
  g.quadraticCurveTo(s * 0.55, -s * 1.5, s * 0.75, -s * 1.5);
  g.lineTo(s * 0.6, -s * 0.7);
  g.fill();
  g.beginPath();
  g.ellipse(s * 0.85, -s * 1.5, s * 0.28, s * 0.16, 0.1, 0, TAU);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(s * 0.95, -s * 1.55, s * 0.05, 0, TAU);
  g.fill();
  g.restore();
}

function drawQuadruped(g, x, y, s, ph, wolf) {
  g.save();
  g.translate(x, y);
  g.fillStyle = wolf ? '#3a3040' : '#6b4630';
  g.strokeStyle = g.fillStyle;
  g.lineCap = 'round';
  g.lineWidth = s * 0.09;
  for (const [lx, o] of [[-0.3, 0], [-0.2, Math.PI], [0.25, Math.PI / 2], [0.35, Math.PI * 1.5]]) {
    g.beginPath();
    g.moveTo(lx * s, -s * 0.45);
    g.lineTo(lx * s + Math.sin(Math.sin(ph + o) * 0.5) * s * 0.4, 0);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, -s * 0.55, s * 0.45, s * 0.17, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-s * 0.35, -s * 0.6);
  g.lineTo(-s * 0.55, wolf ? -s * 0.7 : -s * 0.95);
  g.stroke();
  g.beginPath();
  g.ellipse(-s * 0.62, wolf ? -s * 0.72 : -s * 0.98, s * 0.15, s * 0.08, -0.2, 0, Math.PI * 2);
  g.fill();
  if (!wolf) {
    g.lineWidth = s * 0.035;
    g.beginPath();
    g.moveTo(-s * 0.55, -s * 1.05);
    g.lineTo(-s * 0.48, -s * 1.3);
    g.moveTo(-s * 0.52, -s * 1.2);
    g.lineTo(-s * 0.65, -s * 1.32);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(s * 0.42, -s * 0.6);
    g.quadraticCurveTo(s * 0.7, -s * 0.62, s * 0.75, -s * 0.4);
    g.stroke();
  }
  g.restore();
}

function drawPlane(g, x, y, s) {
  g.fillStyle = '#eceff1';
  roundRect(g, x - s, y - s * 0.12, s * 2, s * 0.24, s * 0.12);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.1, y);
  g.lineTo(x - s * 0.5, y + s * 0.6);
  g.lineTo(x - s * 0.25, y + s * 0.6);
  g.lineTo(x + s * 0.3, y);
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.85, y);
  g.lineTo(x - s, y - s * 0.4);
  g.lineTo(x - s * 0.75, y - s * 0.4);
  g.lineTo(x - s * 0.6, y);
  g.fill();
}

function drawCloud(g, x, y, s, dark) {
  g.fillStyle = dark ? 'rgba(90,90,100,0.9)' : 'rgba(255,255,255,0.92)';
  g.beginPath();
  g.arc(x, y, s * 0.35, 0, TAU);
  g.arc(x + s * 0.35, y + s * 0.05, s * 0.28, 0, TAU);
  g.arc(x - s * 0.35, y + s * 0.08, s * 0.25, 0, TAU);
  g.fill();
}

/**
 * Himmelsobjekte (werden VOR Gebäuden/Boden gezeichnet).
 */
export function drawSkyProps(g, W, H, c, props) {
  for (const pr of props) {
    const st = pr.state;
    if (pr.type === 'sun') {
      const pos = c.sunPos;
      let scale = 1;
      let alpha = 1;
      let color = '#ffd60a';
      if (st === 'grow') scale = lerp(1, 2.6, seg(c.p, 0.1, 0.8));
      if (st === 'vanish' || st === 'dim') alpha = 1 - seg(c.p, 0.2, 0.6) * (st === 'dim' ? 0.75 : 1);
      if (st === 'explode') {
        const k = seg(c.p, 0.05, c.ev);
        scale = lerp(1, 1.5, k) + (k > 0.8 ? Math.sin(c.t * 40) * 0.08 : 0);
        color = k > 0.5 ? '#ffffff' : '#ffd60a';
        alpha = c.p < c.ev + 0.02 ? 1 : 0;
      }
      if (st === 'red_giant') {
        scale = lerp(1, 3.2, seg(c.p, 0.05, 0.9));
        color = '#ff5722';
      }
      drawSun(g, pos.x, pos.y, W * 0.09, c.t, scale, alpha, color);
    }
    if (pr.type === 'moon') {
      const alpha = st === 'vanish' ? 1 - seg(c.p, 0.25, 0.55) : 1;
      const pos = c.moonPos;
      drawMoon(g, pos.x, pos.y + (st === 'fall' ? seg(c.p, 0.2, 0.9) * H * 0.3 : 0), W * (st === 'big' ? 0.16 : 0.08), alpha);
    }
    if (pr.type === 'earth') {
      const r = W * 0.3;
      const alpha = st === 'explode' ? (c.p < c.ev + 0.02 ? 1 : 0) : 1;
      if (alpha) drawEarth(g, W * 0.5, H * 0.38, r, c, st);
    }
    if (pr.type === 'clouds') {
      for (let i = 0; i < 3; i++) {
        const x = ((W * (0.2 + i * 0.4) + c.t * W * 0.02 * (i + 1)) % (W * 1.4)) - W * 0.2;
        drawCloud(g, x, H * (0.12 + i * 0.06), W * 0.22, c.dark > 0.3 || st === 'storm');
      }
    }
    if (pr.type === 'birds') {
      for (let i = 0; i < 5; i++) {
        const x = ((c.t * W * 0.08 + i * W * 0.07) % (W * 1.3)) - W * 0.15;
        drawBird(g, x, H * 0.2 + Math.abs(i - 2) * H * 0.02, W * 0.025, c.t + i);
      }
    }
    if (pr.type === 'plane') {
      const x = lerp(-W * 0.2, W * 1.2, (c.t * 0.12) % 1);
      const fall = st === 'fall' ? seg(c.p, 0.3, 1) * H * 0.3 : 0;
      drawPlane(g, x, H * 0.18 + fall, W * 0.08);
    }
    if (pr.type === 'rocket') {
      const k = seg(c.p, 0.1, 1);
      drawRocket(g, W * 0.7, lerp(c.groundY - W * 0.1, -W * 0.3, k * k), W * 0.07, c.t);
    }
    if (pr.type === 'meteor') {
      const k = seg(c.p, 0.05, c.ev);
      if (c.p < c.ev) {
        const mx = lerp(W * 1.1, W * 0.55, k);
        const my = lerp(-H * 0.05, c.groundY - H * 0.02, k);
        const tail = cachedGradient(g, 'linear', [mx, my, mx + W * 0.35, my - H * 0.2], [[0, 'rgba(255,170,60,0.9)'], [1, 'rgba(255,170,60,0)']]);
        g.strokeStyle = tail;
        g.lineWidth = W * 0.04;
        g.beginPath();
        g.moveTo(mx, my);
        g.lineTo(mx + W * 0.35, my - H * 0.2);
        g.stroke();
        g.fillStyle = '#5d4037';
        g.beginPath();
        g.arc(mx, my, W * 0.04, 0, TAU);
        g.fill();
      }
    }
  }
}

/**
 * Dinge am Boden (werden NACH dem Ort, VOR den Figuren gezeichnet).
 */
export function drawGroundProps(g, W, H, c, props) {
  for (const pr of props) {
    if (pr.type === 'shop') {
      // Ladenfront mit leuchtendem Schild und Schaufenster
      const w = W * 0.72;
      const x = W * 0.5 - w / 2;
      const top = c.groundY - H * 0.34;
      rect(g, '#3b2a2a', x, top, w, c.groundY - top);
      rect(g, '#241818', x - W * 0.02, top - H * 0.012, w + W * 0.04, H * 0.016);
      const sy = top + H * 0.025;
      rect(g, '#1a1010', x + w * 0.12, sy, w * 0.76, H * 0.06);
      const label = String(pr.label || 'SHOP').toUpperCase().slice(0, 12);
      g.save();
      g.font = `900 ${Math.round(H * 0.035)}px "Arial Black", system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#fff1d6';
      g.fillText(label, W / 2, sy + H * 0.031);
      g.restore();
      const wy = sy + H * 0.085;
      const wh = c.groundY - wy - H * 0.02;
      const glow = cachedGradient(g, 'linear', [0, wy, 0, wy + wh], [[0, '#fff3d6'], [1, '#f2c98a']]);
      g.fillStyle = glow;
      g.fillRect(x + w * 0.06, wy, w * 0.88, wh);
      const rnd = seededRandom(41);
      for (let r = 0; r < 3; r++) {
        rect(g, '#b58a5a', x + w * 0.08, wy + (r + 1) * (wh / 3.4), w * 0.84, H * 0.004);
        for (let k = 0; k < 6; k++) {
          rect(g, ['#e8743b', '#f4b942', '#d9534f', '#8fbf5a', '#ffffff'][Math.floor(rnd() * 5)], x + w * (0.1 + k * 0.135), wy + (r + 1) * (wh / 3.4) - H * 0.025, w * 0.09, H * 0.025);
        }
      }
      rect(g, '#3b2a2a', x + w * 0.495, wy, w * 0.01, wh);
      continue;
    }
    if (pr.type === 'cars') {
      const n = 3;
      for (let i = 0; i < n; i++) {
        const speed = pr.state === 'stop' ? Math.max(0, 1 - seg(c.p, 0.2, 0.5)) : 1;
        const base = (i / n) * W * 1.4;
        const travel = pr.state === 'stop' ? lerp(c.t * W * 0.25, Math.min(c.t, 3) * W * 0.25, 1 - speed) : c.t * W * 0.25;
        const x = ((base + travel) % (W * 1.4)) - W * 0.2;
        drawCar(g, x, c.groundY + H * 0.08, W * 0.09, ['#e53935', '#1e88e5', '#fdd835'][i]);
      }
    }
    if (pr.type === 'bees') {
      const alpha = pr.state === 'vanish' ? 1 - seg(c.p, 0.25, 0.6) : 1;
      if (alpha <= 0) continue;
      g.save();
      g.globalAlpha *= alpha;
      for (let i = 0; i < 5; i++) {
        const a = c.t * (1 + i * 0.3) + i * 2;
        drawBee(g, W * (0.2 + i * 0.15) + Math.cos(a) * W * 0.06, c.groundY - H * (0.08 + (i % 3) * 0.05) + Math.sin(a * 1.7) * H * 0.02, W * 0.035, c.t + i);
      }
      g.restore();
    }
    if (pr.type === 'animals') {
      // Rehe und ein Wolf ziehen durchs Bild
      const run = (c.t * 0.07) % 1.5;
      for (let i = 0; i < 3; i++) {
        const x = lerp(W * 1.2 + i * W * 0.25, -W * 0.4 + i * W * 0.25, run);
        const y = c.groundY - H * 0.02;
        const s = W * (i === 1 ? 0.09 : 0.11);
        drawQuadruped(g, x, y - Math.abs(Math.sin(c.t * 5 + i)) * H * 0.006, s, c.t * 5 + i, i === 1);
      }
    }
    if (pr.type === 'dinosaur') {
      const x = lerp(W * 1.2, W * 0.72, seg(c.p, 0, 0.5));
      drawDino(g, x, c.groundY, W * 0.16, c.t, -1);
    }
    if (pr.type === 'trees') {
      tree(g, W * 0.08, c.groundY, H * 0.18);
      tree(g, W * 0.93, c.groundY, H * 0.15, '#3b9d55');
    }
    if (pr.type === 'house') {
      const x = W * 0.72;
      rect(g, '#ffccbc', x, c.groundY - H * 0.12, W * 0.24, H * 0.12);
      g.fillStyle = '#c62828';
      g.beginPath();
      g.moveTo(x - W * 0.02, c.groundY - H * 0.12);
      g.lineTo(x + W * 0.12, c.groundY - H * 0.2);
      g.lineTo(x + W * 0.26, c.groundY - H * 0.12);
      g.fill();
      rect(g, '#6d4c41', x + W * 0.09, c.groundY - H * 0.06, W * 0.06, H * 0.06);
    }
    if (pr.type === 'money') {
      for (let i = 0; i < 8; i++) {
        const y = ((c.t * H * 0.12 + i * H * 0.09) % (H * 0.7));
        g.save();
        g.translate(W * (0.1 + ((i * 37) % 80) / 100), y);
        g.rotate(Math.sin(c.t * 2 + i) * 0.6);
        rect(g, '#66bb6a', -W * 0.04, -W * 0.02, W * 0.08, W * 0.04);
        g.fillStyle = '#1b5e20';
        g.font = `900 ${Math.round(W * 0.025)}px system-ui`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('€', 0, 0);
        g.restore();
      }
    }
  }
}

// ----------------------------------------------------------- Effekte ---

export function effectSkyDarkness(effect, p) {
  if (effect === 'darkness') return seg(p, 0.15, 0.6) * 0.92;
  if (effect === 'explosion') return p > 0.45 ? seg(p, 0.45, 0.9) * 0.6 : 0;
  return 0;
}

export function drawEffect(g, W, H, c, effect, origin) {
  const p = c.p;
  const ev = c.ev;
  const rnd = seededRandom(77);
  if (effect === 'explosion' || effect === 'flash') {
    const k = (p - ev) * c.dur; // Sekunden seit dem Ereignis
    if (k > 0) {
      if (effect === 'explosion') {
        // Druckwelle
        const r = k * W * 1.1;
        g.strokeStyle = `rgba(255,240,200,${Math.max(0, 1 - k / 1.4)})`;
        g.lineWidth = W * 0.05 * Math.max(0, 1 - k / 1.4);
        g.beginPath();
        g.arc(origin.x, origin.y, r, 0, TAU);
        g.stroke();
        // Feuerball
        const fr = W * 0.12 * (1 + k * 2.5);
        const fa = Math.max(0, 1 - k / 2.2);
        const fb = cachedGradient(g, 'radial', [origin.x, origin.y, 0, origin.x, origin.y, fr], [[0, `rgba(255,255,220,${fa})`], [0.4, `rgba(255,170,40,${fa * 0.9})`], [1, 'rgba(200,40,0,0)']]);
        g.fillStyle = fb;
        g.fillRect(0, 0, W, H);
        // Trümmer
        for (let i = 0; i < 40; i++) {
          const a = rnd() * TAU;
          const v = (0.3 + rnd()) * W * 0.6;
          const px = origin.x + Math.cos(a) * v * k;
          const py = origin.y + Math.sin(a) * v * k + 0.5 * H * 0.15 * k * k;
          g.fillStyle = `rgba(255,${120 + Math.floor(rnd() * 100)},0,${Math.max(0, 1 - k / 2.5)})`;
          g.fillRect(px, py, W * 0.012, W * 0.012);
        }
      }
      // Blitz
      const flash = Math.max(0, 1 - k / 0.5);
      if (flash > 0) {
        g.fillStyle = `rgba(255,255,255,${flash * 0.95})`;
        g.fillRect(0, 0, W, H);
      }
    }
    if (effect === 'explosion' && p > ev) {
      g.fillStyle = `rgba(160,30,0,${seg(p, ev, ev + 0.3) * 0.25})`;
      g.fillRect(0, 0, W, H);
    }
  }
  if (effect === 'darkness') {
    g.fillStyle = `rgba(0,0,10,${seg(p, 0.15, 0.6) * 0.55})`;
    g.fillRect(0, 0, W, H);
  }
  if (effect === 'rain' || effect === 'storm') {
    g.strokeStyle = 'rgba(180,200,255,0.6)';
    g.lineWidth = W * 0.004;
    for (let i = 0; i < 90; i++) {
      const x = (rnd() * W + c.t * W * 0.1) % W;
      const y = (rnd() * H + c.t * H * 1.2) % H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - W * 0.01, y + H * 0.03);
      g.stroke();
    }
    if (effect === 'storm' && Math.sin(c.t * 3.3) > 0.97) {
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 0, W, H);
    }
  }
  if (effect === 'snow' || effect === 'freeze') {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 90; i++) {
      const x = (rnd() * W + Math.sin(c.t + i) * W * 0.02) % W;
      const y = (rnd() * H + c.t * H * 0.15) % H;
      g.beginPath();
      g.arc(x, y, W * (0.003 + rnd() * 0.004), 0, TAU);
      g.fill();
    }
    if (effect === 'freeze') {
      g.fillStyle = `rgba(150,200,255,${seg(p, 0, 0.6) * 0.3})`;
      g.fillRect(0, 0, W, H);
    }
  }
  if (effect === 'heat') {
    g.fillStyle = `rgba(255,120,0,${0.12 + seg(p, 0, 0.8) * 0.2})`;
    g.fillRect(0, 0, W, H);
  }
  if (effect === 'fire') {
    const h = H * 0.08 + seg(p, 0, 0.6) * H * 0.18;
    for (let i = 0; i < 26; i++) {
      const x = (i / 25) * W;
      const fh = h * (0.6 + 0.4 * Math.sin(c.t * 7 + i * 1.7));
      const gr = cachedGradient(g, 'linear', [0, c.groundY, 0, c.groundY - fh], [[0, 'rgba(255,80,0,0.95)'], [0.6, 'rgba(255,190,0,0.8)'], [1, 'rgba(255,240,150,0)']]);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - W * 0.05, c.groundY + H * 0.01);
      g.quadraticCurveTo(x, c.groundY - fh * 1.2, x + W * 0.05, c.groundY + H * 0.01);
      g.fill();
    }
  }
  if (effect === 'flood') {
    const level = c.groundY + H * 0.05 - seg(p, 0.1, 0.8) * H * 0.38;
    g.fillStyle = 'rgba(30,110,200,0.75)';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 30) g.lineTo(x, level + Math.sin(x * 0.02 + c.t * 3) * H * 0.008);
    g.lineTo(W, H);
    g.fill();
  }
  if (effect === 'alarm') {
    g.fillStyle = `rgba(255,0,0,${0.1 + 0.1 * Math.sin(c.t * 9)})`;
    g.fillRect(0, 0, W, H);
  }
}

// Kamera-Wackeln für Erdbeben/Explosion
export function cameraShake(effect, c) {
  const k = (c.p - c.ev) * c.dur;
  if (effect === 'quake') {
    const a = 0.008 + seg(c.p, 0, 0.3) * 0.012;
    return [Math.sin(c.t * 47) * a, Math.cos(c.t * 39) * a];
  }
  if ((effect === 'explosion' || effect === 'flash') && k > 0 && k < 1.5) {
    const a = 0.02 * (1 - k / 1.5);
    return [Math.sin(c.t * 60) * a, Math.cos(c.t * 53) * a];
  }
  return [0, 0];
}

// Sportwagen (seitlich), Figur sitzt darin
export function drawSportsCar(g, x, y, s, t) {
  g.save();
  g.translate(x, y);
  // Fahrtwind-Linien
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = s * 0.02;
  for (let i = 0; i < 6; i++) {
    const yy = -s * (0.08 + i * 0.07);
    const len = s * (0.4 + ((i * 37) % 5) * 0.12);
    const off = ((t * s * 3 + i * s * 0.3) % (s * 1.2));
    g.beginPath();
    g.moveTo(-s * 0.6 - off, yy);
    g.lineTo(-s * 0.6 - off - len, yy);
    g.stroke();
  }
  // Karosserie
  g.fillStyle = '#e11d48';
  g.beginPath();
  g.moveTo(-s * 0.55, -s * 0.08);
  g.lineTo(-s * 0.52, -s * 0.22);
  g.quadraticCurveTo(-s * 0.2, -s * 0.26, -s * 0.05, -s * 0.24);
  g.lineTo(s * 0.12, -s * 0.36);
  g.quadraticCurveTo(s * 0.28, -s * 0.38, s * 0.36, -s * 0.24);
  g.quadraticCurveTo(s * 0.55, -s * 0.22, s * 0.58, -s * 0.12);
  g.lineTo(s * 0.58, -s * 0.06);
  g.closePath();
  g.fill();
  // Scheibe
  g.fillStyle = 'rgba(160,210,255,0.55)';
  g.beginPath();
  g.moveTo(s * 0.13, -s * 0.34);
  g.quadraticCurveTo(s * 0.26, -s * 0.36, s * 0.32, -s * 0.25);
  g.lineTo(s * 0.06, -s * 0.25);
  g.closePath();
  g.fill();
  // Lichter
  g.fillStyle = '#fff3c4';
  g.fillRect(s * 0.52, -s * 0.17, s * 0.06, s * 0.035);
  g.fillStyle = '#ff6b6b';
  g.fillRect(-s * 0.56, -s * 0.18, s * 0.04, s * 0.035);
  // Räder (drehen sich)
  for (const wx of [-0.33, 0.36]) {
    g.fillStyle = '#121016';
    g.beginPath();
    g.arc(wx * s, -s * 0.06, s * 0.1, 0, TAU);
    g.fill();
    g.strokeStyle = '#b8b8c8';
    g.lineWidth = s * 0.015;
    for (let k = 0; k < 3; k++) {
      const a = t * 25 + (k * TAU) / 3;
      g.beginPath();
      g.moveTo(wx * s, -s * 0.06);
      g.lineTo(wx * s + Math.cos(a) * s * 0.07, -s * 0.06 + Math.sin(a) * s * 0.07);
      g.stroke();
    }
  }
  g.restore();
}
