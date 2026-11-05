// SV KIESELBACH – Zeichnungen für den Vereins-Modus der App.
// 2D-Cartoon, flache Farben, dunkle Outlines, Chibi-Proportionen. Alles Vektor.

export const OL = '#262626';
export const TAU = Math.PI * 2;

// ------------------------------------------------------------ Helfer ---
export function rnd(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
export function P(g, fill, lw, fn) {
  g.beginPath();
  fn(g);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (lw) {
    g.lineWidth = lw;
    g.strokeStyle = OL;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }
}
export const rect = (x, y, w, h) => (g) => g.rect(x, y, w, h);
export const rr = (x, y, w, h, r) => (g) => g.roundRect(x, y, w, h, r);
export const ell = (x, y, rx, ry, rot = 0) => (g) => g.ellipse(x, y, rx, ry, rot, 0, TAU);
export const poly = (pts) => (g) => {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
};
export function line(g, pts, lw, color = OL) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.lineWidth = lw;
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.stroke();
}
// Text mit dicker Kontur
export function label(g, text, x, y, size, fill, { stroke = OL, sw = size * 0.16, align = 'center', font = '900', rot = 0 } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (sw) {
    g.lineWidth = sw;
    g.strokeStyle = stroke;
    g.lineJoin = 'round';
    // Schlagschatten (wie Sticker-Schrift)
    g.save();
    g.translate(0, sw * 0.45);
    g.strokeText(text, 0, 0);
    g.fillStyle = stroke;
    g.fillText(text, 0, 0);
    g.restore();
    g.strokeText(text, 0, 0);
  }
  g.fillStyle = fill;
  g.fillText(text, 0, 0);
  g.restore();
}

// ------------------------------------------------------------ Farben ---
export const C = {
  sky1: '#7cc4f2',
  sky2: '#c9ecff',
  cloud: '#ffffff',
  hill1: '#86c45a',
  hill2: '#6aae47',
  tree: '#4f9a3c',
  treeD: '#3d7f2f',
  trunk: '#7a4b2a',
  gravel: '#cdb894',
  gravelD: '#b39c76',
  gravelL: '#e1d2b4',
  grass: '#79b84a',
  wood: '#b07a45',
  woodD: '#8a5a30',
  woodL: '#cf9a62',
  kit: '#1f4fbf',
  kitD: '#173a8f',
  white: '#ffffff',
  skin: ['#f2c29b', '#e3a77c', '#c98a5e', '#9c6440', '#6e4428', '#f6d2b5'],
};

// ------------------------------------------------------------ Welt ---
// Eine einzige Welt (4000 × 1920) – alle Szenen zeigen dasselbe Gelände.
export const WORLD = { w: 4000, h: 1920, horizon: 830 };

export const PLACES = {
  clubhouse: { x: 700, base: 900 },
  bench: { x: 1400, base: 1010 },
  stand: { x: 1880, base: 905, w: 860 },
  toilet: { x: 3000, base: 905 },
  cooler: { x: 3200, base: 920 },
  goalL: { x: 360, base: 1190 },
  goalR: { x: 3420, base: 1190 },
  flagL: { x: 140, base: 1330 },
  flagR: { x: 3880, base: 1330 },
};

const skyGrad = new WeakMap();
export function drawSky(g, t) {
  let gr = skyGrad.get(g);
  if (!gr) {
    gr = g.createLinearGradient(0, -600, 0, WORLD.horizon);
    gr.addColorStop(0, '#8fc6e6');
    gr.addColorStop(1, '#cfe9f5');
    skyGrad.set(g, gr);
  }
  g.fillStyle = gr;
  g.fillRect(-2000, -600, WORLD.w + 4000, WORLD.horizon + 700);
  for (const [x0, y, s] of [[300, 200, 1], [1400, 120, 0.8], [2400, 240, 1.1], [3400, 110, 0.75], [-300, 320, 0.9]]) {
    const x = ((x0 + t * 10) % (WORLD.w + 800)) - 400;
    cloud(g, x, y, s);
  }
}
function cloud(g, x, y, s) {
  P(g, '#ffffff', 5, (g2) => {
    g2.moveTo(x - 150 * s, y + 35 * s);
    g2.arc(x - 90 * s, y + 5 * s, 45 * s, Math.PI * 0.75, Math.PI * 1.6);
    g2.arc(x, y - 20 * s, 65 * s, Math.PI * 1.1, Math.PI * 1.9);
    g2.arc(x + 95 * s, y + 5 * s, 45 * s, Math.PI * 1.35, Math.PI * 0.25);
    g2.closePath();
  });
}

export function drawFar(g) {
  // große runde Büsche/Bäume als Hügelkette (flach, zwei Grüntöne)
  const r = rnd(3);
  const row = (y0, col, rmin, rmax, seed) => {
    const rr2 = rnd(seed);
    for (let x = -500; x < WORLD.w + 500; x += rmin * 1.3 + rr2() * (rmax - rmin)) {
      const rad = rmin + rr2() * (rmax - rmin);
      P(g, col, 6, (g2) => g2.arc(x, y0, rad, Math.PI, 0));
    }
  };
  row(WORLD.horizon + 10, '#5f9a52', 170, 260, 11);
  row(WORLD.horizon + 10, '#3f7a45', 130, 210, 13);
  // Kirchturm des Dorfes
  P(g, '#e9dcc6', 5, rect(3650, WORLD.horizon - 330, 80, 300));
  P(g, '#c4553d', 5, poly([[3638, WORLD.horizon - 330], [3690, WORLD.horizon - 460], [3742, WORLD.horizon - 330]]));
  P(g, '#3b3b3b', 3, ell(3690, WORLD.horizon - 270, 15, 15));
  void r;
  // Grasstreifen hinter dem Platz
  P(g, '#7fb85a', 0, rect(-2000, WORLD.horizon, WORLD.w + 4000, 200));
  // Holzzaun (zwei Latten)
  const fy = WORLD.horizon + 40;
  for (let x = -460; x < WORLD.w + 460; x += 230) P(g, '#9a6537', 5, rr(x - 11, fy - 95, 22, 105, 4));
  P(g, '#b47843', 5, rect(-500, fy - 78, WORLD.w + 1000, 18));
  P(g, '#b47843', 5, rect(-500, fy - 40, WORLD.w + 1000, 18));
  // kaputte Latte
  g.save();
  g.translate(1520, fy - 31);
  g.rotate(0.25);
  P(g, '#b47843', 5, rect(-60, -9, 120, 18));
  g.restore();
  banner(g, 260, fy - 70, 330, 'METZGEREI KIES', '#fff4d6', '#b23a2a', -0.02);
  banner(g, 3500, fy - 68, 300, 'FAHRSCHULE ROLLER', '#e8f4ff', '#235a9e', 0.03);
}
function banner(g, x, y, w, text, bg, fg, rot) {
  g.save();
  g.translate(x + w / 2, y + 22);
  g.rotate(rot);
  P(g, bg, 4, rr(-w / 2, -24, w, 48, 6));
  label(g, text, 0, 2, 30, fg, { sw: 0 });
  g.restore();
}

