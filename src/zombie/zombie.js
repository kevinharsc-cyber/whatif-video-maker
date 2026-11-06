// DIE ZOMBIE-APOKALYPSE – Szenen für die App (gleiche Bauweise wie der Vereins-Modus)
// Jeder Satz bekommt passend zu seinen Stichwörtern eine Einstellung
// (Hütte, Horde, Kommentare, Verbündete, Kampf …) und eigene Einblendungen.
import * as Z from './art.js';
import { prepareVerein } from '../verein/verein.js';

const { P, rr, ell, line, label, clamp, lerp, smooth, easeOutBack, popIn, card, chip, VW } = Z;
const { DARK, YEL, RED, GREEN, ZSK } = Z;

// Schrift (Lilita One) lädt der Vereins-Modus schon
export const prepareZombie = () => prepareVerein();

// ------------------------------------------------------- Stichwörter ---
export function pickZombieShot(text, i, n) {
  const low = String(text || '').toLowerCase();
  const last = i === n - 1;
  if (last && /folg|morgen|kampf|sehen uns|bis morgen/.test(low)) return 'final';
  if (/\ba\s*[:)].+\bb\s*[:)]/.test(low) || /\ba oder b\b/.test(low)) return 'vote';
  if (/kommentar|schreib/.test(low)) return 'comment';
  if (/charakter|eigene figur|teil unserer geschichte|neu (in|bei) (unserer|der) gruppe|neu dabei|sind neu|ist neu/.test(low)) return 'characters';
  if (/verteidig|barrikad|vernagel|bretter/.test(low)) return 'defend';
  if (i > 0 && /kämpf|angriff|greifen an|attack|besieg|erledigt|ausgeschaltet|vernichtet|schlacht/.test(low)) return 'fight';
  if (/follower|folgt|folge mir|mitglied|beitreten|überlebensgruppe|neue überlebende/.test(low)) return 'follower';
  if (/mindestens|verbündete|ziel|brauchen? \d+/.test(low)) return 'goal';
  if (/brauche (ich )?euch|eure hilfe|helft mir|brauche (ich )?dich|brauchen euch/.test(low)) return 'need';
  if (/problem|gefahr|angst|oh nein|hilfe!/.test(low) && !/zombie/.test(low)) return 'problem';
  if (/zombie/.test(low) && /spur|kommen|unterwegs|eintreffen|horde|näher|anrück|\d+ zombies|zombies haben/.test(low)) return 'horde';
  if (/hütte|versteck|wald|unterschlupf|bunker/.test(low)) return 'hut';
  if (/allein|keine chance/.test(low)) return 'alone';
  if (i === 0 || /apokalypse|ausgebrochen|begonnen/.test(low)) return 'title';
  if (/zombie/.test(low)) return 'horde';
  return 'talk';
}

// "Lena: Baseballschläger, Max – Bratpfanne" → [{name, weapon}]
export function parseAllies(text) {
  return String(text || '')
    .split(/[,;\n]+/)
    .map((p) => p.trim().replace(/^@/, ''))
    .filter(Boolean)
    .map((p) => {
      const m = p.match(/^([^:–\-()]+?)\s*(?:[:–\-(]\s*|\s+mit\s+|\s+)(.*?)\)?$/i);
      return m ? { name: m[1].trim(), weapon: m[2].trim() } : { name: p, weapon: '' };
    })
    .filter((a) => a.name)
    .slice(0, 40);
}
function parseVote(text) {
  const m = String(text).match(/\bA\s*[:)]\s*(.+?)[.!?]?\s+(?:und\s+|oder\s+)?\bB\s*[:)]\s*(.+?)[.!?]*$/i);
  if (!m) return null;
  const short = (s) => s.replace(/^(ein|eine|einen|die|der|das|wir)\s+/i, '').trim().toUpperCase().slice(0, 26);
  return [short(m[1]), short(m[2])];
}
const firstNum = (re, scenes) => {
  for (const sc of scenes) {
    const m = String(sc.text || '').match(re);
    if (m) return Number(m[1]);
  }
  return null;
};
const WORDNUM = { zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, zwanzig: 20, hundert: 100 };
const numIn = (s) => {
  const m = String(s).match(/(\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf|zwanzig|hundert)/i);
  return m ? Number(m[1]) || WORDNUM[m[1].toLowerCase()] : null;
};

