// OMA DEFENSE – Spielregeln: Omas, Zombies, Level-Generator, Wellen

// --------------------------------------------------------------- Omas ---
// base = Werte auf Stufe 1, ups = 2 Upgrades (überschreiben Werte)
export const OMA_DEF = {
  hilde: {
    cost: 100, unlock: 1, desc: 'wirft Stricknadeln',
    base: { range: 2.8, rate: 1.4, dmg: 3, proj: 'needle', projSpeed: 14 },
    ups: [{ label: 'SCHNELLER', cost: 110, set: { rate: 2.2 } }, { label: 'SPITZERE NADELN', cost: 200, set: { dmg: 5 } }],
  },
  erna: {
    cost: 250, unlock: 2, desc: 'Sniperin, trifft durch Schilde',
    base: { range: 6.5, rate: 0.45, dmg: 16, proj: 'slipper', projSpeed: 18, pierce: true, prefer: 'strong' },
    ups: [{ label: 'HÄRTERER PANTOFFEL', cost: 200, set: { dmg: 26 } }, { label: 'ADLERAUGE', cost: 300, set: { range: 8.5, rate: 0.6 } }],
  },
  gerda: {
    cost: 300, unlock: 3, desc: 'Keks-Katapult, trifft mehrere',
    base: { range: 3.4, rate: 0.5, dmg: 7, splash: 1.2, proj: 'cookie', arc: true },
    ups: [{ label: 'DOPPELKEKS', cost: 220, set: { dmg: 11 } }, { label: 'RIESENKEKS', cost: 350, set: { splash: 1.7, rate: 0.65 } }],
  },
  helga: {
    cost: 200, unlock: 4, desc: 'Gießkanne macht Zombies langsam',
    base: { range: 2.5, rate: 1.2, dmg: 0.5, slow: 0.45, slowDur: 1.4, aoe: true },
    ups: [{ label: 'MEHR WASSER', cost: 160, set: { slow: 0.6 } }, { label: 'GROSSE KANNE', cost: 260, set: { range: 3.3, dmg: 1.2 } }],
  },
  inge: {
    cost: 350, unlock: 6, desc: 'Rollator schubst Zombies zurück',
    base: { range: 1.7, rate: 0.4, dmg: 6, push: 1.4, aoe: true },
    ups: [{ label: 'TURBO-RÄDER', cost: 250, set: { push: 2.1, dmg: 9 } }, { label: 'DOPPELSCHUB', cost: 350, set: { rate: 0.65 } }],
  },
};

// ------------------------------------------------------------- Zombies ---
export const ZOMBIE_DEF = {
  gustav: { model: 'gustav', hp: 10, speed: 0.85, reward: 6, lives: 1, size: 0.85, hpY: 1.75 },
  jogger: { model: 'jogger', hp: 6, speed: 1.75, reward: 7, lives: 1, size: 0.85, hpY: 1.75, fast: true },
  schild: { model: 'bauarbeiter', hp: 12, speed: 0.75, reward: 10, lives: 1, size: 0.88, hpY: 1.8, armor: 0.6 },
  dieter: { model: 'dieter', hp: 30, speed: 0.55, reward: 14, lives: 2, size: 1.0, hpY: 1.8, fat: true },
  boss: { model: 'boss', hp: 200, speed: 0.4, reward: 120, lives: 8, size: 1.7, hpY: 1.9, boss: true },
};

// gleicher Level = gleiche Map + gleiche Wellen (für alle Spieler)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- Level ---
// Schlangenweg: je höher das Level, desto mehr Schleifen
export function genLevel(n) {
  const r = rng(n * 7919 + 13);
  const rows = Math.min(7, 3 + Math.floor((n + 2) / 4));
  const A = 3.5 + r() * 0.4;
  const sp = 3.7 + r() * 0.4;
  const zTop = (-(rows - 1) * sp) / 2;
  let dir = r() < 0.5 ? 1 : -1;
  const pts = [[-dir * A * 0.9, zTop - 3.6]];
  let lastX = 0, lastZ = 0;
  for (let i = 0; i < rows; i++) {
    const z = zTop + i * sp;
    const wob = () => (r() - 0.5) * 1.2;
    const xs = [-A, -A * 0.35, A * 0.35, A].map((x) => x * dir);
    xs.forEach((x, k) => pts.push([x, z + (k === 0 || k === 3 ? 0 : wob())]));
    if (i < rows - 1) pts.push([dir * (A + 0.7), z + sp / 2]);
    lastX = xs[3];
    lastZ = z;
    dir = -dir;
  }
  pts.push([lastX * 0.85, lastZ + 3.4]);
  return {
    points: pts,
    bounds: { x0: -A - 1.6, x1: A + 1.6, z0: zTop - 2.5, z1: lastZ + 2.5 },
    cookies: 250 + Math.min(900, n * 18),
  };
}

// ------------------------------------------------------------- Wellen ---
export function genWaves(n) {
  const r = rng(n * 104729 + 7);
  const d = n - 1;
  const count = Math.min(12, 4 + Math.floor(n / 3));
  const allowed = [['gustav', 4, 1]];
  if (n >= 2) allowed.push(['jogger', 2.5, 1.1]);
  if (n >= 4) allowed.push(['schild', 2, 2]);
  if (n >= 6) allowed.push(['dieter', 1.4, 3.2]);
  const totalW = allowed.reduce((s, a) => s + a[1], 0);
  const waves = [];
  for (let w = 0; w < count; w++) {
    // erste Wellen eines Levels sanfter, dann steigend
    const ramp = 0.4 + 0.6 * (w / Math.max(1, count - 1));
    let budget = 4 + w * 2.4 + (d * 0.7 + Math.pow(d, 1.25) * 0.08) * ramp;
    const hp = 1 + d * 0.1 + Math.pow(d, 1.3) * 0.01 + w * 0.06;
    const speed = 1 + Math.min(0.3, d * 0.004);
    const gap = Math.max(0.35, 1.0 - Math.min(0.55, d * 0.008) - w * 0.02);
    const list = [];
    // erste Wellen in Level 1: nur langsame
    while (budget > 0) {
      let pick = r() * totalW;
      let a = allowed[0];
      for (const x of allowed) { pick -= x[1]; if (pick <= 0) { a = x; break; } }
      if (w === 0 && n <= 2) a = allowed[0];
      budget -= a[2];
      list.push({ type: a[0], hp, speed, gap: a[0] === 'jogger' ? gap * 0.6 : a[0] === 'dieter' ? gap * 1.4 : gap });
    }
    if (n % 5 === 0 && w === count - 1) {
      for (let b = 0; b < 1 + Math.floor(n / 30); b++) list.push({ type: 'boss', hp: 1 + d * 0.06, speed: 1, gap: 2.5 });
    }
    waves.push(list);
  }
  return waves;
}