// große, flache Kiesel (wenige, gut lesbar)
const stones = (() => {
  const r = rnd(7);
  const out = [];
  for (let i = 0; i < 90; i++) {
    const y = 1000 + r() * 1000;
    const d = (y - WORLD.horizon) / (WORLD.h - WORLD.horizon);
    out.push({ x: 150 + r() * 3700, y, s: (8 + r() * 10) * (0.6 + d), c: r() < 0.5 ? '#a99a80' : '#d8cbb0' });
  }
  return out;
})();
export function drawGround(g, view) {
  // Gras
  P(g, '#74ad4f', 0, rect(-2000, WORLD.horizon + 90, WORLD.w + 4000, WORLD.h + 800));
  // Schotterplatz als große flache Fläche
  P(g, '#cbb892', 6, (g2) => {
    g2.moveTo(120, 1010);
    g2.quadraticCurveTo(2000, 975, 3880, 1010);
    g2.quadraticCurveTo(4050, 1500, 3950, 2300);
    g2.lineTo(50, 2300);
    g2.quadraticCurveTo(-50, 1500, 120, 1010);
    g2.closePath();
  });
  // dunklere Flecken + Pfützen
  for (const [x, y, rx, ry] of [[700, 1300, 260, 60], [2900, 1240, 300, 55], [1600, 1650, 380, 80], [3300, 1700, 260, 70], [500, 1800, 300, 80]]) P(g, '#b8a37c', 0, ell(x, y, rx, ry));
  P(g, '#9fc4d8', 5, ell(2350, 1560, 190, 40));
  P(g, '#c7dfeb', 0, ell(2310, 1550, 90, 12));
  P(g, '#8b6a45', 5, ell(1150, 1200, 130, 26));
  // verblasste Kreidelinien
  g.save();
  g.globalAlpha = 0.6;
  line(g, [[2000, 1000], [1990, 1300], [2005, WORLD.h + 200]], 10, '#f6f2e6');
  g.beginPath();
  g.ellipse(2000, 1200, 330, 95, 0.04, 0.3, TAU - 0.6);
  g.lineWidth = 10;
  g.strokeStyle = '#f6f2e6';
  g.stroke();
  g.restore();
  for (const p of stones) {
    if (p.x < view.x0 - 30 || p.x > view.x1 + 30 || p.y < view.y0 - 30 || p.y > view.y1 + 30) continue;
    P(g, p.c, Math.max(2, p.s * 0.25), ell(p.x, p.y, p.s, p.s * 0.62));
  }
  // ein paar Grasbüschel am Rand
  for (const [x, y, s2] of [[300, 1100, 34], [3600, 1150, 36], [180, 1600, 48], [3800, 1500, 44], [2700, 1900, 60]]) tuft(g, x, y, s2);
}
function tuft(g, x, y, s) {
  P(g, '#5f9a52', s * 0.1, (g2) => {
    g2.moveTo(x - s, y);
    g2.lineTo(x - s * 0.6, y - s);
    g2.lineTo(x - s * 0.2, y - s * 0.35);
    g2.lineTo(x, y - s * 1.3);
    g2.lineTo(x + s * 0.25, y - s * 0.35);
    g2.lineTo(x + s * 0.7, y - s * 1.05);
    g2.lineTo(x + s, y);
    g2.closePath();
  });
}

export function drawClubhouse(g, t) {
  const { x, base } = PLACES.clubhouse;
  const w = 640;
  const h = 300;
  P(g, '#e9d9b8', 7, rect(x, base - h, w, h));
  // Putzabplatzer + Riss
  P(g, '#c9a97a', 4, poly([[x + 60, base - 230], [x + 120, base - 240], [x + 110, base - 190], [x + 70, base - 200]]));
  line(g, [[x + 430, base - h], [x + 450, base - 230], [x + 420, base - 180], [x + 445, base - 120]], 4);
  // Flachdach
  P(g, '#6b5d52', 7, rect(x - 25, base - h - 30, w + 50, 34));
  // Dachrinne hängt runter
  line(g, [[x - 20, base - h + 4], [x + 380, base - h + 4], [x + 470, base - h + 70]], 9, '#8d8d8d');
  // Schild "VEREINSHE M" (Buchstabe fehlt), schief
  g.save();
  g.translate(x + w / 2, base - h - 70);
  g.rotate(-0.05);
  P(g, '#2f7f45', 6, rr(-230, -38, 460, 76, 8));
  label(g, 'VEREINSHE  M', 0, 2, 44, '#fff', { sw: 0 });
  g.restore();
  // Tür
  P(g, '#7a4b2a', 6, rect(x + 270, base - 190, 100, 190));
  P(g, '#c9c9c9', 3, ell(x + 350, base - 95, 8, 8));
  P(g, '#fff', 3, rect(x + 290, base - 160, 60, 34));
  label(g, 'ZU', x + 320, base - 143, 22, '#c0392b', { sw: 0 });
  // Fenster: eins mit Brettern vernagelt
  P(g, '#9fd3f0', 6, rect(x + 60, base - 170, 140, 100));
  line(g, [[x + 130, base - 170], [x + 130, base - 70]], 5);
  P(g, '#9fd3f0', 6, rect(x + 440, base - 170, 140, 100));
  for (const [a, b] of [[-0.15, 0], [0.12, 30], [-0.05, 60]]) {
    g.save();
    g.translate(x + 510, base - 150 + b);
    g.rotate(a);
    P(g, C.woodL, 4, rect(-85, -12, 170, 24));
    g.restore();
  }
  // Satellitenschüssel
  P(g, '#d0d0d0', 5, ell(x + 560, base - h - 70, 40, 34, -0.5));
  line(g, [[x + 560, base - h - 40], [x + 560, base - h - 30]], 6);
  // Bierkisten
  for (let i = 0; i < 3; i++) P(g, i === 1 ? '#c0392b' : '#e2b13c', 5, rect(x + 390, base - 50 - i * 46, 70, 46));
}

