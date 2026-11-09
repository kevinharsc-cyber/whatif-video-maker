// Deutsche KI-Sprachausgabe.
//
// Variante A (Standard, komplett kostenlos): "Piper" – eine neuronale Stimme,
//   die direkt im Browser auf deinem iPhone läuft. Beim ersten Mal wird das
//   Stimmmodell (ca. 20–75 MB) von Hugging Face geladen und danach im
//   Browser-Speicher behalten.
// Variante B (optional, kostenloses Kontingent): Google Gemini TTS – sehr
//   natürliche Stimme, braucht deinen Gemini-API-Schlüssel.

import { geminiFetch, fetchWithTimeout, base64ToBytes, sleep } from './util.js';
import { createPiperPhonemize } from './vendor/piper-phonemize.js';

export const VOICES = [
  { id: 'piper:de_DE-thorsten-medium', label: 'Thorsten (männlich, kostenlos, empfohlen)' },
  { id: 'piper:de_DE-thorsten-high', label: 'Thorsten HD (männlich, kostenlos, größer)' },
  { id: 'piper:de_DE-kerstin-low', label: 'Kerstin (weiblich, kostenlos)' },
  { id: 'piper:de_DE-ramona-low', label: 'Ramona (weiblich, kostenlos)' },
  { id: 'piper:de_DE-eva_k-x_low', label: 'Eva (weiblich, kostenlos, klein)' },
  { id: 'gemini:Achird', label: 'Gemini „Achird“ (männlich, freundlich – empfohlen für SV Kieselbach)' },
  { id: 'gemini:Umbriel', label: 'Gemini „Umbriel“ (männlich, locker & entspannt)' },
  { id: 'gemini:Iapetus', label: 'Gemini „Iapetus“ (männlich, klar & ruhig)' },
  { id: 'gemini:Puck', label: 'Gemini „Puck“ (männlich, aufgedreht – BAM! empfohlen für Zombie)' },
  { id: 'gemini:Sadachbia', label: 'Gemini „Sadachbia“ (männlich, lebhaft)' },
  { id: 'gemini:Charon', label: 'Gemini „Charon“ (männlich, ruhiger Erzähler, braucht Schlüssel)' },
  { id: 'gemini:Fenrir', label: 'Gemini „Fenrir“ (männlich, aufgeregt & kräftig – BAM!)' },
  { id: 'gemini:Kore', label: 'Gemini „Kore“ (weiblich, braucht Schlüssel)' },
  { id: 'gemini:Aoede', label: 'Gemini „Aoede“ (weiblich, braucht Schlüssel)' },
];

// Offizielle Quelle + Spiegelserver als Ersatz
const HF_BASES = [
  'https://huggingface.co/rhasspy/piper-voices/resolve/main',
  'https://huggingface.co/diffusionstudio/piper-voices/resolve/main',
];
const PIPER_PATHS = {
  'de_DE-thorsten-medium': 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx',
  'de_DE-thorsten-high': 'de/de_DE/thorsten/high/de_DE-thorsten-high.onnx',
  'de_DE-kerstin-low': 'de/de_DE/kerstin/low/de_DE-kerstin-low.onnx',
  'de_DE-ramona-low': 'de/de_DE/ramona/low/de_DE-ramona-low.onnx',
  'de_DE-eva_k-x_low': 'de/de_DE/eva_k/x_low/de_DE-eva_k-x_low.onnx',
};
const CACHE_NAME = 'whatif-voices-v1';
const SCENE_GAP = 0.22; // Pause zwischen Szenen in Sekunden

/**
 * Erzeugt die Sprachspur für alle Szenen.
 * Ergebnis: { buffer: AudioBuffer, sceneTimes: [{start, end}] }
 */
/** Verständliche Erklärung, warum Gemini nicht ging */
export function explainGeminiError(msg) {
  const m = String(msg || '');
  if (/\b429\b|quota|RESOURCE_EXHAUSTED|rate/i.test(m)) return 'Tageskontingent von Google aufgebraucht (Gratis-Tarif). Morgen geht es wieder – oder in Google AI Studio die Abrechnung aktivieren.';
  if (/\b40[013]\b|api key|permission|unauth/i.test(m)) return 'Gemini-Schlüssel ungültig oder ohne Berechtigung.';
  if (/\b404\b|not found/i.test(m)) return 'Google hat das Stimm-Modell geändert (404).';
  if (/fetch|network|Zeitüberschreitung|timeout/i.test(m)) return 'Keine Verbindung zu Google.';
  return m.slice(0, 120);
}

