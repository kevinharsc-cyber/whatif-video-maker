// Szenenweiser Video-Export (WebCodecs) – speichersicher und fortsetzbar.
//
// Ablauf:
//  1. Ton offline mischen und als AAC kodieren → im Gerätespeicher ablegen.
//  2. Video Szene für Szene zeichnen und als H.264 kodieren (konstante 24 fps).
//     - jedes Bild wird SOFORT nach dem Kodieren freigegeben (frame.close())
//     - die Warteschlange des Encoders ist begrenzt (höchstens 2 Bilder)
//     - nach jeder Szene: Encoder leeren, fertige Daten in den Gerätespeicher
//       (IndexedDB), kurze Pause zum Aufräumen
//  3. Am Ende alle Abschnitte nacheinander zu EINER normalen MP4 zusammensetzen
//     (Index am Anfang, Bild und Ton auf derselben Zeitachse).
//
// Stürzt die Seite ab, liegen die fertigen Szenen noch im Gerätespeicher und
// die Erstellung kann an der nächsten Szene fortgesetzt werden.

import { h264Candidates } from './devicecheck.js';
import { parseMp4, descriptionFor } from './mp4tools.js';
import * as store from './store.js';
import { FPS } from './renderer.js';

export const LEAD = 0.15; // Stille vor dem ersten Wort
const TAIL = 0.35; // Nachlauf am Ende
const SR = 48000;
const KEY_EVERY = FPS * 2; // alle 2 s ein Schlüsselbild
const MAX_QUEUE = 2; // höchstens 2 Bilder in der Encoder-Warteschlange

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} antwortet nicht`)), ms))]);

export class NoEncoderError extends Error {}
export class CancelledError extends Error {}

export function totalSeconds(duration) {
  return duration + LEAD + TAIL;
}

// Echte Probe: Encoder einstellen und EIN Testbild kodieren. Manche Safari-
// Versionen melden bei isConfigSupported "nein", können es aber trotzdem.
async function probeEncode(cfg, W, H) {
  let enc = null;
  let got = false;
  let err = null;
  try {
    enc = new VideoEncoder({ output: () => (got = true), error: (e) => (err = e) });
    enc.configure(cfg);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#7c3aed';
    g.fillRect(0, 0, W, H);
    const f = new VideoFrame(c, { timestamp: 0, duration: Math.round(1e6 / FPS) });
    enc.encode(f, { keyFrame: true });
    f.close();
    await withTimeout(enc.flush(), 5000, 'Testbild');
    c.width = c.height = 1;
    if (err) throw err;
    return got ? null : 'kein Bild ausgegeben';
  } catch (e) {
    return (e?.message || String(e)).slice(0, 90);
  } finally {
    try {
      if (enc && enc.state !== 'closed') enc.close();
    } catch {
      /* egal */
    }
  }
}

const HEVC = ['hvc1.1.6.L120.90', 'hvc1.1.6.L93.B0', 'hev1.1.6.L120.90', 'hvc1.2.4.L120.90'];

let pickCache = null;
const ENC_KEY = 'whatif-encoder-v2';
/**
 * Sucht eine Video-Einstellung, die dieses Gerät kodieren kann:
 * H.264 (fragen) → H.264 (echtes Testbild) → HEVC/H.265 (wie iPhone-Kamera).
 * Höchstens ~25 s; antwortet Safari nicht, wird nicht weiter gefragt.
 * Ergebnis wird gemerkt (beim nächsten Mal sofort da).
 * Ergebnis: { cfg } oder { cfg: null, why }.
 */
export async function findVideoConfig(W, H, onStep = () => {}) {
  const key = `${W}x${H}|${navigator.userAgent}`;
  if (pickCache?.key === key) return pickCache.res;
  try {
    const saved = JSON.parse(localStorage.getItem(ENC_KEY) || 'null');
    if (saved?.key === key && saved.res?.cfg) return (pickCache = { key, res: saved.res }).res;
  } catch {
    /* egal */
  }
  const res = await findVideoConfigUncached(W, H, onStep);
  pickCache = { key, res };
  try {
    if (res.cfg) localStorage.setItem(ENC_KEY, JSON.stringify({ key, res }));
  } catch {
    /* egal */
  }
  return res;
}

async function findVideoConfigUncached(W, H, onStep) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return { cfg: null, why: `VideoEncoder fehlt in diesem Browser (${(navigator.userAgent.match(/OS [\d_]+|Version\/[\d.]+/g) || []).join(', ')})` };
  }
  const bitrate = 3_500_000;
  const t0 = performance.now();
  const budgetLeft = () => 25000 - (performance.now() - t0);
  let askHangs = false;
  const ask = async (c) => {
    if (askHangs) return 'antwortet nicht';
    try {
      return (await withTimeout(VideoEncoder.isConfigSupported(c), 2500, 'isConfigSupported')).supported ? null : 'nein';
    } catch (e) {
      if (/antwortet nicht/.test(e?.message)) askHangs = true; // Safari hängt → nicht weiter fragen
      return (e?.message || 'Fehler').slice(0, 60);
    }
  };
  // 1) H.264 fragen (die wichtigsten Varianten)
  onStep('Prüfe Video-Encoder (H.264) …');
  let firstAnswer = null;
  const cands = h264Candidates(W, H, FPS, bitrate);
  for (const c of [cands[0], cands[1], cands[2], cands[15], cands[16], cands[21], cands[22], cands[23]]) {
    if (!c || budgetLeft() < 15000) break;
    const r = await ask(c);
    if (!r) return { cfg: { ...c, bitrate, framerate: FPS } };
    firstAnswer ??= r;
    if (askHangs) break;
  }
  // 2) H.264 echt ausprobieren (ein Testbild)
  onStep('Prüfe Video-Encoder (Testbild H.264) …');
  let probeErr = null;
  for (const c of [
    { codec: 'avc1.640028', width: W, height: H, bitrate, framerate: FPS, avc: { format: 'avc' } },
    { codec: 'avc1.42e028', width: W, height: H, bitrate, framerate: FPS },
  ]) {
    if (budgetLeft() < 6000) break;
    const e = await probeEncode(c, W, H);
    if (!e) return { cfg: c };
    probeErr ??= e;
  }
  // 3) HEVC (H.265) – iPhones kodieren das in Hardware, TikTok nimmt es an
  onStep('Prüfe Video-Encoder (HEVC) …');
  let hevcErr = null;
  for (const codec of HEVC.slice(0, 2)) {
    if (budgetLeft() < 5000) break;
    const c = { codec, width: W, height: H, bitrate, framerate: FPS, hevc: { format: 'hevc' } };
    const r = await ask(c);
    if (!r) return { cfg: c };
    const e = await probeEncode(c, W, H);
    if (!e) return { cfg: c };
    hevcErr ??= e || r;
  }
  return { cfg: null, why: `H.264: Anfrage ${firstAnswer}, Testbild ${probeErr}; HEVC: ${hevcErr || 'nicht geprüft'} (${Math.round((performance.now() - t0) / 1000)} s)` };
}

export async function pickVideoConfig(W, H) {
  return (await findVideoConfig(W, H)).cfg;
}

async function aacEncoderOk() {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return false;
  try {
    return (await withTimeout(AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 }), 4000, 'Audio-Encoder')).supported;
  } catch {
    return false;
  }
}

function aacRecorderType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

/** Prüft, ob der speichersichere Export auf diesem Gerät möglich ist. */
export async function segmentedSupported(W, H, onStep) {
  const { cfg: v, why } = await findVideoConfig(W, H, onStep);
  if (!v) return { ok: false, why };
  if (await aacEncoderOk()) return { ok: true, video: v, audio: 'encoder' };
  if (aacRecorderType()) return { ok: true, video: v, audio: 'recorder' };
  return { ok: false, why: 'kein AAC-Encoder' };
}

/**
 * Teilt das Video in Abschnitte (an den Szenengrenzen, höchstens ~5 s lang).
 * Jeder Abschnitt beginnt mit einem Schlüsselbild → kann einzeln fortgesetzt werden.
 */
export function planSegments(sceneStarts, duration) {
  const frames = Math.ceil(totalSeconds(duration) * FPS);
  const cuts = new Set([0]);
  for (const s of sceneStarts) {
    const f = Math.round((s + LEAD) * FPS);
    if (f > 0 && f < frames) cuts.add(f);
  }
  const sorted = [...cuts].sort((a, b) => a - b);
  const segs = [];
  for (let i = 0; i < sorted.length; i++) {
    const f0 = sorted[i];
    const f1 = i + 1 < sorted.length ? sorted[i + 1] : frames;
    // zu kurze Stücke (< 1 s) an das vorherige anhängen
    if (segs.length && f1 - f0 < FPS) {
      segs[segs.length - 1].f1 = f1;
      continue;
    }
    // zu lange Stücke (> 6 s) teilen
    let a = f0;
    while (f1 - a > FPS * 6) {
      segs.push({ f0: a, f1: a + FPS * 5 });
      a += FPS * 5;
    }
    segs.push({ f0: a, f1 });
  }
  return { frames, segs };
}

// ------------------------------------------------------------------ Ton ---

async function encodeAudioWebCodecs(mixed) {
  const chunks = [];
  let description = null;
  let failure = null;
  const enc = new AudioEncoder({
    output: (c, m) => {
      if (m?.decoderConfig?.description && !description) description = new Uint8Array(m.decoderConfig.description.slice ? m.decoderConfig.description.slice(0) : m.decoderConfig.description);
      const d = new Uint8Array(c.byteLength);
      c.copyTo(d);
      chunks.push({ ts: c.timestamp, dur: c.duration || Math.round((1024 / SR) * 1e6), data: d.buffer });
    },
    error: (e) => (failure = e),
  });
  enc.configure({ codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 2, bitrate: 192_000 });
  const L = mixed.getChannelData(0);
  const R = mixed.getChannelData(1);
  const step = 4800;
  for (let i = 0; i < mixed.length; i += step) {
    const n = Math.min(step, mixed.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / SR) * 1e6), data });
    enc.encode(ad);
    ad.close(); // Tondaten sofort freigeben
    while (enc.encodeQueueSize > 8) await sleep(2);
    if (failure) break;
  }
  await withTimeout(enc.flush(), 30000, 'Audio-Encoder');
  enc.close();
  if (failure) throw failure;
  return { codec: 'mp4a.40.2', description, sampleRate: SR, channels: 2, chunks };
}

// Rückfall, falls Safari keinen AAC-Encoder (WebCodecs) hat: Die fertige
// Tonmischung wird einmal in Echtzeit als reine Ton-Aufnahme (AAC) aufgezeichnet.
// Kostet die Videolänge an Zeit, aber kaum Speicher (kein Bild dabei).
async function encodeAudioRecorder(mixed, ctx, onProgress) {
  const type = aacRecorderType();
  const dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource();
  src.buffer = mixed;
  src.connect(dest);
  const rec = new MediaRecorder(dest.stream, { mimeType: type, audioBitsPerSecond: 192_000 });
  const parts = [];
  rec.ondataavailable = (e) => e.data?.size && parts.push(e.data);
  const stopped = new Promise((res, rej) => {
    rec.onstop = res;
    rec.onerror = (e) => rej(e.error || new Error('Ton-Aufnahme fehlgeschlagen'));
  });
  const started = new Promise((res) => (rec.onstart = res));
  rec.start();
  await started;
  src.start();
  const t0 = performance.now();
  const dur = mixed.duration * 1000 + 300;
  while (performance.now() - t0 < dur) {
    onProgress?.((performance.now() - t0) / dur);
    await sleep(250);
  }
  rec.stop();
  await stopped;
  try {
    src.disconnect();
  } catch {
    /* egal */
  }
  const blob = new Blob(parts, { type });
  const parsed = await parseMp4(blob);
  const a = parsed.info.audioTracks?.[0];
  if (!a) throw new Error('Ton-Aufnahme leer');
  const description = descriptionFor(parsed.file, a.id);
  const list = (parsed.samples.get(a.id) || []).sort((x, y) => x.dts - y.dts);
  const t0s = list.length ? list[0].dts : 0;
  const chunks = list.map((s) => ({ ts: Math.round(((s.dts - t0s) / s.timescale) * 1e6), dur: Math.round((s.duration / s.timescale) * 1e6), data: new Uint8Array(s.data).buffer }));
  return { codec: a.codec, description, sampleRate: a.audio.sample_rate, channels: a.audio.channel_count, chunks };
}

// ---------------------------------------------------------------- Video ---

const sameBytes = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Kompletter Export. job = gespeicherter Fortschritt (für Fortsetzen).
 * hooks: { onProgress(p, text), onHeartbeat(info), cancel: { requested } , log }
 */
export async function exportSegmented(renderer, ctx, job, hooks = {}) {
  const { onProgress = () => {}, onHeartbeat = () => {}, cancel = {}, log = () => {} } = hooks;
  const W = renderer.W;
  const H = renderer.H;
  const vcfg = await pickVideoConfig(W, H);
  if (!vcfg) throw new NoEncoderError('H.264-Encoder nicht verfügbar');
  const { frames, segs } = planSegments(renderer.sceneStarts, renderer.duration);
  if (!job.segs || job.frames !== frames) {
    job.segs = segs;
    job.frames = frames;
    job.segDone = 0;
    job.segCounts = [];
  }
  const save = () => store.put('job', job);

  // 1) Ton (nur einmal; beim Fortsetzen schon fertig)
  if (!job.audioDone) {
    onProgress(0, 'Ton wird gemischt …');
    let mixed = await renderer.mixAudio({ music: job.music !== false, lead: LEAD, total: totalSeconds(renderer.duration) });
    let audio;
    if (await aacEncoderOk()) {
      onProgress(0.01, 'Ton wird kodiert (AAC) …');
      audio = await encodeAudioWebCodecs(mixed);
    } else if (aacRecorderType()) {
      log('Kein AAC-Encoder: Ton wird einmal in Echtzeit aufgenommen (nur Ton, braucht kaum Speicher).');
      audio = await encodeAudioRecorder(mixed, ctx, (p) => onProgress(p * 0.25, `Ton wird aufgenommen: ${Math.round(p * 100)} %`));
    } else {
      throw new NoEncoderError('AAC-Encoder nicht verfügbar');
    }
    mixed = null;
    await store.put('audio', audio);
    job.audioDone = true;
    job.audioCount = audio.chunks.length;
    await save();
    audio = null;
  }
  if (cancel.requested) throw new CancelledError('Abgebrochen');

  // 2) Video, Abschnitt für Abschnitt
  const pBase = 0.27;
  let enc = null;
  let failure = null;
  let segChunks = [];
  let desc = job.videoDesc ? new Uint8Array(job.videoDesc) : null;
  let mismatch = false;
  const makeEncoder = () => {
    const e = new VideoEncoder({
      output: (c, m) => {
        const d = m?.decoderConfig?.description;
        if (d) {
          const bytes = new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset || 0, (d.byteOffset || 0) + d.byteLength) : d);
          if (!desc) {
            desc = bytes;
            job.videoDesc = bytes.buffer.slice(0);
            job.videoCodec = m.decoderConfig.codec || vcfg.codec;
          } else if (!sameBytes(desc, bytes)) mismatch = true;
        }
        const data = new Uint8Array(c.byteLength);
        c.copyTo(data);
        segChunks.push({ ts: c.timestamp, dur: c.duration || Math.round(1e6 / FPS), key: c.type === 'key', data: data.buffer });
      },
      error: (err) => (failure = err),
    });
    e.configure(vcfg);
    return e;
  };
  const closeEnc = () => {
    try {
      if (enc && enc.state !== 'closed') enc.close();
    } catch {
      /* egal */
    }
    enc = null;
  };
  let peakHeap = 0;
  try {
    for (let si = job.segDone; si < job.segs.length; si++) {
      const { f0, f1 } = job.segs[si];
      if (!enc) enc = makeEncoder();
      segChunks = [];
      let drawMs = 0;
      for (let f = f0; f < f1; f++) {
        if (cancel.requested) throw new CancelledError('Abgebrochen');
        if (failure) throw failure;
        const t = f / FPS - LEAD;
        const d0 = performance.now();
        renderer.drawFrame(Math.max(0, Math.min(t, renderer.duration)));
        drawMs += performance.now() - d0;
        const frame = new VideoFrame(renderer.canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
        try {
          enc.encode(frame, { keyFrame: f === f0 || (f - f0) % KEY_EVERY === 0 });
        } finally {
          frame.close(); // Bild sofort freigeben – nie mehrere Vollbilder im Speicher
        }
        // Gegendruck: warten, bis der Encoder hinterherkommt
        const w0 = performance.now();
        while (enc.encodeQueueSize > MAX_QUEUE) {
          if (failure) throw failure;
          if (performance.now() - w0 > 15000) throw new Error('Video-Encoder hängt');
          await sleep(4);
        }
        if ((f - f0) % 6 === 0) {
          onProgress(pBase + (1 - pBase) * 0.95 * (f / frames), null);
          await sleep(0);
        }
      }
      await withTimeout(enc.flush(), 30000, 'Video-Encoder');
      if (failure) throw failure;
      if (mismatch) {
        // Fortsetzen mit anders eingestelltem Encoder → Video von vorn (Ton bleibt)
        job.segDone = 0;
        job.segCounts = [];
        job.videoDesc = null;
        await save();
        throw new Error('Encoder-Einstellung hat sich geändert – Video wird neu begonnen');
      }
      if (!segChunks.length || !segChunks[0].key) throw new Error('Abschnitt ohne Schlüsselbild');
      await store.put(`v${si}`, segChunks);
      job.segCounts[si] = segChunks.length;
      job.segDone = si + 1;
      await save();
      segChunks = [];
      const heap = performance.memory?.usedJSHeapSize;
      if (heap) peakHeap = Math.max(peakHeap, heap);
      onHeartbeat({ seg: si + 1, segs: job.segs.length, frame: f1, frames, msPerFrame: drawMs / Math.max(1, f1 - f0), heapMB: heap ? Math.round(heap / 1048576) : null });
      // kurze Pause: Safari kann Speicher aufräumen, bevor die nächste Szene startet
      await sleep(60);
    }
  } finally {
    closeEnc();
    segChunks = [];
  }

  // 3) Zusammensetzen
  onProgress(0.97, 'Szenen werden zusammengesetzt …');
  const blob = await muxJob(job);
  job.peakHeapMB = peakHeap ? Math.round(peakHeap / 1048576) : null;
  onProgress(1, null);
  return blob;
}

/** Setzt Ton + alle Video-Abschnitte aus dem Gerätespeicher zu einer MP4 zusammen. */
export async function muxJob(job) {
  const { Muxer, StreamTarget } = await import('mp4-muxer');
  const audio = await store.get('audio');
  if (!audio) throw new Error('Ton fehlt im Zwischenspeicher');
  const parts = [];
  let size = 0;
  const target = new StreamTarget({
    chunked: true,
    chunkSize: 2 ** 22,
    onData: (data, pos) => {
      const copy = data.slice();
      if (pos > size) {
        parts.push({ pos: size, d: new Uint8Array(pos - size) });
        size = pos;
      }
      if (pos === size) {
        parts.push({ pos, d: copy });
        size += copy.length;
        return;
      }
      for (const p of parts) {
        const a = Math.max(pos, p.pos);
        const b = Math.min(pos + copy.length, p.pos + p.d.length);
        if (a < b) p.d.set(copy.subarray(a - pos, b - pos), a - p.pos);
      }
      if (pos + copy.length > size) {
        const extra = copy.slice(size - pos);
        parts.push({ pos: size, d: extra });
        size += extra.length;
      }
    },
  });
  const videoCount = job.segCounts.reduce((a, b) => a + (b || 0), 0);
  // Ton-Codec übernehmen, wie er aufgenommen/kodiert wurde (iPhone: AAC)
  const aCodec = /^mp4a/i.test(audio.codec) ? 'aac' : 'opus';
  const muxer = new Muxer({
    target,
    video: { codec: /^(hvc1|hev1)/.test(job.videoCodec || '') ? 'hevc' : 'avc', width: job.W, height: job.H, frameRate: FPS },
    audio: { codec: aCodec, numberOfChannels: audio.channels, sampleRate: audio.sampleRate },
    fastStart: { expectedVideoChunks: videoCount + 2, expectedAudioChunks: audio.chunks.length + 2 },
    firstTimestampBehavior: 'offset',
  });
  const vMeta = { decoderConfig: { codec: job.videoCodec || 'avc1.640028', codedWidth: job.W, codedHeight: job.H, description: new Uint8Array(job.videoDesc), colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } } };
  const aMeta = { decoderConfig: { codec: aCodec === 'aac' ? 'mp4a.40.2' : 'opus', sampleRate: audio.sampleRate, numberOfChannels: audio.channels, ...(audio.description ? { description: audio.description } : {}) } };
  let ai = 0;
  const addAudioUntil = (tsLimit) => {
    while (ai < audio.chunks.length && audio.chunks[ai].ts < tsLimit) {
      const c = audio.chunks[ai];
      muxer.addAudioChunkRaw(new Uint8Array(c.data), 'key', c.ts, c.dur, ai === 0 ? aMeta : undefined);
      audio.chunks[ai] = null; // freigeben
      ai++;
    }
  };
  let first = true;
  for (let si = 0; si < job.segs.length; si++) {
    let chunks = await store.get(`v${si}`);
    if (!chunks) throw new Error(`Szene ${si + 1} fehlt im Zwischenspeicher`);
    const endTs = Math.round((job.segs[si].f1 * 1e6) / FPS);
    addAudioUntil(endTs);
    for (const c of chunks) {
      muxer.addVideoChunkRaw(new Uint8Array(c.data), c.key ? 'key' : 'delta', c.ts, c.dur, first ? vMeta : undefined);
      first = false;
    }
    chunks = null;
    await sleep(0);
  }
  addAudioUntil(Infinity);
  muxer.finalize();
  const blob = new Blob(
    parts.map((p) => p.d),
    { type: 'video/mp4' },
  );
  parts.length = 0;
  return blob;
}

export async function loadJob() {
  return store.get('job');
}
export async function clearJob() {
  await store.clear('');
}
export async function startJob(info) {
  await store.clear('');
  const job = { ...info, createdAt: Date.now(), audioDone: false, segDone: 0 };
  await store.put('job', job);
  return job;
}
