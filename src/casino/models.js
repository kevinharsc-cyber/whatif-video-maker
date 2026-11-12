// GRANDPA'S CASINO – prozedurale 3D-Modelle im Toy-Diorama-Stil
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export { THREE };
export function rng(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- Material ---
const matCache = new Map();
export function M(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o }));
  return matCache.get(k);
}
export function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
export const box = (w, h, d, r = 0.04) => (r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)) : new THREE.BoxGeometry(w, h, d));

function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4;
  return t;
}
export const TEX = {};
export function buildTextures() {
  const r = rng(5);
  TEX.asphalt = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#4b4f57'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.06})`; x.fillRect(r() * w, r() * h, 2, 2); } });
  TEX.sidewalk = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c9c2b5'; x.fillRect(0, 0, w, h); x.strokeStyle = '#a9a294'; x.lineWidth = 3; x.strokeRect(1, 1, w - 2, h - 2); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke(); });
  TEX.grass = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7bb35a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(60,120,40,0.35)' : 'rgba(150,200,100,0.3)'; x.fillRect(r() * w, r() * h, 2, 4); } });
  TEX.plaster = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8d8c88'; x.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { const g = x.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 10 + r() * 40); g.addColorStop(0, `rgba(60,55,45,${0.08 + r() * 0.12})`); g.addColorStop(1, 'rgba(60,55,45,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } x.strokeStyle = 'rgba(50,48,44,0.5)'; for (let i = 0; i < 8; i++) { x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 30; py += r() * 20; x.lineTo(px, py); } x.stroke(); } }, [3, 1]);
  TEX.concrete = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8a8a86'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '40,40,40' : '170,170,165'},${0.06 + r() * 0.08})`; x.fillRect(r() * w, r() * h, 2, 2); } x.strokeStyle = 'rgba(55,55,52,0.55)'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } for (let i = 0; i < 25; i++) { const g = x.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 6 + r() * 26); g.addColorStop(0, `rgba(50,45,38,${0.1 + r() * 0.2})`); g.addColorStop(1, 'rgba(50,45,38,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } }, [4, 6]);
  TEX.wallpaper = canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#7a1424'; x.fillRect(0, 0, w, h); x.fillStyle = '#8f1d30'; for (let i = 0; i < w; i += 32) x.fillRect(i, 0, 14, h); x.fillStyle = '#d9a640'; for (let yy = 16; yy < h; yy += 48) for (let xx = 23; xx < w; xx += 32) { x.beginPath(); x.moveTo(xx, yy - 8); x.lineTo(xx + 6, yy); x.lineTo(xx, yy + 8); x.lineTo(xx - 6, yy); x.fill(); } }, [8, 1]);
  TEX.carpet = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#5a1530'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d6a43a'; x.lineWidth = 3; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(i * 64 + 32, k * 64 + 32, 20, 0, 7); x.stroke(); x.fillStyle = '#1f6b5c'; x.beginPath(); x.arc(i * 64 + 32, k * 64 + 32, 8, 0, 7); x.fill(); } x.fillStyle = 'rgba(214,164,58,0.6)'; for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) x.fillRect(i * 64 - 3, k * 64 - 3, 6, 6); }, [5, 7]);
  TEX.brick = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7d6e66'; x.fillRect(0, 0, w, h); for (let row = 0; row < 16; row++) for (let col = 0; col < 9; col++) { const off = row % 2 ? 14 : 0; x.fillStyle = `hsl(${10 + r() * 12},${35 + r() * 15}%,${36 + r() * 12}%)`; x.fillRect(col * 30 - off + 1, row * 16 + 1, 28, 14); } }, [2, 2]);
  TEX.wood = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#8a5a34'; x.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(60,35,18,${0.15 + r() * 0.25})`; x.beginPath(); const yy = r() * h; x.moveTo(0, yy); x.bezierCurveTo(w / 3, yy + (r() - 0.5) * 8, (2 * w) / 3, yy + (r() - 0.5) * 8, w, yy); x.stroke(); } });
  TEX.door = canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#5d4a3a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { x.fillStyle = `hsl(25,${15 + r() * 10}%,${24 + r() * 8}%)`; x.fillRect(i * 26 + 1, 0, 24, h); } x.strokeStyle = 'rgba(20,14,10,0.6)'; x.lineWidth = 2; for (let i = 0; i < 14; i++) { x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 30, py + r() * 30); x.stroke(); } x.fillStyle = '#3a2c20'; x.fillRect(0, 60, w, 10); x.fillRect(0, 186, w, 10); x.fillStyle = '#b8a070'; x.beginPath(); x.arc(w - 18, h / 2, 6, 0, 7); x.fill(); });
  TEX.roof = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#b54b3c'; x.fillRect(0, 0, w, h); for (let row = 0; row < 8; row++) { x.fillStyle = 'rgba(80,20,15,0.35)'; x.fillRect(0, row * 16 + 13, w, 3); for (let col = 0; col < 8; col++) { x.fillStyle = 'rgba(80,20,15,0.25)'; x.fillRect(col * 16 + (row % 2) * 8, row * 16, 2, 14); } } }, [3, 2]);
  TEX.window = canvasTex(64, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#bfe3f2'); g.addColorStop(0.5, '#7fb6d1'); g.addColorStop(1, '#4f88a8'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,0.35)'; x.beginPath(); x.moveTo(8, 50); x.lineTo(30, 8); x.lineTo(40, 8); x.lineTo(18, 50); x.fill(); });
  TEX.dirtyWindow = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#3a3f44'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(120,115,100,${r() * 0.25})`; x.fillRect(r() * w, r() * h, 3, 3); } x.strokeStyle = 'rgba(200,200,200,0.5)'; x.beginPath(); x.moveTo(10, 10); x.lineTo(30, 34); x.lineTo(24, 58); x.moveTo(30, 34); x.lineTo(52, 30); x.stroke(); });
}

