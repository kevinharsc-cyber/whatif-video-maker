// DIE ZOMBIE-APOKALYPSE – Zeichnungen (2D-Cartoon im Kieselbach-Stil)
// Alle Maße in 1080 × 1920 (virtuell), der Aufrufer skaliert.
import { P, rr, ell, poly, line, label, OL, TAU, rnd, easeOutBack } from '../verein/art.js';

export { P, rr, ell, poly, line, label, OL, TAU, easeOutBack };

export const VW = 1080;
export const VH = 1920;
const W = VW;
const H = VH;
const GCACHE = new WeakMap();
// Verläufe einmal pro Zeichenfläche bauen (spart Arbeit pro Bild)
function cached(g, key, make) {
  let m = GCACHE.get(g);
  if (!m) GCACHE.set(g, (m = new Map()));
  let v = m.get(key);
  if (!v) m.set(key, (v = make()));
  return v;
}
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);

// ------------------------------------------------------------ Farben ---
const SK = '#f6c9a0';
const HAIR = '#6b3e1f';
const HOOD = '#e8572a';
const HOODD = '#c4441d';
const JEANS = '#34466b';
const SHOE = '#3a2a20';
export const ZSK = '#9cc46b';
const ZSKD = '#7aa352';
export const DARK = '#1b1a2e';
export const YEL = '#ffd60a';
export const RED = '#e5383b';
export const GREEN = '#43b649';

function limb(g, x1, y1, x2, y2, w, color, lw) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = Math.hypot(x2 - x1, y2 - y1);
  g.save();
  g.translate(x1, y1);
  g.rotate(a);
  P(g, color, lw, rr(-w / 2, -w / 2, L + w, w, w / 2));
  g.restore();
}
function shadow(g, w) {
  g.save();
  g.globalAlpha = 0.22;
  P(g, '#000', 0, ell(0, 0, w, w * 0.16));
  g.restore();
}