// Auswechselbank (leer, Spinnennetz)
export function drawBench(g, t) {
  const { x, base } = PLACES.bench;
  P(g, '#cfd6dc', 6, (g2) => {
    g2.moveTo(x, base);
    g2.lineTo(x, base - 150);
    g2.quadraticCurveTo(x + 160, base - 200, x + 330, base - 150);
    g2.lineTo(x + 330, base);
  });
  P(g, '#7aa7c7', 5, rect(x + 10, base - 140, 310, 120));
  P(g, C.wood, 5, rect(x + 30, base - 62, 270, 18));
  line(g, [[x + 50, base - 44], [x + 50, base - 4]], 7);
  line(g, [[x + 280, base - 44], [x + 280, base - 4]], 7);
  // Spinnennetz
  g.save();
  g.globalAlpha = 0.8;
  for (let k = 0; k < 6; k++) line(g, [[x + 22, base - 132], [x + 22 + Math.cos(k * 0.3) * 70, base - 132 + Math.sin(k * 0.3) * 70]], 2, '#fff');
  for (let rr2 = 20; rr2 < 70; rr2 += 16) {
    g.beginPath();
    g.arc(x + 22, base - 132, rr2, 0, 1.6);
    g.strokeStyle = '#fff';
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
  label(g, 'AUSWECHSELBANK', x + 165, base - 165, 24, '#fff', { sw: 6 });
}

// Fantribüne (klein, Holz, kaputt) – fans = Anzahl sichtbarer Fans
export function drawStand(g, t, fans = 0, fanPop = [], opts = {}) {
  const { x, base, w } = PLACES.stand;
  const rows = 3;
  // Gerüst
  for (let i = 0; i <= 6; i++) line(g, [[x + 30 + (i * (w - 60)) / 6, base], [x + 30 + (i * (w - 60)) / 6, base - 250]], 9, C.woodD);
  // Dach (Wellblech, halb weg)
  P(g, '#9aa5ad', 6, poly([[x - 20, base - 300], [x + w * 0.55, base - 300], [x + w * 0.52, base - 270], [x - 10, base - 268]]));
  for (let k = 0; k < 10; k++) line(g, [[x + k * 46, base - 298], [x + k * 46, base - 270]], 3, '#6f7b83');
  // abgebrochenes Dachstück hängt
  g.save();
  g.translate(x + w * 0.55, base - 290);
  g.rotate(0.6 + Math.sin(t * 2.2) * 0.04);
  P(g, '#9aa5ad', 5, rect(0, -10, 120, 24));
  g.restore();
  // Sitzreihen (Bänke)
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const y = base - 40 - r * 72;
    const x0 = x + r * 18;
    const x1 = x + w - r * 18;
    P(g, C.woodL, 5, rect(x0, y - 18, x1 - x0, 20));
    P(g, C.wood, 5, rect(x0, y + 2, x1 - x0, 30));
    for (let s = 0; s < 10; s++) seats.push({ x: x0 + 40 + (s * (x1 - x0 - 80)) / 9, y: y - 18, row: r });
  }
  // kaputtes Brett
  g.save();
  g.translate(x + w * 0.62, base - 112);
  g.rotate(0.35);
  P(g, C.woodL, 4, rect(-60, -10, 120, 20));
  g.restore();
  // Fans (echte Fan-Zahl bzw. Vorschau "so voll wird's")
  const vis = Math.min(seats.length, Math.floor(fans));
  for (let i = 0; i < vis; i++) {
    const s = seats[(i * 7) % seats.length];
    const pop = Math.min(1, fanPop[i] ?? 1);
    fan(g, s.x, s.y, 0.85 * easeOutBack(pop), i, t);
  }
  // Namensschilder (Namen aus den Kommentaren)
  const names = opts.names || [];
  names.slice(0, seats.length).forEach((n, i) => {
    const s = seats[(i * 7) % seats.length];
    nameTag(g, s.x, s.y + 12, n);
  });
  if (opts.nameTag) {
    const s = seats[(names.length * 7 + 3) % seats.length];
    const k = 0.9 + Math.sin(t * 6) * 0.08;
    g.save();
    g.translate(s.x, s.y + 12);
    g.scale(k * 1.6, k * 1.6);
    nameTag(g, 0, 0, 'DEIN NAME?', '#ffd60a');
    g.restore();
  }
  // Schild
  g.save();
  g.translate(x + w / 2, base - 345);
  g.rotate(0.03);
  P(g, '#fff6d9', 6, rr(-170, -34, 340, 68, 10));
  label(g, 'FANTRIBÜNE', 0, 2, 40, '#2f7f45', { sw: 0 });
  g.restore();
  // Anzeigetafel FANS
  P(g, '#222', 6, rect(x + w + 30, base - 250, 150, 110));
  label(g, 'FANS', x + w + 105, base - 222, 26, '#ffd60a', { sw: 0 });
  const board = Math.floor(opts.board ?? fans);
  label(g, String(board), x + w + 105, base - 172, board > 999 ? 34 : 50, board ? '#7CFC00' : '#ff5a4f', { sw: 0 });
  line(g, [[x + w + 105, base - 140], [x + w + 105, base]], 9, '#666');
}
function nameTag(g, x, y, text, bg = '#ffffff') {
  g.font = '18px "Lilita One", "Arial Black", sans-serif';
  const w = Math.min(120, g.measureText(text).width + 16);
  P(g, bg, 3, rr(x - w / 2, y - 12, w, 24, 6));
  g.save();
  const tw = g.measureText(text).width;
  g.translate(x, y + 1);
  if (tw > w - 10) g.scale((w - 10) / tw, 1);
  label(g, text, 0, 0, 18, OL, { sw: 0 });
  g.restore();
}
function fan(g, x, y, s, i, t) {
  if (s <= 0.01) return;
  const cols = ['#e74c3c', '#2f9e4f', '#3498db', '#f1c40f', '#9b59b6', '#e67e22'];
  const sk = C.skin[i % C.skin.length];
  const jump = Math.abs(Math.sin(t * 6 + i)) * 6;
  g.save();
  g.translate(x, y - jump);
  g.scale(s, s);
  P(g, cols[i % cols.length], 4, rr(-16, -38, 32, 40, 10));
  P(g, sk, 4, ell(0, -54, 15, 16));
  P(g, OL, 0, ell(-5, -56, 2.5, 3));
  P(g, OL, 0, ell(5, -56, 2.5, 3));
  line(g, [[-5, -48], [0, -45], [5, -48]], 2.5);
  // Arm hoch (Jubel)
  line(g, [[12, -30], [24, -66]], 7, sk);
  g.restore();
}
export const easeOutBack = (k) => {
  const c1 = 1.7;
  const c3 = c1 + 1;
  return k <= 0 ? 0 : 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

// Dixi-artige Toilette (generisch, schief) – door: 0 zu … 1 offen
export function drawToilet(g, t, door = 0, flies = true) {
  const { x, base } = PLACES.toilet;
  g.save();
  g.translate(x + 85, base);
  g.rotate(-0.06);
  P(g, '#2f7fd1', 7, rr(-85, -280, 170, 280, 10));
  P(g, '#2569b0', 7, (g2) => {
    g2.moveTo(-95, -280);
    g2.quadraticCurveTo(0, -330, 95, -280);
    g2.closePath();
  });
  // Tür (öffnet nach rechts)
  const dw = 130 * (1 - door * 0.75);
  P(g, '#1f1f1f', 0, rect(-65, -250, 130, 245));
  P(g, '#3a8be0', 6, rect(-65, -250, dw, 245));
  label(g, 'WC', -65 + dw / 2, -200, 40 * (1 - door * 0.6), '#fff', { sw: 6, rot: -0.1 });
  P(g, '#ddd', 3, rr(-65 + dw - 22, -130, 12, 34, 4));
  // Klopapierrolle oben
  P(g, '#fff', 4, ell(40, -300, 22, 14));
  P(g, '#fff', 4, rect(18, -320, 44, 20));
  P(g, '#fff', 4, ell(40, -320, 22, 10));
  g.restore();
  // Fliegen
  if (flies) {
    for (let i = 0; i < 4; i++) {
      const a = t * (3 + i) + i * 1.7;
      const fx = x + 85 + Math.cos(a) * (60 + i * 18);
      const fy = base - 300 + Math.sin(a * 1.3) * 40 - i * 10;
      P(g, OL, 0, ell(fx, fy, 5, 4));
      g.save();
      g.globalAlpha = 0.6;
      P(g, '#fff', 2, ell(fx - 3, fy - 6, 5, 3, -0.6));
      P(g, '#fff', 2, ell(fx + 3, fy - 6, 5, 3, 0.6));
      g.restore();
    }
  }
}

// Alte Kühlbox auf Campingtisch – lid: 0 zu … 1 offen
export function drawCooler(g, t, lid = 0) {
  const { x, base } = PLACES.cooler;
  // Campingtisch (wackelt)
  const wob = Math.sin(t * 3) * 0.015;
  g.save();
  g.translate(x + 110, base);
  g.rotate(wob);
  line(g, [[-90, 0], [70, -95]], 7, '#888');
  line(g, [[90, 0], [-70, -95]], 7, '#888');
  P(g, '#e8e2d0', 6, rect(-120, -110, 240, 20));
  // Kühlbox
  P(g, '#d64a3a', 7, rr(-90, -210, 180, 100, 10));
  P(g, '#fff', 5, rect(-90, -170, 180, 22));
  label(g, 'SVK', 0, -128, 28, '#fff', { sw: 5 });
  // Flaschen (sichtbar wenn offen)
  if (lid > 0.2) {
    const cols = ['#7a4b17', '#2f9e4f', '#7a4b17', '#e7a33c'];
    cols.forEach((c, i) => {
      P(g, c, 4, rr(-60 + i * 36, -248 + (i % 2) * 6, 22, 50, 6));
      P(g, c, 4, rect(-55 + i * 36, -268 + (i % 2) * 6, 12, 22));
    });
  }
  // Deckel (klappt nach hinten auf)
  g.save();
  g.translate(-90, -210);
  g.rotate(-lid * 1.9);
  P(g, '#f0f0f0', 7, rr(0, -26, 180, 28, 8));
  P(g, '#c9c9c9', 4, rr(60, -36, 60, 12, 5));
  g.restore();
  g.restore();
}

// Fußballtor (schief, rostig, Netz kaputt) – hit: Wackeln nach Balltreffer
export function drawGoal(g, t, side = 'L', hit = 0) {
  const pl = side === 'L' ? PLACES.goalL : PLACES.goalR;
  const { x, base } = pl;
  const w = 300;
  const h = 150;
  const sh = Math.sin(hit * 40) * hit * 6;
  g.save();
  g.translate(x + w / 2 + sh, base);
  g.rotate(side === 'L' ? 0.03 : -0.04);
  // Netz (hinten)
  g.save();
  g.globalAlpha = 0.7;
  for (let i = -w / 2 + 10; i < w / 2; i += 20) line(g, [[i, -h + 10], [i * 0.85, -12]], 2, '#ddd');
  for (let j = -h + 20; j < -10; j += 20) line(g, [[-w / 2 + 10, j], [w / 2 - 10, j]], 2, '#ddd');
  g.restore();
  // Loch im Netz (flattert)
  const fl = Math.sin(t * 5) * 6;
  P(g, C.gravel, 3, ell(40, -70, 34 + fl * 0.3, 26));
  line(g, [[18, -50], [10 + fl, -30]], 2, '#ddd');
  line(g, [[60, -90], [76 + fl, -100]], 2, '#ddd');
  // Pfosten + Latte (ein Pfosten schief)
  P(g, '#f4f4f4', 6, poly([[-w / 2 - 8, 0], [-w / 2 + 8, 0], [-w / 2 + 14, -h], [-w / 2 - 2, -h]]));
  P(g, '#f4f4f4', 6, poly([[w / 2 - 8, 0], [w / 2 + 8, 0], [w / 2 + 2, -h + 6], [w / 2 - 14, -h + 6]]));
  P(g, '#f4f4f4', 6, poly([[-w / 2 - 2, -h - 10], [w / 2 + 2, -h - 4], [w / 2 + 2, -h + 8], [-w / 2 - 2, -h + 6]]));
  // Rost
  for (const [rx, ry] of [[-w / 2 + 4, -60], [w / 2 - 6, -100], [-40, -h]]) P(g, '#b5651d', 0, ell(rx, ry, 6, 9));
  g.restore();
}

export function drawFlag(g, t, side = 'L') {
  const pl = side === 'L' ? PLACES.flagL : PLACES.flagR;
  const { x, base } = pl;
  g.save();
  g.translate(x, base);
  g.rotate(side === 'L' ? -0.25 : 0.2);
  line(g, [[0, 0], [0, -150]], 9, '#f4f4f4');
  line(g, [[0, 0], [0, -150]], 2, '#888');
  const fl = Math.sin(t * 6) * 8;
  P(g, '#e6c84f', 5, poly([[0, -150], [70, -138 + fl], [64, -110 + fl], [0, -108]]));
  P(g, C.gravel, 0, ell(40, -122 + fl * 0.7, 8, 6)); // Loch
  g.restore();
}

export function drawBall(g, x, y, r, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  P(g, '#fff', r * 0.12, ell(0, 0, r, r));
  P(g, OL, 0, poly([[0, -r * 0.35], [r * 0.33, -r * 0.1], [r * 0.2, r * 0.3], [-r * 0.2, r * 0.3], [-r * 0.33, -r * 0.1]]));
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    line(g, [[Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36], [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9]], r * 0.08);
  }
  g.restore();
}

