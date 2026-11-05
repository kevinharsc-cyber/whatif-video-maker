// Motion Graphics: Pop-up-Karten, Kapitel-Labels und Soundeffekt-Zeitpunkte.
// Pop-ups sliden passend zum gesprochenen Wort von unten ins Bild.

import { drawInsert, INSERT_LIST } from './inserts.js';

// Schlüsselwörter → animierte B-Roll-Einblendung
const INSERT_MAP = [
  [/^(handy|smartphone|nachricht|netz$|empfang|wlan|schreibst|anrufen|anruf|telefon)/, 'phone', 'KEIN NETZ'],
  [/^(strom|stromausfall|heizung|kraftwerk)/, 'power', 'STROMAUSFALL'],
  [/^(internet|online|offline)/, 'internet', 'OFFLINE'],
  [/^(uhr$|uhrzeit|wecker|minuten|stunden)/, 'clock', 'ZEIT VERGEHT'],
  [/^(tage?n?$|wochen?$|monate?n?$)/, 'calendar', null],
  [/^(tiere|rehe?$|wölfe|wolf|hirsch|wildtiere)/, 'animals', 'WILDTIERE'],
  [/^(burger|pommes|restaurant|imbiss|fastfood)/, 'burger', 'BURGERLADEN'],
  [/^(sterne|milchstraße|sternenhimmel|nachthimmel)/, 'stars', 'MILCHSTRASSE'],
  [/^(gemüse|pflanzen|anbauen|garten|karotten)/, 'plant', 'SELBST ANBAUEN'],
  [/^(wasser|trinkwasser|filtern|regenwasser)/, 'water', 'WASSER'],
  [/^(menschheit|milliarden|bevölkerung|letzte)/, 'counter', 'MENSCHEN AUF DER ERDE'],
];

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// Wörterbuch: Wortanfang → [Emoji, Beschriftung]
const DICT = [
  [/^burger/, '🍔', 'Burger'], [/^pizza/, '🍕', 'Pizza'], [/^(essen|nahrung|lebensmittel)/, '🍽️', 'Essen'],
  [/^supermarkt/, '🛒', 'Supermarkt'], [/^(restaurant|imbiss)/, '🍟', 'Restaurant'], [/^kaffee/, '☕', 'Kaffee'],
  [/^(wasser|trinkwasser)/, '💧', 'Wasser'], [/^(handy|smartphone)/, '📱', 'Handy'], [/^internet/, '🌐', 'Internet'],
  [/^(wlan|netz\b|empfang)/, '📶', 'Kein Netz'], [/^strom/, '⚡', 'Strom'], [/^(licht|lampe)/, '💡', 'Licht'],
  [/^(fernseh|tv)/, '📺', 'Fernsehen'], [/^radio/, '📻', 'Radio'], [/^(auto|autos)$/, '🚗', 'Autos'],
  [/^verkehr/, '🚦', 'Verkehr'], [/^(bus|busse)$/, '🚌', 'Bus'], [/^(zug|bahn)/, '🚆', 'Bahn'],
  [/^flugzeug/, '✈️', 'Flugzeug'], [/^schiff/, '🚢', 'Schiff'], [/^(rakete|raumschiff)/, '🚀', 'Rakete'],
  [/^(stadt|städte|großstadt)/, '🏙️', 'Stadt'], [/^(haus|häuser|wohnung)/, '🏠', 'Zuhause'], [/^krankenhaus/, '🏥', 'Krankenhaus'],
  [/^(polizei)/, '🚓', 'Polizei'], [/^(feuerwehr)/, '🚒', 'Feuerwehr'], [/^(geld|euro)/, '💶', 'Geld'],
  [/^(sonne)/, '☀️', 'Sonne'], [/^mond/, '🌙', 'Mond'], [/^(erde|planet)/, '🌍', 'Erde'], [/^(sterne|stern)\b/, '✨', 'Sterne'],
  [/^(nacht)/, '🌙', 'Nacht'], [/^(biene)/, '🐝', 'Bienen'], [/^(tiere|tier)$/, '🐾', 'Tiere'], [/^(hund)/, '🐕', 'Hunde'],
  [/^(katze)/, '🐈', 'Katzen'], [/^(vögel|vogel)/, '🐦', 'Vögel'], [/^(wolf|wölfe)/, '🐺', 'Wölfe'], [/^(hirsch|rehe?)\b/, '🦌', 'Wildtiere'],
  [/^(bäume|baum|wald|pflanzen)/, '🌳', 'Natur'], [/^(feuer|brand|flammen)/, '🔥', 'Feuer'], [/^(kälte|eis|schnee)/, '❄️', 'Kälte'],
  [/^(hitze|heiß)/, '🌡️', 'Hitze'], [/^(uhr|uhrzeit|wecker)/, '⏰', 'Uhrzeit'], [/^(stunden?)$/, '⏳', 'Stunden'],
  [/^(tage?|tagen)$/, '📅', 'Tage'], [/^(wochen?)$/, '📅', 'Wochen'], [/^(monate?n?)$/, '🗓️', 'Monate'], [/^(jahre?n?)$/, '⏳', 'Jahre'],
  [/^(allein|einsam)/, '👤', 'Allein'], [/^(hilfe)/, '🆘', 'Hilfe'], [/^(angst|panik)/, '😱', 'Panik'],
  [/^(stille|totenstill)/, '🔇', 'Stille'], [/^(musik)/, '🎵', 'Musik'], [/^(benzin|tankstelle)/, '⛽', 'Benzin'],
  [/^(atomkraftwerk|kraftwerk)/, '☢️', 'Kraftwerk'], [/^(wissenschaftler|forscher)/, '🔬', 'Forscher'], [/^(menschen|menschheit|leute)/, '👥', 'Menschen'],
  [/^(milliarden)/, '🌎', 'Milliarden'], [/^(krankheit|virus)/, '🦠', 'Virus'], [/^(medikament|medizin)/, '💊', 'Medizin'],
  [/^(werkzeug|bauen)/, '🔧', 'Werkzeug'], [/^(garten|gemüse|anbauen)/, '🥕', 'Gemüse'], [/^(schule)/, '🏫', 'Schule'],
  [/^(arbeit|job)/, '💼', 'Arbeit'], [/^(spiel|zocken|playstation)/, '🎮', 'Gaming'], [/^(regen)/, '🌧️', 'Regen'],
  [/^(sturm|gewitter)/, '⛈️', 'Sturm'], [/^(meer|ozean)/, '🌊', 'Meer'], [/^(dinosaur)/, '🦖', 'Dinosaurier'],
];

