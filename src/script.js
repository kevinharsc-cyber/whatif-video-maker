// Erstellt das deutsche Video-Skript.
// Reihenfolge: 1) Google Gemini (falls Schlüssel eingetragen, kostenlos)
//              2) Pollinations.ai (kostenlos, ohne Anmeldung)
//              3) Eingebaute Vorlage (funktioniert immer, auch offline)

import { fetchWithTimeout } from './util.js';
import { ANIM_PROMPT_HELP, SHOT_PROMPT_HELP, SHOT_LIST } from './anim/scene.js';

const SYSTEM = `Du bist Autor und Cutter für virale deutschsprachige TikTok- und YouTube-Shorts im Format "Was wäre, wenn …?" – im Stil hochwertiger YouTube-Dokumentationen mit cinematic Storytelling.
Schreibe ein fesselndes, detailliertes und plausibles Skript für ein ca. 60 Sekunden langes Hochformat-Video.

Storytelling-Regeln (sehr wichtig – erzähle eine Geschichte, die man MITERLEBT, keine Faktenliste):
- Sprache: Deutsch, Du-Perspektive, Präsens, kurze Sätze, viele Pausen (…), bildhaft und emotional.
- 170 bis 200 Wörter, aufgeteilt in 16 bis 22 Szenen. JEDE Szene ist GENAU EIN kurzer Satz – wie Einstellungen in einem Film.
- Bild und Text müssen exakt zusammenpassen: Was gesagt wird, sieht man in genau diesem Moment.
- Aufbau in 5 Teilen:
  1. EINSTIEG (Spannung sofort): "Was wäre, wenn …" + 3–4 ganz kurze Schlag-Sätze ("Keine Nachrichten. Keine Anrufe. …").
  2. DU REALISIERST ES LANGSAM: konkrete Alltagsmomente mit Sinneseindrücken (Handy, Fenster, Straße, Geräusche, Stille).
  3. DIE WENDUNG / DIE WELT GEHÖRT DIR (oder die Lage eskaliert): mehrere konkrete, coole Aktionen.
  4. PSYCHOLOGISCHER TWIST: Zeitsprünge ("Nach ein paar Tagen …", "Nach einer Woche …", "Nach einem Monat …"), es kippt emotional.
  5. GÄNSEHAUT-ENDE: ruhige, tiefe Sätze + ein letzter überraschender Gedanke als Frage. Diese letzte Szene bekommt "black": true und "pauseBefore": 2.
- Die vorletzte Szene endet mit einer Frage an die Zuschauer oder die letzte Szene ist die Frage.
- Keine Emojis, Hashtags oder Regieanweisungen im gesprochenen Text.
- "transition": "cut" bei Ortswechseln/neuen Teilen, "fade" vor emotionalen Momenten, sonst weglassen.
- "thought": in 2–3 Szenen ein kurzer Gedanke oder Ruf der Figur (2–5 Wörter, z. B. "HALLO?!", "Wo sind alle?"), sonst null.

Pro Szene zusätzlich:
- "image_prompt": detaillierte ENGLISCHE Bildbeschreibung (Motiv, Umgebung, Licht, Stimmung), ohne Text im Bild.
- "popups": SPARSAM! Im ganzen Video höchstens 4–5 Einblendungen, viele Szenen ohne (leere Liste []). Format: Einblendungen für Dinge, die im Satz genannt werden: {"emoji": ein passendes Emoji, "label": 1–2 Wörter, "word": das Wort aus dem Text, bei dem es erscheinen soll, "insert": optional eine große animierte Nahaufnahme aus: phone (Handy ohne Netz), power (Stromausfall), internet (offline), clock (Zeit rast), calendar (Tage zählen, label z. B. "TAG 3"), animals (Wildtiere), burger (Essen/Burgerladen), stars (Sternenhimmel), plant (Gemüse anbauen), water (Wasser), counter (Menschen-Zähler)}.
  Nutze "insert" für 2–3 besondere Momente. Für Dinge, die WEGFALLEN (kein Strom, kein Netz, kein Internet, kein Licht), setze stattdessen "strike": true – dann erscheint nur ein Symbol mit rotem X.
  Beispiel: Satz erwähnt einen Burgerladen → {"emoji":"🍔","label":"Burgerladen","word":"Burgerladen","insert":"burger"}.
  Wenn das Handy vorkommt, nutze in "anim" die Aktion "phone" (Figur schaut aufs Handy) und insert "phone".
- "label": optionale kurze Zeit-/Kapitel-Einblendung wie "07:00 UHR", "TAG 3", "NACH 2 WOCHEN" (oder null).
- ${SHOT_PROMPT_HELP}
- "anim": nur wenn "shot" null ist – die Animation der Szene. Die Hauptfigur ist "du". Zeige genau, was der Satz beschreibt, und wechsle Orte, Aktionen und Effekte ab.
${ANIM_PROMPT_HELP}

Antworte NUR mit gültigem JSON in genau diesem Format:
{"title":"kurzer Videotitel","scenes":[{"text":"gesprochener deutscher Text","image_prompt":"english image description","popups":[{"emoji":"🍔","label":"Burgerladen","word":"Burgerladen"}],"label":null,"thought":null,"transition":null,"shot":"wake_up","anim":{"place":"...","time":"day","props":[],"actors":[{"action":"..."}],"crowd":{"count":0,"action":"idle"},"effect":"none"}}],"hashtags":["#wasware", "..."]}`;