// ------------------------------------------------------------ RUDI KIESEL ---
// Immer gleich: Sonnenbrille, grauweißer Trainingsanzug, nach hinten gegelte
// dunkle Haare, Pfeife, Vereinswappen. Pose: crossed | point | open | thumbs
// ------------------------------------------------------------ RUDI KIESEL ---
// Immer gleich: blaue Kappe mit Wappen, schwarze Sonnenbrille, strubbelige
// schwarze Haare, blau-weißer Schal, blaue Trainingsjacke mit weißen Streifen
// und "Rudi Kiesel", schwarze Hose, blaue Sneaker.
// Posen: pocket | thumbs | crossed | point | open
const R = { blue: '#1f4fbf', blueD: '#173a8f', skin: '#f6c9a0', hair: '#1b1919', pants: '#2b2b30' };
export function drawRudi(g, x, y, H, { pose = 'pocket', mouth = 0, t = 0, look = 0, talk = false } = {}) {
  const s = H / 100;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 1.5;
  const breath = Math.sin(t * 2.1) * 0.5;
  const bob = talk ? Math.sin(t * 9) * mouth * 0.7 : 0;
  g.save();
  g.globalAlpha = 0.2;
  P(g, '#000', 0, ell(0, 0, 22, 3.5));
  g.restore();
  // Hose + Sneaker
  for (const sx of [-1, 1]) {
    P(g, R.pants, lw, rr(sx * 7 - 5, -23, 10, 19, 3));
    P(g, R.blue, lw, rr(sx * 7.5 - 7.5, -7, 15, 6.5, 3));
    P(g, '#ffffff', lw * 0.8, rr(sx * 7.5 - 8, -2.4, 16, 2.8, 1.4));
    line(g, [[sx * 7.5 - 2, -5.5], [sx * 7.5 + 2, -5.5]], 0.9, '#fff');
  }
  g.save();
  g.translate(0, -breath);
  // Jacke
  P(g, R.blue, lw, rr(-17, -56, 34, 36, 10));
  P(g, R.blueD, lw, rr(-15.5, -24, 31, 4.5, 2));
  line(g, [[0, -52], [0, -24]], 1, '#ffffff');
  crest(g, -8.5, -40, 4.2);
  label(g, 'Rudi', 8.5, -44.5, 4.4, '#ffffff', { sw: 0 });
  label(g, 'Kiesel', 8.5, -40, 4.4, '#ffffff', { sw: 0 });
  scarf(g, lw);
  arms(g, pose, lw, t);
  g.restore();
  g.save();
  g.translate(0, -breath + bob);
  g.rotate(look * 0.05);
  head(g, lw, mouth, t, talk);
  g.restore();
  g.restore();
}
function scarf(g, lw) {
  // um den Hals
  P(g, R.blue, lw, rr(-13.5, -59, 27, 7, 3.5));
  for (const x of [-8, -1, 6]) P(g, '#fff', 0, rect(x, -58.3, 3, 5.6));
  P(g, null, lw, rr(-13.5, -59, 27, 7, 3.5));
  // hängendes Ende mit Streifen und Fransen
  P(g, R.blue, lw, rr(-13, -55, 8, 27, 2));
  for (const y of [-50, -43, -36]) P(g, '#fff', 0, rect(-12.3, y, 6.6, 3));
  P(g, null, lw, rr(-13, -55, 8, 27, 2));
  for (let k = 0; k < 5; k++) line(g, [[-12 + k * 1.6, -28], [-12 + k * 1.6, -24.5]], 0.9, '#fff');
}
function limb(g, x1, y1, x2, y2, w, color, lw, stripe = false) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = Math.hypot(x2 - x1, y2 - y1);
  g.save();
  g.translate(x1, y1);
  g.rotate(a);
  P(g, color, lw, rr(-w / 2, -w / 2, L + w, w, w / 2));
  if (stripe) line(g, [[0, w * 0.18], [L, w * 0.18]], 1.1, '#ffffff');
  g.restore();
}
function fist(g, x, y, lw, thumbUp = false) {
  P(g, R.skin, lw, rr(x - 5, y - 5, 10, 10, 4));
  if (thumbUp) P(g, R.skin, lw, rr(x - 2, y - 13, 4.5, 9, 2.2));
}
function arms(g, pose, lw, t) {
  const sl = R.blue;
  const down = (sx) => {
    limb(g, sx * 18.5, -51, sx * 19.5, -31, 7.5, sl, lw, true);
    P(g, R.skin, lw, ell(sx * 19.5, -28.5, 4, 4));
  };
  const pocket = (sx) => {
    // Hand in der Hosentasche
    limb(g, sx * 18.5, -51, sx * 20, -36, 7.5, sl, lw, true);
    limb(g, sx * 20, -36, sx * 13, -26, 7, sl, lw);
    line(g, [[sx * 9.5, -25], [sx * 13.5, -21]], 1.2);
  };
  if (pose === 'pocket') {
    down(-1);
    pocket(1);
  } else if (pose === 'thumbs') {
    limb(g, -18, -50, -25, -40, 7.5, sl, lw, true);
    fist(g, -25, -45, lw, true);
    pocket(1);
  } else if (pose === 'crossed') {
    limb(g, -19, -51, -19.5, -38, 7.5, sl, lw, true);
    limb(g, 19, -51, 19.5, -38, 7.5, sl, lw, true);
    P(g, sl, lw, rr(-19, -43, 33, 7, 3.5));
    P(g, R.skin, lw, ell(-17, -42, 3.4, 3.4));
    P(g, sl, lw, rr(-14, -38.5, 33, 7.5, 3.75));
    P(g, R.skin, lw, ell(17, -38, 3.4, 3.4));
  } else if (pose === 'point') {
    down(-1);
    limb(g, 17, -50, 36, -64, 7.5, sl, lw, true);
    P(g, R.skin, lw, ell(39.5, -66.5, 4, 4));
    limb(g, 41, -68, 47, -72, 2.6, R.skin, 1);
  } else if (pose === 'open') {
    const k = Math.sin(t * 3) * 1.5;
    limb(g, -17, -50, -31, -36 + k, 7.5, sl, lw, true);
    P(g, R.skin, lw, ell(-33, -34 + k, 4.2, 4.2));
    limb(g, 17, -50, 31, -36 - k, 7.5, sl, lw, true);
    P(g, R.skin, lw, ell(33, -34 - k, 4.2, 4.2));
  }
}
function head(g, lw, mouth, t, talk) {
  P(g, R.skin, lw, ell(-21.5, -72, 3.6, 4.6));
  P(g, R.skin, lw, ell(21.5, -72, 3.6, 4.6));
  // strubbelige Haare an den Seiten (unter der Kappe)
  P(g, R.hair, lw, poly([[-22, -86], [-25, -80], [-21, -79], [-23.5, -73], [-19, -76], [-18, -84]]));
  P(g, R.hair, lw, poly([[22, -86], [25, -80], [21, -79], [23.5, -73], [19, -76], [18, -84]]));
  P(g, R.skin, lw, ell(0, -73, 21.5, 21));
  // Stirnfransen
  P(g, R.hair, lw, poly([[-17, -88], [17, -88], [15, -83], [11, -85.5], [7, -82], [3, -85], [-2, -81.5], [-6, -85], [-10, -82], [-14, -85.5], [-17, -82.5]]));
  // Kappe: Kuppel + Schirm mit weißem Rand + Wappen
  P(g, R.blue, lw, (g2) => {
    g2.moveTo(-21.5, -86);
    g2.quadraticCurveTo(-22, -106, 0, -107);
    g2.quadraticCurveTo(22, -106, 21.5, -86);
    g2.closePath();
  });
  line(g, [[0, -106.5], [0, -88]], 0.8, R.blueD);
  P(g, R.blueD, 0.8, ell(0, -106.6, 2, 1.1));
  crest(g, 0, -96.5, 5);
  P(g, R.blue, lw, (g2) => {
    g2.moveTo(-23, -87);
    g2.quadraticCurveTo(0, -93, 23, -87);
    g2.quadraticCurveTo(25, -82.5, 21, -82);
    g2.quadraticCurveTo(0, -87, -21, -82);
    g2.quadraticCurveTo(-25, -82.5, -23, -87);
    g2.closePath();
  });
  g.beginPath();
  g.moveTo(-21, -82.6);
  g.quadraticCurveTo(0, -87.6, 21, -82.6);
  g.lineWidth = 1.4;
  g.strokeStyle = '#ffffff';
  g.stroke();
  // Augenbrauen
  const br = talk ? Math.sin(t * 5.3) * 0.6 : 0;
  line(g, [[-14, -79.5], [-6, -80 - br]], 1.8);
  line(g, [[6, -80.5 - br], [14, -80]], 1.8);
  // Sonnenbrille
  P(g, '#141414', lw, rr(-17.5, -78, 15.5, 9, 2.5));
  P(g, '#141414', lw, rr(2, -78, 15.5, 9, 2.5));
  line(g, [[-2.5, -75.5], [2.5, -75.5]], 1.6);
  line(g, [[-14.5, -76], [-11.5, -71.5]], 1.1, '#fff');
  line(g, [[5, -76], [8, -71.5]], 1.1, '#fff');
  // Nase
  P(g, '#f3b892', 1, ell(0.5, -66, 2.8, 2.4));
  // Mund
  const m = Math.max(0, Math.min(1, mouth));
  if (m > 0.08) {
    const h = 2 + m * 6;
    P(g, '#7a1f1f', 1.3, rr(-6, -62, 12, h, Math.min(4, h / 2)));
    P(g, '#fff', 0, rr(-4.6, -61.6, 9.2, 1.6, 0.8));
    if (h > 5) P(g, '#e0626a', 0, ell(0, -62 + h - 1.6, 3.4, 1.4));
  } else {
    g.beginPath();
    g.moveTo(-6.5, -61.5);
    g.quadraticCurveTo(0, -57.8, 6.5, -61.5);
    g.lineWidth = 1.6;
    g.strokeStyle = OL;
    g.lineCap = 'round';
    g.stroke();
  }
}

