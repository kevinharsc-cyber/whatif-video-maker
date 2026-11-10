// OMA vs ZOMBIES – Tower-Defense mit Omas gegen Zombies (Three.js, läuft im Browser auf dem iPhone)
import { THREE, figure, M, mesh, cookie, tree, house, fence, bench, flowerBed, gnome, pond, OMAS, RoundedBoxGeometry, setSeed, rand, bake } from './models.js';
import { OMA_DEF, ZOMBIE_DEF, MAPS, mapPoints, genWaves, startCookies, starsFor, LIVES, LEVELS_PER_MAP, UNLOCK_NEXT_MAP } from './rules.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('de-DE');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat */ } },
};
// Fortschritt je Karte: freigeschaltetes Level + Sterne
const progress = store.get('ovz-progress', null) || { maps: {} };
for (const m of MAPS) progress.maps[m.id] ||= { unlocked: 1, stars: {} };
const settings = { sfx: true, auto: true, ...store.get('ovz-settings', {}) };
const saveProgress = () => store.set('ovz-progress', progress);
const saveSettings = () => store.set('ovz-settings', settings);
const mapUnlocked = (i) => i === 0 || progress.maps[MAPS[i - 1].id].unlocked > UNLOCK_NEXT_MAP;

// ------------------------------------------------------------------ Renderer ---
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 220);
const view = { tx: 0, tz: 0, dist: 20, minD: 7, maxD: 40, fitD: 20, bounds: { x0: -8, x1: 8, z0: -15, z1: 16 } };
const TILT = THREE.MathUtils.degToRad(58);
function halfView(dist = view.dist) {
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  return { hw: dist * Math.tan(hf / 2), hd: (dist * Math.tan(vf / 2)) / Math.sin(TILT) * 0.85, hf };
}
// Kamera bleibt immer über der Karte – der Wegrand draußen (wo die Zombies herkommen) ist nie zu sehen
function placeCamera() {
  const b = view.bounds;
  view.dist = Math.max(view.minD, Math.min(view.maxD, view.dist));
  const { hw, hd } = halfView();
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  view.tx = b.x1 - b.x0 <= 2 * hw ? cx : Math.max(b.x0 + hw, Math.min(b.x1 - hw, view.tx));
  view.tz = b.z1 - b.z0 <= 2 * hd ? cz : Math.max(b.z0 + hd, Math.min(b.z1 - hd, view.tz));
  camera.position.set(view.tx, Math.sin(TILT) * view.dist, view.tz + Math.cos(TILT) * view.dist);
  camera.lookAt(view.tx, 0, view.tz);
  if (W.sun) {
    W.sun.position.set(view.tx + 6, 16, view.tz + 7);
    W.sun.target.position.set(view.tx, 0, view.tz);
  }
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (T.cam) { T.cam.aspect = w / h; T.cam.fov = w / h < 0.8 ? 52 : 38; T.cam.updateProjectionMatrix(); }
  const { hf } = halfView(1);
  const bw = (view.bounds.x1 - view.bounds.x0) / 2;
  view.maxD = (bw + 0.5) / Math.tan(hf / 2);
  view.fitD = Math.min(view.maxD, 5.8 / Math.tan(hf / 2));
  if (!view.userZoom) view.dist = view.fitD;
  placeCamera();
}
window.addEventListener('resize', resize);