export function guessPopups(text) {
  const out = [];
  const words = text.split(/\s+/);
  for (const raw of words) {
    const w = raw.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!w) continue;
    const hit = DICT.find(([re]) => re.test(w));
    if (hit && !out.some((p) => p.emoji === hit[1])) out.push({ emoji: hit[1], label: hit[2], word: raw });
    if (out.length >= 2) break;
  }
  return out;
}

export function guessLabel(text, index) {
  const m = text.match(/\b(nach|seit|in)\s+((ein|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|hundert|tausend|einigen|ein paar|wenigen|vielen|\d+)\s+)?(sekunden|minuten|stunden|tagen|wochen|monaten|jahren|jahrzehnten|jahrhunderten)\b/i);
  if (m) return m[0];
  const u = text.match(/\b\d{1,2}[:.]\d{2}\s*uhr\b/i) || text.match(/\b(morgens|mittags|abends|nachts|am nächsten morgen|am ersten tag|tag \d+)\b/i);
  if (u && index > 0) return u[0];
  return null;
}

/**
 * Baut die zeitgesteuerten Einblendungen + Soundeffekte.
 */
export function buildOverlays(scenes, sceneStarts, sceneTimes, subtitles, duration) {
  const overlays = [];
  const sfx = [];
  scenes.forEach((sc, i) => {
    const start = sceneStarts[i];
    const end = i + 1 < sceneStarts.length ? sceneStarts[i + 1] : duration;
    const words = subtitles.filter((c) => c.scene === i).flatMap((c) => c.words);
    // Kapitel-/Zeit-Label oben
    const label = (sc.label ?? guessLabel(sc.text, i)) || null;
    if (label && i > 0) {
      overlays.push({ type: 'label', start: start + 0.15, end: Math.min(end - 0.1, start + 2.6), text: String(label).toUpperCase().slice(0, 28) });
      sfx.push({ type: 'ding', at: start + 0.15 });
    }
    // B-Roll-Einblendung (große animierte Nahaufnahme), max. eine pro Szene
    const findWord = (key) => {
      const k6 = String(key || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6);
      return k6 && words.find((w) => w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').startsWith(k6));
    };
    let insert = null;
    const given = (Array.isArray(sc.popups) ? sc.popups : []).find((p) => p && INSERT_LIST.includes(p.insert));
    if (given) insert = { id: given.insert, word: given.word || given.label, label: given.label };
    if (!insert) {
      for (const w of words) {
        const key = w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const hit = INSERT_MAP.find(([re]) => re.test(key));
        if (hit) {
          insert = { id: hit[1], word: w.word, label: hit[2] || (hit[1] === 'calendar' ? (sc.label || label || w.word) : w.word) };
          break;
        }
      }
    }
    let insertSpan = null;
    if (insert && end - start > 1.6) {
      const hit = findWord(insert.word);
      let at = hit ? hit.start - 0.15 : start + (end - start) * 0.25;
      at = Math.max(start + 0.25, Math.min(at, end - 1.4));
      const until = Math.min(end - 0.05, at + 2.8);
      let lab = String(insert.label || '').toUpperCase().slice(0, 22);
      if (insert.id === 'calendar') lab = String(sc.label || label || insert.label || '').toUpperCase().slice(0, 22);
      overlays.push({ type: 'insert', insert: insert.id, start: at, end: until, label: lab, slot: i % 2, scene: i });
      insertSpan = [at, until];
      sfx.push({ type: 'whoosh', at: at - 0.05 });
      if (insert.id === 'phone') sfx.push({ type: 'error', at: at + 1.05 });
      if (insert.id === 'power') sfx.push({ type: 'zap', at: at + 0.75 });
      if (insert.id === 'counter') sfx.push({ type: 'ding', at: at + 2.0 });
      if (insert.id === 'internet') sfx.push({ type: 'error', at: at + 1.4 });
    }
    // Pop-ups passend zum Wort
    const pops = (Array.isArray(sc.popups) ? sc.popups : guessPopups(sc.text))
      .filter((p) => p && (p.emoji || p.label) && !(insert && (p.insert === insert.id || String(p.word || '').toLowerCase() === String(insert.word || '').toLowerCase())))
      .slice(0, insert ? 1 : 2);
    pops.forEach((p, k) => {
      const key = String(p.word || p.label || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6);
      const hit = key && words.find((w) => w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').startsWith(key));
      let at = hit ? hit.start - 0.12 : start + ((k + 1) / (pops.length + 1)) * (end - start) * 0.8;
      at = Math.max(start + 0.2, Math.min(at, end - 0.9));
      // nicht gleichzeitig mit der großen Einblendung
      if (insertSpan && at > insertSpan[0] - 0.6 && at < insertSpan[1]) at = insertSpan[1] + 0.05;
      if (at > end - 0.8) return;
      overlays.push({
        type: 'popup',
        start: at,
        end: Math.min(end - 0.05, at + 2.2),
        emoji: String(p.emoji || '✨').slice(0, 4),
        label: String(p.label || '').toUpperCase().slice(0, 18),
        slot: (i + k) % 2,
      });
      sfx.push({ type: 'pop', at });
    });
    // Szenenwechsel + große Ereignisse
    if (i > 0) sfx.push({ type: 'whoosh', at: start - 0.2 });
    const eff = sc.anim?.effect || sc._effect;
    if (['explosion', 'flash', 'quake'].includes(eff)) sfx.push({ type: 'boom', at: start + (end - start) * 0.3 });
  });
  // Pop-ups, die sich überlappen, kürzen
  const pops = overlays.filter((o) => o.type === 'popup').sort((a, b) => a.start - b.start);
  for (let k = 0; k < pops.length - 1; k++) {
    if (pops[k + 1].start < pops[k].end && pops[k + 1].slot === pops[k].slot) pops[k + 1].slot = 1 - pops[k].slot;
    if (pops[k + 1].start < pops[k].end - 0.2 && pops[k + 2] && pops[k + 2].start < pops[k].end) pops[k].end = pops[k + 1].start + 0.4;
  }
  return { overlays, sfx };
}

// ------------------------------------------------------------ Zeichnen ---

const backOut = (k) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawOverlays(g, W, H, t, overlays, font) {
  for (const o of overlays) {
    if (t < o.start || t > o.end) continue;
    const age = t - o.start;
    const left = o.end - t;
    if (o.type === 'popup') drawPopup(g, W, H, o, age, left, font, t);
    if (o.type === 'label') drawLabel(g, W, H, o, age, left, font);
    if (o.type === 'insert') drawInsert(g, W, H, o, t);
    if (o.type === 'follow') drawFollow(g, W, H, o, t, font);
  }
}

function drawPopup(g, W, H, o, age, left, font, t) {
  const inK = clamp(age / 0.45);
  const outK = clamp(left / 0.25);
  const slide = backOut(inK);
  const size = W * 0.3;
  const cx = o.slot ? W * 0.7 : W * 0.3;
  const cy = H * (o.start < 3.6 ? 0.37 : 0.31) + (1 - slide) * H * 0.35 + Math.sin(t * 2 + o.start) * H * 0.004;
  const rot = (o.slot ? 1 : -1) * (0.08 * (1 - slide) + 0.04);
  const scale = 0.7 + 0.3 * slide - (1 - outK) * 0.3;
  g.save();
  g.globalAlpha = Math.min(clamp(inK * 3), outK);
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(scale, scale);
  // Schatten + Karte
  g.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(g, -size / 2 + size * 0.03, -size / 2 + size * 0.05, size, size * 1.12, size * 0.14);
  g.fill();
  g.fillStyle = '#ffffff';
  roundRect(g, -size / 2, -size / 2, size, size * 1.12, size * 0.14);
  g.fill();
  g.strokeStyle = '#8b5cf6';
  g.lineWidth = size * 0.035;
  g.stroke();
  // Emoji
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(size * 0.5)}px ${EMOJI_FONT}`;
  g.fillText(o.emoji, 0, -size * 0.07);
  // Beschriftung
  if (o.label) {
    let fs = size * 0.13;
    g.font = `900 ${Math.round(fs)}px ${font}`;
    while (g.measureText(o.label).width > size * 0.86 && fs > size * 0.07) {
      fs -= 1;
      g.font = `900 ${Math.round(fs)}px ${font}`;
    }
    g.fillStyle = '#1a1033';
    g.fillText(o.label, 0, size * 0.4);
  }
  g.restore();
}

function drawLabel(g, W, H, o, age, left, font) {
  const inK = clamp(age / 0.35);
  const outK = clamp(left / 0.3);
  const fs = Math.round(W * 0.045);
  g.save();
  g.font = `900 ${fs}px ${font}`;
  const chars = Math.ceil(o.text.length * clamp(age / 0.5));
  const shown = o.text.slice(0, chars);
  const full = g.measureText(o.text).width;
  const w = full + fs * 2.4;
  const h = fs * 2;
  const x = W / 2 - w / 2;
  const y = H * 0.09 - (1 - backOut(inK)) * H * 0.08;
  g.globalAlpha = outK * clamp(inK * 2);
  g.fillStyle = 'rgba(20,10,35,0.82)';
  roundRect(g, x, y, w, h, h / 2);
  g.fill();
  g.fillStyle = '#8b5cf6';
  g.beginPath();
  g.arc(x + h * 0.55, y + h / 2, fs * 0.28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(shown, x + fs * 1.5, y + h / 2 + fs * 0.04);
  g.restore();
}

// ------------------------------------------------------ Soundeffekte ---

export function scheduleSfx(ctx, out, list, t0) {
  let noise = null;
  const getNoise = () => {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  };
  const nodes = [];
  for (const s of list) {
    const at = t0 + Math.max(0, s.at);
    if (s.type === 'pop') {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(950, at);
      o.frequency.exponentialRampToValueAtTime(320, at + 0.12);
      gn.gain.setValueAtTime(0.0001, at);
      gn.gain.exponentialRampToValueAtTime(0.16, at + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.connect(gn).connect(out);
      o.start(at);
      o.stop(at + 0.2);
      nodes.push(o);
    } else if (s.type === 'error') {
      [[660, 0], [440, 0.14]].forEach(([f, d]) => {
        const o = ctx.createOscillator();
        const gn = ctx.createGain();
        o.type = 'square';
        o.frequency.value = f;
        gn.gain.setValueAtTime(0.0001, at + d);
        gn.gain.exponentialRampToValueAtTime(0.06, at + d + 0.01);
        gn.gain.exponentialRampToValueAtTime(0.0001, at + d + 0.13);
        o.connect(gn).connect(out);
        o.start(at + d);
        o.stop(at + d + 0.15);
        nodes.push(o);
      });
    } else if (s.type === 'zap') {
      const src = ctx.createBufferSource();
      src.buffer = getNoise();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const gn = ctx.createGain();
      for (let k = 0; k < 6; k++) {
        gn.gain.setValueAtTime(k % 2 ? 0.02 : 0.25, at + k * 0.04);
      }
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      src.connect(hp).connect(gn).connect(out);
      src.start(at);
      src.stop(at + 0.55);
      nodes.push(src);
    } else if (s.type === 'ding') {
      for (const [f, v] of [[1320, 0.05], [1980, 0.03]]) {
        const o = ctx.createOscillator();
        const gn = ctx.createGain();
        o.frequency.value = f;
        gn.gain.setValueAtTime(0.0001, at);
        gn.gain.exponentialRampToValueAtTime(v, at + 0.01);
        gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.6);
        o.connect(gn).connect(out);
        o.start(at);
        o.stop(at + 0.65);
        nodes.push(o);
      }
    } else if (s.type === 'whoosh') {
      const src = ctx.createBufferSource();
      src.buffer = getNoise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.4;
      bp.frequency.setValueAtTime(250, at);
      bp.frequency.exponentialRampToValueAtTime(3500, at + 0.35);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0.0001, at);
      gn.gain.exponentialRampToValueAtTime(0.14, at + 0.2);
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
      src.connect(bp).connect(gn).connect(out);
      src.start(at);
      src.stop(at + 0.5);
      nodes.push(src);
    } else if (s.type === 'boom') {
      const o = ctx.createOscillator();
      const gn = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, at);
      o.frequency.exponentialRampToValueAtTime(35, at + 1);
      gn.gain.setValueAtTime(0.0001, at);
      gn.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
      o.connect(gn).connect(out);
      o.start(at);
      o.stop(at + 1.5);
      const src = ctx.createBufferSource();
      src.buffer = getNoise();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.35, at);
      ng.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
      src.connect(lp).connect(ng).connect(out);
      src.start(at);
      src.stop(at + 1);
      nodes.push(o, src);
    }
  }
  return () => nodes.forEach((n) => {
    try {
      n.stop();
    } catch {
      /* schon gestoppt */
    }
  });
}

// ----------------------------------------------------- Folgen-Pop-up ---
// Karte mit Profilbild + Name, ein Finger tippt auf "Folgen" → "Gefolgt ✓".

export const FOLLOW_DURATION = 3.0;
const TAP_AT = 1.35;

export function addFollowOverlay(overlays, sfx, follow, duration) {
  if (!follow || duration < 8) return;
  const target = Math.max(3.8, Math.min(duration * (follow.at || 0.2), duration - FOLLOW_DURATION - 1));
  // Zeitpunkt leicht verschieben, damit keine B-Roll-Einblendung verdeckt wird
  const hitsInsert = (st) => overlays.some((o) => o.type === 'insert' && o.start < st + FOLLOW_DURATION + 0.2 && o.end > st - 0.2);
  let start = target;
  for (const d of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, -0.5, -1, -1.5, -2, -3]) {
    const st = target + d;
    if (st < 3.5 || st > duration - FOLLOW_DURATION - 0.5) continue;
    if (!hitsInsert(st)) {
      start = st;
      break;
    }
  }
  const end = start + FOLLOW_DURATION;
  // Emoji-Karten in dieser Zeit weglassen (sonst zu unruhig)
  for (let k = overlays.length - 1; k >= 0; k--) {
    const o = overlays[k];
    // nur kleine Emoji-Karten weglassen; große B-Roll-Einblendungen (oben) bleiben sichtbar
    if (o.type === 'popup' && o.start < end + 0.2 && o.end > start - 0.2) overlays.splice(k, 1);
  }
  overlays.push({ type: 'follow', start, end, follow });
  sfx.push({ type: 'whoosh', at: start - 0.05 }, { type: 'pop', at: start + TAP_AT }, { type: 'ding', at: start + TAP_AT + 0.08 });
}

export function drawFollow(g, W, H, o, t, font) {
  const a = t - o.start;
  const left = o.end - t;
  const inK = clamp(a / 0.5);
  const outK = clamp(left / 0.35);
  const f = o.follow;
  const cw = W * 0.86;
  const ch = W * 0.24;
  const cx = W / 2;
  const cy = H * 0.575 + (1 - backOut(inK)) * H * 0.5 + (1 - outK) * H * 0.5;
  const followed = a >= TAP_AT;
  g.save();
  g.translate(cx, cy);
  const sc = 0.9 + 0.1 * inK;
  g.scale(sc, sc);
  // Karte
  g.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(g, -cw / 2 + W * 0.01, -ch / 2 + W * 0.018, cw, ch, ch * 0.28);
  g.fill();
  g.fillStyle = 'rgba(22,20,30,0.94)';
  roundRect(g, -cw / 2, -ch / 2, cw, ch, ch * 0.28);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = W * 0.004;
  g.stroke();
  // Profilbild
  const r = ch * 0.34;
  const ax = -cw / 2 + ch * 0.5;
  g.save();
  g.beginPath();
  g.arc(ax, 0, r, 0, Math.PI * 2);
  g.clip();
  if (f.img) {
    g.drawImage(f.img, ax - r, -r, r * 2, r * 2);
  } else {
    const gr = g.createLinearGradient(ax - r, -r, ax + r, r);
    gr.addColorStop(0, '#7c3aed');
    gr.addColorStop(1, '#ff3d7f');
    g.fillStyle = gr;
    g.fillRect(ax - r, -r, r * 2, r * 2);
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(r * 0.9)}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?!', ax, r * 0.05);
  }
  g.restore();
  g.strokeStyle = '#ffffff';
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.arc(ax, 0, r, 0, Math.PI * 2);
  g.stroke();
  // kleines Plus am Profilbild (verschwindet nach dem Folgen)
  if (!followed) {
    g.fillStyle = '#fe2c55';
    g.beginPath();
    g.arc(ax, r * 0.95, r * 0.28, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.fillRect(ax - r * 0.14, r * 0.95 - r * 0.035, r * 0.28, r * 0.07);
    g.fillRect(ax - r * 0.035, r * 0.95 - r * 0.14, r * 0.07, r * 0.28);
  }
  // Name + Zeile darunter
  const tx = ax + r * 1.45;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  const name = (f.name || '').trim() || 'Folge für mehr!';
  let fs = ch * 0.2;
  g.font = `900 ${Math.round(fs)}px ${font}`;
  const maxNameW = cw * 0.4;
  while (g.measureText(name).width > maxNameW && fs > ch * 0.12) {
    fs -= 1;
    g.font = `900 ${Math.round(fs)}px ${font}`;
  }
  g.fillText(name, tx, -ch * 0.12);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  const sub = f.name ? 'Folge für mehr Videos' : 'Neue Videos jede Woche';
  let sf = ch * 0.13;
  g.font = `700 ${Math.round(sf)}px system-ui, sans-serif`;
  while (g.measureText(sub).width > maxNameW && sf > ch * 0.08) {
    sf -= 1;
    g.font = `700 ${Math.round(sf)}px system-ui, sans-serif`;
  }
  g.fillText(sub, tx, ch * 0.16);
  // Button
  const bw = cw * 0.3;
  const bh = ch * 0.42;
  const bx = cw / 2 - bw - ch * 0.18;
  const press = a > TAP_AT - 0.08 && a < TAP_AT + 0.12 ? 0.9 : 1;
  const popK = followed ? clamp((a - TAP_AT) / 0.25) : 0;
  const bScale = press * (followed ? 1 + Math.sin(popK * Math.PI) * 0.12 : 1);
  g.save();
  g.translate(bx + bw / 2, 0);
  g.scale(bScale, bScale);
  g.fillStyle = followed ? '#3a3a46' : '#fe2c55';
  roundRect(g, -bw / 2, -bh / 2, bw, bh, bh * 0.22);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  let bf = bh * 0.42;
  const label = followed ? (f.button === 'Abonnieren' ? 'Abonniert ✓' : 'Gefolgt ✓') : f.button || 'Folgen';
  g.font = `900 ${Math.round(bf)}px ${font}`;
  while (g.measureText(label).width > bw * 0.86 && bf > bh * 0.25) {
    bf -= 1;
    g.font = `900 ${Math.round(bf)}px ${font}`;
  }
  g.fillText(label, 0, bh * 0.02);
  g.restore();
  // Herzchen-Burst beim Folgen
  if (followed && a - TAP_AT < 0.9) {
    const k = (a - TAP_AT) / 0.9;
    for (let i = 0; i < 8; i++) {
      const ang = -Math.PI / 2 + (i - 3.5) * 0.35;
      const d = ch * (0.3 + k * 0.9);
      g.globalAlpha = 1 - k;
      g.fillStyle = i % 2 ? '#fe2c55' : '#ffffff';
      g.font = `${Math.round(ch * 0.18)}px ${EMOJI_FONT}`;
      g.textAlign = 'center';
      g.fillText(i % 2 ? '❤️' : '✨', bx + bw / 2 + Math.cos(ang) * d, Math.sin(ang) * d);
    }
    g.globalAlpha = 1;
  }
  // Finger, der tippt
  const fin = clamp((a - 0.7) / 0.5);
  const away = clamp((a - TAP_AT - 0.35) / 0.4);
  if (fin > 0 && away < 1) {
    const fx = bx + bw * 0.6 + (1 - fin) * cw * 0.25 + away * cw * 0.2;
    const fy = bh * 0.55 + (1 - fin) * ch * 0.9 + away * ch * 0.8;
    const tap = a > TAP_AT - 0.1 && a < TAP_AT + 0.1 ? 0.85 : 1;
    g.save();
    g.globalAlpha = 1 - away;
    g.translate(fx, fy);
    g.scale(tap, tap);
    g.font = `${Math.round(ch * 0.55)}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.fillText('👆', 0, 0);
    if (Math.abs(a - TAP_AT) < 0.25) {
      g.strokeStyle = `rgba(255,255,255,${1 - Math.abs(a - TAP_AT) / 0.25})`;
      g.lineWidth = W * 0.005;
      g.beginPath();
      g.arc(-ch * 0.05, 0, ch * (0.1 + (a - TAP_AT + 0.25) * 0.4), 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }
  g.restore();
}
