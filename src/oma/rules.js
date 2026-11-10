// OMA vs ZOMBIES – Spielregeln: Omas, Zombies, Karten, Wellen

// --------------------------------------------------------------- Omas ---
// base = Werte auf Stufe 1, ups = 2 Upgrades (überschreiben Werte); unlock = ab dieser Welle auf Karte 1 (auf Karte 2/3 sofort)
export const OMA_DEF = {
  hilde: {
    cost: 100, unlock: 1, desc: 'wirft Stricknadeln',
    base: { range: 2.8, rate: 1.4, dmg: 3, proj: 'needle', projSpeed: 14 },
    ups: [{ label: 'SCHNELLER', cost: 110, set: { rate: 2.2 } }, { label: 'SPITZERE NADELN', cost: 200, set: { dmg: 5 } }],
  },
  erna: {
    cost: 250, unlock: 3, desc: 'Sniperin, trifft durch Schilde',
    base: { range: 6.5, rate: 0.45, dmg: 16, proj: 'slipper', projSpeed: 18, pierce: true, prefer: 'strong' },
    ups: [{ label: 'HÄRTERER PANTOFFEL', cost: 200, set: { dmg: 26 } }, { label: 'ADLERAUGE', cost: 300, set: { range: 8.5, rate: 0.6 } }],
  },
  gerda: {
    cost: 300, unlock: 5, desc: 'Keks-Katapult, trifft mehrere',
    base: { range: 3.4, rate: 0.5, dmg: 7, splash: 1.2, proj: 'cookie', arc: true },
    ups: [{ label: 'DOPPELKEKS', cost: 220, set: { dmg: 11 } }, { label: 'RIESENKEKS', cost: 350, set: { splash: 1.7, rate: 0.65 } }],
  },
  helga: {
    cost: 200, unlock: 8, desc: 'Gießkanne macht Zombies langsam',
    base: { range: 2.5, rate: 1.2, dmg: 0.5, slow: 0.45, slowDur: 1.4, aoe: true },
    ups: [{ label: 'MEHR WASSER', cost: 160, set: { slow: 0.6 } }, { label: 'GROSSE KANNE', cost: 260, set: { range: 3.3, dmg: 1.2 } }],
  },
  inge: {
    cost: 350, unlock: 12, desc: 'Rollator schubst Zombies zurück',
    base: { range: 1.7, rate: 0.4, dmg: 6, push: 1.4, aoe: true },
    ups: [{ label: 'TURBO-RÄDER', cost: 250, set: { push: 2.1, dmg: 9 } }, { label: 'DOPPELSCHUB', cost: 350, set: { rate: 0.65 } }],
  },
};

// ------------------------------------------------------------- Zombies ---
export const ZOMBIE_DEF = {
  gustav: { model: 'gustav', hp: 10, speed: 1.3, reward: 6, lives: 1, size: 0.85, hpY: 1.75 },
  jogger: { model: 'jogger', hp: 6, speed: 2.5, reward: 7, lives: 1, size: 0.85, hpY: 1.75, fast: true },
  schild: { model: 'bauarbeiter', hp: 12, speed: 1.15, reward: 10, lives: 1, size: 0.88, hpY: 1.8, armor: 0.6 },
  dieter: { model: 'dieter', hp: 30, speed: 0.85, reward: 14, lives: 2, size: 1.0, hpY: 1.8, fat: true },
  boss: { model: 'boss', hp: 200, speed: 0.6, reward: 120, lives: 8, size: 1.7, hpY: 1.9, boss: true },
};
export const LIVES = 30;
export const WAVES = 60; // jede Karte = 60 Wellen am Stück
// Sterne: alle Leben = 3, mindestens 20 = 2, sonst 1
export const starsFor = (lives) => (lives >= LIVES ? 3 : lives >= 20 ? 2 : 1);

