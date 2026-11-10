// SHARK ATTACK – Level (bis 100), Belohnungspfad und Aufgaben (täglich, wöchentlich, Dauer)
// Reine Logik ohne Grafik, damit sie leicht zu testen ist.

// ------------------------------------------------------------------ Level ---
export const MAX_LEVEL = 100;
// XP von Level l bis l+1 – wird immer mehr: 12, 14, 16 … Level 50: 230 … Level 99: 688 (gesamt ≈ 26.800 XP)
export const xpNeed = (l) => 12 + 2 * (l - 1) + Math.floor(0.05 * (l - 1) * (l - 1));
export function levelOf(xp) {
  let lvl = 1;
  let rest = Math.max(0, Math.floor(xp));
  while (lvl < MAX_LEVEL && rest >= xpNeed(lvl)) {
    rest -= xpNeed(lvl);
    lvl++;
  }
  if (lvl >= MAX_LEVEL) return { lvl: MAX_LEVEL, rest: 1, need: 1, max: true };
  return { lvl, rest, need: xpNeed(lvl), max: false };
}
// Besondere Freischaltungen nur über Level
export const LEVEL_UNLOCKS = {
  25: { type: 'skin', id: 'green' },
  50: { type: 'skin', id: 'neon' },
  60: { type: 'tank', id: 'purple' },
  100: { type: 'skin', id: 'gold' },
};
export function levelReward(l) {
  const coins = l % 10 === 0 ? 1000 + l * 20 : l % 5 === 0 ? 400 + l * 10 : 50 + l * 8;
  return { coins, unlock: LEVEL_UNLOCKS[l] || null };
}

// --------------------------------------------------------------- Aufgaben ---
// stat: welche Zahl zählt · max: true = bester Wert in EINEM Lauf, sonst wird addiert
const fmt = (n) => Number(n).toLocaleString('de-DE');
export const TEMPLATES = [
  { stat: 'coins', text: (g) => `Sammle ${fmt(g)} Münzen`, daily: [150, 300, 500], weekly: [2500, 4000, 6000], endless: (n) => 300 + 200 * n },
  { stat: 'dist', text: (g) => `Schwimme insgesamt ${fmt(g)} m`, daily: [1500, 3000, 5000], weekly: [15000, 25000, 40000], endless: (n) => 2000 + 1500 * n },
  { stat: 'runs', text: (g) => `Spiele ${fmt(g)} Läufe`, daily: [3, 5, 8], weekly: [25, 40, 60], endless: (n) => 5 + 3 * n },
  { stat: 'dodged', text: (g) => `Weiche ${fmt(g)} Hindernissen aus`, daily: [30, 60, 100], weekly: [300, 500, 800], endless: (n) => 50 + 30 * n },
  { stat: 'powers', text: (g) => `Sammle ${fmt(g)} Power-ups ein`, daily: [2, 4, 6], weekly: [15, 25, 35], endless: (n) => 3 + 2 * n },
  { stat: 'dives', text: (g) => `Tauche ${fmt(g)}× ab`, daily: [10, 20, 35], weekly: [100, 180, 250], endless: (n) => 15 + 10 * n },
  { stat: 'jumps', text: (g) => `Schwimm ${fmt(g)}× nach oben`, daily: [10, 20, 35], weekly: [100, 180, 250], endless: (n) => 15 + 10 * n },
  { stat: 'rides', text: (g) => `Reite ${fmt(g)}× auf dem Delfin`, weekly: [1, 2, 3] },
  { stat: 'chests', text: (g) => `Finde ${fmt(g)} Schatzkiste${g > 1 ? 'n' : ''}`, weekly: [1, 2, 3] },
  { stat: 'runDist', max: true, text: (g) => `Schaffe ${fmt(g)} m in einem Lauf`, daily: [500, 1000, 1500], weekly: [2000, 3000, 4000] },
  { stat: 'runCoins', max: true, text: (g) => `Sammle ${fmt(g)} Münzen in einem Lauf`, daily: [50, 100, 150], weekly: [250, 350, 450] },
];
const REWARD = {
  day: (d) => ({ xp: [5, 10, 15][d], coins: [100, 200, 300][d] }),
  week: (d) => ({ xp: [50, 65, 80][d], coins: [1000, 1500, 2000][d] }),
  endless: (n) => ({ xp: Math.min(40, 10 + 3 * n), coins: Math.min(1000, 150 + 50 * n) }),
};

// 14-Tage-Event: 5 schwere Aufgaben – alle geschafft = Weihnachtsmann-Skin
const EVENT_START = new Date(2026, 10, 9); // Montag, 9. Nov. 2026
export const EVENT_TASKS = [
  { t: 0, goal: 12000 }, // Münzen
  { t: 1, goal: 60000 }, // 60 km
  { t: 2, goal: 100 }, // Läufe
  { t: 3, goal: 2500 }, // ausweichen
  { t: 9, goal: 3000 }, // 3.000 m in einem Lauf
];
export function eventKey(d = new Date()) {
  const days = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - EVENT_START) / 86400000);
  const p = Math.floor(days / 14);
  return dayKey(new Date(EVENT_START.getFullYear(), EVENT_START.getMonth(), EVENT_START.getDate() + p * 14));
}

