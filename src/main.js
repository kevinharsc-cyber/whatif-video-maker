import './style.css';
import { loadSettings, saveSettings } from './settings.js';
import { generateScript, normalizeTopic } from './script.js';
import { buildOwnScript } from './ownscript.js';
import { parseMp4, qualityReport, remuxToProgressive } from './mp4tools.js';
import { runDeviceCheck } from './devicecheck.js';
import { loadSceneImages } from './images.js';
import { createAnimVisual, normalizeAnim, guessAnim, guessShot, shotSpec } from './anim/scene.js';
import { createAnim3DVisual, webglAvailable, plan3D, dispose3D } from './three/lowpoly.js';
import { createVereinVisuals, prepareVerein } from './verein/verein.js';
import { exportSegmented, segmentedSupported, startJob, loadJob, clearJob, CancelledError } from './exporter.js';
import { synthesize, VOICES, speechWeight, releaseVoices } from './tts.js';
import { buildSubtitles, toSrt } from './subtitles.js';
import { VideoRenderer, pickMimeType, tryResume, FPS } from './renderer.js';

const $ = (id) => document.getElementById(id);
let settings = loadSettings();
let script = null; // { title, topic, scenes:[{text,image_prompt}], hashtags }
let lastVideo = null; // { blob, subtitles, ext }
let busy = false;
let audioCtx = null;
const PREVIEW_EL = document.getElementById('livePreview');

const IDEAS = [
  'Was wäre, wenn die Erde plötzlich stehen bleibt?',
  'Was wäre, wenn der Mond verschwindet?',
  'Was wäre, wenn alle Menschen gleichzeitig springen?',
  'Was wäre, wenn es kein Internet mehr gäbe?',
  'Was wäre, wenn die Sonne für eine Woche ausgeht?',
  'Was wäre, wenn Dinosaurier noch leben würden?',
  'Was wäre, wenn wir nie schlafen müssten?',
  'Was wäre, wenn das Meer verschwindet?',
  'Was wäre, wenn die Schwerkraft halb so stark wäre?',
  'Was wäre, wenn ein schwarzes Loch unser Sonnensystem besucht?',
];

// ------------------------------------------------------------ Helfer UI --

function show(id) {
  for (const s of ['stepTopic', 'stepScript', 'stepProgress', 'stepResult']) {
    $(s).classList.toggle('hidden', !(Array.isArray(id) ? id.includes(s) : s === id));
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function log(msg, level = 'info') {
  const el = document.createElement('div');
  el.className = `log-${level}`;
  el.textContent = msg;
  $('log').prepend(el);
  while ($('log').children.length > 30) $('log').lastChild.remove();
  if (level !== 'info') console.warn(msg);
}

function setStatus(text, progress) {
  $('status').textContent = text;
  if (progress != null) $('bar').style.width = `${Math.round(progress * 100)}%`;
}

function setTask(name, state) {
  const li = document.querySelector(`[data-task="${name}"]`);
  if (li) li.dataset.state = state;
}

function getAudioCtx() {
  // Muss direkt beim Antippen eines Knopfes passieren (Apple-Regel für Ton).
  if (!audioCtx || audioCtx.state === 'closed') {
    const AC = window.AudioContext || window.webkitAudioContext;
    // 48 kHz = Standard für Videos (TikTok/YouTube); vermeidet Umrechnungsfehler
    try {
      audioCtx = new AC({ sampleRate: 48000, latencyHint: 'playback' });
    } catch {
      audioCtx = new AC();
    }
    // Unhörbarer Dauerton: verhindert, dass iOS den Ton während der
    // langen Vorbereitung (Bilder, Stimme) einschlafen lässt.
    try {
      const osc = audioCtx.createOscillator();
      const silent = audioCtx.createGain();
      silent.gain.value = 0;
      osc.connect(silent);
      silent.connect(audioCtx.destination);
      osc.start();
    } catch {
      /* egal */
    }
  }
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  return audioCtx;
}

// Falls iOS den Ton angehalten hat: Knopf anzeigen, ein Tippen startet ihn wieder.
async function ensureAudioRunning(ctx) {
  if (await tryResume(ctx)) return;
  const oldStatus = $('status').textContent;
  setStatus('⏸️ iOS hat den Ton pausiert. Bitte unten auf „Aufnahme fortsetzen“ tippen.');
  const btn = document.createElement('button');
  btn.className = 'primary';
  btn.textContent = '▶️ Aufnahme fortsetzen';
  $('status').after(btn);
  btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => {
    btn.onclick = async () => {
      if (await tryResume(ctx, 2000)) {
        resolve();
      } else {
        setStatus(
          '⚠️ Ton startet nicht. Spielt eine andere App gerade Musik oder Ton ab (z. B. Musik, Podcast, Video)? Bitte dort stoppen und erneut tippen.',
        );
      }
    };
  });
  btn.remove();
  setStatus(oldStatus);
}

// ------------------------------------------------------- Schritt 1 + 2 --

function renderIdeas() {
  const pick = [...IDEAS].sort(() => Math.random() - 0.5).slice(0, 4);
  $('ideas').innerHTML = '';
  for (const idea of pick) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = idea.replace(/^Was wäre, wenn /, '… ');
    b.onclick = () => ($('topic').value = idea);
    $('ideas').append(b);
  }
}

