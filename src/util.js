export async function fetchWithTimeout(url, opts = {}, ms = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Zeitüberschreitung');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Einfacher Pseudo-Zufallsgenerator (gleiche Eingabe = gleiches Ergebnis)
export function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Anfrage an die Gemini-API. Google hat verschiedene Schlüssel-Formate
// ("AIza…" und neuere "AQ.…"). Wir probieren die möglichen Übergabe-Wege
// nacheinander und merken uns den, der funktioniert.
let geminiWay = 0;
export async function geminiFetch(url, key, body, ms = 60000) {
  const k = String(key || '').trim();
  const ways = [
    () => [url, { 'Content-Type': 'application/json', 'x-goog-api-key': k }],
    () => [`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(k)}`, { 'Content-Type': 'application/json' }],
    () => [url, { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` }],
  ];
  let last = null;
  for (let n = 0; n < ways.length; n++) {
    const idx = (geminiWay + n) % ways.length;
    const [u, headers] = ways[idx]();
    const res = await fetchWithTimeout(u, { method: 'POST', headers, body: JSON.stringify(body) }, ms);
    if (res.ok) {
      geminiWay = idx;
      return res;
    }
    last = res;
    // Nur bei Schlüssel-/Anmeldeproblemen den nächsten Weg probieren
    if (![400, 401, 403].includes(res.status)) return res;
    const txt = await res.clone().text();
    if (!/api[ _-]?key|unauthenticated|credential|permission|invalid.*key|authorization/i.test(txt)) return res;
  }
  return last;
}

// Farbverläufe zwischenspeichern: Safari hängt an jeden neu erzeugten Verlauf
// Speicher, der nur langsam freigegeben wird. Bei 30 Bildern/s und vielen
// Verläufen pro Bild lief der Speicher voll. Gleiche Verläufe werden jetzt
// wiederverwendet (Koordinaten auf 0,5 px gerundet).
const gradCache = new Map();
export function cachedGradient(g, type, args, stops) {
  const a = args.map((v) => Math.round(v * 2) / 2);
  const key = `${type}|${a.join(',')}|${stops.map((s) => `${s[0]}:${s[1]}`).join(';')}`;
  let gr = gradCache.get(key);
  if (gr) {
    gradCache.delete(key);
    gradCache.set(key, gr);
    return gr;
  }
  gr = type === 'linear' ? g.createLinearGradient(...a) : g.createRadialGradient(...a);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  gradCache.set(key, gr);
  if (gradCache.size > 300) gradCache.delete(gradCache.keys().next().value);
  return gr;
}

// Fertige Bild-Ebenen (Hintergrund einer Szene, Farbstimmung, Abdunklung)
// werden EINMAL gezeichnet und danach nur noch als Bild eingesetzt. Ganzflächige
// Verläufe/Effekte bei jedem Videobild neu zu berechnen war zu teuer (≈ 40 ms
// pro Bild) – das iPhone kam nicht hinterher und der Speicher lief voll.
const layerCache = new Map();
export function cachedLayer(key, W, H, draw, max = 6) {
  let e = layerCache.get(key);
  if (e) {
    layerCache.delete(key);
    layerCache.set(key, e);
    return e;
  }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  e = { img: c, info: draw(c.getContext('2d')) };
  layerCache.set(key, e);
  if (typeof createImageBitmap === 'function') {
    createImageBitmap(c)
      .then((bmp) => {
        if (layerCache.get(key) === e) e.img = bmp;
        else bmp.close?.();
      })
      .catch(() => {});
  }
  while (layerCache.size > max) {
    const k = layerCache.keys().next().value;
    layerCache.get(k).img.close?.();
    layerCache.delete(k);
  }
  return e;
}
