// LAUF LOS! – kleiner Endlos-Läufer fürs Handy (Tippen = Springen, nochmal tippen = Doppelsprung)
// Gezeichnet im gleichen 2D-Cartoon-Stil wie die Videos (flache Farben, dunkle Outlines).
import { P, rr, ell, poly, line, label, OL } from '../verein/art.js';

const cv = document.getElementById('game');
const g = cv.getContext('2d');
const W = 1080; // logische Breite, Höhe ergibt sich aus dem Bildschirm
let H = 1920;
let scale = 1;
let dpr = 1;
const GROUND = () => H * 0.72;

// ------------------------------------------------------------ Größe ---
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  scale = (w * dpr) / W;
  H = (h * dpr) / scale;
  bgCache = null;
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------- Speicher ---
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* privat: egal */
    }
  },
};
let best = store.get('runner-best', 0);
let coinsTotal = store.get('runner-coins', 0);

// ------------------------------------------------------------- Töne ---
let ac = null;
function beep(f0, f1, len, type = 'square', vol = 0.08) {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const o = ac.createOscillator();
    const gn = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + len);
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(gn).connect(ac.destination);
    o.start(t);
    o.stop(t + len + 0.02);
  } catch {
    /* kein Ton */
  }
}
const sfx = {
  jump: () => beep(380, 760, 0.14, 'square', 0.05),
  jump2: () => beep(520, 1100, 0.14, 'square', 0.05),
  coin: () => beep(1200, 1800, 0.09, 'triangle', 0.07),
  hit: () => beep(220, 60, 0.4, 'sawtooth', 0.09),
};

// ------------------------------------------------------------ Spiel ---
const S = { mode: 'start', t: 0, speed: 620, dist: 0, coins: 0, obs: [], coinsList: [], parts: [], spawnIn: 1.2, shake: 0, newBest: false };
const hero = { x: 230, y: 0, vy: 0, jumps: 0, run: 0, onGround: true, squash: 0 };

function reset() {
  S.mode = 'play';
  S.t = 0;
  S.speed = 620;
  S.dist = 0;
  S.coins = 0;
  S.obs = [];
  S.coinsList = [];
  S.parts = [];
  S.spawnIn = 1.0;
  S.newBest = false;
  hero.y = GROUND();
  hero.vy = 0;
  hero.jumps = 0;
  hero.onGround = true;
}

function jump() {
  if (hero.jumps >= 2) return;
  hero.vy = hero.jumps === 0 ? -1750 : -1500;
  hero.jumps++;
  hero.onGround = false;
  (hero.jumps === 1 ? sfx.jump : sfx.jump2)();
  for (let i = 0; i < 6; i++) S.parts.push({ x: hero.x - 20, y: hero.y, vx: -200 - Math.random() * 300, vy: -Math.random() * 300, life: 0.4, col: '#e8d7b0', r: 10 });
}

function onTap(e) {
  e.preventDefault();
  if (S.mode === 'start') {
    reset();
    return;
  }
  if (S.mode === 'over') {
    if (S.t > 0.6) reset();
    return;
  }
  jump();
}
cv.addEventListener('pointerdown', onTap, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') onTap(e);
});

// Hindernisse: Kiste, Stein, Kaktus-Busch, doppelte Kiste, Vogel (in Sprunghöhe)
const TYPES = [
  { k: 'crate', w: 120, h: 120 },
  { k: 'rock', w: 150, h: 95 },
  { k: 'bush', w: 110, h: 170 },
  { k: 'crate2', w: 120, h: 240 },
  { k: 'bird', w: 120, h: 80, fly: 330 },
];
function spawn() {
  const lvl = Math.min(1, S.t / 60);
  const pool = TYPES.filter((ty) => (ty.k === 'crate2' ? lvl > 0.25 : ty.k === 'bird' ? lvl > 0.4 : true));
  const ty = pool[Math.floor(Math.random() * pool.length)];
  const o = { ...ty, x: W + 100, y: GROUND() - (ty.fly || 0) };
  S.obs.push(o);
  // Münzbogen über dem Hindernis oder eine Reihe am Boden
  if (Math.random() < 0.7) {
    const arc = ty.k !== 'bird';
    for (let i = 0; i < 5; i++) {
      const cx = o.x - 160 + i * 90 + (arc ? 0 : 400);
      const cy = arc ? GROUND() - ty.h - 120 - Math.sin((i / 4) * Math.PI) * 160 : GROUND() - 80;
      S.coinsList.push({ x: cx, y: cy, got: false });
    }
  }
  const gap = Math.max(0.65, 1.5 - lvl * 0.7) + Math.random() * 0.6;
  S.spawnIn = gap;
}