async function onCreateScript() {
  if (busy) return;
  busy = true;
  const btn = $('btnScript');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Skript wird geschrieben …';
  try {
    const topic = normalizeTopic($('topic').value);
    $('topic').value = topic;
    script = await generateScript(topic, settings, log);
    if (script.template) log('Hinweis: Es wurde die eingebaute Vorlage genutzt. Für echte KI-Skripte siehe Einstellungen.', 'warn');
    renderScript();
    show(['stepTopic', 'stepScript']);
    $('stepScript').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    log(`Fehler: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
    busy = false;
  }
}

async function onOwnScript() {
  if (busy) return;
  const raw = $('ownText').value;
  if (!raw.trim()) return log('Bitte zuerst deinen Text einfügen.', 'warn');
  busy = true;
  const btn = $('btnOwn');
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Szenen werden geplant …';
  try {
    script = await buildOwnScript(raw, settings, log);
    $('topic').value = script.topic;
    renderScript();
    show(['stepTopic', 'stepScript']);
    $('stepScript').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    log(`Fehler: ${e.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = old;
    busy = false;
  }
}

function renderScript() {
  $('title').value = script.title;
  const box = $('scenes');
  box.innerHTML = '';
  script.scenes.forEach((sc, i) => {
    const div = document.createElement('div');
    div.className = 'scene';
    div.innerHTML = `
      <div class="scene-head"><b>Szene ${i + 1}${sc.black ? '<span class="scene-flag">⬛ Schwarzbild</span>' : ''}${sc.pauseBefore ? `<span class="scene-flag">⏸ ${sc.pauseBefore} s Pause davor</span>` : ''}</b><button class="x" title="Szene löschen">✕</button></div>
      <textarea rows="3" class="s-text"></textarea>
      <details><summary>Bildbeschreibung (Englisch)</summary><textarea rows="2" class="s-img"></textarea></details>`;
    div.querySelector('.s-text').value = sc.text;
    div.querySelector('.s-img').value = sc.image_prompt;
    div.querySelector('.s-text').oninput = (e) => {
      sc.text = e.target.value;
      updateInfo();
    };
    div.querySelector('.s-img').oninput = (e) => (sc.image_prompt = e.target.value);
    div.querySelector('.x').onclick = () => {
      if (script.scenes.length <= 1) return;
      script.scenes.splice(i, 1);
      renderScript();
    };
    box.append(div);
  });
  updateInfo();
}

function updateInfo() {
  const words = script.scenes.reduce((a, s) => a + s.text.split(/\s+/).filter(Boolean).length, 0);
  const secs = Math.round(script.scenes.reduce((a, s) => a + speechWeight(s.text), 0) / 15.5 / settings.speed);
  $('scriptInfo').textContent = `${script.scenes.length} Szenen · ${words} Wörter · ca. ${secs} Sekunden`;
}

// ----------------------------------------------------------- Schritt 3 --

// Szenen-Bilder (Animationen) für ein Skript aufbauen – immer gleich für dasselbe
// Skript, damit eine abgebrochene Erstellung exakt fortgesetzt werden kann.
function vereinNames() {
  return String(settings.vereinNames || '')
    .split(/[,;\n]/)
    .map((x) => x.trim().replace(/^@/, ''))
    .filter(Boolean);
}

function buildAnimVisuals(sc, visualMode) {
  if (visualMode === 'verein') return createVereinVisuals(sc.scenes, { fans: settings.vereinFans, names: vereinNames(), nets: !!settings.vereinNets });
  const n = sc.scenes.length;
  let gotUp = false;
  let prevShot = null;
  const use3d = visualMode === '3d' && webglAvailable();
  if (visualMode === '3d' && !use3d) log('3D wird von diesem Gerät nicht unterstützt – nutze 2D-Animation.', 'warn');
  const images = sc.scenes.map((scene, i) => {
    if (scene.black) return createAnimVisual({ place: 'black', time: 'night', props: [], actors: [], crowd: { count: 0, action: 'idle' }, effect: 'none' });
    // 1) Film-Einstellung (von Gemini gewählt oder aus dem Satz erkannt)
    //    2) freie Animation von Gemini  3) aus Stichwörtern erraten
    let shot = scene.shot && shotSpec(scene.shot) ? scene.shot : null;
    if (!shot && !scene.anim) shot = guessShot(scene.text, prevShot);
    if (shot === 'wake_up' && gotUp) shot = 'check_phone';
    prevShot = shot;
    let spec = shot ? shotSpec(shot) : null;
    if (spec && scene.anim?.time) spec.time = scene.anim.time;
    if (!spec) spec = normalizeAnim(scene.anim) || guessAnim(scene.text, sc.topic, i, n);
    // Nur einmal aufstehen: weitere "get_up"/"sleep" werden zu "walk"
    const a0 = spec.actors[0];
    if (a0 && a0.action === 'get_up') {
      if (gotUp) a0.action = 'walk';
      gotUp = true;
    } else if (a0 && a0.action === 'sleep' && gotUp) a0.action = 'think';
    // Low-Poly-3D (Grafikchip) – Rückfall auf 2D, falls WebGL fehlt
    if (use3d) return createAnim3DVisual(spec, shot);
    return createAnimVisual(spec, { poly: visualMode === 'poly2d' });
  });
  // 3D: merken, welche Szene welche Umgebung braucht (für das Aufräumen)
  if (use3d) plan3D(images);
  return images;
}

const cancelFlag = { requested: false };

/**
 * Erstellt die Videodatei aus fertigen Zutaten (Bilder, Stimme, Untertitel).
 * Bevorzugt: szenenweiser Export (speichersicher, fortsetzbar).
 * Rückfall: Echtzeit-Aufnahme.
 */
async function produceVideo({ sc, images, width, height, sceneTimes, subtitles, buffer, duration, job, ctx, onStatus }) {
  const audioStub = buffer || { duration };
  const renderer = new VideoRenderer({
    width,
    height,
    images,
    scenes: sc.scenes,
    sceneTimes,
    subtitles,
    title: sc.title,
    audio: audioStub,
    follow: await loadFollowConfig(),
    mood: settings.musicMood,
  });
  // Flüssige Vorschau ohne Kopieren: das Arbeitsbild selbst wird verkleinert angezeigt
  const preview = PREVIEW_EL;
  document.querySelectorAll('.live-canvas').forEach((el) => el.replaceWith(preview));
  renderer.canvas.className = 'live-canvas';
  preview.replaceWith(renderer.canvas);
  const restorePreview = () => {
    if (renderer.canvas.isConnected) renderer.canvas.replaceWith(preview);
  };
  cancelFlag.requested = false;
  $('btnCancel').classList.remove('hidden');
  let blob = null;
  let method = 'Echtzeit-Aufnahme';
  let stats = null;
  try {
    if (job) {
      try {
        // Wächter: 30 s ohne Fortschritt → abbrechen und alten Weg nehmen
        let last = performance.now();
        let watch = null;
        let segStop = false; // stoppt nur diesen Export (nicht den Abbrechen-Knopf)
        const stalled = new Promise((_, rej) => {
          watch = setInterval(() => {
            if (performance.now() - last > 30000) {
              segStop = true;
              rej(new Error('keine Rückmeldung seit 30 s'));
            }
          }, 1000);
        });
        try {
          blob = await Promise.race([
            exportSegmented(renderer, ctx, job, {
              cancel: {
                get requested() {
                  return cancelFlag.requested || segStop;
                },
              },
              log,
              onProgress: (p, text) => {
                last = performance.now();
                onStatus(text || `Video wird erstellt: ${Math.round(p * 100)} % (Szene ${Math.min(job.segDone + 1, job.segs?.length || 1)} von ${job.segs?.length || '?'})`, p);
              },
              onHeartbeat: (hb) => {
                last = performance.now();
                markPhase('export', null, hb);
                stats = hb;
              },
            }),
            stalled,
          ]);
        } finally {
          clearInterval(watch);
        }
        method = `Szene für Szene (${FPS} fps konstant)`;
      } catch (e) {
        if (e instanceof CancelledError || cancelFlag.requested) throw e;
        if (!buffer) throw e; // Fortsetzen ohne Ton-Rohdaten: kein Rückfall möglich
        log(`Speichersicherer Export nicht möglich (${e.message}) – nutze Echtzeit-Aufnahme.`, 'warn');
        markPhase('record', e.message);
        await clearJob();
      }
    }
    if (!blob) {
      blob = await renderer.record(ctx, {
        music: settings.music,
        mimeType: pickMimeType(),
        ensureAudio: ensureAudioRunning,
        onProgress: (p) => onStatus(`Video wird aufgenommen: ${Math.round(p * duration)} / ${Math.round(duration)} s`, p),
      });
    }
  } finally {
    $('btnCancel').classList.add('hidden');
    restorePreview();
    // Grafikspeicher (3D) komplett freigeben, bevor die Datei geprüft wird
    dispose3D();
  }
  // Endkontrolle: Datei prüfen und – falls nötig – in eine normale MP4 umpacken
  let qc = null;
  if (blob.type.includes('mp4')) {
    onStatus('Video wird geprüft …', 1);
    try {
      let parsed = await parseMp4(blob, { withData: false });
      const before = qualityReport(parsed, duration, FPS);
      if (parsed.info.isFragmented || !before.checks.find((c) => c.name.startsWith('Index'))?.ok) {
        parsed = null;
        let full = await parseMp4(blob);
        const fixed = await remuxToProgressive(full);
        full = null;
        qc = qualityReport(await parseMp4(fixed, { withData: false }), duration, FPS);
        qc.remuxed = true;
        blob = fixed;
      } else {
        qc = before;
      }
    } catch (e) {
      qc = { ok: false, checks: [{ name: 'Prüfung', ok: false, detail: e.message }], facts: {} };
    }
  }
  return { blob, method, qc, stats };
}

async function onCreateVideo() {
  if (busy || !script) return;
  script.title = $('title').value.trim() || script.topic;
  script.scenes = script.scenes.filter((s) => s.text.trim());
  if (!script.scenes.length) return log('Das Skript ist leer.', 'error');

  const ctx = getAudioCtx();
  busy = true;
  let wakeLock = null;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* nicht unterstützt */
  }
  document.querySelectorAll('[data-task]').forEach((li) => (li.dataset.state = ''));
  show('stepProgress');
  setStatus('Starte …', 0);

  try {
    // Absturz-Schutz: Skript merken; falls Safari die Seite wegen Speichermangel
    // neu lädt, wird es beim nächsten Öffnen wiederhergestellt.
    try {
      localStorage.setItem(RENDER_KEY, JSON.stringify({ script, at: Date.now(), phase: 'start' }));
    } catch {
      /* egal */
    }
    // Animationen in 720 × 1280 (iPhone-Speicher); Fotos/KI-Bilder je nach Einstellung
    const width = settings.visualMode !== 'images' || settings.quality === '720' ? 720 : 1080;
    const height = Math.round((width * 16) / 9);

    // 1) Bilder
    setTask('images', 'active');
    let images;
    if (settings.visualMode !== 'images') {
      if (settings.visualMode === 'verein') await prepareVerein();
      images = buildAnimVisuals(script, settings.visualMode);
      script.credits = [];
      setStatus('Animationen sind bereit', 0.4);
    } else {
      images = await loadSceneImages(
        script.scenes,
        settings,
        (i, n) => setStatus(`Bild ${Math.min(i + 1, n)} von ${n} wird gesucht/gemalt …`, (i / n) * 0.4),
        log,
        { topic: script.topic, template: !!script.template },
      );
      script.credits = images.credits || [];
    }
    setTask('images', 'done');

    // 2) Stimme (läuft in einem eigenen Prozess, der danach beendet wird)
    setTask('voice', 'active');
    markPhase('voice');
    const { buffer, sceneTimes, used: voiceUsed, why: voiceWhy } = await synthesize(
      ctx,
      script.scenes,
      settings,
      (p) => {
        if (p.phase === 'download') {
          const mb = (p.loaded / 1048576).toFixed(1);
          const tot = p.total ? ` / ${(p.total / 1048576).toFixed(0)}` : '';
          setStatus(`Stimme wird geladen (einmalig): ${mb}${tot} MB`, 0.4 + (p.total ? (p.loaded / p.total) * 0.1 : 0));
        } else {
          setStatus(`Sprachaufnahme Szene ${p.index + 1} von ${p.count} …`, 0.5 + (p.index / p.count) * 0.15);
        }
      },
      log,
    );
    setTask('voice', 'done');
    if (voiceWhy) log(`⚠️ Stimme: ${voiceUsed} – ${voiceWhy}`, 'warn');
    await releaseVoices();

    // 3) Untertitel
    setTask('subs', 'active');
    const subtitles = buildSubtitles(script.scenes, sceneTimes);
    setTask('subs', 'done');

    // 4) Video
    setTask('render', 'active');
    markPhase('export');
    let job = null;
    if (settings.exportMode !== 'realtime' && settings.visualMode !== 'images') {
      setStatus('Prüfe Video-Encoder des Geräts …', 0.66);
      const sup = await segmentedSupported(width, height, (t) => setStatus(t, 0.66));
      if (sup.ok) {
        job = await startJob({ W: width, H: height, music: settings.music, script, sceneTimes, subtitles, duration: buffer.duration, visualMode: settings.visualMode, at: Date.now() });
      } else {
        log(`Szene-für-Szene-Export auf diesem Gerät nicht möglich (${sup.why}) – nutze Echtzeit-Aufnahme.`, 'warn');
      }
    }
    const res = await produceVideo({
      sc: script,
      images,
      width,
      height,
      sceneTimes,
      subtitles,
      buffer,
      duration: buffer.duration,
      job,
      ctx,
      onStatus: (text, p) => setStatus(text, 0.65 + p * 0.35),
    });
    finishVideo(res, subtitles, buffer.duration);
  } catch (e) {
    failVideo(e);
  } finally {
    busy = false;
    try {
      await wakeLock?.release();
    } catch {
      /* egal */
    }
  }
}

function finishVideo({ blob, method, qc, stats }, subtitles, duration) {
  setTask('render', 'done');
  try {
    localStorage.removeItem(RENDER_KEY);
  } catch {
    /* egal */
  }
  clearJob(); // Zwischenspeicher leeren – das fertige Video liegt jetzt vor
  setStatus('Fertig!', 1);
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  lastVideo = { blob, subtitles, ext, duration, method, qc, stats };
  showResult();
}

function failVideo(e) {
  console.error(e);
  try {
    localStorage.removeItem(RENDER_KEY); // normaler Fehler, kein Absturz
  } catch {
    /* egal */
  }
  const cancelled = e instanceof CancelledError;
  if (cancelled) clearJob();
  log(cancelled ? 'Abgebrochen.' : `Fehler: ${e.message || e}`, cancelled ? 'info' : 'error');
  setStatus(cancelled ? '✋ Abgebrochen' : `❌ ${e.message || e}`);
  document.querySelectorAll('[data-task][data-state="active"]').forEach((li) => (li.dataset.state = 'error'));
  const back = document.createElement('button');
  back.className = 'ghost wide';
  back.textContent = '← Zurück zum Skript';
  back.onclick = () => {
    back.remove();
    show(['stepTopic', 'stepScript']);
  };
  $('stepProgress').append(back);
}

// ----------------------------------------------------------- Selbsttest --
// Vor einem langen Video: 2 Testszenen à 5 s komplett erstellen (Stimme, 3D,
// Kodierung, Zusammensetzen), prüfen, ob die Datei abspielt und Ton/Bild synchron
// sind – und das Ganze ein zweites Mal (prüft, ob der Speicher wieder frei wurde).

async function checkPlayback(blob) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const wait = (ev, ms = 10000) =>
    new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`${ev}: keine Antwort`)), ms);
      v.addEventListener(ev, () => (clearTimeout(t), res()), { once: true });
      v.addEventListener('error', () => (clearTimeout(t), rej(new Error('Datei nicht abspielbar'))), { once: true });
    });
  // iPhone-Safari lädt/springt nur bei Videos, die auf der Seite sind
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none';
  document.body.append(v);
  try {
    v.src = url;
    await wait('loadedmetadata');
    const dur = v.duration;
    const okDur = Number.isFinite(dur) && dur > 9;
    let seek = 'Springen klappt';
    try {
      for (const at of [2.5, 7.5]) {
        v.currentTime = at;
        await wait('seeked', 5000);
      }
    } catch {
      seek = 'Springen im Test nicht prüfbar (iPhone-Einschränkung)';
    }
    return { ok: okDur, detail: `Dauer ${dur.toFixed(2)} s, ${seek}` };
  } catch (e) {
    return { ok: false, detail: e.message };
  } finally {
    v.removeAttribute('src');
    v.load();
    v.remove();
    URL.revokeObjectURL(url);
  }
}