// --------------------------------------------------------- Welt / Themen ---
const THEMES = {
  day: { sky: 0x9fd8ff, fog: [40, 90], hemi: [0xffffff, 0x6a8a4a, 1.4], sun: [0xfff1d6, 2.3], grass: ['#6cbf4a', '#7ccf57', '#5aad3d'], stones: ['#e3c98e', '#d8bb7c', '#ecd6a2', '#cfb37a'], gap: '#9a8a72', edge: 0xb9b2a4, tuft: 0x4fa83d, flowers: [0xff6b8b, 0xffd23f, 0xffffff, 0xb06bff] },
  night: { sky: 0x171c38, fog: [26, 70], hemi: [0x8a98e8, 0x2a2a44, 1.6], sun: [0xb8c8ff, 1.6], grass: ['#2f4a3a', '#3a5a44', '#28402f'], stones: ['#6b5f86', '#5e547a', '#776a92'], gap: '#3e3550', edge: 0x8a86a0, tuft: 0x3a5a44, flowers: [0x9b8cff, 0x6fd3ff] },
  snow: { sky: 0xcfe6ff, fog: [36, 90], hemi: [0xffffff, 0x8aa0c0, 1.5], sun: [0xfff6ea, 2.0], grass: ['#eef5ff', '#ffffff', '#dde8f5'], stones: ['#c9c4bd', '#d6d1ca', '#bdb7af', '#e0dbd4'], gap: '#8f8a84', edge: 0xf2f6ff, tuft: 0xb8c8d8, flowers: [0xff4f4f, 0x3fb6ff] },
};
const W = { scene: null, curve: null, len: 1, samples: [], blockers: [], sun: null, theme: 'day', snow: null, flies: null };
function noiseTex(cols, rep) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = cols[0]; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = cols[1 + (i % 2)]; g.beginPath(); g.ellipse(rand() * 512, rand() * 512, 3 + rand() * 9, 2 + rand() * 4, rand() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cobble(th) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = th.gap; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 6; row++) for (let k = -1; k < 6; k++) {
    const x = k * 48 + (row % 2) * 24 + 4, y = row * 43 + 4;
    g.fillStyle = th.stones[(row * 7 + k * 3 + 8) % th.stones.length];
    g.beginPath(); g.roundRect(x, y, 40, 35, 10); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.roundRect(x + 4, y + 3, 26, 9, 5); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function distToPath(x, z) {
  let best = 1e9;
  for (const p of W.samples) { const d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) best = d; }
  return Math.sqrt(best);
}
function freeSpot(x, z, r) {
  if (distToPath(x, z) < 1.0 + r) return false;
  for (const b of W.blockers) if (Math.hypot(b.x - x, b.z - z) < b.r + r) return false;
  return true;
}
// Thema-Deko
function tombstone(g, x, z) {
  const s = mesh(new RoundedBoxGeometry(0.55, 0.75, 0.16, 3, 0.12), M(0x9a98b0), x, 0.35, z, g);
  s.rotation.set(0, rand() - 0.5, (rand() - 0.5) * 0.25);
  mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), M(0x6a6880), 0, 0.12, 0.085, s);
  mesh(new THREE.BoxGeometry(0.05, 0.25, 0.02), M(0x6a6880), 0, 0.12, 0.085, s);
}
function deadTree(g, x, z) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = rand() * 6; g.add(t);
  mesh(new THREE.CylinderGeometry(0.1, 0.18, 1.6, 7), M(0x3a2c2a), 0, 0.8, 0, t);
  for (let i = 0; i < 4; i++) { const b = mesh(new THREE.CylinderGeometry(0.03, 0.07, 0.8, 5), M(0x3a2c2a), 0, 1.2 + i * 0.15, 0, t); b.rotation.set(0, i * 1.6, 0.8 + rand() * 0.4); b.position.x = Math.cos(i * 1.6) * 0.2; b.position.z = Math.sin(i * 1.6) * 0.2; }
}
function lantern(g, x, z) {
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.4, 8), M(0x2a2a33, { metalness: 0.6 }), x, 0.7, z, g);
  mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe08a }), x, 1.45, z, g);
}
function pine(g, x, z, s = 1) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s); g.add(t);
  mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8), M(0x6a4a2a), 0, 0.25, 0, t);
  for (let i = 0; i < 3; i++) {
    mesh(new THREE.ConeGeometry(0.75 - i * 0.18, 0.75, 10), M(0x2e6b46), 0, 0.7 + i * 0.45, 0, t);
    mesh(new THREE.ConeGeometry(0.5 - i * 0.12, 0.3, 10), M(0xf4f8ff), 0, 0.95 + i * 0.45, 0, t);
  }
}
function snowman(g, x, z) {
  const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = rand() * 6; g.add(s);
  mesh(new THREE.SphereGeometry(0.38, 16, 12), M(0xffffff), 0, 0.33, 0, s);
  mesh(new THREE.SphereGeometry(0.27, 16, 12), M(0xffffff), 0, 0.85, 0, s);
  mesh(new THREE.SphereGeometry(0.19, 16, 12), M(0xffffff), 0, 1.24, 0, s);
  const n = mesh(new THREE.ConeGeometry(0.04, 0.2, 8), M(0xff8c1a), 0, 1.24, 0.25, s); n.rotation.x = Math.PI / 2;
  for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.025, 6, 5), M(0x111111), sx * 0.07, 1.3, 0.17, s);
  mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 14), M(0x222233), 0, 1.47, 0, s);
  mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14), M(0x222233), 0, 1.37, 0, s);
  mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), M(0xe5383b), 0, 1.05, 0, s).rotation.x = Math.PI / 2;
}
function buildWorld(mapIdx) {
  if (W.scene) W.scene.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.keep) o.geometry.dispose(); });
  const map = MAPS[mapIdx];
  const th = THEMES[map.theme];
  W.theme = map.theme;
  setSeed(7000 + mapIdx * 131);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.sky);
  scene.fog = new THREE.Fog(th.sky, th.fog[0], th.fog[1]);
  scene.add(new THREE.HemisphereLight(...th.hemi));
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, near: 1, far: 60 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  W.sun = sun;
  const pts = mapPoints(map);
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  W.curve = curve;
  W.len = curve.getLength();
  W.samples = curve.getSpacedPoints(Math.round(W.len * 4));
  W.blockers = [];
  view.bounds = { ...map.bounds };
  const b = map.bounds;
  // Boden
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 80), new THREE.MeshStandardMaterial({ map: noiseTex(th.grass, [10, 12]), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  // Weg (Kopfsteinpflaster) als Band
  const N = Math.round(W.len * 6), Wd = 1.35;
  const pos = [], uv = [], idx = [];
  let dist = 0, prev = null;
  const stones = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    if (prev) dist += p.distanceTo(prev);
    prev = p.clone();
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, (s * Wd) / 2); pos.push(q.x, 0.015 + (i % 2) * 0.0005, q.z); uv.push(s < 0 ? 0 : 1, dist / Wd); }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (i % 4 === 0) for (const s of [-1, 1]) {
      const q = p.clone().addScaledVector(side, (s * (Wd + 0.14)) / 2);
      if (distToPath(q.x, q.z) > Wd / 2 - 0.02) stones.push(q);
    }
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  pg.setIndex(idx);
  pg.computeVertexNormals();
  const pathMesh = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: cobble(th), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -1 }));
  pathMesh.receiveShadow = true;
  scene.add(pathMesh);
  const stoneMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: th.edge, roughness: 0.9 }), stones.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  stones.forEach((p, i) => { e.set(rand() * 3, rand() * 3, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(p.x, 0.04, p.z), q, new THREE.Vector3(1, 0.55, 1)); stoneMesh.setMatrixAt(i, m4); });
  stoneMesh.receiveShadow = true;
  scene.add(stoneMesh);
  // Deko je Thema
  const deco = new THREE.Group();
  const tryPlace = (r, fn, inside = true, tries = 40) => {
    for (let k = 0; k < tries; k++) {
      const x = inside ? b.x0 + 0.6 + rand() * (b.x1 - b.x0 - 1.2) : b.x0 - 6 + rand() * (b.x1 - b.x0 + 12);
      const z = inside ? b.z0 + 0.6 + rand() * (b.z1 - b.z0 - 1.2) : b.z0 - 6 + rand() * (b.z1 - b.z0 + 12);
      if (!inside && x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5) continue;
      if (freeSpot(x, z, r)) { W.blockers.push({ x, z, r }); fn(x, z); return true; }
    }
    return false;
  };
  // dichter Wald / Hecke rund um die Karte (versteckt, wo die Zombies herkommen)
  const ring = map.theme === 'snow' ? (x, z) => pine(deco, x, z, 1 + rand() * 0.6) : map.theme === 'night' ? (x, z) => (rand() < 0.6 ? deadTree(deco, x, z) : tree(deco, x, z, 0.9 + rand() * 0.4, [0x234a3a, 0x2c5a46, 0x1d3f32])) : (x, z) => tree(deco, x, z, 0.9 + rand() * 0.5);
  for (let i = 0; i < 70; i++) tryPlace(0.9, ring, false, 12);
  if (map.pond) { pond(deco, map.pond.x, map.pond.z, map.pond.r); W.blockers.push({ x: map.pond.x, z: map.pond.z, r: map.pond.r + 0.3 }); }
  if (map.theme === 'day') {
    for (let i = 0; i < 4; i++) tryPlace(0.9, (x, z) => tree(deco, x, z, 0.75 + rand() * 0.3));
    for (let i = 0; i < 3; i++) tryPlace(0.9, (x, z) => flowerBed(deco, x, z, rand() * 3, [[0xff6b8b, 0xffd23f, 0xffffff], [0xb06bff, 0xff9f1c, 0xff6b8b]][i % 2]));
    for (let i = 0; i < 5; i++) tryPlace(0.35, (x, z) => gnome(deco, x, z, rand() * 6));
    for (let i = 0; i < 2; i++) tryPlace(0.8, (x, z) => bench(deco, x, z, rand() * 6));
    tryPlace(1.6, (x, z) => house(deco, x, z, false).rotation.set(0, rand() * 6, 0), false, 60);
  } else if (map.theme === 'night') {
    for (let i = 0; i < 16; i++) tryPlace(0.4, (x, z) => tombstone(deco, x, z));
    for (let i = 0; i < 4; i++) tryPlace(0.6, (x, z) => deadTree(deco, x, z));
    W.lights = [];
    for (let i = 0; i < 4; i++) tryPlace(0.3, (x, z) => { lantern(deco, x, z); const l = new THREE.PointLight(0xffc36a, 7, 6, 1.6); l.position.set(x, 1.45, z); scene.add(l); });
    tryPlace(1.6, (x, z) => house(deco, x, z, true).rotation.set(0, rand() * 6, 0), false, 60);
  } else {
    for (let i = 0; i < 6; i++) tryPlace(0.7, (x, z) => pine(deco, x, z, 0.8 + rand() * 0.4));
    for (let i = 0; i < 4; i++) tryPlace(0.45, (x, z) => snowman(deco, x, z));
    for (let i = 0; i < 3; i++) tryPlace(0.3, (x, z) => lantern(deco, x, z));
    tryPlace(1.6, (x, z) => house(deco, x, z, true).rotation.set(0, rand() * 6, 0), false, 60);
  }
  const baked = bake(deco);
  baked.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(baked);
  // Blumen + Grasbüschel (instanziert)
  const nF = 500;
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), nF);
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.22, 4), new THREE.MeshStandardMaterial({ color: th.tuft }), nF);
  let nf = 0, nt = 0;
  for (let i = 0; i < nF * 2; i++) {
    const x = b.x0 - 3 + rand() * (b.x1 - b.x0 + 6), z = b.z0 - 3 + rand() * (b.z1 - b.z0 + 6);
    if (distToPath(x, z) < 0.95) continue;
    if (i % 2 && nf < nF) { m4.makeTranslation(x, 0.1, z); fl.setMatrixAt(nf, m4); fl.setColorAt(nf, new THREE.Color(th.flowers[nf % th.flowers.length])); nf++; }
    else if (nt < nF) { m4.makeTranslation(x, 0.1, z); tuft.setMatrixAt(nt++, m4); }
  }
  fl.count = nf; tuft.count = nt;
  scene.add(fl, tuft);
  // Schneeflocken / Glühwürmchen
  W.snow = null; W.flies = null;
  if (map.theme !== 'day') {
    const n = map.theme === 'snow' ? 500 : 60;
    const g = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = b.x0 - 4 + rand() * (b.x1 - b.x0 + 8); arr[i * 3 + 1] = rand() * (map.theme === 'snow' ? 12 : 2.5) + 0.3; arr[i * 3 + 2] = b.z0 - 4 + rand() * (b.z1 - b.z0 + 8); }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts2 = new THREE.Points(g, new THREE.PointsMaterial({ color: map.theme === 'snow' ? 0xffffff : 0xd8ff7a, size: map.theme === 'snow' ? 0.12 : 0.14, transparent: true, opacity: 0.9, depthWrite: false }));
    scene.add(pts2);
    if (map.theme === 'snow') W.snow = pts2; else W.flies = pts2;
  }
  // Reichweiten-Anzeige
  W.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  W.rangeRing.rotation.x = -Math.PI / 2;
  W.rangeDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false }));
  W.rangeDisc.rotation.x = -Math.PI / 2;
  W.range = new THREE.Group();
  W.range.add(W.rangeRing, W.rangeDisc);
  W.range.visible = false;
  scene.add(W.range);
  W.scene = scene;
  // Kamera dort, wo der Weg ins Bild kommt
  const entry = W.samples.find((p) => p.x > b.x0 && p.x < b.x1 && p.z > b.z0 && p.z < b.z1) || W.samples[0];
  view.tx = entry.x;
  view.tz = entry.z + 3;
  view.userZoom = false;
  resize();
}