export async function synthesize(ctx, scenes, settings, onProgress, log) {
  const [kind, name] = settings.voice.split(':');
  const piperName = { 'de_DE-thorsten-medium': 'Thorsten (kostenlos)', 'de_DE-thorsten-high': 'Thorsten HD (kostenlos)' };
  const withInfo = async (p, used, why = null) => Object.assign(await p, { used, why });
  if (kind === 'gemini') {
    let why = null;
    if (!settings.geminiKey) {
      why = 'kein Gemini-Schlüssel eingetragen';
      log('Für Gemini-Stimmen fehlt der API-Schlüssel – nutze kostenlose Piper-Stimme.', 'warn');
    } else {
      try {
        return await withInfo(geminiTTS(ctx, scenes, settings, name, onProgress), `Gemini „${name}“`);
      } catch (e) {
        why = explainGeminiError(e.message);
        log(`Gemini-Stimme „${name}“ nicht möglich: ${why} – nutze kostenlose Piper-Stimme.`, 'warn');
      }
    }
    return withInfo(piperTTS(ctx, scenes, settings, 'de_DE-thorsten-medium', onProgress, log), 'Thorsten (kostenlose Ersatzstimme)', why);
  }
  // Lange Skripte + Gemini-Schlüssel: Gemini-Stimme nehmen. Die kostenlose Piper-
  // Stimme läuft auf dem iPhone und braucht dort sehr viel Arbeitsspeicher.
  if (settings.geminiKey && scenes.length > 12 && settings.autoGeminiVoice !== false) {
    const auto = ['zombie', 'resort'].includes(settings.visualMode) ? 'Puck' : settings.visualMode === 'verein' ? 'Achird' : 'Charon';
    try {
      log(`Langes Skript: nutze die Gemini-Stimme „${auto}“ (braucht auf dem iPhone kaum Speicher) …`);
      return await withInfo(geminiTTS(ctx, scenes, settings, auto, onProgress), `Gemini „${auto}“`);
    } catch (e) {
      log(`Gemini-Stimme fehlgeschlagen (${explainGeminiError(e.message)}) – nutze kostenlose Piper-Stimme.`, 'warn');
    }
  }
  return withInfo(piperTTS(ctx, scenes, settings, name, onProgress, log), piperName[name] || name);
}

// ---------------------------------------------------------------- Piper ---

let ortModule = null;
const sessions = new Map();

/** Stimmen-Modell aus dem Arbeitsspeicher entfernen (vor dem Video-Export). */
export async function releaseVoices() {
  for (const v of sessions.values()) {
    try {
      await v.session.release?.();
    } catch {
      /* egal */
    }
  }
  sessions.clear();
}

async function getOrt() {
  if (!ortModule) {
    ortModule = await import('onnxruntime-web');
    ortModule.env.wasm.wasmPaths = new URL('ort/', document.baseURI).href;
    ortModule.env.wasm.numThreads = 1;
    ortModule.env.logLevel = 'error';
  }
  return ortModule;
}

// Lädt eine Datei (aus dem Browser-Speicher, falls vorhanden). Mit keep=false
// wird sie nur gespeichert und NICHT in den Arbeitsspeicher geholt (null zurück),
// sofern das Speichern geklappt hat.
async function cachedFetch(url, onBytes, keep = true) {
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return keep ? await hit.arrayBuffer() : null;
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
  const total = +(res.headers.get('Content-Length') || 0);
  let blob;
  if (res.body && onBytes) {
    const reader = res.body.getReader();
    let chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onBytes(loaded, total);
    }
    blob = new Blob(chunks); // keine zusätzliche Kopie als großes Array
    chunks = null;
  } else {
    blob = await res.blob();
  }
  let stored = false;
  if (cache) {
    try {
      await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'application/octet-stream' } }));
      stored = true;
    } catch {
      /* Speicher voll oder privat – egal */
    }
  }
  if (!keep && stored) return null;
  return await blob.arrayBuffer();
}