// ------------------------------------------------------------- Held ---
// 100 Einheiten hoch, Füße bei y=0
export function drawHero(g, x, y, Hpx, { pose = 'stand', mouth = 0, t = 0, scared = 0, look = 0 } = {}) {
  const s = Hpx / 100;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 1.6;
  shadow(g, 22);
  for (const sx of [-1, 1]) {
    P(g, JEANS, lw, rr(sx * 7 - 5, -24, 10, 21, 3));
    P(g, SHOE, lw, ell(sx * 8, -3, 7.5, 3.8));
    line(g, [[sx * 8 - 6, -1.2], [sx * 8 + 6, -1.2]], 0.9, '#d9c7b0');
  }
  const breath = Math.sin(t * 2.2) * 0.5 + (scared ? Math.sin(t * 31) * 0.35 : 0);
  g.save();
  g.translate(0, -breath);
  // Rucksack (hinter dem Körper)
  P(g, '#557a3c', lw, rr(-21, -55, 42, 30, 8));
  // Hoodie
  P(g, HOOD, lw, rr(-17, -57, 34, 37, 10));
  P(g, HOODD, 1.2, rr(-10.5, -37, 21, 10, 4));
  P(g, HOODD, lw, ell(0, -56, 13, 4.5));
  line(g, [[-3.5, -54], [-4, -45]], 1.1, '#fff');
  line(g, [[3.5, -54], [4, -45]], 1.1, '#fff');
  line(g, [[-12, -56], [-13, -30]], 3.2, '#6b4f2e');
  line(g, [[12, -56], [13, -30]], 3.2, '#6b4f2e');
  heroArms(g, pose, lw, t);
  g.restore();
  g.save();
  g.translate(0, -breath);
  heroHead(g, lw, mouth, t, scared, look);
  g.restore();
  if (pose === 'point') {
    // Zeigefinger direkt auf den Zuschauer (Hand vor dem Körper, groß)
    limb(g, 15, -50, 9, -42, 8, HOOD, lw);
    P(g, SK, lw, ell(6, -40, 7.5, 7));
    P(g, SK, lw, ell(4.5, -44.5, 3.4, 3.4));
    P(g, '#e9b48c', 0, ell(4.5, -44.5, 1.5, 1.5));
  }
  if (pose === 'bat') {
    // Baseballschläger über der Schulter
    g.save();
    g.translate(15, -40);
    g.rotate(-1.05);
    P(g, '#c89055', lw, (q) => {
      q.moveTo(0, -2.2);
      q.lineTo(44, -5);
      q.quadraticCurveTo(50, 0, 44, 5);
      q.lineTo(0, 2.2);
      q.closePath();
    });
    line(g, [[30, -3], [30, 3]], 1, '#8a5a30');
    line(g, [[34, -3.5], [34, 3.5]], 1, '#8a5a30');
    g.restore();
    P(g, SK, lw, ell(16, -40, 4.4, 4.4));
  }
  g.restore();
}
function heroArms(g, pose, lw, t) {
  const down = (sx) => {
    limb(g, sx * 16, -52, sx * 19, -31, 8, HOOD, lw);
    P(g, SK, lw, ell(sx * 19.5, -29, 4.2, 4.2));
  };
  if (pose === 'stand' || pose === 'talk') {
    const k = pose === 'talk' ? Math.sin(t * 3) * 2 : 0;
    down(-1);
    limb(g, 16, -52, 22, -33 + k, 8, HOOD, lw);
    P(g, SK, lw, ell(23, -31 + k, 4.2, 4.2));
  } else if (pose === 'scared') {
    const k = Math.sin(t * 25) * 0.6;
    limb(g, -16, -52, -14, -64 + k, 8, HOOD, lw);
    P(g, SK, lw, ell(-13, -67 + k, 4.4, 4.4));
    limb(g, 16, -52, 14, -64 - k, 8, HOOD, lw);
    P(g, SK, lw, ell(13, -67 - k, 4.4, 4.4));
  } else if (pose === 'point') {
    down(-1);
  } else if (pose === 'bat') {
    down(-1);
  } else if (pose === 'cheer') {
    // beide Arme jubelnd nach oben
    const k = Math.sin(t * 10) * 2;
    limb(g, -16, -52, -26, -76 + k, 8, HOOD, lw);
    P(g, SK, lw, ell(-27, -79 + k, 4.6, 4.6));
    limb(g, 16, -52, 26, -76 - k, 8, HOOD, lw);
    P(g, SK, lw, ell(27, -79 - k, 4.6, 4.6));
  } else if (pose === 'up') {
    // Arm hoch, zeigt nach oben
    down(-1);
    limb(g, 16, -52, 26, -74, 8, HOOD, lw);
    P(g, SK, lw, ell(27, -77, 4.2, 4.2));
    limb(g, 27, -79, 28, -86, 2.6, SK, 1);
  }
}
function heroHead(g, lw, mouth, t, scared, look) {
  P(g, SK, lw, ell(-21.5, -73, 3.6, 4.6));
  P(g, SK, lw, ell(21.5, -73, 3.6, 4.6));
  P(g, SK, lw, ell(0, -75, 22, 21.5));
  // strubbelige Haare
  P(g, HAIR, lw, poly([
    [-22, -76], [-25, -88], [-17, -86], [-18, -98], [-8, -92], [-4, -103], [3, -94], [11, -101], [13, -91], [22, -95], [19, -84], [24, -79],
    [16, -84], [8, -86], [0, -85], [-9, -86], [-16, -83],
  ]));
  line(g, [[-8, -94], [-3, -90]], 1, '#8a5530');
  line(g, [[7, -95], [10, -90]], 1, '#8a5530');
  // Augen
  const lx = look * 1.5;
  for (const ex of [-8.5, 8.5]) {
    P(g, '#fff', 1.3, ell(ex, -75, 5.6, 6.6));
    P(g, '#2a1d18', 0, ell(ex + lx + 0.6, -74.5, scared ? 1.7 : 2.7, scared ? 1.9 : 3));
    P(g, '#fff', 0, ell(ex + lx + 1.4, -76, 0.9, 0.9));
  }
  // Augenbrauen
  const up = scared ? 4 : 0;
  line(g, [[-14, -84 - up * 0.6], [-4, -83 - up * (scared ? 1.2 : 0) + (scared ? 0 : 1.2)]], 2.2);
  line(g, [[4, -83 - up * (scared ? 1.2 : 0) + (scared ? 0 : 1.2)], [14, -84 - up * 0.6]], 2.2);
  // Pflaster + Dreck
  g.save();
  g.translate(13.5, -65.5);
  g.rotate(-0.5);
  P(g, '#fff4e0', 1, rr(-4.5, -1.8, 9, 3.6, 1.4));
  line(g, [[-1, -1.2], [-1, 1.2]], 0.5, '#c9b28a');
  line(g, [[1, -1.2], [1, 1.2]], 0.5, '#c9b28a');
  g.restore();
  g.save();
  g.globalAlpha = 0.35;
  P(g, '#7a5a3a', 0, ell(-13, -65, 3, 1.6));
  g.restore();
  // Nase
  P(g, '#eab48a', 1, ell(0.5, -68.5, 2.6, 2.1));
  // Mund
  const m = clamp(mouth);
  if (m > 0.08) {
    const h = 2 + m * 6.5;
    P(g, '#7a1f1f', 1.3, rr(-6, -63.5, 12, h, Math.min(4, h / 2)));
    P(g, '#fff', 0, rr(-4.6, -63.1, 9.2, 1.6, 0.8));
    if (h > 5) P(g, '#e0626a', 0, ell(0, -63.5 + h - 1.6, 3.4, 1.4));
  } else if (scared) {
    line(g, [[-5, -61], [-2.5, -62.3], [0, -61], [2.5, -62.3], [5, -61]], 1.5);
  } else {
    g.beginPath();
    g.moveTo(-5, -62.5);
    g.quadraticCurveTo(0, -60, 5, -62.5);
    g.lineWidth = 1.6;
    g.strokeStyle = OL;
    g.lineCap = 'round';
    g.stroke();
  }
  if (scared) {
    const k = (t * 0.8) % 1;
    g.save();
    g.globalAlpha = 1 - k * 0.6;
    P(g, '#7ec8ff', 1, (q) => {
      const yy = -88 + k * 6;
      q.moveTo(24, yy - 5);
      q.quadraticCurveTo(28, yy + 1, 24, yy + 2.5);
      q.quadraticCurveTo(20, yy + 1, 24, yy - 5);
    });
    g.restore();
  }
}