// Ton-Synchronität: Wo beginnt hörbar das 2. Wort? Soll: genau dort, wo es eingeplant war.
async function checkAudioSync(blob, ctx, expectedAt) {
  try {
    const buf = await Promise.race([ctx.decodeAudioData(await blob.arrayBuffer()), new Promise((_, rej) => setTimeout(() => rej(new Error('Zeitüberschreitung')), 10000))]);
    const d = buf.getChannelData(0);
    const sr = buf.sampleRate;
    let peak = 0;
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    const thr = peak * 0.2;
    // Musik ist beim Test aus → erster lauter Abschnitt nach 4,8 s = 2. Satz
    for (let i = Math.floor(4.8 * sr); i < d.length; i++) {
      if (Math.abs(d[i]) > thr) {
        const at = i / sr;
        const off = (at - expectedAt) * 1000;
        return { ok: Math.abs(off) < 120, detail: `2. Satz beginnt bei ${at.toFixed(3)} s (geplant ${expectedAt.toFixed(3)} s, Abweichung ${Math.round(off)} ms)` };
      }
    }
    return { ok: false, detail: '2. Satz nicht gefunden' };
  } catch (e) {
    return { ok: null, detail: `nicht messbar (${e.message})` };
  }
}

async function onSelfTest() {
  if (busy) return;
  $('settings').close();
  busy = true;
  show('stepProgress');
  document.querySelectorAll('[data-task]').forEach((li) => (li.dataset.state = ''));
  const ctx = getAudioCtx();
  const say = (t, level = 'info') => log(`🧪 ${t}`, level);
  const results = [];
  const prevMusic = settings.music;
  try {
    const test = {
      title: 'Test',
      topic: 'Was wäre, wenn du der letzte Mensch wärst?',
      scenes: [{ text: 'Du wachst auf und alles ist still.' }, { text: 'Du gehst hinaus auf die leere Straße.' }],
    };
    if (settings.visualMode === 'verein') {
      test.title = 'TAG 1 – Test';
      test.scenes = [{ text: 'Hier drüben ist unsere Fantribüne. Wir haben null Fans!' }, { text: 'A: ein neues Tornetz. B: eine richtige Toilette.' }];
    }
    setTask('voice', 'active');
    setStatus('Test: Stimme für 2 Szenen …', 0.1);
    const { buffer: voice, sceneTimes: st0 } = await synthesize(ctx, test.scenes, settings, () => {}, () => {});
    await releaseVoices();
    setTask('voice', 'done');
    // Die beiden Sätze genau auf 0,3 s und 5,3 s legen → 2 Szenen à 5 s
    const sr = voice.sampleRate;
    const buf = ctx.createBuffer(1, Math.round(10 * sr), sr);
    const ch = buf.getChannelData(0);
    const src = voice.getChannelData(0);
    const sceneTimes = st0.map((t, i) => {
      const from = Math.round(t.start * sr);
      const to = Math.min(Math.round(t.end * sr), from + Math.round(4.4 * sr));
      const at = Math.round((i * 5 + 0.3) * sr);
      ch.set(src.subarray(from, to), at);
      return { start: at / sr, end: (at + to - from) / sr };
    });
    const subtitles = buildSubtitles(test.scenes, sceneTimes);
    const visualMode = settings.visualMode === 'images' ? 'animation' : settings.visualMode;
    if (visualMode === 'verein') await prepareVerein();
    settings.music = false; // für die Ton-Messung
    for (let run = 1; run <= 2; run++) {
      setTask('render', 'active');
      const images = buildAnimVisuals(test, visualMode);
      const sup = settings.exportMode !== 'realtime' ? await segmentedSupported(720, 1280, (t) => setStatus(`Test ${run}/2: ${t}`, 0.3)) : { ok: false, why: 'Echtzeit eingestellt' };
      setStatus(`Test ${run}/2: Video wird erstellt …`, 0.35);
      if (!sup.ok) say(`Durchlauf ${run}: Echtzeit-Aufnahme (${sup.why})`);
      const job = sup.ok ? await startJob({ W: 720, H: 1280, music: false, script: test, sceneTimes, subtitles, duration: 10, visualMode, at: Date.now() }) : null;
      const t0 = performance.now();
      const res = await produceVideo({ sc: test, images, width: 720, height: 1280, sceneTimes, subtitles, buffer: buf, duration: 10, job, ctx, onStatus: (text, p) => setStatus(`Test ${run}/2: ${text}`, p) });
      await clearJob();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      const play = await checkPlayback(res.blob);
      const { LEAD } = await import('./exporter.js');
      const sync = await checkAudioSync(res.blob, ctx, sceneTimes[1].start + (job ? LEAD : 0.15));
      const bad = (res.qc?.checks || []).filter((c) => !c.ok && !c.soft);
      const ok = play.ok && sync.ok !== false && bad.length === 0;
      results.push(ok);
      say(`Durchlauf ${run}: ${ok ? '✅ bestanden' : '⚠️ auffällig'} – ${res.method}, ${secs} s, ${(res.blob.size / 1048576).toFixed(2)} MB`, ok ? 'info' : 'warn');
      say(`  Abspielen: ${play.ok ? '✓' : '✗'} ${play.detail}`);
      say(`  Synchron: ${sync.ok === false ? '✗' : '✓'} ${sync.detail}`);
      for (const c of res.qc?.checks || []) if (!c.ok) say(`  ${c.soft ? 'ℹ️' : '✗'} ${c.name}: ${c.detail}`, c.soft ? 'info' : 'warn');
      if (res.stats) say(`  Zeichnen: ${Math.round(res.stats.msPerFrame)} ms pro Bild${res.stats.heapMB ? `, Speicher ${res.stats.heapMB} MB` : ''}`);
      if (run === 1) lastVideo = { blob: res.blob, subtitles, ext: 'mp4', duration: 10, method: res.method, qc: res.qc };
      setTask('render', 'done');
    }
    const all = results.every(Boolean);
    setStatus(all ? '✅ Test bestanden – lange Videos können erstellt werden.' : '⚠️ Test auffällig – bitte Text unten an den Entwickler schicken.', 1);
    say(all ? 'Alles bestanden. Du kannst jetzt ein ganzes Video erstellen.' : 'Bitte die Test-Zeilen kopieren/Screenshot an den Entwickler schicken.', all ? 'info' : 'warn');
  } catch (e) {
    failVideo(e);
  } finally {
    settings.music = prevMusic;
    busy = false;
  }
}

