// Der Video-Renderer.
// Zeichnet Bilder (mit langsamem Zoom = "Ken-Burns-Effekt"), Untertitel und
// einen Titel auf ein unsichtbares 9:16-Zeichenfeld (Canvas) und nimmt das
// zusammen mit der Sprachspur als Video auf. Auf dem iPhone (Safari)
// entsteht dabei direkt eine MP4-Datei (H.264 + AAC).

import { buildOverlays, drawOverlays, scheduleSfx, addFollowOverlay } from './anim/overlays.js';
import { h264Candidates } from './devicecheck.js';
import { cachedGradient, cachedLayer } from './util.js';

const FPS = 30;
const TRANSITIONS = ['whip', 'zoom', 'slide', 'flash'];
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function pickMimeType() {
  const candidates = [
    'video/mp4;codecs="avc1.640028,mp4a.40.2"',
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return null;
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

export class VideoRenderer {
  constructor({ width, height, images, scenes, sceneTimes, subtitles, title, audio, follow = null, mood = 'dark' }) {
    this.mood = mood;
    this.W = width;
    this.H = height;
    this.images = images;
    this.scenes = scenes;
    this.sceneTimes = sceneTimes;
    this.subtitles = subtitles;
    this.title = title;
    this.audio = audio;
    this.duration = audio.duration;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.g = this.canvas.getContext('2d', { alpha: false });
    this.font = '"Arial Black", "Helvetica Neue", Helvetica, system-ui, sans-serif';
    // Ab wann jede Szene im Bild ist (leicht vor dem Sprechbeginn).
    this.sceneStarts = sceneTimes.map((st, i) => {
      if (i === 0) return 0;
      // Mit Pause davor: Schnitt kurz nach dem vorherigen Satz (Pause läuft schon im neuen Bild)
      if (scenes[i]?.pauseBefore) return Math.min(st.start - 0.12, sceneTimes[i - 1].end + 0.35);
      return Math.max(0, st.start - 0.12);
    });
    // Motion Graphics (Pop-ups, Labels) + Soundeffekte
    const withEffects = scenes.map((sc, i) => ({ ...sc, _effect: images[i]?.spec?.effect, _action: images[i]?.spec?.actors?.[0]?.action }));
    const { overlays, sfx } = buildOverlays(withEffects, this.sceneStarts, sceneTimes, subtitles, this.duration);
    addFollowOverlay(overlays, sfx, follow, this.duration);
    this.overlays = overlays;
    this.sfx = sfx;
    this.punches = overlays.filter((o) => o.type === 'popup' || o.type === 'insert').map((o) => o.start);
    // Wenn ein Handy eingeblendet wird, schaut die Figur in dieser Szene aufs Handy
    for (const o of overlays) {
      const phoneish = (o.type === 'insert' && o.insert === 'phone') || (o.type === 'strike' && (o.icon === 'wifi' || o.icon === '📱'));
      if (!phoneish) continue;
      const spec = images[o.scene]?.spec;
      const a0 = spec?.actors?.[0];
      if (a0 && !['get_up', 'run', 'flee', 'walk', 'sleep', 'swim', 'float'].includes(a0.action)) a0.action = 'phone';
      else if (spec && !a0) spec.actors.push({ action: 'phone' });
    }
  }

  // Kamera: dezente Bewegung je Szene + kurzer Zoom-"Punch" bei jedem Pop-up
  camera(i, t) {
    const start = this.sceneStarts[i];
    const end = i + 1 < this.sceneStarts.length ? this.sceneStarts[i + 1] : this.duration;
    const p = Math.min(1, Math.max(0, (t - start) / Math.max(0.5, end - start)));
    const move = i % 4;
    let scale = 1.06;
    let dx = 0;
    if (move === 0) scale = 1.02 + 0.07 * p; // langsam hinein
    if (move === 1) dx = (p - 0.5) * 0.04; // Schwenk
    if (move === 2) scale = 1.09 - 0.06 * p; // heraus
    if (move === 3) dx = (0.5 - p) * 0.04;
    let punch = 0;
    for (const ts of this.punches) {
      const a = t - ts;
      if (a > 0 && a < 1.2) punch = Math.max(punch, Math.min(1, a / 0.08) * Math.exp(-a * 3.5));
    }
    // Einstiegs-Punch am Szenenanfang
    const a0 = t - start;
    if (i > 0 && a0 > 0 && a0 < 1) punch = Math.max(punch, Math.exp(-a0 * 5) * 0.8);
    return { scale: scale + punch * 0.045, dx };
  }

  drawSceneCam(i, t, { alpha = 1, dx = 0, dy = 0, zoom = 1 } = {}) {
    const { g, W, H } = this;
    const cam = this.camera(i, t);
    const s = cam.scale * zoom;
    g.save();
    g.translate(W / 2 + (cam.dx + dx) * W, H / 2 + dy * H);
    g.scale(s, s);
    g.translate(-W / 2, -H / 2);
    this.drawScene(i, t, alpha);
    g.restore();
  }

  // ------------------------------------------------------------ Zeichnen --

  drawFrame(t) {
    const { g, W, H } = this;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);

    const i = this.sceneIndexAt(t);
    const T = this.scenes[i]?.transition === 'fade' ? 0.9 : 0.42;
    const sceneStart = this.sceneStarts[i];
    const since = t - sceneStart;
    if (i > 0 && since < T) {
      // Abwechslungsreiche Übergänge
      const k = easeInOut(Math.max(0, since / T));
      const wanted = this.scenes[i]?.transition;
      const type = ['whip', 'zoom', 'slide', 'flash', 'cut', 'fade'].includes(wanted) ? wanted : TRANSITIONS[(i - 1) % TRANSITIONS.length];
      if (type === 'whip') {
        this.drawSceneCam(i - 1, t, { dx: -k });
        this.drawSceneCam(i, t, { dx: 1 - k });
        g.fillStyle = `rgba(255,255,255,${0.25 * Math.sin(k * Math.PI)})`;
        for (let y = 0; y < H; y += H / 40) g.fillRect(0, y, W, H / 160);
      } else if (type === 'zoom') {
        if (k < 0.5) this.drawSceneCam(i - 1, t, { zoom: 1 + k * 1.2 });
        else this.drawSceneCam(i, t, { zoom: 1.3 - (k - 0.5) * 0.6 });
        g.fillStyle = `rgba(255,255,255,${0.55 * Math.sin(k * Math.PI)})`;
        g.fillRect(0, 0, W, H);
      } else if (type === 'cut') {
        // harter Schnitt mit kurzem Zoom-Einstieg
        this.drawSceneCam(i, t, { zoom: 1.08 - 0.08 * k });
      } else if (type === 'fade') {
        // langsam durch Schwarz
        if (k < 0.5) this.drawSceneCam(i - 1, t);
        else this.drawSceneCam(i, t);
        g.fillStyle = `rgba(0,0,0,${Math.sin(k * Math.PI)})`;
        g.fillRect(0, 0, W, H);
      } else if (type === 'slide') {
        this.drawSceneCam(i - 1, t, { dy: -k * 0.25, alpha: 1 });
        this.drawSceneCam(i, t, { dy: 1 - k });
      } else {
        this.drawSceneCam(k < 0.5 ? i - 1 : i, t);
        g.fillStyle = `rgba(255,255,255,${Math.sin(k * Math.PI)})`;
        g.fillRect(0, 0, W, H);
      }
    } else {
      this.drawSceneCam(i, t);
    }

    // Abdunkeln unten (bessere Lesbarkeit der Untertitel) und oben
    const animMode = this.images[i]?.isAnim;
    // Abdunklung oben/unten als fertige Ebene (einmal berechnet)
    const shade = cachedLayer(`shade|${animMode ? 1 : 0}|${W}|${H}`, W, H, (lg) => {
      const gTop = animMode ? H * 0.66 : H * 0.45;
      const grad = lg.createLinearGradient(0, gTop, 0, H);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, animMode ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.72)');
      lg.fillStyle = grad;
      lg.fillRect(0, gTop, W, H - gTop);
      const top = lg.createLinearGradient(0, 0, 0, H * 0.2);
      top.addColorStop(0, 'rgba(0,0,0,0.5)');
      top.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = top;
      lg.fillRect(0, 0, W, H * 0.2);
    });
    if (!animMode || this.images[i]?.needsShade) g.drawImage(shade.img, 0, 0, W, H); // bei 2D-Animationen schon im Hintergrund enthalten

    drawOverlays(g, W, H, t, this.overlays, this.font);
    this.drawTitle(t);
    this.drawSubtitle(t);
    this.drawProgress(t);
  }

  sceneIndexAt(t) {
    let i = 0;
    while (i + 1 < this.sceneStarts.length && t >= this.sceneStarts[i + 1]) i++;
    return i;
  }

  drawScene(i, t, alpha) {
    const { g, W, H } = this;
    const img = this.images[i];
    if (!img || alpha <= 0) return;
    const start = this.sceneStarts[i];
    const end = i + 1 < this.sceneStarts.length ? this.sceneStarts[i + 1] : this.duration;
    if (img.isAnim) {
      // Strichmännchen-Animation: zeichnet sich selbst passend zur Szenenzeit
      g.save();
      g.globalAlpha = alpha;
      img.draw(g, W, H, Math.max(0, t - start), Math.max(0.5, end - start));
      g.restore();
      return;
    }
    const p = Math.min(1, Math.max(0, (t - start) / Math.max(0.1, end - start)));
    const ease = p * p * (3 - 2 * p) * 0.6 + p * 0.4;
    const iw = img.width;
    const ih = img.height;
    const cover = Math.max(W / iw, H / ih);
    // Abwechselnd hinein- und herauszoomen, mit leichtem Schwenk
    const zoomIn = i % 2 === 0;
    const z = zoomIn ? 1.04 + 0.14 * ease : 1.18 - 0.14 * ease;
    const s = cover * z;
    const dw = iw * s;
    const dh = ih * s;
    const dir = [1, -1, 0.5, -0.5][i % 4];
    const panX = (dw - W) * 0.5 * dir * (ease - 0.5);
    const panY = (dh - H) * 0.3 * (ease - 0.5);
    g.globalAlpha = alpha;
    g.drawImage(img, (W - dw) / 2 + panX, (H - dh) / 2 + panY, dw, dh);
    g.globalAlpha = 1;
  }

  drawTitle(t) {
    const show = 3.2;
    if (t > show + 0.4) return;
    const { g, W, H } = this;
    const a = t < show ? Math.min(1, t / 0.25) : 1 - (t - show) / 0.4;
    const pop = t < 0.25 ? 0.85 + 0.15 * (t / 0.25) : 1;
    g.save();
    g.globalAlpha = Math.max(0, a);
    g.translate(W / 2, H * 0.17);
    g.scale(pop, pop);
    const size = Math.round(W * 0.058);
    g.font = `900 ${size}px ${this.font}`;
    const lines = wrap(g, this.title, W * 0.8);
    const lh = size * 1.25;
    const boxH = lines.length * lh + size * 0.9;
    const boxW = Math.min(W * 0.9, Math.max(...lines.map((l) => g.measureText(l).width)) + size * 1.4);
    g.fillStyle = 'rgba(255, 214, 10, 0.96)';
    roundRect(g, -boxW / 2, -boxH / 2, boxW, boxH, size * 0.45);
    g.fill();
    g.fillStyle = '#111';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, k) => g.fillText(l, 0, -((lines.length - 1) * lh) / 2 + k * lh));
    g.restore();
  }

  drawSubtitle(t) {
    const chunk = this.subtitles.find((c) => t >= c.start && t < c.end);
    if (!chunk) return;
    const { g, W, H } = this;
    const age = t - chunk.start;
    const pop = age < 0.12 ? 0.82 + 0.18 * (age / 0.12) : 1;
    let size = Math.round(W * 0.088);
    const maxW = W * 0.88;
    const upper = (w) => w.toLocaleUpperCase('de-DE');
    const words = chunk.words.map((w) => upper(w.word));
    g.font = `900 ${size}px ${this.font}`;
    const spaceW = () => g.measureText(' ').width;
    let total = g.measureText(words.join(' ')).width;
    while (total > maxW && size > W * 0.06) {
      size -= 2;
      g.font = `900 ${size}px ${this.font}`;
      total = g.measureText(words.join(' ')).width;
    }
    // Zeilen bilden (meist 1 Zeile)
    const lines = [];
    let cur = [];
    for (let k = 0; k < chunk.words.length; k++) {
      const test = [...cur, chunk.words[k]].map((w) => upper(w.word)).join(' ');
      if (cur.length && g.measureText(test).width > maxW) {
        lines.push(cur);
        cur = [];
      }
      cur.push(chunk.words[k]);
    }
    lines.push(cur);

    g.save();
    g.translate(W / 2, this.images[chunk.scene]?.spec?.place === 'black' ? H * 0.5 : H * 0.7);
    g.scale(pop, pop);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.lineJoin = 'round';
    const lh = size * 1.2;
    lines.forEach((line, li) => {
      const text = line.map((w) => upper(w.word)).join(' ');
      const lw = g.measureText(text).width;
      let x = -lw / 2;
      const y = -((lines.length - 1) * lh) / 2 + li * lh;
      for (const w of line) {
        const active = t >= w.start && t < w.end + 0.05;
        const word = upper(w.word);
        g.lineWidth = size * 0.24;
        g.strokeStyle = '#000';
        g.strokeText(word, x, y);
        g.fillStyle = active ? '#A6FF3B' : '#FFFFFF';
        g.fillText(word, x, y);
        x += g.measureText(word).width + spaceW();
      }
    });
    g.restore();
  }

  drawProgress(t) {
    const { g, W } = this;
    const h = Math.max(4, Math.round(W * 0.007));
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, 0, W, h);
    g.fillStyle = '#FFD60A';
    g.fillRect(0, 0, W * Math.min(1, t / this.duration), h);
  }

  // ----------------------------------------------------------- Aufnahme --

  // ------------------------------------------------- Sauberer MP4-Export --
  // Erzeugt eine "normale" MP4-Datei: exakt 30 Bilder/s (H.264) + AAC-Ton.
  // Bild für Bild statt Echtzeit-Aufnahme → kein Ruckeln/Versatz nach dem
  // Hochladen auf TikTok, und meist schneller als Echtzeit.
  static async canExportMp4() {
    return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && typeof VideoFrame !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
  }

  async exportMp4({ music = true, onProgress, allowNonAac = false } = {}) {
    const { Muxer, StreamTarget } = await import('mp4-muxer');
    const W = this.W;
    const H = this.H;
    const lead = 0.15;
    const total = this.duration + lead + 0.35;
    const sr = 48000;

    // 1) Ton offline mischen (Stimme + Musik + Effekte, mit Limiter)
    const off = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const master = off.createGain();
    const limiter = off.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    const outGain = off.createGain();
    outGain.gain.value = 0.9;
    master.connect(limiter);
    limiter.connect(outGain);
    outGain.connect(off.destination);
    const voice = off.createBufferSource();
    voice.buffer = normalizeBuffer(off, this.audio, 0.8);
    voice.connect(master);
    voice.start(lead);
    if (music) {
      startAmbientMusic(off, master, this.duration, [], this.mood);
      scheduleSfx(off, master, this.sfx, lead);
    }
    onProgress?.(0);
    let mixed = await withTimeout(off.startRendering(), 60000, 'Ton-Mischung');

    // 2) Codecs wählen (H.264 + AAC bevorzugt)
    const vBase = { width: W, height: H, bitrate: W >= 1080 ? 5_000_000 : 3_500_000, framerate: FPS, latencyMode: 'quality' };
    let vcfg = null;
    // Viele Varianten probieren (manche iPhones/iOS-Versionen akzeptieren nur einzelne)
    for (const cand of h264Candidates(W, H, FPS, vBase.bitrate)) {
      const cfg = { ...cand, latencyMode: 'quality' };
      for (const c of [cfg, cand]) {
        try {
          if ((await withTimeout(VideoEncoder.isConfigSupported(c), 4000, 'Video-Encoder')).supported) {
            vcfg = c;
            break;
          }
        } catch {
          /* weiter */
        }
      }
      if (vcfg) break;
    }
    if (!vcfg && allowNonAac) {
      const cfg = { ...vBase, codec: 'vp09.00.40.08' };
      if ((await withTimeout(VideoEncoder.isConfigSupported(cfg), 4000, 'Video-Encoder')).supported) vcfg = cfg;
    }
    if (!vcfg) throw new Error('H.264-Encoder nicht verfügbar');
    let acfg = { codec: 'mp4a.40.2', sampleRate: sr, numberOfChannels: 2, bitrate: 192_000 };
    let aSupported = false;
    try {
      aSupported = (await withTimeout(AudioEncoder.isConfigSupported(acfg), 4000, 'Audio-Encoder')).supported;
    } catch {
      aSupported = false;
    }
    if (!aSupported) {
      if (!allowNonAac) throw new Error('AAC-Encoder nicht verfügbar');
      acfg = { codec: 'opus', sampleRate: sr, numberOfChannels: 2, bitrate: 192_000 };
    }

    // Speichersparend: fertige Datei-Stücke nacheinander einsammeln (nicht doppelt
    // im Speicher). Spätere Korrekturen am Dateianfang werden direkt eingetragen.
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
    const frames = Math.ceil(total * FPS);
    const muxer = new Muxer({
      target,
      video: { codec: vcfg.codec.startsWith('avc') ? 'avc' : 'vp9', width: W, height: H, frameRate: FPS },
      audio: { codec: acfg.codec === 'opus' ? 'opus' : 'aac', numberOfChannels: 2, sampleRate: sr },
      // Platz für das Inhaltsverzeichnis am Anfang reservieren → normale MP4, Index vorne
      fastStart: { expectedVideoChunks: frames + 2, expectedAudioChunks: Math.ceil((total * sr) / 480) + 64 },
      firstTimestampBehavior: 'offset',
    });
    let failure = null;
    let venc = null;
    let aenc = null;
    // Bei Fehler/Abbruch: Encoder schließen und Speicher sofort freigeben, damit die
    // Echtzeit-Aufnahme danach nicht obendrauf läuft und abstürzt
    const cleanup = () => {
      for (const enc of [venc, aenc]) {
        try {
          if (enc && enc.state !== 'closed') enc.close();
        } catch {
          /* egal */
        }
      }
      parts.length = 0;
    };
    this._cleanupExport = cleanup;
    const safe = (fn) => (c, m) => {
      try {
        fn(c, m);
      } catch (e) {
        failure = e;
      }
    };
    venc = new VideoEncoder({ output: safe((c, m) => muxer.addVideoChunk(c, m)), error: (e) => (failure = e) });
    venc.configure(vcfg);
    aenc = new AudioEncoder({ output: safe((c, m) => muxer.addAudioChunk(c, m)), error: (e) => (failure = e) });
    aenc.configure(acfg);

    // 3) Ton kodieren
    let L = mixed.getChannelData(0);
    let R = mixed.getChannelData(1);
    const step = 4800;
    for (let i = 0; i < mixed.length; i += step) {
      const n = Math.min(step, mixed.length - i);
      const data = new Float32Array(n * 2);
      data.set(L.subarray(i, i + n), 0);
      data.set(R.subarray(i, i + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / sr) * 1e6), data });
      aenc.encode(ad);
      ad.close();
    }
    await withTimeout(aenc.flush(), 30000, 'Audio-Encoder');
    if (failure) throw failure;
    // Ton-Rohdaten werden nicht mehr gebraucht → Speicher frei
    L = R = null;
    mixed = null;

    // 4) Bild für Bild zeichnen und kodieren
    const yieldUI = () => new Promise((r) => setTimeout(r, 0));
    for (let n = 0; n < frames; n++) {
      if (failure) {
        cleanup();
        throw failure;
      }
      const t = n / FPS - lead;
      this.drawFrame(Math.max(0, Math.min(t, this.duration)));
      const frame = new VideoFrame(this.canvas, { timestamp: Math.round((n * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      venc.encode(frame, { keyFrame: n % (FPS * 2) === 0 });
      frame.close();
      const waitStart = performance.now();
      while (venc.encodeQueueSize > 2) {
        if (performance.now() - waitStart > 15000) {
          cleanup();
          throw new Error('Video-Encoder hängt');
        }
        await new Promise((r) => setTimeout(r, 4));
      }
      if (n % 6 === 0) {
        onProgress?.(n / frames);
        await yieldUI();
      }
      // jede Sekunde Video kurz durchatmen, damit Safari aufräumen kann
      if (n % FPS === 0) await new Promise((r) => setTimeout(r, 25));
    }
    await withTimeout(venc.flush(), 30000, 'Video-Encoder');
    if (failure) throw failure;
    muxer.finalize();
    venc.close();
    aenc.close();
    onProgress?.(1);
    const blob = new Blob(
      parts.map((p) => p.d),
      { type: 'video/mp4' },
    );
    parts.length = 0;
    return blob;
  }

  async record(ctx, { music = true, monitor = true, onProgress, mimeType, ensureAudio = tryResume } = {}) {
    const mt = mimeType ?? pickMimeType();
    if (mt === null || typeof this.canvas.captureStream !== 'function') {
      throw new Error('Dein Browser kann keine Videos aufnehmen. Bitte Safari (iOS 15+) oder Chrome verwenden.');
    }
    // iOS hält die Audio-Uhr manchmal an (z. B. wenn eine andere App Ton
    // abspielt). Ohne laufende Audio-Uhr würde die Aufnahme bei 0 s hängen.
    await ensureAudio(ctx);

    const dest = ctx.createMediaStreamDestination();
    // Tonmischung: alles läuft durch einen Limiter, damit nichts übersteuert
    // (TikTok macht beim Hochladen lauter – Übersteuerung klingt dann verzerrt).
    const master = ctx.createGain();
    master.gain.value = 1;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    const outGain = ctx.createGain();
    outGain.gain.value = 0.9;
    master.connect(limiter);
    limiter.connect(outGain);
    outGain.connect(dest);
    if (monitor) outGain.connect(ctx.destination);

    const voice = ctx.createBufferSource();
    voice.buffer = normalizeBuffer(ctx, this.audio, 0.8);
    voice.connect(master);

    let stopMusic = () => {};
    if (music) stopMusic = startAmbientMusic(ctx, master, this.duration, [], this.mood);

    this.drawFrame(0);
    const videoStream = this.canvas.captureStream(FPS);
    const stream = new MediaStream([...videoStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const opts = { videoBitsPerSecond: this.W >= 1080 ? 8_000_000 : 5_000_000, audioBitsPerSecond: 192_000 };
    if (mt) opts.mimeType = mt;
    const rec = new MediaRecorder(stream, opts);
    const chunks = [];
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((resolve, reject) => {
      rec.onstop = resolve;
      rec.onerror = (e) => reject(e.error || new Error('Aufnahmefehler'));
    });

    rec.start(1000);
    const t0 = ctx.currentTime + 0.15;
    voice.start(t0);
    const stopSfx = music ? scheduleSfx(ctx, master, this.sfx, t0) : () => {};

    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
    let lastCt = ctx.currentTime;
    let lastChange = performance.now();
    let lastDraw = -1e9;
    for (;;) {
      await nextFrame();
      const now = performance.now();
      // Genau ~30 Bilder/s zeichnen – iPhones mit 120-Hz-Bildschirm würden sonst
      // 120 Bilder/s zeichnen (4× so viel Arbeit wie nötig).
      if (now - lastDraw < 1000 / FPS - 3) continue;
      lastDraw = now;
      if (ctx.currentTime !== lastCt) {
        lastCt = ctx.currentTime;
        lastChange = now;
      } else if (now - lastChange > 1200) {
        // Audio-Uhr steht: Aufnahme pausieren, Ton wieder starten, weitermachen.
        if (rec.state === 'recording') rec.pause();
        await ensureAudio(ctx);
        if (rec.state === 'paused') rec.resume();
        lastCt = ctx.currentTime;
        lastChange = performance.now();
        continue;
      }
      const t = ctx.currentTime - t0;
      this.drawFrame(Math.max(0, Math.min(t, this.duration)));
      onProgress?.(Math.max(0, Math.min(1, t / this.duration)));
      if (t >= this.duration + 0.25) break;
    }

    rec.stop();
    stopMusic();
    stopSfx();
    await stopped;
    videoStream.getTracks().forEach((tr) => tr.stop());
    try {
      voice.disconnect();
      master.disconnect();
      outGain.disconnect();
    } catch {
      /* egal */
    }
    const type = (rec.mimeType || mt || 'video/mp4').split(';')[0];
    return new Blob(chunks, { type });
  }
}

// Wartet höchstens ms Millisekunden auf ein Promise (sonst Fehler)
function withTimeout(promise, ms, what) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} antwortet nicht`)), ms))]);
}

// Stimme auf einheitliche Lautstärke bringen (Spitze = peak), ohne Übersteuerung
function normalizeBuffer(ctx, buf, peak) {
  let max = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > max) max = v;
    }
  }
  if (!max) return buf;
  const k = peak / max;
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * k;
  }
  return out;
}

// Versucht den Ton fortzusetzen, wartet aber nicht ewig darauf.
export async function tryResume(ctx, ms = 1500) {
  if (ctx.state === 'running') return true;
  try {
    await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, ms))]);
  } catch {
    /* egal */
  }
  return ctx.state === 'running';
}

// Leiser, selbst erzeugter Hintergrund-Sound (keine Urheberrechtsprobleme):
// ein sphärischer Klangteppich plus "Whoosh" bei jedem Szenenwechsel.
function startAmbientMusic(ctx, out, duration, sceneStarts, mood = 'dark') {
  const now = ctx.currentTime + 0.15;
  const dark = mood === 'dark';
  const bus = ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  const vol = dark ? 0.075 : 0.05;
  bus.gain.linearRampToValueAtTime(vol, now + 2);
  bus.gain.setValueAtTime(vol, now + duration - 1.5);
  bus.gain.linearRampToValueAtTime(0, now + duration);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = dark ? 520 : 900;
  lp.Q.value = 0.7;
  lp.connect(bus);
  bus.connect(out);

  const nodes = [];
  // A-Moll-Akkordfolge, langsam wechselnd
  const chords = [
    [110, 130.81, 164.81],
    [87.31, 130.81, 174.61],
    [98, 123.47, 146.83],
    [82.41, 123.47, 164.81],
  ];
  const step = 6;
  for (let v = 0; v < 3; v++) {
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      for (let k = 0; k * step < duration + step; k++) {
        o.frequency.setTargetAtTime(chords[k % chords.length][v] * (dark ? 0.5 : 1), now + k * step, 0.8);
      }
      const og = ctx.createGain();
      og.gain.value = 0.22;
      o.connect(og);
      og.connect(lp);
      o.start(now);
      o.stop(now + duration + 0.5);
      nodes.push(o);
    }
  }
  // Langsame Filterbewegung
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 400;
  lfo.connect(lfoGain);
  lfoGain.connect(lp.frequency);
  lfo.start(now);
  lfo.stop(now + duration + 0.5);
  nodes.push(lfo);

  // Dezenter Bass-Puls (Spannung wie in Doku-Trailern)
  for (let b = 2; b < duration - 1; b += dark ? 1.7 : 1.25) {
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.frequency.setValueAtTime(70, now + b);
    o.frequency.exponentialRampToValueAtTime(40, now + b + 0.25);
    gn.gain.setValueAtTime(0.0001, now + b);
    gn.gain.exponentialRampToValueAtTime(1.4, now + b + 0.015);
    gn.gain.exponentialRampToValueAtTime(0.0001, now + b + 0.35);
    o.connect(gn);
    gn.connect(bus);
    o.start(now + b);
    o.stop(now + b + 0.4);
    nodes.push(o);
  }

  // Whoosh-Effekt bei Szenenwechseln
  const noise = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  sceneStarts.slice(1).forEach((s) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    const at = now + s - 0.25;
    bp.frequency.setValueAtTime(300, at);
    bp.frequency.exponentialRampToValueAtTime(3000, at + 0.45);
    const wg = ctx.createGain();
    wg.gain.setValueAtTime(0, at);
    wg.gain.linearRampToValueAtTime(0.09, at + 0.25);
    wg.gain.linearRampToValueAtTime(0, at + 0.55);
    src.connect(bp);
    bp.connect(wg);
    wg.connect(out);
    src.start(at);
    src.stop(at + 0.6);
    nodes.push(src);
  });

  return () => {
    nodes.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* schon gestoppt */
      }
    });
    try {
      bus.disconnect();
    } catch {
      /* egal */
    }
  };
}

function wrap(g, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (cur && g.measureText(test).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
