// KI-Bilder über Pollinations.ai (kostenlos, ohne Anmeldung).
// Falls ein Bild nicht geladen werden kann, wird automatisch ein
// stimmungsvolles Ersatzbild gezeichnet, damit das Video trotzdem entsteht.

import { fetchWithTimeout, sleep, seededRandom, hashString } from './util.js';

export const STYLES = {
  cinematic: 'cinematic film still, dramatic lighting, ultra detailed, photorealistic, 8k, epic atmosphere',
  realistic: 'hyperrealistic photograph, natural lighting, sharp focus, high detail, documentary style',
  scifi: 'sci-fi concept art, futuristic, glowing lights, highly detailed digital painting, epic scale',
  anime: 'anime style illustration, vibrant colors, detailed background, studio quality',
  comic: 'bold comic book illustration, dynamic composition, strong outlines, vivid colors',
};

export async function loadSceneImages(scenes, settings, onProgress, log) {
  const w = settings.quality === '720' ? 720 : 1080;
  const h = Math.round((w * 16) / 9);
  const style = STYLES[settings.imageStyle] || STYLES.cinematic;
  const images = [];
  let failedInRow = 0; // Ist der Dienst komplett down, nicht ewig weiterprobieren.
  // Nacheinander laden: der kostenlose Dienst erlaubt nur wenige parallele Anfragen.
  for (let i = 0; i < scenes.length; i++) {
    onProgress(i, scenes.length);
    const prompt = `${scenes[i].image_prompt}, ${style}, vertical composition, no text, no watermark`;
    let img = null;
    const attempts = failedInRow >= 2 ? 1 : 3;
    for (let attempt = 0; attempt < attempts && !img; attempt++) {
      try {
        img = await fetchPollinations(prompt, w, h, hashString(prompt) + attempt);
      } catch (e) {
        if (attempt < attempts - 1) await sleep(2500 * (attempt + 1));
        else log(`Bild ${i + 1} konnte nicht geladen werden (${e.message}) – nutze Ersatzbild.`, 'warn');
      }
    }
    failedInRow = img ? 0 : failedInRow + 1;
    images.push(img || fallbackImage(scenes[i].image_prompt, w, h, i));
  }
  onProgress(scenes.length, scenes.length);
  return images;
}

async function fetchPollinations(prompt, w, h, seed) {
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&seed=${seed % 1000000}&nologo=true&model=flux`;
  const res = await fetchWithTimeout(url, { mode: 'cors' }, 90000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/') || blob.size < 2000) throw new Error('kein gültiges Bild');
  return await blobToBitmap(blob);
}

export async function blobToBitmap(blob) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* Fallback unten */
    }
  }
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

// Zeichnet ein abstraktes "Weltraum/Kino"-Bild als Ersatz.
export function fallbackImage(seedText, w, h, index) {
  const rnd = seededRandom(hashString(seedText) + index);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const hue = Math.floor(rnd() * 360);
  const grad = g.createLinearGradient(0, 0, w * rnd(), h);
  grad.addColorStop(0, `hsl(${hue},70%,12%)`);
  grad.addColorStop(0.55, `hsl(${(hue + 40) % 360},65%,22%)`);
  grad.addColorStop(1, `hsl(${(hue + 90) % 360},70%,8%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Sterne
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(255,255,255,${rnd() * 0.8})`;
    const r = rnd() * 2.2;
    g.beginPath();
    g.arc(rnd() * w, rnd() * h, r, 0, Math.PI * 2);
    g.fill();
  }
  // Leuchtende Kugel (Planet)
  const px = w * (0.3 + rnd() * 0.4);
  const py = h * (0.3 + rnd() * 0.3);
  const pr = w * (0.25 + rnd() * 0.2);
  const pg = g.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  pg.addColorStop(0, `hsl(${(hue + 180) % 360},80%,70%)`);
  pg.addColorStop(0.7, `hsl(${(hue + 200) % 360},70%,35%)`);
  pg.addColorStop(1, `hsla(${(hue + 220) % 360},70%,15%,0.9)`);
  g.fillStyle = pg;
  g.beginPath();
  g.arc(px, py, pr, 0, Math.PI * 2);
  g.fill();
  const glow = g.createRadialGradient(px, py, pr, px, py, pr * 1.6);
  glow.addColorStop(0, `hsla(${(hue + 180) % 360},90%,60%,0.35)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);
  return c;
}
