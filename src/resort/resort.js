// LUXUS-RESORT – Szenen (gleicher 2D-Stil wie Zombie/Verein)
// Ein Manager im Anzug baut mit der Community ein Resort; jeder Follower = ein Besucher.
import * as Z from '../zombie/art.js';
import { prepareVerein } from '../verein/verein.js';

const { P, rr, ell, poly, line, label, clamp, lerp, smooth, easeOutBack, popIn, card, chip, VW, OL } = Z;
const GOLD = '#ffc94a';
const DARK = '#1b1a2e';
const SEA = '#2ec4d6';
const RED = '#e5383b';

export const prepareResort = () => prepareVerein();

// ------------------------------------------------------- Stichwörter ---
const OPTION_RE = /^\s*(?:option\s*)?([a-e1-5])\s*[:)]\s*(.+)$/i;
const BUILD_WORDS = [
  ['hotel', /hotel/],
  ['waterpark', /wasserpark|rutsche/],
  ['villa', /villa/],
  ['pool', /\bpool\b|schwimmbad/],
  ['restaurant', /restaurant|essen gehen/],
];
export function pickResortShot(text, i, n) {
  const low = String(text || '').toLowerCase();
  if (i === n - 1) return 'final';
  if (OPTION_RE.test(text)) return 'option';
  if (/gar nichts|keine gebäude|nicht mal/.test(low)) return 'nothing';
  if (/ihr entscheidet|entscheidet über alles/.test(low)) return 'decide';
  if (/mitarbeiter|chefkoch|animateur|sicherheitschef|stellvertretend/.test(low)) return 'jobs';
  if (/name/.test(low) && /resort|kommentar/.test(low)) return 'name';
  if (/kommentar|likes/.test(low)) return 'comment';
  if (/\d[\d.]*\s*follower\s*=/.test(low)) return 'counter';
  if (/follower/.test(low) && /besucher/.test(low)) return 'visitors';
  if (/schlafen|essen|spaß/.test(low)) return 'needs';
  if (/gar nichts|keine gebäude|nicht mal/.test(low)) return 'nothing';
  if (/weiß nicht|womit|anfangen/.test(low)) return 'confused';
  if (/problem/.test(low)) return 'problem';
  if (/grundstück/.test(low) && /gekauft|riesig/.test(low)) return 'plot';
  if (/ich sage euch|luxuriöseste|machen/.test(low)) return 'promise';
  if (/entscheidet|folgt|folge/.test(low)) return 'decide';
  if (i === 0 || /willkommen|damen und herren/.test(low)) return 'intro';
  return 'talk';
}
function optionOf(text) {
  const m = String(text).match(OPTION_RE);
  if (!m) return null;
  const letter = 'ABCDE'['abcde12345'.indexOf(m[1].toLowerCase()) % 5];
  const low = m[2].toLowerCase();
  const b = BUILD_WORDS.find(([, re]) => re.test(low));
  const build = b ? b[0] : null;
  const name = { hotel: '5-STERNE-HOTEL', waterpark: 'WASSERPARK', villa: 'VIP-VILLA', pool: 'RIESEN-POOL', restaurant: 'RESTAURANT' }[build] || m[2].replace(/[.!?]+$/, '').toUpperCase().slice(0, 22);
  return { letter, build, name };
}

export function createResortVisuals(scenes, opts = {}) {
  const followers = Math.max(0, Math.floor(Number(opts.followers) || 0));
  const options = scenes.map((s) => optionOf(s.text)).filter(Boolean);
  const m = String(scenes.map((s) => s.text).join(' ')).match(/folge\s*(\d+)/i);
  const hud = { folge: m ? Number(m[1]) : 1, visitors: followers };
  const seen = {};
  return scenes.map((sc, i) => {
    const text = sc.text || '';
    const kind = pickResortShot(text, i, scenes.length);
    const k = (seen[kind] = (seen[kind] || 0) + 1) - 1;
    const c = { kind, k, i, text, low: text.toLowerCase(), n: scenes.length, followers, options, option: kind === 'option' ? optionOf(text) : null, optIndex: options.indexOf(options.find((o) => o === optionOf(text))) };
    if (c.option) c.optIndex = options.findIndex((o) => o.letter === c.option.letter);
    return {
      isAnim: true,
      verein: true,
      series: 'resort',
      needsShade: false,
      preferCut: true,
      spec: { place: 'resort', props: [], actors: [] },
      kind,
      sfx: sfxFor(c),
      draw(g, W, H, t, dur, info = {}) {
        g.save();
        g.scale(W / VW, W / VW);
        drawScene(g, t, Math.max(0.5, dur), c, info.mouth || 0);
        Z.vignette(g, 0.3);
        g.restore();
      },
      drawOverlay(g, W, H, t, dur) {
        g.save();
        g.scale(W / VW, W / VW);
        overlays(g, t, Math.max(0.5, dur), c);
        g.restore();
      },
      drawTitle(g, W, H, t) {
        drawResortTitle(g, W, t, hud, kind === 'final');
      },
    };
  });
}