// ------------------------------------------------------------- Karten ---
// Weg als Linienzug (Ecken werden automatisch gerundet). Start und Ende liegen außerhalb des Bildes.
function arc(cx, cz, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, 'arc']); }
  return out;
}
const DEG = Math.PI / 180;
export const MAPS = [
  {
    id: 'garten', name: 'SCHREBERGARTEN', theme: 'day',
    bounds: { x0: -8, x1: 8, z0: -15, z1: 16 },
    pond: { x: -0.3, z: 0.6, r: 1.5 },
    line: [
      [-19, -12], [-1, -12], [5.5, -12], [5.5, -7.5], [-5.5, -7.5], [-5.5, -2.6], [-2.5, -2.6],
      // Schleife um den Teich (im Uhrzeigersinn, 270°)
      ...arc(-0.3, 0.6, 3.2, -90 * DEG, 180 * DEG, 12),
      [-3.8, -0.3], [-6.8, -0.3], [-6.8, 6], [2, 6], [6, 6], [6.3, 9],
      // Zickzack
      [3.2, 10.6], [0.2, 9.4], [-3, 11], [-6.5, 10.4], [-6.8, 13.6], [-1, 14.2], [4.5, 14], [6.4, 15.8], [6.4, 24],
    ],
  },
  {
    id: 'friedhof', name: 'FRIEDHOF', theme: 'night',
    bounds: { x0: -8, x1: 8, z0: -15, z1: 16 },
    line: [
      [19, -12], [3, -12], [-6, -12], [-6.5, -8], [-2, -7.8], [2.5, -9], [6.5, -7.5], [6.5, -3.5], [0, -3.2], [-6.5, -3.5],
      [-6.8, 0.6], [-3, 1], [1, 0.8], [4.5, 1.5], [6.4, 4], [4.6, 6.6], [0, 6.6], [-5.5, 6.8], [-6.8, 9.6], [-5, 12], [0, 11.4],
      [4, 12.4], [6.5, 14.6], [6, 24],
    ],
  },
  {
    id: 'winter', name: 'WINTERDORF', theme: 'snow',
    bounds: { x0: -8, x1: 8, z0: -15, z1: 16 },
    line: [
      [-19, -13], [-2.5, -13], [-2.5, -9], [-7, -9], [-7, -4.5], [2.5, -4.5], [2.5, -9.5], [7, -9.5], [7, 1.5], [3.5, 1.5],
      [3.5, -1.5], [-6.5, -1.5], [-6.5, 5.5], [0, 5.5], [0, 9.5], [-6.5, 9.5], [-6.5, 13.5], [5.5, 13.5], [5.5, 24],
    ],
  },
];
// Ecken runden: vor und nach jeder Ecke einen Punkt setzen (Bögen bleiben, wie sie sind)
export function mapPoints(map) {
  const P = map.line;
  const out = [];
  const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  for (let i = 0; i < P.length; i++) {
    const c = P[i];
    if (i === 0 || i === P.length - 1 || c[2] === 'arc' || P[i - 1][2] === 'arc' || P[i + 1][2] === 'arc') { out.push([c[0], c[1]]); continue; }
    const a = P[i - 1], b = P[i + 1];
    const la = len(a, c), lb = len(c, b);
    const r = Math.min(1.5, la / 2.2, lb / 2.2);
    if (r < 0.5) { out.push([c[0], c[1]]); continue; }
    out.push([c[0] + ((a[0] - c[0]) / la) * r, c[1] + ((a[1] - c[1]) / la) * r]);
    out.push([c[0] + ((b[0] - c[0]) / lb) * r, c[1] + ((b[1] - c[1]) / lb) * r]);
  }
  return out;
}

// gleicher Level = gleiche Wellen (für alle Spieler)
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
// Schwierigkeit einer Welle: Karte 2 fängt etwas schwerer an, Karte 3 noch mehr
export const difficulty = (mapIdx, wave) => wave + mapIdx * 6 * Math.min(1, wave / 20); // Aufschlag kommt in den ersten 20 Wellen langsam dazu
export const startCookies = (mapIdx) => 450 + mapIdx * 200;

// ------------------------------------------------------------- Wellen ---
// Welle 1–10: nur normale · ab 11 ab und zu schnelle · ab 16 Schild · Welle 20: erster Boss + dicke
// Bosse in Welle 20, 30, 40, 50 – Welle 60: die schwerste mit mehreren Bossen
export function genWaves(mapIdx) {
  const r = rng(mapIdx * 1000003 + 7);
  const waves = [];
  for (let w = 1; w <= WAVES; w++) {
    const D = difficulty(mapIdx, w);
    const allowed = [['gustav', 4, 1]];
    if (D >= 11) allowed.push(['jogger', D < 16 ? 0.7 : 2.2, 1.1]);
    if (D >= 16) allowed.push(['schild', D < 25 ? 0.8 : 1.8, 2]);
    if (D >= 21) allowed.push(['dieter', D < 30 ? 0.6 : 1.4, 3.2]);
    const totalW = allowed.reduce((sum, x) => sum + x[1], 0);
    let budget = 4 + w * 0.55 + D * 0.3 + Math.pow(D, 1.4) * 0.05;
    if (w === WAVES) budget *= 1.4;
    const hp = 1 + D * 0.12 + Math.pow(D, 1.75) * 0.006;
    const speed = 1 + Math.min(0.3, D * 0.004);
    const gap = Math.max(0.3, 1.0 - Math.min(0.55, D * 0.008));
    const list = [];
    while (budget > 0) {
      let pick = r() * totalW;
      let a = allowed[0];
      for (const x of allowed) { pick -= x[1]; if (pick <= 0) { a = x; break; } }
      budget -= a[2];
      list.push({ type: a[0], hp, speed, gap: a[0] === 'jogger' ? gap * 0.6 : a[0] === 'dieter' ? gap * 1.4 : gap });
    }
    const bosses = w === WAVES ? 2 + mapIdx : w >= 20 && w % 10 === 0 ? 1 + (w >= 40 ? mapIdx : 0) : 0;
    if (bosses) {
      for (let k = 0; k < 2 + mapIdx; k++) list.push({ type: 'dieter', hp, speed, gap: gap * 1.4 });
      for (let b = 0; b < bosses; b++) list.push({ type: 'boss', hp: 1 + D * 0.05, speed: 1, gap: 3 });
    }
    waves.push(list);
  }
  return waves;
}
