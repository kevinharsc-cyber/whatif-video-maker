// Bilder für die Szenen. Reihenfolge:
// 1) KI-Bild von Pollinations.ai (mit kostenlosem Schlüssel)
// 2) Passendes echtes Foto von Wikimedia Commons (kostenlos, ohne Schlüssel)
// 3) Gezeichnetes Ersatzbild, damit das Video in jedem Fall entsteht

import { fetchWithTimeout, sleep, seededRandom, hashString } from './util.js';

export const STYLES = {
  cinematic: 'cinematic film still, dramatic lighting, ultra detailed, photorealistic, 8k, epic atmosphere',
  realistic: 'hyperrealistic photograph, natural lighting, sharp focus, high detail, documentary style',
  scifi: 'sci-fi concept art, futuristic, glowing lights, highly detailed digital painting, epic scale',
  anime: 'anime style illustration, vibrant colors, detailed background, studio quality',
  comic: 'bold comic book illustration, dynamic composition, strong outlines, vivid colors',
};

export async function loadSceneImages(scenes, settings, onProgress, log, { topic = '', template = false } = {}) {
  const w = settings.quality === '720' ? 720 : 1080;
  const h = Math.round((w * 16) / 9);
  const style = STYLES[settings.imageStyle] || STYLES.cinematic;
  const images = [];
  const credits = []; // Bildnachweise für Fotos von Wikimedia Commons
  const usedPhotos = new Set();
  let failedInRow = 0; // Ist der Dienst komplett down, nicht ewig weiterprobieren.
  let aiBlocked = false; // HTTP 401/402/403: ohne (gültigen) Schlüssel keine KI-Bilder
  let photosBlocked = false;
  // Nacheinander laden: der kostenlose Dienst erlaubt nur wenige parallele Anfragen.
  for (let i = 0; i < scenes.length; i++) {
    onProgress(i, scenes.length);
    const prompt = `${scenes[i].image_prompt}, ${style}, vertical composition, no text, no watermark`;
    let img = null;

    // 1) KI-Bild von Pollinations
    const attempts = aiBlocked ? 0 : failedInRow >= 2 ? 1 : 3;
    for (let attempt = 0; attempt < attempts && !img; attempt++) {
      try {
        img = await fetchPollinations(prompt, w, h, hashString(prompt) + attempt, settings.pollinationsKey);
      } catch (e) {
        if (e.status === 401 || e.status === 402 || e.status === 403) {
          aiBlocked = true;
          log(
            settings.pollinationsKey
              ? `KI-Bilddienst lehnt ab (HTTP ${e.status}): Schlüssel ungültig oder Guthaben aufgebraucht – nutze passende Fotos von Wikimedia Commons.`
              : `KI-Bilddienst verlangt einen Schlüssel (HTTP ${e.status}) – nutze passende Fotos von Wikimedia Commons. Für KI-Bilder: Pollinations-Schlüssel unter ⚙️ eintragen.`,
            'warn',
          );
          break;
        }
        if (attempt < attempts - 1) await sleep(2500 * (attempt + 1));
      }
    }
    if (attempts > 0) failedInRow = img ? 0 : failedInRow + 1;

    // 2) Passendes echtes Foto von Wikimedia Commons (kostenlos, ohne Schlüssel)
    if (!img && !photosBlocked) {
      try {
        const queries = searchQueries(scenes[i].image_prompt, topic, template);
        const photo = await fetchWikimediaPhoto(queries, w, usedPhotos);
        if (photo) {
          img = photo.img;
          credits.push(photo.credit);
        }
      } catch (e) {
        photosBlocked = true;
        log(`Fotosuche nicht erreichbar (${e.message}) – nutze Ersatzbilder.`, 'warn');
      }
    }

    // 3) Notfall: gezeichnetes Ersatzbild
    if (!img) log(`Für Bild ${i + 1} wurde nichts Passendes gefunden – nutze Ersatzbild.`, 'warn');
    images.push(img || fallbackImage(scenes[i].image_prompt, w, h, i));
  }
  onProgress(scenes.length, scenes.length);
  images.credits = [...new Set(credits)];
  return images;
}

// ------------------------------------------------- Wikimedia Commons ---

const STOP = new Set(
  (
    'a an the of with and in on at to from for by into over under near its their his her as is are be this that ' +
    'cinematic dramatic epic shot scene view image photo picture close closeup up wide angle background foreground ' +
    'lighting light mood atmosphere detailed ultra high realistic hyperrealistic style illustration concept art ' +
    'vertical composition showing depicting sense very huge giant massive small little lone single empty ' +
    'was wäre waere wenn die der das den dem des ein eine einen einem einer und oder plötzlich ploetzlich alle ' +
    'nie mehr nicht kein keine es gäbe gaebe würde wuerde wären waeren für fuer auf aus mit von zu im am ' +
    'verschwindet verschwinden verschwinden? sich wir ich du man immer einfach ganz'
  ).split(' '),
);

function keywords(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function searchQueries(imagePrompt, topic, template) {
  const fromPrompt = keywords(imagePrompt.split(',')[0]);
  const fromTopic = keywords(topic.replace(/^was w(ä|ae)re,? wenn/i, ''));
  const qs = [];
  if (!template && fromPrompt.length) {
    qs.push(fromPrompt.slice(0, 3).join(' '));
    qs.push(fromPrompt.slice(0, 2).join(' '));
    qs.push(fromPrompt[0]);
  }
  // Thema (bei der Notfall-Vorlage passen die Bildbeschreibungen nicht zum Thema)
  if (fromTopic.length) {
    qs.push(fromTopic.join(' '));
    [...fromTopic].sort((a, b) => b.length - a.length).forEach((t) => qs.push(t));
  }
  if (template && fromPrompt.length) qs.push(fromPrompt.slice(0, 2).join(' '));
  return [...new Set(qs.filter(Boolean))];
}

async function fetchWikimediaPhoto(queries, width, used) {
  let anyResponse = false;
  for (const q of queries) {
    const url =
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      `&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}` +
      `&prop=imageinfo&iiprop=url|mime|size|extmetadata&iiextmetadatafilter=Artist|LicenseShortName&iiurlwidth=${width}`;
    const res = await fetchWithTimeout(url, {}, 20000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    anyResponse = true;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info || used.has(p.title)) continue;
      if (!/image\/(jpeg|png|webp)/.test(info.mime || '')) continue;
      if ((info.width || 0) < 600 || (info.height || 0) < 400) continue;
      try {
        const r = await fetchWithTimeout(info.thumburl || info.url, { mode: 'cors' }, 30000);
        if (!r.ok) continue;
        const img = await blobToBitmap(await r.blob());
        used.add(p.title);
        const meta = info.extmetadata || {};
        const artist = stripHtml(meta.Artist?.value || 'unbekannt');
        const license = stripHtml(meta.LicenseShortName?.value || '');
        const name = p.title.replace(/^File:/, '');
        return { img, credit: `„${name}“ – ${artist}${license ? ` (${license})` : ''}, Wikimedia Commons` };
      } catch {
        /* nächstes Foto versuchen */
      }
    }
  }
  if (!anyResponse) throw new Error('keine Antwort');
  return null;
}

function stripHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
}

async function fetchPollinations(prompt, w, h, seed, key) {
  const params = `width=${w}&height=${h}&seed=${seed % 1000000}&nologo=true&model=flux`;
  const url = key
    ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${params}&key=${encodeURIComponent(key)}`
    : `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params}`;
  const res = await fetchWithTimeout(url, { mode: 'cors' }, 60000);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
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