// ------------------------------------------------------------ Titelbild ---
const T = { scene: null, cam: null, zombies: [], cookies: [] };
function buildTitle() {
  setSeed(42);
  const scene = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#2b1a4f'); grd.addColorStop(0.45, '#7a4a8c'); grd.addColorStop(0.75, '#e48a7a'); grd.addColorStop(1, '#ffc58a');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const sky = new THREE.CanvasTexture(c); sky.colorSpace = THREE.SRGBColorSpace;
  scene.background = sky;
  scene.fog = new THREE.Fog(0x8a5a8a, 9, 30);
  scene.add(new THREE.HemisphereLight(0xffc8b0, 0x3a2a4a, 1.5));
  const key = new THREE.DirectionalLight(0xffd6a8, 2.4); key.position.set(-4, 6, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb08aff, 1.6); rim.position.set(3, 4, -6); scene.add(rim);
  // Mond mit Schein
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfff2d6, fog: false }));
  moon.position.set(2.5, 9.5, -22); scene.add(moon);
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gg = gc.getContext('2d');
  const rg = gg.createRadialGradient(64, 64, 10, 64, 64, 64); rg.addColorStop(0, 'rgba(255,240,210,0.8)'); rg.addColorStop(1, 'rgba(255,240,210,0)'); gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), fog: false, depthWrite: false, transparent: true }));
  glow.scale.setScalar(13); glow.position.copy(moon.position); scene.add(glow);
  // Boden, Haus, Zaun, Bäume
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ map: noiseTex(['#4c6a3c', '#567a44', '#3f5a32'], [12, 12]), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const deco = new THREE.Group();
  const h = house(deco, -4.2, -7, true); h.rotation.y = 0.5; h.scale.setScalar(1.6);
  for (const [x, z, s] of [[4.5, -9, 1.4], [6.5, -6, 1.1], [-7, -10, 1.5], [1.2, -13, 1.6], [-1, -16, 1.4]]) tree(deco, x, z, s, [0x2c4a3a, 0x355a44, 0x243f32]);
  fence(deco, -6, -3.4, 5, 0.1, 0x6a4a3a); fence(deco, 1.5, -4.2, 6, -0.12, 0x6a4a3a);
  for (let i = 0; i < 6; i++) tombstone(deco, 2 + rand() * 4, -8 - rand() * 4);
  const bd = bake(deco); scene.add(bd);
  // Oma vorne links, Zombies dahinter
  const oma = figure('oma', 'gerda'); oma.scale.setScalar(1.5); oma.position.set(-0.9, 0, 1.6); oma.rotation.y = 0.75; scene.add(oma);
  T.zombies = [['gustav', 1.3, -1.8, 1.1], ['boss', 2.8, -4.6, 1.8], ['jogger', -0.2, -3.8, 1.0], ['dieter', 3.6, -1.6, 1.1], ['gustav', 0.9, -6.5, 1.0]].map(([id, x, z, s]) => {
    const zz = figure('zombie', id); zz.scale.setScalar(s); zz.position.set(x, 0, z); zz.rotation.y = -0.35 + rand() * 0.3; scene.add(zz);
    return { obj: zz, x, z, ph: rand() * 6 };
  });
  // fliegende Kekse
  T.cookies = [];
  for (let i = 0; i < 4; i++) { const ck = new THREE.Group(); cookie(ck, 0, 0); const b = bake(ck); b.scale.setScalar(2.2); scene.add(b); T.cookies.push({ obj: b, off: i / 4 }); }
  const cam = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 100);
  T.scene = scene; T.cam = cam; T.oma = oma;
  resize();
}
function animateTitle(t) {
  const cam = T.cam;
  const portrait = cam.aspect < 0.8;
  cam.position.set(Math.sin(t * 0.2) * 0.25 + (portrait ? 0.5 : 0.6), portrait ? 2.0 : 1.5, portrait ? 7.4 : 5.6);
  cam.lookAt(portrait ? 0.8 : 1.4, portrait ? 0.55 : 1.5, -2);
  for (const z of T.zombies) { const w = Math.sin(t * 5 + z.ph); z.obj.position.set(z.x, Math.abs(w) * 0.06, z.z + Math.sin(t * 0.6 + z.ph) * 0.3); z.obj.rotation.z = w * 0.12; }
  T.oma.rotation.x = Math.max(0, Math.sin(t * 2.4)) * -0.12;
  for (const c of T.cookies) {
    const k = (t * 0.45 + c.off) % 1;
    c.obj.position.set(-0.6 + k * 3.6, 2.1 + Math.sin(k * Math.PI) * 1.6, 1.0 - k * 4.5);
    c.obj.rotation.set(t * 3 + c.off * 6, t * 2, 0.6);
  }
}

// ------------------------------------------------------------------- Ton ---
let ac = null;
function audio() {
  try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { ac = null; }
  return ac;
}
function tone(f0, f1, len, type = 'sine', vol = 0.08) {
  if (!settings.sfx) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + len + 0.02);
}
const lastSfx = {};
const sfx = (name, fn, gap = 0.05) => { const n = performance.now(); if (n - (lastSfx[name] || 0) < gap * 1000) return; lastSfx[name] = n; fn(); };
const SND = {
  throw: () => sfx('throw', () => tone(700, 300, 0.08, 'triangle', 0.04), 0.06),
  hit: () => sfx('hit', () => tone(260, 120, 0.08, 'square', 0.03), 0.05),
  coin: () => sfx('coin', () => tone(900, 1400, 0.09, 'sine', 0.05), 0.07),
  place: () => tone(200, 400, 0.15, 'triangle', 0.08),
  leak: () => tone(220, 90, 0.35, 'sawtooth', 0.07),
  wave: () => { tone(330, 660, 0.25, 'triangle', 0.07); setTimeout(() => tone(440, 880, 0.3, 'triangle', 0.07), 160); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.22, 'triangle', 0.08), i * 130)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, f * 0.98, 0.3, 'sawtooth', 0.06), i * 200)),
  boss: () => tone(90, 50, 0.9, 'sawtooth', 0.1),
  tick: () => tone(800, 800, 0.04, 'square', 0.03),
};

