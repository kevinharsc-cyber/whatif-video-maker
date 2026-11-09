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
  if (OPTION_RE.test(String(text || ''))) return 'option';
  if (/willkommen in|hat (jetzt |endlich )?einen namen|heißt (jetzt|ab jetzt)/.test(low)) return 'welcome';
  if (TOPC_RE.test(String(text || ''))) return 'topcomment';
  if (/graben/.test(low) && /pfähl|pfahl|stachel|spieß|spitze/.test(low)) return 'spikes';
  if (/graben/.test(low) && /fällt|fallen|reinfällt/.test(low)) return 'spikes';
  if (/aussichtsturm|wachturm|turm/.test(low) && !OPTION_RE.test(String(text || ''))) return 'tower';
  if (/sniper|scharfschütz|von weitem|zielfernrohr/.test(low)) return 'tower';
  if (/\bgraben\b/.test(low) && /bau|grab|heb|zaun|rund um|um den|um unser/.test(low) && !/kommentar/.test(low)) return 'moat';
  if (/abstimmung|hat gewonnen|habt (euch )?entschieden|haben sich für|die meisten von euch/.test(low) && !/kommentar/.test(low)) return 'result';
  if (/^danke|danke an|vielen dank/.test(low)) return 'thanks';
  if (/keine angst|so viele wie nie|wir sind bereit|gemeinsam schaffen wir/.test(low) && !/kommentar/.test(low) && !/\b\d+\s+(überlebende|follower|verbündete|leute)\b/.test(low)) return 'ready';
  if (/nacht bricht|bricht die nacht|sonne geht unter|es wird dunkel|dämmerung|neigt sich dem ende|der abend/.test(low) && !/zombie/.test(low) && !/\b\d+\s+(überlebende|follower|verbündete|leute)\b/.test(low)) return 'evening';
  if (/schaut euch an|seht euch an|von oben|überblick/.test(low) && !/zombie/.test(low)) return 'base';
  if (/lager|basis|base|camp/.test(low) && (/erweiter|vergrößer|größer|ausgebaut|geschützt|schützt|schaut euch an|seht euch an|überblick/.test(low) || (/zaun/.test(low) && /bau|steht|errichte|rund um|um das|um die|um unser/.test(low)))) return 'base';
  if (/kommentar|schreib/.test(low)) return 'comment';
  if (/charakter|eigene figur|teil unserer geschichte|neu (in|bei) (unserer|der) gruppe|neu dabei|sind neu|ist neu/.test(low)) return 'characters';
  if (/erfolgreich|geschafft|gewonnen|abgewehrt|zurückgeschlagen/.test(low) && /verteidig|wehr|zombie|angriff|kampf/.test(low)) return 'fight';
  if (/verteidig|barrikad|vernagel|bretter/.test(low)) return 'defend';
  if (i > 0 && /kämpf|angriff|greifen an|attack|besieg|erledigt|ausgeschaltet|vernichtet|schlacht/.test(low)) return 'fight';
  if (/\b\d+\s+(überlebende|follower|verbündete|leute)\b/.test(low) && !/mindestens|brauchen|fehlen|ziel/.test(low)) return 'crowd';
  if (/follower|follow\b|folgt|folge mir|mitglied|beitreten|überlebensgruppe|neue überlebende/.test(low)) return 'follower';
  if (/mindestens|verbündete|ziel|brauchen? \d+/.test(low)) return 'goal';
  if (/brauche (ich )?euch|eure hilfe|helft mir|brauche (ich )?dich|brauchen euch/.test(low)) return 'need';
  if (/überlebt|die sonne|es ist tag|guten morgen|nacht ist vorbei|endlich tag/.test(low) && !/zombies? (kommen|sind|greifen)/.test(low)) return 'morning';
  if (/problem|gefahr|angst|oh nein|hilfe!|nicht mehr viel zeit|keine zeit|die zeit läuft|reicht (noch )?nicht/.test(low) && !/zombie/.test(low)) return 'problem';
  if (/zombie/.test(low) && /spur|kommen|unterwegs|eintreffen|horde|näher|anrück|\d+ zombies|zombies haben/.test(low)) return 'horde';
  if (/große horde|die horde kommt|kommt die (große )?horde|fast da|gleich da|gleich hier|im anmarsch|auf dem weg hierher|in \d+ tagen|an tag \d+|erreichen unser|gesichtet/.test(low)) return 'horde';
  if (/hütte|versteck|wald|unterschlupf|bunker|lager|camp|basis/.test(low)) return 'hut';
  if (/allein|keine chance/.test(low)) return 'alone';
  if (i === 0 || /apokalypse|ausgebrochen|begonnen/.test(low)) return 'title';
  if (/zombie/.test(low)) return 'horde';
  return 'talk';
}

const low0 = (s) => String(s || '').toLowerCase();
// "Der Top-Kommentar von Soldier 1 hat entschieden: Ein Graben vor dem Zaun!"
const TOPC_RE = /top-?kommentar von ([^:–—]+?)(?:\s+(?:hat entschieden|sagt|meint|schreibt|hat geschrieben))?\s*[:–—]\s*(.+)$/i;
// "… haben sich für den Drahtzaun entschieden" → { build, name }
function resultOf(text) {
  const low = low0(text);
  const build = /draht|stachel/.test(low) ? 'wire' : /mauer|stein/.test(low) ? 'wall' : /zaun|palisade/.test(low) ? 'fence' : /turm/.test(low) ? 'tower' : /speer/.test(low) ? 'spears' : null;
  const name = { wire: 'DRAHTZAUN', wall: 'STEINMAUER', fence: 'HOLZZAUN', tower: 'WACHTURM', spears: 'SPEERE' }[build] || null;
  return { build, name };
}
// "Option A: Wir bauen einen Zaun" / "B) …" / "Option 2: …"
const OPTION_RE = /^\s*(?:option\s*)?([abc123])\s*[:)]\s*(.+)$/i;
function parseOption(text) {
  const m = String(text || '').match(OPTION_RE);
  if (!m) return null;
  const letter = { 1: 'A', 2: 'B', 3: 'C' }[m[1]] || m[1].toUpperCase();
  const low = m[2].toLowerCase();
  const build = /speer|lanze/.test(low) ? 'spears' : /draht|stachel/.test(low) ? 'wire' : /mauer|steinwand|stein/.test(low) ? 'wall' : /zaun|palisade/.test(low) ? 'fence' : /turm/.test(low) ? 'tower' : null;
  const short = build ? { spears: 'SPEERE SCHNITZEN', fence: 'HOLZZAUN', wire: 'DRAHTZAUN', wall: 'STEINMAUER', tower: 'WACHTURM BAUEN' }[build] : m[2].replace(/^(wir|ein|eine|einen)\s+/i, '').replace(/[.!?]+$/, '').toUpperCase().slice(0, 30);
  return { letter, short, build };
}

