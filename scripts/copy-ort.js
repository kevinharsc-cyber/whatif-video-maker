// Kopiert die WebAssembly-Dateien für die kostenlose Offline-Stimme "Piper"
// (onnxruntime-web + piper_phonemize) in den public-Ordner, damit sie
// zusammen mit der App ausgeliefert werden.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function copy(srcDir, destDir, files) {
  mkdirSync(destDir, { recursive: true });
  for (const f of files) copyFileSync(join(srcDir, f), join(destDir, f));
}

copy(join('node_modules', 'onnxruntime-web', 'dist'), join('public', 'ort'), [
  'ort-wasm-simd.wasm',
  'ort-wasm.wasm',
]);
copy(join('node_modules', '@diffusionstudio', 'piper-wasm', 'build'), join('public', 'piper'), [
  'piper_phonemize.wasm',
  'piper_phonemize.data',
]);
console.log('Stimm-Dateien kopiert nach public/ort und public/piper');