// kleines Wappen (Vektor, vereinfacht): blau-schwarzer Schild, weißes Band, Berg, Ball
export function crest(g, x, y, s) {
  g.save();
  g.translate(x, y);
  g.scale(s / 10, s / 10);
  const shield = (g2) => {
    g2.moveTo(-10, -11);
    g2.lineTo(10, -11);
    g2.lineTo(10, 1);
    g2.quadraticCurveTo(10, 9, 0, 13);
    g2.quadraticCurveTo(-10, 9, -10, 1);
    g2.closePath();
  };
  P(g, '#111a3a', 1.6, shield);
  P(g, '#1f4fbf', 0, rect(-8.5, -9.5, 17, 4.5));
  P(g, '#ffffff', 0, rect(-8.5, -5, 17, 1.6));
  P(g, '#5b86e6', 0, poly([[-8.5, 3], [-2, -3], [3, 1], [8.5, -2], [8.5, 4], [-8.5, 4]]));
  P(g, '#ffffff', 0, ell(-3, 5.5, 2.6, 2.6));
  g.restore();
}

// großes Wappen: das echte Vereinswappen (Bild), sonst Vektor-Ersatz
let crestImg = null;
export function setCrestImage(img) {
  crestImg = img;
}
export function bigCrest(g, x, y, s) {
  if (crestImg) {
    const h = s * 1.3;
    const w = h * (crestImg.width / crestImg.height);
    g.drawImage(crestImg, x - w / 2, y - h / 2, w, h);
    return;
  }
  crest(g, x, y, s * 0.9);
}

