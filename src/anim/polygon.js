// LOW-POLY-STIL IN 2D (ohne 3D-Grafikchip, sehr speichersparend)
//
// 1) polygonize(): verwandelt einen fertig gezeichneten Hintergrund EINMAL pro
//    Szene in Dreiecks-Facetten. Ruhige Flächen → große Dreiecke, Kanten/Details
//    → kleine Dreiecke (wie echte Low-Poly-Kunst).
// 2) Hilfen für die kantige Figur: Glieder als Prismen mit heller/dunkler Seite,
//    Kopf/Hände als facettierte Vielecke.

import { seededRandom } from '../util.js';

// ---------------------------------------------------------- Farben ---
function parse(c) {
  if (typeof c !== 'string' || c[0] !== '#') return null;
  const h = c.length === 4 ? c.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : c;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const cache = new Map();
/** k > 0 heller, k < 0 dunkler (−1 … 1) */
export function shade(c, k) {
  const key = `${c}|${k}`;
  let out = cache.get(key);
  if (out) return out;
  const rgb = parse(c);
  if (!rgb) return c;
  const m = rgb.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  out = `rgb(${m[0]},${m[1]},${m[2]})`;
  if (cache.size > 500) cache.clear();
  cache.set(key, out);
  return out;
}

// ------------------------------------------------------ Hintergrund ---
export function polygonize(g, W, H, seed = 11) {
  let data;
  try {
    data = g.getImageData(0, 0, W, H).data;
  } catch {
    return; // (z. B. fremde Bilder) – dann eben ohne Facetten
  }
  const px = (x, y) => {
    const xi = Math.min(W - 1, Math.max(0, x | 0));
    const yi = Math.min(H - 1, Math.max(0, y | 0));
    const i = (yi * W + xi) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const rnd = seededRandom(seed);
  const cs = Math.round(W / 9); // Grundraster ≈ 80 px
  const cols = Math.ceil(W / cs);
  const rows = Math.ceil(H / cs);
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let c = 0; c <= cols; c++) {
      let x = c * cs;
      let y = r * cs;
      if (c > 0 && c < cols) x += (rnd() - 0.5) * cs * 0.6;
      if (r > 0 && r < rows) y += (rnd() - 0.5) * cs * 0.6;
      row.push([Math.min(W, x), Math.min(H, y)]);
    }
    pts.push(row);
  }
  const tris = [];
  const MIN = 9;
  const split = (a, b, c, depth) => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cy = (a[1] + b[1] + c[1]) / 3;
    const inset = (p, k) => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k];
    const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const samples = [[cx, cy], inset(a, 0.2), inset(b, 0.2), inset(c, 0.2), inset(mid(a, b), 0.2), inset(mid(b, c), 0.2), inset(mid(c, a), 0.2)].map((p) => px(p[0], p[1]));
    let range = 0;
    for (let ch = 0; ch < 3; ch++) {
      let lo = 255;
      let hi = 0;
      for (const s of samples) {
        lo = Math.min(lo, s[ch]);
        hi = Math.max(hi, s[ch]);
      }
      range = Math.max(range, hi - lo);
    }
    const size = Math.max(Math.hypot(a[0] - b[0], a[1] - b[1]), Math.hypot(b[0] - c[0], b[1] - c[1]), Math.hypot(c[0] - a[0], c[1] - a[1]));
    if (range > 26 && size > MIN * 2 && depth < 3) {
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      split(a, ab, ca, depth + 1);
      split(ab, b, bc, depth + 1);
      split(ca, bc, c, depth + 1);
      split(ab, bc, ca, depth + 1);
      return;
    }
    // Farbe: große Flächen = Mittelwert (weiche Facetten), kleine Kanten-Dreiecke
    // = echte Farbe der Mitte (keine Mischfarben → saubere, scharfe Kanten)
    let col;
    if (depth >= 2 || range > 26) col = samples[0].slice();
    else {
      col = [0, 0, 0];
      samples.forEach((s, i) => {
        const w = i === 0 ? 3 : 1;
        for (let ch = 0; ch < 3; ch++) col[ch] += s[ch] * w;
      });
      for (let ch = 0; ch < 3; ch++) col[ch] /= samples.length + 2;
    }
    tris.push([a, b, c, col]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p00 = pts[r][c];
      const p10 = pts[r][c + 1];
      const p01 = pts[r + 1][c];
      const p11 = pts[r + 1][c + 1];
      if ((r + c) % 2) {
        split(p00, p10, p11, 0);
        split(p00, p11, p01, 0);
      } else {
        split(p00, p10, p01, 0);
        split(p10, p11, p01, 0);
      }
    }
  }
  data = null;
  g.lineWidth = 1;
  g.lineJoin = 'round';
  for (const [a, b, c, col] of tris) {
    // leichte Helligkeits-Variation je Facette → sichtbare Kanten
    const k = 1 + (rnd() - 0.5) * 0.07;
    const fill = `rgb(${Math.min(255, col[0] * k) | 0},${Math.min(255, col[1] * k) | 0},${Math.min(255, col[2] * k) | 0})`;
    g.fillStyle = fill;
    g.strokeStyle = fill; // Haarrisse zwischen Dreiecken schließen
    g.beginPath();
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
    g.lineTo(c[0], c[1]);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

// ----------------------------------------------------------- Figur ---

/** Kantiges Glied (Prisma): helle Oberseite, dunkle Unterseite, eckige Gelenke. */
export function polyLimb(g, pts, w, color) {
  const hw = w / 2;
  if (pts.length === 2 && pts[0][0] === pts[1][0] && pts[0][1] === pts[1][1]) {
    polyBlob(g, pts[0][0], pts[0][1], hw, color, 6, 0.3);
    return;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    // Normale; die Seite, die nach oben/links zeigt, ist die Lichtseite
    let nx = -dy;
    let ny = dx;
    if (ny > 0 || (ny === 0 && nx > 0)) {
      nx = -nx;
      ny = -ny;
    }
    const ext = hw * 0.35; // Enden leicht verlängern (Gelenke überdecken)
    const a = [ax - dx * ext, ay - dy * ext];
    const b = [bx + dx * ext, by + dy * ext];
    const taper = 0.88;
    const quad = (sgn, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.lineTo(b[0] + nx * hw * sgn * taper, b[1] + ny * hw * sgn * taper);
      g.lineTo(a[0] + nx * hw * sgn, a[1] + ny * hw * sgn);
      g.closePath();
      g.fill();
    };
    quad(1, shade(color, 0.16));
    quad(-1, shade(color, -0.18));
  }
  // eckige Gelenke
  for (let i = 1; i < pts.length - 1; i++) polyBlob(g, pts[i][0], pts[i][1], hw * 0.95, color, 6, 0.6);
}

/** Facettiertes Vieleck (Kopf, Hand, Kapuze): Dreiecke um die Mitte, Licht von oben links. */
export function polyBlob(g, x, y, r, color, n = 8, rot = 0.2, sx = 1, sy = 1) {
  const L = -Math.PI * 0.75; // Lichtrichtung (oben links)
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i / n) * Math.PI * 2;
    const a1 = rot + ((i + 1) / n) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const k = Math.cos(am - L) * 0.2;
    const col = shade(color, k);
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a0) * r * sx, y + Math.sin(a0) * r * sy);
    g.lineTo(x + Math.cos(a1) * r * sx, y + Math.sin(a1) * r * sy);
    g.closePath();
    g.fill();
    g.stroke();
  }
}

/** Kantige Haare oben auf dem Kopf (mit gezackter Stirnlinie). */
export function polyHair(g, x, y, r, color, dir) {
  const top = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1.02 + (i / 6) * 0.96);
    top.push([x + Math.cos(a) * r * 1.08, y + Math.sin(a) * r * 1.1]);
  }
  // gezackte Stirn (von rechts nach links zurück)
  const fringe = [];
  for (let i = 0; i <= 5; i++) {
    const fx = x + r * (1.0 - (i / 5) * 2.0);
    const fy = y - r * (0.28 + (i % 2) * 0.16) + dir * (fx - x) * 0.08;
    fringe.push([fx, fy]);
  }
  const pts = [...top, ...fringe];
  // in zwei Facetten zeichnen (hell links, dunkel rechts)
  g.fillStyle = shade(color, -0.1);
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  g.closePath();
  g.fill();
  g.fillStyle = shade(color, 0.18);
  g.beginPath();
  g.moveTo(top[0][0], top[0][1]);
  g.lineTo(top[1][0], top[1][1]);
  g.lineTo(top[2][0], top[2][1]);
  g.lineTo(top[3][0], top[3][1]);
  g.lineTo(x, y - r * 0.4);
  g.closePath();
  g.fill();
}