// ------------------------------------------------------------ Aufbau ---
export function createZombieVisuals(scenes, opts = {}) {
  const named = parseAllies(opts.allies).map((a) => Z.makeAlly(a.name, a.weapon));
  const followers = Math.max(0, Math.floor(Number(opts.followers) || 0));
  const zombiesText = firstNum(/(\d+)\s+zombies(?!\s+(?:erledigt|besiegt|ausgeschaltet|vernichtet|getötet))/i, scenes);
  const dayM = scenes.map((s) => String(s.text || '').match(/\btag\s*(\d+)/i)).find(Boolean);
  const day = dayM ? Number(dayM[1]) : null;
  const zombies = zombiesText ?? Math.max(0, Math.floor(Number(opts.zombies) || 10));
  const goalText = (() => {
    for (const sc of scenes) {
      const m = String(sc.text || '').match(/mindestens\s+(\S+)/i);
      if (m && numIn(m[1])) return numIn(m[1]);
    }
    return null;
  })();
  const goal = goalText ?? Math.max(1, Math.floor(Number(opts.goal) || 11));
  const allies = Math.max(followers, named.length);
  const examples = named.length ? named : Z.SURV;
  const seen = {};
  const hud = { zombies, allies, goal, day };
  return scenes.map((sc, i) => {
    const text = sc.text || '';
    const kind = sc.black ? 'black' : pickZombieShot(text, i, scenes.length);
    const k = (seen[kind] = (seen[kind] || 0) + 1) - 1;
    const c = { kind, k, text, low: text.toLowerCase(), i, n: scenes.length, last: i === scenes.length - 1, named, examples, allies, goal, zombies, vote: kind === 'vote' ? parseVote(text) : null, hud };
    return {
      isAnim: true,
      verein: true, // gleiche Darstellung wie der Vereins-Modus (Sticker-Untertitel, harte Schnitte)
      series: 'zombie',
      needsShade: false,
      preferCut: true,
      spec: { place: 'zombie', props: [], actors: [] },
      kind,
      sfx: sfxFor(c),
      draw(g, W, H, t, dur, info = {}) {
        g.save();
        g.scale(W / VW, W / VW);
        drawScene(g, t, Math.max(0.5, dur), c, info.mouth || 0);
        Z.vignette(g, kind === 'need' ? 0.25 : 0.55);
        g.restore();
      },
      drawOverlay(g, W, H, t, dur) {
        g.save();
        g.scale(W / VW, W / VW);
        overlays(g, t, Math.max(0.5, dur), c);
        g.restore();
      },
      drawTitle(g, W, H, t, title) {
        drawZombieTitle(g, W, t, title, kind === 'final' ? null : hud, day);
      },
    };
  });
}

// ----------------------------------------------------------- Kamera ---
function cam(g, cx, cy, z, shake = 0, t = 0) {
  g.translate(VW / 2 + Math.sin(t * 53) * shake * 9, 960 + Math.cos(t * 47) * shake * 9);
  g.scale(z, z);
  g.translate(-cx, -cy);
}
const SLOTS = [
  [-430, 0], [-300, 0], [-170, 0], [170, 0], [300, 0], [430, 0],
  [-370, 150], [-220, 150], [220, 150], [370, 150],
].map(([x, y]) => [540 + x, 1420 + y]);
function slotsScene(g, t, filled, popT, c, mouth) {
  Z.forest(g, t, { mood: 0.35, skipMid: 540 });
  Z.hut(g, 540, 1260, 0.75, { t });
  SLOTS.forEach(([x, y], i) => {
    if (i === 6) Z.drawHero(g, 540, 1470, 330, { pose: 'talk', mouth, t });
    const on = filled > i;
    if (!on) return Z.drawSurv(g, x, y, 290, { sil: true }, t);
    const a = easeOutBack(clamp((popT - i * 0.33) / 0.3));
    const o = c.named[i] || Z.EXTRA[i % Z.EXTRA.length];
    Z.drawSurv(g, x, y, 290 * Math.max(0.01, a), o, t);
    if (c.named[i] && a > 0.5) Z.nameTag(g, x, y - 330, c.named[i].name, 0.62);
  });
}