function hitbox(o) {
  return { x0: o.x - o.w / 2 + 14, x1: o.x + o.w / 2 - 14, y0: o.y - o.h + 12, y1: o.y - 4 };
}
function heroBox() {
  return { x0: hero.x - 34, x1: hero.x + 34, y0: hero.y - 190, y1: hero.y - 6 };
}
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

function update(dt) {
  S.t += dt;
  if (S.mode !== 'play') {
    hero.run += dt * (S.mode === 'start' ? 6 : 0);
    S.parts = S.parts.filter((p) => (p.life -= dt) > 0);
    S.parts.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 1500 * dt;
    });
    S.shake = Math.max(0, S.shake - dt * 2);
    return;
  }
  S.speed = Math.min(1500, 620 + S.t * 14);
  const dx = S.speed * dt;
  S.dist += dx / 100;
  hero.run += dt * (8 + S.speed / 160);
  // Springen
  hero.vy += 4600 * dt;
  hero.y += hero.vy * dt;
  if (hero.y >= GROUND()) {
    if (!hero.onGround) hero.squash = 1;
    hero.y = GROUND();
    hero.vy = 0;
    hero.jumps = 0;
    hero.onGround = true;
  }
  hero.squash = Math.max(0, hero.squash - dt * 6);
  // Hindernisse + Münzen
  S.spawnIn -= dt;
  if (S.spawnIn <= 0) spawn();
  S.obs.forEach((o) => (o.x -= dx * (o.k === 'bird' ? 1.15 : 1)));
  S.obs = S.obs.filter((o) => o.x > -200);
  S.coinsList.forEach((c) => (c.x -= dx));
  S.coinsList = S.coinsList.filter((c) => c.x > -100 && !c.done);
  const hb = heroBox();
  for (const c of S.coinsList) {
    if (!c.got && Math.abs(c.x - hero.x) < 70 && c.y > hb.y0 - 30 && c.y < hb.y1 + 20) {
      c.got = true;
      c.done = true;
      S.coins++;
      sfx.coin();
      for (let i = 0; i < 5; i++) S.parts.push({ x: c.x, y: c.y, vx: (Math.random() - 0.5) * 400, vy: -Math.random() * 400, life: 0.35, col: '#ffd23f', r: 8 });
    }
  }
  for (const o of S.obs) {
    if (overlap(hb, hitbox(o))) {
      gameOver();
      break;
    }
  }
  S.parts = S.parts.filter((p) => (p.life -= dt) > 0);
  S.parts.forEach((p) => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 1500 * dt;
  });
}

function gameOver() {
  S.mode = 'over';
  S.t = 0;
  S.shake = 1;
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(120);
  const score = Math.floor(S.dist) + S.coins * 10;
  S.score = score;
  if (score > best) {
    best = score;
    S.newBest = true;
    store.set('runner-best', best);
  }
  coinsTotal += S.coins;
  store.set('runner-coins', coinsTotal);
  for (let i = 0; i < 14; i++) S.parts.push({ x: hero.x, y: hero.y - 100, vx: (Math.random() - 0.5) * 900, vy: -Math.random() * 900, life: 0.7, col: ['#e8572a', '#ffd23f', '#fff'][i % 3], r: 12 });
}