// ------------------------------------------------------------ Kamera ---
function cam(g, cx, cy, z) {
  g.translate(VW / 2, 960);
  g.scale(z, z);
  g.translate(-cx, -cy);
}

// --------------------------------------------------------- Manager ---
// 100 Einheiten hoch, Füße bei y=0
export function drawManager(g, x, y, Hpx, { pose = 'clip', mouth = 0, t = 0, worried = 0 } = {}) {
  const s = Hpx / 100;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 1.6;
  const SUIT = '#1d1f26';
  const SK = '#f2c29b';
  g.save();
  g.globalAlpha = 0.22;
  P(g, '#000', 0, ell(0, 0, 22, 3.5));
  g.restore();
  for (const sx of [-1, 1]) {
    P(g, SUIT, lw, rr(sx * 7 - 5, -25, 10, 22, 3));
    P(g, '#0d0d10', lw, ell(sx * 8, -3, 8, 3.8));
    line(g, [[sx * 8 - 4, -4.5], [sx * 8 + 3, -5]], 0.8, '#555');
  }
  const breath = Math.sin(t * 2.2) * 0.5;
  g.save();
  g.translate(0, -breath);
  // Sakko + Hemd + Krawatte
  P(g, SUIT, lw, rr(-18, -58, 36, 38, 10));
  P(g, '#ffffff', 1.2, poly([[-7, -58], [7, -58], [0, -40]]));
  P(g, '#0d0d10', 0.8, poly([[-2, -55], [2, -55], [3, -43], [0, -39], [-3, -43]]));
  line(g, [[-7, -58], [-3, -38]], 1.4, '#3a3d48');
  line(g, [[7, -58], [3, -38]], 1.4, '#3a3d48');
  P(g, '#ffffff', 0.6, poly([[9, -48], [14, -48], [12, -45]]));
  for (const by of [-34, -28]) P(g, '#3a3d48', 0, ell(0, by, 1.2, 1.2));
  arms(g, pose, lw, t, SUIT, SK);
  g.restore();
  // Kopf
  g.save();
  g.translate(0, -breath);
  P(g, SK, lw, ell(-21.5, -74, 3.6, 4.6));
  P(g, SK, lw, ell(21.5, -74, 3.6, 4.6));
  P(g, SK, lw, ell(0, -76, 22, 21.5));
  // zurückgegelte Haare mit Glanz
  P(g, '#2a211d', lw, (q) => {
    q.moveTo(-21.5, -80);
    q.quadraticCurveTo(-22, -99, -3, -100);
    q.quadraticCurveTo(18, -101, 21.5, -82);
    q.quadraticCurveTo(15, -90, 3, -91);
    q.quadraticCurveTo(-12, -91, -21.5, -80);
    q.closePath();
  });
  line(g, [[-10, -95], [2, -97.5], [11, -95]], 1.1, '#6b5a50');
  // Sonnenbrille
  const wy = worried ? 1.5 : 0;
  P(g, '#141414', lw, rr(-17.5, -81 + wy, 15.5, 9.5, 3.5));
  P(g, '#141414', lw, rr(2, -81 + wy, 15.5, 9.5, 3.5));
  line(g, [[-2.5, -78.5 + wy], [2.5, -78.5 + wy]], 1.6);
  line(g, [[-14.5, -79 + wy], [-11.5, -74.5 + wy]], 1.1, '#fff');
  line(g, [[5, -79 + wy], [8, -74.5 + wy]], 1.1, '#fff');
  if (worried) {
    line(g, [[-15, -86], [-5, -88]], 2);
    line(g, [[5, -88], [15, -86]], 2);
  }
  P(g, '#e6ad84', 1, ell(1, -68.5, 3.2, 2.5));
  const m = clamp(mouth);
  if (m > 0.08) {
    const h = 2 + m * 6;
    P(g, '#7a1f1f', 1.3, rr(-6.5, -64, 13, h, Math.min(4, h / 2)));
    P(g, '#fff', 0, rr(-5, -63.6, 10, 1.6, 0.8));
  } else if (worried) {
    line(g, [[-5, -61], [-2, -62.5], [2, -61], [5, -62.5]], 1.5);
  } else {
    g.beginPath();
    g.moveTo(-6, -62.5);
    g.quadraticCurveTo(1, -59.5, 7, -63.5);
    g.lineWidth = 1.6;
    g.strokeStyle = OL;
    g.lineCap = 'round';
    g.stroke();
  }
  g.restore();
  g.restore();
}
function limb(g, x1, y1, x2, y2, w, color, lw) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = Math.hypot(x2 - x1, y2 - y1);
  g.save();
  g.translate(x1, y1);
  g.rotate(a);
  P(g, color, lw, rr(-w / 2, -w / 2, L + w, w, w / 2));
  g.restore();
}
function watch(g, x, y) {
  P(g, '#c9a227', 1, rr(x - 4, y - 2.2, 8, 4.4, 1.5));
  P(g, '#f4f1e6', 0.6, ell(x, y, 1.8, 1.8));
}
function arms(g, pose, lw, t, SUIT, SK) {
  const down = (sx) => {
    limb(g, sx * 17, -54, sx * 20, -33, 8.5, SUIT, lw);
    P(g, SK, lw, ell(sx * 20.5, -30, 4.3, 4.3));
  };
  if (pose === 'clip') {
    // Klemmbrett im linken Arm, rechte Hand erklärt
    limb(g, -17, -54, -12, -38, 8.5, SUIT, lw);
    g.save();
    g.translate(-14, -40);
    g.rotate(-0.25);
    P(g, '#b5844f', lw, rr(-8, -12, 16, 22, 2));
    P(g, '#fff', 0.6, rr(-6, -8, 12, 16, 1));
    for (let i = 0; i < 4; i++) line(g, [[-4, -5 + i * 4], [4, -5 + i * 4]], 0.6, '#9aa');
    P(g, '#888', 0.6, rr(-3, -13, 6, 3, 1));
    g.restore();
    P(g, SK, lw, ell(-9, -36, 4, 4));
    const k = Math.sin(t * 3) * 2;
    limb(g, 17, -54, 26, -40 + k, 8.5, SUIT, lw);
    P(g, SK, lw, ell(28, -39 + k, 4.3, 4.3));
    watch(g, 24, -41 + k);
  } else if (pose === 'crossed') {
    limb(g, -17, -54, -18, -40, 8.5, SUIT, lw);
    limb(g, 17, -54, 18, -40, 8.5, SUIT, lw);
    P(g, SUIT, lw, rr(-20, -44, 36, 8, 4));
    P(g, SK, lw, ell(-17, -43, 3.5, 3.5));
    P(g, SUIT, lw, rr(-16, -39, 36, 8, 4));
    P(g, SK, lw, ell(18, -38, 3.5, 3.5));
    watch(g, 12, -38);
  } else if (pose === 'scratch') {
    down(-1);
    limb(g, 17, -54, 22, -80, 8.5, SUIT, lw);
    P(g, SK, lw, ell(20, -85, 4.3, 4.3));
  } else if (pose === 'point') {
    down(-1);
    limb(g, 15, -50, 9, -42, 8.5, SUIT, lw);
    P(g, SK, lw, ell(6, -40, 7.5, 7));
    P(g, SK, lw, ell(4.5, -44.5, 3.4, 3.4));
    watch(g, 12, -44);
  } else {
    // offen: beide Arme ausgebreitet
    const k = Math.sin(t * 3) * 1.5;
    limb(g, -17, -54, -32, -42 + k, 8.5, SUIT, lw);
    P(g, SK, lw, ell(-34, -41 + k, 4.3, 4.3));
    limb(g, 17, -54, 32, -42 - k, 8.5, SUIT, lw);
    P(g, SK, lw, ell(34, -41 - k, 4.3, 4.3));
    watch(g, 29, -43 - k);
  }
}