export async function generateScript(topic, settings, log) {
  const t = normalizeTopic(topic);
  if (settings.geminiKey) {
    try {
      log('Skript wird mit Google Gemini geschrieben …');
      return validate(await viaGemini(t, settings.geminiKey), t);
    } catch (e) {
      log(`Gemini nicht erreichbar (${e.message}). Versuche kostenlose Alternative …`, 'warn');
    }
  }
  try {
    log('Skript wird mit Pollinations.ai geschrieben (kostenlos) …');
    return validate(await viaPollinations(t, settings.pollinationsKey), t);
  } catch (e) {
    log(`Pollinations nicht erreichbar (${e.message}). Nutze eingebaute Vorlage.`, 'warn');
  }
  return templateScript(t);
}

export function normalizeTopic(topic) {
  let t = topic.trim().replace(/\s+/g, ' ');
  if (!t) t = 'Was wäre, wenn die Erde plötzlich stehen bleibt?';
  if (!/^was w(ä|ae)re/i.test(t)) t = `Was wäre, wenn ${t.replace(/^[a-zäöü]/, (c) => c.toLowerCase())}`;
  if (!/[?!.]$/.test(t)) t += '?';
  return t;
}

async function viaGemini(topic, key) {
  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `Thema: ${topic}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
      }),
    },
    60000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return parseJson(text);
}

async function viaPollinations(topic, key) {
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetchWithTimeout(
    key ? 'https://gen.pollinations.ai/v1/chat/completions' : 'https://text.pollinations.ai/openai',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'openai',
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Thema: ${topic}` },
        ],
        response_format: { type: 'json_object' },
        seed: Math.floor(Math.random() * 1e6),
      }),
    },
    90000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  let content = raw;
  try {
    const j = JSON.parse(raw);
    content = j?.choices?.[0]?.message?.content ?? raw;
  } catch {
    /* Antwort war bereits reiner Text */
  }
  return parseJson(content);
}

export function parseJson(text) {
  const cleaned = String(text).replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Antwort enthielt kein JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validate(obj, topic) {
  const scenes = (obj?.scenes || [])
    .map((s) => ({
      text: String(s.text || s.narration || '').trim(),
      image_prompt: String(s.image_prompt || s.imagePrompt || s.image || '').trim(),
      anim: s.anim && typeof s.anim === 'object' ? s.anim : null,
      popups: Array.isArray(s.popups) ? s.popups.slice(0, 3) : null,
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : null,
      thought: typeof s.thought === 'string' && s.thought.trim() ? s.thought.trim().slice(0, 40) : null,
      transition: ['cut', 'fade', 'whip', 'zoom', 'slide', 'flash'].includes(s.transition) ? s.transition : null,
      black: s.black === true,
      shot: SHOT_LIST.includes(s.shot) ? s.shot : null,
      pauseBefore: Number(s.pauseBefore) > 0 ? Math.min(4, Number(s.pauseBefore)) : 0,
    }))
    .filter((s) => s.text.length > 0);
  if (scenes.length < 3) throw new Error('Skript zu kurz');
  scenes.forEach((s) => {
    if (!s.image_prompt) s.image_prompt = `dramatic cinematic scene illustrating: ${s.text}`;
  });
  return {
    title: String(obj.title || topic).trim(),
    topic,
    scenes,
    hashtags: Array.isArray(obj.hashtags) ? obj.hashtags.slice(0, 8) : ['#waswärewenn', '#wissen', '#fyp'],
  };
}

// Notfall-Vorlage: liefert ein solides Skript, falls keine KI erreichbar ist.
function templateScript(topic) {
  const core = topic.replace(/^was w(ä|ae)re,? wenn\s*/i, '').replace(/[?!.]+$/, '');
  const scenes = [
    [`${topic} Klingt verrückt? Die Folgen wären gewaltiger, als du denkst.`, 'dramatic establishing shot of planet earth from space, cinematic lighting, sense of danger'],
    [`Stell dir vor: Du wachst morgens auf, und plötzlich ist es so weit. ${core}.`, 'person waking up in a bedroom at dawn looking out the window in shock, cinematic'],
    ['In den ersten Minuten merken die meisten Menschen noch gar nichts. Doch Wissenschaftler schlagen sofort Alarm.', 'scientists in a high tech control room with red alarm lights, monitors with graphs'],
    ['Nach wenigen Stunden beginnt die Kettenreaktion. Stromnetze, Verkehr und Kommunikation geraten ins Wanken.', 'city at night with power outage, chaotic traffic, dramatic sky'],
    ['Die Natur reagiert als Erstes. Tiere verhalten sich seltsam, das Wetter spielt verrückt.', 'flock of birds over a stormy landscape, lightning, epic nature'],
    ['Nach einigen Tagen müsste sich die gesamte Menschheit anpassen. Neue Regeln, neue Technik, ein völlig neues Leben.', 'futuristic survival shelter with people working together, warm light'],
    ['Und langfristig? Die Erde würde sich für immer verändern. Manche Regionen würden aufblühen, andere unbewohnbar werden.', 'split view of a lush green valley and a barren desert, surreal, cinematic'],
    ['Zum Glück ist das nur ein Gedankenexperiment. Was glaubst du: Hättest du überlebt? Schreib es in die Kommentare und folge für mehr.', 'silhouette of a lone person standing on a hill under a starry sky, hopeful mood'],
  ];
  return {
    title: topic,
    topic,
    scenes: scenes.map(([text, image_prompt]) => ({ text, image_prompt })),
    hashtags: ['#waswärewenn', '#wissen', '#gedankenexperiment', '#fyp'],
    template: true,
  };
}
