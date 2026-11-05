// Motion Graphics: Pop-up-Karten, Kapitel-Labels und Soundeffekt-Zeitpunkte.
// Pop-ups sliden passend zum gesprochenen Wort von unten ins Bild.

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
    // Pop-ups passend zum Wort
    const pops = (Array.isArray(sc.popups) ? sc.popups : guessPopups(sc.text)).filter((p) => p && (p.emoji || p.label)).slice(0, 3);
    pops.forEach((p, k) => {
      const key = String(p.word || p.label || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 6);
      const hit = key && words.find((w) => w.word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').startsWith(key));
      let at = hit ? hit.start - 0.12 : start + ((k + 1) / (pops.length + 1)) * (end - start) * 0.8;
      at = Math.max(start + 0.2, Math.min(at, end - 0.9));
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
