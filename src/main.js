import './style.css';
import { loadSettings, saveSettings } from './settings.js';
import { generateScript, normalizeTopic } from './script.js';
import { buildOwnScript } from './ownscript.js';
import { loadSceneImages } from './images.js';
import { createAnimVisual, normalizeAnim, guessAnim, guessShot, shotSpec } from './anim/scene.js';
import { synthesize, VOICES, speechWeight } from './tts.js';
import { buildSubtitles, toSrt } from './subtitles.js';
import { VideoRenderer, pickMimeType, tryResume } from './renderer.js';

const $ = (id) => document.getElementById(id);
let settings = loadSettings();
let script = null; // { title, topic, scenes:[{text,image_prompt}], hashtags }
let lastVideo = null; // { blob, subtitles, ext }
let busy = false;
let audioCtx = null;

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
    const width = settings.quality === '720' ? 720 : 1080;
    const height = Math.round((width * 16) / 9);

    // 1) Bilder
    setTask('images', 'active');
    let images;
    if (settings.visualMode !== 'images') {
      // Strichmännchen-Animationen: werden direkt im iPhone gezeichnet
      const n = script.scenes.length;
      let gotUp = false;
      let prevShot = null;
      images = script.scenes.map((sc, i) => {
        if (sc.black) return createAnimVisual({ place: 'black', time: 'night', props: [], actors: [], crowd: { count: 0, action: 'idle' }, effect: 'none' });
        // 1) Film-Einstellung (von Gemini gewählt oder aus dem Satz erkannt)
        //    2) freie Animation von Gemini  3) aus Stichwörtern erraten
        let shot = sc.shot && shotSpec(sc.shot) ? sc.shot : null;
        if (!shot && !sc.anim) shot = guessShot(sc.text, prevShot);
        if (shot === 'wake_up' && gotUp) shot = 'check_phone';
        prevShot = shot;
        let spec = shot ? shotSpec(shot) : null;
        if (spec && sc.anim?.time) spec.time = sc.anim.time;
        if (!spec) spec = normalizeAnim(sc.anim) || guessAnim(sc.text, script.topic, i, n);
        // Nur einmal aufstehen: weitere "get_up"/"sleep" werden zu "walk"
        const a0 = spec.actors[0];
        if (a0 && a0.action === 'get_up') {
          if (gotUp) a0.action = 'walk';
          gotUp = true;
        } else if (a0 && a0.action === 'sleep' && gotUp) a0.action = 'think';
        return createAnimVisual(spec);
      });
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

    // 2) Stimme
    setTask('voice', 'active');
    const { buffer, sceneTimes } = await synthesize(
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

    // 3) Untertitel
    setTask('subs', 'active');
    const subtitles = buildSubtitles(script.scenes, sceneTimes);
    setTask('subs', 'done');

    // 4) Aufnahme
    setTask('render', 'active');
    const renderer = new VideoRenderer({
      width,
      height,
      images,
      scenes: script.scenes,
      sceneTimes,
      subtitles,
      title: script.title,
      audio: buffer,
      follow: await loadFollowConfig(),
      mood: settings.musicMood,
    });
    const preview = $('livePreview');
    const pg = preview.getContext('2d');
    const mimeType = pickMimeType();
    const onProg = (p) => {
      pg.drawImage(renderer.canvas, 0, 0, preview.width, preview.height);
      setStatus(`Video wird erstellt: ${Math.round(p * 100)} %`, 0.65 + p * 0.35);
    };
    let blob = null;
    let method = 'Echtzeit-Aufnahme';
    if (await VideoRenderer.canExportMp4()) {
      try {
        // Sauberer Export Bild für Bild (normale MP4-Datei, ruckelt nicht auf TikTok)
        blob = await renderer.exportMp4({ music: settings.music, onProgress: onProg });
        method = 'Saubere MP4 (30 fps)';
      } catch (e) {
        log(`Schneller MP4-Export nicht möglich (${e.message}) – nutze Echtzeit-Aufnahme.`, 'warn');
      }
    }
    if (!blob) {
      blob = await renderer.record(ctx, {
        music: settings.music,
        mimeType,
        ensureAudio: ensureAudioRunning,
        onProgress: (p) => {
          pg.drawImage(renderer.canvas, 0, 0, preview.width, preview.height);
          setStatus(`Video wird aufgenommen: ${Math.round(p * buffer.duration)} / ${Math.round(buffer.duration)} s`, 0.65 + p * 0.35);
        },
      });
    }
    setTask('render', 'done');
    setStatus('Fertig!', 1);

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    lastVideo = { blob, subtitles, ext, duration: buffer.duration, method };
    showResult();
  } catch (e) {
    console.error(e);
    log(`Fehler: ${e.message || e}`, 'error');
    setStatus(`❌ ${e.message || e}`);
    document.querySelectorAll('[data-task][data-state="active"]').forEach((li) => (li.dataset.state = 'error'));
    const back = document.createElement('button');
    back.className = 'ghost wide';
    back.textContent = '← Zurück zum Skript';
    back.onclick = () => {
      back.remove();
      show(['stepTopic', 'stepScript']);
    };
    $('stepProgress').append(back);
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
  if (lastVideo.method === 'Echtzeit-Aufnahme') info += ' – Tipp: Für eine ruckelfreie Datei iOS aktualisieren (Einstellungen → Allgemein → Softwareupdate).';
  if (lastVideo.ext !== 'mp4') {
    info += ' – Dein Browser kann kein MP4 aufnehmen. Auf dem iPhone mit Safari entsteht automatisch MP4.';
  }
  $('resultInfo').textContent = info;
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
  $('sQuality').value = settings.quality;
  $('sMusic').checked = settings.music;
  $('sMood').value = settings.musicMood;
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
    quality: $('sQuality').value,
    music: $('sMusic').checked,
    musicMood: $('sMood').value,
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
    const { buffer } = await synthesize(
      ctx,
      [{ text: 'Was wäre, wenn die Erde plötzlich stehen bleibt? Die Antwort wird dich überraschen.' }],
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
    btn.textContent = '🔊 Spielt … (Stummschalter am iPhone aus?)';
    await new Promise((r) => (src.onended = r));
  } catch (e) {
    log(`Stimmtest fehlgeschlagen: ${e.message}`, 'error');
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

// ------------------------------------------------------------------ Start --

$('btnScript').onclick = onCreateScript;
$('btnRegen').onclick = () => (script?.own ? onOwnScript() : onCreateScript());
$('btnOwn').onclick = onOwnScript;
$('btnVideo').onclick = onCreateVideo;
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
if (!pickMimeType()) log('Achtung: Dieser Browser kann keine Videos aufnehmen. Bitte Safari auf dem iPhone nutzen.', 'warn');

// Für automatische Tests
window.__whatif = { get script() { return script; }, get lastVideo() { return lastVideo; } };