// Abgebrochene (abgestürzte) Erstellung an der nächsten Szene fortsetzen
async function resumeVideo(job) {
  if (busy) return;
  busy = true;
  const ctx = getAudioCtx();
  let wakeLock = null;
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    /* egal */
  }
  script = job.script;
  show('stepProgress');
  ['images', 'voice', 'subs'].forEach((t) => setTask(t, 'done'));
  setTask('render', 'active');
  try {
    localStorage.setItem(RENDER_KEY, JSON.stringify({ script, at: Date.now(), phase: 'export', resume: true }));
  } catch {
    /* egal */
  }
  try {
    if (job.visualMode === 'verein') await prepareVerein();
    const images = buildAnimVisuals(script, job.visualMode);
    log(`Setze fort bei Szene ${job.segDone + 1} von ${job.segs?.length || '?'} (fertige Szenen bleiben erhalten).`);
    const res = await produceVideo({
      sc: script,
      images,
      width: job.W,
      height: job.H,
      sceneTimes: job.sceneTimes,
      subtitles: job.subtitles,
      buffer: null,
      duration: job.duration,
      job,
      ctx,
      onStatus: (text, p) => setStatus(text, 0.65 + p * 0.35),
    });
    finishVideo(res, job.subtitles, job.duration);
  } catch (e) {
    failVideo(e);
  } finally {
    busy = false;
    try {
      await wakeLock?.release();
    } catch {
      /* egal */
    }
  }
}

