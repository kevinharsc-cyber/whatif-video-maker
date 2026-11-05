// B-Roll-Einblendungen: animierte Nahaufnahmen, die zeigen, worüber gerade
// gesprochen wird (Handy ohne Netz, Stromausfall, Tiere, Uhr …).
// Jede Funktion zeichnet in ein Feld der Größe w × h; a = Sekunden seit Start.

import { drawEarth } from './world.js';
import { seededRandom, cachedGradient } from '../util.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const backOut = (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const FONT = '"Arial Black", "Helvetica Neue", Helvetica, system-ui, sans-serif';

export const INSERT_LIST = ['phone', 'power', 'clock', 'calendar', 'animals', 'burger', 'stars', 'plant', 'water', 'internet', 'counter'];

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function bg(g, w, h, c1, c2) {
  const gr = cachedGradient(g, 'linear', [0, 0, 0, h], [[0, c1], [1, c2]]);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
}

export function redX(g, cx, cy, s, k, lw) {
  g.save();
  g.strokeStyle = '#ff3b4d';
  g.lineCap = 'round';
  g.lineWidth = lw;
  const k1 = clamp(k * 2);
  const k2 = clamp(k * 2 - 1);
  g.beginPath();
  g.moveTo(cx - s, cy - s);
  g.lineTo(cx - s + 2 * s * k1, cy - s + 2 * s * k1);
  g.stroke();
  if (k2 > 0) {
    g.beginPath();
    g.moveTo(cx + s, cy - s);
    g.lineTo(cx + s - 2 * s * k2, cy - s + 2 * s * k2);
    g.stroke();
  }
  g.restore();
}

export function wifi(g, cx, cy, s, lit, color = '#ffffff', dim = 'rgba(255,255,255,0.25)') {
  g.lineCap = 'round';
  g.lineWidth = s * 0.16;
  for (let k = 0; k < 3; k++) {
    g.strokeStyle = lit[k] ? color : dim;
    g.beginPath();
    g.arc(cx, cy, s * (0.35 + k * 0.33), -Math.PI * 0.78, -Math.PI * 0.22);
    g.stroke();
  }
  g.fillStyle = lit[0] ? color : dim;
  g.beginPath();
  g.arc(cx, cy, s * 0.12, 0, TAU);
  g.fill();
}

// ------------------------------------------------------------- Inserts ---

