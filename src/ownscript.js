// Eigenes Skript: Text einfügen → Szenen.
// Überschriften ("😨 Teil 2 – …"), Tipps und Regieanweisungen werden erkannt
// und NICHT vorgelesen. "(mit Pause und schwarzem Bildschirm)" wird umgesetzt.

import { geminiFetch, fetchWithTimeout } from './util.js';
import { ANIM_PROMPT_HELP, SHOT_PROMPT_HELP, SHOT_LIST } from './anim/scene.js';
import { parseJson, normalizeTopic } from './script.js';

const EMOJI_START = /^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s￼]+/u;
const HEADER_WORDS = /^(teil\s*\d+|einstieg|intro|hook|ende|outro|schluss|finale|akt\s*\d+|kapitel\s*\d+|szene\s*\d+)\b/i;

function stripEmoji(line) {
  return line
    .replace(EMOJI_START, '')
    .replace(/[\u{FFFC}]/gu, '')
    .trim()
    // Aufzählungszeichen am Zeilenanfang entfernen: "* ", "- ", "• ", "1. ", "1) "
    .replace(/^(?:[*•·▪►\-–—]+|\d{1,2}[.)])\s+/u, '')
    .replace(/^\*\*(.*)\*\*$/, '$1')
    .trim();
}

/**
 * Zerlegt einen eingefügten Text in Szenen.
 * Ergebnis: { title, scenes: [{ text, pauseBefore?, black?, transition? }] }
 */
