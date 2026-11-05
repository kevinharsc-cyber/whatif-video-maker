// VEREINS-MODUS (SV Kieselbach)
// Jeder Satz des Skripts wird anhand von Stichwörtern einer Einstellung auf dem
// Vereinsgelände zugeordnet (Rudi, Mannschaft, Tribüne, WC, Kühlbox, Abstimmung …).
// Alle Szenen spielen in EINER Welt → Rudi, Stadion und Trikots bleiben gleich.

import * as A from './art.js';

const { P, label, rr, rect, ell, poly, line, OL } = A;
const VW = 1080; // virtuelle Bildschirmbreite für Einblendungen (wird skaliert)
const VH = 1920;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const BLUE = '#1f4fbf';

// ----------------------------------------------------------- Vorbereitung ---
let ready = null;
/** Schrift + Wappen laden (einmal). */
export function prepareVerein() {
  if (!ready) {
    ready = (async () => {
      try {
        const f = new FontFace('Lilita One', `url(${new URL('fonts/lilita-one-latin-400-normal.woff2', document.baseURI).href})`);
        await f.load();
        document.fonts.add(f);
      } catch {
        /* Ersatzschrift */
      }
      try {
        const img = new Image();
        img.src = new URL('verein/wappen.png', document.baseURI).href;
        await img.decode();
        A.setCrestImage(img);
      } catch {
        /* Vektor-Wappen */
      }
    })();
  }
  return ready;
}

// ------------------------------------------------------------- Einstellungen ---
const RUDI_MAIN = { x: 2250, y: 1800, H: 900 };
const RUDI_STAND = { x: 1700, y: 1450, H: 600 };
const RUDI_GOAL = { x: 1560, y: 1820, H: 820 };
const RUDI_HOUSE = { x: 1180, y: 1760, H: 760 };

const SHOTS = {
  intro: [{ a: [2250, 1000, 0.95], b: [2250, 1180, 1.25], rudi: { ...RUDI_MAIN, pose: 'thumbs' }, players: true }],
  talk: [
    { a: [2250, 1240, 1.4], b: [2250, 1230, 1.52], rudi: { ...RUDI_MAIN, pose: 'pocket' }, players: true },
    { a: [2250, 1330, 1.75], b: [2250, 1310, 1.9], rudi: { ...RUDI_MAIN, pose: 'crossed' }, players: true },
    { a: [1800, 1000, 0.85], b: [1780, 1030, 0.92], rudi: { ...RUDI_GOAL, pose: 'open' }, players: true },
  ],
  goal: [{ a: [1800, 1000, 0.85], b: [1770, 1030, 0.92], rudi: { ...RUDI_GOAL, pose: 'open' }, players: true }],
  daily: [{ a: [1780, 1030, 0.9], b: [1750, 1050, 0.97], rudi: { ...RUDI_GOAL, pose: 'thumbs' }, players: true }],
  team: [
    { a: [1900, 1235, 1.9], b: [2880, 1235, 1.9], players: true, wave: true },
    { a: [2880, 1235, 1.7], b: [1950, 1235, 1.7], players: true, wave: true },
  ],
  bench: [{ a: [1565, 905, 2.6], b: [1565, 905, 2.8], players: true }],
  stadium: [
    { a: [2050, 1010, 0.62], b: [2050, 980, 0.7], players: true },
    { a: [1300, 1000, 0.8], b: [2800, 1000, 0.8], players: true },
  ],
  goalpost: [{ a: [720, 1080, 2.0], b: [580, 1070, 2.2], players: true, ball: true }],
  lawn: [{ a: [1010, 1330, 2.3], b: [1060, 1340, 2.45], players: true }],
  stand_empty: [{ a: [2845, 720, 2.6], b: [2845, 720, 2.85] }, { a: [2300, 800, 1.15], b: [2330, 790, 1.25] }],
  stand_point: [{ a: [2160, 1000, 1.0], b: [2190, 980, 1.05], rudi: { ...RUDI_STAND, pose: 'point' } }],
  stand_fill: [{ a: [2330, 800, 1.2], b: [2400, 780, 1.15] }],
  nametag: [{ a: [2200, 760, 1.6], b: [2230, 755, 1.75] }],
  toilet: [{ a: [3085, 760, 2.2], b: [3085, 780, 2.45] }],
  cooler: [{ a: [3310, 770, 2.5], b: [3310, 780, 2.65] }],
  vote: [{ a: [1180, 1240, 1.25], b: [1180, 1250, 1.32], rudi: { ...RUDI_HOUSE, pose: 'open' }, players: true }],
  money: [{ a: [1180, 1260, 1.3], b: [1180, 1270, 1.4], rudi: { ...RUDI_HOUSE, pose: 'thumbs' }, players: true }],
  clubhouse: [{ a: [1020, 760, 1.6], b: [1000, 770, 1.75], rudi: { ...RUDI_HOUSE, pose: 'pocket' } }],
  follow: [{ a: [2250, 1330, 1.7], b: [2250, 1310, 1.9], rudi: { ...RUDI_MAIN, pose: 'crossed' }, players: true }],
  growth: [{ a: [2330, 790, 1.15], b: [2380, 775, 1.22] }],
  voteresult: [
    { a: [1180, 1240, 1.25], b: [1180, 1250, 1.32], rudi: { ...RUDI_HOUSE, pose: 'open' }, players: true },
    { a: [1180, 1280, 1.4], b: [1180, 1290, 1.5], rudi: { ...RUDI_HOUSE, pose: 'thumbs' }, players: true },
  ],
  repair: [{ a: [560, 1110, 1.6], b: [520, 1105, 1.75], players: true }],
  jobs: [
    { a: [1180, 1250, 1.3], b: [1180, 1260, 1.38], rudi: { ...RUDI_HOUSE, pose: 'point' }, players: true },
    { a: [1180, 1280, 1.4], b: [1180, 1290, 1.48], rudi: { ...RUDI_HOUSE, pose: 'open' }, players: true },
  ],
  apply: [{ a: [2250, 1250, 1.4], b: [2250, 1240, 1.5], rudi: { ...RUDI_MAIN, pose: 'point' }, players: true }],
  matchday: [{ a: [2050, 1010, 0.66], b: [2050, 985, 0.76], players: true }],
  slogan: [{ a: [2250, 1310, 1.95], b: [2250, 1300, 2.05], rudi: { ...RUDI_MAIN, pose: 'crossed' }, players: true, end: true }],
};