// ----------------------------------------------------------- Zombie ---
const ZSHIRT = ['#7d8a99', '#a0705e', '#6b7f5a', '#8d7aa0', '#b0a26b', '#5f7d8f', '#9a5a5a', '#7a7a7a', '#a67c52', '#6d6aa0'];
const ZPANTS = ['#4a4f63', '#5a4636', '#3f4a3a', '#55506b'];
export function drawZombie(g, x, y, Hpx, { t = 0, v = 0, dir = 1, walk = 1, eyes = false } = {}) {
  const s = Hpx / 100;
  g.save();
  g.translate(x, y);
  g.scale(s * dir, s);
  const lw = 1.6;
  const ph = t * 3.2 + v * 1.7;
  const sw = Math.sin(ph) * walk;
  shadow(g, 20);
  const pants = ZPANTS[v % ZPANTS.length];
  const shirt = ZSHIRT[v % ZSHIRT.length];
  // Beine (schlurfend)
  P(g, pants, lw, rr(-12 - sw * 3, -24, 10, 21, 3));
  P(g, ZSKD, lw, ell(-7 - sw * 3, -3, 7, 3.4));
  P(g, pants, lw, rr(2 + sw * 3, -24, 10, 21, 3));
  P(g, v % 3 === 0 ? ZSK : '#3b3b3b', lw, ell(8 + sw * 3, -3, 7, 3.4));
  g.save();
  g.translate(0, -Math.abs(sw) * 1.2);
  g.rotate(0.1 + Math.sin(ph * 0.5) * 0.04);
  // hinterer Arm
  limb(g, -2, -50, 27, -47 + sw * 2, 7.5, shirt, lw);
  P(g, ZSKD, lw, ell(31, -47 + sw * 2, 4, 3.8));
  // Hemd mit zerrissenem Saum
  P(g, shirt, lw, poly([[-16, -56], [16, -56], [17, -26], [12, -21], [8, -26], [3, -20], [-2, -25], [-7, -20], [-11, -25], [-16, -21]]));
  P(g, 'rgba(0,0,0,0.25)', 0, poly([[-6, -44], [-1, -40], [-5, -36]]));
  P(g, 'rgba(0,0,0,0.25)', 0, poly([[7, -34], [11, -30], [6, -28]]));
  // Kopf
  g.save();
  g.translate(2, -76);
  g.rotate(-0.16 + Math.sin(ph * 0.7) * 0.05);
  P(g, ZSK, lw, ell(-21, 2, 3.4, 4.4));
  P(g, ZSK, lw, ell(0, 0, 21, 20.5));
  P(g, ZSKD, 0, ell(-9, 9, 6, 3));
  // Haarbüschel
  line(g, [[-6, -20], [-9, -27]], 1.6);
  line(g, [[1, -20.5], [2, -28]], 1.6);
  line(g, [[7, -19], [11, -25]], 1.6);
  // Narbe mit Stichen
  line(g, [[-15, -8], [-5, -13]], 1.1, '#4d6b33');
  for (const k of [0.25, 0.55, 0.85]) line(g, [[-15 + 10 * k - 1, -8 - 5 * k - 2], [-15 + 10 * k + 1, -8 - 5 * k + 2]], 0.9, '#4d6b33');
  // Augen: eines groß, eines klein
  P(g, '#3d5a2a', 0, ell(-7, 0, 7, 7.5));
  P(g, eyes ? '#ffef5a' : '#fff', 1.3, ell(-7, 0, 5.8, 6.2));
  P(g, eyes ? '#ff3b30' : '#222', 0, ell(-6, 0.5, 1.4, 1.4));
  P(g, eyes ? '#ffef5a' : '#fff', 1.3, ell(8, 1, 3.6, 3.4));
  P(g, eyes ? '#ff3b30' : '#222', 0, ell(8.4, 1.2, 1, 1));
  // Mund: schief, offen, Zähne
  P(g, '#3a1a1a', 1.3, poly([[-5, 10], [9, 8], [8, 14], [-3, 15]]));
  P(g, '#fff6d9', 0.8, rr(-2, 9.4, 3, 2.6, 0.6));
  P(g, '#fff6d9', 0.8, rr(3.5, 8.8, 3, 2.4, 0.6));
  g.restore();
  // vorderer Arm
  limb(g, 6, -50, 33, -45 - sw * 2, 7.5, shirt, lw);
  P(g, ZSK, lw, ell(37, -45 - sw * 2, 4.4, 4));
  line(g, [[39, -48 - sw * 2], [42, -49 - sw * 2]], 1.3);
  g.restore();
  g.restore();
}

