// MP4-Werkzeuge: Datei untersuchen (Qualitätskontrolle) und "remuxen".
//
// Warum? Die Echtzeit-Aufnahme (MediaRecorder) liefert auf dem iPhone eine
// FRAGMENTIERTE MP4 mit variabler Bildrate. Solche Dateien spielen lokal meist
// korrekt, können aber beim Verarbeiten durch TikTok zu stockendem Ton führen.
// Remuxen = die bereits kodierten Video-/Tonpakete OHNE Neukodierung in eine
// normale (progressive) MP4 mit Inhaltsverzeichnis am Dateianfang umpacken.

import { createFile, DataStream } from 'mp4box';

const US = 1e6;

/**
 * Liest eine MP4 ein: Track-Infos + alle Samples.
 * withData=false: nur Zeitstempel/Größen (für die Prüfung) – spart eine komplette
 * Kopie des Videos im Arbeitsspeicher.
 */
export async function parseMp4(blob, { withData = true } = {}) {
  const buf = await blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const file = createFile();
    const samples = new Map();
    let info = null;
    let pending = 0;
    file.onError = (e) => reject(new Error(`MP4 nicht lesbar: ${e}`));
    file.onReady = (i) => {
      info = i;
      for (const t of i.tracks) {
        samples.set(t.id, []);
        if (withData) {
          file.setExtractionOptions(t.id, null, { nbSamples: Infinity });
          pending++;
        }
      }
      if (withData) file.start();
    };
    file.onSamples = (id, _user, list) => {
      const arr = samples.get(id);
      for (const s of list) arr.push(s);
    };
    buf.fileStart = 0;
    try {
      file.appendBuffer(buf);
      file.flush();
    } catch (e) {
      reject(e);
      return;
    }
    // onSamples wird synchron während start()/flush() aufgerufen
    setTimeout(() => {
      if (!info) return reject(new Error('MP4 ohne gültige Track-Informationen'));
      if (!withData) {
        for (const t of info.tracks) samples.set(t.id, (file.getTrackSamplesInfo(t.id) || []).map(({ cts, dts, duration, timescale, is_sync, size }) => ({ cts, dts, duration, timescale, is_sync, size })));
      }
      resolve({ file: withData ? file : null, info, samples, size: buf.byteLength, pending });
    }, 0);
  });
}

export function descriptionFor(file, trackId) {
  const trak = file.getTrackById(trackId);
  for (const entry of trak.mdia.minf.stbl.stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8); // ohne Box-Header
    }
    if (entry.esds) {
      // AudioSpecificConfig aus dem esds-Deskriptor (AAC)
      const dsi = entry.esds.esd?.descs?.[0]?.descs?.[0];
      if (dsi?.data) return new Uint8Array(dsi.data);
    }
    if (entry.dOps) {
      // Opus: WebCodecs erwartet den "OpusHead"-Header (Ogg-Format, little endian)
      const o = entry.dOps;
      const head = new Uint8Array(19);
      const dv = new DataView(head.buffer);
      head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
      head[8] = 1;
      head[9] = o.OutputChannelCount ?? 2;
      dv.setUint16(10, o.PreSkip ?? 312, true);
      dv.setUint32(12, o.InputSampleRate ?? 48000, true);
      dv.setInt16(16, o.OutputGain ?? 0, true);
      head[18] = o.ChannelMappingFamily ?? 0;
      return head;
    }
  }
  return undefined;
}

function muxerCodec(codec) {
  if (/^avc1|^avc3/.test(codec)) return 'avc';
  if (/^hvc1|^hev1/.test(codec)) return 'hevc';
  if (/^vp09/.test(codec)) return 'vp9';
  if (/^av01/.test(codec)) return 'av1';
  if (/^mp4a/.test(codec)) return 'aac';
  if (/^opus|^Opus/.test(codec)) return 'opus';
  return null;
}

/**
 * Qualitätskontrolle einer fertigen MP4. Liefert { ok, checks: [{name, ok, detail}], facts }.
 */
