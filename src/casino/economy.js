// EconomyManager – alle Preise und Werte an EINER Stelle (leicht anpassbar)
// Nur virtuelles Spielgeld, kein echtes Glücksspiel, keine Echtgeld-Käufe.

export const START_MONEY = 1000;
// Spielautomaten: 1. Geschenk, 2. 500 $, danach steigend
export const SLOT_PRICES = [0, 500, 650, 800, 1000, 1200, 1450, 1700, 2000];

export const CATALOG = {
  slot: { name: 'Spielautomat „Lucky 7“', cat: 'Automaten', icon: '🎰', size: [1.0, 0.85], income: 12, playTime: [6, 10], desc: 'Gäste spielen hier. Bringt pro Spiel Einnahmen.' },
  counter: { name: 'Kassentresen', cat: 'Möbel', icon: '💰', price: 750, size: [2.5, 0.9], max: 1, desc: 'Sammelt alle Einnahmen automatisch ein (+10 % Bonus).' },
  deluxe: { name: 'Automat „Diamond“', cat: 'Automaten', icon: '💎', price: 1500, size: [1.0, 0.85], income: 30, playTime: [8, 12], desc: 'Edler Automat – bringt mehr pro Spiel.' },
  chair: { name: 'Samt-Sessel', cat: 'Sitzbereich', icon: '🛋️', price: 300, size: [0.85, 0.8], attract: 1, desc: 'Gemütlicher Sitzplatz. +1 Beliebtheit.' },
  lamp: { name: 'Stehlampe', cat: 'Beleuchtung', icon: '💡', price: 250, size: [0.5, 0.5], attract: 1, desc: 'Warmes Licht. +1 Beliebtheit.' },
  plant: { name: 'Zimmerpflanze', cat: 'Deko', icon: '🪴', price: 150, size: [0.55, 0.55], attract: 1, desc: 'Etwas Grün. +1 Beliebtheit.' },
  rug: { name: 'Teppich', cat: 'Deko', icon: '🟥', price: 400, size: [2.4, 1.6], attract: 2, walkable: true, desc: 'Großer Teppich. +2 Beliebtheit.' },
  statue: { name: 'Goldmünzen-Statue', cat: 'Deko', icon: '🏆', price: 900, size: [0.65, 0.65], attract: 3, desc: 'Glänzt! +3 Beliebtheit.' },
};
// Renovierungen (BuildingSystem)
export const REPAIRS = {
  door: { name: 'Neue Eingangstür', icon: '🚪', price: 500, attract: 1, level: 2 },
  sign: { name: 'Leuchtschild reparieren', icon: '✨', price: 800, attract: 2, level: 2 },
  lights: { name: 'Neue Beleuchtung', icon: '💡', price: 900, attract: 2, level: 3 },
  floor: { name: 'Teppichboden verlegen', icon: '🟥', price: 1200, attract: 2, level: 3 },
  walls: { name: 'Wände tapezieren', icon: '🧱', price: 1500, attract: 3, level: 4 },
};
export const LEVEL_XP = [0, 100, 300, 650, 1100, 1700, 2500, 3500, 5000];
export const COUNTER_BONUS = 0.1;
export const ATTRACT_BONUS = 0.04; // +4 % pro Beliebtheitspunkt

export class EconomyManager {
  constructor(state) { this.s = state; }
  owned(type) { return this.s.objects.filter((o) => o.type === type).length + (this.s.inv[type] || 0); }
  slotsOwned() { return this.owned('slot'); }
  price(type) {
    if (type === 'slot') return SLOT_PRICES[Math.min(this.slotsOwned(), SLOT_PRICES.length - 1)];
    return CATALOG[type].price;
  }
  // Freischalt-Logik der ersten Ausbauphase
  unlockInfo(type) {
    const s = this.s, slots = this.slotsOwned(), counter = this.owned('counter') > 0;
    const placedSlots = s.objects.filter((o) => o.type === 'slot').length;
    switch (type) {
      case 'slot':
        if (placedSlots < 1) return { ok: false, why: 'Stelle zuerst dein Geschenk auf' };
        if (slots >= 2 && !counter) return { ok: false, why: 'Erst den Kassentresen kaufen' };
        return { ok: true };
      case 'counter':
        if (slots < 2) return { ok: false, why: 'Ab 2 Spielautomaten' };
        if (this.owned('counter') >= 1) return { ok: false, why: 'Schon gekauft' };
        return { ok: true };
      case 'deluxe': return s.level >= 4 && counter ? { ok: true } : { ok: false, why: 'Ab Level 4' };
      case 'chair': case 'plant': return counter ? { ok: true } : { ok: false, why: 'Nach dem Kassentresen' };
      case 'lamp': return counter && s.level >= 2 ? { ok: true } : { ok: false, why: counter ? 'Ab Level 2' : 'Nach dem Kassentresen' };
      case 'rug': return counter && s.level >= 3 ? { ok: true } : { ok: false, why: 'Ab Level 3' };
      case 'statue': return counter && s.level >= 4 ? { ok: true } : { ok: false, why: 'Ab Level 4' };
      default: return { ok: false, why: '' };
    }
  }
  repairInfo(id) {
    const r = REPAIRS[id];
    if (this.s.repairs[id]) return { ok: false, why: 'Erledigt ✓' };
    if (!this.s.open) return { ok: false, why: 'Erst das Casino eröffnen' };
    if (this.s.level < r.level) return { ok: false, why: `Ab Level ${r.level}` };
    return { ok: true };
  }
  canAfford(n) { return this.s.money >= n; }
  spend(n) { if (this.s.money < n) return false; this.s.money -= n; return true; }
  earn(n) { this.s.money += Math.round(n); }
  attractiveness() {
    let a = 0;
    for (const o of this.s.objects) a += CATALOG[o.type].attract || 0;
    for (const id of Object.keys(this.s.repairs)) if (this.s.repairs[id]) a += REPAIRS[id].attract;
    return a;
  }
  incomeMult() { return 1 + this.attractiveness() * ATTRACT_BONUS + (this.owned('counter') ? COUNTER_BONUS : 0); }
  addXp(n) {
    this.s.xp += n;
    let up = false;
    while (this.s.level < LEVEL_XP.length && this.s.xp >= LEVEL_XP[this.s.level]) { this.s.level++; up = true; }
    return up;
  }
  levelProgress() {
    const L = this.s.level, a = LEVEL_XP[L - 1] ?? 0, b = LEVEL_XP[L] ?? a + 1000;
    return Math.min(1, (this.s.xp - a) / (b - a));
  }
}