// ------------------------------------------------------------ SPIELER ---
// 11 wiedererkennbare Spieler (immer gleich in jeder Folge)
export const PLAYERS = [
  { n: 1, name: 'Bodo', skin: 1, hair: 'bald', hc: '#3b2a20', h: 1.0, w: 1.35, gk: true },
  { n: 2, name: 'Kalle', skin: 0, hair: 'mullet', hc: '#c58b3d', h: 0.98, w: 1.0 },
  { n: 3, name: 'Yusuf', skin: 3, hair: 'short', hc: '#1d1512', h: 1.03, w: 1.0, beard: true },
  { n: 4, name: 'Günther', skin: 5, hair: 'grey', hc: '#cfcfcf', h: 0.95, w: 1.2, mustache: true },
  { n: 5, name: 'Jonas', skin: 0, hair: 'ginger', hc: '#d4622a', h: 1.08, w: 0.95, bandage: true },
  { n: 6, name: 'Mo', skin: 4, hair: 'afro', hc: '#1d1512', h: 1.0, w: 1.0 },
  { n: 7, name: 'Lukas', skin: 0, hair: 'headband', hc: '#e8c86a', h: 0.97, w: 0.95, socksDown: true },
  { n: 8, name: 'Dennis', skin: 2, hair: 'short', hc: '#2a1d16', h: 1.12, w: 0.9 },
  { n: 9, name: 'Timo', skin: 0, hair: 'spiky', hc: '#5a3a22', h: 0.86, w: 0.95 },
  { n: 10, name: 'Rico', skin: 1, hair: 'pony', hc: '#2a1d16', h: 1.0, w: 1.0, oddBoots: true },
  { n: 11, name: 'Ole', skin: 5, hair: 'bowl', hc: '#e2c35a', h: 1.04, w: 1.0, glasses: true },
];