export function parseOwnScript(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n');
  let title = '';
  const items = []; // { text } oder { header } oder { direction }
  for (const original of lines) {
    const hadEmoji = EMOJI_START.test(original.trim()) && /\p{Extended_Pictographic}/u.test(original);
    const line = stripEmoji(original.trim());
    if (!line) continue;
    // Tipps/Hinweise am Ende weglassen
    if (/^(mein\s+)?tipp\b|^hinweis\b|^tipp für/i.test(line)) continue;
    // Titel: erste Zeile in Großbuchstaben oder mit 🎬
    if (!title && !items.length && (/🎬|🧟/u.test(original) || (line === line.toUpperCase() && /WAS W|^TAG\s*\d/i.test(line)))) {
      title = line;
      continue;
    }
    // Regieanweisung: "Letzter Satz (mit Pause und schwarzem Bildschirm):"
    if (/\(.*\)\s*:?\s*$/.test(line) && line.length < 90 && /pause|schwarz|bildschirm|musik|leise|langsam|stille/i.test(line)) {
      items.push({ direction: line.toLowerCase() });
      continue;
    }
    // Überschrift: "😨 Teil 2 – Du realisierst es langsam:" oder kurze Zeile mit Doppelpunkt am Ende
    if ((hadEmoji && /[:–—-]/.test(line) && line.length < 70) || HEADER_WORDS.test(line) || (/:\s*$/.test(line) && line.split(' ').length <= 8)) {
      items.push({ header: line });
      continue;
    }
    items.push({ text: line });
  }

  // Zeilen zu Szenen gruppieren (ca. 8–22 Wörter, Bruch an Überschriften/Anweisungen)
  const scenes = [];
  let cur = [];
  let pending = { pauseBefore: 0, black: false, transition: null };
  const words = (arr) => arr.join(' ').split(/\s+/).filter(Boolean).length;
  const flush = () => {
    if (!cur.length) return;
    scenes.push({ text: cur.join(' ').replace(/\s+/g, ' ').trim(), ...cleanPending(pending) });
    cur = [];
    pending = { pauseBefore: 0, black: false, transition: null };
  };
  for (const it of items) {
    if (it.header) {
      flush();
      pending.transition = 'cut';
      continue;
    }
    if (it.direction) {
      flush();
      if (/pause/.test(it.direction)) pending.pauseBefore = Math.max(pending.pauseBefore, (it.direction.match(/(\d+)\s*sek/)?.[1] | 0) || 2);
      if (/schwarz/.test(it.direction)) pending.black = true;
      pending.transition = 'fade';
      continue;
    }
    // Eine Zeile = eine Einstellung (wie im Film). Zeilen, die mitten im Satz
    // weitergehen (kleiner Anfangsbuchstabe), werden angehängt.
    const continues = cur.length && (/^[a-zäöü]/.test(it.text) || !/[.!?…"“”:]$/.test(cur[cur.length - 1]));
    if (cur.length && !continues) flush();
    cur.push(it.text);
    if (words(cur) > 24) flush();
  }
  flush();
  // Schwarzbild-Szene: alles danach gehört dazu (keine weiteren Szenen nötig)
  return { title: title || '', scenes };
}

function cleanPending(p) {
  const o = {};
  if (p.pauseBefore) o.pauseBefore = p.pauseBefore;
  if (p.black) o.black = true;
  if (p.transition) o.transition = p.transition;
  return o;
}

/**
 * Lässt Gemini die (unveränderten) Szenen mit Animationen/Einblendungen versehen.
 */
export async function annotateWithGemini(scenes, topic, key) {
  const prompt = `Du bist Cutter für animierte TikTok-Videos. Hier ist ein fertiges Skript, bereits in ${scenes.length} Szenen aufgeteilt.
ÄNDERE DEN TEXT NICHT. Gib für JEDE Szene (gleiche Reihenfolge, gleiche Anzahl) nur die Visualisierung zurück.
Die Hauptfigur ist "du". Zeige genau, was der Text beschreibt, und wechsle Orte und Aktionen ab.

Pro Szene:
- ${SHOT_PROMPT_HELP}
- "anim": nur wenn "shot" null ist: ${ANIM_PROMPT_HELP}
- "popups": SPARSAM, im ganzen Video höchstens 4–5 Einblendungen (sonst []). {"emoji","label","word" (Wort aus dem Text), optional "insert": phone|clock|calendar|animals|burger|stars|plant|water|counter, oder "strike": true für Dinge, die wegfallen (keine Nachrichten, kein Netz, keine Autos …)}
- "thought": optional kurzer Gedanke/Ruf der Figur (2–5 Wörter, z. B. "HALLO?!") oder null – in höchstens 3 Szenen
- "label": optional Zeit-Einblendung wie "NACH 1 WOCHE" oder null

Thema: ${topic}
Szenen:
${scenes.map((s, i) => `${i + 1}. ${s.text}`).join('\n')}

Antworte NUR mit JSON: {"scenes":[{"shot":"look_window","anim":null,"popups":[],"thought":null,"label":null}]}`;
  const res = await geminiFetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    key,
    {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
      },
    90000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const out = parseJson(text)?.scenes;
  if (!Array.isArray(out) || out.length !== scenes.length) throw new Error('Szenenanzahl passt nicht');
  return scenes.map((s, i) => ({
    ...s,
    shot: s.black ? null : SHOT_LIST.includes(out[i]?.shot) ? out[i].shot : null,
    anim: s.black ? null : out[i]?.anim || null,
    popups: Array.isArray(out[i]?.popups) ? out[i].popups.slice(0, 2) : [],
    thought: typeof out[i]?.thought === 'string' ? out[i].thought.slice(0, 40) : null,
    label: typeof out[i]?.label === 'string' ? out[i].label : null,
  }));
}

/**
 * Komplettes eigenes Skript → Skript-Objekt für die App.
 */
export async function buildOwnScript(raw, settings, log) {
  const parsed = parseOwnScript(raw);
  if (!parsed.scenes.length) throw new Error('Im Text wurden keine Sätze gefunden.');
  const topic = normalizeTopic(parsed.title || parsed.scenes[0].text.split(/[.?!…]/)[0]);
  let scenes = parsed.scenes.map((s) => ({ ...s, image_prompt: `cinematic scene: ${s.text}`, popups: null }));
  // Gedanken/Rufe in Anführungszeichen automatisch als Sprechblase
  scenes.forEach((s) => {
    const q = s.text.match(/[„"“]([^“”"]{2,30})[“”"]/);
    if (q && !s.black) s.thought = q[1];
  });
  if (settings.geminiKey) {
    try {
      log('Gemini plant die Szenen zu deinem Skript …');
      scenes = await annotateWithGemini(scenes, topic, settings.geminiKey);
    } catch (e) {
      log(`Gemini-Planung nicht möglich (${e.message}) – Szenen werden automatisch erraten.`, 'warn');
    }
  }
  const title = parsed.title ? normalizeTopic(parsed.title.replace(/^.*?(was w)/i, '$1')) : topic;
  return { title, topic, scenes, hashtags: ['#waswärewenn', '#gedankenexperiment', '#fyp'], own: true };
}