// -------------------------------------------------------------- Spielzustand ---
const G = {
  mode: 'title', // title | play | won | lost | paused
  map: 0,
  level: 1,
  cookies: 0,
  lives: LIVES,
  waves: [],
  wave: 0,
  spawnQ: [],
  spawnT: 0,
  waveActive: false,
  nextWaveT: null,
  zombies: [],
  omas: [],
  shots: [],
  fx: [],
  speed: 1,
  drag: null,
  selected: null,
  coffee: 0,
  coffeeCd: 0,
  t: 0,
};
const HPBAR_GEO = new THREE.PlaneGeometry(1, 1);
const HP_MATS = { bg: new THREE.MeshBasicMaterial({ color: 0x24192e, depthTest: false, transparent: true, opacity: 0.8 }), g: new THREE.MeshBasicMaterial({ color: 0x5ccf3a, depthTest: false, transparent: true }), y: new THREE.MeshBasicMaterial({ color: 0xffc23d, depthTest: false, transparent: true }), r: new THREE.MeshBasicMaterial({ color: 0xff4f4f, depthTest: false, transparent: true }) };
function hpBar(width) {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(HPBAR_GEO, HP_MATS.bg); bg.scale.set(width + 0.06, 0.13, 1); bg.renderOrder = 10;
  const fill = new THREE.Mesh(HPBAR_GEO, HP_MATS.g); fill.scale.set(width, 0.08, 1); fill.position.z = 0.001; fill.renderOrder = 11;
  g.add(bg, fill);
  g.userData = { fill, width };
  return g;
}