const INSERTS = {
  phone(g, w, h, a) {
    bg(g, w, h, '#2a1846', '#120a22');
    // Lichtschein vom Display
    const glow = cachedGradient(g, 'radial', [w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.6], [[0, 'rgba(120,160,255,0.35)'], [1, 'rgba(120,160,255,0)']]);
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
    // Hand mit lila Ärmel
    const pw = w * 0.4;
    const ph = h * 0.84;
    const px = w / 2 - pw / 2;
    const py = h * 0.08 + Math.sin(a * 2) * h * 0.008;
    g.fillStyle = '#7c3aed';
    rr(g, w * 0.36, h * 0.86, w * 0.36, h * 0.3, w * 0.06);
    g.fill();
    // Telefon
    g.save();
    g.translate(w / 2, py + ph / 2);
    g.rotate(-0.05 + Math.sin(a * 1.5) * 0.01);
    g.translate(-w / 2, -(py + ph / 2));
    g.fillStyle = '#0d0d12';
    rr(g, px, py, pw, ph, pw * 0.14);
    g.fill();
    const sx = px + pw * 0.05;
    const sy = py + pw * 0.05;
    const sw = pw * 0.9;
    const sh = ph - pw * 0.1;
    const scr = cachedGradient(g, 'linear', [0, sy, 0, sy + sh], [[0, '#1b2a55'], [1, '#0c1430']]);
    g.fillStyle = scr;
    rr(g, sx, sy, sw, sh, pw * 0.1);
    g.fill();
    // Statusleiste: Balken leer + "KEIN NETZ"
    for (let k = 0; k < 4; k++) {
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(sx + sw * (0.08 + k * 0.05), sy + sh * 0.07 - k * sh * 0.008, sw * 0.03, sh * 0.02 + k * sh * 0.008);
    }
    g.fillStyle = a > 0.9 && Math.sin(a * 10) > -0.3 ? '#ff4d5e' : 'rgba(255,255,255,0.7)';
    g.font = `900 ${Math.round(sw * 0.075)}px ${FONT}`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.fillText('KEIN NETZ', sx + sw * 0.32, sy + sh * 0.07);
    // WLAN-Symbol: erst "sucht", dann rotes X
    const cx = sx + sw / 2;
    const cy = sy + sh * 0.5;
    const s = sw * 0.42;
    const search = a < 0.9 ? Math.floor(a * 6) % 4 : -1;
    wifi(g, cx, cy, s, [search >= 1 || search === -1, search >= 2, search >= 3]);
    if (a > 0.9) redX(g, cx, cy - s * 0.35, s * 0.55, clamp((a - 0.9) / 0.35), s * 0.13);
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.font = `900 ${Math.round(sw * 0.085)}px ${FONT}`;
    g.fillText('KEINE', cx, sy + sh * 0.74);
    g.fillText('VERBINDUNG', cx, sy + sh * 0.82);
    g.restore();
  },

  power(g, w, h, a) {
    bg(g, w, h, '#0e1030', '#2a1640');
    const rnd = seededRandom(5);
    const off = clamp((a - 0.8) / 0.8);
    // Häuser mit Fenstern, die ausgehen
    for (let i = 0; i < 6; i++) {
      const bx = i * w * 0.17;
      const bh = h * (0.35 + rnd() * 0.3);
      g.fillStyle = '#1c1830';
      g.fillRect(bx, h - bh, w * 0.15, bh);
      for (let r = 0; r < 6; r++) {
        for (let c = 0; c < 3; c++) {
          const on = rnd() > off;
          g.fillStyle = on ? '#ffd27a' : '#141225';
          g.fillRect(bx + w * (0.015 + c * 0.045), h - bh + h * (0.04 + r * 0.08), w * 0.025, h * 0.04);
        }
      }
    }
    // Strommast + Leitungen
    g.strokeStyle = '#0a0a12';
    g.lineWidth = w * 0.025;
    g.beginPath();
    g.moveTo(w * 0.78, h);
    g.lineTo(w * 0.78, h * 0.12);
    g.moveTo(w * 0.66, h * 0.18);
    g.lineTo(w * 0.9, h * 0.18);
    g.stroke();
    g.lineWidth = w * 0.006;
    for (const y of [0.18, 0.22]) {
      g.beginPath();
      g.moveTo(0, h * (y + 0.1));
      g.quadraticCurveTo(w * 0.35, h * (y + 0.2), w * 0.68, h * y);
      g.stroke();
    }
    // Funken
    if (a > 0.6 && a < 1.3) {
      const k = (a - 0.6) / 0.7;
      g.fillStyle = `rgba(255,255,220,${1 - k})`;
      g.beginPath();
      g.arc(w * 0.68, h * 0.18, w * 0.05 * (1 + k * 2), 0, TAU);
      g.fill();
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * TAU;
        g.strokeStyle = `rgba(255,220,120,${1 - k})`;
        g.lineWidth = w * 0.008;
        g.beginPath();
        g.moveTo(w * 0.68, h * 0.18);
        g.lineTo(w * 0.68 + Math.cos(ang) * w * 0.12 * k * 2, h * 0.18 + Math.sin(ang) * w * 0.12 * k * 2 + k * k * h * 0.2);
        g.stroke();
      }
    }
    // Blitz-Symbol
    const pulse = 1 + Math.sin(a * 8) * 0.05;
    g.save();
    g.translate(w * 0.25, h * 0.3);
    g.scale(pulse, pulse);
    g.fillStyle = off > 0.5 ? '#ff4d5e' : '#ffd60a';
    g.beginPath();
    g.moveTo(w * 0.02, -h * 0.16);
    g.lineTo(-w * 0.07, h * 0.02);
    g.lineTo(0, h * 0.02);
    g.lineTo(-w * 0.03, h * 0.16);
    g.lineTo(w * 0.07, -h * 0.03);
    g.lineTo(0, -h * 0.03);
    g.closePath();
    g.fill();
    g.restore();
    if (off > 0.5) redX(g, w * 0.25, h * 0.3, w * 0.09, clamp((off - 0.5) * 3), w * 0.02);
  },

  clock(g, w, h, a) {
    bg(g, w, h, '#2b1a4a', '#140c26');
    const cx = w / 2;
    const cy = h / 2;
    const r = h * 0.4;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fill();
    g.strokeStyle = '#7c3aed';
    g.lineWidth = r * 0.08;
    g.stroke();
    g.fillStyle = '#1a1033';
    for (let k = 0; k < 12; k++) {
      const an = (k / 12) * TAU;
      g.beginPath();
      g.arc(cx + Math.cos(an) * r * 0.82, cy + Math.sin(an) * r * 0.82, r * (k % 3 ? 0.03 : 0.055), 0, TAU);
      g.fill();
    }
    const speed = a < 1.6 ? a * a * 6 : 15 + (a - 1.6) * 0.5;
    g.lineCap = 'round';
    g.strokeStyle = '#1a1033';
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(speed / 12) * r * 0.45, cy - Math.cos(speed / 12) * r * 0.45);
    g.stroke();
    g.strokeStyle = '#ff3b4d';
    g.lineWidth = r * 0.045;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.sin(speed) * r * 0.7, cy - Math.cos(speed) * r * 0.7);
    g.stroke();
    g.fillStyle = '#1a1033';
    g.beginPath();
    g.arc(cx, cy, r * 0.07, 0, TAU);
    g.fill();
    // Bewegungsspuren
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = r * 0.03;
    g.beginPath();
    g.arc(cx, cy, r * 1.12, speed - 1.2, speed - 0.2);
    g.stroke();
  },

  calendar(g, w, h, a, label) {
    bg(g, w, h, '#2b1a4a', '#140c26');
    const target = Math.max(1, Math.min(999, parseInt(String(label || '').match(/\d+/)?.[0] || '3', 10)));
    const steps = Math.min(target, 12);
    const k = clamp(a / 1.4);
    const idx = Math.floor(k * (steps - 1));
    const n = Math.round(1 + ((target - 1) * idx) / Math.max(1, steps - 1));
    const frac = (k * (steps - 1)) % 1;
    const cw = w * 0.5;
    const ch = h * 0.78;
    const x = w / 2 - cw / 2;
    const y = h * 0.12;
    const page = (num, dy, rot, alpha) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(w / 2, y + dy);
      g.rotate(rot);
      g.fillStyle = '#ffffff';
      rr(g, -cw / 2, 0, cw, ch, cw * 0.08);
      g.fill();
      g.fillStyle = '#ff3b4d';
      rr(g, -cw / 2, 0, cw, ch * 0.24, cw * 0.08);
      g.fill();
      g.fillRect(-cw / 2, ch * 0.14, cw, ch * 0.1);
      g.fillStyle = '#ffffff';
      g.font = `900 ${Math.round(ch * 0.12)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('TAG', 0, ch * 0.12);
      g.fillStyle = '#1a1033';
      g.font = `900 ${Math.round(ch * (num > 99 ? 0.32 : 0.45))}px ${FONT}`;
      g.fillText(String(num), 0, ch * 0.62);
      g.restore();
    };
    page(n, 0, 0, 1);
    if (k < 1) page(Math.max(1, n - 1), -frac * h * 0.6, -frac * 0.5, 1 - frac);
    void x;
  },

  animals(g, w, h, a) {
    bg(g, w, h, '#ff9a5a', '#5a2a5a');
    g.fillStyle = '#3a1f3a';
    g.beginPath();
    g.ellipse(w * 0.3, h, w * 0.6, h * 0.25, 0, Math.PI, TAU);
    g.ellipse(w * 0.85, h, w * 0.5, h * 0.3, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = '#24122a';
    g.fillRect(0, h * 0.85, w, h * 0.15);
    const deer = (x, y, s, ph) => {
      g.save();
      g.translate(x, y);
      g.fillStyle = '#1a0d1c';
      g.strokeStyle = '#1a0d1c';
      g.lineCap = 'round';
      g.lineWidth = s * 0.08;
      const legs = [[-0.3, 0], [-0.2, Math.PI], [0.25, Math.PI / 2], [0.35, Math.PI * 1.5]];
      for (const [lx, o] of legs) {
        const sw = Math.sin(ph + o) * 0.5;
        g.beginPath();
        g.moveTo(lx * s, -s * 0.45);
        g.lineTo(lx * s + Math.sin(sw) * s * 0.4, 0);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(0, -s * 0.55, s * 0.45, s * 0.18, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-s * 0.35, -s * 0.6);
      g.lineTo(-s * 0.55, -s * 0.95);
      g.stroke();
      g.beginPath();
      g.ellipse(-s * 0.62, -s * 0.98, s * 0.14, s * 0.08, -0.3, 0, TAU);
      g.fill();
      g.lineWidth = s * 0.04;
      g.beginPath();
      g.moveTo(-s * 0.55, -s * 1.05);
      g.lineTo(-s * 0.5, -s * 1.35);
      g.lineTo(-s * 0.4, -s * 1.45);
      g.moveTo(-s * 0.5, -s * 1.25);
      g.lineTo(-s * 0.65, -s * 1.4);
      g.stroke();
      g.restore();
    };
    const wolf = (x, y, s, ph) => {
      g.save();
      g.translate(x, y);
      g.fillStyle = '#2a2030';
      g.strokeStyle = '#2a2030';
      g.lineCap = 'round';
      g.lineWidth = s * 0.09;
      for (const [lx, o] of [[-0.3, 0], [-0.2, Math.PI], [0.25, Math.PI / 2], [0.35, Math.PI * 1.5]]) {
        g.beginPath();
        g.moveTo(lx * s, -s * 0.3);
        g.lineTo(lx * s + Math.sin(Math.sin(ph + o) * 0.6) * s * 0.3, 0);
        g.stroke();
      }
      g.beginPath();
      g.ellipse(0, -s * 0.4, s * 0.45, s * 0.16, 0, 0, TAU);
      g.fill();
      g.beginPath();
      g.moveTo(-s * 0.4, -s * 0.5);
      g.lineTo(-s * 0.75, -s * 0.48);
      g.lineTo(-s * 0.55, -s * 0.68);
      g.lineTo(-s * 0.45, -s * 0.8);
      g.lineTo(-s * 0.38, -s * 0.6);
      g.fill();
      g.beginPath();
      g.moveTo(s * 0.4, -s * 0.45);
      g.quadraticCurveTo(s * 0.7, -s * 0.5, s * 0.75, -s * 0.3);
      g.stroke();
      g.restore();
    };
    const run = (a * 0.35) % 1.4;
    deer(lerp(w * 1.15, -w * 0.3, run), h * 0.86 - Math.abs(Math.sin(a * 9)) * h * 0.05, w * 0.18, a * 9);
    wolf(lerp(w * 1.45, -w * 0.1, run), h * 0.88 - Math.abs(Math.sin(a * 10)) * h * 0.03, w * 0.16, a * 10);
    deer(lerp(w * 1.7, w * 0.1, run * 0.9), h * 0.84 - Math.abs(Math.sin(a * 9 + 1)) * h * 0.05, w * 0.12, a * 9 + 1);
    // Staub
    for (let i = 0; i < 10; i++) {
      g.fillStyle = `rgba(255,220,180,${0.25 - i * 0.02})`;
      g.beginPath();
      g.arc(lerp(w * 1.2, -w * 0.25, run) + i * w * 0.03, h * 0.86 - i * h * 0.004, w * (0.015 + i * 0.004), 0, TAU);
      g.fill();
    }
  },

  burger(g, w, h, a) {
    bg(g, w, h, '#4a1d1d', '#1f0d12');
    const cx = w / 2;
    const base = h * 0.82;
    const bw = w * 0.42;
    const layers = [
      ['#d9963f', h * 0.1, 'bun'],
      ['#5a3018', h * 0.08, 'patty'],
      ['#ffcc33', h * 0.03, 'cheese'],
      ['#58b947', h * 0.035, 'salad'],
      ['#d9963f', h * 0.16, 'top'],
    ];
    let y = base;
    layers.forEach(([c, lh, kind], i) => {
      const k = clamp((a - i * 0.18) / 0.35);
      if (k <= 0) return;
      const drop = (1 - backOut(k)) * h * 0.6;
      const yy = y - lh - drop;
      g.fillStyle = c;
      if (kind === 'top') {
        g.beginPath();
        g.ellipse(cx, yy + lh, bw / 2, lh, 0, Math.PI, TAU);
        g.fill();
        g.fillStyle = '#fff3d6';
        for (let s = 0; s < 7; s++) {
          g.beginPath();
          g.ellipse(cx - bw * 0.3 + s * bw * 0.1, yy + lh * (0.4 + (s % 2) * 0.2), w * 0.008, w * 0.004, 0.4, 0, TAU);
          g.fill();
        }
      } else if (kind === 'cheese') {
        g.beginPath();
        g.moveTo(cx - bw * 0.52, yy);
        g.lineTo(cx + bw * 0.52, yy);
        g.lineTo(cx + bw * 0.3, yy + lh * 2.2);
        g.lineTo(cx + bw * 0.15, yy + lh);
        g.lineTo(cx - bw * 0.52, yy + lh);
        g.fill();
      } else {
        rr(g, cx - bw / 2, yy, bw, lh, lh * 0.45);
        g.fill();
      }
      y -= lh * 0.85;
    });
    // Dampf
    if (a > 1) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = w * 0.012;
      for (let s = 0; s < 3; s++) {
        g.beginPath();
        for (let k = 0; k <= 10; k++) {
          const yy = h * 0.3 - k * h * 0.02 - ((a * 0.1) % 0.1) * h;
          const xx = cx - w * 0.08 + s * w * 0.08 + Math.sin(k * 0.8 + a * 3 + s) * w * 0.015;
          k ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
        }
        g.stroke();
      }
    }
    // Pommes
    const fk = clamp((a - 0.9) / 0.4);
    if (fk > 0) {
      g.save();
      g.translate(w * 0.82, h * 0.82 + (1 - backOut(fk)) * h * 0.5);
      for (let i = 0; i < 7; i++) {
        g.fillStyle = '#ffd34d';
        g.fillRect(-w * 0.08 + i * w * 0.022, -h * (0.32 + (i % 3) * 0.04), w * 0.016, h * 0.25);
      }
      g.fillStyle = '#e53935';
      g.beginPath();
      g.moveTo(-w * 0.1, -h * 0.18);
      g.lineTo(w * 0.1, -h * 0.18);
      g.lineTo(w * 0.08, 0);
      g.lineTo(-w * 0.08, 0);
      g.fill();
      g.restore();
    }
  },

  stars(g, w, h, a) {
    bg(g, w, h, '#05061a', '#1c1040');
    const rnd = seededRandom(17);
    for (let i = 0; i < 260; i++) {
      // Milchstraßen-Band (diagonal)
      const t = rnd();
      const off = (rnd() + rnd() + rnd() - 1.5) * h * 0.25;
      const x = t * w;
      const y = h * 0.9 - t * h * 0.8 + off;
      const tw = 0.5 + 0.5 * Math.sin(a * 3 + i);
      g.fillStyle = `rgba(255,${230 + (i % 25)},${220 + (i % 35)},${0.3 + tw * 0.6})`;
      g.fillRect(x, y, w * 0.004 + (i % 7 === 0 ? w * 0.004 : 0), w * 0.004 + (i % 7 === 0 ? w * 0.004 : 0));
    }
    const band = cachedGradient(g, 'linear', [0, h, w, 0], [[0.3, 'rgba(180,120,255,0)'], [0.5, 'rgba(200,150,255,0.25)'], [0.7, 'rgba(180,120,255,0)']]);
    g.fillStyle = band;
    g.fillRect(0, 0, w, h);
    // Sternschnuppe
    const k = clamp((a - 0.8) / 0.6);
    if (k > 0 && k < 1) {
      const sx = lerp(w * 0.9, w * 0.3, k);
      const sy = lerp(h * 0.1, h * 0.45, k);
      const tail = cachedGradient(g, 'linear', [sx, sy, sx + w * 0.25, sy - h * 0.18], [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(255,255,255,0)']]);
      g.strokeStyle = tail;
      g.lineWidth = w * 0.01;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + w * 0.25, sy - h * 0.18);
      g.stroke();
    }
  },

  plant(g, w, h, a) {
    bg(g, w, h, '#ffd59a', '#ff9a5a');
    g.fillStyle = 'rgba(255,240,180,0.8)';
    g.beginPath();
    g.arc(w * 0.82, h * 0.2, h * 0.12, 0, TAU);
    g.fill();
    g.fillStyle = '#5a3420';
    g.fillRect(0, h * 0.78, w, h * 0.22);
    const k = clamp(a / 1.6);
    const stem = h * 0.55 * k;
    g.strokeStyle = '#2e8b3d';
    g.lineWidth = w * 0.025;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w / 2, h * 0.78);
    g.quadraticCurveTo(w / 2 + Math.sin(a * 2) * w * 0.02, h * 0.78 - stem / 2, w / 2, h * 0.78 - stem);
    g.stroke();
    g.fillStyle = '#3cb54a';
    for (let i = 0; i < 4; i++) {
      const lk = clamp(k * 4 - i * 0.7);
      if (lk <= 0) continue;
      const ly = h * 0.78 - stem * (0.3 + i * 0.2);
      const side = i % 2 ? 1 : -1;
      g.save();
      g.translate(w / 2, ly);
      g.rotate(side * (0.6 + Math.sin(a * 2 + i) * 0.05));
      g.scale(lk, lk);
      g.beginPath();
      g.ellipse(side * w * 0.06, 0, w * 0.07, w * 0.03, 0, 0, TAU);
      g.fill();
      g.restore();
    }
    // Karotten im Beet
    for (let i = 0; i < 3; i++) {
      const ck = clamp((a - 0.6 - i * 0.2) / 0.4);
      if (ck <= 0) continue;
      const x = w * (0.15 + i * 0.12);
      g.fillStyle = '#ff8c1a';
      g.beginPath();
      g.moveTo(x - w * 0.025, h * 0.78);
      g.lineTo(x + w * 0.025, h * 0.78);
      g.lineTo(x, h * 0.78 + h * 0.12 * ck);
      g.fill();
      g.fillStyle = '#3cb54a';
      g.fillRect(x - w * 0.01, h * 0.78 - h * 0.06 * ck, w * 0.02, h * 0.06 * ck);
    }
  },

  water(g, w, h, a) {
    bg(g, w, h, '#0d3b66', '#06203a');
    const surf = h * 0.62;
    g.fillStyle = '#1d6fb8';
    g.fillRect(0, surf, w, h - surf);
    const cyc = a % 1.4;
    const dk = clamp(cyc / 0.5);
    if (cyc < 0.5) {
      const y = lerp(-h * 0.05, surf, dk * dk);
      g.fillStyle = '#9fd8ff';
      g.beginPath();
      g.moveTo(w / 2, y - h * 0.08);
      g.quadraticCurveTo(w / 2 + w * 0.05, y, w / 2, y + h * 0.02);
      g.quadraticCurveTo(w / 2 - w * 0.05, y, w / 2, y - h * 0.08);
      g.fill();
    } else {
      const rk = (cyc - 0.5) / 0.9;
      for (let i = 0; i < 3; i++) {
        const r = w * (0.05 + rk * 0.4 - i * 0.08);
        if (r <= 0) continue;
        g.strokeStyle = `rgba(200,235,255,${(1 - rk) * 0.8})`;
        g.lineWidth = w * 0.008;
        g.beginPath();
        g.ellipse(w / 2, surf, r, r * 0.22, 0, 0, TAU);
        g.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const sk = clamp(rk * 2);
        g.fillStyle = `rgba(180,225,255,${1 - sk})`;
        g.beginPath();
        g.arc(w / 2 + Math.cos(i) * w * 0.12 * sk, surf - Math.sin(sk * Math.PI) * h * 0.15 * (0.6 + (i % 3) * 0.2), w * 0.012, 0, TAU);
        g.fill();
      }
    }
  },

  internet(g, w, h, a) {
    bg(g, w, h, '#05061a', '#14103a');
    const cx = w / 2;
    const cy = h / 2;
    const r = h * 0.3;
    drawEarth(g, cx, cy, r, { t: a, p: 0, dur: 1 });
    const nodes = [];
    for (let i = 0; i < 7; i++) {
      const an = (i / 7) * TAU + 0.3;
      nodes.push([cx + Math.cos(an) * r * 1.45, cy + Math.sin(an) * r * 1.25]);
    }
    const brk = clamp((a - 0.7) / 0.8);
    nodes.forEach(([x, y], i) => {
      const broken = i / nodes.length < brk;
      g.strokeStyle = broken ? 'rgba(255,60,80,0.8)' : 'rgba(120,200,255,0.8)';
      g.lineWidth = w * 0.006;
      g.setLineDash(broken ? [w * 0.015, w * 0.015] : []);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(lerp(x, cx, broken ? 0.3 : 0.75), lerp(y, cy, broken ? 0.3 : 0.75));
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = broken ? '#ff3b4d' : '#7cd3ff';
      g.beginPath();
      g.arc(x, y, w * 0.018, 0, TAU);
      g.fill();
    });
    if (brk >= 1) {
      g.fillStyle = '#ff3b4d';
      g.font = `900 ${Math.round(h * 0.12)}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('OFFLINE', cx, cy);
    }
  },

  counter(g, w, h, a, label) {
    bg(g, w, h, '#2b1a4a', '#140c26');
    const k = clamp(a / 1.8);
    const n = k >= 1 ? 1 : Math.max(1, Math.round(8e9 * Math.pow(1 - k, 6)));
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.font = `900 ${Math.round(h * 0.075)}px ${FONT}`;
    g.fillText(String(label || 'MENSCHEN AUF DER ERDE').toUpperCase(), w / 2, h * 0.28);
    const pulse = k >= 1 ? 1 + Math.sin(a * 10) * 0.05 : 1;
    g.save();
    g.translate(w / 2, h * 0.58);
    g.scale(pulse, pulse);
    g.fillStyle = k >= 1 ? '#ff3b4d' : '#ffffff';
    const txt = n.toLocaleString('de-DE');
    let fs = h * 0.22;
    g.font = `900 ${Math.round(fs)}px ${FONT}`;
    while (g.measureText(txt).width > w * 0.8) {
      fs -= 2;
      g.font = `900 ${Math.round(fs)}px ${FONT}`;
    }
    g.fillText(txt, 0, 0);
    g.restore();
  },
};