function drawScene(g, t, dur, c, mo) {
  const k = clamp(t / dur);
  g.fillStyle = '#000';
  g.fillRect(-10, -10, VW + 20, 1940);
  g.save();
  switch (c.kind) {
    case 'black':
      break;
    case 'title': {
      cam(g, 540, 960, lerp(1.0, 1.1, k), c.i === 0 ? 0.3 + 0.7 * clamp(1 - t) : 0, t);
      Z.apocalypse(g, t);
      for (let i = 0; i < 8; i++) {
        const d = 0.55 + (i % 4) * 0.17;
        const x = ((i * 290 + t * 70 * d) % 1700) - 300;
        Z.drawZombie(g, x, 1240 + d * 520 - (i % 4) * 30, 360 * d, { t, v: i, dir: 1 });
      }
      break;
    }
    case 'hut': {
      const kk = smooth(clamp((k - 0.1) / 0.9));
      cam(g, lerp(540, 450, kk), lerp(980, 1010, kk), lerp(0.82, 1.85, kk), 0, t);
      Z.forest(g, t, { mood: 0.4, skipMid: 540 });
      Z.hut(g, 540, 1260, 1, { t, peek: { dx: 0, dy: 0, mouth: mo, scared: 0 } });
      break;
    }
    case 'problem': {
      cam(g, 540, 1100, lerp(1.0, 1.08, k), 0.4, t);
      Z.interior(g, t);
      Z.drawHero(g, 540, 1900, 1150, { pose: 'scared', mouth: mo, t, scared: 1, look: -0.5 });
      break;
    }
    case 'horde': {
      const cx = lerp(250, 900, smooth(k));
      cam(g, cx, 880, 1.0, 0, t);
      Z.forest(g, t, { mood: 1, path: false, moonAt: [cx + 280, 300, 80] });
      P(g, '#6e5a44', 5, rr(-1500, 1330, 4100, 230, 0));
      for (let i = 0; i < 30; i++) P(g, '#5a4836', 0, ell(-800 + i * 95, 1400 + (i % 2) * 70, 16, 9));
      const n = Math.min(12, Math.max(3, c.zombies));
      for (let i = 0; i < n; i++) Z.drawZombie(g, -420 + i * (1650 / n) + t * 55 + (i % 2) * 30, 1520 - (i % 2) * 70, 360, { t, v: i, dir: 1, eyes: true });
      break;
    }
    case 'alone': {
      cam(g, 540, 820, 0.95, 0, t);
      Z.forest(g, t, { mood: 0.8, path: false, moonAt: [540, 300, 70] });
      Z.hut(g, 230, 1330, 0.55, { t });
      Z.drawHero(g, 330, 1520, 300, { pose: 'scared', mouth: mo, t, scared: 1, look: 1 });
      for (let i = 0; i < Math.min(12, Math.max(3, c.zombies)); i++) {
        const col = i % 4;
        const row = Math.floor(i / 4);
        Z.drawZombie(g, 690 + col * 105 + row * 50 - k * 60, 1450 + row * 95, 230 + row * 25, { t, v: i, dir: -1, eyes: true });
      }
      break;
    }
    case 'need': {
      cam(g, 540, 960, lerp(1.18, 1.0, easeOutBack(clamp((t / 0.45)))), 0, t);
      Z.burst(g, t);
      Z.drawHero(g, 540, 2280, 1650, { pose: 'point', mouth: mo, t });
      break;
    }
    case 'follower': {
      cam(g, 540, 1180, lerp(1.0, 0.95, k), 0, t);
      // Ohne Follower: Beispiel (Plätze füllen sich), sonst echte Anzahl
      const total = c.allies > 0 ? Math.min(10, c.allies) : 10;
      const kk = clamp((k - 0.1) / 0.8);
      slotsScene(g, t, Math.ceil(kk * total), kk * total * 0.33, c, mo);
      break;
    }
    case 'goal': {
      cam(g, 540, 1180, lerp(0.95, 0.9, k), 0, t);
      slotsScene(g, t, Math.min(10, c.allies), 99, c, mo);
      break;
    }
    case 'comment': {
      cam(g, 540, 960, 1, 0, t);
      Z.forest(g, t, { mood: 0.4 });
      g.fillStyle = 'rgba(10,8,30,0.35)';
      g.fillRect(-100, -100, 1300, 2200);
      Z.drawHero(g, 820, 2050, 700, { pose: 'up', mouth: mo, t });
      break;
    }
    case 'characters': {
      cam(g, lerp(500, 580, k), 1250, 1.25, 0, t);
      Z.forest(g, t, { mood: 0.4, skipMid: 540 });
      Z.hut(g, 540, 1260, 0.75, { t });
      Z.drawHero(g, 300, 1560, 330, { pose: 'talk', mouth: mo, t });
      const said = c.named.filter((a) => c.low.includes(a.name.toLowerCase()));
      const list = (said.length ? said : c.examples).slice(0, 4);
      list.forEach((o, i) => {
        const a = easeOutBack(clamp((k - 0.08 - i * 0.18) / 0.15));
        if (a <= 0) return;
        const x = 470 + i * (list.length > 3 ? 125 : 165);
        Z.drawSurv(g, x, 1560, 330 * a, o, t);
        Z.nameTag(g, x, 1560 - 375, o.name, 0.9 * a);
      });
      break;
    }
    case 'defend': {
      cam(g, 540, lerp(1250, 1100, smooth(k)), lerp(1.2, 0.85, smooth(k)), 0, t);
      Z.forest(g, t, { mood: 1, skipMid: 540, moonAt: [800, 280, 85] });
      glowingEyes(g, t);
      Z.hut(g, 540, 1260, 0.75, { t, barricade: k, lit: true });
      edgeZombies(g, t, k);
      team(g, t, c);
      Z.drawHero(g, 540, 1640, 300, { pose: 'bat', mouth: mo, t });
      break;
    }
    case 'fight': {
      cam(g, 540, 1150, lerp(1.0, 1.08, k), 0.25, t);
      Z.forest(g, t, { mood: 1, skipMid: 540, moonAt: [820, 260, 80] });
      Z.hut(g, 540, 1260, 0.75, { t, barricade: 1, lit: true });
      // Zombies kippen nacheinander um
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1;
        const x = side > 0 ? 70 + i * 30 : 1010 - i * 30;
        const fall = smooth(clamp((k - 0.15 - i * 0.12) / 0.15));
        g.save();
        g.translate(x, 1660 + (i % 3) * 30);
        g.rotate(side * -fall * 1.4);
        Z.drawZombie(g, 0, 0, 330, { t, v: i + 2, dir: side, eyes: true, walk: 1 - fall });
        g.restore();
        if (fall > 0 && fall < 1) pow(g, x, 1460, fall);
      }
      team(g, t, c);
      Z.drawHero(g, 540, 1640, 300, { pose: 'bat', mouth: mo, t });
      break;
    }
    case 'vote': {
      cam(g, 540, 1180, 0.95, 0, t);
      Z.forest(g, t, { mood: 0.4, skipMid: 540 });
      Z.hut(g, 540, 1260, 0.75, { t });
      Z.drawHero(g, 540, 1560, 360, { pose: 'up', mouth: mo, t });
      break;
    }
    case 'final': {
      cam(g, 540, 960, lerp(1.0, 1.12, k), 0, t);
      Z.forest(g, t, { mood: 1, path: false, moonAt: [540, 640, 260] });
      Z.drawHero(g, 540, 2250, 1500, { pose: 'bat', mouth: mo, t });
      for (const [hx, hd] of [[90, 0.15], [990, 0.3], [230, 0.45]]) {
        const up = smooth(clamp((k - hd) / 0.25));
        if (up <= 0) continue;
        g.save();
        g.translate(hx, 1950 - up * 230);
        P(g, ZSK, 6, rr(-26, 0, 52, 300, 20));
        for (let f = 0; f < 4; f++) P(g, ZSK, 6, rr(-26 + f * 14, -40 - (f % 2) * 10, 12, 50, 6));
        g.restore();
      }
      break;
    }
    default: {
      // Erzähler im Wald (abwechselnde Einstellungen)
      const alt = c.k % 2;
      cam(g, alt ? 600 : 480, 1150, lerp(1.25, 1.35, k), 0, t);
      Z.forest(g, t, { mood: 0.5, skipMid: 540 });
      Z.hut(g, alt ? 760 : 300, 1260, 0.7, { t });
      Z.drawHero(g, alt ? 470 : 610, 1640, 520, { pose: 'talk', mouth: mo, t });
    }
  }
  g.restore();
}
function glowingEyes(g, t) {
  for (let i = 0; i < 9; i++) {
    const ex = -300 + i * 200 + (i % 2) * 60;
    const ey = 1080 + (i % 3) * 40;
    const bl = Math.sin(t * 1.3 + i * 2) > 0.92 ? 0.2 : 1;
    P(g, '#ffef5a', 0, ell(ex, ey, 9, 7 * bl));
    P(g, '#ffef5a', 0, ell(ex + 26, ey, 9, 7 * bl));
  }
}
function edgeZombies(g, t, k) {
  Z.drawZombie(g, -220 + k * 120, 1620, 340, { t, v: 2, dir: 1, eyes: true });
  Z.drawZombie(g, -80 + k * 120, 1700, 360, { t, v: 5, dir: 1, eyes: true });
  Z.drawZombie(g, 1300 - k * 120, 1620, 340, { t, v: 7, dir: -1, eyes: true });
  Z.drawZombie(g, 1170 - k * 120, 1710, 360, { t, v: 3, dir: -1, eyes: true });
}
// Gruppe vor der Hütte: echte Verbündete mit Namen, Rest als "?"
function team(g, t, c) {
  const spots = [[330, 1480], [750, 1480], [220, 1560], [860, 1560], [420, 1600], [660, 1600]];
  spots.forEach(([x, y], i) => {
    const o = c.named[i] || (c.allies > i ? Z.EXTRA[i % Z.EXTRA.length] : { sil: true });
    Z.drawSurv(g, x, y, 260, o, t);
    if (c.named[i]) Z.nameTag(g, x, y - 300, c.named[i].name, 0.55);
  });
}
function pow(g, x, y, k) {
  const s = easeOutBack(clamp(k * 3)) * (1 - clamp((k - 0.7) / 0.3));
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.rotate(-0.15);
  const pts = [];
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 60 : 110;
    const a = (i / 16) * Math.PI * 2;
    pts.push([Math.cos(a) * r * 1.3, Math.sin(a) * r]);
  }
  P(g, YEL, 6, Z.poly(pts));
  label(g, 'POW!', 0, 4, 64, RED, { sw: 10 });
  g.restore();
}

