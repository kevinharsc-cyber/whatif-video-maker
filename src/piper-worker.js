// Hintergrund-Prozess für die Piper-Stimme.
// Läuft getrennt von der App; wird nach der Sprachaufnahme beendet, damit der
// große Arbeitsspeicher des Stimmen-Programms wieder komplett frei wird.
import * as ort from 'onnxruntime-web';

self.onmessage = async (e) => {
  const { model, config, idsList, speed, wasmBase } = e.data;
  try {
    ort.env.wasm.wasmPaths = wasmBase;
    ort.env.wasm.numThreads = 1;
    ort.env.logLevel = 'error';
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
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
      const data = new Float32Array((out.output || Object.values(out)[0]).data);
      self.postMessage({ type: 'part', index: i, data }, [data.buffer]);
    }
    await session.release?.();
    self.postMessage({ type: 'done' });
  } catch (err) {
    self.postMessage({ type: 'error', message: err?.message || String(err) });
  }
};