async function loadPiperVoice(voiceId, onProgress) {
  if (sessions.has(voiceId)) return sessions.get(voiceId);
  const path = PIPER_PATHS[voiceId] || PIPER_PATHS['de_DE-thorsten-medium'];
  let config = null;
  let model = null;
  let lastErr = null;
  for (const base of HF_BASES) {
    try {
      const cfgBuf = await cachedFetch(`${base}/${path}.json`);
      config = JSON.parse(new TextDecoder().decode(cfgBuf));
      model = await cachedFetch(`${base}/${path}`, (loaded, total) =>
        onProgress({ phase: 'download', loaded, total }),
      );
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!model) throw new Error(`Stimme konnte nicht geladen werden: ${lastErr?.message}`);
  const ort = await getOrt();
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], enableCpuMemArena: false, enableMemPattern: false });
  const voice = { config, session, ort };
  sessions.set(voiceId, voice);
  return voice;
}

// Alle Sätze in EINEM Durchgang umwandeln (spart viel Arbeitsspeicher:
// das 18-MB-Sprachpaket wird nur einmal geladen statt für jeden Satz).
function phonemizeAll(texts, espeakVoice) {
  const base = new URL('piper/', document.baseURI).href;
  return new Promise((resolve, reject) => {
    const lines = [];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        resolve(lines.map((l) => JSON.parse(l).phoneme_ids));
      } catch (e) {
        reject(e);
      }
    };
    createPiperPhonemize({
      print: (line) => {
        lines.push(line);
        if (lines.length === texts.length) finish();
      },
      printErr: (msg) => console.warn('phonemize:', msg),
      locateFile: (f) => (f.endsWith('.wasm') || f.endsWith('.data') ? base + f.replace(/^.*\//, '') : f),
    })
      .then((mod) => mod.callMain(['-l', espeakVoice, '--input', JSON.stringify(texts.map((text) => ({ text }))), '--espeak_data', '/espeak-ng-data']))
      .catch(reject);
    setTimeout(() => !done && (lines.length === texts.length ? finish() : reject(new Error('Lautumwandlung dauert zu lange'))), 60000);
  });
}