export function qualityReport(parsed, expectedDuration, expectedFps = 24) {
  const { info, samples } = parsed;
  const v = info.videoTracks?.[0];
  const a = info.audioTracks?.[0];
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });
  const facts = {};

  add('Container MP4', !!info, info ? `Marke ${info.brands?.join('/') || '?'}` : 'nicht lesbar');
  add('Index am Dateianfang (Fast Start)', !info.isFragmented && info.isProgressive !== false, info.isFragmented ? 'fragmentiert' : 'normal');

  if (v) {
    const vs = samples.get(v.id) || [];
    const vDur = vs.length ? (vs[vs.length - 1].cts + vs[vs.length - 1].duration - vs[0].cts) / vs[0].timescale : 0;
    const fps = vDur ? vs.length / vDur : 0;
    // Abstände zwischen Bildern (in Darstellungsreihenfolge)
    const cts = vs.map((s) => s.cts / s.timescale).sort((x, y) => x - y);
    let maxGap = 0;
    for (let i = 1; i < cts.length; i++) maxGap = Math.max(maxGap, cts[i] - cts[i - 1]);
    facts.video = { codec: v.codec, width: v.video?.width, height: v.video?.height, frames: vs.length, duration: vDur, fps, maxGap };
    add('Video-Codec H.264/HEVC', /^avc1|^avc3|^hvc1|^hev1/.test(v.codec), /^hvc1|^hev1/.test(v.codec) ? `${v.codec} (HEVC wie iPhone-Kamera)` : v.codec);
    add('Hochformat 9:16', v.video && Math.abs(v.video.width / v.video.height - 9 / 16) < 0.01, `${v.video?.width} × ${v.video?.height}`);
    add(`Bildrate ${expectedFps} fps`, Math.abs(fps - expectedFps) < expectedFps * 0.1, `${fps.toFixed(1)} fps`);
    // Konstante Bildrate: alle Bild-Abstände gleich (± 2 ms)
    const durs = vs.map((s) => s.duration / s.timescale);
    const cfr = durs.length > 1 && Math.max(...durs.slice(0, -1)) - Math.min(...durs.slice(0, -1)) < 0.002;
    facts.video_cfr = cfr;
    add('Konstante Bildrate (CFR)', cfr, cfr ? 'ja' : 'schwankend (VFR)');
    add('Keine eingefrorenen Bilder', maxGap < 0.25, `größte Lücke ${(maxGap * 1000).toFixed(0)} ms`);
  } else {
    add('Videospur vorhanden', false, 'fehlt');
  }

  if (a) {
    const as = samples.get(a.id) || [];
    const ts = as.length ? as[0].timescale : 1;
    const aDur = as.length ? (as[as.length - 1].dts + as[as.length - 1].duration - as[0].dts) / ts : 0;
    // Lücken/Überlappungen im Ton: dts muss lückenlos fortlaufen
    let gaps = 0;
    let gapTime = 0;
    for (let i = 1; i < as.length; i++) {
      const expect = as[i - 1].dts + as[i - 1].duration;
      const diff = (as[i].dts - expect) / ts;
      if (Math.abs(diff) > 0.005) {
        gaps++;
        gapTime += Math.abs(diff);
      }
    }
    facts.audio = { codec: a.codec, sampleRate: a.audio?.sample_rate, channels: a.audio?.channel_count, duration: aDur, packets: as.length, gaps, gapTime };
    add('Ton-Codec AAC', /^mp4a/.test(a.codec), a.codec);
    add('Ton 48 kHz', a.audio?.sample_rate === 48000, `${a.audio?.sample_rate} Hz, ${a.audio?.channel_count} Kanal/Kanäle`);
    add('Ton lückenlos', gaps === 0, gaps ? `${gaps} Lücken (${(gapTime * 1000).toFixed(0)} ms)` : 'durchgehend');
  } else {
    add('Tonspur vorhanden', false, 'fehlt');
  }

  if (facts.video && facts.audio) {
    const d = Math.abs(facts.video.duration - facts.audio.duration);
    add('Bild und Ton gleich lang', d < 0.5, `Video ${facts.video.duration.toFixed(1)} s / Ton ${facts.audio.duration.toFixed(1)} s`);
  }
  if (expectedDuration && facts.audio) {
    add('Ton vollständig', facts.audio.duration > expectedDuration - 0.5, `${facts.audio.duration.toFixed(1)} von ${expectedDuration.toFixed(1)} s`);
  }
  return { ok: checks.every((c) => c.ok), checks, facts };
}