// "Lena: Baseballschläger, Max – Bratpfanne" → [{name, weapon}]
export function parseAllies(text) {
  return String(text || '')
    .split(/[,;\n]+/)
    .map((p) => p.trim().replace(/^@/, ''))
    .filter(Boolean)
    .map((p) => {
      if (p.includes(':')) {
        const [n, ...w] = p.split(':');
        return { name: n.trim(), weapon: w.join(':').trim() };
      }
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
  const allies = Math.max(followers, named.length);
  let goal = goalText ?? Math.max(1, Math.floor(Number(opts.goal) || 11));
  // Ziel schon erreicht und nicht im Skript genannt → nächstes rundes Ziel
  if (!goalText && allies >= goal) goal = Math.ceil((allies + 1) / 50) * 50;
  const examples = named.length ? named : Z.SURV;
  const options = scenes.map((s) => parseOption(s.text)).filter(Boolean);
  const all = scenes.map((s) => String(s.text || '').toLowerCase()).join(' ');
  const welcomeM = scenes.map((s) => String(s.text || '').match(/[Ww]illkommen in ([A-ZÄÖÜ0-9][\wÄÖÜäöüß-]*(?:\s+[A-ZÄÖÜ0-9][\wÄÖÜäöüß-]*)*)/)).find(Boolean);
  const defendVote = scenes.some((s) => /verteidig/i.test(s.text || '') && /top-?kommentar|kommentar|entscheidet/i.test(s.text || ''));
  const campName = welcomeM ? welcomeM[1].toUpperCase() : String(opts.camp || '').trim().toUpperCase() || null;
  const hasWelcome = !!welcomeM;
  const allLow = scenes.map((s) => low0(s.text)).join(' ');
  const duskAll = /neigt sich dem ende|zum abend|am abend hin|gegen abend|nacht bricht|sonne geht unter/.test(allLow);
  const towerAt = scenes.findIndex((s, j) => pickZombieShot(s.text, j, scenes.length) === 'tower');
  const spikesAt = scenes.findIndex((s, j) => pickZombieShot(s.text, j, scenes.length) === 'spikes');
  const moatAt = scenes.findIndex((s, j) => pickZombieShot(s.text, j, scenes.length) === 'moat');
  const firstOpt = scenes.findIndex((s) => parseOption(s.text));
  const eveningAt = scenes.findIndex((s, j) => pickZombieShot(s.text, j, scenes.length) === 'evening');
  const hasEvening = eveningAt >= 0;
  const hasMorning = scenes.some((s, j) => pickZombieShot(s.text, j, scenes.length) === 'morning');
  const nameVote = /(lager|camp|basis|gruppe)[^.!?]*(name|heißen|nennen|taufen)|(name|heißen|nennen|taufen)[^.!?]*(lager|camp|basis|gruppe)/.test(all);
  const seen = {};
  const hud = { zombies, allies, goal, day };
  return scenes.map((sc, i) => {
    const text = sc.text || '';
    let kind = sc.black ? 'black' : pickZombieShot(text, i, scenes.length);
    // Genau ein Verbündeter wird beim Namen genannt → eigene Szene für ihn
    const mentioned = named.filter((a) => new RegExp(`(?<![\\p{L}])${a.name.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(text));
    if (mentioned.length >= 2 && ['talk', 'hut', 'follower'].includes(kind)) kind = 'characters';
    const ally = mentioned.length === 1 && !['final', 'vote', 'option', 'comment', 'crowd', 'topcomment', 'moat', 'welcome', 'black', 'tower', 'spikes'].includes(kind) ? mentioned[0] : null;
    if (ally) kind = 'ally';
    const k = (seen[kind] = (seen[kind] || 0) + 1) - 1;
    const c = { kind, k, text, low: text.toLowerCase(), i, n: scenes.length, last: i === scenes.length - 1, named, examples, allies, goal, zombies, vote: kind === 'vote' ? parseVote(text) : null, hud, ally, mentioned, crowdN: kind === 'crowd' ? Number(low0(text).match(/\b(\d+)\s+(überlebende|follower|verbündete|leute)/)[1]) : kind === 'base' ? allies : 0, result: kind === 'result' ? resultOf(text) : null, option: kind === 'option' ? parseOption(text) : null, options, nameVote, day: hasMorning || (hasWelcome && !duskAll), duskAll, moat: (moatAt >= 0 ? i >= moatAt : /graben/.test(allLow)) ? 'done' : null, tower: towerAt >= 0 && i >= towerAt ? (i === towerAt ? 'build' : 'done') : null, spikes: spikesAt >= 0 && i >= spikesAt ? (i === spikesAt ? 'build' : 'done') : null, snipers: named.filter((a) => a.weapon === 'sniper'), hasVote: scenes.some((s, j) => pickZombieShot(s.text, j, scenes.length) === 'vote'), topc: kind === 'topcomment' ? text.match(TOPC_RE) : null, optionsAreNames: options.length >= 2 && options.every((o) => !o.build), dusk: hasEvening && i > eveningAt, evening: hasEvening && i <= eveningAt, afterOptions: firstOpt >= 0 && i > firstOpt, campName, defendVote };
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
  forestFor(g, t, c, { mood: 0.35, skipMid: 540 });
  Z.hut(g, 540, 1260, 0.75, { t });
  SLOTS.forEach(([x, y], i) => {
    if (i === 6) Z.drawHero(g, 540, 1470, 330, { pose: 'talk', mouth, t });
    const on = filled > i;
    if (!on) return Z.drawSurv(g, x, y, 290, { sil: true }, t);
    const a = easeOutBack(clamp((popT - i * 0.33) / 0.3));
    const o = c.named[i] || Z.EXTRA[i % Z.EXTRA.length];
    Z.drawSurv(g, x, y, 290 * Math.max(0.01, a), o, t);
    if (c.named[i] && a > 0.5) Z.nameTag(g, x, y - 335 - (i % 2) * 58, c.named[i].name, 0.9);
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
      forestFor(g, t, c, { mood: 0.4, skipMid: 540 });
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
      forestFor(g, t, c, { mood: 1, path: false, moonAt: [cx + 280, 300, 80] });
      P(g, '#6e5a44', 5, rr(-1500, 1330, 4100, 230, 0));
      for (let i = 0; i < 30; i++) P(g, '#5a4836', 0, ell(-800 + i * 95, 1400 + (i % 2) * 70, 16, 9));
      if (c.zombies > 12) {
        // große Horde: viele kleine Zombies dahinter (als fertige Reihen-Bilder)
        const hz = hordeFor(c, g);
        g.save();
        for (const r of hz) g.drawImage(r.canvas, -600 + t * 40, r.y - r.top, 2400, r.hgt);
        g.restore();
      }
      const n = Math.min(12, Math.max(3, c.zombies));
      const big = c.zombies > 12;
      for (let i = 0; i < n; i++) Z.drawZombie(g, -420 + i * (1650 / n) + t * 55 + (i % 2) * 30, (big ? 1610 : 1520) - (i % 2) * 70, big ? 300 : 360, { t, v: i, dir: 1, eyes: true });
      break;
    }
    case 'alone': {
      cam(g, 540, 820, 0.95, 0, t);
      forestFor(g, t, c, { mood: 0.8, path: false, moonAt: [540, 300, 70] });
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
    case 'result': {
      cam(g, 540, 1180, lerp(0.98, 1.04, k), 0, t);
      forestFor(g, t, c, { skipMid: 540, mood: 0.3 });
      Z.hut(g, 540, 1260, 0.75, { t, barricade: 1, lit: !c.day });
      const grow = smooth(clamp((t - 0.6) / 1.4));
      const b = c.result?.build;
      if (b === 'wire') drawWire(g, grow);
      else if (b === 'wall') drawWall(g, grow);
      else if (b === 'fence') drawFence(g, grow);
      else if (b === 'tower') drawTower(g, 900, 1330, grow);
      Z.drawHero(g, 540, 1680, 400, { pose: 'cheer', mouth: mo, t });
      break;
    }
    case 'welcome': {
      // Base von weiter weg und leicht von oben, Schild an Ketten fällt herein
      // Vogelperspektive (schräg von oben): Kamera fährt langsam aufs Tor zu
      const kk = smooth(clamp((t - 0.8) / Math.max(1, dur - 1)));
      cam(g, 540, lerp(1040, 1250, kk), lerp(0.95, 1.2, kk), 0, t);
      drawAerial(g, t, c, { sign: c.campName || 'UNSER LAGER', signK: clamp((t - 0.4) / 0.6) });
      break;
    }
    case 'topcomment': {
      cam(g, 540, 1000, lerp(1.0, 1.05, k), 0, t);
      drawAerial(g, t, c, { sign: c.campName });
      break;
    }
    case 'tower': {
      // Aussichtsturm: beim Bau aus der Vogelperspektive, sonst Nahaufnahme oben
      if (c.tower === 'build') {
        cam(g, 640, lerp(1000, 900, smooth(k)), lerp(0.95, 1.15, smooth(k)), 0, t);
        drawAerial(g, t, c, { sign: c.campName, towerK: smooth(clamp((t - 0.3) / 1.6)) });
      } else {
        const [tx, ty] = aproj(TOWER[0], TOWER[1]);
        if (c.k % 2) cam(g, tx - 60, ty - 330, lerp(1.5, 1.35, k), 0, t);
        else cam(g, tx, ty - 430, lerp(1.9, 2.1, k), 0, t);
        drawAerial(g, t, c, { sign: c.campName });
      }
      break;
    }
    case 'spikes': {
      cam(g, 540, lerp(1000, 1060, smooth(k)), lerp(0.95, 0.85, smooth(k)), 0, t);
      drawAerial(g, t, c, { sign: c.campName, spikesK: c.spikes === 'build' ? smooth(clamp((t - 0.3) / Math.max(1.2, dur - 0.8))) : 1 });
      break;
    }
    case 'moat': {
      // Graben wird rund um den Zaun ausgehoben
      cam(g, 540, lerp(1000, 1060, smooth(k)), lerp(0.92, 0.8, smooth(k)), 0, t);
      drawAerial(g, t, c, { sign: c.campName, moatK: smooth(clamp((t - 0.3) / Math.max(1.2, dur - 0.8))) });
      break;
    }
    case 'thanks':
    case 'ready': {
      cam(g, 540, 1000, lerp(1.0, 1.06, k), 0, t);
      drawAerial(g, t, c, { sign: c.campName, cheer: true });
      break;
    }
    case 'base':
    case 'evening': {
      // größeres Lager: Hütte, Zelte, Drahtzaun rundherum, alle Überlebenden drinnen
      const alt = c.k % 2;
      const wide = /schaut euch an|seht euch an|überblick|von oben/.test(c.low);
      if (wide) {
        // Überblick aus der Vogelperspektive, Kamera fährt langsam zurück
        cam(g, 540, lerp(980, 940, smooth(k)), lerp(1.12, 0.96, smooth(k)), 0, t);
        drawAerial(g, t, c, { sign: c.campName });
        break;
      }
      cam(g, 540, alt ? 1300 : 1260, alt ? lerp(1.0, 0.94, k) : lerp(0.9, 0.97, k), 0, t);
      const fk = c.kind === 'base' && /zaun/.test(c.low) && !/geschützt|schützt|schaut|seht/.test(c.low) ? smooth(clamp((t - 0.4) / 1.6)) : 1;
      drawBase(g, t, c, mo, { fk, dusk: c.kind === 'evening' });
      break;
    }
    case 'goal': {
      cam(g, 540, 1180, lerp(0.95, 0.9, k), 0, t);
      slotsScene(g, t, Math.min(10, c.allies), 99, c, mo);
      break;
    }
    case 'comment': {
      cam(g, 540, 960, 1, 0, t);
      forestFor(g, t, c, { mood: 0.4 });
      g.fillStyle = 'rgba(10,8,30,0.35)';
      g.fillRect(-100, -100, 1300, 2200);
      Z.drawHero(g, 820, 2050, 700, { pose: 'up', mouth: mo, t });
      break;
    }
    case 'ally': {
      // Verbündeter kommt aus dem Wald zur Hütte
      cam(g, 560, 1250, lerp(1.12, 1.2, k), 0, t);
      forestFor(g, t, c, { mood: 0.5, skipMid: 540 });
      Z.hut(g, 780, 1260, 0.7, { t });
      const walk = smooth(clamp(k / 0.35));
      const ax = lerp(-120, 400, walk);
      const ay = 1660 - (walk < 1 ? Math.abs(Math.sin(t * 9)) * 12 : 0);
      Z.drawSurv(g, ax, ay, 520, c.ally, t);
      if (walk > 0.6) Z.nameTag(g, ax, ay - 580, c.ally.name, 1.25 * easeOutBack(clamp((walk - 0.6) / 0.4)));
      Z.drawHero(g, 780, 1680, 480, { pose: 'talk', mouth: mo, t, look: -1 });
      break;
    }
    case 'characters': {
      cam(g, lerp(500, 580, k), 1250, 1.25, 0, t);
      forestFor(g, t, c, { mood: 0.4, skipMid: 540 });
      Z.hut(g, 540, 1260, 0.75, { t });
      Z.drawHero(g, 300, 1560, 330, { pose: 'talk', mouth: mo, t });
      const said = c.mentioned;
      const list = (said.length ? said : c.examples).slice(0, 4);
      list.forEach((o, i) => {
        const a = easeOutBack(clamp((k - 0.08 - i * 0.18) / 0.15));
        if (a <= 0) return;
        const x = 470 + i * (list.length > 3 ? 125 : 165);
        Z.drawSurv(g, x, 1560, 330 * a, o, t);
        Z.nameTag(g, x, 1560 - 375 - (i % 2) * 60, o.name, 0.9 * a * Math.min(1, 7 / o.name.length));
      });
      break;
    }
    case 'defend': {
      cam(g, 540, lerp(1250, 1100, smooth(k)), lerp(1.2, 0.85, smooth(k)), 0, t);
      forestFor(g, t, c, { mood: 1, skipMid: 540, moonAt: [800, 280, 85] });
      glowingEyes(g, t);
      Z.hut(g, 540, 1260, 0.75, { t, barricade: k, lit: true });
      edgeZombies(g, t, k);
      team(g, t, c);
      Z.drawHero(g, 540, 1640, 300, { pose: 'bat', mouth: mo, t });
      break;
    }
    case 'fight': {
      cam(g, 540, 1150, lerp(1.0, 1.08, k), 0.25, t);
      forestFor(g, t, c, { mood: 1, skipMid: 540, moonAt: [820, 260, 80] });
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
    case 'crowd': {
      // so viele Leute neben dem Helden, wie es Überlebende gibt
      cam(g, 540, 1300, lerp(1.06, 0.98, smooth(k)), 0, t);
      forestFor(g, t, c, { skipMid: 540, mood: 0.4 });
      Z.hut(g, 540, 1240, 0.62, { t, barricade: 1, lit: !c.day });
      // Menge als fertige Reihen-Bilder (schnell genug fürs iPhone, auch bei 100 Leuten)
      const crowd = crowdFor(c, g);
      let heroDone = false;
      crowd.rows.forEach((r) => {
        if (!heroDone && r.y > 1700) {
          Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
          heroDone = true;
        }
        const a = easeOutBack(clamp((t - 0.3 - r.reveal * 0.2) / 0.35));
        if (a <= 0) return;
        g.save();
        g.translate(0, r.y);
        g.scale(1, a);
        g.drawImage(r.canvas, 0, -r.top, VW, r.hgt);
        g.restore();
      });
      if (!heroDone) Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
      heroDone = true;
      // Namensschilder der genannten Verbündeten (vorne)
      crowd.tags.forEach(([x, y, h, name], i) => {
        const a = clamp((t - 0.5 - i * 0.12) / 0.3);
        if (a > 0) Z.nameTag(g, x, y - h * 1.12, name, 0.62 * easeOutBack(a));
      });
      if (!heroDone) Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
      break;
    }
    case 'morning': {
      cam(g, 540, 1180, lerp(1.0, 1.08, k), 0, t);
      forestFor(g, t, c, { day: true, skipMid: 540, moonAt: [830, 330] });
      Z.hut(g, 540, 1260, 0.85, { t, lit: false, barricade: 1 });
      const jump = Math.abs(Math.sin(t * 5)) * 30;
      Z.drawHero(g, 540, 1760 - jump, 470, { pose: 'cheer', mouth: mo, t });
      break;
    }
    case 'option': {
      const b = c.option?.build;
      if (!b && c.optionsAreNames) {
        cam(g, 540, 1280, lerp(0.95, 1.0, k), 0, t);
        drawBase(g, t, c, mo, { dusk: c.dusk, sign: { text: c.option.short, k: easeOutBack(clamp((t - 0.3) / 0.45)) } });
        break;
      }
      cam(g, b === 'tower' ? 620 : 540, 1150, lerp(0.92, 0.98, k), 0, t);
      forestFor(g, t, c, { mood: 0.2, skipMid: 540 });
      const grow = easeOutBack(clamp((t - 0.3) / 0.5));
      if (b === 'tower') drawTower(g, 900, 1330, grow);
      Z.hut(g, 540, 1260, 0.75, { t, barricade: 1 });
      if (b === 'spears') drawSpears(g, 300, 1290, grow);
      if (b === 'fence') drawFence(g, grow);
      if (b === 'wire') drawWire(g, grow);
      if (b === 'wall') drawWall(g, grow);
      Z.drawHero(g, ['fence', 'wire', 'wall'].includes(b) ? 540 : 470, 1640, 380, { pose: 'up', mouth: mo, t });
      break;
    }
    case 'vote': {
      cam(g, 540, 1180, 0.95, 0, t);
      forestFor(g, t, c, { mood: 0.4, skipMid: 540 });
      Z.hut(g, 540, 1260, 0.75, { t });
      Z.drawHero(g, 540, 1560, 360, { pose: 'up', mouth: mo, t });
      break;
    }
    case 'final': {
      cam(g, 540, 960, lerp(1.0, 1.12, k), 0, t);
      forestFor(g, t, c, { mood: 1, path: false, moonAt: [540, 640, 260] });
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
      forestFor(g, t, c, { mood: 0.5, skipMid: 540 });
      Z.hut(g, alt ? 760 : 300, 1260, 0.7, { t });
      Z.drawHero(g, alt ? 470 : 610, 1640, 520, { pose: 'talk', mouth: mo, t });
    }
  }
  g.restore();
}
// Menge: Reihen von vorne (groß) nach hinten (klein); vorne bleibt die Mitte für den Helden frei
const CROWD_ROWS = [
  { y: 1790, h: 300, sp: 150, gap: 150 },
  { y: 1660, h: 255, sp: 118, gap: 135 },
  { y: 1545, h: 220, sp: 98, gap: 0 },
  { y: 1445, h: 188, sp: 84, gap: 0 },
  { y: 1362, h: 160, sp: 72, gap: 0 },
  { y: 1294, h: 138, sp: 62, gap: 0 },
  { y: 1238, h: 120, sp: 54, gap: 0 },
  { y: 1190, h: 104, sp: 47, gap: 0 },
  { y: 1150, h: 90, sp: 41, gap: 0 },
  { y: 1116, h: 78, sp: 36, gap: 0 },
  { y: 1086, h: 68, sp: 32, gap: 0 },
];
const FILLER_WEAPONS = ['Schläger', 'Pfanne', 'Axt', 'Schaufel', 'Machete', 'Armbrust', 'Messer', 'Flinte', ''];
export function crowdLayout(n) {
  const rows = [];
  let left = n;
  CROWD_ROWS.forEach((r, ri) => {
    if (left <= 0) return;
    const xs = [];
    const off = ri % 2 ? r.sp / 2 : 0;
    for (let x = 30 + off; x <= 1050; x += r.sp) if (!r.gap || Math.abs(x - 540) > r.gap) xs.push(x);
    // von der Mitte nach außen auffüllen
    xs.sort((a, b) => Math.abs(a - 540) - Math.abs(b - 540));
    const take = xs.slice(0, left);
    left -= take.length;
    rows.push({ ...r, xs: take.sort((a, b) => a - b), reveal: ri });
  });
  return rows;
}
const CROWD_CACHE = new WeakMap();
function crowdFor(c, g) {
  const m = g.getTransform();
  const scale = Math.min(2, Math.max(0.5, Math.round(Math.hypot(m.a, m.b) * 1.1 * 4) / 4));
  const hit = CROWD_CACHE.get(c);
  if (hit && hit.scale === scale) return hit;
  const n = Math.min(170, c.crowdN || c.allies);
  const rows = crowdLayout(n);
  const tags = [];
  let idx = 0;
  const built = rows.map((r) => {
    const hgt = r.h * 1.35;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(VW * scale);
    cv.height = Math.ceil(hgt * scale);
    const q = cv.getContext('2d');
    q.scale(scale, scale);
    q.translate(0, hgt - 6);
    r.xs.forEach((x) => {
      const named = c.named[idx];
      const o = named || Z.makeAlly(`Ü${idx}`, FILLER_WEAPONS[idx % FILLER_WEAPONS.length]);
      Z.drawSurv(q, x, 0, r.h, o, idx * 0.37);
      if (named) tags.push([x, r.y, r.h, named.name]);
      idx++;
    });
    return { canvas: cv, y: r.y, top: hgt - 6, hgt, reveal: r.reveal };
  });
  // hinten zuerst zeichnen
  const res = { scale, rows: built.reverse(), tags };
  CROWD_CACHE.set(c, res);
  return res;
}
// ------------------------------------------------- Vogelperspektive ---
// Boden-Koordinaten: X quer (0…1080), Z Tiefe (0 hinten … 1000 vorne), Kamera schräg von oben
function aproj(X, Z) {
  const s = 0.82 + (0.5 * Z) / 1000;
  return [540 + (X - 540) * s, 430 + Z * 1.32 * (0.86 + (0.2 * Z) / 1000), s];
}
const FENCE = { x0: 120, x1: 960, z0: 160, z1: 880 };
const TENTS = [[250, 300, '#ff9f1c'], [830, 300, '#2ec4b6'], [210, 590, '#e71d36'], [870, 610, '#9b5de5'], [300, 790, '#3a86ff'], [780, 800, '#fee440']];
const FIRE = [540, 580];
const TOWER = [720, 470];
const AER_CACHE = new WeakMap();
function aerialPeople(n, tower = false) {
  const pts = [];
  for (let Z = 200; Z <= 850; Z += 46) {
    for (let X = 160 + ((Z / 46) % 2) * 23; X <= 920; X += 46) {
      if (X > 380 && X < 700 && Z < 430) continue; // Hütte
      if (Math.hypot(X - FIRE[0], (Z - FIRE[1]) * 1.3) < 105) continue; // Feuer
      if (TENTS.some(([tx, tz]) => Math.hypot(X - tx, (Z - tz) * 1.4) < 95)) continue;
      if (Math.abs(X - 540) < 40 && Z > 700) continue; // Weg zum Tor
      if (tower && Math.abs(X - TOWER[0]) < 80 && Math.abs(Z - TOWER[1]) < 70) continue; // Turm
      pts.push([X, Z]);
    }
  }
  // gleichmäßig verteilt auswählen (nicht nur vorne)
  const out = [];
  const step = pts.length / Math.max(1, n);
  for (let i = 0; i < Math.min(n, pts.length); i++) out.push(pts[Math.floor(i * step)]);
  return out;
}
function buildAerial(c, scale) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(VW * scale);
  cv.height = Math.ceil(1920 * scale);
  let q = cv.getContext('2d');
  q.scale(scale, scale);
  const pal = aerialPal(c);
  const day = pal === 'day';
  const dusk = pal === 'dusk';
  // Himmel + Waldrand ganz oben
  q.fillStyle = day ? '#8fd0f5' : dusk ? '#f0a070' : '#2a2552';
  q.fillRect(0, 0, VW, 520);
  for (let i = 0; i < 16; i++) Z.pine(q, -40 + i * 75, 470 + (i % 3) * 12, 240 + (i % 4) * 30, day ? '#3f8f45' : '#24533f', day ? '#327a3a' : '#1d4434', 6);
  // Wiese
  q.fillStyle = day ? '#7cb84e' : dusk ? '#6a8a40' : '#3e5530';
  q.fillRect(0, 460, VW, 1500);
  for (let i = 0; i < 40; i++) {
    const [x, y] = aproj(((i * 263) % 1300) - 110, ((i * 157) % 1250) - 60);
    P(q, day ? '#8cc85a' : dusk ? '#789a48' : '#46603a', 0, ell(x, y, 60, 18));
  }
  // Weg zum Tor
  const w0 = aproj(500, 880), w1 = aproj(580, 880), w2 = aproj(640, 1250), w3 = aproj(440, 1250);
  P(q, '#c9a06a', 5, Z.poly([w0, w1, w2, w3].map(([x, y]) => [x, y])));
  // Lagerboden (festgetretene Erde)
  const f = FENCE;
  const corners = [aproj(f.x0, f.z0), aproj(f.x1, f.z0), aproj(f.x1, f.z1), aproj(f.x0, f.z1)];
  P(q, '#b99a6a', 0, Z.poly(corners.map(([x, y]) => [x, y])));
  // ab hier: Objekte auf eigener (durchsichtiger) Ebene, damit der Graben darunter liegen kann
  const cv2 = document.createElement('canvas');
  cv2.width = cv.width;
  cv2.height = cv.height;
  const groundCv = cv;
  {
    const q2 = cv2.getContext('2d');
    q2.scale(scale, scale);
    q = q2;
  }
  // Bäume außen (hinten + Seiten)
  const trees = [];
  for (let zz = 0; zz <= 1150; zz += 120) {
    trees.push([-30 - (zz % 240) / 6, zz]);
    trees.push([1110 + (zz % 240) / 6, zz]);
  }
  for (let xx = 120; xx <= 960; xx += 110) trees.push([xx, 0]);
  // Zaun hinten + Seiten
  const fh = (zz) => 60 * aproj(0, zz)[2];
  const P0 = aproj(f.x0, f.z0), P1 = aproj(f.x1, f.z0), P2 = aproj(f.x1, f.z1), P3 = aproj(f.x0, f.z1);
  const items = [];
  for (const [x, zz] of trees) items.push([zz, () => { const [px, py, s] = aproj(x, zz); Z.pine(q, px, py, 230 * s, day || dusk ? '#3f8f45' : '#24533f', day || dusk ? '#327a3a' : '#1d4434', 5); }]);
  items.push([f.z0 - 1, () => wireLine(q, [P0[0], P0[1]], [P1[0], P1[1]], fh(f.z0), 1)]);
  items.push([f.z0, () => { wireLine(q, [P0[0], P0[1]], [P3[0], P3[1]], fh(f.z0), 1, fh(f.z1)); wireLine(q, [P1[0], P1[1]], [P2[0], P2[1]], fh(f.z0), 1, fh(f.z1)); }]);
  // Hütte, Zelte, Feuerstelle, Leute
  items.push([340, () => { const [x, y, s] = aproj(540, 340); Z.hut(q, x, y, 0.42 * s, { t: 1, barricade: 1, lit: !day }); }]);
  for (const [tx, tz, col] of TENTS) items.push([tz, () => { const [x, y, s] = aproj(tx, tz); tent(q, x, y, 0.9 * s, col); }]);
  items.push([FIRE[1] - 2, () => { const [x, y, s] = aproj(FIRE[0], FIRE[1]); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; P(q, '#8a8f96', 3, ell(x + Math.cos(a) * 46 * s, y + Math.sin(a) * 16 * s, 10 * s, 7 * s)); } P(q, '#7a4b2a', 4, rr(x - 34 * s, y - 8 * s, 68 * s, 12 * s, 5)); }]);
  const n = Math.min(160, c.crowdN || c.allies || 0);
  aerialPeople(n, !!c.tower).forEach(([X, Zz], i) => {
    const o = c.named[i] || Z.makeAlly(`Ü${i}`, FILLER_WEAPONS[i % FILLER_WEAPONS.length]);
    items.push([Zz, () => { const [x, y, s] = aproj(X, Zz); Z.drawSurv(q, x, y, 92 * s, o, i * 0.4); }]);
  });
  items.sort((a, b) => a[0] - b[0]).forEach(([, fn]) => fn());
  // Zaun vorne (mit Lücke fürs Tor)
  const gl = aproj(480, f.z1), gr = aproj(600, f.z1);
  wireLine(q, [P3[0], P3[1]], [gl[0], gl[1]], fh(f.z1), 1);
  wireLine(q, [gr[0], gr[1]], [P2[0], P2[1]], fh(f.z1), 1);
  return { ground: groundCv, objects: cv2 };
}
function aerialPal(c) {
  if (c.day) return 'day';
  if (c.duskAll && !NIGHT_KINDS.includes(c.kind)) return 'dusk';
  return 'night';
}
// Graben rund um den Zaun (k = wie weit ausgehoben, 0…1), mit Brücke vor dem Tor
function drawMoat(g, k) {
  if (k <= 0) return;
  const f = FENCE;
  const d1 = 28;
  const d2 = 92;
  // Umlauf: vorne rechts vom Tor → rechts → hinten → links → vorne links
  const path = [[600, f.z1 + d1], [f.x1 + d1, f.z1 + d1], [f.x1 + d1, f.z0 - d1], [f.x0 - d1, f.z0 - d1], [f.x0 - d1, f.z1 + d1], [480, f.z1 + d1]];
  const len = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const total = path.slice(1).reduce((s2, p, i) => s2 + len(path[i], p), 0);
  let left = total * k;
  const off = d2 - d1;
  for (let i = 0; i < path.length - 1 && left > 0; i++) {
    const a = path[i];
    const b = path[i + 1];
    const L = len(a, b);
    const f2 = Math.min(1, left / L);
    left -= L;
    const e = [lerp(a[0], b[0], f2), lerp(a[1], b[1], f2)];
    // Außenversatz je Kante
    const nx = (b[1] - a[1]) / L;
    const nz = -(b[0] - a[0]) / L;
    const outer = (p) => [p[0] - nx * off, p[1] - nz * off];
    const quad = [a, e, outer(e), outer(a)].map(([X, Zz]) => aproj(X, Zz));
    P(g, '#4a2f18', 3, Z.poly(quad.map(([x, y]) => [x, y])));
    const inner = [a, e].map(([X, Zz]) => aproj(X, Zz));
    line(g, inner.map(([x, y]) => [x, y + 6]), 5, '#2e1c0e');
  }
  // Erdhaufen außen
  for (let i = 0; i < Math.floor(k * 14); i++) {
    const t2 = i / 14;
    const X = lerp(f.x1 + d2 + 20, f.x0 - d2 - 20, t2);
    const [x, y, s2] = aproj(X, f.z0 - d2 - 20);
    P(g, '#8a6a44', 3, ell(x, y, 26 * s2, 11 * s2));
  }
  if (k > 0.98) {
    // Holzbrücke vor dem Tor
    const br = [aproj(495, f.z1 + 10), aproj(585, f.z1 + 10), aproj(585, f.z1 + d2 + 14), aproj(495, f.z1 + d2 + 14)];
    P(g, '#b5844f', 4, Z.poly(br.map(([x, y]) => [x, y])));
    for (let j = 1; j < 5; j++) {
      const zz = f.z1 + 10 + ((d2 + 4) * j) / 5;
      line(g, [aproj(495, zz), aproj(585, zz)].map(([x, y]) => [x, y]), 2.5, '#7a4b2a');
    }
  }
}
// Stacheln (spitze Pfähle) im Graben
function drawSpikes(g, k) {
  if (k <= 0) return;
  const f = FENCE;
  const d = 60;
  const pts = [];
  for (let X = f.x0 - d; X <= f.x1 + d; X += 34) pts.push([X, f.z0 - d]);
  for (let Zz = f.z0 - d + 34; Zz <= f.z1 + d; Zz += 34) {
    pts.push([f.x0 - d, Zz]);
    pts.push([f.x1 + d, Zz]);
  }
  for (let X = f.x0 - d; X <= f.x1 + d; X += 34) if (X < 480 || X > 600) pts.push([X, f.z1 + d]);
  pts.sort((a, b) => a[1] - b[1]);
  const n = Math.floor(pts.length * k);
  for (let i = 0; i < pts.length; i++) {
    if (((i * 7919) % pts.length) >= n) continue;
    const [x, y, s] = aproj(pts[i][0], pts[i][1]);
    const h = 48 * s;
    P(g, '#e8cf9c', 2.5, Z.poly([[x - 8 * s, y], [x, y - h], [x + 8 * s, y]]));
  }
}
// Aussichtsturm mit Scharfschützen (k = wie weit gebaut)
function drawLookout(g, t, c, k) {
  const [x, y, s] = aproj(TOWER[0], TOWER[1]);
  const H = 360 * s * easeOutBack(clamp(k));
  if (H <= 1) return;
  g.save();
  g.translate(x, y);
  const w = 70 * s;
  for (const lx of [-w, w]) P(g, '#8a5a30', 4, rr(lx - 6 * s, -H, 12 * s, H, 3));
  line(g, [[-w, -H * 0.15], [w, -H * 0.55]], 5 * s, '#6b4426');
  line(g, [[w, -H * 0.15], [-w, -H * 0.55]], 5 * s, '#6b4426');
  for (let r = 1; r < 6; r++) line(g, [[-10 * s, -r * H * 0.15], [10 * s, -r * H * 0.15]], 4 * s, '#b5844f');
  if (k > 0.7) {
    // Plattform + Schützen + Dach
    P(g, '#a8723f', 4, rr(-w - 30 * s, -H - 14 * s, 2 * w + 60 * s, 24 * s, 4));
    const team = [...c.snipers.slice(0, 4)];
    while (team.length < 4) team.push(Z.makeAlly(`Sniper${team.length}`, 'Sniper'));
    team.forEach((o, i) => {
      const px = (-w - 10 * s) + i * ((2 * w + 20 * s) / 3);
      Z.drawSurv(g, px, -H - 10 * s, 95 * s, o, t + i);
    });
    P(g, '#a8723f', 4, rr(-w - 30 * s, -H - 2 * s, 2 * w + 60 * s, 30 * s, 4));
    for (const lx of [-w - 24 * s, w + 24 * s]) P(g, '#8a5a30', 3, rr(lx - 4 * s, -H - 120 * s, 8 * s, 110 * s, 2));
    P(g, '#6b3b2a', 4, Z.poly([[-w - 50 * s, -H - 116 * s], [0, -H - 175 * s], [w + 50 * s, -H - 116 * s]]));
    team.forEach((o, i) => {
      if (!c.snipers[i]) return;
      const px = (-w - 10 * s) + i * ((2 * w + 20 * s) / 3);
      Z.nameTag(g, px, -H - 200 * s - (i % 2) * 34 * s, o.name, 0.42 * s);
    });
  }
  g.restore();
}
function drawAerial(g, t, c, { sign = null, signK = 1, cheer = false, moatK = null, towerK = null, spikesK = null } = {}) {
  const m = g.getTransform();
  const scale = Math.min(2.2, Math.max(0.6, Math.round(Math.hypot(m.a, m.b) * 1.2 * 4) / 4));
  let hit = AER_CACHE.get(c);
  if (!hit || hit.scale !== scale) AER_CACHE.set(c, (hit = { scale, cv: buildAerial(c, scale) }));
  const pal = aerialPal(c);
  g.fillStyle = pal === 'day' ? '#7cb84e' : pal === 'dusk' ? '#6a8a40' : '#3e5530';
  g.fillRect(-600, -600, 2300, 3200);
  g.drawImage(hit.cv.ground, 0, 0, VW, 1920);
  if (pal === 'dusk') {
    g.fillStyle = 'rgba(255,140,60,0.10)';
    g.fillRect(-600, -600, 2300, 3200);
  }
  drawMoat(g, moatK ?? (c.moat ? 1 : 0));
  drawSpikes(g, spikesK ?? (c.spikes ? 1 : 0));
  g.drawImage(hit.cv.objects, 0, 0, VW, 1920);
  // Lagerfeuer (bewegt)
  const [fx, fy, fs] = aproj(FIRE[0], FIRE[1]);
  for (let k = 0; k < 3; k++) {
    const h = (38 + Math.sin(t * 9 + k * 2) * 8) * fs;
    P(g, ['#ff6b1a', '#ffb703', '#ffe066'][k], 0, Z.poly([[fx - (20 - k * 6) * fs, fy - 4 * fs], [fx + Math.sin(t * 7 + k) * 4 * fs, fy - h - (2 - k) * 12 * fs], [fx + (20 - k * 6) * fs, fy - 4 * fs]]));
  }
  const tk = towerK ?? (c.tower ? 1 : 0);
  if (tk > 0) drawLookout(g, t, c, tk);
  // Held am Feuer
  const [hx, hy, hs] = aproj(540, 700);
  Z.drawHero(g, hx, hy - (cheer ? Math.abs(Math.sin(t * 5)) * 10 : 0), 125 * hs, { pose: 'cheer', mouth: 0, t });
  // Tor mit Schild an Ketten
  if (sign) {
    const [gx, gy, gs] = aproj(540, FENCE.z1);
    g.save();
    g.translate(gx, gy);
    g.scale(gs * 0.3, gs * 0.3);
    g.translate(-540, -1910);
    gateSign(g, t, sign, signK);
    g.restore();
  }
}
// Großes Lager mit Zelten, Drahtzaun und allen Überlebenden (Abend: Dämmerung)
function drawBase(g, t, c, mo, { fk = 1, dusk = false, sign = null, hang = null } = {}) {
  if (dusk) Z.forest(g, t, { mood: 0, skipMid: 540, moonAt: [830, 360, 80] });
  else forestFor(g, t, c, { skipMid: 540, mood: 0.3 });
  wireLine(g, [-60, 1150], [1140, 1150], 70, fk);
  tent(g, 200, 1185, 0.9, '#ff9f1c');
  tent(g, 880, 1185, 0.9, '#2ec4b6');
  Z.hut(g, 540, 1190, 0.55, { t, barricade: 1, lit: !c.day || dusk });
  tent(g, 90, 1290, 1.1, '#e71d36');
  tent(g, 990, 1290, 1.1, '#9b5de5');
  wireLine(g, [-60, 1150], [-230, 1900], 70, fk, 260);
  wireLine(g, [1140, 1150], [1310, 1900], 70, fk, 260);
  if (c.allies || c.crowdN) {
    const crowd = crowdFor(c, g);
    let heroDone = false;
    crowd.rows.forEach((r) => {
      if (!heroDone && r.y > 1700) {
        Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
        heroDone = true;
      }
      g.drawImage(r.canvas, 0, r.y - r.top, VW, r.hgt);
    });
    if (!heroDone) Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
    crowd.tags.forEach(([x, y, h, name]) => Z.nameTag(g, x, y - h * 1.12, name, 0.55));
  } else Z.drawHero(g, 540, 1640, 330, { pose: 'cheer', mouth: mo, t });
  if (sign) campSign(g, sign.text, sign.k);
  wireLine(g, [-230, 1900], [1310, 1900], 260, fk);
  // Tor mit Namensschild an Ketten (sobald das Lager einen Namen hat)
  const name = hang ? hang.text : null;
  if (name) gateSign(g, t, name, hang ? hang.k : 1);
}
function gateSign(g, t, text, k) {
  P(g, '#6b4426', 7, rr(330, 1080, 44, 830, 8));
  P(g, '#6b4426', 7, rr(706, 1080, 44, 830, 8));
  P(g, '#7a4b2a', 7, rr(300, 1060, 480, 46, 10));
  if (k <= 0) return;
  const drop = 1 - easeOutBack(clamp(k));
  const sw = Math.sin(t * 2.2) * 0.035 * (0.4 + drop);
  g.save();
  g.translate(540, 1100 - drop * 380);
  g.rotate(sw);
  for (const cx of [-150, 150]) for (let i = 0; i < 6; i++) P(g, null, 4, ell(cx, 14 + i * 16, 6, 9));
  g.save();
  g.translate(0, 110);
  P(g, '#000', 0, rr(-230, -2, 460, 130, 16));
  P(g, '#b5844f', 8, rr(-230, -14, 460, 130, 16));
  for (const y of [22, 58, 92]) line(g, [[-222, y], [222, y]], 3, '#9a6a3c');
  for (const x of [-205, 205]) P(g, '#5a5f66', 3, ell(x, 6, 7, 7));
  g.font = '80px "Lilita One", sans-serif';
  const s = Math.min(1, 410 / g.measureText(text).width);
  label(g, text, 0, 52, 80 * s, '#3a2412', { sw: 0 });
  g.restore();
  g.restore();
}
// Holzschild mit dem Lagernamen (Namens-Abstimmung)
function campSign(g, text, k) {
  if (k <= 0) return;
  g.save();
  g.translate(540, 1390);
  g.scale(k, k);
  g.rotate(-0.03);
  P(g, '#6b4426', 6, rr(-330, -40, 34, 300, 6));
  P(g, '#6b4426', 6, rr(296, -40, 34, 300, 6));
  P(g, '#000', 0, rr(-380, -190, 760, 180, 20));
  P(g, '#b5844f', 8, rr(-380, -200, 760, 180, 20));
  for (const y of [-150, -100, -55]) line(g, [[-370, y], [370, y]], 3, '#9a6a3c');
  g.font = '96px "Lilita One", sans-serif';
  const s = Math.min(1, 660 / g.measureText(text).width);
  label(g, text, 0, -110, 96 * s, '#3a2412', { sw: 0 });
  g.restore();
}
// Drahtzaun von a nach b (Pfostenhöhe h1 → h2), k = wie weit fertig gebaut (0…1)
function wireLine(g, a, b, h1, k = 1, h2 = h1) {
  if (k <= 0) return;
  const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 110));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    if (f > k + 1e-6) break;
    pts.push([lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(h1, h2, f)]);
  }
  if (pts.length < 2) return;
  for (const [x, y, h] of pts) P(g, '#7a7f87', Math.max(2, h / 40), rr(x - h * 0.04, y - h, h * 0.08, h, 2));
  for (const r of [0.3, 0.6, 0.92]) line(g, pts.map(([x, y, h]) => [x, y - h * r]), Math.max(1.5, pts[0][2] / 70), '#9aa3ad');
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 1; j < 5; j++) {
      const f = j / 5;
      const x = lerp(pts[i][0], pts[i + 1][0], f);
      const h = lerp(pts[i][2], pts[i + 1][2], f);
      const y = lerp(pts[i][1], pts[i + 1][1], f) - h * 0.92;
      const s = h * 0.06;
      line(g, [[x - s, y - s], [x + s, y + s]], Math.max(1.2, h / 90), '#5f6670');
      line(g, [[x - s, y + s], [x + s, y - s]], Math.max(1.2, h / 90), '#5f6670');
    }
  }
}
function tent(g, x, y, s, col) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  P(g, col, 5, Z.poly([[-85, 0], [0, -120], [85, 0]]));
  P(g, 'rgba(0,0,0,0.2)', 0, Z.poly([[0, -120], [85, 0], [20, 0]]));
  P(g, '#3a2a20', 4, Z.poly([[-18, 0], [0, -55], [18, 0]]));
  line(g, [[0, -120], [0, -140]], 4);
  g.restore();
}
const HORDE_CACHE = new WeakMap();
function hordeFor(c, g) {
  const m = g.getTransform();
  const scale = Math.min(2, Math.max(0.5, Math.round(Math.hypot(m.a, m.b) * 4) / 4));
  const hit = HORDE_CACHE.get(c);
  if (hit && hit.scale === scale) return hit.rows;
  let left = Math.min(110, c.zombies - 12);
  const rows = [];
  [[1430, 210, 62], [1375, 180, 52], [1330, 150, 44], [1292, 125, 37], [1262, 105, 31]].forEach(([y, h, sp], ri) => {
    if (left <= 0) return;
    const hgt = h * 1.3;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(2400 * scale);
    cv.height = Math.ceil(hgt * scale);
    const q = cv.getContext('2d');
    q.scale(scale, scale);
    q.translate(0, hgt - 6);
    const cnt = Math.min(left, Math.floor(2300 / sp));
    for (let i = 0; i < cnt; i++) Z.drawZombie(q, 40 + i * (2300 / cnt) + (ri % 2) * sp * 0.4, 0, h, { t: i * 0.7, v: i + ri, dir: 1, eyes: true });
    left -= cnt;
    rows.push({ canvas: cv, y, top: hgt - 6, hgt });
  });
  rows.reverse();
  HORDE_CACHE.set(c, { scale, rows });
  return rows;
}
function drawWire(g, s) {
  if (s <= 0) return;
  for (let i = 0; i < 9; i++) P(g, '#7a7f87', 4, rr(60 + i * 120, 1440 - 190 * s, 14, 190 * s, 3));
  for (let r = 0; r < 4; r++) line(g, [[60, 1440 - (40 + r * 42) * s], [1040, 1440 - (40 + r * 42) * s]], 3, '#9aa3ad');
  for (let i = 0; i < 40; i++) {
    const x = 70 + i * 24;
    const y = 1440 - 190 * s;
    line(g, [[x - 7, y - 7], [x + 7, y + 7]], 2.5, '#5f6670');
    line(g, [[x - 7, y + 7], [x + 7, y - 7]], 2.5, '#5f6670');
  }
}
function drawWall(g, s) {
  if (s <= 0) return;
  const top = 1440 - 210 * s;
  P(g, '#9a9ea6', 6, rr(30, top, 1020, 1440 - top, 6));
  for (let r = 0; top + r * 42 < 1440; r++) {
    const y = top + r * 42;
    line(g, [[34, y], [1046, y]], 3, '#6f747c');
    for (let x = 30 + (r % 2) * 45; x < 1050; x += 90) line(g, [[x, y], [x, Math.min(1440, y + 42)]], 3, '#6f747c');
  }
  for (let x = 30; x < 1050; x += 90) P(g, '#a9adb5', 5, rr(x, top - 34, 60, 36, 4));
}
// Ausbau-Vorschau: Speere an der Hütte, Holzzaun, Wachturm
function drawSpears(g, x, y, s) {
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (let i = 0; i < 5; i++) {
    g.save();
    g.translate(i * 34 - 70, 0);
    g.rotate(-0.25 + i * 0.12);
    P(g, '#b5844f', 5, rr(-7, -330, 14, 330, 6));
    P(g, '#d9d4c7', 5, Z.poly([[-9, -326], [0, -380], [9, -326]]));
    g.restore();
  }
  g.restore();
}
function drawFence(g, s) {
  if (s <= 0) return;
  for (let i = 0; i < 15; i++) {
    const x = 70 + i * 67;
    const h = 170 * s * (0.9 + (i % 3) * 0.06);
    P(g, i % 2 ? '#9a6a3c' : '#a8723f', 5, Z.poly([[x - 28, 1440], [x - 28, 1440 - h], [x, 1440 - h - 36 * s], [x + 28, 1440 - h], [x + 28, 1440]]));
  }
  line(g, [[40, 1440 - 120 * s], [1040, 1440 - 120 * s]], 10, '#6b4426');
}
function drawTower(g, x, y, s) {
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  for (const lx of [-90, 90]) P(g, '#8a5a30', 6, rr(lx - 12, -560, 24, 560, 6));
  line(g, [[-80, -60], [80, -260]], 9, '#6b4426');
  line(g, [[80, -60], [-80, -260]], 9, '#6b4426');
  for (let r = 0; r < 8; r++) line(g, [[-40, -40 - r * 60], [40, -40 - r * 60]], 7, '#b5844f');
  line(g, [[-40, 0], [-40, -500]], 7, '#6b4426');
  line(g, [[40, 0], [40, -500]], 7, '#6b4426');
  P(g, '#a8723f', 6, rr(-150, -620, 300, 60, 8));
  P(g, '#9a6a3c', 6, rr(-150, -720, 24, 110, 4));
  P(g, '#9a6a3c', 6, rr(126, -720, 24, 110, 4));
  P(g, '#6b3b2a', 6, Z.poly([[-190, -710], [0, -830], [190, -710]]));
  g.restore();
}
function optionList(g, t, options, end, withName = false) {
  const head = popIn(t, 0.1, end);
  if (head > 0) {
    card(g, VW / 2, 330, 920, 140, DARK, head, -0.02);
    const abc = options.map((o) => o.letter).join(', ').replace(/, ([^,]*)$/, ' ODER $1');
    const txt = withName ? `NAME + ${abc}!` : `SCHREIB ${abc}!`;
    label(g, txt, 0, 4, 64, YEL, { sw: 0 });
    g.restore();
  }
  options.slice(0, 3).forEach((o, i) => {
    const a = popIn(t, 0.5 + i * 0.4, end);
    if (a <= 0) return;
    const col = { A: YEL, B: '#3a86ff', C: '#ff7b00' }[o.letter] || YEL;
    card(g, VW / 2, 520 + i * 160, 900, 130, col, a, 0);
    P(g, '#fff', 6, ell(-370, 0, 50, 50));
    label(g, o.letter, -370, 4, 70, DARK, { sw: 0 });
    g.font = '56px "Lilita One", sans-serif';
    const s = Math.min(1, 680 / g.measureText(o.short).width);
    label(g, o.short, 60, 4, 56 * s, o.letter === 'A' ? DARK : '#fff', { sw: 0 });
    g.restore();
  });
  const lk = popIn(t, 1.9, end);
  if (lk > 0) {
    card(g, VW / 2, 1010, 820, 100, '#fe2c55', lk, 0.02);
    label(g, 'MEISTE LIKES GEWINNT!', 0, 2, 50, '#fff', { sw: 0 });
    g.restore();
  }
}
// Folge spielt am Tag (es gibt eine "Wir haben überlebt"-Szene): ruhige Szenen hell
const NIGHT_KINDS = ['horde', 'alone', 'fight', 'final', 'title', 'problem'];
function forestFor(g, t, c, opts) {
  if ((c.evening || c.duskAll) && !c.day && !NIGHT_KINDS.includes(c.kind)) return Z.forest(g, t, { ...opts, mood: 0, day: false });
  Z.forest(g, t, { ...opts, day: c.day && !NIGHT_KINDS.includes(c.kind) });
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
    if (c.named[i]) Z.nameTag(g, x, y - 300, c.named[i].name, 0.85);
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
  // erste Szene: erst nach dem großen Titel einblenden
  if (c.i === 0 && c.kind !== 'title') {
    if (t < 3.5) return;
    t -= 3.5;
    dur = Math.max(0.6, dur - 3.5);
  }
  const end = dur - 0.15;
  switch (c.kind) {
    case 'hut': {
      const a = popIn(t, 0.3, end);
      if (a > 0) {
        card(g, VW / 2, 400, 820, 130, DARK, a, -0.02);
        const noun = /basis/.test(c.low) ? 'BASIS' : /lager|camp/.test(c.low) ? 'LAGER' : 'HÜTTE';
        const ht = /name/.test(c.low) && /lager|camp|hütte|basis/.test(c.low) ? (noun === 'BASIS' ? 'UNSERE BASIS BRAUCHT EINEN NAMEN!' : 'UNSER LAGER BRAUCHT EINEN NAMEN!') : /aufwert|aufrüst/.test(c.low) ? `${noun} AUFWERTEN!` : /ausbau|verstärk|bau\w*\s.*\saus\b/.test(c.low) ? `${noun} AUSBAUEN!` : /bunker/.test(c.low) ? 'VERSTECK: BUNKER' : 'VERSTECK: HÜTTE IM WALD';
        g.font = '54px "Lilita One", sans-serif';
        label(g, ht, 0, 2, Math.min(54, (54 * 760) / g.measureText(ht).width), '#ffffff', { sw: 0 });
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
      if (/morgen|heute nacht|bald|fast da|gleich|in \d+ tagen|an tag \d+/.test(c.low)) {
        const tagM = c.low.match(/tag (\d+)/);
        const when = /morgen abend/.test(c.low) ? 'MORGEN ABEND!' : tagM && /in \d+ tagen|an tag/.test(c.low) ? `TAG ${tagM[1]}!` : /in (\d+) tagen/.test(c.low) ? `IN ${c.low.match(/in (\d+) tagen/)[1]} TAGEN!` : /fast da|gleich/.test(c.low) ? 'GLEICH!' : /heute nacht/.test(c.low) ? 'HEUTE NACHT!' : /bald/.test(c.low) ? 'BALD!' : 'MORGEN!';
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
      const a = c.options.length >= 2 && c.afterOptions ? 0 : popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 380, 920, 150, YEL, a, -0.02);
        const variant = commentVariant(c);
        if (variant === 'lager') {
          label(g, 'WIE SOLL UNSER', 0, -26, 58, DARK, { sw: 0 });
          label(g, 'LAGER HEISSEN?', 0, 36, 60, DARK, { sw: 0 });
        } else if (variant === 'defend') {
          label(g, 'TOP-KOMMENTAR ENTSCHEIDET,', 0, -26, 54, DARK, { sw: 0 });
          label(g, 'WIE WIR VERTEIDIGEN!', 0, 36, 58, DARK, { sw: 0 });
        } else if (variant === 'build') {
          label(g, 'TOP-KOMMENTAR ENTSCHEIDET,', 0, -26, 54, DARK, { sw: 0 });
          label(g, 'WAS WIR BAUEN!', 0, 36, 60, DARK, { sw: 0 });
        } else if (/waffe/.test(c.low)) {
          label(g, 'NAME + WAFFE', 0, -26, 64, DARK, { sw: 0 });
          label(g, 'IN DIE KOMMENTARE!', 0, 36, 50, DARK, { sw: 0 });
        } else label(g, 'AB IN DIE KOMMENTARE!', 0, 4, 64, DARK, { sw: 0 });
        g.restore();
      }
      if (c.options.length >= 2 && c.afterOptions) optionList(g, t, c.options, end, c.nameVote && !c.optionsAreNames);
      else commentsPanel(g, t, c);
      break;
    }
    case 'ally': {
      const a = popIn(t, 0.5, end);
      if (a > 0) {
        card(g, VW / 2, 410, 860, 200, DARK, a, -0.02);
        label(g, 'NEU IM TEAM:', 0, -46, 52, '#ffffff', { sw: 0 });
        label(g, c.ally.name, 0, 34, 96, YEL, { sw: 0 });
        g.restore();
      }
      if (c.ally.weaponText) {
        const b = popIn(t, 1.2, end);
        if (b > 0) {
          const role = /schmied|sheriff|schütze|arzt|koch|wache|späher|sanitäter|mechaniker/i.test(c.ally.weaponText);
          const wt = (role ? c.ally.weaponText.toUpperCase() : `WAFFE: ${c.ally.weaponText.toUpperCase()}`).slice(0, 34);
          card(g, VW / 2, 600, 900, 110, '#fff', b, 0.02);
          g.font = '50px "Lilita One", sans-serif';
          label(g, wt, 0, 2, Math.min(50, (50 * 820) / g.measureText(wt).width), DARK, { sw: 0 });
          g.restore();
        }
      }
      break;
    }
    case 'characters': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        card(g, VW / 2, 400, 900, 150, DARK, a, 0.02);
        label(g, /charakter|figur/.test(c.low) || !c.named.length ? 'DEIN EIGENER CHARAKTER!' : /neu/.test(c.low) ? 'NEU IN DER GRUPPE!' : /panzer/.test(c.low) ? 'MIT PANZER!' : 'UNSERE KÄMPFER!', 0, 4, 66, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'defend': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 420, 900, 170, RED, a, -0.02);
        label(g, /brauchen|gesucht|suchen|wer hilft/.test(c.low) ? 'VERTEIDIGER GESUCHT!' : 'VERTEIDIGT DIE HÜTTE!', 0, 4, 72, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'fight': {
      const a = popIn(t, 0.1, end);
      if (a > 0) {
        const kill = c.text.match(/(\d+)\s+zombies?\s+(?:erledigt|besiegt|ausgeschaltet|vernichtet|getötet)/i);
        card(g, VW / 2, 420, kill ? 900 : 700, 170, RED, a, -0.03);
        const win = /erfolgreich|geschafft|gewonnen|abgewehrt|zurückgeschlagen/.test(c.low);
        label(g, kill ? `${kill[1]} ZOMBIES ERLEDIGT!` : win ? 'GESCHAFFT!' : 'DER KAMPF!', 0, 4, kill ? 76 : 100, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'welcome': {
      const a = popIn(t, 0.9, end);
      if (a > 0) {
        card(g, VW / 2, 400, 900, 220, DARK, a, -0.02);
        label(g, 'IHR HABT ABGESTIMMT:', 0, -50, 54, '#ffffff', { sw: 0 });
        const nm = c.campName || 'UNSER LAGER';
        g.font = '84px "Lilita One", sans-serif';
        label(g, nm, 0, 40, Math.min(84, (84 * 800) / g.measureText(nm).width), YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'topcomment': {
      const m = c.topc;
      const a = popIn(t, 0.2, end);
      if (a > 0 && m) {
        g.save();
        g.translate(VW / 2, 480);
        g.scale(a, a);
        g.rotate(-0.015);
        P(g, '#000', 0, rr(-480, -150, 960, 320, 30));
        P(g, '#1c1c1e', 7, rr(-480, -160, 960, 320, 30));
        P(g, YEL, 7, rr(-200, -215, 400, 80, 40));
        label(g, 'TOP-KOMMENTAR', 0, -174, 46, DARK, { sw: 0 });
        // Profilbild (Helm mit Visier)
        P(g, '#d9dce0', 5, ell(-370, -20, 70, 70));
        P(g, '#3a3f46', 4, ell(-370, -34, 50, 44));
        g.save();
        const vg = g.createLinearGradient(-410, 0, -330, 0);
        vg.addColorStop(0, '#5b6cff');
        vg.addColorStop(0.5, '#ff9f1c');
        vg.addColorStop(1, '#2ec4b6');
        P(g, vg, 3, rr(-412, -40, 84, 26, 12));
        g.restore();
        g.textAlign = 'left';
        g.textBaseline = 'middle';
        g.font = '44px "Lilita One", sans-serif';
        g.fillStyle = '#9a9aa2';
        g.fillText(m[1].trim(), -270, -80);
        const txt = m[2].replace(/[!.]+$/, '');
        g.font = '60px "Lilita One", sans-serif';
        const tw = g.measureText(txt).width;
        if (tw > 640) g.font = `${Math.floor((60 * 640) / tw)}px "Lilita One", sans-serif`;
        g.fillStyle = '#ffffff';
        g.fillText(txt, -270, 0);
        // Herz
        g.fillStyle = '#fe2c55';
        g.beginPath();
        const hx = 400;
        const hy = 0;
        g.moveTo(hx, hy + 22);
        g.bezierCurveTo(hx - 40, hy - 6, hx - 18, hy - 36, hx, hy - 14);
        g.bezierCurveTo(hx + 18, hy - 36, hx + 40, hy - 6, hx, hy + 22);
        g.fill();
        g.font = '36px "Lilita One", sans-serif';
        g.fillStyle = '#fe2c55';
        g.textAlign = 'center';
        g.fillText('TOP', hx, 62);
        g.restore();
      }
      break;
    }
    case 'tower': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        const who = c.mentioned[0]?.name;
        const t1 = c.tower === 'build' ? (who ? `${who}S IDEE:` : 'NEU IM LAGER:') : 'SCHARFSCHÜTZEN!';
        const t2 = c.tower === 'build' ? 'AUSSICHTSTURM!' : c.snipers.length ? c.snipers.slice(0, 2).map((o) => o.name).join(' & ') + ' & CO.' : 'AUF DEM TURM';
        card(g, VW / 2, 400, 900, 220, DARK, a, -0.02);
        label(g, t1, 0, -48, 56, '#ffffff', { sw: 0 });
        g.font = '76px "Lilita One", sans-serif';
        label(g, t2, 0, 40, Math.min(76, (76 * 820) / g.measureText(t2).width), YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'spikes': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        const who = c.mentioned[0]?.name;
        card(g, VW / 2, 400, 920, who && c.spikes === 'build' ? 220 : 170, RED, a, -0.02);
        if (who && c.spikes === 'build') {
          label(g, `${who}S IDEE:`, 0, -48, 56, '#ffffff', { sw: 0 });
          label(g, 'STACHELN IM GRABEN!', 0, 40, 68, YEL, { sw: 0 });
        } else label(g, 'STACHELN IM GRABEN!', 0, 4, 68, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'moat': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 400, 920, 170, DARK, a, -0.02);
        label(g, 'WIR GRABEN EINEN GRABEN!', 0, 4, 66, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'thanks':
    case 'ready': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 400, 820, 170, c.kind === 'thanks' ? '#fe2c55' : GREEN, a, -0.02);
        label(g, c.kind === 'thanks' ? 'DANKE AN EUCH ALLE!' : 'WIR SIND BEREIT!', 0, 4, 76, '#fff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'evening': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 400, 860, 170, DARK, a, -0.02);
        label(g, 'DIE NACHT BRICHT AN …', 0, 4, 70, '#ffb35c', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'result': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 400, 900, 230, DARK, a, -0.02);
        label(g, 'ABSTIMMUNG:', 0, -58, 56, '#ffffff', { sw: 0 });
        label(g, c.result?.name ? `${c.result.name} GEWINNT!` : 'IHR HABT ENTSCHIEDEN!', 0, 30, 76, YEL, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'base': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 400, 900, 170, DARK, a, -0.02);
        const wideTxt = /schaut euch an|seht euch an|von oben|überblick/.test(c.low) ? (c.campName ? `DAS IST ${c.campName}!` : 'UNSER LAGER!') : null;
        const bt = wideTxt || (/zaun/.test(c.low) ? 'DRAHTZAUN UM DAS LAGER!' : 'UNSER LAGER WÄCHST!');
        g.font = '74px "Lilita One", sans-serif';
        label(g, bt, 0, 4, Math.min(74, (74 * 820) / g.measureText(bt).width), YEL, { sw: 0 });
        g.restore();
      }
      const b = popIn(t, 1.0, end);
      if (b > 0 && c.allies) {
        card(g, VW / 2, 580, 620, 110, '#fff', b, 0.02);
        label(g, `${c.allies} ÜBERLEBENDE`, 0, 2, 54, DARK, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'crowd': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        const n = Math.round(c.crowdN * clamp((t - 0.3) / 1.6));
        if (/follow/.test(c.low)) {
          card(g, VW / 2, 430, 900, 240, DARK, a, -0.02);
          label(g, `${n} FOLLOWER =`, 0, -46, 86, '#ffffff', { sw: 0 });
          label(g, `${n} ÜBERLEBENDE!`, 0, 52, 86, YEL, { sw: 0 });
          g.restore();
          break;
        }
        card(g, VW / 2, 430, 760, 240, DARK, a, -0.02);
        label(g, String(n), 0, -38, 130, YEL, { sw: 0 });
        label(g, 'ÜBERLEBENDE!', 0, 66, 70, '#ffffff', { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'morning': {
      const a = popIn(t, 0.2, end);
      if (a > 0) {
        card(g, VW / 2, 420, 860, 180, YEL, a, -0.03);
        label(g, /überlebt/.test(c.low) ? 'WIR HABEN ÜBERLEBT!' : 'ES IST TAG!', 0, 4, 80, DARK, { sw: 0 });
        g.restore();
      }
      break;
    }
    case 'option': {
      const o = c.option;
      const a = popIn(t, 0.15, end);
      if (a > 0 && o) {
        const col = { A: YEL, B: '#3a86ff', C: '#ff7b00' }[o.letter] || YEL;
        card(g, VW / 2, 420, 960, 190, col, a, o.letter === 'B' ? 0.02 : -0.02);
        P(g, '#fff', 7, ell(-380, 0, 70, 70));
        label(g, o.letter, -380, 6, 100, DARK, { sw: 0 });
        g.font = '68px "Lilita One", sans-serif';
        const s = Math.min(1, 700 / g.measureText(o.short).width);
        label(g, o.short, 70, 4, 68 * s, o.letter === 'A' ? DARK : '#fff', { sw: 0 });
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
        label(g, /überleben\s*\?/.test(c.low) ? 'ÜBERLEBEN WIR?!' : /ernst/.test(c.low) ? 'MORGEN WIRD ES ERNST!' : /morgen/.test(c.low) && /kampf/.test(c.low) ? 'MORGEN: DER KAMPF!' : /morgen/.test(c.low) ? 'BIS MORGEN!' : 'FOLGE & ÜBERLEBE!', 0, 4, 76, '#7ddc4a', { sw: 0 });
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
function commentVariant(c) {
  if (/(lager|camp|basis)/.test(c.low) && /name|heißen|nennen|vorschlag/.test(c.low)) return 'lager';
  if (c.nameVote && /vorschlag|name/.test(c.low) && !/waffe/.test(c.low)) return 'lager';
  if (/verteidig/.test(c.low) && /top|likes|entscheidet/.test(c.low)) return 'defend';
  if (/bau/.test(c.low) && /top|likes|entscheidet/.test(c.low)) return 'build';
  return null;
}
const VARIANT_COMMENTS = {
  lager: [['Lena', 'Fort Hoffnung!!', '#3a86ff', '412'], ['Max', 'Camp Zombiefrei haha', '#43aa8b', '287'], ['Tobi', 'Die letzte Hütte', '#9b5de5', '196']],
  defend: [['Lena', 'Fallen vor dem Zaun graben!', '#3a86ff', '388'], ['Max', 'Mini-Panzer ans Tor!!', '#43aa8b', '265'], ['Tobi', 'Wachen auf dem Dach', '#9b5de5', '171']],
  build: [['Lena', 'Wachturm!!', '#3a86ff', '356'], ['Max', 'Holzzaun, safe', '#43aa8b', '241'], ['Tobi', 'Speere für alle', '#9b5de5', '178']],
};
function commentsPanel(g, t, c) {
  const k = smooth(clamp((t - 0.2) / 0.4));
  if (k <= 0) return;
  const variant = commentVariant(c);
  const list = variant ? VARIANT_COMMENTS[variant] : c.named.length
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
    [c.hasVote ? 'KOMMENTIERE: A ODER B' : c.defendVote ? 'KOMMENTIERE: WIE VERTEIDIGEN WIR?' : c.optionsAreNames ? `KOMMENTIERE: ${c.options.map((o) => o.letter).join(', ').replace(/, ([^,]*)$/, ' ODER $1')}` : c.nameVote && c.options.length >= 2 ? `KOMMENTIERE: NAME + ${c.options.map((o) => o.letter).join('/')}` : c.nameVote ? 'KOMMENTIERE: NAME FÜRS LAGER' : c.options.length >= 2 ? `KOMMENTIERE: ${c.options.map((o) => o.letter).join(', ').replace(/, ([^,]*)$/, ' ODER $1')}` : 'KOMMENTIERE: NAME + WAFFE', YEL],
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
    case 'ally':
      add(0.6, 'pop');
      add(1.25, c.ally.weapon === 'shotgun' ? 'clang' : 'pop');
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
    case 'evening':
      add(0.2, 'crickets');
      add(0.5, 'whoosh');
      break;
    case 'result':
      add(0.2, 'ding');
      add(0.6, 'hammer');
      add(1.2, 'cheer');
      break;
    case 'tower':
      add(0.3, c.tower === 'build' ? 'hammer' : 'whoosh');
      add(1.2, c.tower === 'build' ? 'hammer' : 'clang');
      break;
    case 'spikes':
      for (let i = 0; i < 4; i++) add(0.5 + i * 0.6, 'stamp');
      break;
    case 'topcomment':
      add(0.2, 'pop');
      add(0.5, 'ding');
      break;
    case 'moat':
      for (let i = 0; i < 5; i++) add(0.5 + i * 0.7, 'stamp');
      break;
    case 'welcome':
      add(0.5, 'whoosh');
      add(1.0, 'clang');
      add(1.1, 'cheer');
      break;
    case 'thanks':
    case 'ready':
      add(0.2, 'cheer');
      break;
    case 'base':
      add(0.3, 'hammer');
      add(1.0, 'cheer');
      break;
    case 'crowd':
      for (let i = 0; i < 6; i++) add(0.35 + i * 0.27, 'pop');
      add(2.0, 'cheer');
      break;
    case 'morning':
      add(0.2, 'cheer');
      add(0.3, 'ding');
      break;
    case 'option':
      add(0.15, 'whoosh');
      add(0.35, c.option?.build ? 'hammer' : 'ding');
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