// Stellt sicher, dass Konfiguration + Modell im Browser-Speicher (Cache) liegen.
// Das Modell selbst wird NICHT in die App geladen – der Hintergrund-Prozess
// liest es direkt aus dem Cache. Nur ohne Cache wird es mitgeschickt.
async function ensurePiperFiles(voiceId, onProgress) {
  const path = PIPER_PATHS[voiceId] || PIPER_PATHS['de_DE-thorsten-medium'];
  let lastErr = null;
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch {
    cache = null;
  }
  for (const base of HF_BASES) {
    try {
      const cfgBuf = await cachedFetch(`${base}/${path}.json`);
      const config = JSON.parse(new TextDecoder().decode(cfgBuf));
      const modelUrl = `${base}/${path}`;
      const model = await cachedFetch(modelUrl, (loaded, total) => onProgress({ phase: 'download', loaded, total }), !cache);
      return model ? { config, modelUrl: null, model } : { config, modelUrl, model: null };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Stimme konnte nicht geladen werden: ${lastErr?.message}`);
}

// Sprachausgabe im Hintergrund-Prozess; danach wird er beendet (Speicher frei)
function inferInWorker({ model, modelUrl, config, texts, speed }, onPart) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    const parts = new Array(texts.length);
    let timer = null;
    const end = (fn) => {
      clearTimeout(timer);
      worker.terminate(); // gibt den gesamten Speicher des Sprachprogramms frei
      fn();
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => end(() => reject(new Error('Stimme antwortet nicht'))), 120000);
    };
    arm();
    worker.onmessage = (e) => {
      const m = e.data;
      arm();
      if (m.type === 'part') {
        parts[m.index] = m.data;
        onPart(m.index);
      } else if (m.type === 'done') end(() => resolve(parts));
      else if (m.type === 'error') end(() => reject(new Error(m.message)));
    };
    worker.onerror = (e) => end(() => reject(new Error(e.message || 'Hintergrund-Prozess fehlgeschlagen')));
    worker.postMessage(
      {
        model,
        modelUrl,
        cacheName: CACHE_NAME,
        config,
        texts,
        speed,
        wasmBase: new URL('ort/', document.baseURI).href,
        piperBase: new URL('piper/', document.baseURI).href,
      },
      model ? [model] : [],
    );
  });
}

function phonemize(text, espeakVoice) {
  const base = new URL('piper/', document.baseURI).href;
  return new Promise((resolve, reject) => {
    let done = false;
    createPiperPhonemize({
      print: (line) => {
        if (done) return;
        try {
          done = true;
          resolve(JSON.parse(line).phoneme_ids);
        } catch (e) {
          reject(e);
        }
      },
      printErr: (msg) => console.warn('phonemize:', msg),
      locateFile: (f) => (f.endsWith('.wasm') || f.endsWith('.data') ? base + f.replace(/^.*\//, '') : f),
    })
      .then((mod) =>
        mod.callMain(['-l', espeakVoice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']),
      )
      .catch(reject);
    setTimeout(() => !done && reject(new Error('Lautumwandlung dauert zu lange')), 30000);
  });
}

// Leise Anfänge/Enden abschneiden, damit das Video flüssig wirkt.
function trimSilence(data, sr) {
  const thr = 0.012;
  let s = 0;
  let e = data.length - 1;
  while (s < e && Math.abs(data[s]) < thr) s++;
  while (e > s && Math.abs(data[e]) < thr) e--;
  const pad = Math.floor(sr * 0.06);
  return data.subarray(Math.max(0, s - pad), Math.min(data.length, e + pad));
}

async function piperTTS(ctx, scenes, settings, voiceId, onProgress, log) {
  log('Lade kostenlose Piper-Stimme (beim ersten Mal kann das 1–2 Minuten dauern) …');
  const speed = Math.min(1.5, Math.max(0.7, Number(settings.speed) || 1));
  const texts = scenes.map((s) => cleanForSpeech(s.text) || '…');
  // Stimme läuft KOMPLETT in einem Hintergrund-Prozess, der danach beendet wird.
  // So wird der große Speicher des Sprachprogramms vor der Videoaufnahme wieder frei.
  const { config, model, modelUrl } = await ensurePiperFiles(voiceId, onProgress);
  const sr = config.audio.sample_rate;
  onProgress({ phase: 'speak', index: 0, count: scenes.length });
  let parts;
  try {
    parts = await inferInWorker({ model, modelUrl, config, texts, speed }, (i) => onProgress({ phase: 'speak', index: Math.min(i + 1, scenes.length - 1), count: scenes.length }));
  } catch (e) {
    if (/Speicher|memory/i.test(e.message)) throw e;
    log(`Stimme im Hintergrund nicht möglich (${e.message}) – nutze direkten Weg.`, 'warn');
    parts = await piperDirect(texts, voiceId, speed, sr, onProgress);
  }
  return assemble(ctx, parts.map((p) => trimSilence(p, sr)), sr, scenes);
}

// Rückfall (nur falls Hintergrund-Prozesse nicht gehen): Stimme direkt in der App
async function piperDirect(texts, voiceId, speed, sr, onProgress) {
  const voice = await loadPiperVoice(voiceId, onProgress);
  const { config, session, ort } = voice;
  let idsList;
  try {
    idsList = await phonemizeAll(texts, config.espeak.voice);
  } catch {
    idsList = null;
  }
  const scales = new Float32Array([config.inference.noise_scale, config.inference.length_scale / speed, config.inference.noise_w]);
  const parts = [];
  for (let i = 0; i < texts.length; i++) {
    onProgress({ phase: 'speak', index: i, count: texts.length });
    await sleep(30);
    const ids = idsList ? idsList[i] : await phonemize(texts[i], config.espeak.voice);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', scales, [3]),
    };
    if (Object.keys(config.speaker_id_map || {}).length) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    const out = await session.run(feeds);
    parts.push(new Float32Array((out.output || Object.values(out)[0]).data));
  }
  return parts;
}

function assemble(ctx, parts, sr, scenes = []) {
  const gap = Math.floor(SCENE_GAP * sr);
  const lead = Math.floor(0.15 * sr);
  // zusätzliche Pause vor einer Szene (z. B. 2 s vor dem letzten Satz)
  const extra = parts.map((_, i) => Math.floor((scenes[i]?.pauseBefore || 0) * sr));
  const total = lead + parts.reduce((a, p, i) => a + p.length + gap + extra[i], 0) + Math.floor(0.8 * sr);
  const buffer = ctx.createBuffer(1, total, sr);
  const ch = buffer.getChannelData(0);
  const sceneTimes = [];
  let pos = lead;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    pos += extra[i];
    ch.set(p, pos);
    sceneTimes.push({ start: pos / sr, end: (pos + p.length) / sr });
    pos += p.length + gap;
  }
  return { buffer, sceneTimes };
}

export function cleanForSpeech(text) {
  return text
    .replace(/[*_#•▪►]/g, '') // Formatierungszeichen nicht vorlesen
    .replace(/[„“”"«»]/g, '')
    .replace(/\s*[–—]\s*/g, ', ')
    // Auslassungspunkte → normale Sprechpause (vermeidet Probleme der Stimme)
    .replace(/\s*(…|\.{2,})\s*/g, ', ')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/(,\s*)+/g, ', ')
    .replace(/,\s*$/, '.')
    .replace(/^\s*,\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- Gemini ---

// Sprechanweisung je nach Video-Art
export function speakInstruction(settings) {
  const fast = settings.speed > 1.05;
  if (settings.visualMode === 'verein') {
    return (
      'Sprich den folgenden deutschen Text freundlich, warm und entspannt, wie ein sympathischer Erzähler, ' +
      'der seinen Zuschauern locker und natürlich von seinem kleinen Fußballverein erzählt – mit einem Lächeln in der Stimme. ' +
      `${fast ? 'Flüssiges, eher zügiges' : 'Flüssiges, natürliches'} Tempo. Nicht übertrieben, nicht aufgeregt, nicht dramatisch, nicht düster. ` +
      'Mache nur kurze Pausen:'
    );
  }
  if (settings.visualMode === 'resort') {
    return (
      'Sprich den folgenden deutschen Text wie ein charismatischer, gut gelaunter Resort-Manager, der seine Zuschauer begeistert ' +
      'in sein Luxus-Resort einlädt: energiegeladen, selbstbewusst, mit einem Lächeln in der Stimme und echter Vorfreude. ' +
      'Sprich die Zuschauer direkt an (DU), betone Zahlen, Geldbeträge und Wörter in Großbuchstaben kräftig. ' +
      `${fast ? 'Schnelles, mitreißendes' : 'Zügiges, mitreißendes'} Tempo, kaum Pausen:`
    );
  }
  if (settings.visualMode === 'zombie') {
    return (
      'Sprich den folgenden deutschen Text wie ein energiegeladener TikTok-Erzähler mitten in einer Zombie-Apokalypse: ' +
      'laut, packend und voller Power, mit Druck in der Stimme und echter Spannung – jeder Satz muss sitzen wie ein Schlag. ' +
      'Betone wichtige Wörter (Zahlen, „Zombies“, „EUCH“, „Kampf“) kräftig, Ausrufe richtig rausgehauen. Nicht müde, nicht monoton, nicht flüsternd. ' +
      `${fast ? 'Schnelles, treibendes' : 'Zügiges, treibendes'} Tempo, kaum Pausen:`
    );
  }
  const pace = fast ? 'zügig und ' : settings.speed < 0.97 ? 'langsam, ruhig und ' : '';
  return `Lies den folgenden deutschen Text ${pace}spannend und atmosphärisch wie der Erzähler einer düsteren Mystery-Doku vor. Mache bei Auslassungspunkten kurze Pausen:`;
}

async function geminiSpeak(text, settings, voiceName) {
  const res = await geminiFetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
    settings.geminiKey,
    {
        contents: [
          {
            parts: [
              {
                text: `${speakInstruction(settings)}\n\n${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      },
    120000,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const json = await res.json();
  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error('keine Audiodaten');
  const mime = part.inlineData.mimeType || '';
  const sr = +(mime.match(/rate=(\d+)/)?.[1] || 24000);
  const bytes = base64ToBytes(part.inlineData.data);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { speech: trimSilence(samples, sr), sr };
}

async function geminiTTS(ctx, scenes, settings, voiceName, onProgress) {
  // Möglichst wenige Anfragen (schont das Gratis-Kontingent): eine pro Abschnitt
  // zwischen gewünschten Pausen (z. B. 2 Sekunden vor dem letzten Satz).
  const groups = [];
  scenes.forEach((sc, i) => {
    if (i === 0 || (sc.pauseBefore || 0) > 0) groups.push({ from: i, scenes: [] });
    groups[groups.length - 1].scenes.push(sc);
  });
  const results = [];
  for (let k = 0; k < groups.length; k++) {
    onProgress({ phase: 'speak', index: k, count: groups.length });
    const text = groups[k].scenes.map((s) => cleanForSpeech(s.text)).join('\n\n');
    results.push(await geminiSpeak(text, settings, voiceName));
  }
  const sr = results[0].sr;
  const lead = 0.15;
  const pauses = groups.map((gr) => (gr.from > 0 ? (scenes[gr.from].pauseBefore || 0) + SCENE_GAP : 0));
  const totalSec = lead + results.reduce((a, r) => a + r.speech.length / sr, 0) + pauses.reduce((a, b) => a + b, 0) + 0.8;
  const buffer = ctx.createBuffer(1, Math.ceil(totalSec * sr), sr);
  const ch = buffer.getChannelData(0);
  const sceneTimes = [];
  let t = lead;
  groups.forEach((gr, k) => {
    t += pauses[k];
    const { speech } = results[k];
    ch.set(speech, Math.floor(t * sr));
    // Szenengrenzen: erst nach Textlänge schätzen, dann an echte Sprechpausen anlegen
    const weights = gr.scenes.map((s) => speechWeight(s.text));
    const sum = weights.reduce((a, b) => a + b, 0);
    const dur = speech.length / sr;
    const pausesIn = findPauses(speech, sr);
    const bounds = [0];
    let acc = 0;
    for (let k = 0; k < weights.length - 1; k++) {
      acc += (weights[k] / sum) * dur;
      const prev = bounds[bounds.length - 1];
      let best = acc;
      let bestD = 1.2;
      for (const pz of pausesIn) {
        const d = Math.abs(pz - acc);
        if (d < bestD && pz > prev + 0.3) {
          best = pz;
          bestD = d;
        }
      }
      bounds.push(Math.max(prev + 0.3, best));
    }
    bounds.push(dur);
    for (let k = 0; k < weights.length; k++) {
      sceneTimes.push({ start: t + bounds[k], end: t + Math.max(bounds[k] + 0.2, bounds[k + 1] - 0.05) });
    }
    t += dur;
  });
  return { buffer, sceneTimes };
}

// Findet Sprechpausen (Stille ≥ 0,2 s) und gibt deren Mitte in Sekunden zurück
export function findPauses(data, sr) {
  const win = Math.floor(sr * 0.01);
  const env = [];
  for (let i = 0; i < data.length; i += win) {
    let sum = 0;
    const end = Math.min(data.length, i + win);
    for (let k = i; k < end; k++) sum += data[k] * data[k];
    env.push(Math.sqrt(sum / Math.max(1, end - i)));
  }
  const loud = env.slice().sort((a, b) => a - b)[Math.floor(env.length * 0.9)] || 0.1;
  const thr = loud * 0.08;
  const out = [];
  let run = 0;
  for (let i = 0; i < env.length; i++) {
    if (env[i] < thr) run++;
    else {
      if (run >= 20) out.push(((i - run / 2) * win) / sr);
      run = 0;
    }
  }
  return out;
}

export function speechWeight(text) {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, '').length;
  const pauses = (text.match(/[.!?]/g) || []).length * 6 + (text.match(/[,;:]/g) || []).length * 3;
  return letters + pauses + 2;
}