/** Welche Einstellung passt zum Satz? (Reihenfolge = Vorrang) */
export function pickShot(text, i, n, black) {
  const s = text.toLowerCase();
  if (black || /aus kies geboren|für großes bestimmt|fuer grosses bestimmt/.test(s)) return 'slogan';
  if (/ergebnis|gewonnen|gewinnt|meisten von euch|mehrheit/.test(s)) return 'voteresult';
  if (/\ba\s*[:)]|\bb\s*[:)]|a oder b|abstimm|stimmt ab|\ba für\b/.test(s)) return 'vote';
  if (/reparatur|reparier|investier/.test(s)) return 'repair';
  if (/bewerb/.test(s)) return 'apply';
  if (/verstärkung|offene stellen|maskottchen|kassenwart|co-trainer|stadionsprecher|platzwart|zeugwart|physio/.test(s)) return 'jobs';
  if (/namen?\b/.test(s) && /kommentar/.test(s)) return 'nametag';
  if (/sonntag|samstag|montag|dienstag|mittwoch|donnerstag|freitag|erstes spiel|spiel statt|anpfiff/.test(s)) return 'matchday';
  if (/folgt|folge uns|abonnier|folgen\b|follow da/.test(s) && !/je mehr/.test(s)) return 'follow';
  if (/unterstützt|community|\d+\s*(leute|follower|fans|unterstützer)/.test(s)) return 'growth';
  if (/geld|kasse|euro|€/.test(s)) return 'money';
  if (/toilett|klo\b|\bwc\b|dixi/.test(s)) return 'toilet';
  if (/getränk|kühlbox|trinken|bier|limo/.test(s)) return 'cooler';
  if (/auswechsel|ersatzspieler|ersatzbank|auswechselbank/.test(s)) return 'bench';
  if (/rasen|budget|gras\b/.test(s)) return 'lawn';
  if (/tornetz|pfosten|latte|\btor\b|tore\b/.test(s)) return 'goalpost';
  if (/tribüne|tribuene|fans?\b|zuschauer|follower/.test(s)) {
    if (/null|leer|keine|wenig/.test(s)) return 'stand_empty';
    if (/voll|anbau|ausbau|je mehr/.test(s)) return 'stand_fill';
    if (/follower|platz/.test(s)) return 'stand_point';
    return 'stand_empty';
  }
  if (/spieler|mannschaft|startelf|team|kader/.test(s)) return 'team';
  if (/morgen|jeden tag|neues spiel|täglich/.test(s)) return 'daily';
  if (/champions|liga|ganz nach oben|ziel/.test(s)) return 'goal';
  if (/stadion|schotter|platz|arena|gelände/.test(s)) return 'stadium';
  if (/vereinsheim|kabine/.test(s)) return 'clubhouse';
  if (i === 0 || /tag \d|gründen|ich bin|trainer|rudi/.test(s)) return 'intro';
  return 'talk';
}

const NUMWORDS = { eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12 };
function parseVote(text) {
  const m = text.match(/\bA\s*(?:[:)]|für)\s*(.+?)\s*(?:[.!?,]\s*|\s+)(?:oder\s+)?B\s*(?:[:)]|für)\s*(.+?)(?:[.!?]|$)/i);
  const clean = (x) => x.replace(/^(ein|eine|einen|unsere|unser|unseren|die|den|das)\s+/i, '').replace(/[.!?]+$/, '').trim().toUpperCase();
  return m ? [clean(m[1]), clean(m[2])] : null;
}
const stem = (w) => w.toLowerCase().replace(/[^a-zäöüß]/g, '').slice(0, 6);
const firstNumber = (t) => {
  const m = t.match(/(\d+(?:[.,]\d+)?)/);
  return m ? Number(m[1].replace(',', '.')) : null;
};
const euros = (t) => [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:€|euro)/gi)].map((m) => Number(m[1].replace(',', '.')));
const JOBS = [
  ['maskottchen', 'MASKOTTCHEN', 'bear'],
  ['kassenwart', 'KASSENWART', 'money'],
  ['co-trainer', 'CO-TRAINER', 'ball'],
  ['stadionsprecher', 'STADIONSPRECHER', 'mic'],
  ['platzwart', 'PLATZWART', 'ball'],
  ['zeugwart', 'ZEUGWART', 'shirt'],
  ['physio', 'PHYSIO', 'plus'],
];

/**
 * Baut die Szenen-Bilder für ein Skript.
 * opts: { fans: aktuelle Fan-Zahl, names: [Namen für Tribünenplätze] }
 */
export function createVereinVisuals(scenes, opts = {}) {
  const fans = Math.max(0, Math.floor(Number(opts.fans) || 0));
  const names = (opts.names || []).filter(Boolean).slice(0, A.STAND_SEATS);
  const seen = {};
  let prevVote = null;
  let netsFixed = !!opts.nets;
  let lastEuro = null;
  let perFollower = null;
  return scenes.map((sc, i) => {
    let kind = pickShot(sc.text || '', i, scenes.length, sc.black);
    if (kind === 'intro' && seen.intro !== undefined) kind = 'talk'; // nur einmal Eröffnungsfahrt
    const k = (seen[kind] = (seen[kind] ?? -1) + 1);
    const variants = SHOTS[kind];
    const shot = variants[k % variants.length];
    const text = sc.text || '';
    const low = text.toLowerCase();
    let vote = kind === 'vote' || kind === 'voteresult' ? parseVote(text) || prevVote : null;
    if (vote) prevVote = vote;
    // Wer hat gewonnen? ("A hat gewonnen" oder Stichwort der Antwort in den nächsten Sätzen)
    let winner = 0;
    if (kind === 'voteresult') {
      const around = [text, scenes[i + 1]?.text || '', scenes[i + 2]?.text || ''].join(' ').toLowerCase();
      if (/\bb\b[^.!?]*gewonnen|\bb\s+gewinnt/.test(around)) winner = 1;
      else if (!/\ba\b[^.!?]*gewonnen|\ba\s+gewinnt/.test(around) && vote && around.includes(stem(vote[1])) && !around.includes(stem(vote[0]))) winner = 1;
    }
    const eu = euros(text);
    const amount = eu.length ? eu[0] : lastEuro;
    if (eu.length) lastEuro = eu[0];
    if (eu.length > 1 && /follower/.test(low)) perFollower = eu[1];
    const fixedBefore = netsFixed;
    if (kind === 'repair') netsFixed = true;
    const growTo = kind === 'growth' ? firstNumber(text) ?? fans : null;
    const jobs = kind === 'jobs' ? JOBS.filter(([k2]) => low.includes(k2)) : [];
    const ctx = { kind, k, shot, text, low, fans, names, vote, winner, amount, perFollower, netsFixed: fixedBefore, growTo, jobs, first: i === 0 };
    return {
      isAnim: true,
      verein: true,
      needsShade: false,
      preferCut: true,
      spec: { place: kind === 'slogan' ? 'verein-end' : 'verein', props: [], actors: [] },
      kind,
      sfx: sfxFor(ctx),
      draw(g, W, H, t, dur, info = {}) {
        drawWorld(g, W, H, t, Math.max(0.5, dur), ctx, info);
      },
      drawOverlay(g, W, H, t, dur) {
        g.save();
        g.scale(W / VW, W / VW);
        overlays(g, t, Math.max(0.5, dur), ctx);
        g.restore();
      },
    };
  });
}

