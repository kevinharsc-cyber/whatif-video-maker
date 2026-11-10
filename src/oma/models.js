// OMA DEFENSE – 3D-Modelle (Omas, Zombies, Garten) im Comic-Stil
// Die Figuren werden aus vielen Teilen gebaut und danach zu wenigen Meshes „gebacken“ (schnell auf dem iPhone).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const matCache = new Map();
// Materialien werden geteilt (gleiche Farbe = gleiches Material) – spart Speicher
const M = (color, o = {}) => {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }));
  return matCache.get(key);
};
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

function cookie(parent, x, z) {
  const c = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.045, 20), M(0xd99a4e), x, 0.03, z, parent);
  for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.022, 6, 5), M(0x4a2810), (rand() - 0.5) * 0.15, 0.025, (rand() - 0.5) * 0.15, c);
  return c;
}
function tree(parent, x, z, s = 1, cols = [0x3f9a3a, 0x52b047, 0x2f8a34]) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); parent.add(t);
  mesh(new THREE.CylinderGeometry(0.1, 0.15, 0.7, 10), M(0x7a5232), 0, 0.35, 0, t);
  mesh(new THREE.IcosahedronGeometry(0.55, 2), M(cols[0]), 0, 1.0, 0, t);
  mesh(new THREE.IcosahedronGeometry(0.4, 2), M(cols[1]), 0.3, 1.25, 0.1, t);
  mesh(new THREE.IcosahedronGeometry(0.38, 2), M(cols[2]), -0.3, 1.2, -0.1, t);
  return t;
}
function house(parent, x, z, night) {
  const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = -0.6; parent.add(h);
  mesh(new RoundedBoxGeometry(2.2, 1.3, 1.6, 3, 0.05), M(0xf6e7cf), 0, 0.65, 0, h);
  const sh = new THREE.Shape(); sh.moveTo(-1.3, 0); sh.lineTo(1.3, 0); sh.lineTo(0, 0.9); sh.closePath();
  const roof = mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.9, bevelEnabled: false }), M(0xc0504d), 0, 1.3, -0.95, h);
  mesh(new THREE.BoxGeometry(0.25, 0.6, 0.25), M(0x8a5a40), 0.6, 1.9, 0, h);
  mesh(new RoundedBoxGeometry(0.4, 0.7, 0.08, 2, 0.03), M(0x7a4b2a), 0, 0.35, 0.8, h);
  const winM = night ? new THREE.MeshBasicMaterial({ color: 0xffd36a }) : M(0x9fd8ff, { roughness: 0.1 });
  for (const sx of [-0.65, 0.65]) { mesh(new RoundedBoxGeometry(0.42, 0.38, 0.06, 2, 0.02), M(0xffffff), sx, 0.82, 0.8, h); mesh(new THREE.PlaneGeometry(0.34, 0.3), winM, sx, 0.82, 0.835, h); }
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const gg = c.getContext('2d'); gg.fillStyle = '#ffe9a8'; gg.fillRect(0, 0, 512, 96); gg.strokeStyle = '#7a4b2a'; gg.lineWidth = 10; gg.strokeRect(5, 5, 502, 86); gg.font = '60px L'; gg.fillStyle = '#7a3b2a'; gg.textAlign = 'center'; gg.fillText('SONNENSCHEIN', 256, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), 0, 1.15, 0.82, h);
  return h;
}


