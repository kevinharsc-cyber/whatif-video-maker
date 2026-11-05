// Deutsche KI-Sprachausgabe.
//
// Variante A (Standard, komplett kostenlos): "Piper" – eine neuronale Stimme,
//   die direkt im Browser auf deinem iPhone läuft. Beim ersten Mal wird das
//   Stimmmodell (ca. 20–75 MB) von Hugging Face geladen und danach im
//   Browser-Speicher behalten.
// Variante B (optional, kostenloses Kontingent): Google Gemini TTS – sehr
//   natürliche Stimme, braucht deinen Gemini-API-Schlüssel.

import { fetchWithTimeout, base64ToBytes, sleep } from './util.js';
import { createPiperPhonemize } from './vendor/piper-phonemize.js';

export const VOICES = [
  { id: 'piper:de_DE-thorsten-medium', label: 'Thorsten (männlich, kostenlos, empfohlen)' },
  { id: 'piper:de_DE-thorsten-high', label: 'Thorsten HD (männlich, kostenlos, größer)' },
  { id: 'piper:de_DE-kerstin-low', label: 'Kerstin (weiblich, kostenlos)' },
  { id: 'piper:de_DE-ramona-low', label: 'Ramona (weiblich, kostenlos)' },
  { id: 'piper:de_DE-eva_k-x_low', label: 'Eva (weiblich, kostenlos, klein)' },
  { id: 'gemini:Charon', label: 'Gemini „Charon“ (männlich, braucht Schlüssel)' },
  { id: 'gemini:Fenrir', label: 'Gemini „Fenrir“ (männlich, aufgeregt, braucht Schlüssel)' },
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
export async function synthesize(ctx, scenes, settings, onProgress, log) {
  const [kind, name] = settings.voice.split(':');
  if (kind === 'gemini') {
    if (!settings.geminiKey) {
      log('Für Gemini-Stimmen fehlt der API-Schlüssel – nutze kostenlose Piper-Stimme.', 'warn');
    } else {
      try {
        return await geminiTTS(ctx, scenes, settings, name, onProgress);
      } catch (e) {
        log(`Gemini-Stimme fehlgeschlagen (${e.message}) – nutze kostenlose Piper-Stimme.`, 'warn');
      }
    }
    return piperTTS(ctx, scenes, settings, 'de_DE-thorsten-medium', onProgress, log);
  }
  return piperTTS(ctx, scenes, settings, name, onProgress, log);
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

async function cachedFetch(url, onBytes) {
  let cache = null;
  try {
    cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`);
  const total = +(res.headers.get('Content-Length') || 0);
  let buf;
  if (res.body && onBytes) {
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onBytes(loaded, total);
    }
    const out = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    buf = out.buffer;
  } else {
    buf = await res.arrayBuffer();
  }
  if (cache) {
    try {
      await cache.put(url, new Response(buf.slice(0), { headers: { 'Content-Type': 'application/octet-stream' } }));
    } catch {
      /* Speicher voll oder privat – egal */
    }
  }
  return buf;
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

// Lädt Stimmen-Konfiguration + Modell (aus dem Browser-Speicher, falls vorhanden)
async function fetchPiperFiles(voiceId, onProgress) {
  const path = PIPER_PATHS[voiceId] || PIPER_PATHS['de_DE-thorsten-medium'];
  let lastErr = null;
  for (const base of HF_BASES) {
    try {
      const cfgBuf = await cachedFetch(`${base}/${path}.json`);
      const config = JSON.parse(new TextDecoder().decode(cfgBuf));
      const modelUrl = `${base}/${path}`;
      const model = await cachedFetch(modelUrl, (loaded, total) => onProgress({ phase: 'download', loaded, total }));
      return { config, model, modelUrl };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Stimme konnte nicht geladen werden: ${lastErr?.message}`);
}

// Sprachausgabe im Hintergrund-Prozess; danach wird er beendet (Speicher frei)
function inferInWorker(model, config, idsList, speed, onPart, modelUrl = null) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./piper-worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      reject(e);
      return;
    }
    const parts = new Array(idsList.length);
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'part') {
        parts[m.index] = m.data;
        onPart(m.index);
      } else if (m.type === 'done') {
        worker.terminate();
        resolve(parts);
      } else if (m.type === 'error') {
        worker.terminate();
        reject(new Error(m.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || 'Hintergrund-Prozess fehlgeschlagen'));
    };
    worker.postMessage(
      { model, modelUrl, cacheName: CACHE_NAME, config, idsList, speed, wasmBase: new URL('ort/', document.baseURI).href },
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
  // Speichersparender Weg: Lautschrift in einem Durchgang, Stimme im Hintergrund-Prozess
  try {
    let { config, model, modelUrl } = await fetchPiperFiles(voiceId, onProgress);
    // Liegt das Modell im Browser-Speicher, lädt der Hintergrund-Prozess es selbst –
    // dann muss die App keine eigene 63-MB-Kopie im Arbeitsspeicher halten.
    let cached = false;
    try {
      cached = !!(await (await caches.open(CACHE_NAME)).match(modelUrl));
    } catch {
      cached = false;
    }
    if (cached) model = null;
    onProgress({ phase: 'speak', index: 0, count: scenes.length });
    const idsList = await phonemizeAll(texts, config.espeak.voice);
    // Kleine Pakete (4 Sätze); danach wird der Hintergrund-Prozess beendet,
    // damit sein Speicher nicht immer weiter wächst.
    const BATCH = 4;
    const raw = [];
    for (let b = 0; b < idsList.length; b += BATCH) {
      const part = await inferInWorker(
        cached ? null : model.slice(0),
        config,
        idsList.slice(b, b + BATCH),
        speed,
        (i) => onProgress({ phase: 'speak', index: Math.min(b + i + 1, scenes.length - 1), count: scenes.length }),
        cached ? modelUrl : null,
      );
      raw.push(...part);
      await sleep(400); // dem Browser Zeit zum Aufräumen geben
    }
    model = null;
    const sr = config.audio.sample_rate;
    return assemble(ctx, raw.map((d) => trimSilence(d, sr)), sr, scenes);
  } catch (e) {
    console.warn('Speichersparende Stimme nicht möglich, nutze normalen Weg:', e);
  }
  // Rückfall: alles im Haupt-Thread (wie früher)
  const voice = await loadPiperVoice(voiceId, onProgress);
  const { config, session, ort } = voice;
  const sr = config.audio.sample_rate;
  const scales = new Float32Array([
    config.inference.noise_scale,
    config.inference.length_scale / speed,
    config.inference.noise_w,
  ]);
  const parts = [];
  for (let i = 0; i < scenes.length; i++) {
    onProgress({ phase: 'speak', index: i, count: scenes.length });
    await sleep(30);
    const ids = await phonemize(texts[i], config.espeak.voice);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor('float32', scales, [3]),
    };
    if (Object.keys(config.speaker_id_map || {}).length) {
      feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
    }
    const out = await session.run(feeds);
    const data = (out.output || Object.values(out)[0]).data;
    parts.push(trimSilence(new Float32Array(data), sr));
  }
  return assemble(ctx, parts, sr, scenes);
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

async function geminiSpeak(text, settings, voiceName) {
  const pace = settings.speed > 1.05 ? 'zügig und ' : settings.speed < 0.97 ? 'langsam, ruhig und ' : '';
  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.geminiKey },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Lies den folgenden deutschen Text ${pace}spannend und atmosphärisch wie der Erzähler einer düsteren Mystery-Doku vor. Mache bei Auslassungspunkten kurze Pausen:\n\n${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
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
