import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base: './' sorgt dafür, dass die App auch in einem Unterordner
// (z. B. https://NAME.github.io/whatif-video-maker/) funktioniert.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    // zwei Seiten: Video-App (index.html) und das Handy-Spiel (spiel.html)
    rollupOptions: { input: { main: resolve(__dirname, 'index.html'), spiel: resolve(__dirname, 'spiel.html'), shark: resolve(__dirname, 'shark.html') } },
  },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