// ---------- Kopfsteinpflaster ----------
function cobbleTex(night) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = night ? '#3e3550' : '#9a8a72'; g.fillRect(0, 0, 256, 256);
  const cols = night ? ['#6b5f86', '#5e547a', '#776a92'] : ['#e3c98e', '#d8bb7c', '#ecd6a2', '#cfb37a'];
  for (let row = 0; row < 6; row++) for (let k = -1; k < 6; k++) {
    const x = k * 48 + (row % 2) * 24 + 4, y = row * 43 + 4;
    g.fillStyle = cols[(row * 7 + k * 3 + 8) % cols.length];
    g.beginPath(); g.roundRect(x, y, 40, 35, 10); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.roundRect(x + 4, y + 3, 26, 9, 5); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// ---------- Umrisse um Figuren ----------
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x1b1428, side: THREE.BackSide });
function outline(group, w = 1.06) {
  const list = []; group.traverse((o) => { if (o.isMesh && !o.userData.noOutline && o.geometry.type !== 'CircleGeometry' && o.geometry.type !== 'PlaneGeometry') list.push(o); });
  for (const o of list) { const e = new THREE.Mesh(o.geometry, OUTLINE); e.scale.setScalar(w); e.userData.noOutline = true; o.add(e); }
  return group;
}
// ---------- Garten-Details ----------
function fence(parent, x, z, len, rot, color = 0xffffff) {
  const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = rot; parent.add(f);
  const m = M(color);
  for (let i = 0; i <= len / 0.28; i++) { const p = mesh(new RoundedBoxGeometry(0.1, 0.55, 0.05, 2, 0.02), m, i * 0.28, 0.28, 0, f); mesh(new THREE.ConeGeometry(0.07, 0.1, 4), m, 0, 0.32, 0, p).rotation.y = Math.PI / 4; }
  for (const h of [0.18, 0.4]) mesh(new THREE.BoxGeometry(len + 0.1, 0.06, 0.04), m, len / 2, h, -0.04, f);
  return f;
}
function bench(parent, x, z, rot) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = rot; parent.add(b);
  const wood = M(0xa0683a), iron = M(0x2c2c35, { metalness: 0.6, roughness: 0.4 });
  for (const zz of [-0.08, 0.04, 0.16]) mesh(new RoundedBoxGeometry(1.0, 0.04, 0.1, 2, 0.015), wood, 0, 0.32, zz, b);
  for (const yy of [0.5, 0.62]) mesh(new RoundedBoxGeometry(1.0, 0.08, 0.04, 2, 0.015), wood, 0, yy, -0.16, b);
  for (const sx of [-0.42, 0.42]) { mesh(new THREE.BoxGeometry(0.05, 0.32, 0.3), iron, sx, 0.16, 0, b); mesh(new THREE.BoxGeometry(0.05, 0.4, 0.04), iron, sx, 0.5, -0.17, b); }
  return b;
}
function flowerBed(parent, x, z, rot, cols) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = rot; parent.add(b);
  mesh(new RoundedBoxGeometry(1.3, 0.22, 0.6, 2, 0.04), M(0x9a6438), 0, 0.11, 0, b);
  mesh(new THREE.BoxGeometry(1.18, 0.05, 0.48), M(0x4a2e1a, { roughness: 1 }), 0, 0.21, 0, b);
  for (let i = 0; i < 14; i++) { const fx = -0.5 + (i % 7) * 0.17, fz = i < 7 ? -0.12 : 0.12; mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 4), M(0x2f8a34), fx, 0.3, fz, b); const head = mesh(new THREE.SphereGeometry(0.065, 10, 8), M(cols[i % cols.length], { roughness: 0.5 }), fx, 0.4, fz, b); mesh(new THREE.SphereGeometry(0.03, 8, 6), M(0xffe27a), 0, 0.03, 0.04, head); }
  return b;
}
function gnome(parent, x, z, rot) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; parent.add(g);
  mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 12), M(0x2f6fd1), 0, 0.11, 0, g);
  mesh(new THREE.SphereGeometry(0.09, 12, 10), M(0xf4c7a1), 0, 0.29, 0, g);
  mesh(new THREE.ConeGeometry(0.08, 0.16, 10), M(0xffffff), 0, 0.23, 0.05, g).rotation.x = Math.PI;
  mesh(new THREE.ConeGeometry(0.1, 0.26, 12), M(0xe5383b), 0, 0.45, -0.01, g).rotation.x = -0.15;
  mesh(new THREE.SphereGeometry(0.025, 8, 6), M(0xff9f80), 0, 0.29, 0.09, g);
  return outline(g, 1.08);
}
function pond(parent, x, z, r = 1.1) {
  const p = new THREE.Group(); p.position.set(x, 0, z); parent.add(p);
  const water = mesh(new THREE.CircleGeometry(r, 40), M(0x3fa9e8, { roughness: 0.05, metalness: 0.2, emissive: 0x0a3a60, emissiveIntensity: 0.4 }), 0, 0.03, 0, p); water.rotation.x = -Math.PI / 2; water.castShadow = false;
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; const st = mesh(new THREE.DodecahedronGeometry(0.16 + rand() * 0.06, 0), M(0xb9b2a4), Math.cos(a) * (r + 0.05), 0.06, Math.sin(a) * (r + 0.05), p); st.scale.y = 0.55; st.rotation.set(rand() * 3, rand() * 3, 0); }
  for (const [lx, lz] of [[-0.3, 0.2], [0.35, -0.25], [0.1, 0.45]]) { const pad = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.015, 16, 1, false, 0.3, Math.PI * 1.8), M(0x4caf50), lx, 0.045, lz, p); }
  mesh(new THREE.SphereGeometry(0.06, 10, 8), M(0xff9fd0), -0.3, 0.09, 0.2, p);
  return p;
}
// Glitzer-Treffer
function sparkle(parent, pos, n = 14) {
  const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff2a0 });
  for (let i = 0; i < n; i++) { const d = new THREE.Vector3().randomDirection().multiplyScalar(0.25 + rand() * 0.35); const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.035 + rand() * 0.03, 0), mat); st.position.copy(d); g.add(st); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 30), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })); ring.lookAt(new THREE.Vector3(0, 10, 10)); g.add(ring);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff6c8 })); g.add(glow);
  return g;
}
function fireflies(parent, n = 40) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xd8ff7a });
  for (let i = 0; i < n; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), mat); f.position.set((rand() - 0.5) * 16, 0.4 + rand() * 1.6, (rand() - 0.5) * 12); parent.add(f); }
}

const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };

// ---------------- Gesichter (auf die Kopfkugel gemalt; Gesichtsmitte bei u=0.25, v=0.5) -------------
function omaFace(skin, mood = 'happy') {
  const [c, g] = cnv(1024, 512);
  g.fillStyle = skin; g.fillRect(0, 0, 1024, 512);
  const cx = 256, cy = 262;
  // Wangen
  for (const sx of [-1, 1]) { const gr = g.createRadialGradient(cx + sx * 78, cy + 44, 4, cx + sx * 78, cy + 44, 48); gr.addColorStop(0, 'rgba(255,110,130,0.75)'); gr.addColorStop(1, 'rgba(255,110,130,0)'); g.fillStyle = gr; g.fillRect(cx + sx * 78 - 50, cy - 6, 100, 100); }
  // Augen
  for (const sx of [-1, 1]) {
    const ex = cx + sx * 46, ey = cy - 6;
    if (mood === 'squint' && sx > 0) { g.strokeStyle = '#2a1a1a'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 18, ey + 2); g.quadraticCurveTo(ex, ey - 8, ex + 18, ey + 2); g.stroke(); continue; }
    g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(ex, ey, 21, 26, 0, 0, 7); g.fill();
    g.fillStyle = '#4a2a18'; g.beginPath(); g.ellipse(ex + 2, ey + 4, 13, 16, 0, 0, 7); g.fill();
    g.fillStyle = '#120a08'; g.beginPath(); g.ellipse(ex + 2, ey + 5, 7, 9, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 3, ey - 3, 5, 0, 7); g.fill(); g.beginPath(); g.arc(ex + 6, ey + 10, 2.5, 0, 7); g.fill();
    // Lachfalten
    g.strokeStyle = 'rgba(150,80,60,0.55)'; g.lineWidth = 3;
    for (const k of [0, 1]) { g.beginPath(); g.arc(ex + sx * 30, ey + 4 + k * 9, 9, sx > 0 ? -0.9 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.9); g.stroke(); }
  }
  // Augenbrauen (grau, freundlich)
  g.strokeStyle = '#b8b8c4'; g.lineWidth = 9; g.lineCap = 'round';
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(cx + sx * 28, cy - 46); g.quadraticCurveTo(cx + sx * 48, cy - 58, cx + sx * 68, cy - 46); g.stroke(); }
  // Mund
  g.fillStyle = '#7a2a2a'; g.beginPath(); g.moveTo(cx - 30, cy + 54); g.quadraticCurveTo(cx, cy + 92, cx + 30, cy + 54); g.quadraticCurveTo(cx, cy + 64, cx - 30, cy + 54); g.fill();
  g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(cx, cy + 72, 12, 6, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(150,80,60,0.5)'; g.lineWidth = 3; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * 40, cy + 54, 10, sx > 0 ? -0.3 : Math.PI - 0.8, sx > 0 ? 0.8 : Math.PI + 0.3); g.stroke(); }
  // Muttermal
  g.fillStyle = '#8a5a40'; g.beginPath(); g.arc(cx + 52, cy + 36, 3.5, 0, 7); g.fill();
  return tex(c);
}
function zombieFace(skin, variant) {
  const [c, g] = cnv(1024, 512);
  g.fillStyle = skin; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(60,110,40,${0.15 + rand() * 0.25})`; g.beginPath(); g.ellipse(rand() * 1024, rand() * 512, 8 + rand() * 22, 6 + rand() * 14, rand() * 3, 0, 7); g.fill(); }
  const cx = 256, cy = 258;
  // Augenringe
  for (const sx of [-1, 1]) { g.fillStyle = 'rgba(70,60,90,0.35)'; g.beginPath(); g.ellipse(cx + sx * 46, cy - 2, 34, 36, 0, 0, 7); g.fill(); }
  // linkes Glubschauge
  g.fillStyle = '#fffbe0'; g.beginPath(); g.ellipse(cx - 46, cy - 6, 30, 33, 0, 0, 7); g.fill();
  g.fillStyle = '#c0392b'; g.lineWidth = 2; g.strokeStyle = 'rgba(200,40,40,0.5)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(cx - 46 - 28, cy - 10 + i * 6); g.lineTo(cx - 58, cy - 6 + i * 3); g.stroke(); }
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx - 54, cy + 2, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 57, cy - 1, 3, 0, 7); g.fill();
  // rechtes Schlafauge (halb zu)
  g.fillStyle = '#fffbe0'; g.beginPath(); g.ellipse(cx + 46, cy - 2, 20, 18, 0, 0, 7); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.arc(cx + 50, cy + 4, 6, 0, 7); g.fill();
  g.fillStyle = skin; g.beginPath(); g.ellipse(cx + 46, cy - 14, 24, 14, 0.1, 0, 7); g.fill();
  g.strokeStyle = '#2a3a1a'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 22, cy - 6); g.lineTo(cx + 70, cy - 2); g.stroke();
  // Monobraue
  g.strokeStyle = '#2b2b22'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 80, cy - 50); g.lineTo(cx - 20, cy - 40); g.lineTo(cx + 20, cy - 44); g.lineTo(cx + 70, cy - 36); g.stroke();
  // Mund offen mit Zähnen und Zunge
  g.fillStyle = '#3a0c18'; g.beginPath(); g.moveTo(cx - 44, cy + 46); g.quadraticCurveTo(cx - 6, cy + 40, cx + 40, cy + 50); g.quadraticCurveTo(cx + 10, cy + 112, cx - 44, cy + 46); g.fill();
  g.fillStyle = '#ff7a9a'; g.beginPath(); g.ellipse(cx + 2, cy + 82, 18, 10, 0.2, 0, 7); g.fill();
  g.fillStyle = '#fff6d0';
  for (const [x, w, h] of [[-34, 12, 16], [-16, 12, 12], [6, 13, 18], [24, 10, 12]]) { g.beginPath(); g.moveTo(cx + x, cy + 47); g.lineTo(cx + x + w, cy + 47); g.lineTo(cx + x + w / 2, cy + 47 + h); g.fill(); }
  // Narbe mit Stichen
  g.strokeStyle = '#3a2030'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx + 64, cy - 96); g.lineTo(cx + 104, cy - 30); g.stroke();
  g.lineWidth = 3.5; for (let i = 0; i < 5; i++) { const t = i / 4; const x = cx + 64 + 40 * t, y = cy - 96 + 66 * t; g.beginPath(); g.moveTo(x - 10, y + 4); g.lineTo(x + 10, y - 4); g.stroke(); }
  return tex(c);
}
function floralTex(base, flower) {
  const [c, g] = cnv(256, 256); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) { const x = rand() * 256, y = rand() * 256; g.fillStyle = flower; for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, 7); g.fill(); } g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
}
function knitTex(base) {
  const [c, g] = cnv(128, 128); g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 3;
  for (let y = 0; y < 128; y += 10) for (let x = 0; x < 128; x += 12) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.lineTo(x + 12, y); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}
function shirtTex(base, torn = true) {
  const [c, g] = cnv(256, 256); g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(80,60,40,0.25)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.ellipse(rand() * 256, rand() * 256, 6 + rand() * 14, 4 + rand() * 8, rand() * 3, 0, 7); g.fill(); }
  // Flicken
  g.fillStyle = '#d9a441'; g.fillRect(150, 90, 50, 44); g.strokeStyle = '#3a2a1a'; g.lineWidth = 3; g.setLineDash([6, 5]); g.strokeRect(152, 92, 46, 40); g.setLineDash([]);
  if (torn) { g.fillStyle = '#5a8a3a'; g.beginPath(); g.moveTo(40, 160); g.lineTo(70, 150); g.lineTo(62, 180); g.lineTo(85, 190); g.lineTo(48, 196); g.fill(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- OMA ---
const OMAS = {
  hilde: { name: 'Oma Hilde', role: 'Stricknadel-Werferin', skirt: '#8e5cd9', flower: '#ffd6f0', card: '#ef6f9c', glasses: 0xd62839, hair: 0xf0f0f8, bow: 0xff6fae, apron: true },
  erna: { name: 'Oma Erna', role: 'Pantoffel-Sniperin', skirt: '#2f7fd1', flower: '#bfe6ff', card: '#ffc23d', glasses: 0xd9a400, hair: 0xd9d2f0, bow: 0x6a5acd, mood: 'squint' },
  gerda: { name: 'Oma Gerda', role: 'Keks-Katapult', skirt: '#3fa34d', flower: '#fff0a8', card: '#ff8c42', glasses: 0x3b3b4a, hair: 0xf7f4ee, bow: 0xe5383b, chef: true },
  inge: { name: 'Oma Inge', role: 'Rollator-Rammbock', skirt: '#c0392b', flower: '#ffd0c8', card: '#f5e6c8', glasses: 0x8a5a2a, hair: 0xe8e8f0, bow: 0xffffff, hat: 'sunhat', prop: 'rollator' },
  lotte: { name: 'Oma Lotte', role: 'Katzen-Werferin', skirt: '#6a4c93', flower: '#e6d6ff', card: '#7fd1c7', glasses: 0x2b2b3a, hair: 0xd9d2f0, bow: 0xffffff, hat: 'scarf', prop: 'cat', apron: true },
  frieda: { name: 'Oma Frieda', role: 'Gebiss-Falle', skirt: '#1e8a8a', flower: '#c8fff4', card: '#ffb3c7', glasses: 0x5a2a8a, hair: 0xf3d9e6, bow: 0xffffff, hat: 'curlers', prop: 'teeth' },
  helga: { name: 'Oma Helga', role: 'Gießkannen-Sprüherin', skirt: '#d4a017', flower: '#fff6c8', card: '#4caf50', glasses: 0x1d4f91, hair: 0xeef0f5, bow: 0xffffff, hat: 'beret', prop: 'can' },
  ursula: { name: 'Oma Ursula', role: 'Handtaschen-Boxerin', skirt: '#2b2d42', flower: '#cfd6ff', card: '#e5383b', glasses: 0xd9a400, hair: 0xbcd8f0, bow: 0xffffff, hat: 'flowerhat', prop: 'bag' },
  brigitte: { name: 'Bingo-Brigitte', role: 'Glücks-Kugeln', skirt: '#ff6f91', flower: '#fff0f5', card: '#ffd23f', glasses: 0xe5383b, hair: 0xf7e6c4, bow: 0xffffff, hat: 'visor', prop: 'bingo', mood: 'squint' },
  margot: { name: 'Oma Margot', role: 'Teekessel-Dampf', skirt: '#3d5a80', flower: '#d6e8ff', card: '#c9a0dc', glasses: 0x3b3b4a, hair: 0xc9dcf5, bow: 0x9b59b6, prop: 'kettle' },
};
function makeOma(id) {
  const o = OMAS[id];
  const g = new THREE.Group();
  const skinC = '#f6cba7', skin = M(0xf6cba7, { roughness: 0.6 });
  // Schuhe + Strümpfe
  for (const sx of [-1, 1]) {
    mesh(new THREE.CapsuleGeometry(0.075, 0.16, 4, 12), M(0xe8c6a8, { roughness: 0.9 }), sx * 0.11, 0.17, 0, g);
    const sh = mesh(new RoundedBoxGeometry(0.17, 0.09, 0.27, 4, 0.045), M(0x6a3a2a, { roughness: 0.4 }), sx * 0.11, 0.045, 0.05, g);
    mesh(new THREE.SphereGeometry(0.03, 8, 6), M(0xffd23f, { metalness: 0.6, roughness: 0.3 }), 0, 0.04, 0.1, sh);
  }
  // Rock mit Blümchen
  const prof = [[0.0, 0.2], [0.4, 0.2], [0.42, 0.24], [0.36, 0.42], [0.28, 0.62], [0.0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 36), new THREE.MeshStandardMaterial({ map: floralTex(o.skirt, o.flower), roughness: 0.85 }), 0, 0, 0, g);
  if (o.apron) {
    const ap = mesh(new THREE.CylinderGeometry(0.33, 0.41, 0.38, 24, 1, true, -0.75, 1.5), M(0xffffff, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.42, 0.012, g);
    const pocket = mesh(new RoundedBoxGeometry(0.14, 0.1, 0.02, 2, 0.01), M(0xffe3ef), 0, 0.36, 0.385, g); pocket.rotation.x = -0.2;
    const heart = new THREE.Shape(); heart.moveTo(0, -0.03); heart.bezierCurveTo(0.05, 0.01, 0.025, 0.05, 0, 0.025); heart.bezierCurveTo(-0.025, 0.05, -0.05, 0.01, 0, -0.03);
    mesh(new THREE.ShapeGeometry(heart), M(0xff4f86), 0, 0.37, 0.397, g).rotation.x = -0.2;
  }
  // Strickjacke
  const card = new THREE.MeshStandardMaterial({ map: knitTex(o.card), roughness: 0.95 });
  mesh(new THREE.CapsuleGeometry(0.235, 0.14, 8, 20), card, 0, 0.74, 0, g).scale.set(1, 1, 0.92);
  
  for (const k of [0.66, 0.74, 0.82]) mesh(new THREE.SphereGeometry(0.022, 10, 8), M(0xffd23f, { metalness: 0.5, roughness: 0.3 }), 0, k, 0.215, g);
  // Perlenkette
  for (let i = 0; i < 13; i++) { const a = Math.PI * (0.15 + 0.7 * (i / 12)); mesh(new THREE.SphereGeometry(0.019, 10, 8), M(0xfffaf0, { roughness: 0.15, metalness: 0.1 }), Math.cos(a) * 0.13, 0.89 - Math.sin(a) * 0.06, 0.1 + Math.sin(a) * 0.06, g); }
  // Arme (Pose je nach Oma)
  const arm = (side, rot, len = 0.22) => { const a = new THREE.Group(); a.position.set(side * 0.24, 0.84, 0); a.rotation.set(rot[0], rot[1], rot[2]); g.add(a); mesh(new THREE.CapsuleGeometry(0.07, len, 6, 12), card, 0, -len / 2 - 0.04, 0, a); const h = mesh(new THREE.SphereGeometry(0.07, 14, 12), skin, 0, -len - 0.1, 0, a); h.scale.set(1, 0.9, 1); return { a, h }; };
  const prop = o.prop || { hilde: 'needles', erna: 'slipper', gerda: 'tray' }[id];
  const metal = M(0xd0d8e2, { metalness: 0.8, roughness: 0.2 });
  if (prop === 'needles') {
    const L = arm(-1, [-0.9, 0, 0.35]); const R = arm(1, [-0.35, 0, 2.15]);
    const yarn = mesh(new THREE.SphereGeometry(0.11, 18, 14), M(0xff6fae, { roughness: 0.95 }), 0, -0.04, 0.06, L.h);
    for (let i = 0; i < 6; i++) { const t = mesh(new THREE.TorusGeometry(0.108, 0.009, 4, 28), M(0xd63384), 0, 0, 0, yarn); t.rotation.set(rand() * 3, rand() * 3, 0); }
    for (const k of [-0.18, 0.18]) { const n = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.46, 8), metal, k * 0.2, -0.16, 0, R.h); n.rotation.z = k; mesh(new THREE.SphereGeometry(0.026, 10, 8), M(0xe5383b), 0, 0.23, 0, n); }
  } else if (prop === 'slipper') {
    arm(-1, [-1.2, 0, 0.2]); const R = arm(1, [-0.45, 0, 2.45]);
    const sl = mesh(new RoundedBoxGeometry(0.15, 0.07, 0.3, 4, 0.035), M(0xff8fc7, { roughness: 1 }), 0, -0.08, 0.06, R.h); sl.rotation.x = 0.4;
    mesh(new THREE.SphereGeometry(0.06, 12, 10), M(0xffffff, { roughness: 1 }), 0, 0.05, 0.12, sl);
  } else if (prop === 'tray') {
    arm(-1, [-1.3, 0, 0.5]); arm(1, [-1.3, 0, -0.5]);
    const tray = mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.03, 28), metal, 0, 0.53, 0.42, g);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const ck = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 18), M(0xd99a4e), Math.cos(a) * 0.15, 0.035, Math.sin(a) * 0.15, tray); for (let k = 0; k < 4; k++) mesh(new THREE.SphereGeometry(0.012, 6, 5), M(0x4a2810), (rand() - 0.5) * 0.08, 0.017, (rand() - 0.5) * 0.08, ck); }
  } else if (prop === 'rollator') {
    arm(-1, [-1.1, 0, 0.15]); arm(1, [-1.1, 0, -0.15]);
    const rl = new THREE.Group(); rl.position.set(0, 0, 0.5); g.add(rl);
    const fr = M(0xe5383b, { metalness: 0.4, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      const bar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), fr, sx * 0.22, 0.34, 0, rl); bar.rotation.x = -0.12;
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), M(0x222222), sx * 0.22, 0.66, -0.06, rl).rotation.x = Math.PI / 2;
      for (const zz of [-0.12, 0.14]) { const w = mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16), M(0x222222), sx * 0.22, 0.06, zz, rl); w.rotation.y = Math.PI / 2; }
    }
    mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8), fr, 0, 0.42, 0.02, rl).rotation.z = Math.PI / 2;
    mesh(new RoundedBoxGeometry(0.36, 0.14, 0.2, 2, 0.03), M(0x8a5a30), 0, 0.3, 0.06, rl);
  } else if (prop === 'cat') {
    arm(-1, [-1.25, 0, 0.55]); arm(1, [-1.25, 0, -0.55]);
    const cat = new THREE.Group(); cat.position.set(0, 0.66, 0.33); g.add(cat);
    const fur = M(0xff9f43, { roughness: 1 });
    mesh(new THREE.CapsuleGeometry(0.1, 0.18, 6, 12), fur, 0, 0, 0, cat).rotation.z = Math.PI / 2;
    const ch = mesh(new THREE.SphereGeometry(0.11, 16, 12), fur, 0.18, 0.08, 0.04, cat);
    for (const sx of [-1, 1]) { mesh(new THREE.ConeGeometry(0.04, 0.08, 6), fur, sx * 0.06, 0.1, 0, ch); mesh(new THREE.SphereGeometry(0.02, 8, 6), M(0x2a7a2a), sx * 0.04, 0.02, 0.1, ch); }
    for (let i = 0; i < 3; i++) mesh(new THREE.BoxGeometry(0.02, 0.005, 0.1), M(0xd9822b), 0.02 + i * 0.04 - 0.04, 0.1, 0, cat);
    const tail = mesh(new THREE.CapsuleGeometry(0.025, 0.2, 4, 8), fur, -0.22, 0.1, 0, cat); tail.rotation.z = 0.6;
  } else if (prop === 'teeth') {
    arm(-1, [-1.0, 0, 0.3]); const R = arm(1, [-1.9, 0, -0.2]);
    const den = new THREE.Group(); den.position.set(0, -0.12, 0.05); R.h.add(den);
    for (const s of [1, -1]) { const gum = mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 20, Math.PI), M(0xff7fa0, { roughness: 0.4 }), 0, s * 0.02, 0, den); gum.rotation.set(Math.PI / 2, 0, s > 0 ? 0 : Math.PI); for (let i = 0; i < 6; i++) { const a = (i / 5) * Math.PI; mesh(new THREE.BoxGeometry(0.025, 0.035, 0.02), M(0xffffff, { roughness: 0.2 }), Math.cos(a) * 0.08 * (s > 0 ? 1 : -1), s * 0.0, Math.sin(a) * 0.08 * s, den); } }
  } else if (prop === 'can') {
    arm(-1, [-0.6, 0, 0.2]); const R = arm(1, [-1.3, 0, -0.1]);
    const can = new THREE.Group(); can.position.set(0, -0.12, 0.08); R.h.add(can);
    mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.2, 18), M(0x2e9e5b, { metalness: 0.3, roughness: 0.4 }), 0, 0, 0.05, can);
    const sp = mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.28, 8), M(0x2e9e5b, { metalness: 0.3 }), 0, 0.06, 0.24, can); sp.rotation.x = 1.0;
    mesh(new THREE.CylinderGeometry(0.045, 0.02, 0.03, 12), M(0x2e9e5b), 0, 0.14, 0.36, can).rotation.x = 1.0;
    for (let i = 0; i < 6; i++) mesh(new THREE.SphereGeometry(0.018, 6, 5), M(0x8fd3ff, { transparent: true, opacity: 0.8, roughness: 0 }), (rand() - 0.5) * 0.08, 0.1 - i * 0.05, 0.42 + i * 0.03, can);
  } else if (prop === 'bag') {
    arm(-1, [-0.5, 0, 0.3]); const R = arm(1, [-0.3, 0, 2.3]);
    const bag = new THREE.Group(); bag.position.set(0, -0.24, 0); R.h.add(bag);
    mesh(new RoundedBoxGeometry(0.26, 0.2, 0.1, 3, 0.04), M(0x8e1b3a, { roughness: 0.35 }), 0, -0.04, 0, bag);
    mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 20, Math.PI), M(0x5a1020), 0, 0.06, 0, bag);
    mesh(new THREE.BoxGeometry(0.05, 0.04, 0.02), M(0xffd23f, { metalness: 0.8, roughness: 0.3 }), 0, 0.0, 0.055, bag);
  } else if (prop === 'bingo') {
    arm(-1, [-1.2, 0, 0.3]); const R = arm(1, [-0.4, 0, 2.3]);
    const ball = mesh(new THREE.SphereGeometry(0.1, 18, 14), M(0xe5383b, { roughness: 0.2 }), 0, -0.12, 0, R.h);
    mesh(new THREE.CircleGeometry(0.05, 16), M(0xffffff), 0, 0, 0.101, ball);
    for (const [c, x] of [[0x3fb6ff, -0.1], [0xffd23f, 0.05], [0x7ddc4a, 0.2]]) mesh(new THREE.SphereGeometry(0.06, 12, 10), M(c, { roughness: 0.2 }), x - 0.2, 0.52, 0.36, g);
  } else if (prop === 'kettle') {
    arm(-1, [-0.8, 0, 0.3]); const R = arm(1, [-1.4, 0, -0.2]);
    const k = new THREE.Group(); k.position.set(0, -0.14, 0.06); R.h.add(k);
    mesh(new THREE.SphereGeometry(0.13, 18, 14), M(0xf1f1f1, { roughness: 0.25 }), 0, 0, 0.06, k).scale.set(1, 0.85, 1);
    for (let i = 0; i < 5; i++) mesh(new THREE.SphereGeometry(0.02, 8, 6), M(0x3fb6ff), Math.cos(i) * 0.1, 0.02, 0.06 + Math.sin(i) * 0.1, k);
    const sp = mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.16, 8), M(0xf1f1f1), 0, 0.03, 0.22, k); sp.rotation.x = 1.1;
    for (let i = 0; i < 4; i++) mesh(new THREE.SphereGeometry(0.05 + i * 0.02, 10, 8), M(0xffffff, { transparent: true, opacity: 0.6 - i * 0.1, roughness: 1 }), 0, 0.12 + i * 0.09, 0.3 + i * 0.03, k);
  }
  // Kopf
  const head = new THREE.Group(); head.position.set(0, 1.16, 0.02); g.add(head);
  const hs = mesh(new THREE.SphereGeometry(0.3, 40, 28), new THREE.MeshStandardMaterial({ map: omaFace(skinC, o.mood), roughness: 0.6 }), 0, 0, 0, head);
  mesh(new THREE.SphereGeometry(0.05, 14, 12), M(0xf0b48c, { roughness: 0.5 }), 0, -0.02, 0.3, head);
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.06, 12, 10), skin, sx * 0.29, -0.02, 0, head).scale.set(0.5, 1, 0.8);
  // Brille
  const gl = M(o.glasses, { roughness: 0.3, metalness: 0.2 });
  for (const sx of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.075, 0.014, 10, 32), gl, sx * 0.083, 0.02, 0.29, head); rim.rotation.y = sx * 0.18;
    const lens = mesh(new THREE.CircleGeometry(0.072, 28), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.02, clearcoat: 1 }), sx * 0.083, 0.02, 0.296, head); lens.rotation.y = sx * 0.18;
    const arm2 = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 6), gl, sx * 0.165, 0.03, 0.16, head); arm2.rotation.x = Math.PI / 2;
  }
  mesh(new THREE.TorusGeometry(0.025, 0.01, 6, 12, Math.PI), gl, 0, 0.03, 0.305, head);
  // Locken (Dauerwelle) + Dutt + Schleife
  const hairM = M(o.hair, { roughness: 0.55 });
  for (let i = 0; i < 70; i++) {
    const th = rand() * Math.PI * 2, ph = Math.acos(1 - rand() * 1.25);
    const v = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    if (v.z > 0.45 && v.y < 0.75) continue; // Gesicht frei lassen
    mesh(new THREE.SphereGeometry(0.075 + rand() * 0.03, 12, 10), hairM, v.x * 0.3, v.y * 0.3 + 0.02, v.z * 0.3 - 0.01, head);
  }
  const bunAndBow = () => {
    const bun = new THREE.Group(); bun.position.set(0, 0.33, -0.1); head.add(bun);
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; mesh(new THREE.SphereGeometry(0.07, 12, 10), hairM, Math.cos(a) * 0.07, Math.sin(i) * 0.02, Math.sin(a) * 0.07, bun); }
    mesh(new THREE.SphereGeometry(0.08, 12, 10), hairM, 0, 0.05, 0, bun);
    const bow = M(o.bow, { roughness: 0.4 });
    for (const sx of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.06, 0.12, 12), bow, sx * 0.08, 0.02, 0.08, bun); w.rotation.z = sx * Math.PI / 2; }
    mesh(new THREE.SphereGeometry(0.035, 10, 8), bow, 0, 0.02, 0.08, bun);
  };
  if (o.chef) {
    mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.18, 24), M(0xffffff, { roughness: 0.9 }), 0, 0.33, -0.02, head);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; mesh(new THREE.SphereGeometry(0.12, 14, 12), M(0xffffff, { roughness: 0.9 }), Math.cos(a) * 0.1, 0.5, Math.sin(a) * 0.1 - 0.02, head); }
  } else if (o.hat === 'sunhat') {
    const straw = M(0xf2d28b, { roughness: 0.9 });
    mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.03, 36), straw, 0, 0.24, -0.02, head).rotation.x = -0.12;
    mesh(new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw, 0, 0.24, -0.04, head);
    mesh(new THREE.TorusGeometry(0.235, 0.03, 8, 30), M(0xe5383b), 0, 0.27, -0.04, head).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.05, 10, 8), M(0xffffff), 0.2, 0.29, 0.08, head);
  } else if (o.hat === 'scarf') {
    const sc = M(0xe5383b, { roughness: 0.9 });
    mesh(new THREE.SphereGeometry(0.335, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), sc, 0, 0.02, -0.04, head).rotation.x = -0.45;
    for (let i = 0; i < 14; i++) { const th = rand() * Math.PI * 2, ph = rand() * 1.4; const v = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.45); if (v.z > 0.5) continue; mesh(new THREE.SphereGeometry(0.022, 6, 5), M(0xffffff), v.x * 0.34, v.y * 0.34 + 0.02, v.z * 0.34 - 0.04, head); }
    const knot = mesh(new THREE.SphereGeometry(0.06, 10, 8), sc, 0, -0.27, 0.12, head);
    for (const sx of [-1, 1]) mesh(new THREE.ConeGeometry(0.05, 0.14, 8), sc, sx * 0.05, -0.36, 0.12, head).rotation.z = sx * 0.4 + Math.PI;
  } else if (o.hat === 'curlers') {
    const cols = [0xff6fae, 0x3fb6ff, 0xffd23f, 0x7ddc4a];
    for (let i = 0; i < 9; i++) { const a = -1.2 + (i % 5) * 0.6, row = i < 5 ? 0.25 : 0.12; const cu = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12), M(cols[i % 4], { roughness: 0.4 }), Math.sin(a) * 0.22, row + 0.08, Math.cos(a) * 0.22 - 0.12, head); cu.rotation.z = Math.PI / 2; cu.rotation.y = a; }
    mesh(new THREE.SphereGeometry(0.32, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), M(0xffc0d8, { transparent: true, opacity: 0.25, roughness: 1 }), 0, 0.05, -0.04, head).rotation.x = -0.3;
  } else if (o.hat === 'beret') {
    const b2 = mesh(new THREE.SphereGeometry(0.28, 28, 12), M(0x2e7d32, { roughness: 0.95 }), 0.04, 0.27, -0.04, head); b2.scale.set(1, 0.32, 1); b2.rotation.z = -0.25;
    mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.06, 6), M(0x2e7d32), 0.04, 0.37, -0.04, head);
  } else if (o.hat === 'flowerhat') {
    mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.14, 24), M(0x6a3d9a, { roughness: 0.7 }), 0, 0.3, -0.04, head);
    mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 30), M(0x6a3d9a), 0, 0.24, -0.04, head);
    for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; mesh(new THREE.SphereGeometry(0.04, 8, 6), M(0xff8fc7), 0.15 + Math.cos(a) * 0.04, 0.33 + Math.sin(a) * 0.04, 0.12, head); }
    mesh(new THREE.SphereGeometry(0.03, 8, 6), M(0xffd23f), 0.15, 0.33, 0.13, head);
  } else if (o.hat === 'visor') {
    const v = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 30, 1, true), M(0x2ecc71, { side: THREE.DoubleSide, transparent: true, opacity: 0.85, roughness: 0.2 }), 0, 0.15, 0, head);
    const brim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 30, 1, false, -0.9, 1.8), M(0x2ecc71, { transparent: true, opacity: 0.8, roughness: 0.2 }), 0, 0.12, 0.08, head); brim.rotation.x = 0.25;
    bunAndBow();
  } else bunAndBow();
  if (id === 'erna') { head.rotation.set(0.05, -0.1, 0.12); }
  return outline(g);
}

// ------------------------------------------------------------- ZOMBIE ---
const ZOMBIES = {
  gustav: { name: 'Zombie Gustav', role: 'ganz normal untot', skin: '#8fd16a', shirt: '#3d7fc4', pants: 0x6b4a2e },
  jogger: { name: 'Jogger-Zombie', role: 'schnell', skin: '#9be07a', shirt: '#e5383b', pants: 0x2b2b3a, jogger: true },
  bauarbeiter: { name: 'Schild-Zombie', role: 'Deckel-Schild = gepanzert', skin: '#7cc25a', shirt: '#ff8c1a', pants: 0x3b4a8f, helmet: true, shield: true },
  dieter: { name: 'Dicker Dieter', role: 'doppelte Leben', skin: '#a3d977', shirt: '#f4f1e6', pants: 0x4a4a5a, fat: true },
  boss: { name: 'Zombie-Boss Bruno', role: 'Endboss', skin: '#6fbf5a', shirt: '#4a2a6a', pants: 0x2a1a3a, boss: true },
};
function makeZombie(id) {
  const o = ZOMBIES[id];
  const g = new THREE.Group();
  const skinHex = new THREE.Color(o.skin).getHex();
  const skin = M(skinHex, { roughness: 0.65 });
  const pants = M(o.pants, { roughness: 0.9 });
  // Beine: eins mit Schuh, eins barfuß
  const legL = mesh(new THREE.CapsuleGeometry(0.085, o.jogger ? 0.12 : 0.26, 6, 12), o.jogger ? skin : pants, -0.12, 0.24, 0.03, g); legL.rotation.x = 0.25;
  const legR = mesh(new THREE.CapsuleGeometry(0.085, o.jogger ? 0.12 : 0.26, 6, 12), o.jogger ? skin : pants, 0.12, 0.24, -0.04, g); legR.rotation.x = -0.15;
  if (o.jogger) for (const sx of [-1, 1]) mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 16), pants, sx * 0.12, 0.36, 0, g);
  mesh(new RoundedBoxGeometry(0.17, 0.09, 0.27, 4, 0.045), o.jogger ? M(0xffffff) : M(0x3a2a20, { roughness: 0.5 }), -0.12, 0.045, 0.1, g);
  const foot = mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), skin, 0.12, 0.05, 0.02, g); foot.rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.025, 8, 6), skin, 0.09 + i * 0.03, 0.04, 0.12, g);
  // Oberkörper gebeugt
  const torso = new THREE.Group(); torso.position.set(0, 0.48, 0); torso.rotation.set(0.32, 0, -0.08); g.add(torso);
  const shirt = new THREE.MeshStandardMaterial({ map: shirtTex(o.shirt, !o.helmet), roughness: 0.9 });
  const TW = o.fat ? 0.72 : 0.46, TD = o.fat ? 0.5 : 0.28;
  mesh(new RoundedBoxGeometry(TW, o.fat ? 0.5 : 0.44, TD, 5, 0.12), shirt, 0, 0.2, 0, torso);
  if (o.fat) { mesh(new THREE.SphereGeometry(0.3, 24, 18), shirt, 0, 0.08, 0.14, torso).scale.set(1.15, 0.95, 0.9); mesh(new THREE.SphereGeometry(0.06, 10, 8), skin, 0, 0.0, 0.42, torso).scale.set(1.2, 0.6, 0.4); }
  if (o.boss) {
    for (const sx of [-1, 1]) { const pad = mesh(new THREE.SphereGeometry(0.14, 14, 10), M(0x2b2b33, { metalness: 0.6, roughness: 0.35 }), sx * 0.27, 0.42, 0, torso); pad.scale.set(1.2, 0.7, 1); for (let i = 0; i < 3; i++) mesh(new THREE.ConeGeometry(0.03, 0.12, 6), M(0xd0d0d8, { metalness: 0.7, roughness: 0.3 }), sx * (0.2 + i * 0.07), 0.5, 0, torso); }
    for (let i = 0; i < 9; i++) { const a = -0.9 + i * 0.22; mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 12), M(0xffd23f, { metalness: 0.8, roughness: 0.25 }), Math.sin(a) * 0.18, 0.32 - Math.cos(a) * 0.12 + 0.12, 0.15, torso); }
  }
  for (let i = 0; i < 7; i++) { const t = mesh(new THREE.ConeGeometry(0.035, 0.08, 4), shirt, -0.19 + i * 0.063, -0.03, 0.12 - (i % 3) * 0.06, torso); t.rotation.x = Math.PI; }
  if (o.helmet) for (const y of [0.12, 0.28]) mesh(new THREE.BoxGeometry(0.47, 0.035, 0.29), M(0xe8f0ff, { emissive: 0x777777, roughness: 0.2 }), 0, y, 0, torso);
  // Arme nach vorne, Finger
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(sx * (TW / 2 + 0.04), 0.34, 0.04); arm.rotation.set(-Math.PI / 2 + 0.25 + sx * 0.12, 0, sx * 0.05); torso.add(arm);
    mesh(new THREE.CapsuleGeometry(0.065, 0.12, 4, 10), shirt, 0, -0.08, 0, arm);
    mesh(new THREE.CapsuleGeometry(0.058, 0.18, 4, 10), skin, 0, -0.26, 0, arm);
    const hand = mesh(new THREE.SphereGeometry(0.075, 12, 10), skin, 0, -0.42, 0, arm); hand.scale.set(1.1, 0.8, 0.7);
    for (const f of [-1, 0, 1]) { const fi = mesh(new THREE.CapsuleGeometry(0.018, 0.07, 3, 6), skin, f * 0.035, -0.07, 0.02, hand); fi.rotation.x = 0.3; }
  }
  if (o.shield) {
    // Mülltonnendeckel als Schild vor dem Bauch
    const lid = new THREE.Group(); lid.position.set(-0.04, 0.22, 0.4); lid.rotation.set(Math.PI / 2 - 0.25, 0, 0.15); torso.add(lid);
    mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.035, 32), M(0x9aa3ad, { metalness: 0.75, roughness: 0.3 }), 0, 0, 0, lid);
    for (const r of [0.12, 0.22, 0.3]) mesh(new THREE.TorusGeometry(r, 0.01, 6, 36), M(0x7a838d, { metalness: 0.7, roughness: 0.35 }), 0, 0.02, 0, lid).rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 16, Math.PI), M(0x5a636d, { metalness: 0.7 }), 0, 0.03, 0, lid);
    mesh(new THREE.SphereGeometry(0.06, 10, 8), M(0x8a939d, { metalness: 0.7 }), 0.15, 0.0, 0.1, lid).scale.set(1, 0.3, 1);
  }
  // Kopf
  const head = new THREE.Group(); head.position.set(0.02, o.fat ? 0.6 : 0.54, 0.1); head.rotation.set(-0.15, 0.1, 0.22); torso.add(head);
  mesh(new THREE.SphereGeometry(0.3, 40, 28), new THREE.MeshStandardMaterial({ map: zombieFace(o.skin, id), roughness: 0.65 }), 0, 0, 0, head).scale.set(1, 1.06, 0.96);
  mesh(new THREE.SphereGeometry(0.045, 12, 10), M(new THREE.Color(o.skin).multiplyScalar(0.85).getHex()), 0.01, -0.01, 0.3, head);
  mesh(new THREE.SphereGeometry(0.07, 12, 10), skin, -0.29, 0.0, 0, head).scale.set(0.5, 1, 0.8);
  // Haare / Stirnband / Helm
  if (o.boss) {
    for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(sx < 0 ? 0.05 : 0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), sx < 0 ? -0.075 : 0.075, sx < 0 ? 0.0 : 0.02, 0.27, head);
    const crown = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.12, 20, 1, true), M(0xffd23f, { metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide }), 0.02, 0.32, -0.02, head); crown.rotation.z = -0.2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; mesh(new THREE.ConeGeometry(0.035, 0.1, 6), M(0xffd23f, { metalness: 0.85, roughness: 0.25 }), Math.cos(a) * 0.2, 0.08, Math.sin(a) * 0.2, crown); mesh(new THREE.SphereGeometry(0.02, 8, 6), M(0xe5383b, { roughness: 0.1 }), Math.cos(a) * 0.21, 0.0, Math.sin(a) * 0.21, crown); }
  }
  if (o.helmet) {
    mesh(new THREE.SphereGeometry(0.33, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(0xffd23f, { roughness: 0.25, metalness: 0.1 }), 0, 0.05, 0, head);
    const brim = mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32), M(0xffd23f, { roughness: 0.25 }), 0, 0.06, 0.04, head);
    mesh(new THREE.BoxGeometry(0.05, 0.05, 0.6), M(0xf0c020), 0, 0.36, 0, head);
  } else {
    for (let i = 0; i < 6; i++) { const h = mesh(new THREE.ConeGeometry(0.03, 0.16, 6), M(0x2b2b22), -0.12 + i * 0.05, 0.29, -0.02 - (i % 2) * 0.05, head); h.rotation.z = (i - 2.5) * 0.25; h.rotation.x = -0.2; }
    if (o.jogger) { const band = mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 40), M(0xffffff, { roughness: 0.9 }), 0, 0.12, 0, head); band.rotation.x = Math.PI / 2 - 0.15; mesh(new THREE.TorusGeometry(0.29, 0.012, 6, 40), M(0xe5383b), 0, 0.12, 0, head).rotation.x = Math.PI / 2 - 0.15; }
    else { const bandage = mesh(new THREE.TorusGeometry(0.295, 0.03, 6, 40), M(0xf3ead8, { roughness: 1 }), 0, 0.08, 0, head); bandage.rotation.set(Math.PI / 2 - 0.35, 0.4, 0); }
  }
  // Fliegen
  for (let i = 0; i < 3; i++) {
    const fl = new THREE.Group(); fl.position.set(-0.3 + i * 0.25, 0.55 + (i % 2) * 0.12, 0.1); head.add(fl);
    mesh(new THREE.SphereGeometry(0.02, 8, 6), M(0x111111), 0, 0, 0, fl);
    for (const sx of [-1, 1]) { const w = mesh(new THREE.CircleGeometry(0.025, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }), sx * 0.02, 0.02, 0, fl); w.rotation.set(-1, 0, sx * 0.6); }
  }
  return outline(g);
}



// ---------------------------------------------------------------------------
// Backen: alle Teile einer Figur zu wenigen Meshes zusammenführen
// – einfarbige Teile → 1 Mesh mit Vertex-Farben, Texturen/Transparentes/Leuchtendes einzeln, Umrisse → 1 Mesh
const BAKED_SOLID = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
function prep(geo, matrix, color) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.applyMatrix4(matrix);
  if (color) {
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  return g;
}
export function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const solid = [], outline = [], special = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const mat = o.material;
    if (mat === OUTLINE) outline.push(prep(o.geometry, m));
    else if (mat.isMeshStandardMaterial && !mat.map && !mat.transparent && !mat.vertexColors) {
      const c = mat.color.clone();
      if (mat.emissive && mat.emissive.getHex()) c.add(mat.emissive.clone().multiplyScalar(0.5));
      solid.push(prep(o.geometry, m, c));
    } else {
      if (!special.has(mat)) special.set(mat, []);
      special.get(mat).push(prep(o.geometry, m));
    }
  });
  const out = new THREE.Group();
  const add = (geos, mat, shadow = true) => {
    if (!geos.length) return;
    const merged = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow;
    out.add(mesh);
  };
  add(solid, BAKED_SOLID);
  for (const [mat, geos] of special) add(geos, mat, !mat.transparent);
  add(outline, OUTLINE, false);
  return out;
}
// Vorlagen nur einmal bauen, danach nur Kopien (teilen Geometrie + Material)
const templates = new Map();
export function figure(kind, id) {
  const key = kind + ':' + id;
  if (!templates.has(key)) templates.set(key, bake(kind === 'oma' ? makeOma(id) : makeZombie(id)));
  return templates.get(key).clone();
}
export function setSeed(s) { seed = s; }
export { THREE, M, mesh, cookie, tree, house, cobbleTex, fence, bench, flowerBed, gnome, pond, sparkle, OMAS, ZOMBIES, makeOma, makeZombie, RoundedBoxGeometry, rand };