function startLevel(mapIdx, n) {
  audio();
  G.map = mapIdx;
  G.level = n;
  buildWorld(mapIdx);
  G.waves = genWaves(mapIdx, n);
  G.wave = 0;
  G.cookies = startCookies(mapIdx, n);
  G.lives = LIVES;
  G.zombies = []; G.omas = []; G.shots = []; G.fx = [];
  G.spawnQ = []; G.waveActive = false; G.drag = null; G.selected = null;
  G.coffee = 0; G.coffeeCd = 0; G.speed = 1;
  G.nextWaveT = settings.auto ? 15 : null;
  G.mode = 'play';
  showScreen('hud');
  renderSidebar();
  closeInfo();
  $('speed').classList.toggle('on', false);
  updateAuto();
  updateHud();
  banner(`LEVEL ${mapIdx + 1}-${n}`, n % 10 === 0 && n >= 20 ? 'Achtung: Am Ende kommt ein BOSS!' : 'Zieh deine Omas aus der Leiste aufs Feld!');
}
function startWave() {
  if (G.waveActive || G.wave >= G.waves.length || G.mode !== 'play') return;
  G.spawnQ = G.waves[G.wave].map((s) => ({ ...s }));
  G.spawnT = 0.3;
  G.wave++;
  G.waveActive = true;
  G.nextWaveT = null;
  SND.wave();
  if (G.spawnQ.some((s) => s.type === 'boss')) setTimeout(() => { if (G.mode === 'play') { banner('BOSS!', 'Zombie-Boss Bruno kommt!'); SND.boss(); } }, 2500);
  updateHud();
}
function spawnZombie(s) {
  const def = ZOMBIE_DEF[s.type];
  const obj = figure('zombie', def.model);
  obj.scale.setScalar(def.size);
  const bar = hpBar(def.boss ? 1.6 : def.fat ? 0.95 : 0.7);
  bar.position.y = def.hpY;
  bar.scale.setScalar(1 / def.size);
  obj.add(bar);
  W.scene.add(obj);
  const z = { type: s.type, def, obj, bar, hpMax: def.hp * s.hp, hp: def.hp * s.hp, dist: 0, speed: def.speed * s.speed, slowT: 0, slowF: 1, dead: false, deadT: 0, ph: Math.random() * 6, side: (Math.random() - 0.5) * 0.35 };
  G.zombies.push(z);
  placeZombie(z);
}
const _side = new THREE.Vector3();
function placeZombie(z) {
  const u = Math.max(0, Math.min(1, z.dist / W.len));
  const p = W.curve.getPointAt(u), tg = W.curve.getTangentAt(u);
  _side.set(-tg.z, 0, tg.x);
  z.obj.position.set(p.x + _side.x * z.side, 0, p.z + _side.z * z.side);
  z.obj.rotation.y = Math.atan2(tg.x, tg.z);
}
function onMap(x, z, m = 0) { const b = view.bounds; return x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m; }
function damage(z, amount, kind) {
  if (z.dead) return;
  let d = amount;
  if (z.def.armor && !['splash', 'pierce', 'aoe'].includes(kind)) d *= 1 - z.def.armor;
  z.hp -= d;
  if (z.hp <= 0) kill(z);
}
function kill(z) {
  z.dead = true;
  z.deadT = 0;
  z.bar.visible = false;
  const rew = Math.round(z.def.reward * (1 + (G.map * 20 + G.level - 1) * 0.03));
  G.cookies += rew;
  SND.coin();
  floatText(z.obj.position, `+${rew}`);
  updateHud();
}
// ------------------------------------------------------------------- Omas ---
function omaUnlocked(id) {
  const def = OMA_DEF[id];
  if (!def) return false;
  if (G.map > 0) return true;
  return def.unlock <= Math.max(G.level, progress.maps[MAPS[0].id].unlocked);
}
function canPlace(x, z) {
  if (!onMap(x, z, -0.3)) return false;
  if (distToPath(x, z) < 1.05) return false;
  for (const bl of W.blockers) if (Math.hypot(bl.x - x, bl.z - z) < bl.r + 0.35) return false;
  for (const o of G.omas) if (Math.hypot(o.x - x, o.z - z) < 0.95) return false;
  return true;
}
function stats(o) {
  const def = OMA_DEF[o.id];
  const s = { ...def.base };
  for (let i = 0; i < o.lvl - 1; i++) Object.assign(s, def.ups[i].set);
  return s;
}
function placeOma(id, x, z) {
  const def = OMA_DEF[id];
  if (G.cookies < def.cost || !canPlace(x, z)) return false;
  G.cookies -= def.cost;
  const obj = figure('oma', id);
  obj.scale.setScalar(0.92);
  obj.position.set(x, 0, z);
  obj.rotation.y = Math.PI;
  W.scene.add(obj);
  const o = { id, obj, x, z, lvl: 1, cd: 0.2, spent: def.cost, anim: 0 };
  G.omas.push(o);
  SND.place();
  sparkleAt(new THREE.Vector3(x, 0.5, z), 0xffffff);
  updateHud();
  return o;
}
function targetFor(o, s) {
  let best = null;
  for (const z of G.zombies) {
    if (z.dead || !onMap(z.obj.position.x, z.obj.position.z, 0.5)) continue;
    const d = Math.hypot(z.obj.position.x - o.x, z.obj.position.z - o.z);
    if (d > s.range) continue;
    if (!best || (s.prefer === 'strong' ? z.hp > best.hp : z.dist > best.dist)) best = z;
  }
  return best;
}
const PROJ = {};
function projMesh(kind) {
  if (!PROJ[kind]) {
    const g = new THREE.Group();
    if (kind === 'needle') { const n = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), M(0xd0d8e2, { metalness: 0.8, roughness: 0.2 }), 0, 0, 0, g); n.rotation.x = Math.PI / 2; mesh(new THREE.SphereGeometry(0.04, 8, 6), M(0xe5383b), 0, 0, -0.25, g); }
    if (kind === 'slipper') { mesh(new RoundedBoxGeometry(0.2, 0.09, 0.38, 3, 0.04), M(0xff8fc7, { roughness: 1 }), 0, 0, 0, g); mesh(new THREE.SphereGeometry(0.07, 10, 8), M(0xffffff), 0, 0.06, -0.12, g); }
    if (kind === 'cookie') { cookie(g, 0, 0); g.children[0].position.y = 0; g.scale.setScalar(1.4); }
    if (kind === 'drop') mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0x8fd3ff, { roughness: 0.1 }), 0, 0, 0, g);
    PROJ[kind] = bake(g);
  }
  return PROJ[kind].clone();
}
function fire(o, s, tgt) {
  o.anim = 1;
  const from = new THREE.Vector3(o.x, 1.15, o.z);
  if (s.aoe) {
    for (const z of G.zombies) {
      if (z.dead || !onMap(z.obj.position.x, z.obj.position.z, 0.5)) continue;
      if (Math.hypot(z.obj.position.x - o.x, z.obj.position.z - o.z) > s.range) continue;
      if (s.slow) { z.slowT = s.slowDur; z.slowF = Math.min(z.slowF, 1 - s.slow); }
      if (s.push) { z.dist = Math.max(0, z.dist - s.push * (z.def.boss ? 0.25 : 1)); sparkleAt(z.obj.position.clone().setY(0.6), 0xffd23f); }
      damage(z, s.dmg, 'aoe');
      if (s.slow && Math.random() < 0.5) {
        const m = projMesh('drop'); m.position.copy(from); W.scene.add(m);
        G.shots.push({ m, from: from.clone(), to: z.obj.position.clone().setY(0.6), t: 0, dur: 0.35, kind: 'fx' });
      }
    }
    if (s.push) { SND.hit(); G.fx.push({ ring: true, x: o.x, z: o.z, r: s.range, t: 0 }); }
    return;
  }
  const m = projMesh(s.proj);
  m.position.copy(from);
  W.scene.add(m);
  const to = tgt.obj.position.clone().setY(0.7 * tgt.def.size);
  const dur = s.arc ? 0.65 : from.distanceTo(to) / s.projSpeed;
  G.shots.push({ m, from, to, t: 0, dur, tgt, s, arc: s.arc, kind: s.splash ? 'splash' : s.pierce ? 'pierce' : 'single' });
  SND.throw();
}
// ------------------------------------------------------------- Effekte ---
const SPK = { geo: new THREE.OctahedronGeometry(0.06, 0) };
function sparkleAt(pos, color = 0xfff2a0) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(SPK.geo, mat); m.userData.v = new THREE.Vector3().randomDirection().multiplyScalar(1.6 + Math.random()); g.add(m); }
  W.scene.add(g);
  G.fx.push({ g, mat, t: 0 });
}
const floats = [];
function floatText(pos, text) {
  if (floats.length > 12) return;
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = text;
  $('floats').appendChild(el);
  floats.push({ el, pos: pos.clone().setY(1.6), t: 0 });
}
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    f.t += dt;
    if (f.ring) {
      if (!f.m) { f.m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, depthWrite: false })); f.m.rotation.x = -Math.PI / 2; f.m.position.set(f.x, 0.06, f.z); W.scene.add(f.m); }
      f.m.scale.setScalar(f.r * (0.3 + f.t * 2.5)); f.m.material.opacity = Math.max(0, 1 - f.t * 2.5);
      if (f.t > 0.4) { W.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); G.fx.splice(i, 1); }
      continue;
    }
    for (const m of f.g.children) m.position.copy(m.userData.v).multiplyScalar(f.t * 0.6);
    f.mat.opacity = Math.max(0, 1 - f.t * 2.4);
    if (f.t > 0.42) { W.scene.remove(f.g); f.mat.dispose(); G.fx.splice(i, 1); }
  }
  const v = new THREE.Vector3();
  for (let i = floats.length - 1; i >= 0; i--) {
    const f = floats[i];
    f.t += dt;
    v.copy(f.pos).setY(f.pos.y + f.t * 1.2).project(camera);
    f.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px) translate(-50%, -50%)`;
    f.el.style.opacity = String(Math.max(0, 1 - f.t * 1.3));
    if (f.t > 0.8) { f.el.remove(); floats.splice(i, 1); }
  }
}
function ambient(t, dt) {
  if (W.snow) {
    const a = W.snow.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) { a[i + 1] -= dt * 1.2; a[i] += Math.sin(t + i) * dt * 0.2; if (a[i + 1] < 0) a[i + 1] = 12; }
    W.snow.geometry.attributes.position.needsUpdate = true;
  }
  if (W.flies) { W.flies.material.opacity = 0.6 + 0.4 * Math.sin(t * 3); W.flies.position.y = Math.sin(t * 0.7) * 0.2; }
}

// ------------------------------------------------------------------ Update ---
function update(dt) {
  G.t += dt;
  if (G.mode !== 'play') return;
  const t = G.t;
  G.coffee = Math.max(0, G.coffee - dt);
  G.coffeeCd = Math.max(0, G.coffeeCd - dt);
  // Automatik: nächste Welle startet von selbst
  if (!G.waveActive && G.nextWaveT !== null && G.wave < G.waves.length) {
    const before = Math.ceil(G.nextWaveT);
    G.nextWaveT -= dt;
    if (Math.ceil(G.nextWaveT) !== before && G.nextWaveT <= 3 && G.nextWaveT > 0) SND.tick();
    if (G.nextWaveT <= 0) startWave();
  }
  if (G.spawnQ.length) {
    G.spawnT -= dt;
    while (G.spawnQ.length && G.spawnT <= 0) { const s = G.spawnQ.shift(); spawnZombie(s); G.spawnT += s.gap; }
  }
  const camQ = camera.quaternion;
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    if (z.dead) {
      z.deadT += dt;
      z.obj.rotation.x = -Math.min(1.4, z.deadT * 5);
      z.obj.position.y = -Math.max(0, z.deadT - 0.35) * 1.5;
      if (z.deadT > 0.9) { W.scene.remove(z.obj); G.zombies.splice(i, 1); }
      continue;
    }
    if (z.slowT > 0) { z.slowT -= dt; if (z.slowT <= 0) z.slowF = 1; }
    z.dist += z.speed * z.slowF * dt;
    if (z.dist >= W.len) {
      G.lives = Math.max(0, G.lives - z.def.lives);
      SND.leak();
      if (navigator.vibrate) navigator.vibrate(60);
      W.scene.remove(z.obj);
      G.zombies.splice(i, 1);
      updateHud();
      if (G.lives <= 0) { lose(); return; }
      continue;
    }
    placeZombie(z);
    const w = Math.sin(t * (z.def.fast ? 12 : 6) + z.ph);
    z.obj.position.y = Math.abs(w) * 0.06;
    z.obj.rotation.z = w * 0.12;
    z.bar.quaternion.copy(z.obj.quaternion).invert().multiply(camQ);
    const r = Math.max(0, z.hp / z.hpMax);
    const f = z.bar.userData.fill;
    f.scale.x = z.bar.userData.width * r;
    f.position.x = -(z.bar.userData.width * (1 - r)) / 2;
    f.material = r > 0.6 ? HP_MATS.g : r > 0.3 ? HP_MATS.y : HP_MATS.r;
    z.bar.visible = r < 1 || z.def.boss;
  }
  for (const o of G.omas) {
    const s = stats(o);
    o.cd -= dt * (G.coffee > 0 ? 2 : 1);
    const tgt = targetFor(o, s);
    if (tgt) {
      const want = Math.atan2(tgt.obj.position.x - o.x, tgt.obj.position.z - o.z);
      let d = want - o.obj.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      o.obj.rotation.y += d * Math.min(1, dt * 10);
      if (o.cd <= 0) { fire(o, s, tgt); o.cd = 1 / s.rate; }
    }
    o.anim = Math.max(0, o.anim - dt * 4);
    o.obj.rotation.x = -o.anim * 0.25;
    o.obj.position.y = Math.sin(t * 2 + o.x) * 0.02;
  }
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const sh = G.shots[i];
    sh.t += dt;
    if (sh.tgt && !sh.tgt.dead && !sh.arc) sh.to.copy(sh.tgt.obj.position).setY(0.7 * sh.tgt.def.size);
    const k = Math.min(1, sh.t / sh.dur);
    sh.m.position.lerpVectors(sh.from, sh.to, k);
    if (sh.arc) sh.m.position.y += Math.sin(k * Math.PI) * 2.2;
    sh.m.lookAt(sh.to);
    if (sh.kind === 'splash' || sh.kind === 'fx') sh.m.rotation.x += dt * 10;
    if (k >= 1) {
      W.scene.remove(sh.m);
      G.shots.splice(i, 1);
      if (sh.kind === 'fx') continue;
      if (sh.kind === 'splash') {
        const c = sh.to.clone().setY(0);
        for (const z of G.zombies) if (!z.dead && z.obj.position.distanceTo(c) < sh.s.splash) damage(z, sh.s.dmg, 'splash');
        sparkleAt(sh.to.clone().setY(0.3), 0xffc66a);
        G.fx.push({ ring: true, x: sh.to.x, z: sh.to.z, r: sh.s.splash, t: 0 });
      } else if (sh.tgt && !sh.tgt.dead) {
        damage(sh.tgt, sh.s.dmg, sh.kind);
        sparkleAt(sh.to);
      }
      SND.hit();
    }
  }
  updateFx(dt);
  // Welle vorbei?
  if (G.waveActive && !G.spawnQ.length && !G.zombies.some((z) => !z.dead)) {
    G.waveActive = false;
    const bonus = 25 + G.wave * 5;
    G.cookies += bonus;
    if (G.wave >= G.waves.length) { win(); return; }
    banner(`WELLE ${G.wave} GESCHAFFT!`, `+${bonus} Kekse Bonus`);
    G.nextWaveT = settings.auto ? 4 : null;
    updateHud();
  }
  updateHud(true);
  if (G.selected) positionInfo();
}
function win() {
  G.mode = 'won';
  const stars = starsFor(G.lives);
  const p = progress.maps[MAPS[G.map].id];
  p.stars[G.level] = Math.max(p.stars[G.level] || 0, stars);
  p.unlocked = Math.max(p.unlocked, Math.min(LEVELS_PER_MAP + 1, G.level + 1));
  saveProgress();
  SND.win();
  $('wonStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('wonText').textContent = `Level ${G.map + 1}-${G.level} geschafft! ${G.lives} von ${LIVES} Leben übrig.`;
  const newMap = G.level === UNLOCK_NEXT_MAP && MAPS[G.map + 1] ? `Neue Karte freigeschaltet: ${MAPS[G.map + 1].name}!` : '';
  $('wonExtra').textContent = newMap;
  showScreen('won');
}
function lose() {
  G.mode = 'lost';
  SND.lose();
  $('lostText').textContent = `Welle ${G.wave} von ${G.waves.length} – die Zombies haben die Kekse geklaut!`;
  showScreen('lost');
}

// ------------------------------------------------------------------- UI ---
let hudCache = '';
function updateHud(light = false) {
  const s = `${Math.floor(G.cookies)}|${G.lives}|${G.wave}|${G.waves.length}|${Math.ceil(G.coffeeCd)}|${G.coffee > 0}|${G.waveActive}|${G.nextWaveT === null ? 'x' : Math.ceil(G.nextWaveT)}`;
  if (light && s === hudCache) return;
  hudCache = s;
  $('hCookies').textContent = fmt(G.cookies);
  $('hLives').textContent = G.lives;
  $('hWave').textContent = `WELLE ${Math.max(1, G.wave)} / ${G.waves.length}`;
  $('hWaveBar').style.width = `${(G.wave / G.waves.length) * 100}%`;
  const c = $('coffee');
  c.classList.toggle('active', G.coffee > 0);
  c.classList.toggle('cool', G.coffee <= 0 && G.coffeeCd > 0);
  $('coffeeCd').textContent = G.coffee > 0 ? `${Math.ceil(G.coffee)}s` : G.coffeeCd > 0 ? `${Math.ceil(G.coffeeCd)}s` : '';
  // Start-Knopf: nur zwischen den Wellen
  const sw = $('startWave');
  const idle = !G.waveActive && G.wave < G.waves.length;
  sw.classList.toggle('hidden', !idle);
  if (idle) sw.innerHTML = G.nextWaveT !== null ? `WELLE ${G.wave + 1} IN ${Math.max(1, Math.ceil(G.nextWaveT))}<small>JETZT STARTEN</small>` : `WELLE ${G.wave + 1}<small>STARTEN</small>`;
  document.querySelectorAll('.ocard[data-id]').forEach((el) => el.classList.toggle('poor', G.cookies < OMA_DEF[el.dataset.id].cost));
  if (G.selected) renderInfo();
}
function updateAuto() {
  $('auto').classList.toggle('on', settings.auto);
  $('auto').innerHTML = `AUTO<small>${settings.auto ? 'AN' : 'AUS'}</small>`;
}
$('auto').addEventListener('click', (e) => {
  e.stopPropagation();
  settings.auto = !settings.auto;
  saveSettings();
  // laufende Welle läuft weiter – ab der nächsten zählt die neue Einstellung
  if (!G.waveActive) G.nextWaveT = settings.auto ? 4 : null;
  updateAuto();
  updateHud();
});
const portraits = {};
function renderPortraits() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  r.setSize(160, 160); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.85;
  for (const id of Object.keys(OMAS)) {
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0xffd9a0);
    sc.add(new THREE.HemisphereLight(0xffffff, 0xd8c8a8, 1.6)); const l = new THREE.DirectionalLight(0xffffff, 2.2); l.position.set(2, 3, 4); sc.add(l);
    sc.add(figure('oma', id));
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0.3, 1.25, 2.3); cam.lookAt(0, 1.05, 0);
    r.render(sc, cam);
    portraits[id] = r.domElement.toDataURL('image/jpeg', 0.85);
  }
  r.dispose();
  r.forceContextLoss?.();
}
function renderSidebar() {
  $('cards').innerHTML = Object.keys(OMAS)
    .map((id) => {
      const def = OMA_DEF[id];
      const name = OMAS[id].name.replace('Oma ', '').replace('Bingo-', '').toUpperCase();
      if (!def) return `<div class="ocard soon"><img src="${portraits[id]}" alt=""><b>${name}</b><small>BALD</small></div>`;
      if (!omaUnlocked(id)) return `<div class="ocard locked"><img src="${portraits[id]}" alt=""><i class="lock"></i><b>${name}</b><small>LEVEL ${def.unlock}</small></div>`;
      return `<div class="ocard" data-id="${id}" style="--c:${OMAS[id].card}"><img src="${portraits[id]}" alt="" draggable="false"><b>${name}</b><small><span class="ck"></span>${def.cost}</small></div>`;
    })
    .join('');
  document.querySelectorAll('.ocard[data-id]').forEach((card) => {
    card.addEventListener('pointerdown', (e) => startDrag(card, e));
    card.addEventListener('pointermove', (e) => moveDrag(e));
    card.addEventListener('pointerup', (e) => endDrag(e));
    card.addEventListener('pointercancel', () => cancelDrag());
  });
}
// --- Omas aus der Leiste aufs Feld ziehen ---
function ghostOf(id) {
  const g = figure('oma', id);
  g.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.6; o.castShadow = false; } });
  g.scale.setScalar(0.92);
  return g;
}
function startDrag(card, e) {
  e.preventDefault();
  e.stopPropagation();
  audio();
  const id = card.dataset.id;
  if (G.mode !== 'play') return;
  if (G.cookies < OMA_DEF[id].cost) { card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 400); hint('Nicht genug Kekse!'); return; }
  card.setPointerCapture(e.pointerId);
  closeInfo();
  G.drag = { id, card, ghost: null, ok: false, x: 0, z: 0, sx: e.clientX, sy: e.clientY, moved: false };
  card.classList.add('sel');
  W.range.scale.setScalar(OMA_DEF[id].base.range);
  hint('Zieh die Oma neben den Weg und lass los');
}
function moveDrag(e) {
  const d = G.drag;
  if (!d) return;
  if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 12) {
    d.moved = true;
    d.ghost = ghostOf(d.id);
    W.scene.add(d.ghost);
    W.range.visible = true;
  }
  if (!d.moved) return;
  if ($('sidebar').classList.contains('open')) setSidebar(false); // Leiste weg, damit man die Karte sieht
  // Figur etwas über dem Finger, damit man sie sieht
  const p = groundAt(e.clientX, e.clientY - 70);
  if (!p) return;
  d.x = p.x; d.z = p.z;
  d.ok = canPlace(p.x, p.z) && G.cookies >= OMA_DEF[d.id].cost;
  d.ghost.position.set(p.x, 0.15, p.z);
  W.range.position.set(p.x, 0.04, p.z);
  W.rangeRing.material.color.set(d.ok ? 0xffffff : 0xff4f4f);
  W.rangeDisc.material.color.set(d.ok ? 0x7ddc4a : 0xff4f4f);
  // am Rand mitscrollen
  const edge = 50, k = 0.08;
  if (e.clientY < edge + 120) { view.tz -= k * 3; placeCamera(); }
  if (e.clientY > window.innerHeight - edge - 90) { view.tz += k * 3; placeCamera(); }
}
function endDrag(e) {
  const d = G.drag;
  if (!d) return;
  if (!d.moved) { hint('Halte die Oma gedrückt und zieh sie aufs Feld'); cancelDrag(); return; }
  if (d.ok) { placeOma(d.id, d.x, d.z); hint(''); }
  else hint(G.cookies < OMA_DEF[d.id].cost ? 'Nicht genug Kekse!' : 'Da geht das nicht – neben dem Weg ist Platz');
  cancelDrag();
}
function cancelDrag() {
  const d = G.drag;
  if (!d) return;
  if (d.ghost) { W.scene.remove(d.ghost); d.ghost.traverse((o) => o.isMesh && o.material.dispose()); }
  d.card.classList.remove('sel');
  G.drag = null;
  if (!G.selected) W.range.visible = false;
  W.rangeRing.material.color.set(0xffffff);
  W.rangeDisc.material.color.set(0xffffff);
}
let hintT = 0;
function hint(text) {
  const h = $('hint');
  h.textContent = text;
  h.classList.toggle('hidden', !text);
  clearTimeout(hintT);
  if (text) hintT = setTimeout(() => h.classList.add('hidden'), 2600);
}
function setSidebar(open) { $('sidebar').classList.toggle('open', open); }
$('tab').addEventListener('click', (e) => { e.stopPropagation(); setSidebar(!$('sidebar').classList.contains('open')); });
function selectOma(o) {
  G.selected = o;
  W.range.visible = true;
  W.range.position.set(o.x, 0.04, o.z);
  W.range.scale.setScalar(stats(o).range);
  renderInfo();
  $('info').classList.remove('hidden');
  positionInfo();
}
function closeInfo() {
  G.selected = null;
  $('info').classList.add('hidden');
  if (!G.drag && W.range) W.range.visible = false;
}
function renderInfo() {
  const o = G.selected;
  const def = OMA_DEF[o.id];
  const up = def.ups[o.lvl - 1];
  $('iName').textContent = OMAS[o.id].name;
  $('iLvl').textContent = `Stufe ${o.lvl}${up ? '' : ' (max)'} · ${def.desc}`;
  const ub = $('iUp');
  if (up) { ub.innerHTML = `${up.label}<br><span class="ck"></span>${up.cost}`; ub.disabled = G.cookies < up.cost; ub.classList.remove('hidden'); }
  else ub.classList.add('hidden');
  $('iSell').innerHTML = `VERKAUFEN<br><span class="ck"></span>${Math.floor(o.spent * 0.6)}`;
}
function positionInfo() {
  const o = G.selected;
  if (!o) return;
  const v = new THREE.Vector3(o.x, 1.9, o.z).project(camera);
  const x = (v.x * 0.5 + 0.5) * window.innerWidth, y = (-v.y * 0.5 + 0.5) * window.innerHeight;
  const el = $('info');
  el.style.left = `${Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, x - el.offsetWidth / 2))}px`;
  el.style.top = `${Math.max(150, y - el.offsetHeight - 10)}px`;
}
$('iUp').addEventListener('click', (e) => {
  e.stopPropagation();
  const o = G.selected; if (!o) return;
  const up = OMA_DEF[o.id].ups[o.lvl - 1];
  if (!up || G.cookies < up.cost) return;
  G.cookies -= up.cost; o.spent += up.cost; o.lvl++;
  o.obj.scale.setScalar(0.92 + (o.lvl - 1) * 0.06);
  sparkleAt(new THREE.Vector3(o.x, 1.2, o.z), 0x7ddc4a);
  SND.place();
  W.range.scale.setScalar(stats(o).range);
  updateHud();
});
$('iSell').addEventListener('click', (e) => {
  e.stopPropagation();
  const o = G.selected; if (!o) return;
  G.cookies += Math.floor(o.spent * 0.6);
  W.scene.remove(o.obj);
  G.omas.splice(G.omas.indexOf(o), 1);
  SND.coin();
  closeInfo();
  updateHud();
});
let bannerT = 0;
function banner(title, sub = '') {
  $('bTitle').textContent = title;
  $('bSub').textContent = sub;
  const b = $('banner');
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bannerT);
  bannerT = setTimeout(() => b.classList.add('hidden'), 2400);
}
function showScreen(id) {
  for (const s of ['title', 'hud', 'won', 'lost', 'paused']) $(s).classList.toggle('hidden', !(s === id || (s === 'hud' && ['won', 'lost', 'paused'].includes(id))));
}
// ------------------------------------------------------------ Titel-Menü ---
const sel = { map: 0, level: 1 };
function bestMap() { let m = 0; MAPS.forEach((_, i) => { if (mapUnlocked(i)) m = i; }); return m; }
function clampSel() {
  const p = progress.maps[MAPS[sel.map].id];
  sel.level = Math.max(1, Math.min(Math.min(p.unlocked, LEVELS_PER_MAP), sel.level));
}
function renderTitle() {
  clampSel();
  const m = MAPS[sel.map];
  const p = progress.maps[m.id];
  $('tMap').textContent = m.name;
  $('tMapNo').textContent = `KARTE ${sel.map + 1} / ${MAPS.length}`;
  $('tLevel').textContent = `${sel.map + 1} - ${sel.level}`;
  const st = p.stars[sel.level] || 0;
  $('tStars').textContent = '★'.repeat(st) + '☆'.repeat(3 - st);
  $('mapPrev').disabled = sel.map === 0;
  const nextOk = sel.map < MAPS.length - 1 && mapUnlocked(sel.map + 1);
  $('mapNext').disabled = !nextOk;
  $('mapLock').textContent = sel.map < MAPS.length - 1 && !mapUnlocked(sel.map + 1) ? `Karte ${sel.map + 2} ab Level ${sel.map + 1}-${UNLOCK_NEXT_MAP}` : '';
  $('lvPrev').disabled = sel.level <= 1;
  $('lvNext').disabled = sel.level >= Math.min(p.unlocked, LEVELS_PER_MAP);
}
$('mapPrev').addEventListener('click', () => { if (sel.map > 0) { sel.map--; sel.level = progress.maps[MAPS[sel.map].id].unlocked; renderTitle(); tone(500, 600, 0.06, 'triangle', 0.05); } });
$('mapNext').addEventListener('click', () => { if (sel.map < MAPS.length - 1 && mapUnlocked(sel.map + 1)) { sel.map++; sel.level = progress.maps[MAPS[sel.map].id].unlocked; renderTitle(); tone(500, 600, 0.06, 'triangle', 0.05); } });
$('lvPrev').addEventListener('click', () => { sel.level--; renderTitle(); tone(450, 500, 0.05, 'triangle', 0.04); });
$('lvNext').addEventListener('click', () => { sel.level++; renderTitle(); tone(500, 550, 0.05, 'triangle', 0.04); });
$('tStart').addEventListener('click', () => startLevel(sel.map, sel.level));
$('tLevelBox').addEventListener('click', () => openGrid());
function openGrid() {
  const p = progress.maps[MAPS[sel.map].id];
  let html = '';
  for (let n = 1; n <= LEVELS_PER_MAP; n++) {
    const st = p.stars[n] || 0;
    const open = n <= p.unlocked;
    html += `<button class="lvl${open ? '' : ' locked'}${n >= 20 && n % 10 === 0 ? ' boss' : ''}" data-n="${n}" ${open ? '' : 'disabled'}><b>${n}</b><small>${open ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</small></button>`;
  }
  $('gridTitle').textContent = MAPS[sel.map].name;
  $('lvlGrid').innerHTML = html;
  document.querySelectorAll('#lvlGrid .lvl[data-n]').forEach((b) => b.addEventListener('click', () => { sel.level = Number(b.dataset.n); $('grid').classList.add('hidden'); renderTitle(); }));
  $('grid').classList.remove('hidden');
}
$('gridClose').addEventListener('click', () => $('grid').classList.add('hidden'));
$('tGear').addEventListener('click', () => { $('setSfx').textContent = settings.sfx ? 'AN' : 'AUS'; $('setAuto').textContent = settings.auto ? 'AN' : 'AUS'; $('settings').classList.remove('hidden'); });
$('setSfx').addEventListener('click', () => { settings.sfx = !settings.sfx; saveSettings(); $('setSfx').textContent = settings.sfx ? 'AN' : 'AUS'; });
$('setAuto').addEventListener('click', () => { settings.auto = !settings.auto; saveSettings(); $('setAuto').textContent = settings.auto ? 'AN' : 'AUS'; });
$('setClose').addEventListener('click', () => $('settings').classList.add('hidden'));
$('tInfo').addEventListener('click', () => $('help').classList.remove('hidden'));
$('helpClose').addEventListener('click', () => $('help').classList.add('hidden'));
function toTitle() {
  G.mode = 'title';
  cancelDrag();
  sel.map = G.map;
  sel.level = Math.min(LEVELS_PER_MAP, progress.maps[MAPS[G.map].id].unlocked);
  renderTitle();
  showScreen('title');
}
$('startWave').addEventListener('click', (e) => { e.stopPropagation(); startWave(); });
$('speed').addEventListener('click', (e) => { e.stopPropagation(); G.speed = G.speed === 1 ? 2 : 1; $('speed').classList.toggle('on', G.speed === 2); });
$('coffee').addEventListener('click', (e) => {
  e.stopPropagation();
  if (G.coffee > 0 || G.coffeeCd > 0 || G.mode !== 'play') return;
  G.coffee = 10; G.coffeeCd = 45;
  banner('KAFFEEKRÄNZCHEN!', 'Alle Omas werfen doppelt so schnell');
  for (const o of G.omas) sparkleAt(new THREE.Vector3(o.x, 1.4, o.z), 0xc08040);
  tone(500, 900, 0.3, 'triangle', 0.08);
  updateHud();
});
$('pause').addEventListener('click', (e) => { e.stopPropagation(); if (G.mode === 'play') { G.mode = 'paused'; showScreen('paused'); } });
$('resume').addEventListener('click', () => { G.mode = 'play'; showScreen('hud'); });
$('quit').addEventListener('click', toTitle);
$('next').addEventListener('click', () => {
  if (G.level < LEVELS_PER_MAP) startLevel(G.map, G.level + 1);
  else if (MAPS[G.map + 1]) startLevel(G.map + 1, 1);
  else toTitle();
});
$('wonMenu').addEventListener('click', toTitle);
$('retry').addEventListener('click', () => startLevel(G.map, G.level));
$('lostMenu').addEventListener('click', toTitle);

// -------------------------------------------------------------- Steuerung ---
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function groundAt(cx, cy) {
  ndc.set((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  return ray.ray.intersectPlane(plane, p) ? p : null;
}
const pointers = new Map();
let drag = null;
let pinch = null;
canvas.addEventListener('pointerdown', (e) => {
  audio();
  if (G.mode !== 'play' && G.mode !== 'paused') return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx: view.tx, tz: view.tz, moved: false };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: view.dist }; drag = null; }
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    view.dist = pinch.dist * (pinch.d / d);
    view.userZoom = true;
    placeCamera();
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 10) drag.moved = true;
    if (drag.moved) {
      const k = (view.dist / window.innerHeight) * 1.15;
      view.tx = drag.tx - dx * k;
      view.tz = drag.tz - dy * k * 1.3;
      placeCamera();
    }
  }
});
const endPointer = (e) => {
  const wasDrag = drag && drag.moved;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0 && drag && !wasDrag && G.mode === 'play') tap(e.clientX, e.clientY);
  if (pointers.size === 0) drag = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; });
canvas.addEventListener('wheel', (e) => { if (G.mode !== 'play') return; view.dist *= e.deltaY > 0 ? 1.1 : 0.9; view.userZoom = true; placeCamera(); }, { passive: true });
function tap(cx, cy) {
  const p = groundAt(cx, cy);
  if (!p) return;
  let hit = null;
  for (const o of G.omas) if (Math.hypot(o.x - p.x, o.z - p.z) < 0.7) hit = o;
  if (hit) selectOma(hit);
  else { closeInfo(); setSidebar(false); }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play') { G.mode = 'paused'; showScreen('paused'); } });

// ------------------------------------------------------------------ Schleife ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (G.mode === 'title') {
      animateTitle(now / 1000);
      renderer.render(T.scene, T.cam);
      return;
    }
    for (let k = 0; k < G.speed; k++) update(dt);
    ambient(now / 1000, dt);
  } catch (err) {
    console.warn(err);
  }
  if (W.scene) renderer.render(W.scene, camera);
}

// ------------------------------------------------------------------- Start ---
(async () => {
  await document.fonts?.load('40px "Lilita One"').catch(() => {});
  $('loading').textContent = 'Omas ziehen sich an…';
  await new Promise((r) => setTimeout(r, 30));
  renderPortraits();
  buildTitle();
  sel.map = bestMap();
  sel.level = Math.min(LEVELS_PER_MAP, progress.maps[MAPS[sel.map].id].unlocked);
  renderTitle();
  $('loading').classList.add('hidden');
  showScreen('title');
  requestAnimationFrame(frame);
})();

// zum Testen
window.__oma = { G, W, renderer, sim: (sec) => { for (let i = 0; i < sec * 30 && G.mode === 'play'; i++) update(1 / 30); }, startLevel, startWave, placeOma, canPlace, view, OMA_DEF, progress, MAPS, placeCamera, project: (x, z) => { const v = new THREE.Vector3(x, 0, z).project(camera); return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }; } };