// -------------------------------------------------- Überlebende ---
export const SURV = [
  { name: 'LENA', hair: 'long', hairC: '#f2c14e', skin: '#f6c9a0', shirt: '#3a86ff', pants: '#2b2d42', weapon: 'bat' },
  { name: 'MAX', hair: 'cap', hairC: '#2b2b2b', skin: '#c68a5a', shirt: '#43aa8b', pants: '#4a4e69', weapon: 'pan' },
  { name: 'TOBI', hair: 'short', hairC: '#b5523b', skin: '#f2c7a5', shirt: '#9b5de5', pants: '#3d405b', weapon: 'crossbow' },
];
export const EXTRA = [
  { hair: 'bun', hairC: '#3b2a20', skin: '#8d5a3b', shirt: '#f15bb5' },
  { hair: 'short', hairC: '#e9d8a6', skin: '#f6c9a0', shirt: '#00bbf9' },
  { hair: 'cap', hairC: '#c1121f', skin: '#e0a979', shirt: '#fee440' },
  { hair: 'long', hairC: '#2b2b2b', skin: '#a86b45', shirt: '#ff7b00' },
  { hair: 'short', hairC: '#6b3e1f', skin: '#f6c9a0', shirt: '#2ec4b6' },
  { hair: 'bun', hairC: '#d4a373', skin: '#f2c7a5', shirt: '#ef476f' },
  { hair: 'short', hairC: '#1d1d1d', skin: '#6f4430', shirt: '#80b918' },
  { hair: 'long', hairC: '#9d4edd', skin: '#f6c9a0', shirt: '#4361ee' },
];
export function drawSurv(g, x, y, Hpx, o, t = 0) {
  const s = Hpx / 100;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 1.6;
  const sil = o.sil;
  const c = (col) => (sil ? '#4b5170' : col);
  shadow(g, 20);
  for (const sx of [-1, 1]) {
    P(g, c(o.pants || '#3d405b'), lw, rr(sx * 7 - 5, -24, 10, 21, 3));
    P(g, c('#2b2b2b'), lw, ell(sx * 8, -3, 7.5, 3.8));
  }
  const b = Math.sin(t * 2.4 + x) * 0.5;
  g.translate(0, -b);
  if (o.hair === 'long') P(g, c(o.hairC), lw, rr(-20, -88, 40, 46, 14));
  P(g, c(o.shirt), lw, rr(-16, -56, 32, 36, 10));
  // Arme
  limb(g, -15, -52, -19, -32, 7.5, c(o.shirt), lw);
  P(g, c(o.skin), lw, ell(-19.5, -30, 4, 4));
  limb(g, 15, -52, 20, -37, 7.5, c(o.shirt), lw);
  // Kopf
  P(g, c(o.skin), lw, ell(0, -75, 21, 20.5));
  if (sil) {
    label(g, '?', 0, -74, 30, '#c7cbe0', { sw: 0 });
  } else {
    for (const ex of [-8, 8]) {
      P(g, '#fff', 1.2, ell(ex, -75, 5, 6));
      P(g, '#222', 0, ell(ex + 0.6, -74.5, 2.5, 2.8));
      P(g, '#fff', 0, ell(ex + 1.3, -76, 0.8, 0.8));
    }
    line(g, [[-13, -83], [-4, -82]], 2);
    line(g, [[4, -82], [13, -83]], 2);
    g.beginPath();
    g.moveTo(-5, -63);
    g.quadraticCurveTo(0, -59, 5, -63);
    g.lineWidth = 1.6;
    g.strokeStyle = OL;
    g.stroke();
    const hc = o.hairC;
    if (o.hair === 'cap') {
      P(g, hc, lw, (q) => {
        q.moveTo(-21, -80);
        q.quadraticCurveTo(-20, -99, 0, -99);
        q.quadraticCurveTo(20, -99, 21, -80);
        q.closePath();
      });
      P(g, hc, lw, rr(-2, -84, 28, 6, 3));
    } else if (o.hair === 'bun') {
      P(g, hc, lw, ell(0, -99, 9, 8));
      P(g, hc, lw, (q) => {
        q.moveTo(-21, -77);
        q.quadraticCurveTo(-20, -97, 0, -96);
        q.quadraticCurveTo(20, -97, 21, -77);
        q.quadraticCurveTo(10, -88, -21, -77);
      });
    } else if (o.hair === 'long') {
      P(g, hc, lw, (q) => {
        q.moveTo(-21, -72);
        q.quadraticCurveTo(-22, -98, 0, -97);
        q.quadraticCurveTo(22, -98, 21, -72);
        q.quadraticCurveTo(14, -86, -4, -87);
        q.quadraticCurveTo(-16, -84, -21, -72);
      });
    } else {
      P(g, hc, lw, poly([[-21, -77], [-19, -92], [-10, -97], [0, -99], [10, -97], [19, -92], [21, -77], [14, -86], [4, -88], [-6, -87], [-15, -85]]));
    }
  }
  // Waffe in der rechten Hand
  const w = o.weapon;
  if (w === 'bat') {
    g.save();
    g.translate(20, -36);
    g.rotate(-1.25);
    P(g, '#c89055', lw, (q) => {
      q.moveTo(0, -2);
      q.lineTo(40, -4.6);
      q.quadraticCurveTo(46, 0, 40, 4.6);
      q.lineTo(0, 2);
      q.closePath();
    });
    g.restore();
  } else if (w === 'pan') {
    g.save();
    g.translate(20, -36);
    g.rotate(-1.0);
    P(g, '#5a4636', lw, rr(0, -2, 20, 4, 2));
    P(g, '#2f2f35', lw, ell(30, 0, 11, 10));
    P(g, '#48484f', 0, ell(30, 0, 7, 6.5));
    g.restore();
  } else if (w === 'crossbow') {
    g.save();
    g.translate(21, -38);
    P(g, '#7a4b2a', lw, rr(-4, -3, 30, 6, 2));
    g.beginPath();
    g.moveTo(22, -16);
    g.quadraticCurveTo(30, 0, 22, 16);
    g.lineWidth = 3;
    g.strokeStyle = OL;
    g.stroke();
    line(g, [[22, -15], [6, 0], [22, 15]], 0.8, '#ddd');
    g.restore();
  } else if (w === 'axe') {
    g.save();
    g.translate(20, -36);
    g.rotate(-1.2);
    P(g, '#8a5a30', lw, rr(-2, -2, 40, 4, 2));
    P(g, '#b8c0c8', lw, poly([[30, -2], [42, -12], [44, 4], [32, 3]]));
    g.restore();
  } else if (w === 'sword') {
    g.save();
    g.translate(20, -36);
    g.rotate(-1.3);
    P(g, '#3a2a20', lw, rr(-3, -2, 9, 4, 2));
    P(g, '#d0d6dc', lw, poly([[8, -2.6], [44, -1.5], [48, 0], [44, 1.5], [8, 2.6]]));
    P(g, YEL, lw, rr(6, -6, 3, 12, 1));
    g.restore();
  } else if (w === 'shotgun') {
    // (Schrot-)Flinte, quer vor dem Körper; kaputt = Klebeband + Riss
    g.save();
    g.translate(18, -38);
    g.rotate(-0.35);
    P(g, '#8a5a30', lw, (q) => {
      q.moveTo(-14, -3);
      q.lineTo(6, -3);
      q.lineTo(6, 3);
      q.lineTo(-12, 7);
      q.closePath();
    });
    P(g, '#59606b', lw, rr(4, -4.5, 40, 4.5, 1.5));
    P(g, '#6c7480', lw, rr(4, -0.5, 40, 4, 1.5));
    if (o.broken) {
      P(g, '#c9ccd1', 1, rr(20, -5.5, 6, 10.5, 1));
      line(g, [[-9, -2], [-6, 1], [-8, 4]], 0.8, '#3a2412');
      line(g, [[44, -4], [46, -6]], 1, '#59606b');
    }
    g.restore();
  } else if (w === 'shovel') {
    g.save();
    g.translate(20, -36);
    g.rotate(-1.2);
    P(g, '#a0703f', lw, rr(-2, -1.8, 36, 3.6, 1.8));
    P(g, '#8d99a6', lw, (q) => {
      q.moveTo(34, -7);
      q.lineTo(48, -6);
      q.quadraticCurveTo(54, 0, 48, 6);
      q.lineTo(34, 7);
      q.closePath();
    });
    g.restore();
  }
  P(g, c(o.skin), lw, ell(20.5, -36, 4, 4));
  g.restore();
}