// ------------------------------------------------------------------ Welt ---
function drawWorld(g, W, H, t, dur, c, info) {
  const { shot, kind } = c;
  const p = smooth(clamp(t / dur));
  const cx = lerp(shot.a[0], shot.b[0], p);
  const cy = lerp(shot.a[1], shot.b[1], p);
  const z = lerp(shot.a[2], shot.b[2], p) * (W / VW);
  const view = { x0: cx - W / 2 / z, x1: cx + W / 2 / z, y0: cy - H / 2 / z, y1: cy + H / 2 / z };
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(z, z);
  g.translate(-cx, -cy);
  A.drawSky(g, info.tAbs ?? t);
  A.drawFar(g);
  A.drawGround(g, view);
  A.drawClubhouse(g, t);
  // Tribüne: Fans je nach Einstellung
  let seated = Math.min(A.STAND_SEATS, c.fans);
  let pop = [];
  let board = c.fans;
  if (kind === 'growth') {
    // Zähler + Tribüne füllen sich gleichzeitig
    const n = Math.round(clamp((t - 0.4) / Math.max(0.8, dur * 0.7)) * (c.growTo || 0));
    board = n;
    seated = Math.min(A.STAND_SEATS, n);
    const G = Math.max(1, c.growTo || 1);
    pop = Array.from({ length: A.STAND_SEATS }, (_, j) => (t - 0.4 - (j / G) * Math.max(0.8, dur * 0.7)) / 0.25 + 0.2);
  } else if (kind === 'stand_fill') {
    // Vorschau: von den echten Fans bis zur vollen Tribüne (nur neue Plätze ploppen auf)
    const cap = A.STAND_SEATS;
    const have = Math.min(cap, c.fans);
    const span = Math.max(0.5, dur - 1.3);
    const n = have + clamp((t - 0.3) / span) * (cap - have);
    seated = Math.max(seated, Math.ceil(n));
    pop = Array.from({ length: cap }, (_, j) => (j < have ? 1 : (t - 0.3 - ((j - have) / Math.max(1, cap - have)) * span) / 0.25));
  }
  A.drawStand(g, t, seated, pop, { board, names: c.names, nameTag: kind === 'nametag' });
  A.drawBench(g, t);
  A.drawToilet(g, t, kind === 'toilet' ? toiletDoor(t, dur, c) : 0);
  A.drawCooler(g, t, kind === 'cooler' ? smooth(clamp((t - 0.5) / 0.5)) : 0);
  const bt = ballTimes();
  const hit = kind === 'goalpost' && t > bt.hit && t < bt.hit + 0.8 ? 1 - (t - bt.hit) / 0.8 : 0;
  const fixAt = dur * 0.55;
  const nets = c.netsFixed || (kind === 'repair' && t > fixAt);
  A.drawGoal(g, t, 'L', hit, nets);
  A.drawGoal(g, t, 'R', 0, nets);
  if (kind === 'repair') repairPuff(g, t, dur, fixAt);
  A.drawFlag(g, t, 'L');
  A.drawFlag(g, t, 'R');
  A.drawLawnSign(g, t);
  if (shot.players) A.PLAYERS.forEach((pl, j) => A.drawPlayer(g, pl, 1830 + j * 118, 1380, 380, t + j, { wave: shot.wave && pl.n === 9 && p > 0.5 ? 1 : 0 }));
  if (kind === 'goalpost') {
    const b = ballPos(t);
    if (b) A.drawBall(g, b.x, b.y, b.r, b.rot);
  }
  if (shot.rudi) {
    const r = shot.rudi;
    const pose = c.k % 2 && r.pose === 'pocket' ? 'crossed' : r.pose;
    A.drawRudi(g, r.x, r.y, r.H, { pose, mouth: info.mouth || 0, t, talk: (info.mouth || 0) > 0.05, look: Math.sin(t * 0.7) * 0.5 });
  }
  g.restore();
}
// Reparatur-Übergang: Staubwolke mit Werkzeug, danach neues Netz
function repairPuff(g, t, dur, fixAt) {
  const a = fixAt - 0.5;
  const k = (t - a) / 1.0;
  if (k <= 0 || k >= 1) return;
  const x = 510;
  const y = 1110;
  const s = Math.sin(k * Math.PI);
  g.save();
  g.globalAlpha = s;
  for (let i = 0; i < 9; i++) {
    const ang = i * 0.7 + t * 2;
    P(g, '#f4efe6', 4, ell(x + Math.cos(ang) * 90 * s, y - 60 + Math.sin(ang) * 50 * s, 70 * s + 20, 55 * s + 15));
  }
  // Hammer + Schraubenschlüssel wirbeln
  g.translate(x, y - 70);
  g.rotate(t * 9);
  P(g, '#8a5a30', 4, rr(-6, -10, 12, 80, 4));
  P(g, '#9aa5ad', 4, rr(-30, -26, 60, 24, 6));
  g.restore();
  for (let i = 0; i < 5; i++) {
    const ang = i * 1.3 + t * 4;
    star(g, x + Math.cos(ang) * 160 * s, y - 80 + Math.sin(ang) * 90 * s, 14 * s);
  }
}
function star(g, x, y, r) {
  if (r <= 0.5) return;
  P(g, '#fff6a8', 3, (g2) => {
    for (let i = 0; i < 8; i++) {
      const rr2 = i % 2 ? r * 0.4 : r;
      const a2 = (i / 8) * Math.PI * 2;
      g2[i ? 'lineTo' : 'moveTo'](x + Math.cos(a2) * rr2, y + Math.sin(a2) * rr2);
    }
    g2.closePath();
  });
}
function toiletDoor(t, dur, c) {
  const slam = /zu hause|vorher|lieber/.test(c.low);
  const close = dur - 0.45;
  if (t < 0.2) return 0;
  if (!slam || t < close) return smooth(clamp((t - 0.2) / 1.4)) * 0.85;
  return clamp(0.85 - (t - close) / 0.12) * 0.85;
}
function ballTimes() {
  return { kick: 0.35, hit: 1.0, end: 1.9 };
}
function ballPos(t) {
  const { kick, hit, end } = ballTimes();
  const from = { x: 980, y: 1230 };
  const post = { x: 660, y: 1100 };
  if (t < kick) return { x: from.x, y: from.y, r: 18, rot: 0 };
  if (t < hit) {
    const k = (t - kick) / (hit - kick);
    return { x: lerp(from.x, post.x, k), y: lerp(from.y, post.y, k) - Math.sin(k * Math.PI) * 120, r: 18, rot: k * 9 };
  }
  const k = Math.min(1, (t - hit) / (end - hit));
  return { x: lerp(post.x, 820, k), y: post.y + 120 * k - Math.abs(Math.sin(k * Math.PI * 2)) * 70 * (1 - k), r: 18, rot: -k * 6 };
}