// ----------------------------------------------------------- Schritt 4 --

function fileName() {
  const slug = script.title
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return `${slug || 'was-waere-wenn'}.${lastVideo.ext}`;
}

function showResult() {
  const url = URL.createObjectURL(lastVideo.blob);
  $('result').src = url;
  $('btnDownload').href = url;
  $('btnDownload').download = fileName();
  const mb = (lastVideo.blob.size / 1048576).toFixed(1);
  let info = `${Math.round(lastVideo.duration)} Sekunden · ${mb} MB · ${lastVideo.method || lastVideo.ext.toUpperCase()}`;

  if (lastVideo.ext !== 'mp4') {
    info += ' – Dein Browser kann kein MP4 aufnehmen. Auf dem iPhone mit Safari entsteht automatisch MP4.';
  }
  $('resultInfo').textContent = info;
  // Ergebnis der automatischen Qualitätskontrolle
  const box = $('qc');
  box.innerHTML = '';
  const qc = lastVideo.qc;
  if (qc) {
    const head = document.createElement('div');
    head.className = qc.ok ? 'qc-ok' : 'qc-warn';
    head.textContent = qc.ok
      ? `✅ Qualitätskontrolle bestanden${qc.remuxed ? ' (für TikTok neu verpackt)' : ''}`
      : `⚠️ Qualitätskontrolle: ${qc.checks.filter((c) => !c.ok && !c.soft).length} Punkt(e) auffällig`;
    box.append(head);
    const ul = document.createElement('ul');
    for (const c of qc.checks) {
      const li = document.createElement('li');
      li.textContent = `${c.ok ? '✓' : c.soft ? 'ℹ️' : '✗'} ${c.name}: ${c.detail}`;
      if (!c.ok) li.className = 'bad';
      ul.append(li);
    }
    box.append(ul);
  }
  show('stepResult');
}