// ------------------------------------------------------- Zeichnen ---
let bgCache = null;
let scroll = 0;
const CLOUDS = [[120, 0.18, 1], [520, 0.12, 0.8], [880, 0.22, 1.1], [1300, 0.15, 0.9]];
function hills(q, y, amp, col, seed) {
  P(q, col, 6, (p) => {
    p.moveTo(-10, H + 10);
    // periodisch mit Breite W → beim Verschieben keine Kante
    const k = (Math.PI * 2) / W;
    for (let x = -10; x <= 2 * W + 20; x += 30) p.lineTo(x, y - amp * (0.6 + 0.25 * Math.sin(x * k * 2 + seed) + 0.15 * Math.sin(x * k * 3 + seed * 2)));
    p.lineTo(2 * W + 20, H + 10);
    p.closePath();
  });
}
function tree(q, x, y, s) {
  P(q, '#7a4b2a', 5, rr(x - 10 * s, y - 80 * s, 20 * s, 80 * s, 4));
  P(q, '#3f8f45', 5, ell(x, y - 120 * s, 60 * s, 55 * s));
  P(q, '#4fa553', 0, ell(x - 15 * s, y - 135 * s, 30 * s, 24 * s));
}
// Hintergrund-Ebenen einmal vorzeichnen (doppelt breit → nahtlos verschieben)
function buildBg() {
  const mk = (draw) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(2 * W * scale);
    c.height = Math.ceil(H * scale);
    const q = c.getContext('2d');
    q.scale(scale, scale);
    draw(q);
    return c;
  };
  const gy = GROUND();
  return {
    far: mk((q) => hills(q, gy - 260, 220, '#8fc6e8', 1)),
    mid: mk((q) => {
      hills(q, gy - 120, 160, '#86c45a', 3);
      for (let i = 0; i < 9; i++) tree(q, 60 + i * (W / 4), gy - 60 - (i % 4) * 18, 0.8 + (i % 2) * 0.2);
    }),
  };
}
function layer(img, speed) {
  const off = (scroll * speed) % W;
  g.drawImage(img, -off, 0, 2 * W, H);
}

function drawRunner(x, y, t, s = 1, dead = false) {
  g.save();
  g.translate(x, y);
  const sq = hero.squash;
  g.scale(s * (1 + sq * 0.12), s * (1 - sq * 0.12));
  if (dead) g.rotate(-0.4);
  const lw = 6;
  const run = Math.sin(t);
  const air = !hero.onGround && !dead;
  g.save();
  g.globalAlpha = 0.22;
  P(g, '#000', 0, ell(0, GROUND() - y + 4, 70, 12));
  g.restore();
  // Beine
  const leg = (ang, col) => {
    g.save();
    g.translate(0, -70);
    g.rotate(ang);
    P(g, col, lw, rr(-13, 0, 26, 64, 12));
    P(g, '#3a2a20', lw, ell(8, 66, 22, 13));
    g.restore();
  };
  leg(air ? -0.6 : run * 0.8, '#2b3a63');
  leg(air ? 0.5 : -run * 0.8, '#34466b');
  // Körper
  P(g, '#557a3c', lw, rr(-58, -150, 40, 70, 12));
  P(g, '#e8572a', lw, rr(-42, -160, 84, 96, 28));
  P(g, '#c4441d', 3, rr(-24, -110, 48, 24, 10));
  // Arme
  const arm = (ang, front) => {
    g.save();
    g.translate(front ? 22 : -22, -140);
    g.rotate(ang);
    P(g, '#e8572a', lw, rr(-12, 0, 24, 56, 12));
    P(g, '#f6c9a0', lw, ell(0, 60, 13, 13));
    g.restore();
  };
  arm(air ? -2.6 : -run * 0.9, false);
  // Kopf
  P(g, '#f6c9a0', lw, ell(0, -210, 56, 54));
  P(g, '#6b3e1f', lw, poly([[-56, -215], [-60, -245], [-40, -240], [-42, -268], [-18, -255], [-8, -280], [10, -258], [30, -275], [32, -250], [56, -258], [50, -230], [58, -218], [40, -232], [10, -236], [-20, -234]]));
  if (dead) {
    line(g, [[0, -222], [24, -200]], 5);
    line(g, [[24, -222], [0, -200]], 5);
    line(g, [[32, -222], [52, -200]], 5);
    line(g, [[52, -222], [32, -200]], 5);
  } else {
    for (const ex of [14, 42]) {
      P(g, '#fff', 4, ell(ex, -212, 12, 14));
      P(g, '#2a1d18', 0, ell(ex + 3, -210, 6, 7));
    }
    g.beginPath();
    g.moveTo(14, -180);
    g.quadraticCurveTo(30, air ? -166 : -172, 46, -180);
    g.lineWidth = 5;
    g.strokeStyle = OL;
    g.lineCap = 'round';
    g.stroke();
  }
  arm(air ? -2.2 : run * 0.9, true);
  g.restore();
}

