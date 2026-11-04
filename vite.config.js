import { defineConfig } from 'vite';

// base: './' sorgt dafür, dass die App auch in einem Unterordner
// (z. B. https://NAME.github.io/whatif-video-maker/) funktioniert.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
});