async function onShare() {
  if (!lastVideo) return;
  const file = new File([lastVideo.blob], fileName(), { type: lastVideo.blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: script.title });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  $('btnDownload').click();
}

function description() {
  const tags = (script.hashtags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
  let text = `${script.title}\n\n${tags} #waswärewenn #shorts`;
  if (script.credits?.length) text += `\n\nBildquellen:\n${script.credits.join('\n')}`;
  return text;
}

async function onCopy() {
  try {
    await navigator.clipboard.writeText(description());
    log('Beschreibung kopiert – einfach bei TikTok/YouTube einfügen.');
  } catch {
    prompt('Zum Kopieren gedrückt halten:', description());
  }
}

function onSrt() {
  const blob = new Blob([toSrt(lastVideo.subtitles)], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName().replace(/\.\w+$/, '.srt');
  a.click();
}

// --------------------------------------------------------- Einstellungen --

function openSettings() {
  $('sVoice').innerHTML = VOICES.map((v) => `<option value="${v.id}">${v.label}</option>`).join('');
  $('sVoice').value = settings.voice;
  $('sSpeed').value = settings.speed;
  $('sSpeedVal').textContent = `${Number(settings.speed).toFixed(2)}×`;
  $('sStyle').value = settings.imageStyle;
  $('sVisual').value = settings.visualMode;
  $('sFans').value = String(settings.vereinFans || 0);
  $('sNames').value = settings.vereinNames || '';
  $('sNets').checked = !!settings.vereinNets;
  $('sQuality').value = settings.quality;
  $('sMusic').checked = settings.music;
  $('sMood').value = settings.musicMood;
  $('sExport').value = settings.exportMode;
  $('sKey').value = settings.geminiKey;
  $('sPolKey').value = settings.pollinationsKey;
  $('sFollow').checked = settings.followEnabled;
  $('sFollowName').value = settings.followName;
  $('sFollowAt').value = String(settings.followAt);
  $('sFollowBtn').value = settings.followButton;
  showAvatarPreview();
  document.documentElement.classList.add('modal-open');
  $('settings').showModal();
  $('settings').querySelector('.settings').scrollTop = 0;
}

function readSettingsForm() {
  settings = {
    ...settings,
    voice: $('sVoice').value,
    speed: Number($('sSpeed').value),
    imageStyle: $('sStyle').value,
    visualMode: $('sVisual').value,
    vereinFans: Math.max(0, parseInt(String($('sFans').value).replace(/\D/g, ''), 10) || 0),
    vereinNames: $('sNames').value.trim(),
    vereinNets: $('sNets').checked,
    quality: $('sQuality').value,
    music: $('sMusic').checked,
    musicMood: $('sMood').value,
    exportMode: $('sExport').value,
    geminiKey: $('sKey').value.trim(),
    pollinationsKey: $('sPolKey').value.trim(),
    followEnabled: $('sFollow').checked,
    followName: $('sFollowName').value.trim(),
    followAt: Number($('sFollowAt').value) || 0.2,
    followButton: $('sFollowBtn').value,
  };
  saveSettings(settings);
}

async function onTestVoice() {
  const btn = $('btnTestVoice');
  if (busy) return;
  const ctx = getAudioCtx();
  readSettingsForm();
  busy = true;
  const old = btn.textContent;
  btn.disabled = true;
  try {
    const info = $('voiceInfo');
    info.textContent = '⏳ Teste Stimme …';
    info.style.color = '';
    info.classList.remove('hidden');
    const sample = settings.visualMode === 'verein' ? 'Hallo zusammen, ich bin Rudi Kiesel vom SV Kieselbach! Heute wird es richtig gut!' : 'Was wäre, wenn die Erde plötzlich stehen bleibt? Die Antwort wird dich überraschen.';
    const { buffer, used, why } = await synthesize(
      ctx,
      [{ text: sample }],
      settings,
      (p) => {
        btn.textContent =
          p.phase === 'download' ? `⏳ Lade Stimme … ${(p.loaded / 1048576).toFixed(0)} MB` : '⏳ Spreche …';
      },
      log,
    );
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    // Anzeigen, welche Stimme WIRKLICH spielt (und warum ggf. die Ersatzstimme)
    info.textContent = why ? `⚠️ Gespielt: ${used}. Grund: ${why}` : `✅ Gespielt: ${used}`;
    info.style.color = why ? '#fbbf24' : '';
    info.classList.remove('hidden');
    btn.textContent = '🔊 Spielt … (Stummschalter am iPhone aus?)';
    await new Promise((r) => (src.onended = r));
  } catch (e) {
    log(`Stimmtest fehlgeschlagen: ${e.message}`, 'error');
    $('voiceInfo').textContent = `❌ Stimmtest fehlgeschlagen: ${e.message}`;
    $('voiceInfo').style.color = '#f87171';
    $('voiceInfo').classList.remove('hidden');
  } finally {
    btn.textContent = old;
    btn.disabled = false;
    busy = false;
  }
}

// --------------------------------------------------- Folgen-Pop-up Bild --

function showAvatarPreview() {
  const img = $('sFollowPreview');
  if (settings.followImage) img.src = settings.followImage;
  else img.removeAttribute('src');
}

// Profilbild verkleinern (quadratisch, 256 px) und nur lokal speichern
async function onAvatarFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
    URL.revokeObjectURL(url);
    settings.followImage = c.toDataURL('image/jpeg', 0.88);
    saveSettings(settings);
    showAvatarPreview();
  } catch (err) {
    log(`Bild konnte nicht geladen werden: ${err.message}`, 'error');
  }
  e.target.value = '';
}

