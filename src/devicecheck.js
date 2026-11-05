// Geräte-Prüfung: Welche Video-/Ton-Encoder kann dieses iPhone im Browser?
// Ergebnis wird angezeigt und kann kopiert und dem Entwickler geschickt werden.

const tryCfg = async (Enc, cfg) => {
  if (typeof Enc === 'undefined') return 'fehlt';
  try {
    const r = await Promise.race([Enc.isConfigSupported(cfg), new Promise((_, j) => setTimeout(() => j(new Error('Zeit')), 4000))]);
    return r.supported ? 'ja' : 'nein';
  } catch (e) {
    return `Fehler: ${e.message}`.slice(0, 60);
  }
};

/** Liefert eine Liste möglicher H.264-Konfigurationen (von anspruchsvoll bis minimal). */
export function h264Candidates(W, H, fps, bitrate) {
  const out = [];
  for (const codec of ['avc1.640028', 'avc1.64002a', 'avc1.640033', 'avc1.4d0028', 'avc1.4d0033', 'avc1.42e028', 'avc1.42e033', 'avc1.42001f']) {
    out.push({ codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } });
    out.push({ codec, width: W, height: H, bitrate, framerate: fps });
    out.push({ codec, width: W, height: H });
  }
  return out;
}

export async function runDeviceCheck() {
  const lines = [];
  lines.push(`Browser: ${navigator.userAgent}`);
  lines.push(`WebCodecs: VideoEncoder=${typeof VideoEncoder !== 'undefined'} AudioEncoder=${typeof AudioEncoder !== 'undefined'} VideoFrame=${typeof VideoFrame !== 'undefined'}`);
  for (const [W, H] of [[720, 1280], [1080, 1920]]) {
    const ok = [];
    for (const cfg of h264Candidates(W, H, 30, 4_000_000)) {
      const r = await tryCfg(typeof VideoEncoder !== 'undefined' ? VideoEncoder : undefined, cfg);
      if (r === 'ja') ok.push(`${cfg.codec}${cfg.avc ? '+avc' : ''}${cfg.bitrate ? '' : ' (minimal)'}`);
      if (r.startsWith('Fehler') && ok.length === 0 && cfg === h264Candidates(W, H, 30, 4_000_000)[0]) ok.push(`(${r})`);
    }
    lines.push(`H.264 ${W}×${H}: ${ok.length ? ok.join(', ') : 'keine Variante'}`);
  }
  const aac = await tryCfg(typeof AudioEncoder !== 'undefined' ? AudioEncoder : undefined, { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 160000 });
  const aac44 = await tryCfg(typeof AudioEncoder !== 'undefined' ? AudioEncoder : undefined, { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128000 });
  const opus = await tryCfg(typeof AudioEncoder !== 'undefined' ? AudioEncoder : undefined, { codec: 'opus', sampleRate: 48000, numberOfChannels: 2 });
  lines.push(`AAC 48 kHz: ${aac} · AAC 44,1 kHz: ${aac44} · Opus: ${opus}`);
  const mr = typeof MediaRecorder === 'undefined' ? ['fehlt'] : ['video/mp4;codecs="avc1.640028,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm'].map((m) => `${m}=${MediaRecorder.isTypeSupported(m) ? 'ja' : 'nein'}`);
  lines.push(`MediaRecorder: ${mr.join(' · ')}`);
  lines.push(`Bildschirm: ${screen.width}×${screen.height} @${devicePixelRatio}x, Kerne: ${navigator.hardwareConcurrency || '?'}`);
  return lines.join('\n');
}