function drawObstacle(o) {
  const x = o.x;
  const y = o.y;
  if (o.k === 'crate' || o.k === 'crate2') {
    const n = o.k === 'crate2' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const yy = y - i * 120;
      P(g, '#c8955c', 6, rr(x - 60, yy - 120, 120, 120, 8));
      line(g, [[x - 50, yy - 110], [x + 50, yy - 10]], 6, '#8a5a30');
      line(g, [[x + 50, yy - 110], [x - 50, yy - 10]], 6, '#8a5a30');
    }
  } else if (o.k === 'rock') {
    P(g, '#9aa0a8', 6, poly([[x - 75, y], [x - 60, y - 60], [x - 20, y - 95], [x + 35, y - 80], [x + 72, y - 30], [x + 75, y]]));
    P(g, '#b8bec6', 0, poly([[x - 40, y - 60], [x - 15, y - 80], [x + 10, y - 66], [x - 20, y - 48]]));
  } else if (o.k === 'bush') {
    P(g, '#3f8f45', 6, rr(x - 26, y - 170, 52, 170, 26));
    P(g, '#3f8f45', 6, rr(x - 58, y - 120, 30, 70, 15));
    P(g, '#3f8f45', 6, rr(x + 28, y - 140, 30, 80, 15));
    for (let i = 0; i < 6; i++) line(g, [[x - 10 + (i % 2) * 20, y - 150 + i * 22], [x - 18 + (i % 2) * 36, y - 156 + i * 22]], 4, '#e8f5e0');
  } else if (o.k === 'bird') {
    const f = Math.sin(S.t * 18 + o.x * 0.01);
    P(g, '#e5383b', 6, ell(x, y - 40, 50, 32));
    P(g, '#c22f32', 6, poly([[x - 10, y - 50], [x + 20, y - 50 - 50 * f], [x + 40, y - 46]]));
    P(g, '#ffd23f', 4, poly([[x - 48, y - 46], [x - 76, y - 38], [x - 48, y - 32]]));
    P(g, '#fff', 3, ell(x - 26, y - 50, 9, 9));
    P(g, '#222', 0, ell(x - 29, y - 50, 4, 4));
  }
}

function coin(x, y) {
  const w = Math.abs(Math.cos(S.t * 5 + x * 0.01));
  P(g, '#ffd23f', 5, ell(x, y, 30 * w + 4, 30));
  if (w > 0.4) label(g, '€', x, y + 2, 34 * w, '#e0a800', { sw: 0 });
}

function draw() {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const sh = S.shake * 18;
  g.setTransform(scale, 0, 0, scale, (Math.random() - 0.5) * sh * scale, (Math.random() - 0.5) * sh * scale);
  if (!bgCache) bgCache = buildBg();
  // Himmel
  const sky = g.createLinearGradient(0, 0, 0, GROUND());
  sky.addColorStop(0, '#3fa9f5');
  sky.addColorStop(1, '#bfeaff');
  g.fillStyle = sky;
  g.fillRect(-50, -50, W + 100, H + 100);
  P(g, '#ffd23f', 6, ell(860, GROUND() * 0.22, 90, 90));
  for (const [cx, cy, s] of CLOUDS) {
    const x = ((cx - scroll * 0.05) % (W + 400) + W + 400) % (W + 400) - 200;
    P(g, '#fff', 6, (p) => {
      p.ellipse(x, GROUND() * cy + 60, 110 * s, 46 * s, 0, 0, Math.PI * 2);
      p.moveTo(x - 30 * s, GROUND() * cy + 38);
      p.ellipse(x - 30 * s, GROUND() * cy + 38, 60 * s, 46 * s, 0, 0, Math.PI * 2);
    });
  }
  layer(bgCache.far, 0.15);
  layer(bgCache.mid, 0.4);
  // Boden
  const gy = GROUND();
  P(g, '#8cd06a', 6, rr(-20, gy, W + 40, 40, 0));
  P(g, '#c9a06a', 6, rr(-20, gy + 40, W + 40, H - gy, 0));
  for (let i = 0; i < 14; i++) {
    const x = ((i * 160 - scroll) % (W + 160) + W + 160) % (W + 160) - 80;
    P(g, '#b38a55', 0, ell(x, gy + 110 + (i % 3) * 60, 30, 10));
  }
  // Münzen, Hindernisse, Figur, Partikel
  S.coinsList.forEach((c) => !c.got && coin(c.x, c.y));
  S.obs.forEach(drawObstacle);
  drawRunner(hero.x, hero.y, hero.run, 0.85, S.mode === 'over');
  S.parts.forEach((p) => {
    g.globalAlpha = Math.max(0, p.life * 2.5);
    P(g, p.col, 0, ell(p.x, p.y, p.r, p.r));
  });
  g.globalAlpha = 1;
  ui();
}

