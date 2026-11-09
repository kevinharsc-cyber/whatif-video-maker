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
  ['tower', /hochhaus|wolkenkratzer|turm-?hotel/],
  ['corner', /eckgebäude|eck-?hotel|l-form/],
  ['shape', /formgebäude|form-?hotel|fischform|in form/],
  ['hotel', /hotel/],
  ['waterpark', /wasserpark|rutsche/],
  ['villa', /villa/],
  ['pool', /\bpool\b|schwimmbad/],
  ['restaurant', /restaurant|essen gehen/],
];
export function pickResortShot(text, i, n) {
  const low = String(text || '').toLowerCase();
  if (i === n - 1) return 'final';
  if (i === 0 && /kasse|euro|€/.test(low) && /\d/.test(low)) return 'money';
  if (i === 0) return 'intro';
  if (OPTION_RE.test(text)) return 'option';
  if (/gar nichts|keine gebäude|nicht mal/.test(low)) return 'nothing';
  if (/ihr entscheidet|entscheidet über alles/.test(low)) return 'decide';
  if (/mitarbeiter|chefkoch|animateur|sicherheitschef|stellvertretend/.test(low)) return 'jobs';
  if (/name/.test(low) && /resort|kommentar/.test(low)) return 'name';
  if (/kommentar|likes|stimmt ab|abstimm/.test(low)) return 'comment';
  if (/kasse|euro|€/.test(low) && /\d/.test(low)) return 'money';
  if (/\d[\d.]*\s*follower\s*=/.test(low) || (/\d[\d.]*\s*follower/.test(low) && /besucher|gäste|gast/.test(low))) return 'counter';
  if (/follower/.test(low) && /besucher|gast|gäste/.test(low)) return 'visitors';
  if (/schlafen|essen|spaß/.test(low)) return 'needs';
  if (/gar nichts|keine gebäude|nicht mal/.test(low)) return 'nothing';
  if (/weiß nicht|womit|anfangen|welches/.test(low)) return 'confused';
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
  const name = { tower: 'HOCHHAUS-HOTEL', corner: 'ECKGEBÄUDE (L-FORM)', shape: 'FORMGEBÄUDE', hotel: '5-STERNE-HOTEL', waterpark: 'WASSERPARK', villa: 'VIP-VILLA', pool: 'RIESEN-POOL', restaurant: 'RESTAURANT' }[build] || m[2].replace(/[.!?]+$/, '').toUpperCase().slice(0, 22);
  return { letter, build, name };
}