// ------------------------------------------------------------ Geräusche ---
function sfxFor(c) {
  const out = [];
  const add = (at, type, dur) => out.push({ at, type, ...(dur ? { dur } : {}) });
  switch (c.kind) {
    case 'intro':
      if (c.first) add(0.1, 'whistle');
      add(0.3, 'whoosh');
      if (/champions/.test(c.low)) add(1.4, 'chirp');
      break;
    case 'team':
      add(0, 'whoosh');
      add(0.8, 'ding');
      break;
    case 'bench':
      add(0.1, 'crickets', 3);
      break;
    case 'stadium':
      add(0, 'whoosh');
      break;
    case 'goalpost':
      add(0.35, 'kick');
      add(1.0, 'clang');
      break;
    case 'lawn':
      if (/budget|nicht/.test(c.low)) add(1.2, 'stamp');
      break;
    case 'stand_empty':
      add(0, 'creak');
      add(1.3, c.fans ? 'cheer' : 'trombone');
      break;
    case 'stand_point':
    case 'nametag':
      add(1.0, 'pop');
      break;
    case 'stand_fill':
      for (let j = 0; j < 8; j++) add(0.3 + j * 0.45, 'pop');
      add(3.5, 'cheer');
      if (/anbau|ausbau/.test(c.low)) add(3.8, 'hammer');
      break;
    case 'toilet':
      add(0.2, 'creak');
      add(0, 'flies', 3);
      break;
    case 'cooler':
      add(0.5, 'lid');
      add(0.85, 'clink');
      break;
    case 'vote':
      add(0.5, 'pop');
      add(1.2, 'pop');
      break;
    case 'money':
      add(0.6, 'ding');
      break;
    case 'daily':
      add(0.2, 'whistleshort');
      break;
    case 'follow':
      add(0.9, 'pop');
      add(1.4, 'ding');
      break;
    case 'slogan':
      add(0.05, 'boom');
      break;
    case 'growth':
      for (let j = 0; j < 10; j++) add(0.45 + j * 0.3, 'pop');
      add(3.2, 'cheer');
      break;
    case 'voteresult':
      add(0.2, 'whoosh');
      add(1.4, 'ding');
      add(1.6, 'cheer');
      break;
    case 'repair':
      add(0.4, 'whoosh');
      add(1.2, 'hammer');
      add(2.2, 'ding');
      break;
    case 'jobs':
      for (let j = 0; j < Math.max(1, c.jobs.length); j++) add(0.3 + j * 0.7, 'whoosh');
      break;
    case 'apply':
      add(0.5, 'pop');
      break;
    case 'matchday':
      add(0.1, 'whistle');
      add(0.6, 'cheer');
      break;
    default:
  }
  return out;
}