/**
 * Packt eine (fragmentierte) MP4 ohne Neukodierung in eine normale MP4 mit
 * Inhaltsverzeichnis am Anfang um. Zeitstempel bleiben erhalten (Synchronität).
 */
export async function remuxToProgressive(parsed) {
  const { Muxer, StreamTarget } = await import('mp4-muxer');
  const { file, info, samples } = parsed;
  const v = info.videoTracks?.[0];
  const a = info.audioTracks?.[0];
  const vCodec = v && muxerCodec(v.codec);
  const aCodec = a && muxerCodec(a.codec);
  if (!vCodec) throw new Error(`Video-Codec ${v?.codec} nicht unterstützt`);
  const vs = (samples.get(v.id) || []).slice().sort((x, y) => x.dts - y.dts);
  const as = a ? (samples.get(a.id) || []).slice().sort((x, y) => x.dts - y.dts) : [];
  if (!vs.length) throw new Error('keine Videobilder');
  // Video nicht länger als der Ton (Aufnahme läuft am Ende kurz nach)
  if (as.length) {
    const aEnd = (as[as.length - 1].dts + as[as.length - 1].duration) / as[0].timescale;
    const lastKeep = vs.filter((s) => s.cts / s.timescale <= aEnd + 0.05);
    if (lastKeep.length > 10) vs.splice(0, vs.length, ...lastKeep);
  }

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
        const x = Math.max(pos, p.pos);
        const y = Math.min(pos + copy.length, p.pos + p.d.length);
        if (x < y) p.d.set(copy.subarray(x - pos, y - pos), x - p.pos);
      }
      if (pos + copy.length > size) {
        const extra = copy.slice(size - pos);
        parts.push({ pos: size, d: extra });
        size += extra.length;
      }
    },
  });
  const muxer = new Muxer({
    target,
    video: { codec: vCodec, width: v.video.width, height: v.video.height },
    ...(aCodec ? { audio: { codec: aCodec, numberOfChannels: a.audio.channel_count, sampleRate: a.audio.sample_rate } } : {}),
    fastStart: { expectedVideoChunks: vs.length + 2, expectedAudioChunks: as.length + 2 },
    firstTimestampBehavior: 'cross-track-offset',
  });

  // Gemeinsamer Nullpunkt für beide Spuren (erhält die Synchronität)
  const t0 = Math.min(vs[0].cts / vs[0].timescale, as.length ? as[0].dts / as[0].timescale : Infinity);
  const vDesc = descriptionFor(file, v.id);
  vs.forEach((s, i) => {
    const ts = Math.round((s.cts / s.timescale - t0) * US);
    const dur = Math.max(1, Math.round((s.duration / s.timescale) * US));
    const cto = Math.round(((s.cts - s.dts) / s.timescale) * US);
    const meta = i === 0 ? { decoderConfig: { codec: v.codec, codedWidth: v.video.width, codedHeight: v.video.height, description: vDesc, colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false } } } : undefined;
    muxer.addVideoChunkRaw(new Uint8Array(s.data), s.is_sync ? 'key' : 'delta', Math.max(0, ts), dur, meta, cto);
    s.data = null; // sofort freigeben
  });
  if (aCodec) {
    const aDesc = descriptionFor(file, a.id);
    as.forEach((s, i) => {
      const ts = Math.round((s.dts / s.timescale - t0) * US);
      const dur = Math.max(1, Math.round((s.duration / s.timescale) * US));
      const meta = i === 0 ? { decoderConfig: { codec: a.codec, sampleRate: a.audio.sample_rate, numberOfChannels: a.audio.channel_count, description: aDesc } } : undefined;
      muxer.addAudioChunkRaw(new Uint8Array(s.data), 'key', Math.max(0, ts), dur, meta);
      s.data = null;
    });
  }
  muxer.finalize();
  const blob = new Blob(
    parts.map((p) => p.d),
    { type: 'video/mp4' },
  );
  parts.length = 0;
  return blob;
}