// ------------------------------------------------------- Umgebung ---
const GC = new WeakMap();
function grad(g, key, make) {
  let m = GC.get(g);
  if (!m) GC.set(g, (m = new Map()));
  if (!m.has(key)) m.set(key, make());
  return m.get(key);
}
function palm(g, x, y, h, t, lean = 1) {
  g.save();
  g.translate(x, y);
  const sway = Math.sin(t * 1.3 + x) * 0.04;
  P(g, '#a87443', 5, (q) => {
    q.moveTo(-10, 0);
    q.quadraticCurveTo(lean * h * 0.25 - 8, -h * 0.5, lean * h * 0.15, -h);
    q.lineTo(lean * h * 0.15 + 14, -h + 4);
    q.quadraticCurveTo(lean * h * 0.25 + 10, -h * 0.5, 12, 0);
    q.closePath();
  });
  g.translate(lean * h * 0.15 + 7, -h);
  g.rotate(sway);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI + (i / 5) * Math.PI;
    g.save();
    g.rotate(a);
    P(g, i % 2 ? '#3fa34d' : '#2f8f3f', 4, (q) => {
      q.moveTo(0, 0);
      q.quadraticCurveTo(h * 0.25, -h * 0.12, h * 0.45, h * 0.06);
      q.quadraticCurveTo(h * 0.25, h * 0.02, 0, 0);
    });
    g.restore();
  }
  P(g, '#6b4426', 3, ell(-4, 6, 7, 7));
  P(g, '#6b4426', 3, ell(6, 8, 7, 7));
  g.restore();
}
// Grundstück am Meer: Himmel, Sonne, Meer, Strand, Wiese mit Pflöcken und Seil
function land(g, t, { stakes = true, sold = true } = {}) {
  g.fillStyle = grad(g, 'sky', () => {
    const gr = g.createLinearGradient(0, -400, 0, 1000);
    gr.addColorStop(0, '#3fa9f5');
    gr.addColorStop(1, '#bfeaff');
    return gr;
  });
  g.fillRect(-1500, -1200, 4100, 2200);
  P(g, '#fff6b0', 0, ell(820, 300, 150, 150));
  P(g, '#ffd23f', 7, ell(820, 300, 100, 100));
  for (const [cx, cy, s] of [[200, 260, 1], [560, 180, 0.8], [1100, 320, 1.1], [-300, 340, 0.9]]) {
    const x = cx + ((t * 10) % 300);
    P(g, '#fff', 6, (q) => {
      q.ellipse(x, cy, 110 * s, 46 * s, 0, 0, Math.PI * 2);
      q.moveTo(x - 30 * s, cy - 22 * s);
      q.ellipse(x - 30 * s, cy - 22 * s, 60 * s, 48 * s, 0, 0, Math.PI * 2);
    });
  }
  // Meer
  P(g, SEA, 0, rr(-1500, 1000, 4100, 140, 0));
  for (let i = 0; i < 18; i++) {
    const x = -500 + i * 140 + ((t * 30) % 140);
    line(g, [[x, 1040 + (i % 3) * 30], [x + 40, 1034 + (i % 3) * 30]], 4, '#bff4ff');
  }
  // Strand + Wiese
  P(g, '#f4dca0', 0, rr(-1500, 1130, 4100, 90, 0));
  P(g, '#8cd06a', 6, rr(-1500, 1210, 4100, 1200, 0));
  for (let i = 0; i < 14; i++) {
    const x = -400 + ((i * 211) % 1900);
    const y = 1260 + ((i * 97) % 600);
    P(g, '#9edb7a', 0, ell(x, y, 80, 20));
  }
  palm(g, -40, 1220, 420, t, 1);
  palm(g, 1120, 1220, 460, t, -1);
  palm(g, 80, 1160, 300, t, 1);
  if (stakes) {
    // Pflöcke mit Absperrseil
    const pts = [];
    for (let i = 0; i < 9; i++) pts.push([60 + i * 120, 1290 + Math.sin(i) * 6]);
    line(g, pts.map(([x, y]) => [x, y - 50]), 3, '#e5383b');
    for (const [x, y] of pts) P(g, '#c8955c', 3, rr(x - 5, y - 62, 10, 64, 2));
  }
  if (sold) {
    g.save();
    g.translate(880, 1400);
    g.rotate(0.05);
    P(g, '#7a4b2a', 5, rr(-8, -40, 16, 140, 3));
    P(g, '#fff', 6, rr(-120, -150, 240, 110, 12));
    label(g, 'VERKAUFT!', 0, -95, 48, RED, { sw: 0 });
    g.restore();
  }
}
// Gebäude-Vorschau (die 5 Bau-Optionen)
function building(g, kind, x, y, s, t) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  if (kind === 'hotel') {
    P(g, '#f4f1e6', 6, rr(-150, -420, 300, 420, 10));
    for (let r = 0; r < 7; r++) for (let cI = 0; cI < 4; cI++) P(g, (r + cI) % 3 ? '#7ec8ff' : '#ffe08a', 3, rr(-120 + cI * 64, -390 + r * 54, 40, 34, 4));
    P(g, '#c9a227', 5, rr(-60, -60, 120, 60, [20, 20, 0, 0]));
    P(g, DARK, 5, rr(-130, -480, 260, 60, 14));
    for (let i = 0; i < 5; i++) label(g, '★', -96 + i * 48, -449, 44, GOLD, { sw: 0 });
  } else if (kind === 'waterpark') {
    P(g, '#ff7b00', 6, rr(-40, -380, 80, 380, 8));
    P(g, '#fff', 5, rr(-60, -400, 120, 30, 8));
    const slide = (col, dir, off) => {
      g.beginPath();
      g.moveTo(dir * 40, -360 + off);
      g.bezierCurveTo(dir * 220, -320 + off, dir * 30, -200 + off, dir * 200, -40);
      g.lineWidth = 34;
      g.strokeStyle = OL;
      g.lineCap = 'round';
      g.stroke();
      g.lineWidth = 24;
      g.strokeStyle = col;
      g.stroke();
    };
    slide('#e5383b', 1, 0);
    slide('#3a86ff', -1, 40);
    slide('#ffd23f', 1, 150);
    P(g, SEA, 5, rr(-260, -30, 520, 40, 18));
  } else if (kind === 'villa') {
    P(g, '#ffffff', 6, rr(-200, -200, 400, 200, 8));
    P(g, '#ffffff', 6, rr(-120, -330, 260, 140, 8));
    P(g, '#7ec8ff', 4, rr(-100, -310, 220, 90, 4));
    P(g, '#7ec8ff', 4, rr(-180, -170, 160, 120, 4));
    P(g, '#3a2a20', 4, rr(40, -150, 70, 150, 4));
    P(g, '#2b2b2b', 5, rr(-210, -210, 420, 18, 6));
    P(g, '#2b2b2b', 5, rr(-130, -342, 280, 18, 6));
    label(g, 'VIP', 150, -120, 54, GOLD, { sw: 8 });
  } else if (kind === 'pool') {
    P(g, '#d9d4c7', 6, rr(-260, -90, 520, 110, 50));
    P(g, SEA, 5, rr(-230, -78, 460, 86, 40));
    for (let i = 0; i < 5; i++) {
      const xx = -180 + i * 90 + Math.sin(t * 2 + i) * 8;
      line(g, [[xx, -40], [xx + 40, -46]], 4, '#bff4ff');
    }
    line(g, [[200, -95], [200, -40]], 5, '#b0b6bd');
    line(g, [[222, -95], [222, -40]], 5, '#b0b6bd');
    for (let i = 0; i < 3; i++) line(g, [[200, -80 + i * 14], [222, -80 + i * 14]], 4, '#b0b6bd');
    P(g, '#e5383b', 4, poly([[-300, -10], [-300, -150], [-230, -120]]));
    line(g, [[-300, -10], [-300, -160]], 5);
  } else if (kind === 'restaurant') {
    P(g, '#ffe8c2', 6, rr(-200, -260, 400, 260, 8));
    for (let i = 0; i < 8; i++) P(g, i % 2 ? '#e5383b' : '#fff', 4, poly([[-210 + i * 52.5, -270], [-210 + (i + 1) * 52.5, -270], [-210 + (i + 1) * 52.5, -200], [-210 + i * 52.5, -230]]));
    P(g, '#7ec8ff', 4, rr(-170, -170, 140, 100, 6));
    P(g, '#7a4b2a', 4, rr(30, -170, 90, 170, 6));
    P(g, DARK, 5, rr(-110, -350, 220, 64, 14));
    label(g, 'RESTAURANT', 0, -318, 36, GOLD, { sw: 0 });
  }
  g.restore();
}
function drawTourists(g, n, t, { y0 = 1500, spread = 1, walk = 0 } = {}) {
  const rows = [[1360, 150, 70], [1450, 180, 82], [1560, 215, 96], [1690, 255, 112]];
  let idx = 0;
  for (const [ry, h, sp] of rows) {
    for (let x = 40 + (idx % 2) * sp * 0.4; x < 1060 && idx < n; x += sp * spread) {
      const o = Z.makeAlly(`Gast${idx}`, idx % 3 ? 'Koffer' : '');
      const off = walk ? ((t * 60 + idx * 37) % 200) - 100 : 0;
      Z.drawSurv(g, x + off, ry + (y0 - 1500), h, o, t + idx);
      idx++;
    }
  }
}