export function createResortVisuals(scenes, opts = {}) {
  const followers = Math.max(0, Math.floor(Number(opts.followers) || 0));
  const options = scenes.map((s) => optionOf(s.text)).filter(Boolean);
  const m = String(scenes.map((s) => s.text).join(' ')).match(/folge\s*(\d+)/i);
  const all = scenes.map((s) => String(s.text || '')).join(' ');
  const per = (() => {
    const a = all.match(/pro follower[^.!?]*?(\d[\d.]*)\s*(k|tausend)?\s*(?:euro|€)/i) || all.match(/(\d[\d.]*)\s*(k|tausend)?\s*(?:euro|€)?\s*pro follower/i);
    if (!a) return Number(opts.perFollower) || 0;
    return Number(a[1].replace(/\./g, '')) * (a[2] ? 1000 : 1);
  })();
  const kasse = Number(opts.kasse) || followers * per;
  const hud = { folge: m ? Number(m[1]) : 1, visitors: followers, kasse };
  const seen = {};
  return scenes.map((sc, i) => {
    const text = sc.text || '';
    const kind = pickResortShot(text, i, scenes.length);
    const k = (seen[kind] = (seen[kind] || 0) + 1) - 1;
    const c = { kind, k, i, text, low: text.toLowerCase(), n: scenes.length, followers, per, kasse, options, option: kind === 'option' ? optionOf(text) : null, optIndex: options.indexOf(options.find((o) => o === optionOf(text))) };
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
export function palm(g, x, y, h, t, lean = 1) {
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

// ------------------------------------------------- Vogelperspektive ---
// Boden: X quer (0…1080), Z Tiefe (0 = am Strand hinten … 1000 vorne), Kamera schräg von oben
function rproj(X, Zz) {
  const s = 0.8 + (0.5 * Zz) / 1000;
  return [540 + (X - 540) * s, 560 + Zz * 1.25 * (0.86 + (0.2 * Zz) / 1000), s];
}
const PLOT = { x0: 110, x1: 970, z0: 120, z1: 900 };
const AER = new WeakMap();
function buildPlot(c, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(VW * scale);
  cv.height = Math.ceil(1920 * scale);
  const q = cv.getContext('2d');
  q.scale(scale, scale);
  // Himmel ganz oben, Meer, Strand
  q.fillStyle = '#9fdcff';
  q.fillRect(0, 0, VW, 330);
  q.fillStyle = SEA;
  q.fillRect(0, 330, VW, 190);
  q.fillStyle = '#f4dca0';
  q.fillRect(0, 500, VW, 90);
  q.fillStyle = '#8cd06a';
  q.fillRect(0, 580, VW, 1400);
  for (let i = 0; i < 40; i++) {
    const [x, y] = rproj(((i * 263) % 1300) - 110, ((i * 157) % 1150) - 40);
    P(q, '#9edb7a', 0, ell(x, y, 60, 18));
  }
  // Grundstück: Rasen etwas heller + Absperrung
  const f = PLOT;
  const cs = [rproj(f.x0, f.z0), rproj(f.x1, f.z0), rproj(f.x1, f.z1), rproj(f.x0, f.z1)];
  P(q, '#a6e07f', 0, poly(cs.map(([x, y]) => [x, y])));
  const edge = (a, b) => {
    const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 70);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(rproj(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)));
    line(q, pts.map(([x, y, s]) => [x, y - 34 * s]), 3, RED);
    for (const [x, y, s] of pts) P(q, '#c8955c', 2, rr(x - 4 * s, y - 42 * s, 8 * s, 44 * s, 2));
  };
  edge([f.x0, f.z0], [f.x1, f.z0]);
  edge([f.x0, f.z0], [f.x0, f.z1]);
  edge([f.x1, f.z0], [f.x1, f.z1]);
  // Vermessungs-Markierungen auf dem leeren Grundstück
  for (const [X, Zz] of [[330, 380], [760, 380], [330, 690], [760, 690]]) {
    const [x, y, s] = rproj(X, Zz);
    line(q, [[x - 22 * s, y], [x + 22 * s, y]], 4, '#fff');
    line(q, [[x, y - 10 * s], [x, y + 10 * s]], 4, '#fff');
  }
  // Palmen am Strand und an den Seiten
  const items = [];
  for (let i = 0; i < 9; i++) items.push([30, () => { const [x, y, s] = rproj(-20 + i * 140, 30); palm(q, x, y, 230 * s, 0.5, i % 2 ? 1 : -1); }]);
  for (let zz = 200; zz <= 1000; zz += 200) {
    items.push([zz, () => { const [x, y, s] = rproj(30, zz); palm(q, x, y, 260 * s, 0.5, 1); }]);
    items.push([zz, () => { const [x, y, s] = rproj(1050, zz); palm(q, x, y, 260 * s, 0.5, -1); }]);
  }
  // Besucher (so viele wie Follower) mit Koffern
  // beim Kauf ist das Grundstück noch leer, am Ende stehen alle Besucher drauf
  const n = c.kind === 'plot' ? 0 : Math.min(160, c.followers || 0);
  const spots = [];
  for (let Zz = 200; Zz <= 860; Zz += 44) for (let X = 160 + ((Zz / 44) % 2) * 22; X <= 920; X += 44) {
    if (Math.hypot(X - 540, (Zz - 520) * 1.2) < 120) continue;
    spots.push([X, Zz]);
  }
  const step = spots.length / Math.max(1, n);
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [X, Zz] = spots[Math.floor(i * step)];
    const o = Z.makeAlly(`Gast${i}`, i % 3 ? 'Koffer' : '');
    items.push([Zz, () => { const [x, y, s] = rproj(X, Zz); Z.drawSurv(q, x, y, 90 * s, o, i * 0.4); }]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());
  // vorne: Absperrung + VERKAUFT-Schild
  edge([f.x0, f.z1], [f.x1, f.z1]);
  const [sx, sy, ss] = rproj(860, 960);
  q.save();
  q.translate(sx, sy);
  q.scale(ss * 0.7, ss * 0.7);
  P(q, '#7a4b2a', 5, rr(-8, -40, 16, 140, 3));
  P(q, '#fff', 6, rr(-120, -150, 240, 110, 12));
  label(q, 'VERKAUFT!', 0, -95, 48, RED, { sw: 0 });
  q.restore();
  return cv;
}
function drawPlotAerial(g, t, c, cheer) {
  const m = g.getTransform();
  const scale = Math.min(2.2, Math.max(0.6, Math.round(Math.hypot(m.a, m.b) * 1.2 * 4) / 4));
  let hit = AER.get(c);
  if (!hit || hit.scale !== scale) AER.set(c, (hit = { scale, cv: buildPlot(c, scale) }));
  g.fillStyle = '#9fdcff';
  g.fillRect(-600, -600, 2300, 1000);
  g.fillStyle = '#8cd06a';
  g.fillRect(-600, 400, 2300, 2400);
  g.drawImage(hit.cv, 0, 0, VW, 1920);
  // Wellen
  for (let i = 0; i < 10; i++) {
    const x = ((i * 130 + t * 40) % 1200) - 60;
    line(g, [[x, 360 + (i % 3) * 50], [x + 50, 354 + (i % 3) * 50]], 4, '#bff4ff');
  }
  // Manager in der Mitte des Grundstücks
  const [mx, my, ms] = rproj(540, 520);
  drawManager(g, mx, my - (cheer ? Math.abs(Math.sin(t * 5)) * 8 : 0), 140 * ms, { pose: cheer ? 'open' : 'clip', mouth: 0, t });
}

// ------------------------------------------- Riesige Resort-Fläche ---
// Boden in "Metern": X -2000…3080, Z 0 (Strand) … 3000 (vorne). Kamera hoch über der Fläche.
function bproj(X, Zz) {
  const s = 0.2 + (0.12 * Zz) / 3000;
  return [540 + (X - 540) * s, 520 + Zz * 0.42 * (0.86 + (0.2 * Zz) / 3000), s];
}
const BIG = { x0: -1700, x1: 2780, z0: 140, z1: 2950 };
const BIGC = new WeakMap();
function buildBig(c, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(VW * scale);
  cv.height = Math.ceil(1920 * scale);
  const q = cv.getContext('2d');
  q.scale(scale, scale);
  q.fillStyle = '#9fdcff';
  q.fillRect(0, 0, VW, 330);
  q.fillStyle = SEA;
  q.fillRect(0, 330, VW, 170);
  q.fillStyle = '#f4dca0';
  q.fillRect(0, 490, VW, 40);
  q.fillStyle = '#8cd06a';
  q.fillRect(0, 525, VW, 1400);
  const f = BIG;
  const cs = [bproj(f.x0, f.z0), bproj(f.x1, f.z0), bproj(f.x1, f.z1), bproj(f.x0, f.z1)];
  P(q, '#a6e07f', 0, poly(cs.map(([x, y]) => [x, y])));
  // Rasterlinien (Bauplan) über die ganze Fläche
  for (let X = f.x0; X <= f.x1; X += 400) line(q, [bproj(X, f.z0), bproj(X, f.z1)].map(([x, y]) => [x, y]), 1.5, 'rgba(255,255,255,0.45)');
  for (let Zz = f.z0; Zz <= f.z1; Zz += 300) line(q, [bproj(f.x0, Zz), bproj(f.x1, Zz)].map(([x, y]) => [x, y]), 1.5, 'rgba(255,255,255,0.45)');
  const edge = (a, b) => {
    const n = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 160);
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push(bproj(lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)));
    line(q, pts.map(([x, y, s]) => [x, y - 90 * s]), 2.5, RED);
    for (const [x, y, s] of pts) P(q, '#c8955c', 1.5, rr(x - 10 * s, y - 110 * s, 20 * s, 112 * s, 2));
  };
  edge([f.x0, f.z0], [f.x1, f.z0]);
  edge([f.x0, f.z0], [f.x0, f.z1]);
  edge([f.x1, f.z0], [f.x1, f.z1]);
  // Palmenreihe am Strand
  for (let i = 0; i < 16; i++) {
    const [x, y, s] = bproj(-2100 + i * 360, 40);
    palm(q, x, y, 600 * s, 0.5, i % 2 ? 1 : -1);
  }
  // Besucher (Follower) – winzig auf der riesigen Fläche
  const n = c.kind === 'plot' || c.kind === 'option' ? 0 : Math.min(400, c.followers || 0);
  const items = [];
  for (let i = 0; i < n; i++) {
    const X = 200 + ((i * 7919) % 700);
    const Zz = 1700 + ((i * 104729) % 900);
    const o = Z.makeAlly(`Gast${i}`, i % 3 ? 'Koffer' : '');
    items.push([Zz, () => { const [x, y, s] = bproj(X, Zz); Z.drawSurv(q, x, y, 230 * s, o, i * 0.4); }]);
  }
  items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());
  edge([f.x0, f.z1], [f.x1, f.z1]);
  return cv;
}
function drawBig(g, t, c) {
  const m = g.getTransform();
  const scale = Math.min(2.2, Math.max(0.6, Math.round(Math.hypot(m.a, m.b) * 1.2 * 4) / 4));
  let hit = BIGC.get(c);
  if (!hit || hit.scale !== scale) BIGC.set(c, (hit = { scale, cv: buildBig(c, scale) }));
  g.fillStyle = '#9fdcff';
  g.fillRect(-900, -900, 2900, 1300);
  g.fillStyle = '#8cd06a';
  g.fillRect(-900, 400, 2900, 2600);
  g.drawImage(hit.cv, 0, 0, VW, 1920);
  for (let i = 0; i < 10; i++) {
    const x = ((i * 130 + t * 40) % 1200) - 60;
    line(g, [[x, 360 + (i % 3) * 45], [x + 50, 354 + (i % 3) * 45]], 4, '#bff4ff');
  }
}
// Gebäude aus einem Grundriss hochziehen (Wände von hinten nach vorne, dann Dach)
function extrude(g, foot, h, { wall = '#f4f1e6', roof = '#d9d4c7', glass = '#7ec8ff', floors = 0 } = {}) {
  if (h <= 1) return;
  const base = foot.map(([X, Zz]) => bproj(X, Zz));
  const top = base.map(([x, y, s]) => [x, y - h * s * 1.6]);
  // Schatten auf dem Boden
  g.save();
  g.globalAlpha = 0.18;
  P(g, '#000', 0, poly(base.map(([x, y]) => [x + 14, y + 6])));
  g.restore();
  const walls = foot.map((p, i) => {
    const j = (i + 1) % foot.length;
    return { i, j, z: (foot[i][1] + foot[j][1]) / 2 };
  });
  walls.sort((a, b) => a.z - b.z);
  const nf = floors || Math.max(2, Math.round(h / 90));
  for (const { i, j } of walls) {
    const dx = foot[j][0] - foot[i][0];
    const dz = foot[j][1] - foot[i][1];
    const lit = dz > 0 ? 0.84 : dx < 0 ? 0.92 : 1;
    const q = [base[i], base[j], top[j], top[i]];
    P(g, lit < 1 ? shadeK(wall, lit) : wall, 2.5, poly(q.map(([x, y]) => [x, y])));
    // Fenster-Raster
    const len = Math.hypot(dx, dz);
    const nw = Math.max(1, Math.round(len / 140));
    for (let f = 0; f < nf; f++) {
      for (let w = 0; w < nw; w++) {
        const u0 = (w + 0.25) / nw;
        const u1 = (w + 0.75) / nw;
        const v0 = (f + 0.3) / nf;
        const v1 = (f + 0.75) / nf;
        const pt = (u, v) => [lerp(lerp(base[i][0], base[j][0], u), lerp(top[i][0], top[j][0], u), v), lerp(lerp(base[i][1], base[j][1], u), lerp(top[i][1], top[j][1], u), v)];
        P(g, glass, 0, poly([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)]));
      }
    }
  }
  P(g, roof, 3, poly(top));
}
function shadeK(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * k));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.82));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const SHAPES = (() => {
  const C = [540, 1500];
  const circ = (rx, rz, n, a0 = 0) => Array.from({ length: n }, (_, i) => [C[0] + Math.cos(a0 + (i / n) * Math.PI * 2) * rx, C[1] + Math.sin(a0 + (i / n) * Math.PI * 2) * rz]);
  const fishFull = [[C[0] + 640, C[1]], [C[0] + 420, C[1] - 260], [C[0] + 60, C[1] - 330], [C[0] - 320, C[1] - 260], [C[0] - 560, C[1] - 60], [C[0] - 900, C[1] - 330], [C[0] - 800, C[1]], [C[0] - 900, C[1] + 330], [C[0] - 560, C[1] + 60], [C[0] - 320, C[1] + 260], [C[0] + 60, C[1] + 330], [C[0] + 420, C[1] + 260]];
  const U = [[C[0] - 700, C[1] - 500], [C[0] - 380, C[1] - 500], [C[0] - 380, C[1] + 150], [C[0] + 380, C[1] + 150], [C[0] + 380, C[1] - 500], [C[0] + 700, C[1] - 500], [C[0] + 700, C[1] + 480], [C[0] - 700, C[1] + 480]];
  const star = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? 300 : 700;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return [C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r * 0.9];
  });
  const heart = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const x = 16 * Math.sin(a) ** 3;
    const z = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    return [C[0] + x * 42, C[1] + z * 40];
  });
  const wave = [];
  for (let i = 0; i <= 12; i++) wave.push([C[0] - 900 + i * 150, C[1] - 160 + Math.sin(i * 0.9) * 260]);
  for (let i = 12; i >= 0; i--) wave.push([C[0] - 900 + i * 150, C[1] + 160 + Math.sin(i * 0.9) * 260]);
  return [['FISCH', fishFull], ['U-FORM', U], ['STERN', star], ['HERZ', heart], ['WELLE', wave], ['RING', circ(700, 560, 24)]];
})();
const TOWER_FOOT = [[220, 1250], [860, 1250], [860, 1750], [220, 1750]];
const CORNER_FOOT = [[-500, 900], [1500, 900], [1500, 1400], [100, 1400], [100, 2300], [-500, 2300]];
function drawHotelBuild(g, t, c) {
  const b = c.option?.build;
  const grow = easeOutBack(clamp((t - 0.3) / 0.9));
  if (b === 'tower') extrude(g, TOWER_FOOT, 1250 * grow, { wall: '#e8eef5', roof: '#9aa7b8', floors: 16 });
  else if (b === 'corner') extrude(g, CORNER_FOOT, 420 * grow, { wall: '#fff1d6', roof: '#e07a5f', floors: 5 });
  else if (b === 'shape') {
    const idx = Math.floor(Math.max(0, t - 0.3) / 0.9) % SHAPES.length;
    const local = (Math.max(0, t - 0.3) % 0.9) / 0.9;
    const pop = easeOutBack(clamp(local / 0.35));
    const cols = ['#ffd6e0', '#d6f0ff', '#fff3c4', '#ffd6d6', '#d6ffe4', '#eadcff'];
    extrude(g, SHAPES[idx][1], 300 * pop, { wall: cols[idx], roof: shade(cols[idx]), floors: 3 });
  }
}
function shapeName(t) {
  return SHAPES[Math.floor(Math.max(0, t - 0.3) / 0.9) % SHAPES.length][0];
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
      // Grundstück von oben: Kamera fährt zurück und zeigt die ganze Fläche
      cam(g, 540, lerp(1050, 960, smooth(k)), lerp(1.6, 0.95, smooth(k)));
      drawBig(g, t, c);
      {
        const [mx, my, ms] = bproj(540, 1500);
        drawManager(g, mx, my, 330 * ms, { pose: 'open', mouth: 0, t });
      }
      break;
    }
    case 'money': {
      cam(g, 540, 1180, lerp(1.2, 1.3, k));
      land(g, t, { stakes: false, sold: false });
      // Münzregen
      for (let i = 0; i < 26; i++) {
        const x = (i * 197) % 1080;
        const y = ((t * 520 + i * 173) % 1500) + 300;
        P(g, GOLD, 4, ell(x, y, 24, 24 * Math.abs(Math.cos(t * 4 + i))));
      }
      // Geldkoffer
      g.save();
      g.translate(300, 1560);
      P(g, '#2b2b2b', 6, rr(-150, -110, 300, 190, 18));
      P(g, '#3d9a50', 4, rr(-130, -150, 260, 60, 8));
      for (let i = 0; i < 4; i++) P(g, '#58b368', 3, rr(-125 + i * 64, -165 - (i % 2) * 10, 58, 40, 4));
      label(g, '€', 0, -10, 90, GOLD, { sw: 10 });
      g.restore();
      drawManager(g, 700, 1990, 860, { pose: 'open', mouth: mo, t });
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
        (/hotel/.test(c.low) ? ['BETT?', 'ZIMMER?', 'HOTEL!'] : ['BETT', 'ESSEN', 'SPASS']).forEach((w, i) => {
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
      if (['tower', 'corner', 'shape'].includes(c.option?.build)) {
        // Hotel-Art wird auf der riesigen Fläche von oben gebaut
        cam(g, 540, lerp(980, 940, k), lerp(1.05, 1.0, k));
        drawBig(g, t, c);
        drawHotelBuild(g, t, c);
        break;
      }
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
      cam(g, 540, lerp(1000, 1200, k), lerp(0.95, 1.4, k));
      drawBig(g, t, c);
      {
        const [mx, my, ms] = bproj(540, 1550);
        drawManager(g, mx, my - Math.abs(Math.sin(t * 5)) * 6, 330 * ms, { pose: 'open', mouth: 0, t });
      }
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
    if (t < 2.4) return;
    t -= 2.4;
    dur = Math.max(0.6, dur - 2.4);
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
      simple(/urlaub/.test(c.low) ? 'DU DARFST HIER URLAUB MACHEN!' : 'HERZLICH WILLKOMMEN!');
      break;
    case 'plot':
      simple(/\d/.test(c.low) ? 'PLATZ FÜR 20.000 BESUCHER!' : 'UNSER RIESEN-GRUNDSTÜCK!', DARK, GOLD, 1580);
      break;
    case 'money': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const n = Math.round(c.kasse * smooth(clamp((t - 0.3) / Math.max(0.8, end - 1.2))));
        card(g, VW / 2, 440, 940, 260, DARK, a, -0.02);
        label(g, 'TEAMKASSE:', 0, -70, 56, '#ffffff', { sw: 0 });
        label(g, `${n.toLocaleString('de-DE')} €`, 0, 20, 110, GOLD, { sw: 0 });
        g.restore();
      }
      const b = popIn(t, 1.0, end);
      if (b > 0 && c.per) {
        card(g, VW / 2, 650, 820, 110, '#3d9a50', b, 0.02);
        label(g, `${c.per.toLocaleString('de-DE')} € PRO FOLLOWER`, 0, 2, 54, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
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
      simple(/gast|gäste/.test(c.low) ? '1 FOLLOWER = 1 GAST!' : '1 FOLLOWER = 1 BESUCHER!');
      break;
    case 'counter': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const nums = (c.text.match(/\d[\d.]*/g) || ['100']).map((x) => Number(x.replace(/\./g, '')));
        const top = Math.max(...nums);
        const n = Math.round(top * smooth(clamp((t - 0.2) / Math.max(0.8, end - 0.6))));
        card(g, VW / 2, 430, 900, 240, DARK, a, -0.02);
        label(g, `${n.toLocaleString('de-DE')} FOLLOWER =`, 0, -46, 76, '#fff', { sw: 0 });
        label(g, `${n.toLocaleString('de-DE')} ${/gäste|gast/.test(c.low) ? 'GÄSTE' : 'BESUCHER'}!`, 0, 50, 84, GOLD, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'needs':
      simple(/hotel/.test(c.low) ? 'ALS ERSTES: EIN HOTEL!' : 'SCHLAFEN · ESSEN · SPASS');
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
      if (o?.build === 'shape' && t > 0.3) {
        const nm = `${shapeName(t)}?`;
        const b2 = easeOutBack(clamp(((t - 0.3) % 0.9) / 0.25));
        card(g, VW / 2, 600, 520, 110, '#fff', b2, 0.03);
        label(g, nm, 0, 2, 64, DARK, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'comment':
    case 'name': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 380, 920, 150, GOLD, a, -0.02);
        label(g, c.kind === 'name' ? 'WIE HEISST UNSER RESORT?' : c.options.length >= 2 ? `STIMMT AB: ${c.options.map((o) => o.letter).join(', ').replace(/, ([^,]*)$/, ' ODER $1')}?` : 'MEISTE LIKES ENTSCHEIDET!', 0, 4, 62, DARK, { sw: 0 });
        g.restore();
      }
      const list = c.kind === 'name'
        ? [['Lena', 'Palm Paradise Resort!', '#3a86ff', '402'], ['Max', 'Golden Beach Club', '#43aa8b', '276'], ['Tobi', 'Resort de Luxe', '#9b5de5', '188']]
        : c.options.some((o) => ['tower', 'corner', 'shape'].includes(o.build))
          ? [['Lena', 'A!! Hochhaus bis in die Wolken', '#3a86ff', '356'], ['Max', 'C – als Fisch, bitte!', '#43aa8b', '241'], ['Tobi', 'B, die L-Form sieht edel aus', '#9b5de5', '178']]
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
      simple(/urlaub/.test(c.low) ? 'DEIN URLAUB IST GEBUCHT!' : 'WILLKOMMEN IN UNSEREM RESORT!', DARK, GOLD);
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
  label(g, 'WIR ERÖFFNEN EIN', 0, 300, 84, '#ffffff', { sw: 14 });
  label(g, 'LUXUS-RESORT', 0, 405, 110, GOLD, { sw: 16 });
  const rows = [[c.options.length >= 2 ? `STIMM AB: ${c.options.map((o) => o.letter).join(', ').replace(/, ([^,]*)$/, ' ODER $1')}` : 'KOMMENTIERE: WAS BAUEN WIR ZUERST?', GOLD], ['+ NAMEN FÜRS RESORT!', '#fff'], [`GÄSTE: ${c.followers}  ·  KASSE: ${fmtMoney(c.kasse)}`, '#7ddc4a']];
  rows.forEach(([x, col], i) => {
    P(g, '#000', 0, rr(-440, 520 + i * 135 + 10, 880, 108, 24));
    P(g, '#22203d', 6, rr(-440, 520 + i * 135, 880, 108, 24));
    g.font = '50px "Lilita One", sans-serif';
    label(g, x, 0, 575 + i * 135, Math.min(50, (50 * 820) / g.measureText(x).width), col, { sw: 0 });
  });
  label(g, 'FOLGEN =', 0, 990, 62, '#ffffff', { sw: 10 });
  label(g, 'DEIN URLAUB IM RESORT!', 0, 1070, 74, GOLD, { sw: 12 });
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
function fmtMoney(v) {
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MIO €`;
  if (v >= 1000) return `${Math.round(v / 1000)}K €`;
  return `${v} €`;
}
function drawResortTitle(g, W, t, hud, hide) {
  g.save();
  g.scale(W / VW, W / VW);
  if (t < 2.4) {
    const a = popIn(t, 0.1, 2.3, 0.25);
    if (a > 0) {
      g.save();
      g.translate(VW / 2, 330);
      g.scale(a, a);
      g.rotate(-0.04);
      label(g, `FOLGE ${hud.folge}`, 0, 0, 150, GOLD, { sw: 24 });
      g.restore();
      card(g, VW / 2, 590, 960, 290, DARK, a, 0.02);
      label(g, 'WIR ERÖFFNEN EIN', 0, -80, 76, '#ffffff', { sw: 0 });
      label(g, 'LUXUS-RESORT!', 0, 12, 92, GOLD, { sw: 0 });
      label(g, '…UND DU MACHST HIER URLAUB!', 0, 96, 50, '#7ddc4a', { sw: 0 });
      g.restore();
    }
  } else if (!hide) {
    chip(g, 36, 150, 240, DARK, `FOLGE ${hud.folge}`, GOLD, 44);
    chip(g, VW - 336, 150, 300, '#2ec4b6', `GÄSTE: ${hud.visitors}`, '#fff', 38);
    if (hud.kasse) chip(g, VW - 336, 230, 300, '#3d9a50', `KASSE: ${fmtMoney(hud.kasse)}`, '#fff', 38);
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
    case 'money':
      for (let i = 0; i < 6; i++) add(0.3 + i * 0.25, 'ding');
      add(1.8, 'cheer');
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