// Datum nach Ortszeit (Tag beginnt um Mitternacht, Woche am Montag)
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function weekKey(d = new Date()) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(m);
}
// Zeit bis zum nächsten Wechsel (ms)
export function msUntil(scope, d = new Date()) {
  if (scope === 'event') {
    const [y, m, dd] = eventKey(d).split('-').map(Number);
    return new Date(y, m - 1, dd + 14) - d;
  }
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (scope === 'week' ? 7 - ((d.getDay() + 6) % 7) : 1));
  return next - d;
}

// gleicher Tag/gleiche Woche = gleiche Aufgaben (für alle Spieler)
function rng(seedText) {
  let h = 1779033703;
  for (let i = 0; i < seedText.length; i++) h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function pickTasks(scope, key) {
  const r = rng(`${scope}:${key}`);
  const list = scope === 'day' ? 'daily' : 'weekly';
  const pool = TEMPLATES.map((t, i) => i).filter((i) => TEMPLATES[i][list]);
  const out = [];
  while (out.length < 3 && pool.length) {
    const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const d = out.length; // leicht, mittel, schwer
    out.push({ t, goal: TEMPLATES[t][list][d], ...REWARD[scope](d), claimed: false });
  }
  return out;
}
function newEndless(state, rand = Math.random) {
  const used = new Set(state.endless.tasks.map((x) => x.t));
  const pool = TEMPLATES.map((t, i) => i).filter((i) => TEMPLATES[i].endless && !used.has(i));
  const t = pool[Math.floor(rand() * pool.length)];
  const n = state.endless.tier[t] || 0;
  return { t, n, goal: TEMPLATES[t].endless(n), base: state.totals[TEMPLATES[t].stat] || 0, ...REWARD.endless(n), claimed: false };
}

export function freshState() {
  return { day: { key: '', stats: {}, tasks: [] }, week: { key: '', stats: {}, tasks: [] }, event: { key: '', stats: {}, tasks: [], final: false }, endless: { tasks: [], tier: {} }, totals: {} };
}
// Tag/Woche wechseln, Dauer-Aufgaben auffüllen
export function ensure(state, now = new Date()) {
  const s = state && state.day && state.week && state.endless ? state : freshState();
  s.totals ||= {};
  const dk = dayKey(now);
  if (s.day.key !== dk) s.day = { key: dk, stats: {}, tasks: pickTasks('day', dk) };
  const wk = weekKey(now);
  if (s.week.key !== wk) s.week = { key: wk, stats: {}, tasks: pickTasks('week', wk) };
  const ek = eventKey(now);
  if (!s.event || s.event.key !== ek) s.event = { key: ek, stats: {}, tasks: EVENT_TASKS.map((x) => ({ ...x, xp: 30, coins: 500, claimed: false })), final: false };
  s.endless.tier ||= {};
  while (s.endless.tasks.length < 3) s.endless.tasks.push(newEndless(s));
  return s;
}
// Ergebnis eines Laufs eintragen
export function addRun(state, run) {
  for (const [k, v] of Object.entries(run)) {
    const isMax = TEMPLATES.some((t) => t.stat === k && t.max);
    for (const box of [state.day.stats, state.week.stats, state.event.stats]) box[k] = isMax ? Math.max(box[k] || 0, v) : (box[k] || 0) + v;
    if (!isMax) state.totals[k] = (state.totals[k] || 0) + v;
  }
}
export function value(state, scope, task) {
  const stat = TEMPLATES[task.t].stat;
  if (scope === 'endless') return Math.max(0, (state.totals[stat] || 0) - task.base);
  return state[scope].stats[stat] || 0;
}
export const isDone = (state, scope, task) => value(state, scope, task) >= task.goal;
export const taskText = (task) => TEMPLATES[task.t].text(task.goal);
export function claimable(state) {
  let n = 0;
  for (const scope of ['day', 'week', 'event', 'endless']) for (const task of state[scope].tasks) if (!task.claimed && isDone(state, scope, task)) n++;
  return n;
}
export const eventComplete = (state) => state.event.tasks.every((t) => t.claimed);
// Belohnung abholen; Dauer-Aufgaben werden sofort durch eine schwerere ersetzt
export function claim(state, scope, idx) {
  const task = state[scope].tasks[idx];
  if (!task || task.claimed || !isDone(state, scope, task)) return null;
  const reward = { xp: task.xp, coins: task.coins };
  if (scope === 'endless') {
    state.endless.tier[task.t] = (task.n || 0) + 1;
    state.endless.tasks.splice(idx, 1);
    const next = newEndless(state);
    state.endless.tasks.splice(idx, 0, next);
  } else task.claimed = true;
  return reward;
}