// ----------------------------------------------------------- Szenen ---
function drawScene(g, t, dur, c, mo) {
  const k = clamp(t / dur);
  g.save();
  switch (c.kind) {
    case 'intro': {
      // Manager läuft mit Klemmbrett über das Grundstück
      cam(g, lerp(420, 560, k), 1250, lerp(1.0, 1.08, k));
      land(g, t);
      const x = lerp(220, 560, smooth(clamp(k * 1.4)));
      drawManager(g, x, 1700 - Math.abs(Math.sin(t * 6)) * (k < 0.7 ? 10 : 0), 520, { pose: 'clip', mouth: mo, t });
      break;
    }
    case 'plot': {
      cam(g, 540, lerp(1250, 1180, k), lerp(0.9, 0.75, smooth(k)));
      land(g, t);
      drawManager(g, 540, 1720, 300, { pose: 'open', mouth: mo, t });
      break;
    }
    case 'problem':
    case 'confused': {
      cam(g, 540, 1180, lerp(1.25, 1.35, k));
      land(g, t, { stakes: false, sold: false });
      drawManager(g, 540, 1980, 900, { pose: c.kind === 'confused' ? 'scratch' : 'clip', mouth: mo, t, worried: 1 });
      if (c.kind === 'confused') for (let i = 0; i < 3; i++) label(g, '?', 300 + i * 220, 700 - Math.abs(Math.sin(t * 3 + i)) * 40, 140, GOLD, { sw: 16, rot: (i - 1) * 0.2 });
      break;
    }
    case 'nothing': {
      cam(g, 540, 1250, 0.95);
      land(g, t);
      // Steppenläufer rollt übers leere Grundstück
      const tx = ((t * 260) % 1600) - 200;
      g.save();
      g.translate(tx, 1640);
      g.rotate(t * 5);
      for (let i = 0; i < 9; i++) line(g, [[Math.cos(i) * 40, Math.sin(i * 2) * 40], [Math.cos(i + 2) * 40, Math.sin(i * 2 + 1) * 40]], 4, '#a87443');
      g.restore();
      drawManager(g, 760, 1760, 360, { pose: 'open', mouth: mo, t, worried: 1 });
      break;
    }
    case 'visitors': {
      cam(g, 540, 1300, 1.0);
      land(g, t, { sold: false });
      drawTourists(g, Math.ceil(clamp((t - 0.4) / Math.max(1, dur - 1)) * 18), t, { walk: 1 });
      drawManager(g, 540, 1800, 360, { pose: 'open', mouth: mo, t });
      break;
    }
    case 'counter':
    case 'needs': {
      cam(g, 540, 1300, lerp(1.0, 0.95, k));
      land(g, t, { sold: false });
      drawTourists(g, c.kind === 'counter' ? Math.ceil(clamp((t - 0.3) / 1.6) * 30) : 30, t, { spread: 0.9 });
      if (c.kind === 'needs') {
        // Gedankenblasen: Bett, Essen, Spaß
        ['BETT', 'ESSEN', 'SPASS'].forEach((w, i) => {
          const a = easeOutBack(clamp((t - 0.5 - i * 0.6) / 0.35));
          if (a <= 0) return;
          g.save();
          g.translate(220 + i * 320, 1180);
          g.scale(a, a);
          P(g, '#fff', 6, ell(0, 0, 130, 80));
          P(g, '#fff', 5, ell(-40, 100, 18, 14));
          P(g, '#fff', 4, ell(-60, 135, 10, 8));
          label(g, w, 0, 4, 52, DARK, { sw: 0 });
          g.restore();
        });
      }
      drawManager(g, 540, 1830, 340, { pose: 'clip', mouth: mo, t });
      break;
    }
    case 'option': {
      cam(g, 540, 1250, 0.95);
      land(g, t, { sold: false });
      const a = easeOutBack(clamp((t - 0.2) / 0.5));
      if (c.option?.build) building(g, c.option.build, 470, 1720, 1.3 * a, t);
      drawManager(g, 900, 1860, 360, { pose: 'point', mouth: mo, t });
      break;
    }
    case 'comment':
    case 'name': {
      cam(g, 540, 960, 1);
      land(g, t, { sold: false });
      g.fillStyle = 'rgba(10,20,40,0.3)';
      g.fillRect(-100, -100, 1300, 2200);
      drawManager(g, 820, 2050, 700, { pose: 'point', mouth: mo, t });
      break;
    }
    case 'jobs': {
      cam(g, 540, 1250, 0.95);
      land(g, t, { sold: false });
      drawManager(g, 870, 1820, 340, { pose: 'clip', mouth: mo, t });
      break;
    }
    case 'promise': {
      cam(g, 540, 1180, lerp(1.0, 1.15, k));
      land(g, t);
      // Gold-Glanz
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t;
        label(g, '✦', 540 + Math.cos(a) * 380, 1400 + Math.sin(a) * 260, 60, GOLD, { sw: 0 });
      }
      drawManager(g, 540, 1900, 700, { pose: 'crossed', mouth: mo, t });
      break;
    }
    case 'decide': {
      const z = lerp(1.15, 1.0, easeOutBack(clamp(t / 0.45)));
      cam(g, 540, 960, z);
      Z.burst(g, t, '#ffe08a', GOLD);
      drawManager(g, 540, 2280, 1650, { pose: 'point', mouth: mo, t });
      break;
    }
    case 'final': {
      cam(g, 540, 1150, lerp(0.95, 1.05, k));
      land(g, t);
      drawManager(g, 540, 1800, 480, { pose: 'open', mouth: mo, t });
      break;
    }
    default: {
      cam(g, 540, 1200, 1.1);
      land(g, t);
      drawManager(g, 540, 1800, 520, { pose: 'clip', mouth: mo, t });
    }
  }
  g.restore();
}