/**
 * Zeichnet eine Einblendung als große Karte, die von unten hereinslidet.
 */
export function drawInsert(g, W, H, o, t) {
  const age = t - o.start;
  const left = o.end - t;
  const inK = clamp(age / 0.5);
  const outK = clamp(left / 0.3);
  const w = W * 0.64;
  const h = W * 0.45;
  const cx = W / 2;
  // oberhalb des Kopfes der Hauptfigur; in den ersten Sekunden unter dem Titel
  const cy = H * (o.start < 3.6 ? 0.33 : 0.215) + (1 - backOut(inK)) * H * 0.5 + (1 - outK) * H * 0.4;
  const rot = (o.slot ? 1 : -1) * (0.035 * (1 - inK) + 0.012);
  g.save();
  g.globalAlpha = Math.min(clamp(inK * 4), outK);
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  rr(g, -w / 2 + W * 0.015, -h / 2 + W * 0.025, w, h, W * 0.05);
  g.fill();
  g.save();
  rr(g, -w / 2, -h / 2, w, h, W * 0.05);
  g.clip();
  g.translate(-w / 2, -h / 2);
  (INSERTS[o.insert] || INSERTS.stars)(g, w, h, Math.max(0, age - 0.15), o.label);
  g.restore();
  g.strokeStyle = '#ffffff';
  g.lineWidth = W * 0.012;
  rr(g, -w / 2, -h / 2, w, h, W * 0.05);
  g.stroke();
  // Beschriftung unten an der Karte
  if (o.label && o.insert !== 'counter') {
    const fs = Math.round(W * 0.045);
    g.font = `900 ${fs}px ${FONT}`;
    const tw = g.measureText(o.label).width + fs * 1.6;
    g.fillStyle = '#7c3aed';
    rr(g, -tw / 2, h / 2 - fs * 0.9, tw, fs * 1.8, fs * 0.9);
    g.fill();
    g.fillStyle = '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(o.label, 0, h / 2 + fs * 0.02);
  }
  g.restore();
}