export function drawPlayer(g, p, x, y, H, t, { wave = 0 } = {}) {
  const s = (H * p.h) / 100;
  const ph = p.n * 1.7;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const lw = 1.6;
  const sk = C.skin[p.skin];
  const shirt = p.gk ? '#f39c12' : C.kit;
  const W = p.w;
  g.save();
  g.globalAlpha = 0.2;
  P(g, '#000', 0, ell(0, 0, 18 * W, 3));
  g.restore();
  // Beine, Stutzen, Schuhe
  for (const sx of [-1, 1]) {
    P(g, sk, lw, rr(sx * 6 - 3.5, -18, 7, 15, 3));
    const down = p.socksDown && sx === 1;
    P(g, p.gk ? '#555' : C.kit, lw, rr(sx * 6 - 3.8, down ? -7 : -12, 7.6, down ? 4.5 : 9.5, 2));
    if (!p.gk && !down) line(g, [[sx * 6 - 3.2, -9], [sx * 6 + 3.2, -9]], 1.1, '#fff');
  }
  if (p.bandage) {
    P(g, '#fbfbfb', lw, rr(-10, -17, 8, 6, 1.5));
    line(g, [[-9.5, -14], [-2.5, -13]], 0.7, '#bbb');
  }
  P(g, p.oddBoots ? '#e53935' : '#1d1d1d', lw, ell(-6.5, -2.6, 5.5, 3));
  P(g, p.oddBoots ? '#1e63d6' : '#1d1d1d', lw, ell(6.5, -2.6, 5.5, 3));
  const sway = Math.sin(t * 1.6 + ph) * 0.6;
  g.save();
  g.translate(sway * 0.4, 0);
  // Hose + Trikot (blau mit weißer Schärpe von rechts oben nach links unten)
  P(g, p.gk ? '#333' : C.kit, lw, rr(-13 * W, -26, 26 * W, 10, 3));
  P(g, shirt, 0, rr(-14 * W, -48, 28 * W, 24, 8));
  if (!p.gk) {
    g.save();
    g.beginPath();
    g.roundRect(-14 * W, -48, 28 * W, 24, 8);
    g.clip();
    P(g, '#ffffff', 0, poly([[4 * W, -48], [14 * W, -48], [-4 * W, -24], [-14 * W, -24]]));
    P(g, C.kit, 0, poly([[7 * W, -45], [9 * W, -45], [-5 * W, -27], [-7 * W, -27]]));
    g.restore();
  }
  P(g, null, lw, rr(-14 * W, -48, 28 * W, 24, 8));
  if (!p.gk) {
    P(g, '#fff', 1.1, poly([[-4.5, -48], [4.5, -48], [0, -43.5]]));
    crest(g, 6 * W, -40, 2.6);
    label(g, String(p.n), -7 * W, -40, 9, '#fff', { sw: 1.8 });
  } else P(g, '#fff', 0, rect(-14 * W + 1, -37, 28 * W - 2, 2.5));
  // Arme
  P(g, shirt, lw, rr(-17.5 * W, -46, 6, 15, 3));
  P(g, p.gk ? '#eee' : sk, lw, ell(-14.5 * W, -29.5, p.gk ? 4.4 : 3.3, p.gk ? 4.4 : 3.3));
  if (wave) {
    g.save();
    g.translate(14 * W, -44);
    g.rotate(-2.5 + Math.sin(t * 10) * 0.35);
    P(g, shirt, lw, rr(-3, 0, 6, 13, 3));
    P(g, sk, lw, ell(0, 15, 3.3, 3.3));
    g.restore();
  } else {
    P(g, shirt, lw, rr(11.5 * W, -46, 6, 15, 3));
    P(g, p.gk ? '#eee' : sk, lw, ell(14.5 * W, -29.5, p.gk ? 4.4 : 3.3, p.gk ? 4.4 : 3.3));
  }
  // Kopf
  const hy = -66;
  P(g, sk, lw, ell(-19, hy + 1, 3, 4));
  P(g, sk, lw, ell(19, hy + 1, 3, 4));
  P(g, sk, lw, ell(0, hy, 19, 18.5));
  g.save();
  g.translate(0, hy);
  g.scale(1.72, 1.45);
  hair(g, p, 0, lw / 1.6);
  if (p.beard) P(g, p.hc, 1, (g2) => {
    g2.moveTo(-10, 2);
    g2.quadraticCurveTo(0, 16, 10, 2);
    g2.quadraticCurveTo(0, 8, -10, 2);
  });
  if (p.mustache) P(g, p.hc, 1, ell(0, 5.2, 6, 2));
  g.restore();
  // große Cartoon-Augen
  const blink = Math.sin(t * 1.3 + ph * 3) > 0.97;
  for (const ex of [-6.5, 6.5]) {
    if (blink) line(g, [[ex - 4, hy - 1], [ex + 4, hy - 1]], 1.5);
    else {
      P(g, '#fff', 1.3, ell(ex, hy - 1, 4.6, 5.4));
      P(g, OL, 0, ell(ex + 0.6, hy - 0.4, 2, 2.4));
    }
    if (p.glasses) P(g, null, 1.6, ell(ex, hy - 1, 6, 6.2));
  }
  if (p.glasses) line(g, [[-0.5, hy - 1], [0.5, hy - 1]], 1.6);
  P(g, C.skin[p.skin] === sk ? '#00000022' : '#00000022', 0, ell(0.5, hy + 5, 2.2, 1.6));
  const smile = [1, 2, 6, 9, 11].includes(p.n);
  if (smile) {
    g.beginPath();
    g.arc(0, hy + 7, 4.5, 0.2, Math.PI - 0.2);
    g.lineWidth = 1.4;
    g.strokeStyle = OL;
    g.stroke();
  } else line(g, [[-3.5, hy + 10], [3.5, hy + 10]], 1.4);
  g.restore();
  g.restore();
}
function hair(g, p, hy, lw) {
  const c = p.hc;
  switch (p.hair) {
    case 'bald':
      line(g, [[-6, hy - 9], [-2, hy - 11]], 1.2, '#fff');
      break;
    case 'mullet':
      P(g, c, lw, (g2) => {
        g2.moveTo(-11, hy - 2);
        g2.quadraticCurveTo(-12, hy - 15, 0, hy - 15);
        g2.quadraticCurveTo(12, hy - 15, 11, hy - 2);
        g2.lineTo(13, hy + 10);
        g2.lineTo(9, hy + 8);
        g2.quadraticCurveTo(4, hy - 8, -9, hy - 6);
        g2.closePath();
      });
      break;
    case 'afro':
      P(g, c, lw, ell(0, hy - 9, 16, 12));
      break;
    case 'grey':
      P(g, c, lw, (g2) => {
        g2.moveTo(-11, hy - 1);
        g2.quadraticCurveTo(-12, hy - 9, -7, hy - 11);
        g2.lineTo(-6, hy - 5);
        g2.closePath();
        g2.moveTo(11, hy - 1);
        g2.quadraticCurveTo(12, hy - 9, 7, hy - 11);
        g2.lineTo(6, hy - 5);
        g2.closePath();
      });
      break;
    case 'spiky':
      P(g, c, lw, poly([[-11, hy - 4], [-10, hy - 16], [-5, hy - 11], [-2, hy - 19], [2, hy - 11], [6, hy - 18], [8, hy - 10], [12, hy - 14], [11, hy - 4], [0, hy - 9]]));
      break;
    case 'pony':
      P(g, c, lw, (g2) => {
        g2.moveTo(-11, hy - 3);
        g2.quadraticCurveTo(-10, hy - 15, 1, hy - 14);
        g2.quadraticCurveTo(12, hy - 13, 11, hy - 3);
        g2.quadraticCurveTo(2, hy - 9, -11, hy - 3);
      });
      P(g, c, lw, ell(13, hy - 8, 4, 3));
      break;
    case 'bowl':
      P(g, c, lw, (g2) => {
        g2.moveTo(-12, hy - 1);
        g2.quadraticCurveTo(-12, hy - 16, 0, hy - 16);
        g2.quadraticCurveTo(12, hy - 16, 12, hy - 1);
        g2.lineTo(-12, hy - 1);
      });
      break;
    case 'headband':
      P(g, c, lw, (g2) => {
        g2.moveTo(-11, hy - 4);
        g2.quadraticCurveTo(-10, hy - 16, 0, hy - 16);
        g2.quadraticCurveTo(10, hy - 16, 11, hy - 4);
        g2.closePath();
      });
      P(g, '#e53935', 1.4, rect(-11.5, hy - 8, 23, 4));
      break;
    case 'ginger':
      P(g, c, lw, poly([[-11, hy - 3], [-9, hy - 14], [-3, hy - 16], [4, hy - 15], [10, hy - 12], [11, hy - 3], [5, hy - 9], [-3, hy - 8]]));
      for (let k = 0; k < 5; k++) P(g, '#d98c5f', 0, ell(-6 + k * 3, hy + 3 + (k % 2), 0.9, 0.9));
      break;
    default:
      P(g, c, lw, (g2) => {
        g2.moveTo(-11, hy - 3);
        g2.quadraticCurveTo(-10, hy - 15, 0, hy - 15);
        g2.quadraticCurveTo(10, hy - 15, 11, hy - 3);
        g2.quadraticCurveTo(0, hy - 10, -11, hy - 3);
      });
  }
}

// Ironisches Schild neben dem einzigen Grasbüschel
export function drawLawnSign(g, t) {
  const x = 1060;
  const y = 1420;
  tuft(g, x - 90, y + 8, 46);
  g.save();
  g.translate(x, y);
  g.rotate(-0.08 + Math.sin(t * 1.5) * 0.01);
  line(g, [[0, 0], [0, -150]], 12, C.woodD);
  P(g, '#fff6d9', 6, rr(-120, -230, 240, 110, 10));
  label(g, 'RASEN', 0, -200, 34, '#2f7f45', { sw: 0 });
  label(g, 'BETRETEN', 0, -166, 26, OL, { sw: 0 });
  label(g, 'VERBOTEN!', 0, -138, 26, '#e53935', { sw: 0 });
  g.restore();
}