// Baut eine Gruppe in wenige Meshes zusammen (Leistung auf dem Handy)
export function bake(group, { cast = true } = {}) {
  group.updateMatrixWorld(true);
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.userData.keep) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const gg = g.index ? g.toNonIndexed() : g;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(gg);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = cast; m.receiveShadow = true;
    out.add(m);
  }
  group.traverse((o) => { if (o.userData.keep) { const c = o.clone(); o.matrixWorld.decompose(c.position, c.quaternion, c.scale); out.add(c); } });
  return out;
}

// ------------------------------------------------------------ Figuren ---
function faceTexture(skin, hair, opts = {}) {
  return canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = skin; x.fillRect(0, 0, w, h);
    const cx = w * 0.25; // Gesicht zeigt nach +z (Sphere-UV u=0.25)
    x.fillStyle = '#23180f';
    x.beginPath(); x.ellipse(cx - 13, 62, 5, 7, 0, 0, 7); x.ellipse(cx + 13, 62, 5, 7, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx - 11, 59, 2, 0, 7); x.arc(cx + 15, 59, 2, 0, 7); x.fill();
    x.fillStyle = 'rgba(230,110,110,0.35)'; x.beginPath(); x.ellipse(cx - 24, 76, 8, 5, 0, 0, 7); x.ellipse(cx + 24, 76, 8, 5, 0, 0, 7); x.fill();
    x.strokeStyle = '#5a2a1a'; x.lineWidth = 3; x.beginPath(); x.arc(cx, 76, 8, 0.2, Math.PI - 0.2); x.stroke();
    if (opts.glasses) { x.strokeStyle = '#222'; x.lineWidth = 3; x.beginPath(); x.arc(cx - 13, 62, 10, 0, 7); x.moveTo(cx + 23, 62); x.arc(cx + 13, 62, 10, 0, 7); x.moveTo(cx - 3, 62); x.lineTo(cx + 3, 62); x.stroke(); }
    if (opts.beard) { x.fillStyle = hair; x.beginPath(); x.ellipse(cx, 92, 26, 16, 0, 0, Math.PI); x.fill(); }
  });
}
export function makePerson(o = {}) {
  const skin = o.skin || '#f1c7a1', shirt = o.shirt || '#3d7ad6', pants = o.pants || '#2e3550', hair = o.hair || '#5a3a22', shoes = o.shoes || '#3a2a1e';
  const g = new THREE.Group();
  const root = new THREE.Group(); g.add(root);
  const mSkin = M(skin), mShirt = M(shirt), mPants = M(pants), mShoe = M(shoes), mHair = M(hair, { roughness: 0.9 });
  // Beine (Drehpunkt an der Hüfte)
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.11, 0.52, 0);
    p.add(mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10), mPants, 0, -0.24, 0));
    p.add(mesh(box(0.15, 0.09, 0.24, 0.04), mShoe, 0, -0.47, 0.04));
    root.add(p); return p;
  });
  const body = new THREE.Group(); body.position.y = 0.52; root.add(body);
  body.add(mesh(box(0.42, 0.18, 0.26, 0.08), mPants, 0, 0.04, 0));
  body.add(mesh(new THREE.CapsuleGeometry(0.2, 0.22, 6, 14), mShirt, 0, 0.3, 0));
  if (o.vest) body.add(mesh(box(0.36, 0.3, 0.3, 0.08), M(o.vest), 0, 0.3, 0.02));
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group(); p.position.set(s * 0.26, 0.5, 0);
    p.add(mesh(new THREE.CapsuleGeometry(0.065, 0.26, 4, 10), mShirt, 0, -0.17, 0));
    p.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), mSkin, 0, -0.36, 0));
    body.add(p); return p;
  });
  const head = new THREE.Group(); head.position.y = 0.72; body.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), mSkin, 0, 0.0, 0));
  const hm = new THREE.MeshStandardMaterial({ map: faceTexture(skin, hair, o), roughness: 0.8 });
  head.add(mesh(new THREE.SphereGeometry(0.25, 28, 20), hm, 0, 0.24, 0));
  head.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), mSkin, -0.25, 0.24, 0), mesh(new THREE.SphereGeometry(0.05, 10, 8), mSkin, 0.25, 0.24, 0));
  if (o.bald) { /* Glatze */ } else if (o.bun) {
    head.add(mesh(new THREE.SphereGeometry(0.262, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), mHair, 0, 0.25, -0.01));
    head.add(mesh(new THREE.SphereGeometry(0.12, 14, 12), mHair, 0, 0.47, -0.12));
  } else {
    const cap = mesh(new THREE.SphereGeometry(0.265, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mHair, 0, 0.25, -0.02);
    cap.rotation.x = -0.25; head.add(cap);
  }
  if (o.hat) { head.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), M(o.hat), 0, 0.42, 0)); head.add(mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.16, 20), M(o.hat), 0, 0.5, 0)); }
  // Schatten-Fleck für Kontakt zum Boden
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; g.add(blob);
  return { group: g, root, body, legs, arms, head };
}
// Laufanimation: phase in Schritten, amount 0..1
export function animatePerson(p, phase, amount, t, sit = 0) {
  const sw = Math.sin(phase) * 0.7 * amount;
  p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
  p.arms[0].rotation.x = -sw * 0.8; p.arms[1].rotation.x = sw * 0.8;
  p.arms[0].rotation.z = -0.08; p.arms[1].rotation.z = 0.08;
  p.root.position.y = Math.abs(Math.cos(phase)) * 0.05 * amount + Math.sin(t * 2) * 0.004 * (1 - amount);
  p.body.rotation.z = Math.sin(phase) * 0.04 * amount;
  p.body.scale.y = 1 + Math.sin(t * 2.2) * 0.01 * (1 - amount);
  if (sit) { p.legs[0].rotation.x = p.legs[1].rotation.x = -1.4 * sit; p.root.position.y = -0.18 * sit; }
}

