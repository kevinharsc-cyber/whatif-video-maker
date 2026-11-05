// Hintergrund-Prozess für die komplette Piper-Stimme (Lautschrift + Sprachmodell).
//
// Warum? Das Sprachprogramm (WebAssembly) holt sich ca. 150–250 MB Arbeitsspeicher
// und gibt ihn NIE wieder zurück, solange es läuft. Lief es direkt in der App,
// blieb dieser Speicher während der ganzen Videoaufnahme belegt – auf dem iPhone
// war dann bei der Hälfte des Videos Schluss. Hier im Hintergrund-Prozess wird
// nach der Sprachaufnahme alles beendet und der Speicher komplett freigegeben.
import * as ort from 'onnxruntime-web';
import { createPiperPhonemize } from './vendor/piper-phonemize.js';

function phonemizeAll(texts, espeakVoice, base) {
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
      printErr: () => {},
      locateFile: (f) => (f.endsWith('.wasm') || f.endsWith('.data') ? base + f.replace(/^.*\//, '') : f),
    })
      .then((mod) => mod.callMain(['-l', espeakVoice, '--input', JSON.stringify(texts.map((text) => ({ text }))), '--espeak_data', '/espeak-ng-data']))
      .catch(reject);
    setTimeout(() => !done && (lines.length === texts.length ? finish() : reject(new Error('Lautumwandlung dauert zu lange'))), 60000);
  });
}

self.onmessage = async (e) => {
  const { config, texts, speed, wasmBase, piperBase, modelUrl, cacheName } = e.data;
  let model = e.data.model;
  try {
    // 1) Lautschrift für alle Sätze in einem Durchgang
    let idsList = await phonemizeAll(texts, config.espeak.voice, piperBase);
    self.postMessage({ type: 'phonemes' });

    // 2) Sprachmodell
    ort.env.wasm.wasmPaths = wasmBase;
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    if (!model && modelUrl) {
      // Modell direkt aus dem Browser-Speicher laden (keine Kopie in der App)
      const hit = await (await caches.open(cacheName)).match(modelUrl);
      if (!hit) throw new Error('Stimmen-Modell nicht im Speicher');
      model = await hit.arrayBuffer();
    }
    const session = await ort.InferenceSession.create(model, {
      executionProviders: ['wasm'],
      enableCpuMemArena: false,
      enableMemPattern: false,
    });
    model = null;
    const scales = new Float32Array([config.inference.noise_scale, config.inference.length_scale / speed, config.inference.noise_w]);
    const multi = Object.keys(config.speaker_id_map || {}).length > 0;
    for (let i = 0; i < idsList.length; i++) {
      const ids = idsList[i];
      const feeds = {
        input: new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]),
        input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
        scales: new ort.Tensor('float32', scales, [3]),
      };
      if (multi) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([0n]), [1]);
      const out = await session.run(feeds);
      const t = out.output || Object.values(out)[0];
      const data = new Float32Array(t.data);
      t.dispose?.();
      self.postMessage({ type: 'part', index: i, data }, [data.buffer]);
    }
    idsList = null;
    await session.release?.();
    self.postMessage({ type: 'done' });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