function card(x, y, w, h, fill) {
  P(g, '#000', 0, rr(x - w / 2, y - h / 2 + 10, w, h, 26));
  P(g, fill, 7, rr(x - w / 2, y - h / 2, w, h, 26));
}
function ui() {
  const top = 210; // unter der iPhone-Statusleiste
  if (S.mode === 'play') {
    card(220, top, 340, 100, '#1b1a2e');
    label(g, `${Math.floor(S.dist)} m`, 220, top + 2, 56, '#fff', { sw: 0 });
    card(W - 200, top, 280, 100, '#1b1a2e');
    label(g, `€ ${S.coins}`, W - 200, top + 2, 56, '#ffd23f', { sw: 0 });
    if (S.t < 2.5) label(g, 'TIPPEN = SPRINGEN', W / 2, top + 150, 54, '#fff', { sw: 10 });
  }
  if (S.mode === 'start') {
    const b = 1 + Math.sin(S.t * 3) * 0.03;
    g.save();
    g.translate(W / 2, H * 0.2);
    g.scale(b, b);
    label(g, 'LAUF', 0, -70, 170, '#ffd23f', { sw: 26 });
    label(g, 'LOS!', 0, 90, 190, '#ffffff', { sw: 28 });
    g.restore();
    card(W / 2, H * 0.4, 760, 120, '#e5383b');
    label(g, 'TIPPEN ZUM STARTEN', W / 2, H * 0.4 + 2, 62, '#fff', { sw: 0 });
    label(g, '1× tippen = springen · 2× = Doppelsprung', W / 2, H * 0.4 + 120, 40, '#1b1a2e', { sw: 0 });
    if (best) label(g, `REKORD: ${best}`, W / 2, H * 0.4 + 190, 54, '#fff', { sw: 10 });
  }
  if (S.mode === 'over') {
    const a = Math.min(1, S.t * 3);
    g.save();
    g.globalAlpha = 0.6 * a;
    g.fillStyle = '#10142a';
    g.fillRect(-50, -50, W + 100, H + 100);
    g.restore();
    const s = 0.6 + 0.4 * Math.min(1, S.t * 4);
    g.save();
    g.translate(W / 2, H * 0.36);
    g.scale(s, s);
    label(g, 'AUTSCH!', 0, -230, 140, '#e5383b', { sw: 22 });
    card(0, 0, 800, 360, '#1b1a2e');
    label(g, 'PUNKTE', 0, -110, 50, '#9aa0b8', { sw: 0 });
    label(g, String(S.score), 0, -30, 130, '#ffd23f', { sw: 0 });
    label(g, `${Math.floor(S.dist)} m  ·  € ${S.coins}`, 0, 70, 50, '#fff', { sw: 0 });
    label(g, S.newBest ? 'NEUER REKORD!' : `REKORD: ${best}`, 0, 140, 48, S.newBest ? '#7ddc4a' : '#9aa0b8', { sw: 0 });
    if (S.t > 0.6) {
      card(0, 290, 600, 120, '#e5383b');
      label(g, 'NOCHMAL', 0, 292, 66, '#fff', { sw: 0 });
    }
    g.restore();
  }
}

// ------------------------------------------------------------ Loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(dt);
  if (S.mode === 'play' || S.mode === 'start') scroll += (S.mode === 'play' ? S.speed : 300) * dt;
  draw();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => {
  last = performance.now();
});
async function boot() {
  resize();
  hero.y = GROUND();
  try {
    const f = new FontFace('Lilita One', `url(${new URL('fonts/lilita-one-latin-400-normal.woff2', document.baseURI).href})`);
    await f.load();
    document.fonts.add(f);
  } catch {
    /* Ersatzschrift */
  }
  requestAnimationFrame(frame);
}
boot();
// zum Testen
window.__runner = { S, hero, jump, reset };