async function loadFollowConfig() {
  if (!settings.followEnabled) return null;
  let img = null;
  if (settings.followImage) {
    try {
      img = new Image();
      img.src = settings.followImage;
      await img.decode();
    } catch {
      img = null;
    }
  }
  return { img, name: settings.followName, at: settings.followAt, button: settings.followButton };
}

// ------------------------------------------------------ Absturz-Schutz --

const RENDER_KEY = 'whatif-rendering-v1';

// Merkt sich laufend, wo die Erstellung gerade ist (Phase, Szene, Zeichenzeit).
// Stürzt Safari ab, steht beim nächsten Öffnen genau da, wo es passiert ist.
function markPhase(phase, reason, heartbeat) {
  try {
    const cur = JSON.parse(localStorage.getItem(RENDER_KEY) || 'null');
    if (cur) localStorage.setItem(RENDER_KEY, JSON.stringify({ ...cur, phase, ...(reason ? { reason } : {}), ...(heartbeat ? { hb: heartbeat } : {}) }));
  } catch {
    /* egal */
  }
}

async function recoverAfterCrash() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(RENDER_KEY) || 'null');
    localStorage.removeItem(RENDER_KEY);
  } catch {
    saved = null;
  }
  // Gibt es eine angefangene Szene-für-Szene-Erstellung? → Fortsetzen anbieten
  let job = null;
  try {
    job = await loadJob();
  } catch {
    job = null;
  }
  const resumable = job && job.audioDone && job.segs && job.segDone < job.segs.length && Date.now() - (job.createdAt || 0) < 24 * 3600 * 1000;
  if (!resumable && job) clearJob();
  if (!saved?.script?.scenes?.length && !resumable) return;
  if (saved && Date.now() - saved.at > 6 * 3600 * 1000 && !resumable) return;
  script = (resumable ? job.script : saved.script) || saved.script;
  $('topic').value = script.topic || '';
  renderScript();
  show(['stepTopic', 'stepScript']);
  const steps = { start: 'Vorbereitung', voice: 'Sprachaufnahme', export: 'Video-Erstellung', record: 'Echtzeit-Aufnahme' };
  const where = steps[saved?.phase] || 'Erstellung';
  const hb = saved?.hb;
  const detail = hb ? ` (zuletzt fertig: Szene ${hb.seg} von ${hb.segs}, ${Math.round(hb.msPerFrame)} ms pro Bild)` : '';
  if (resumable) {
    log(`⚠️ Die Video-Erstellung wurde unterbrochen${detail}. ${job.segDone} von ${job.segs.length} Szenen sind schon fertig gespeichert – du kannst genau dort weitermachen.`, 'warn');
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = `▶️ Fortsetzen ab Szene ${job.segDone + 1} von ${job.segs.length}`;
    btn.onclick = () => {
      btn.remove();
      resumeVideo(job);
    };
    $('stepScript').append(btn);
    return;
  }
  const changes = [];
  if (settings.quality !== '720') {
    settings.quality = '720';
    changes.push('Videoqualität auf 720p gestellt');
  }
  if (saved.phase === 'voice' && settings.voice.startsWith('piper:') && settings.geminiKey) {
    settings.voice = 'gemini:Charon';
    changes.push('die Stimme auf Gemini „Charon“ umgestellt (braucht auf dem iPhone kaum Speicher)');
  }
  saveSettings(settings);
  log(
    `⚠️ Das letzte Video wurde bei der „${where}“ abgebrochen${detail} (dem iPhone ging vermutlich der Arbeitsspeicher aus). Dein Skript ist wiederhergestellt.` +
      (changes.length ? ` Ich habe ${changes.join(' und ')}.` : ' Tipp: Andere Apps schließen.') +
      (saved.reason ? ` (Info für den Entwickler: ${String(saved.reason).slice(0, 120)})` : '') +
      ' Tippe einfach nochmal auf „Video erstellen“.',
    'warn',
  );
}