// Waffe aus dem Kommentar → gezeichnete Waffe
export function weaponKind(text = '') {
  const w = String(text).toLowerCase();
  if (/flinte|gewehr|shotgun|pistole|knarre|revolver/.test(w)) return 'shotgun';
  if (/pfanne|topf/.test(w)) return 'pan';
  if (/armbrust|bogen|pfeil/.test(w)) return 'crossbow';
  if (/axt|beil/.test(w)) return 'axe';
  if (/schwert|katana|machete|messer|säbel/.test(w)) return 'sword';
  if (/schaufel|spaten|harke|rechen/.test(w)) return 'shovel';
  return 'bat';
}
function hashName(s) {
  let h = 2166136261;
  for (const ch of String(s).toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
  return h;
}
const HAIRS = ['short', 'long', 'cap', 'bun'];
const HAIRC = ['#2b2b2b', '#6b3e1f', '#f2c14e', '#b5523b', '#3b2a20', '#e9d8a6', '#9d4edd', '#c1121f'];
const SKINS = ['#f6c9a0', '#f2c7a5', '#e0a979', '#c68a5a', '#a86b45', '#8d5a3b', '#6f4430'];
const SHIRTS = ['#3a86ff', '#43aa8b', '#9b5de5', '#f15bb5', '#00bbf9', '#fee440', '#ff7b00', '#2ec4b6', '#ef476f', '#80b918', '#4361ee'];
// Verbündeter mit festem Aussehen (gleicher Name → gleiche Figur in jeder Folge)
export function makeAlly(name, weapon = '') {
  const r = rnd(hashName(name) || 1);
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  return {
    name: String(name).toUpperCase().slice(0, 14),
    hair: pick(HAIRS),
    hairC: pick(HAIRC),
    skin: pick(SKINS),
    shirt: pick(SHIRTS),
    pants: pick(['#2b2d42', '#4a4e69', '#3d405b', '#34466b']),
    weapon: weaponKind(weapon),
    weaponText: String(weapon || '').trim(),
    broken: /kaputt|schrott|rostig|alt/i.test(String(weapon || '')),
  };
}
export function nameTag(g, x, y, name, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.font = '44px "Lilita One", sans-serif';
  const w = g.measureText(name).width + 50;
  P(g, '#000', 0, rr(-w / 2, -30 + 7, w, 60, 30));
  P(g, YEL, 5, rr(-w / 2, -30, w, 60, 30));
  label(g, name, 0, 1, 44, DARK, { sw: 0 });
  g.restore();
}

// ------------------------------------------------------- Umgebung ---
const R = rnd(11);
const STARS = Array.from({ length: 70 }, () => [R() * 2400 - 650, R() * 900 - 200, 1.5 + R() * 3, R() * 6]);
export function sky(g, top, mid, bottom, horizon = 1180) {
  g.fillStyle = cached(g, `sky${top}${mid}${bottom}${horizon}`, () => {
    const gr = g.createLinearGradient(0, -400, 0, horizon);
    gr.addColorStop(0, top);
    gr.addColorStop(0.55, mid);
    gr.addColorStop(1, bottom);
    return gr;
  });
  g.fillRect(-1500, -1200, 4100, horizon + 1300);
}
export function stars(g, t, a = 1) {
  for (const [x, y, r, p] of STARS) {
    g.globalAlpha = a * (0.5 + 0.5 * Math.sin(t * 2 + p));
    P(g, '#fff8dc', 0, ell(x, y, r, r));
  }
  g.globalAlpha = 1;
}
export function moon(g, x, y, r) {
  g.save();
  g.globalAlpha = 0.18;
  P(g, '#fff3c4', 0, ell(x, y, r * 1.5, r * 1.5));
  g.globalAlpha = 0.12;
  P(g, '#fff3c4', 0, ell(x, y, r * 2.1, r * 2.1));
  g.restore();
  P(g, '#fff3c4', 7, ell(x, y, r, r));
  P(g, '#f0dc9a', 0, ell(x - r * 0.3, y - r * 0.2, r * 0.18, r * 0.18));
  P(g, '#f0dc9a', 0, ell(x + r * 0.35, y + r * 0.25, r * 0.24, r * 0.24));
  P(g, '#f0dc9a', 0, ell(x + r * 0.1, y - r * 0.45, r * 0.11, r * 0.11));
}
function pine(g, x, y, h, c1, c2, lw = 6) {
  const w = h * 0.4;
  P(g, '#5a3a24', lw, rr(x - w * 0.09, y - h * 0.16, w * 0.18, h * 0.17, 4));
  for (let i = 0; i < 3; i++) {
    const top = y - h + i * h * 0.24;
    const bot = y - h * 0.13 - (2 - i) * h * 0.19;
    const ww = w * (0.5 + i * 0.25);
    P(g, c1, lw, poly([[x, top], [x + ww, bot], [x - ww, bot]]));
    P(g, c2, 0, poly([[x + lw * 0.3, top + lw * 1.4], [x + ww - lw * 1.6, bot - lw * 0.7], [x + ww * 0.2, bot - lw * 0.7]]));
  }
}
const TREES_FAR = Array.from({ length: 26 }, (_, i) => [-700 + i * 105 + (i % 3) * 20, 250 + (i * 37) % 90]);
const TREES_MID = Array.from({ length: 16 }, (_, i) => [-650 + i * 175 + ((i * 53) % 60), 430 + (i * 71) % 140]);
// Wald (Abenddämmerung, mood 0) bis Nacht (mood 1)
const PAL = {
  night: { sky: ['#0f1030', '#2a2552', '#4a3a6a'], hill: '#232647', far: ['#22344a', '#1b2a3d'], mid: ['#24533f', '#1d4434'], ground: '#3e5530', patch: '#46603a', path: '#7a6448', grass: '#2f4a2a' },
  dusk: { sky: ['#2b2350', '#6b3f6e', '#f08a5d'], hill: '#3b3f63', far: ['#2e4a57', '#253f4a'], mid: ['#2f6b4f', '#25573f'], ground: '#5d7a3a', patch: '#6b8a44', path: '#a07f55', grass: '#3f6a2e' },
  day: { sky: ['#5fb2ea', '#8fd0f5', '#d8f1ff'], hill: '#86c45a', far: ['#5aa04a', '#4a8a3c'], mid: ['#3f8f45', '#327a3a'], ground: '#7cb84e', patch: '#8cc85a', path: '#c9a06a', grass: '#4f9a3c' },
};
const CLOUDS = [[-200, 260, 1], [380, 180, 0.8], [900, 300, 1.1], [1500, 220, 0.9]];
// day = Tag (Sonne, Wolken), sonst Dämmerung (mood 0) bzw. Nacht (mood > 0)
export function forest(g, t, { mood = 0, day = false, horizon = 1180, moonAt = [820, 330, 90], path = true, skipMid = null } = {}) {
  const c = day ? PAL.day : mood ? PAL.night : PAL.dusk;
  sky(g, c.sky[0], c.sky[1], c.sky[2], horizon);
  if (day) {
    const [sx, sy] = moonAt || [820, 330];
    g.save();
    g.globalAlpha = 0.25;
    P(g, '#fff6b0', 0, ell(sx, sy, 170, 170));
    g.restore();
    P(g, '#ffd23f', 7, ell(sx, sy, 105, 105));
    for (const [cx, cy, s] of CLOUDS) {
      const x = cx + ((t * 12) % 400);
      P(g, '#ffffff', 6, (q) => {
        q.ellipse(x, cy, 110 * s, 48 * s, 0, 0, TAU);
        q.moveTo(x - 30 * s, cy - 20 * s);
        q.ellipse(x - 30 * s, cy - 20 * s, 62 * s, 50 * s, 0, 0, TAU);
        q.moveTo(x + 50 * s, cy - 14 * s);
        q.ellipse(x + 50 * s, cy - 14 * s, 54 * s, 42 * s, 0, 0, TAU);
      });
    }
  } else {
    stars(g, t, 0.4 + mood * 0.6);
    if (moonAt) moon(g, ...moonAt);
  }
  // ferne Hügel
  P(g, c.hill, 0, (q) => {
    q.moveTo(-1500, horizon);
    for (let x = -1500; x <= 2600; x += 120) q.lineTo(x, horizon - 170 - 60 * Math.sin(x * 0.004) - 30 * Math.sin(x * 0.011));
    q.lineTo(2600, horizon);
    q.closePath();
  });
  for (const [x, h] of TREES_FAR) pine(g, x, horizon + 6, h, c.far[0], c.far[1], 5);
  for (const [x, h] of TREES_MID) if (!skipMid || Math.abs(x - skipMid) > 260) pine(g, x, horizon + 30, h * 1.15, c.mid[0], c.mid[1], 6);
  // Boden
  P(g, c.ground, 6, rr(-1500, horizon + 20, 4100, 1400, 0));
  P(g, c.patch, 0, ell(-200, horizon + 260, 420, 60));
  P(g, c.patch, 0, ell(1250, horizon + 420, 480, 70));
  if (path) {
    P(g, c.path, 5, (q) => {
      q.moveTo(470, horizon + 40);
      q.quadraticCurveTo(420, horizon + 300, 300, horizon + 800);
      q.lineTo(820, horizon + 800);
      q.quadraticCurveTo(640, horizon + 300, 610, horizon + 40);
      q.closePath();
    });
  }
  for (let i = 0; i < 18; i++) {
    const x = -500 + ((i * 197) % 2100);
    const y = horizon + 80 + ((i * 131) % 600);
    line(g, [[x - 10, y], [x - 4, y - 22], [x, y], [x + 6, y - 26], [x + 10, y]], 4, c.grass);
  }
}
export function hut(g, x, y, s, { lit = true, barricade = 0, peek = null, t = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 7;
  g.save();
  g.globalAlpha = 0.25;
  P(g, '#000', 0, ell(0, 10, 340, 34));
  g.restore();
  // Rauch
  for (let i = 0; i < 5; i++) {
    const k = ((t * 0.18 + i / 5) % 1);
    g.save();
    g.globalAlpha = 0.5 * (1 - k);
    P(g, '#c9c3d6', 0, ell(150 + Math.sin(k * 6 + i) * 20 + k * 60, -580 - k * 300, 22 + k * 40, 20 + k * 36));
    g.restore();
  }
  P(g, '#7b6a60', lw, rr(118, -560, 64, 160, 6));
  P(g, '#5f514a', lw, rr(108, -575, 84, 24, 6));
  // Wände
  P(g, '#a8723f', lw, rr(-260, -330, 520, 330, 6));
  for (let i = 1; i < 7; i++) line(g, [[-255, -330 + i * 47], [255, -330 + i * 47]], 3.5, '#7d5230');
  for (const [px, py] of [[-150, -306], [190, -165], [-60, -70], [120, -260]]) line(g, [[px, py], [px + 18, py + 2]], 3, '#6b4426');
  // Dach
  P(g, '#6b3b2a', lw, poly([[-320, -318], [0, -565], [320, -318]]));
  for (let i = 1; i < 4; i++) {
    const yy = -318 - i * 60;
    const half = 320 * (1 - i * 60 / 247);
    line(g, [[-half + 10, yy], [half - 10, yy]], 3.5, '#4f2a1d');
  }
  // Tür
  P(g, '#7a4a26', lw, rr(60, -235, 125, 235, [12, 12, 0, 0]));
  line(g, [[122, -230], [122, -5]], 3, '#5a3418');
  P(g, YEL, 3, ell(165, -115, 7, 7));
  // Fenster
  if (lit) {
    g.save();
    g.globalAlpha = 0.35 + 0.05 * Math.sin(t * 7);
    g.fillStyle = cached(g, 'hutglow', () => {
      const gr = g.createRadialGradient(-115, -180, 20, -115, -180, 230);
      gr.addColorStop(0, 'rgba(255,214,102,0.9)');
      gr.addColorStop(1, 'rgba(255,214,102,0)');
      return gr;
    });
    g.fillRect(-360, -420, 490, 480);
    g.restore();
  }
  P(g, lit ? '#ffd966' : '#2b2b3a', lw, rr(-205, -255, 180, 150, 8));
  if (peek) {
    g.save();
    g.beginPath();
    g.roundRect(-205, -255, 180, 150, 8);
    g.clip();
    P(g, '#ffcf6b', 0, rr(-205, -255, 180, 150, 8));
    drawHero(g, -115 + peek.dx, -10 + peek.dy, 230, { pose: 'stand', mouth: peek.mouth, t, scared: peek.scared, look: -0.8 });
    g.restore();
  }
  line(g, [[-115, -255], [-115, -105]], 6, '#6b4426');
  line(g, [[-205, -180], [-25, -180]], 6, '#6b4426');
  P(g, null, lw, rr(-205, -255, 180, 150, 8));
  // Brennholz
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) P(g, '#b07a45', 4, ell(-215 + j * 38 + i * 19, -18 - i * 34, 18, 17));
  // Verbarrikadiert
  if (barricade > 0) {
    const plank = (cx, cy, len, rot, k) => {
      if (k <= 0) return;
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.scale(k, k);
      P(g, '#c8955c', 5, rr(-len / 2, -16, len, 32, 4));
      P(g, '#555', 0, ell(-len / 2 + 14, 0, 4, 4));
      P(g, '#555', 0, ell(len / 2 - 14, 0, 4, 4));
      g.restore();
    };
    plank(-115, -180, 240, 0.5, clamp(barricade * 3));
    plank(-115, -180, 240, -0.5, clamp(barricade * 3 - 0.6));
    plank(122, -150, 180, 0.35, clamp(barricade * 3 - 1.2));
    plank(122, -70, 180, -0.3, clamp(barricade * 3 - 1.8));
  }
  g.restore();
}
export function apocalypse(g, t) {
  sky(g, '#4a1230', '#c2373a', '#ffb35c', 1150);
  P(g, '#ff6b3d', 0, ell(540, 1060, 260, 260));
  P(g, '#ff8a4d', 0, ell(540, 1060, 200, 200));
  // Rauchsäulen
  for (const [sx, base] of [[170, 0], [820, 1.7], [1010, 3.1]]) {
    for (let i = 0; i < 8; i++) {
      const k = ((t * 0.12 + i / 8 + base) % 1);
      g.save();
      g.globalAlpha = 0.55 * (1 - k);
      P(g, '#3a1d2a', 0, ell(sx + Math.sin(k * 5 + base) * 40 + k * 90, 900 - k * 900, 50 + k * 110, 45 + k * 90));
      g.restore();
    }
  }
  // Stadt-Silhouette
  const B = [[-300, 330], [-180, 470], [-60, 380], [40, 560], [150, 300], [260, 640], [380, 420], [480, 520], [600, 360], [700, 600], [820, 450], [930, 700], [1050, 380], [1160, 520], [1280, 420]];
  for (const [bx, bh] of B) {
    P(g, '#3a1626', 5, rr(bx, 1150 - bh, 110, bh + 20, 4));
    for (let wy = 1150 - bh + 30; wy < 1120; wy += 60)
      for (let wx = bx + 18; wx < bx + 95; wx += 34) if (((wx * 7 + wy * 13) >> 3) % 5 === 0) P(g, '#ffb347', 0, rr(wx, wy, 16, 24, 3));
  }
  P(g, '#5a3a2e', 6, rr(-1500, 1150, 4100, 1200, 0));
  P(g, '#6e4a3a', 0, poly([[380, 1150], [700, 1150], [1300, 2000], [-200, 2000]]));
  for (let i = 0; i < 6; i++) P(g, '#e8c46a', 0, poly([[530 - i * 12, 1200 + i * 130], [550 + i * 12, 1200 + i * 130], [552 + i * 14, 1260 + i * 150], [528 - i * 14, 1260 + i * 150]]));
}
export function burst(g, t, c1 = '#ffcf3f', c2 = '#ffb020') {
  g.fillStyle = c2;
  g.fillRect(-1500, -1500, 4100, 5000);
  g.save();
  g.translate(540, 900);
  g.rotate(t * 0.15);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    P(g, c1, 0, poly([[0, 0], [Math.cos(a) * 3000, Math.sin(a) * 3000], [Math.cos(a + TAU / 36) * 3000, Math.sin(a + TAU / 36) * 3000]]));
  }
  g.restore();
}
export function interior(g, t) {
  g.fillStyle = '#8a5a32';
  g.fillRect(-1500, -1500, 4100, 5000);
  for (let y = -400; y < 2400; y += 95) line(g, [[-1500, y], [2600, y]], 5, '#6b4426');
  // Fenster mit Nacht
  P(g, '#1b1d40', 9, rr(620, 380, 360, 300, 10));
  moon(g, 860, 470, 45);
  stars(g, t, 1);
  line(g, [[800, 380], [800, 680]], 10, '#5a3418');
  line(g, [[620, 530], [980, 530]], 10, '#5a3418');
  P(g, null, 9, rr(620, 380, 360, 300, 10));
  // Laterne
  const fl = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  g.save();
  g.globalAlpha = 0.35 * fl;
  g.fillStyle = cached(g, 'lamp', () => {
    const gr = g.createRadialGradient(200, 820, 10, 200, 820, 420);
    gr.addColorStop(0, 'rgba(255,200,90,1)');
    gr.addColorStop(1, 'rgba(255,200,90,0)');
    return gr;
  });
  g.fillRect(-300, 300, 1000, 1000);
  g.restore();
  P(g, '#4a4a52', 6, rr(160, 760, 80, 20, 6));
  P(g, '#ffd966', 6, rr(170, 780, 60, 80, 10));
  P(g, '#4a4a52', 6, rr(160, 860, 80, 20, 6));
  P(g, '#6b3b2a', 8, rr(40, 880, 340, 40, 8));
  P(g, '#5a3418', 0, rr(-1500, 1520, 4100, 900, 0));
  line(g, [[-1500, 1520], [2600, 1520]], 8);
}
export function vignette(g, a = 0.55) {
  g.fillStyle = cached(g, `vig${a}`, () => {
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(8,6,20,${a})`);
    return vg;
  });
  g.fillRect(0, 0, W, H);
}


// ------------------------------------------------------ Einblendungen ---
export const popIn = (t, t0, t1, d = 0.22) => (t < t0 || t > t1 ? 0 : Math.min(easeOutBack(clamp((t - t0) / d)), clamp((t1 - t) / 0.18)));
export function card(g, x, y, w, h, fill, s, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  P(g, '#000', 0, rr(-w / 2, -h / 2 + 12, w, h, 24));
  P(g, fill, 7, rr(-w / 2, -h / 2, w, h, 24));
}
export function chip(g, x, y, w, fill, text, col = '#fff', size = 40) {
  P(g, '#000', 0, rr(x, y + 8, w, 66, 16));
  P(g, fill, 5, rr(x, y, w, 66, 16));
  label(g, text, x + w / 2, y + 35, size, col, { sw: 0 });
}
export function zombieIcon(g, x, y, r) {
  P(g, ZSK, 4, ell(x, y, r, r));
  P(g, '#fff', 2.5, ell(x - r * 0.35, y - r * 0.05, r * 0.3, r * 0.32));
  P(g, '#fff', 2.5, ell(x + r * 0.38, y, r * 0.18, r * 0.18));
  P(g, '#3a1a1a', 2.5, rr(x - r * 0.3, y + r * 0.35, r * 0.6, r * 0.22, 3));
}