// ------------------------------------------------------ Einblendungen ---
function overlays(g, t, dur, c) {
  const end = dur - 0.15;
  switch (c.kind) {
    case 'hut': {
      const a = popIn(t, 0.3, end);
      if (a > 0) {
        card(g, VW / 2, 400, 820, 130, DARK, a, -0.02);
        label(g, /bunker/.test(c.low) ? 'VERSTECK: BUNKER' : 'VERSTECK: HÜTTE IM WALD', 0, 2, 54, '#ffffff', { sw: 0 });
        g.restore();
      }
      if (/allein/.test(c.low)) {
        const b = popIn(t, 1.3, end);
        if (b > 0) {
          card(g, VW / 2, 560, 560, 110, '#fff', b, 0.02);
          label(g, `ÜBERLEBENDE: ${1 + c.allies}`, 0, 2, 52, DARK, { sw: 0 });
          g.restore();
        }
      }
      break;
    }
    case 'problem': {
      const a = popIn(t, 0.15, end);
      if (a > 0) {
        card(g, VW / 2, 420, 640, 160, RED, a, -0.03);
        label(g, 'PROBLEM!', 0, 4, 110, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'horde': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const n = Math.min(c.zombies, Math.max(1, Math.ceil(clamp(t / 1.4) * c.zombies)));
        card(g, VW / 2, 430, 760, 190, DARK, a, -0.02);
        Z.zombieIcon(g, -250, 4, 62);
        label(g, `${n} ZOMBIES`, 70, 4, n > 99 ? 80 : 100, '#7ddc4a', { sw: 0 });
        g.restore();
      }
      if (/morgen|heute nacht|bald/.test(c.low)) {
        const when = /heute nacht/.test(c.low) ? 'HEUTE NACHT!' : /bald/.test(c.low) ? 'BALD!' : 'MORGEN!';
        const b = popIn(t, Math.min(2.0, dur * 0.5), end);
        if (b > 0) {
          card(g, VW / 2, 620, 620, 110, RED, b, 0.02);
          label(g, `ANKUNFT: ${when}`, 0, 2, 54, '#fff', { sw: 0 });
          g.restore();
        }
      }
      break;
    }
    case 'alone': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 440, 560, 170, DARK, a, 0.02);
        label(g, String(1 + c.allies), -160, 4, 120, YEL, { sw: 0 });
        label(g, 'VS', 0, 4, 80, '#fff', { sw: 0 });
        label(g, String(c.zombies), 160, 4, 120, '#7ddc4a', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'need': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 400, 880, 170, DARK, a, -0.03);
        label(g, 'ICH BRAUCHE EUCH!', 0, 4, 92, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'follower': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 420, 960, 190, DARK, a, -0.02);
        label(g, '1 FOLLOWER =', 0, -40, 66, '#ffffff', { sw: 0 });
        label(g, '1 ÜBERLEBENDER', 0, 42, 78, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'goal': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 450, 900, 240, DARK, a, 0.02);
        label(g, `ZIEL: ${c.goal} VERBÜNDETE`, 0, -62, 64, '#ffffff', { sw: 0 });
        P(g, '#2c2b45', 5, rr(-380, 10, 760, 70, 35));
        const frac = clamp(c.allies / c.goal) * clamp(t / 0.8);
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        P(g, GREEN, 0, rr(-376, 14, Math.max(40 + pulse * 10, 752 * frac), 62, 31));
        label(g, `${Math.round(c.allies * clamp(t / 0.8))} / ${c.goal}`, 0, 46, 56, '#fff', { sw: 8 });
        g.restore();
      }
      break;
    }
    case 'comment': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 380, 920, 150, YEL, a, -0.02);
        if (/waffe/.test(c.low)) {
          label(g, 'NAME + WAFFE', 0, -26, 64, DARK, { sw: 0 });
          label(g, 'IN DIE KOMMENTARE!', 0, 36, 50, DARK, { sw: 0 });
        } else label(g, 'AB IN DIE KOMMENTARE!', 0, 4, 64, DARK, { sw: 0 });
        g.restore();
      }
      commentsPanel(g, t, c);
      break;
    }
    case 'characters': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 400, 900, 150, DARK, a, 0.02);
        label(g, /charakter|figur/.test(c.low) || !c.named.length ? 'DEIN EIGENER CHARAKTER!' : 'NEU IN DER GRUPPE!', 0, 4, 66, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'defend': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 420, 900, 170, RED, a, -0.02);
        label(g, 'VERTEIDIGT DIE HÜTTE!', 0, 4, 72, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'fight': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const kill = c.text.match(/(\d+)\s+zombies?\s+(?:erledigt|besiegt|ausgeschaltet|vernichtet|getötet)/i);
        card(g, VW / 2, 420, kill ? 900 : 700, 170, RED, a, -0.03);
        label(g, kill ? `${kill[1]} ZOMBIES ERLEDIGT!` : 'DER KAMPF!', 0, 4, kill ? 76 : 100, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'vote': {
      const v = c.vote || ['OPTION A', 'OPTION B'];
      [0, 1].forEach((j) => {
        const a = popIn(t, 0.2 + j * 0.5, end);
        if (a <= 0) return;
        card(g, VW / 2, 360 + j * 190, 940, 160, j ? '#3a86ff' : YEL, a, j ? 0.02 : -0.02);
        P(g, '#fff', 6, ell(-370, 0, 56, 56));
        label(g, j ? 'B' : 'A', -370, 4, 80, DARK, { sw: 0 });
        g.font = '60px "Lilita One", sans-serif';
        const s = Math.min(1, 700 / g.measureText(v[j]).width);
        label(g, v[j], 60, 4, 60 * s, j ? '#fff' : DARK, { sw: 0 });
        g.restore();
      });
      const b = popIn(t, 1.4, end);
      if (b > 0) {
        card(g, VW / 2, 760, 760, 110, DARK, b, 0);
        label(g, 'KOMMENTIERE A ODER B!', 0, 2, 54, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'final': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 420, 860, 170, DARK, a, 0.02);
        label(g, /morgen/.test(c.low) && /kampf/.test(c.low) ? 'MORGEN: DER KAMPF!' : /morgen/.test(c.low) ? 'BIS MORGEN!' : 'FOLGE & ÜBERLEBE!', 0, 4, 76, '#7ddc4a', { sw: 0 });
        g.restore();
      }
      endCard(g, t, dur, c);
      break;
    }
    default:
  }
}
const EXAMPLE_COMMENTS = [
  ['Lena', 'Bin dabei! Lena – Baseballschläger', '#3a86ff', '312'],
  ['Max', 'Max hier, ich nehm die Bratpfanne!!', '#43aa8b', '208'],
  ['Tobi', 'Tobi – Armbrust. Lass kämpfen', '#9b5de5', '154'],
];
function commentsPanel(g, t, c) {
  const k = smooth(clamp((t - 0.2) / 0.4));
  if (k <= 0) return;
  const list = c.named.length
    ? c.named.slice(0, 3).map((a, i) => {
        const nm = a.name.charAt(0) + a.name.slice(1).toLowerCase();
        return [nm, a.weaponText ? `${nm} – ${a.weaponText}` : `${nm} ist dabei!`, a.shirt, String(300 - i * 70)];
      })
    : EXAMPLE_COMMENTS;
  g.save();
  g.translate(0, (1 - k) * 700);
  P(g, '#000', 0, rr(50, 620, 980, 580, 34));
  P(g, '#ffffff', 6, rr(50, 610, 980, 580, 34));
  label(g, 'Kommentare', VW / 2, 668, 40, DARK, { sw: 0 });
  line(g, [[90, 712], [990, 712]], 3, '#e3e3ea');
  list.forEach(([n, txt, col, likes], i) => {
    const a = easeOutBack(clamp((t - 0.7 - i * 0.9) / 0.3));
    if (a <= 0) return;
    const y = 790 + i * 140;
    g.save();
    g.translate(110, y);
    g.scale(a, a);
    P(g, col, 4, ell(0, 0, 40, 40));
    label(g, n[0].toUpperCase(), 0, 2, 44, '#fff', { sw: 0 });
    g.restore();
    g.save();
    g.globalAlpha = clamp(a);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = '30px "Lilita One", sans-serif';
    g.fillStyle = '#8a8a99';
    g.fillText(n, 175, y - 26);
    g.font = '38px "Lilita One", sans-serif';
    g.fillStyle = DARK;
    const w = g.measureText(txt).width;
    if (w > 740) g.font = `${Math.floor((38 * 740) / w)}px "Lilita One", sans-serif`;
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
// Endkarte (die letzten Sekunden des letzten Satzes)
function endCard(g, t, dur, c) {
  const k = clamp((t - Math.max(dur * 0.6, dur - 2.4)) / 0.5);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = smooth(k) * 0.88;
  g.fillStyle = '#0d0b1e';
  g.fillRect(0, 0, VW, 1920);
  g.restore();
  const s = easeOutBack(k);
  g.save();
  g.translate(VW / 2, 0);
  g.scale(s, s);
  label(g, 'DIE ZOMBIE-', 0, 300, 96, '#ffffff', { sw: 14 });
  label(g, 'APOKALYPSE', 0, 405, 110, '#7ddc4a', { sw: 16 });
  const rows = [
    ['KOMMENTIERE: NAME + WAFFE', YEL],
    [`VERBÜNDETE: ${c.allies} / ${c.goal}`, '#7ddc4a'],
    [`ZOMBIES: ${c.zombies}`, '#ff6b6b'],
  ];
  rows.forEach(([x, col], i) => {
    P(g, '#000', 0, rr(-420, 520 + i * 135 + 10, 840, 108, 24));
    P(g, '#22203d', 6, rr(-420, 520 + i * 135, 840, 108, 24));
    label(g, x, 0, 575 + i * 135, 52, col, { sw: 0 });
  });
  label(g, 'JEDER FOLLOWER =', 0, 990, 62, '#ffffff', { sw: 10 });
  label(g, 'EIN ÜBERLEBENDER', 0, 1070, 74, YEL, { sw: 12 });
  const pk = 1 + 0.04 * Math.sin(t * 8);
  g.save();
  g.translate(0, 1580);
  g.scale(pk, pk);
  P(g, '#000', 0, rr(-360, -50, 720, 120, 60));
  P(g, '#fe2c55', 6, rr(-360, -60, 720, 120, 60));
  label(g, '+ FOLGEN & ÜBERLEBEN', 0, 1, 52, '#ffffff', { sw: 0 });
  g.restore();
  g.restore();
}

// Titel (erste Sekunden groß, danach kleine Anzeigen oben)
export function drawZombieTitle(g, W, t, title, hud, dayOf = null) {
  const m = String(title || '').match(/tag\s*(\d+)/i);
  const tag = m ? `TAG ${m[1]}` : `TAG ${hud?.day || dayOf || 1}`;
  g.save();
  g.scale(W / VW, W / VW);
  if (t < 3.4) {
    const a = popIn(t, 0.35, 3.3, 0.35);
    if (a > 0) {
      g.save();
      g.translate(VW / 2, 330);
      g.scale(a, a);
      g.rotate(-0.04);
      label(g, tag, 0, 0, 190, YEL, { sw: 26 });
      g.restore();
      card(g, VW / 2, 560, 940, 210, DARK, a, 0.02);
      label(g, 'DIE ZOMBIE-', 0, -46, 84, '#ffffff', { sw: 0 });
      label(g, 'APOKALYPSE', 0, 46, 96, '#7ddc4a', { sw: 0 });
      g.restore();
    }
  } else if (hud) {
    chip(g, 36, 150, 220, DARK, tag, YEL, 44);
    chip(g, VW - 336, 150, 300, RED, `ZOMBIES: ${hud.zombies}`);
    chip(g, VW - 336, 230, 300, GREEN, `VERBÜNDETE: ${hud.allies}/${hud.goal}`, '#fff', 34);
  }
  g.restore();
}

// ------------------------------------------------------- Geräusche ---
function sfxFor(c) {
  const out = [];
  const add = (at, type) => out.push({ at, type });
  switch (c.kind) {
    case 'title':
      add(0.2, 'boom');
      add(1.0, 'groan');
      break;
    case 'hut':
      add(0.1, 'whoosh');
      add(0.3, 'crickets');
      break;
    case 'problem':
      add(0.05, 'boom');
      break;
    case 'horde':
      add(0.05, 'whoosh');
      for (let i = 0; i < 3; i++) add(0.3 + i * 0.9, 'groan');
      break;
    case 'alone':
      add(0.3, 'groan');
      break;
    case 'need':
      add(0.02, 'whoosh');
      add(0.1, 'ding');
      break;
    case 'follower':
      for (let i = 0; i < 6; i++) add(0.5 + i * 0.45, 'pop');
      break;
    case 'goal':
      add(0.1, 'whoosh');
      add(0.8, 'ding');
      break;
    case 'comment':
      add(0.1, 'whoosh');
      for (let i = 0; i < 3; i++) add(0.7 + i * 0.9, 'pop');
      break;
    case 'characters':
      for (let i = 0; i < 3; i++) add(0.4 + i * 0.6, 'pop');
      break;
    case 'defend':
      add(0.2, 'hammer');
      add(1.2, 'groan');
      break;
    case 'fight':
      for (let i = 0; i < 4; i++) add(0.6 + i * 0.5, 'kick');
      add(0.3, 'groan');
      break;
    case 'vote':
      add(0.2, 'ding');
      add(0.7, 'ding');
      break;
    case 'final':
      add(0.1, 'whoosh');
      add(1.0, 'groan');
      break;
    default:
  }
  return out;
}