// ------------------------------------------------------------------ Start --

$('btnScript').onclick = onCreateScript;
$('btnRegen').onclick = () => (script?.own ? onOwnScript() : onCreateScript());
$('btnOwn').onclick = onOwnScript;
$('btnVideo').onclick = onCreateVideo;
$('btnCancel').onclick = () => {
  cancelFlag.requested = true;
  setStatus('Wird abgebrochen …');
};
$('btnSelfTest').onclick = onSelfTest;
$('btnAddScene').onclick = () => {
  script.scenes.push({ text: '', image_prompt: 'dramatic cinematic scene' });
  renderScript();
};
$('btnShare').onclick = onShare;
$('btnCopy').onclick = onCopy;
$('btnSrt').onclick = onSrt;
$('btnNew').onclick = () => {
  $('topic').value = '';
  renderIdeas();
  show('stepTopic');
};
$('btnSettings').onclick = openSettings;
$('settings').addEventListener('close', () => {
  document.documentElement.classList.remove('modal-open');
  readSettingsForm();
});
$('sSpeed').oninput = (e) => ($('sSpeedVal').textContent = `${Number(e.target.value).toFixed(2)}×`);
$('btnTestVoice').onclick = onTestVoice;
$('btnDeviceCheck').onclick = async () => {
  const out = $('deviceCheck');
  out.classList.remove('hidden');
  out.textContent = 'Prüfe …';
  const { findVideoConfig, isIOS } = await import('./exporter.js');
  // Auf dem iPhone die Encoder NICHT anfassen (hängen und blockieren danach die Aufnahme)
  let txt = isIOS() ? `Browser: ${navigator.userAgent}\nMediaRecorder mp4: ${typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')}` : await runDeviceCheck();
  const fv = await findVideoConfig(720, 1280);
  txt += `\nSzene-für-Szene-Export: ${fv.cfg ? `JA (${fv.cfg.codec})` : `nein – ${fv.why}`}`;
  out.textContent = `${txt}\n\n(Text wurde kopiert – einfach dem Entwickler schicken.)`;
  try {
    await navigator.clipboard.writeText(txt);
  } catch {
    out.textContent = `${txt}\n\n(Bitte Screenshot machen und dem Entwickler schicken.)`;
  }
};
$('sFollowFile').addEventListener('change', onAvatarFile);
$('sFollowRemove').onclick = () => {
  settings.followImage = '';
  saveSettings(settings);
  showAvatarPreview();
};
$('topic').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    onCreateScript();
  }
});

renderIdeas();
recoverAfterCrash();
if (!pickMimeType()) log('Achtung: Dieser Browser kann keine Videos aufnehmen. Bitte Safari auf dem iPhone nutzen.', 'warn');

// Für automatische Tests
window.__whatif = { get script() { return script; }, get lastVideo() { return lastVideo; } };