// ------------------------------------------------------------- Häuser ---
function windowFrame(w, h, dirty = false) {
  const g = new THREE.Group();
  g.add(mesh(box(w + 0.14, h + 0.14, 0.08, 0.03), M('#f4efe4'), 0, 0, 0));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: dirty ? TEX.dirtyWindow : TEX.window, roughness: 0.2, metalness: 0.1 }));
  glass.position.z = 0.045; g.add(glass);
  g.add(mesh(box(0.04, h, 0.04, 0), M('#f4efe4'), 0, 0, 0.06), mesh(box(w, 0.04, 0.04, 0), M('#f4efe4'), 0, 0, 0.06));
  g.add(mesh(box(w + 0.3, 0.06, 0.18, 0.02), M('#e8e0d0'), 0, -h / 2 - 0.09, 0.06));
  return g;
}
// Haus: Fassade zeigt nach +z (wird beim Aufstellen gedreht)
export function makeHouse(kind, seed) {
  const r = rng(seed);
  const g = new THREE.Group();
  const P = {
    small: { w: 6, d: 5.5, h: 3.4, colors: ['#f2c6a0', '#a8d5c2', '#f3e2a1', '#c7b7e6', '#f4b6b6'], roof: true },
    tall: { w: 6.5, d: 6, h: 6.2, colors: ['#9fc3e8', '#f0d6a8', '#d7e8a6'], roof: true },
    shop: { w: 7.5, d: 6, h: 4, colors: ['#ffffff'], roof: false },
    old: { w: 7, d: 6, h: 5, colors: ['#9e8f84'], roof: false, brick: true },
    deco: { w: 6, d: 5, h: 3.2, colors: ['#e6f0ff'], roof: true },
  }[kind];
  const col = P.colors[Math.floor(r() * P.colors.length)];
  const wallMat = P.brick ? new THREE.MeshStandardMaterial({ map: TEX.brick.clone(), roughness: 0.9 }) : M(col, { roughness: 0.85 });
  if (P.brick) { wallMat.map.repeat.set(3, 2.5); wallMat.map.needsUpdate = true; }
  g.add(mesh(box(P.w, P.h, P.d, 0.06), wallMat, 0, P.h / 2, 0));
  g.add(mesh(box(P.w + 0.2, 0.25, P.d + 0.2, 0.04), M('#cfc6b6'), 0, 0.12, 0)); // Sockel
  if (P.roof) {
    const roofH = 1.6 + r() * 0.6;
    const shape = new THREE.Shape(); shape.moveTo(-P.w / 2 - 0.35, 0); shape.lineTo(P.w / 2 + 0.35, 0); shape.lineTo(0, roofH); shape.closePath();
    const rg = new THREE.ExtrudeGeometry(shape, { depth: P.d + 0.5, bevelEnabled: false }); rg.translate(0, 0, -(P.d + 0.5) / 2);
    const rm = new THREE.MeshStandardMaterial({ map: TEX.roof, roughness: 0.8, color: ['#ffffff', '#c9d8ff', '#ffe0c0'][Math.floor(r() * 3)] });
    g.add(mesh(rg, rm, 0, P.h, 0));
    const ch = mesh(box(0.5, 1.2, 0.5, 0.04), M('#8d6e63'), P.w * 0.25, P.h + roofH * 0.6, -0.6); g.add(ch);
  } else {
    g.add(mesh(box(P.w + 0.25, 0.3, P.d + 0.25, 0.05), M(P.brick ? '#6d6058' : '#e8e2d8'), 0, P.h + 0.15, 0));
  }
  const fz = P.d / 2 + 0.01;
  // Tür
  const door = mesh(box(1.1, 2.1, 0.12, 0.04), M(['#7b4b2a', '#2f5d8a', '#3f6b45', '#8a2f3c'][Math.floor(r() * 4)]), kind === 'shop' ? P.w / 2 - 1.2 : -P.w * 0.22, 1.2, fz);
  g.add(door);
  g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#e2c26a', { metalness: 0.6, roughness: 0.3 }), door.position.x + 0.4, 1.2, fz + 0.08));
  g.add(mesh(box(1.5, 0.12, 0.6, 0.03), M('#bdb3a3'), door.position.x, 0.06, fz + 0.3));
  if (kind === 'shop') {
    const sw = windowFrame(4, 1.8); sw.position.set(-1, 1.5, fz); g.add(sw);
    // Markise
    const aw = new THREE.Group();
    for (let i = 0; i < 9; i++) aw.add(mesh(box(P.w / 9, 0.05, 1.3, 0), M(i % 2 ? '#ffffff' : '#e0453a'), -P.w / 2 + (i + 0.5) * (P.w / 9), 0, 0, true));
    aw.position.set(0, 3.0, fz + 0.6); aw.rotation.x = 0.35; g.add(aw);
    g.add(signBoard('BÄCKEREI', '#5a3a22', '#ffe9b0', 3.4, 0.6, 0, 3.6, fz + 0.02));
  } else if (kind === 'old') {
    for (const [x, y] of [[-1.8, 1.6], [1.6, 1.6], [-1.8, 3.6], [1.6, 3.6], [0, 3.6]]) { const w = windowFrame(1, 1.2, true); w.position.set(x, y, fz); g.add(w); if (r() < 0.6) { const b = mesh(box(1.3, 0.16, 0.06, 0.01), M('#7a5a3a'), x, y + (r() - 0.5) * 0.3, fz + 0.1); b.rotation.z = (r() - 0.5) * 0.5; g.add(b); } }
  } else {
    const floors = Math.max(1, Math.floor(P.h / 2.6));
    for (let f = 0; f < floors; f++) for (const x of [-P.w * 0.22, P.w * 0.24]) { if (f === 0 && x < 0) continue; const w = windowFrame(1.1, 1.2); w.position.set(x, 1.6 + f * 2.6, fz); g.add(w); }
    if (floors === 1) { const w = windowFrame(1.1, 1.2); w.position.set(P.w * 0.24, 1.6, fz); }
    // Blumenkasten
    const fb = mesh(box(1.2, 0.22, 0.3, 0.04), M('#7a4b2a'), P.w * 0.24, 0.95, fz + 0.2); g.add(fb);
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M(['#e94b6a', '#ffd23f', '#ffffff', '#ff8fb1'][i % 4]), P.w * 0.24 - 0.45 + i * 0.22, 1.12, fz + 0.22));
  }
  if (kind === 'deco') { // kleines Café mit Schirm
    const t = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), M('#ffffff'), 1.6, 0.75, fz + 1.4); g.add(t);
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), M('#666'), 1.6, 1.1, fz + 1.4));
    g.add(mesh(new THREE.ConeGeometry(1.1, 0.45, 12), M('#2a9d8f'), 1.6, 2.25, fz + 1.4));
    g.add(signBoard('CAFÉ', '#2a9d8f', '#ffffff', 1.8, 0.5, -0.6, 2.75, fz + 0.02));
  }
  return { group: bake(g), w: P.w, d: P.d };
}
export function signBoard(text, bg, fg, w, h, x, y, z) {
  const t = canvasTex(512, Math.round((512 * h) / w), (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.font = `bold ${H * 0.62}px "Lilita One", Arial Black, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + 2); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  m.position.set(x, y, z + 0.03);
  const g = new THREE.Group(); g.add(mesh(box(w + 0.12, h + 0.12, 0.06, 0.02), M('#3a2a1e'), x, y, z)); g.add(m);
  return g;
}

// ----------------------------------------------------------- Straße & Deko ---
export function makeTree(seed) {
  const r = rng(seed); const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4, 8), M('#7a5230'), 0, 0.7, 0));
  const leaf = M(['#5aa64a', '#6fbf5a', '#4f9a52'][Math.floor(r() * 3)], { roughness: 0.9 });
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.55 + r() * 0.25, 1), leaf, (r() - 0.5) * 0.6, 1.6 + r() * 0.7, (r() - 0.5) * 0.6));
  return bake(g);
}
export function makeLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), M('#2f3b45', { metalness: 0.5, roughness: 0.4 }), 0, 1.6, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.12, 8), M('#2f3b45'), 0, 0.06, 0));
  const head = mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff4d6', emissive: '#ffcf7a', emissiveIntensity: 0.3 }), 0, 3.3, 0);
  head.userData.keep = true; head.name = 'bulb';
  g.add(head);
  g.add(mesh(new THREE.ConeGeometry(0.28, 0.2, 10), M('#2f3b45'), 0, 3.5, 0));
  return g;
}
export function makeBench() {
  const g = new THREE.Group(); const w = M('#a0673a');
  for (let i = 0; i < 3; i++) g.add(mesh(box(1.6, 0.06, 0.14, 0.02), w, 0, 0.45, -0.18 + i * 0.16));
  for (let i = 0; i < 2; i++) g.add(mesh(box(1.6, 0.14, 0.05, 0.02), w, 0, 0.7 + i * 0.18, -0.28));
  for (const x of [-0.7, 0.7]) g.add(mesh(box(0.08, 0.45, 0.5, 0.02), M('#333'), x, 0.22, -0.05));
  return bake(g);
}
export function makeCar(color, seed) {
  const g = new THREE.Group(); const c = M(color, { roughness: 0.35, metalness: 0.2 });
  g.add(mesh(box(1.7, 0.55, 3.4, 0.2), c, 0, 0.55, 0));
  g.add(mesh(box(1.5, 0.5, 1.8, 0.2), c, 0, 1.05, -0.2));
  g.add(mesh(box(1.52, 0.36, 1.7, 0.12), M('#9fd3ef', { roughness: 0.1 }), 0, 1.07, -0.2));
  for (const [x, z] of [[-0.8, 1.1], [0.8, 1.1], [-0.8, -1.1], [0.8, -1.1]]) { const w = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14), M('#222'), x, 0.32, z); w.rotation.z = Math.PI / 2; g.add(w); }
  for (const x of [-0.55, 0.55]) g.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), M('#fff7c2', { emissive: '#fff0a0', emissiveIntensity: 0.4 }), x, 0.65, 1.7));
  void seed;
  return bake(g);
}
export function makeHydrant() { const g = new THREE.Group(); const red = M('#d63a2f', { roughness: 0.5 }); g.add(mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.6, 10), red, 0, 0.3, 0)); g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), red, 0, 0.62, 0)); g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), red, 0, 0.4, 0).rotateZ(Math.PI / 2)); return bake(g); }
export function makeHedge(len) { const g = new THREE.Group(); const m = M('#4f9a52', { roughness: 0.95 }); for (let i = 0; i < len; i++) g.add(mesh(new THREE.IcosahedronGeometry(0.55, 1), m, i - len / 2 + 0.5, 0.45, 0)); return bake(g); }

// ------------------------------------------------------- Casino-Inventar ---
function reelTexture() {
  const syms = ['🍒', '🔔', '7', '🍋', '⭐', 'BAR', '🍇', '💎'];
  const t = canvasTex(64, 512, (x, w, h) => { x.fillStyle = '#fffaf0'; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; syms.forEach((s, i) => { x.fillStyle = s === '7' ? '#d62828' : s === 'BAR' ? '#222' : '#000'; x.font = s.length > 2 ? 'bold 18px Arial' : '40px sans-serif'; x.fillText(s, w / 2, i * 64 + 32); x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, i * 64 + 62, w, 2); }); });
  t.repeat.set(1, 3 / 8);
  return t;
}
export const SLOT_SYMBOLS = 8;
export function makeSlot(style = 'classic') {
  const g = new THREE.Group();
  const body = style === 'deluxe' ? M('#6a1fb3', { roughness: 0.35, metalness: 0.3 }) : M('#c8202f', { roughness: 0.35, metalness: 0.25 });
  const gold = M('#e8b730', { roughness: 0.3, metalness: 0.8 });
  g.add(mesh(box(0.9, 0.8, 0.7, 0.06), M('#2a2a32'), 0, 0.4, 0));
  g.add(mesh(box(0.86, 1.0, 0.62, 0.1), body, 0, 1.25, 0));
  g.add(mesh(box(0.92, 0.1, 0.72, 0.04), gold, 0, 0.82, 0));
  g.add(mesh(box(0.92, 0.08, 0.66, 0.03), gold, 0, 1.78, 0));
  const top = mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.62, 20, 1, false, 0, Math.PI), body, 0, 1.82, 0); top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.scale.set(1, 1, 0.45); g.add(top);
  g.add(mesh(box(0.72, 0.42, 0.06, 0.03), M('#1a1a1e'), 0, 1.35, 0.3));
  const panel = mesh(box(0.7, 0.12, 0.25, 0.03), M('#26262c'), 0, 0.95, 0.38); panel.rotation.x = -0.4; g.add(panel);
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12), M(['#ff4d4d', '#ffd23f', '#4dd96b'][i], { emissive: ['#ff4d4d', '#ffd23f', '#4dd96b'][i], emissiveIntensity: 0.5 }), -0.18 + i * 0.18, 1.0, 0.43).rotateX(1.17));
  g.add(mesh(box(0.4, 0.12, 0.12, 0.03), M('#111'), 0, 0.62, 0.36));
  g.add(signBoard(style === 'deluxe' ? 'DIAMOND' : 'LUCKY 7', style === 'deluxe' ? '#2a0a4a' : '#5a0a12', '#ffd23f', 0.62, 0.16, 0, 1.64, 0.3));
  const baked = bake(g);
  // bewegliche Teile (nicht zusammengebacken)
  const reels = [];
  for (let i = 0; i < 3; i++) {
    const tex = reelTexture(); tex.offset.y = (i * 3) / 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.34), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(-0.22 + i * 0.22, 1.35, 0.335); baked.add(m); reels.push(tex);
  }
  const lever = new THREE.Group(); lever.position.set(0.47, 1.2, 0.05);
  lever.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), M('#c9c9c9', { metalness: 0.8, roughness: 0.3 }), 0, 0.25, 0));
  lever.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), M('#e62e2e', { roughness: 0.3 }), 0, 0.52, 0));
  baked.add(lever);
  const lamp = mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshStandardMaterial({ color: '#ffe680', emissive: '#ffcc33', emissiveIntensity: 0.6 }), 0, 2.08, 0);
  baked.add(lamp);
  baked.userData = { reels, lever, lamp };
  return baked;
}
export function makeCounter() {
  const g = new THREE.Group();
  g.add(mesh(box(2.4, 1.0, 0.8, 0.06), new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.6 }), 0, 0.5, 0));
  g.add(mesh(box(2.5, 0.08, 0.9, 0.03), M('#2a1a10', { roughness: 0.3 }), 0, 1.04, 0));
  g.add(mesh(box(2.42, 0.08, 0.06, 0.02), M('#e8b730', { metalness: 0.8, roughness: 0.3 }), 0, 0.85, 0.42));
  g.add(mesh(box(0.5, 0.3, 0.4, 0.04), M('#3a3a42'), -0.6, 1.23, 0));
  g.add(mesh(box(0.42, 0.06, 0.2, 0.02), M('#d8d8d8'), -0.6, 1.4, 0.06).rotateX(-0.5));
  g.add(mesh(new THREE.SphereGeometry(0.08, 12, 8, 0, 7, 0, Math.PI / 2), M('#e8b730', { metalness: 0.8, roughness: 0.3 }), 0.6, 1.08, 0.2));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02 + i * 0.015, 14), M(['#d62828', '#2a9d8f', '#222', '#e8b730'][i]), 0.1 + i * 0.12, 1.1, -0.15));
  return bake(g);
}
export function makeChair() {
  const g = new THREE.Group(); const red = M('#9b1d2a', { roughness: 0.6 });
  g.add(mesh(box(0.8, 0.35, 0.75, 0.12), red, 0, 0.35, 0));
  g.add(mesh(box(0.8, 0.6, 0.18, 0.08), red, 0, 0.75, -0.3));
  for (const x of [-0.36, 0.36]) g.add(mesh(box(0.14, 0.3, 0.7, 0.06), red, x, 0.62, 0));
  for (const [x, z] of [[-0.3, -0.28], [0.3, -0.28], [-0.3, 0.28], [0.3, 0.28]]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), M('#e8b730', { metalness: 0.8 }), x, 0.09, z));
  return bake(g);
}
export function makeFloorLamp() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 16), M('#e8b730', { metalness: 0.8, roughness: 0.3 }), 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8), M('#e8b730', { metalness: 0.8, roughness: 0.3 }), 0, 0.8, 0));
  const shade = mesh(new THREE.CylinderGeometry(0.18, 0.32, 0.36, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcc66', emissiveIntensity: 0.9, side: THREE.DoubleSide }), 0, 1.7, 0);
  g.add(shade);
  return bake(g);
}
export function makePlant() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.45, 14), M('#e8e2d8'), 0, 0.22, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14), M('#e8b730', { metalness: 0.7 }), 0, 0.44, 0));
  const leaf = M('#3f9a4a', { roughness: 0.8 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const l = mesh(new THREE.SphereGeometry(0.18, 8, 6), leaf, Math.cos(a) * 0.18, 0.75 + (i % 3) * 0.18, Math.sin(a) * 0.18); l.scale.set(0.5, 1.5, 0.3); l.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(l); }
  return bake(g);
}
export function makeStatue() {
  const g = new THREE.Group(); const gold = M('#e8b730', { metalness: 0.9, roughness: 0.25 });
  g.add(mesh(box(0.6, 0.5, 0.6, 0.05), M('#2a2a32'), 0, 0.25, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), gold, 0, 0.53, 0));
  const coin = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 28), gold, 0, 0.95, 0); coin.rotation.x = Math.PI / 2; g.add(coin);
  g.add(mesh(box(0.06, 0.4, 0.04, 0), M('#c99400', { metalness: 0.9 }), 0, 0.95, 0.05));
  return bake(g);
}
export function makeRug() {
  const g = new THREE.Group();
  const t = TEX.carpet.clone(); t.repeat.set(2, 1.4); t.needsUpdate = true;
  const m = mesh(box(2.4, 0.03, 1.6, 0.01), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }), 0, 0.015, 0, false);
  g.add(m);
  g.add(mesh(box(2.5, 0.02, 1.7, 0.01), M('#d6a43a'), 0, 0.008, 0, false));
  return bake(g, { cast: false });
}
export function makeCrate() { // Geschenk-Kiste
  const g = new THREE.Group();
  g.add(mesh(box(0.7, 0.6, 0.7, 0.04), M('#e94b6a'), 0, 0.3, 0));
  g.add(mesh(box(0.72, 0.62, 0.12, 0.02), M('#ffd23f'), 0, 0.3, 0), mesh(box(0.12, 0.62, 0.72, 0.02), M('#ffd23f'), 0, 0.3, 0));
  return bake(g);
}