// ---------------------------------------------------- Einblendungen ---
const JOBS = [
  ['STELLV. MANAGER', /stellvertret/],
  ['CHEFKOCH', /chefkoch|koch/],
  ['POOL-MANAGER', /pool-?manager/],
  ['SICHERHEITSCHEF', /sicherheit/],
  ['ANIMATEUR', /animateur/],
];
function overlays(g, t, dur, c) {
  if (c.i === 0) {
    if (t < 3.5) return;
    t -= 3.5;
    dur = Math.max(0.6, dur - 3.5);
  }
  const end = dur - 0.15;
  const simple = (txt, fill = DARK, col = GOLD, y = 400) => {
    const a = popIn(t, 0.15, end);
    if (a <= 0) return;
    card(g, VW / 2, y, 920, 170, fill, a, -0.02);
    g.font = '80px "Lilita One", sans-serif';
    label(g, txt, 0, 4, Math.min(80, (80 * 840) / g.measureText(txt).width), col, { sw: 0 });
    g.restore();
  };
  switch (c.kind) {
    case 'intro':
      simple('HERZLICH WILLKOMMEN!');
      break;
    case 'plot':
      simple('RIESIGES GRUNDSTÜCK!');
      break;
    case 'problem':
      simple('KLEINES PROBLEM …', RED, '#fff');
      break;
    case 'confused':
      simple('WOMIT FANGEN WIR AN?', RED, '#fff');
      break;
    case 'nothing': {
      const items = ['GEBÄUDE', 'MITARBEITER', 'NAME', 'POOL'];
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 520, 760, 520, '#fff', a, -0.02);
        label(g, 'WIR HABEN NOCH:', 0, -200, 54, DARK, { sw: 0 });
        items.forEach((it, i) => {
          const b = clamp((t - 0.6 - i * 0.45) / 0.2);
          if (b <= 0) return;
          label(g, it, -60, -100 + i * 95, 60, DARK, { sw: 0 });
          label(g, '✗', 250, -100 + i * 95, 80 * easeOutBack(b), RED, { sw: 0 });
        });
        g.restore();
      }
      break;
    }
    case 'visitors':
      simple('1 FOLLOWER = 1 BESUCHER!');
      break;
    case 'counter': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const nums = (c.text.match(/\d[\d.]*/g) || ['100']).map((x) => Number(x.replace(/\./g, '')));
        const top = Math.max(...nums);
        const n = Math.round(top * smooth(clamp((t - 0.2) / Math.max(0.8, end - 0.6))));
        card(g, VW / 2, 430, 900, 240, DARK, a, -0.02);
        label(g, `${n.toLocaleString('de-DE')} FOLLOWER =`, 0, -46, 76, '#fff', { sw: 0 });
        label(g, `${n.toLocaleString('de-DE')} BESUCHER!`, 0, 50, 84, GOLD, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'needs':
      simple('SCHLAFEN · ESSEN · SPASS');
      break;
    case 'option': {
      const o = c.option;
      const a = popIn(t, 0.1, end);
      if (a > 0 && o) {
        const cols = ['#ffd23f', '#3a86ff', '#ff7b00', '#2ec4b6', '#e5383b'];
        card(g, VW / 2, 400, 940, 180, cols[c.optIndex % 5], a, c.optIndex % 2 ? 0.02 : -0.02);
        P(g, '#fff', 6, ell(-370, 0, 64, 64));
        label(g, o.letter, -370, 6, 90, DARK, { sw: 0 });
        g.font = '70px "Lilita One", sans-serif';
        label(g, o.name, 70, 4, Math.min(70, (70 * 680) / g.measureText(o.name).width), c.optIndex === 0 ? DARK : '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'comment':
    case 'name': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 380, 920, 150, GOLD, a, -0.02);
        label(g, c.kind === 'name' ? 'WIE HEISST UNSER RESORT?' : 'MEISTE LIKES ENTSCHEIDET!', 0, 4, 62, DARK, { sw: 0 });
        g.restore();
      }
      const list = c.kind === 'name'
        ? [['Lena', 'Palm Paradise Resort!', '#3a86ff', '402'], ['Max', 'Golden Beach Club', '#43aa8b', '276'], ['Tobi', 'Resort de Luxe', '#9b5de5', '188']]
        : [['Lena', 'Wasserpark zuerst!!', '#3a86ff', '356'], ['Max', 'Pool, ganz klar', '#43aa8b', '241'], ['Tobi', 'Das 5-Sterne-Hotel', '#9b5de5', '178']];
      commentPanel(g, t, list);
      break;
    }
    case 'jobs': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 330, 880, 140, RED, a, -0.02);
        label(g, 'MITARBEITER GESUCHT!', 0, 4, 70, '#fff', { sw: 0 });
        g.restore();
      }
      const jobs = JOBS.filter(([, re]) => re.test(c.low));
      (jobs.length ? jobs : JOBS).forEach(([nm], i) => {
        const b = popIn(t, 0.5 + i * 0.35, end);
        if (b <= 0) return;
        card(g, VW / 2 - 80, 500 + i * 120, 680, 100, '#fff', b, 0);
        P(g, '#4b5170', 4, ell(-280, 0, 36, 36));
        label(g, '?', -280, 3, 48, '#c7cbe0', { sw: 0 });
        label(g, nm, 40, 3, 52, DARK, { sw: 0 });
        g.restore();
      });
      break;
    }
    case 'promise':
      simple('DAS LUXURIÖSESTE RESORT DER WELT!', DARK, GOLD);
      break;
    case 'decide':
      simple('IHR ENTSCHEIDET ÜBER ALLES!', DARK, GOLD);
      break;
    case 'final':
      simple('WILLKOMMEN IN UNSEREM RESORT!', DARK, GOLD);
      endCard(g, t, dur, c);
      break;
    default:
  }
}
function commentPanel(g, t, list) {
  const k = smooth(clamp((t - 0.2) / 0.4));
  if (k <= 0) return;
  g.save();
  g.translate(0, (1 - k) * 700);
  P(g, '#000', 0, rr(50, 620, 980, 580, 34));
  P(g, '#ffffff', 6, rr(50, 610, 980, 580, 34));
  label(g, 'Kommentare', VW / 2, 668, 40, DARK, { sw: 0 });
  line(g, [[90, 712], [990, 712]], 3, '#e3e3ea');
  list.forEach(([n, txt, col, likes], i) => {
    const a = easeOutBack(clamp((t - 0.7 - i * 0.7) / 0.3));
    if (a <= 0) return;
    const y = 790 + i * 140;
    g.save();
    g.translate(110, y);
    g.scale(a, a);
    P(g, col, 4, ell(0, 0, 40, 40));
    label(g, n[0], 0, 2, 44, '#fff', { sw: 0 });
    g.restore();
    g.save();
    g.globalAlpha = clamp(a);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = '30px "Lilita One", sans-serif';
    g.fillStyle = '#8a8a99';
    g.fillText(n, 175, y - 26);
    g.font = '40px "Lilita One", sans-serif';
    g.fillStyle = DARK;
    g.fillText(txt, 175, y + 18);
    g.fillStyle = '#fe2c55';
    g.beginPath();
    const hx = 965;
    const hy = y - 12;
    g.moveTo(hx, hy + 12);
    g.bezierCurveTo(hx - 22, hy - 4, hx - 10, hy - 20, hx, hy - 8);
    g.bezierCurveTo(hx + 10, hy - 20, hx + 22, hy - 4, hx, hy + 12);
    g.fill();
    g.font = '26px "Lilita One", sans-serif';
    g.fillStyle = '#8a8a99';
    g.textAlign = 'center';
    g.fillText(likes, hx, y + 30);
    g.restore();
  });
  g.restore();
}
function endCard(g, t, dur, c) {
  const k = clamp((t - Math.max(dur * 0.45, dur - 2.6)) / 0.5);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = smooth(k) * 0.9;
  g.fillStyle = '#10142a';
  g.fillRect(0, 0, VW, 1920);
  g.restore();
  const s = easeOutBack(k);
  g.save();
  g.translate(VW / 2, 0);
  g.scale(s, s);
  label(g, 'WIR BAUEN EIN', 0, 300, 84, '#ffffff', { sw: 14 });
  label(g, 'LUXUS-RESORT', 0, 405, 110, GOLD, { sw: 16 });
  const rows = [['KOMMENTIERE: WAS BAUEN WIR ZUERST?', GOLD], ['+ NAMEN FÜRS RESORT!', '#fff'], [`BESUCHER: ${c.followers}`, '#7ddc4a']];
  rows.forEach(([x, col], i) => {
    P(g, '#000', 0, rr(-440, 520 + i * 135 + 10, 880, 108, 24));
    P(g, '#22203d', 6, rr(-440, 520 + i * 135, 880, 108, 24));
    g.font = '50px "Lilita One", sans-serif';
    label(g, x, 0, 575 + i * 135, Math.min(50, (50 * 820) / g.measureText(x).width), col, { sw: 0 });
  });
  label(g, 'JEDER FOLLOWER =', 0, 990, 62, '#ffffff', { sw: 10 });
  label(g, 'EIN BESUCHER', 0, 1070, 74, GOLD, { sw: 12 });
  const pk = 1 + 0.04 * Math.sin(t * 8);
  g.save();
  g.translate(0, 1580);
  g.scale(pk, pk);
  P(g, '#000', 0, rr(-360, -50, 720, 120, 60));
  P(g, '#fe2c55', 6, rr(-360, -60, 720, 120, 60));
  label(g, '+ FOLGEN & EINCHECKEN', 0, 1, 52, '#ffffff', { sw: 0 });
  g.restore();
  g.restore();
}
function drawResortTitle(g, W, t, hud, hide) {
  g.save();
  g.scale(W / VW, W / VW);
  if (t < 3.4) {
    const a = popIn(t, 0.35, 3.3, 0.35);
    if (a > 0) {
      g.save();
      g.translate(VW / 2, 330);
      g.scale(a, a);
      g.rotate(-0.04);
      label(g, `FOLGE ${hud.folge}`, 0, 0, 150, GOLD, { sw: 24 });
      g.restore();
      card(g, VW / 2, 560, 960, 220, DARK, a, 0.02);
      label(g, 'WIR BAUEN EIN', 0, -46, 76, '#ffffff', { sw: 0 });
      label(g, 'LUXUS-RESORT!', 0, 48, 92, GOLD, { sw: 0 });
      g.restore();
    }
  } else if (!hide) {
    chip(g, 36, 150, 240, DARK, `FOLGE ${hud.folge}`, GOLD, 44);
    chip(g, VW - 336, 150, 300, '#2ec4b6', `BESUCHER: ${hud.visitors}`, '#fff', 38);
  }
  g.restore();
}