// ---------------------------------------------------------- Einblendungen ---
const popIn = (t, t0, t1, d = 0.22) => {
  if (t < t0 || t > t1) return 0;
  return Math.min(A.easeOutBack(clamp((t - t0) / d)), clamp((t1 - t) / 0.18));
};
function card(g, x, y, w, h, fill, s, rot = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  P(g, OL, 0, rr(-w / 2, -h / 2 + 12, w, h, 26));
  P(g, fill, 8, rr(-w / 2, -h / 2, w, h, 26));
}
function overlays(g, t, dur, c) {
  const end = dur - 0.05;
  const T = (x) => Math.min(x, dur * 0.3); // bei kurzen Sätzen früher einblenden
  const { kind, low } = c;
  if ((kind === 'intro' || kind === 'talk') && /rudi kiesel/.test(low)) {
    const np = popIn(t, T(0.4), end);
    if (np > 0) {
      g.save();
      g.translate(-(1 - Math.min(1, np)) * 500, 0);
      P(g, OL, 0, rr(40, 1050, 640, 150, 18));
      P(g, BLUE, 7, rr(40, 1040, 640, 150, 18));
      label(g, 'RUDI KIESEL', 70, 1090, 58, '#fff', { sw: 0, align: 'left' });
      label(g, 'Cheftrainer & Gründer', 72, 1150, 36, '#ffd60a', { sw: 0, align: 'left' });
      g.restore();
    }
  }
  if (/champions/.test(low) && kind !== 'goal') trophy(g, 820, 520, popIn(t, Math.min(1.3, dur * 0.4), end), t);
  if (kind === 'goal') {
    if (/liga|ganz nach oben/.test(low)) ladder(g, t, dur);
    else trophy(g, 820, 520, popIn(t, T(0.5), end), t);
  }
  if (kind === 'team') {
    const m = low.match(/(\d+|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+spieler/);
    const n = m ? NUMWORDS[m[1]] || m[1] : 11;
    const v = popIn(t, T(0.7), end);
    if (v > 0) {
      card(g, VW / 2, 400, 600, 150, '#ffffff', v, 0.02);
      label(g, `${n} SPIELER`, -40, 0, 70, BLUE, { sw: 0 });
      P(g, '#2f9e4f', 0, ell(230, 0, 46, 46));
      line(g, [[208, 0], [225, 18], [255, -18]], 12, '#fff');
      g.restore();
    }
  }
  if (kind === 'bench') {
    const v = popIn(t, T(0.5), end);
    if (v > 0) {
      card(g, VW / 2, 420, 860, 170, '#ffffff', v, -0.02);
      label(g, 'AUSWECHSELSPIELER:', -70, 0, 52, OL, { sw: 0 });
      label(g, '0', 330, 0, 96, '#e53935', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'stadium') {
    const v = popIn(t, T(0.2), end);
    if (v > 0) {
      card(g, VW / 2, 400, 820, 190, '#ffffff', v, -0.03);
      label(g, 'KIESELBACH-ARENA', 0, -10, 70, BLUE, { sw: 0 });
      if (/schotter|übertrieben|naja/.test(low)) {
        const st = clamp((t - Math.min(1.4, dur * 0.45)) / 0.3);
        if (st > 0) {
          line(g, [[-360, 0], [-360 + 720 * st, -18]], 14, '#e53935');
          label(g, 'SCHOTTERPLATZ', 40, 95, 62, '#e53935', { sw: 10, stroke: '#fff', rot: -0.06 });
        }
      }
      g.restore();
    }
  }
  if (kind === 'lawn' && /budget|nicht/.test(low)) {
    const sp = clamp((t - T(1.2)) / 0.15);
    if (sp > 0) {
      g.save();
      g.translate(VW / 2, 470);
      g.rotate(-0.16);
      g.scale(1 + (1 - sp) * 1.4, 1 + (1 - sp) * 1.4);
      g.globalAlpha = sp;
      g.lineWidth = 12;
      g.strokeStyle = '#e53935';
      g.strokeRect(-390, -110, 780, 220);
      label(g, 'RASEN:', 0, -45, 70, '#e53935', { sw: 0 });
      label(g, 'NICHT IM BUDGET', 0, 45, 70, '#e53935', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'stand_empty') {
    const v = popIn(t, T(1.2), end);
    if (v > 0) {
      card(g, VW / 2, 430, 640, 230, '#ffffff', v, 0.03);
      label(g, `${c.fans} FANS`, -60, 0, 100, c.fans ? '#2f9e4f' : '#e53935', { sw: 0 });
      P(g, '#ffd60a', 7, ell(225, 0, 58, 58));
      P(g, OL, 0, ell(205, -14, 7, 9));
      P(g, OL, 0, ell(245, -14, 7, 9));
      g.beginPath();
      if (c.fans) g.arc(225, 8, 26, 0.2, Math.PI - 0.2);
      else g.arc(225, 35, 26, Math.PI * 1.15, Math.PI * 1.85);
      g.lineWidth = 7;
      g.strokeStyle = OL;
      g.stroke();
      g.restore();
    }
  }
  if (kind === 'stand_point') {
    const v = popIn(t, T(1.0), end);
    if (v > 0) {
      card(g, VW / 2, 400, 880, 180, '#ffd60a', v, -0.02);
      label(g, '1 FOLLOWER = 1 PLATZ', 0, 0, 66, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'stand_fill' && !/anbau|ausbau/.test(low)) {
    const v = popIn(t, T(0.4), end);
    if (v > 0) {
      card(g, VW / 2, 400, 820, 190, '#ffd60a', v, -0.03);
      label(g, 'UNSER ZIEL:', 0, -40, 56, OL, { sw: 0 });
      label(g, `${A.STAND_SEATS} VOLLE PLÄTZE!`, 0, 40, 66, '#e53935', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'stand_fill' && /anbau|ausbau/.test(low)) {
    const v = popIn(t, Math.max(0.5, dur - 1.2), end + 0.2);
    if (v > 0) {
      card(g, VW / 2, 420, 860, 190, '#ffd60a', v, 0.04);
      g.save();
      g.beginPath();
      g.roundRect(-430, -95, 860, 40, 20);
      g.clip();
      for (let x = -460; x < 460; x += 60) P(g, OL, 0, poly([[x, -95], [x + 30, -95], [x + 70, -55], [x + 40, -55]]));
      g.restore();
      label(g, 'STADIONAUSBAU!', 0, 30, 82, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'nametag') {
    const v = popIn(t, T(0.8), end);
    if (v > 0) {
      card(g, VW / 2, 400, 900, 190, '#ffffff', v, -0.02);
      label(g, 'DEIN NAME', 0, -38, 64, BLUE, { sw: 0 });
      label(g, 'AUF UNSERER TRIBÜNE', 0, 36, 56, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'toilet' && /zu hause|vorher|lieber/.test(low)) {
    const v = popIn(t, Math.max(0.6, dur - 1.6), end);
    if (v > 0) {
      card(g, VW / 2, 430, 760, 220, '#fff59d', v, -0.05);
      label(g, 'TIPP:', 0, -55, 58, '#e53935', { sw: 0 });
      label(g, 'VORHER ZU HAUSE GEHEN!', 0, 30, 54, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'cooler') {
    const v = popIn(t, T(1.1), end);
    if (v > 0) {
      card(g, VW / 2, 400, 760, 160, '#ffffff', v, 0.03);
      label(g, 'GETRÄNKEAUSWAHL: 4', 0, 0, 62, BLUE, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'vote') voteCards(g, t, end, c);
  if (kind === 'money') {
    const m = low.match(/(\d+)\s*(€|euro)/);
    const v = popIn(t, T(0.5), end);
    if (v > 0) {
      card(g, VW / 2, 400, 820, 170, '#ffffff', v, 0.02);
      const kasse = /teamkasse/.test(low) ? 'TEAMKASSE' : 'VEREINSKASSE';
      const plus = /bedeutet|bringt|plus|dazu|bekommen/.test(low) ? '+' : '';
      label(g, `${kasse}: ${plus}${m ? m[1] : '50'} €`, 0, 0, 64, '#2f9e4f', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'daily') {
    const v = popIn(t, T(0.2), end);
    if (v > 0) {
      card(g, VW / 2, 330, 900, 170, '#ffd60a', v, -0.03);
      label(g, 'AB MORGEN: JEDEN TAG', 0, -30, 58, OL, { sw: 0 });
      label(g, 'EIN NEUES SPIEL!', 0, 35, 58, '#e53935', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'follow') {
    const v = popIn(t, T(0.6), end);
    if (v > 0) {
      card(g, VW / 2, 1590, 560, 150, '#fe2c55', v, 0);
      label(g, '+  FOLGEN', 0, 2, 72, '#fff', { sw: 0 });
      const tap = t - 1.4;
      const hy = tap > 0 && tap < 0.3 ? 20 : 0;
      P(g, '#f6c9a0', 7, rr(150, 30 + hy, 70, 110, 30));
      P(g, '#f6c9a0', 7, rr(160, -10 + hy, 30, 80, 15));
      g.restore();
    }
  }
  if (kind === 'slogan') endCard(g, t, dur, c);
  if (kind === 'growth') {
    const v = popIn(t, T(0.2), end);
    if (v > 0) {
      const n = Math.round(clamp((t - 0.4) / Math.max(0.8, dur * 0.7)) * (c.growTo || 0));
      card(g, VW / 2, 400, 700, 200, '#ffffff', v, -0.02);
      label(g, 'FOLLOWER', 0, -45, 50, BLUE, { sw: 0 });
      label(g, String(n), 0, 40, 110, '#2f9e4f', { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'money' && c.perFollower) {
    const v = popIn(t, T(1.4), end);
    if (v > 0) {
      card(g, VW / 2, 600, 760, 130, '#ffd60a', v, 0.03);
      label(g, `1 FOLLOWER = ${c.perFollower} €`, 0, 2, 60, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'voteresult') resultBars(g, t, end, c, T);
  if (kind === 'repair') {
    const v = popIn(t, T(0.2), end);
    if (v > 0) {
      const amt = c.amount ?? 150;
      const spend = clamp((t - dur * 0.25) / 0.6);
      const now = Math.round(amt * (1 - smooth(spend)));
      card(g, VW / 2, 380, 700, 200, '#ffffff', v, 0.02);
      label(g, 'TEAMKASSE', 0, -50, 50, BLUE, { sw: 0 });
      label(g, `${now} €`, 0, 35, 100, now ? '#2f9e4f' : '#e53935', { sw: 0 });
      g.restore();
      if (spend > 0 && spend < 1) label(g, `−${amt} €`, VW / 2 + 260, 300 - spend * 80, 70, '#e53935', { sw: 12, stroke: '#fff' });
    }
    const done = popIn(t, dur * 0.62, end);
    if (done > 0) {
      card(g, VW / 2, 640, 700, 130, '#a5e3b6', done, -0.03);
      label(g, 'TORNETZE REPARIERT!', 0, 2, 60, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'jobs') jobCards(g, t, dur, c);
  if (kind === 'apply') {
    const v = popIn(t, T(0.4), end);
    if (v > 0) {
      card(g, VW / 2, 420, 900, 210, '#ffffff', v, -0.02);
      bubble(g, -340, 0, 60);
      label(g, 'BEWIRB DICH', 60, -40, 70, BLUE, { sw: 0 });
      label(g, 'IN DEN KOMMENTAREN!', 60, 40, 56, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'follow' && /kasse|follow da/.test(low)) {
    const v = popIn(t, T(0.4), end);
    if (v > 0) {
      card(g, VW / 2, 420, 820, 150, '#ffd60a', v, 0.02);
      label(g, `JEDER FOLLOW = +${c.perFollower || 5} € 💰`.replace(' 💰', ''), 0, 2, 64, OL, { sw: 0 });
      g.restore();
    }
  }
  if (kind === 'matchday') {
    const v = popIn(t, T(0.3), end);
    if (v > 0) {
      const day = (low.match(/montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag/) || ['bald'])[0].toUpperCase();
      card(g, VW / 2, 430, 900, 260, '#ffd60a', v, -0.03);
      A.drawBall(g, -360, -10, 60, t * 3);
      label(g, day, 40, -60, 96, '#e53935', { sw: 0 });
      label(g, 'UNSER ERSTES SPIEL!', 40, 50, 66, OL, { sw: 0 });
      g.restore();
    }
  }
}

// Abstimmungsergebnis: Balken wachsen, Gewinner-Karte
function resultBars(g, t, end, c, T) {
  const [a, b] = c.vote || ['A', 'B'];
  const win = c.winner;
  const pct = [win ? 31 : 69, win ? 69 : 31];
  const m = c.low.match(/(\d+)\s*%/);
  if (m) {
    pct[win] = Math.min(100, Number(m[1]));
    pct[1 - win] = 100 - pct[win];
  }
  if (c.k === 0) {
    const v = popIn(t, T(0.2), end);
    if (v <= 0) return;
    card(g, VW / 2, 420, 920, 360, '#ffffff', v, 0);
    const grow = smooth(clamp((t - 0.5) / 1.0));
    [a, b].forEach((lbl, i) => {
      const y = -90 + i * 150;
      label(g, i ? 'B' : 'A', -400, y, 70, i ? OL : BLUE, { sw: 0 });
      P(g, '#e9edf5', 5, rr(-340, y - 40, 600, 80, 20));
      P(g, i === win ? '#2f9e4f' : '#9aa5ad', 0, rr(-338, y - 38, Math.max(1, 596 * (pct[i] / 100) * grow), 76, 18));
      label(g, lbl.length > 14 ? `${lbl.slice(0, 13)}…` : lbl, -320, y, 40, '#fff', { sw: 6, align: 'left' });
      label(g, `${Math.round(pct[i] * grow)} %`, 350, y, 52, OL, { sw: 0 });
    });
    g.restore();
  }
  const w = popIn(t, c.k === 0 ? T(1.5) : T(0.3), end);
  if (w > 0) {
    card(g, VW / 2, c.k === 0 ? 760 : 430, 820, 170, '#2f9e4f', w, -0.03);
    label(g, `${win ? 'B' : 'A'} HAT GEWONNEN!`, 0, c.k === 0 ? 0 : -30, 72, '#ffffff', { sw: 10 });
    if (c.k !== 0) label(g, (win ? b : a) || '', 0, 45, 50, '#ffd60a', { sw: 8 });
    g.restore();
  }
}

// Stellenanzeigen fliegen abwechselnd von links und rechts herein
function jobCards(g, t, dur, c) {
  if (!c.jobs.length) {
    const v = popIn(t, Math.min(0.3, dur * 0.2), dur - 0.05);
    if (v > 0) {
      card(g, VW / 2, 420, 880, 220, '#ffd60a', v, -0.03);
      label(g, 'WIR SUCHEN', 0, -45, 70, OL, { sw: 0 });
      label(g, 'VERSTÄRKUNG!', 0, 45, 84, '#e53935', { sw: 0 });
      g.restore();
    }
    return;
  }
  const step = Math.min(0.75, Math.max(0.35, (dur - 0.6) / c.jobs.length));
  c.jobs.forEach(([, title, icon], i) => {
    const t0 = 0.25 + i * step;
    const k = clamp((t - t0) / 0.35);
    if (k <= 0) return;
    const fromLeft = i % 2 === 0;
    const x = VW / 2 + (fromLeft ? -1 : 1) * (1 - A.easeOutBack(k)) * 900;
    const y = 280 + i * 165;
    g.save();
    g.translate(x, y);
    g.rotate((fromLeft ? -1 : 1) * 0.025);
    P(g, OL, 0, rr(-420, -62, 840, 136, 24));
    P(g, '#ffffff', 7, rr(-420, -72, 840, 136, 24));
    P(g, BLUE, 0, rr(-414, -66, 140, 124, [20, 0, 0, 20]));
    jobIcon(g, -344, -4, icon);
    label(g, 'GESUCHT:', -250, -28, 34, '#e53935', { sw: 0, align: 'left' });
    label(g, title, -250, 20, 60, OL, { sw: 0, align: 'left' });
    g.restore();
  });
}
function jobIcon(g, x, y, kind) {
  if (kind === 'bear') {
    P(g, '#9a6537', 4, ell(x - 28, y - 28, 15, 15));
    P(g, '#9a6537', 4, ell(x + 28, y - 28, 15, 15));
    P(g, '#b47843', 5, ell(x, y + 2, 42, 38));
    P(g, '#e8c9a0', 3, ell(x, y + 14, 18, 13));
    P(g, OL, 0, ell(x - 14, y - 6, 5, 6));
    P(g, OL, 0, ell(x + 14, y - 6, 5, 6));
    P(g, OL, 0, ell(x, y + 9, 6, 4));
  } else if (kind === 'money') {
    P(g, '#d9a441', 5, ell(x, y + 8, 38, 34));
    P(g, '#d9a441', 5, rr(x - 14, y - 38, 28, 16, 6));
    label(g, '€', x, y + 10, 46, '#fff', { sw: 6 });
  } else if (kind === 'mic') {
    P(g, '#3a3a3a', 5, rr(x - 16, y - 40, 32, 50, 16));
    line(g, [[x - 26, y], [x - 26, y + 10], [x, y + 26], [x + 26, y + 10], [x + 26, y]], 6, '#ffffff');
    line(g, [[x, y + 26], [x, y + 44]], 6, '#ffffff');
  } else if (kind === 'shirt') {
    P(g, '#ffffff', 5, poly([[x - 40, y - 20], [x - 20, y - 36], [x + 20, y - 36], [x + 40, y - 20], [x + 26, y - 6], [x + 22, y + 40], [x - 22, y + 40], [x - 26, y - 6]]));
  } else if (kind === 'plus') {
    P(g, '#ffffff', 0, rect(x - 12, y - 38, 24, 76));
    P(g, '#ffffff', 0, rect(x - 38, y - 12, 76, 24));
  } else A.drawBall(g, x, y, 40, 0.3);
}
function bubble(g, x, y, r) {
  P(g, BLUE, 6, (g2) => {
    g2.ellipse(x, y - 8, r, r * 0.8, 0, 0, Math.PI * 2);
  });
  P(g, BLUE, 0, poly([[x - 20, y + 30], [x - 30, y + 62], [x + 6, y + 36]]));
  for (const dx of [-24, 0, 24]) P(g, '#fff', 0, ell(x + dx, y - 8, 7, 7));
}
function voteCards(g, t, end, c) {
  const [a, b] = c.vote || ['A', 'B'];
  const T = (x) => Math.min(x, end * 0.35);
  const va = popIn(t, T(0.5), end);
  const vb = popIn(t, T(1.2), end);
  if (va > 0) {
    card(g, 285, 470, 470, 330, BLUE, va, -0.04);
    label(g, 'A', 0, -95, 110, '#ffffff', { sw: 14 });
    wrapLabel(g, a, 0, 55, 400, 46, '#ffffff');
    g.restore();
  }
  if (vb > 0) {
    card(g, 795, 470, 470, 330, '#ffffff', vb, 0.04);
    label(g, 'B', 0, -95, 110, BLUE, { sw: 14 });
    wrapLabel(g, b, 0, 55, 400, 46, OL);
    g.restore();
  }
  const vc = /gestern|durftet|habt ihr/.test(c.low) ? 0 : popIn(t, T(1.9), end); // Rückblick: keine neue Abstimmung
  if (vc > 0) {
    card(g, VW / 2, 760, 820, 120, '#ffd60a', vc, 0);
    label(g, 'KOMMENTIERE A ODER B!', 0, 2, 56, OL, { sw: 0 });
    g.restore();
  }
}
function wrapLabel(g, text, x, y, maxW, size, fill) {
  g.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && g.measureText(test).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  lines.slice(0, 3).forEach((l, i) => label(g, l, x, y + (i - (Math.min(3, lines.length) - 1) / 2) * size * 1.1, size, fill, { sw: 0 }));
}
function trophy(g, x, y, s, t) {
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.rotate(Math.sin(t * 2) * 0.05);
  P(g, '#f7c948', 8, (g2) => {
    g2.moveTo(-90, -110);
    g2.lineTo(90, -110);
    g2.quadraticCurveTo(85, 10, 0, 40);
    g2.quadraticCurveTo(-85, 10, -90, -110);
    g2.closePath();
  });
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(sx * 100, -60, 38, 48, 0, sx < 0 ? Math.PI * 0.5 : -Math.PI * 0.5, sx < 0 ? Math.PI * 1.5 : Math.PI * 0.5);
    g.lineWidth = 22;
    g.strokeStyle = OL;
    g.stroke();
    g.lineWidth = 10;
    g.strokeStyle = '#f7c948';
    g.stroke();
  }
  P(g, '#f7c948', 8, rect(-18, 38, 36, 50));
  P(g, '#8a5a30', 8, rr(-70, 85, 140, 45, 8));
  P(g, '#fff6cf', 0, ell(-40, -70, 14, 30, 0.2));
  g.restore();
}
const LEAGUES = ['CHAMPIONS LEAGUE', 'BUNDESLIGA', '2. LIGA', '3. LIGA', 'REGIONALLIGA', 'OBERLIGA', 'LANDESLIGA', 'BEZIRKSLIGA', 'KREISLIGA A', 'KREISLIGA B', 'KREISLIGA C'];
function ladder(g, t, dur) {
  const show = clamp((t - 0.3) / 0.35);
  if (show <= 0) return;
  const hide = clamp((dur - 0.05 - t) / 0.25);
  const x = 600;
  const y0 = 230;
  const step = 84;
  g.save();
  g.globalAlpha = Math.min(1, show) * hide;
  g.translate((1 - smooth(show)) * 500, 0);
  P(g, 'rgba(15,25,60,0.85)', 8, rr(x - 20, y0 - 50, 470, step * LEAGUES.length + 70, 26));
  LEAGUES.forEach((n, i) => {
    const y = y0 + i * step;
    P(g, i === 0 ? '#ffd60a' : i === LEAGUES.length - 1 ? '#5b86e6' : '#ffffff', 5, rr(x, y - 30, 430, 64, 14));
    label(g, n, x + 215, y + 2, 32, OL, { sw: 0 });
  });
  const climb = clamp((t - 0.9) / Math.max(1, dur - 1.6));
  const idx = LEAGUES.length - 1 - smooth(climb) * (LEAGUES.length - 1);
  A.crest(g, x - 2, y0 + idx * step, 70);
  g.restore();
}
function endCard(g, t, dur, c) {
  const k = clamp(t / 0.5);
  g.save();
  g.globalAlpha = smooth(k) * 0.9;
  g.fillStyle = '#0f2357';
  g.fillRect(0, 0, VW, VH);
  g.restore();
  const s = A.easeOutBack(k);
  if (s > 0) {
    g.save();
    g.translate(VW / 2, 720);
    g.scale(s, s);
    A.bigCrest(g, 0, 0, 470);
    g.restore();
  }
  // Slogan aus dem Skript-Satz (zwei Teile, falls ein Punkt drin ist)
  const parts = c.text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2);
  parts.forEach((p, i) => {
    const kk = clamp((t - 0.4 - i * 0.9) / 0.4);
    if (kk > 0) wrapBig(g, p.toUpperCase(), VW / 2, 1240 + i * 120, 72 * A.easeOutBack(kk), i ? '#ffd60a' : '#ffffff');
  });
}
function wrapBig(g, text, x, y, size, fill) {
  g.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
  const w = g.measureText(text).width;
  const sc = w > VW - 80 ? (VW - 80) / w : 1;
  g.save();
  g.translate(x, y);
  g.scale(sc, sc);
  label(g, text, 0, 0, size, fill, { sw: 14 });
  g.restore();
}

/** Titel-Badge ("TAG 1") am Anfang des Videos */
export function drawVereinTitle(g, W, H, t, title) {
  if (t > 3.4) {
    if (t < 1e9) smallBadge(g, W, title);
    return;
  }
  const big = popIn(t, 0.25, 3.3);
  if (big <= 0) return;
  const m = String(title || '').match(/tag\s*(\d+)/i);
  const tag = m ? `TAG ${m[1]}` : 'SV KIESELBACH';
  let sub = String(title || '')
    .replace(/^.*?tag\s*\d+\s*[–—:-]?\s*/i, '')
    .replace(/[🎬⚽]/gu, '')
    .replace(/[?？]+\s*$/, '')
    .trim()
    .toUpperCase();
  if (!sub || sub.length > 34) sub = 'SV KIESELBACH';
  g.save();
  g.scale(W / VW, W / VW);
  g.translate(VW / 2, 400);
  g.scale(big, big);
  P(g, OL, 0, rr(-250, -96, 500, 190, 30));
  P(g, BLUE, 9, rr(-250, -110, 500, 190, 30));
  label(g, tag, 0, -10, tag.length > 6 ? 90 : 150, '#ffffff', { sw: 18 });
  g.font = '44px "Lilita One", "Arial Black", sans-serif';
  const sw = Math.min(900, g.measureText(sub).width + 150);
  P(g, OL, 0, rr(-sw / 2, 108, sw, 92, 46));
  P(g, '#ffffff', 8, rr(-sw / 2, 98, sw, 92, 46));
  A.drawBall(g, -sw / 2 + 60, 144, 26, 0.3);
  label(g, sub, 30, 146, 44, BLUE, { sw: 0 });
  g.restore();
}
function smallBadge(g, W, title) {
  const m = String(title || '').match(/tag\s*(\d+)/i);
  if (!m) return;
  g.save();
  g.scale(W / VW, W / VW);
  P(g, OL, 0, rr(36, 160, 210, 70, 18));
  P(g, BLUE, 6, rr(36, 150, 210, 70, 18));
  label(g, `TAG ${m[1]}`, 120, 186, 44, '#fff', { sw: 8 });
  A.crest(g, 212, 186, 30);
  g.restore();
}