// ------------------------------------------------------- Geräusche ---
function sfxFor(c) {
  const out = [];
  const add = (at, type) => out.push({ at, type });
  switch (c.kind) {
    case 'intro':
      add(0.2, 'whistle');
      add(0.5, 'cheer');
      break;
    case 'plot':
      add(0.2, 'whoosh');
      add(0.6, 'ding');
      break;
    case 'problem':
    case 'confused':
      add(0.1, 'trombone');
      break;
    case 'nothing':
      for (let i = 0; i < 4; i++) add(0.6 + i * 0.45, 'error');
      break;
    case 'visitors':
    case 'counter':
      for (let i = 0; i < 6; i++) add(0.4 + i * 0.3, 'pop');
      break;
    case 'option':
      add(0.1, 'whoosh');
      add(0.3, 'ding');
      break;
    case 'jobs':
      for (let i = 0; i < 5; i++) add(0.5 + i * 0.35, 'pop');
      break;
    case 'comment':
    case 'name':
      for (let i = 0; i < 3; i++) add(0.7 + i * 0.7, 'pop');
      break;
    case 'promise':
      add(0.2, 'chirp');
      break;
    case 'decide':
      add(0.02, 'whoosh');
      add(0.1, 'ding');
      break;
    case 'final':
      add(0.2, 'cheer');
      break;
    default:
  }
  return out;
}
