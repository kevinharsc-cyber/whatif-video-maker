// OMA DEFENSE – Tower-Defense mit Omas gegen Zombies (Three.js, läuft im Browser auf dem iPhone)
import { THREE, figure, M, mesh, cookie, tree, house, cobbleTex, fence, bench, flowerBed, gnome, pond, OMAS, RoundedBoxGeometry, setSeed, rand, bake } from './models.js';
import { OMA_DEF, ZOMBIE_DEF, genLevel, genWaves } from './rules.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('de-DE');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat */ } },
};
const progress = { unlocked: 1, stars: {}, ...store.get('oma-progress', {}) };
const settings = { sfx: true, ...store.get('oma-settings', {}) };
const saveProgress = () => store.set('oma-progress', progress);

// ------------------------------------------------------------------ Renderer ---
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
const view = { tx: 0, tz: 0, dist: 20, minD: 9, maxD: 40, bounds: { x0: -6, x1: 6, z0: -10, z1: 10 } };
const TILT = THREE.MathUtils.degToRad(58);
function placeCamera() {
  const b = view.bounds;
  view.tx = Math.max(b.x0 + 2, Math.min(b.x1 - 2, view.tx));
  view.tz = Math.max(b.z0, Math.min(b.z1, view.tz));
  camera.position.set(view.tx, Math.sin(TILT) * view.dist, view.tz + Math.cos(TILT) * view.dist);
  camera.lookAt(view.tx, 0, view.tz);
  if (W.sun) {
    W.sun.position.set(view.tx + 6, 14, view.tz + 6);
    W.sun.target.position.set(view.tx, 0, view.tz);
  }
}
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Standard-Zoom: ca. 11 Einheiten Breite sichtbar
  const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  view.fitD = Math.min(30, 5.6 / Math.tan(hf / 2));
  view.maxD = Math.max(view.fitD * 1.8, 24);
  if (!view.userZoom) view.dist = view.fitD;
  placeCamera();
}
window.addEventListener('resize', resize);

// ------------------------------------------------------------------ Welt ---
const W = { scene: null, curve: null, len: 1, samples: [], blockers: [], sun: null };
function grassTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#6cbf4a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = rand() < 0.5 ? '#7ccf57' : '#5aad3d'; g.beginPath(); g.ellipse(rand() * 512, rand() * 512, 3 + rand() * 9, 2 + rand() * 4, rand() * 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 10); t.colorSpace = THREE.SRGBColorSpace; return t;
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
function buildWorld(levelNo) {
  if (W.scene) W.scene.traverse((o) => { if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose(); });
  const L = genLevel(levelNo);
  setSeed(5000 + levelNo * 31);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd8ff);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a8a4a, 1.4));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun, sun.target);
  W.sun = sun;
  const curve = new THREE.CatmullRomCurve3(L.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  W.curve = curve;
  W.len = curve.getLength();
  W.samples = curve.getSpacedPoints(260);
  W.blockers = [];
  view.bounds = { x0: L.bounds.x0, x1: L.bounds.x1, z0: L.bounds.z0, z1: L.bounds.z1 };
  // Boden
  const gw = L.bounds.x1 - L.bounds.x0 + 30, gd = L.bounds.z1 - L.bounds.z0 + 30;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set((L.bounds.x0 + L.bounds.x1) / 2, 0, (L.bounds.z0 + L.bounds.z1) / 2);
  ground.receiveShadow = true;
  scene.add(ground);
  W.ground = ground;
  // Weg (Kopfsteinpflaster) als Band
  const N = 300, Wd = 1.35;
  const pos = [], uv = [], idx = [];
  let dist = 0, prev = null;
  const stones = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    if (prev) dist += p.distanceTo(prev);
    prev = p.clone();
    for (const s of [-1, 1]) { const q = p.clone().addScaledVector(side, (s * Wd) / 2); pos.push(q.x, 0.015, q.z); uv.push(s < 0 ? 0 : 1, dist / Wd); }
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (i % 3 === 0) for (const s of [-1, 1]) stones.push(p.clone().addScaledVector(side, (s * (Wd + 0.14)) / 2));
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  pg.setIndex(idx);
  pg.computeVertexNormals();
  const pathMesh = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: cobbleTex(false), roughness: 0.85 }));
  pathMesh.receiveShadow = true;
  scene.add(pathMesh);
  const stoneMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.12, 0), new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.9 }), stones.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  stones.forEach((p, i) => { e.set(rand() * 3, rand() * 3, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(p.x, 0.04, p.z), q, new THREE.Vector3(1, 0.55, 1)); stoneMesh.setMatrixAt(i, m4); });
  stoneMesh.receiveShadow = true;
  scene.add(stoneMesh);
  // Start (Zombie-Loch) und Ziel (Seniorenheim)
  const start = curve.getPointAt(0.0);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: 0x2a1c14 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(start.x, 0.03, start.z);
  scene.add(hole);
  const endP = curve.getPointAt(1), endT = curve.getTangentAt(1);
  const deco = new THREE.Group();
  const h = house(deco, endP.x + endT.x * 1.6, endP.z + endT.z * 1.6, false);
  h.rotation.y = Math.atan2(-endT.x, -endT.z);
  W.blockers.push({ x: h.position.x, z: h.position.z, r: 1.6 });
  // Deko: nur wo Platz ist
  const tryPlace = (r, fn, tries = 30) => {
    for (let k = 0; k < tries; k++) {
      const x = L.bounds.x0 - 1 + rand() * (L.bounds.x1 - L.bounds.x0 + 2), z = L.bounds.z0 + rand() * (L.bounds.z1 - L.bounds.z0);
      if (freeSpot(x, z, r)) { W.blockers.push({ x, z, r }); fn(x, z); return true; }
    }
    return false;
  };
  const area = (L.bounds.x1 - L.bounds.x0) * (L.bounds.z1 - L.bounds.z0);
  // Bäume am Rand
  for (let i = 0; i < area / 22; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side > 0 ? L.bounds.x1 + 0.5 + rand() * 3 : L.bounds.x0 - 0.5 - rand() * 3, z = L.bounds.z0 + rand() * (L.bounds.z1 - L.bounds.z0);
    if (distToPath(x, z) > 1.8) tree(deco, x, z, 0.8 + rand() * 0.4);
  }
  for (let i = 0; i < 2; i++) tryPlace(1.0, (x, z) => tree(deco, x, z, 0.8 + rand() * 0.3));
  tryPlace(1.1, (x, z) => pond(deco, x, z, 0.8));
  for (let i = 0; i < 2; i++) tryPlace(0.9, (x, z) => flowerBed(deco, x, z, rand() * 3, [[0xff6b8b, 0xffd23f, 0xffffff], [0xb06bff, 0xff9f1c, 0xff6b8b]][i % 2]));
  for (let i = 0; i < 3; i++) tryPlace(0.35, (x, z) => gnome(deco, x, z, rand() * 6));
  tryPlace(0.8, (x, z) => bench(deco, x, z, rand() * 6));
  const baked = bake(deco);
  baked.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(baked);
  // Blumen + Grasbüschel (instanziert)
  const flowerCols = [0xff6b8b, 0xffd23f, 0xffffff, 0xb06bff];
  const nF = Math.floor(area * 1.2);
  const fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), nF);
  const tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.06, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0x4fa83d }), nF);
  let nf = 0, nt = 0;
  for (let i = 0; i < nF * 2; i++) {
    const x = L.bounds.x0 - 3 + rand() * (L.bounds.x1 - L.bounds.x0 + 6), z = L.bounds.z0 - 2 + rand() * (L.bounds.z1 - L.bounds.z0 + 4);
    if (distToPath(x, z) < 0.95) continue;
    if (i % 2 && nf < nF) { m4.makeTranslation(x, 0.1, z); fl.setMatrixAt(nf, m4); fl.setColorAt(nf, new THREE.Color(flowerCols[nf % 4])); nf++; }
    else if (nt < nF) { m4.makeTranslation(x, 0.1, z); tuft.setMatrixAt(nt++, m4); }
  }
  fl.count = nf; tuft.count = nt;
  scene.add(fl, tuft);
  // Reichweiten-Anzeige + Platzier-Markierung
  W.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
  W.rangeRing.rotation.x = -Math.PI / 2;
  W.rangeDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
  W.rangeDisc.rotation.x = -Math.PI / 2;
  W.range = new THREE.Group();
  W.range.add(W.rangeRing, W.rangeDisc);
  W.range.visible = false;
  scene.add(W.range);
  W.scene = scene;
  view.tx = (start.x + 0) / 2;
  view.tz = start.z + 4;
  view.userZoom = false;
  resize();
  return L;
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
let lastSfx = {};
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
};

// -------------------------------------------------------------- Spielzustand ---
const G = {
  mode: 'menu', // menu | play | won | lost | paused
  level: 1,
  cookies: 0,
  lives: 20,
  livesStart: 20,
  waves: [],
  wave: 0, // Anzahl gestarteter Wellen
  spawnQ: [],
  spawnT: 0,
  waveActive: false,
  zombies: [],
  omas: [],
  shots: [],
  fx: [],
  speed: 1,
  placing: null,
  selected: null,
  coffee: 0, // Restzeit Kaffeekränzchen
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

function startLevel(n) {
  audio();
  G.level = n;
  const L = buildWorld(n);
  G.waves = genWaves(n);
  G.wave = 0;
  G.cookies = L.cookies;
  G.lives = G.livesStart = 20;
  G.zombies = []; G.omas = []; G.shots = []; G.fx = [];
  G.spawnQ = []; G.waveActive = false; G.placing = null; G.selected = null;
  G.coffee = 0; G.coffeeCd = 0; G.speed = 1;
  G.mode = 'play';
  showScreen('hud');
  renderSidebar();
  updateHud();
  closeInfo();
  $('speed').classList.remove('on');
  $('startWave').classList.remove('hidden');
  banner(`LEVEL ${n}`, n % 5 === 0 ? 'Achtung: Am Ende kommt ein BOSS!' : 'Stell deine Omas auf!');
}
function startWave() {
  if (G.waveActive || G.wave >= G.waves.length || G.mode !== 'play') return;
  G.spawnQ = G.waves[G.wave].map((s) => ({ ...s }));
  G.spawnT = 0.3;
  G.wave++;
  G.waveActive = true;
  $('startWave').classList.add('hidden');
  SND.wave();
  if (G.spawnQ.some((s) => s.type === 'boss')) setTimeout(() => { banner('BOSS!', 'Zombie-Boss Bruno kommt!'); SND.boss(); }, 1500);
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
  const z = { type: s.type, def, obj, bar, hpMax: def.hp * s.hp, hp: def.hp * s.hp, dist: -0.5, speed: def.speed * s.speed, slowT: 0, slowF: 1, dead: false, deadT: 0, ph: Math.random() * 6 };
  G.zombies.push(z);
  placeZombie(z);
}
function placeZombie(z) {
  const u = Math.max(0, Math.min(1, z.dist / W.len));
  const p = W.curve.getPointAt(u), tg = W.curve.getTangentAt(u);
  z.obj.position.set(p.x, 0, p.z);
  z.obj.rotation.y = Math.atan2(tg.x, tg.z);
}
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
  const rew = Math.round(z.def.reward * (1 + (G.level - 1) * 0.03));
  G.cookies += rew;
  SND.coin();
  floatText(z.obj.position, `+${rew}`);
  updateHud();
}
// ------------------------------------------------------------------- Omas ---
function canPlace(x, z) {
  const b = view.bounds;
  if (x < b.x0 - 1 || x > b.x1 + 1 || z < b.z0 - 1 || z > b.z1 + 1) return false;
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
    if (z.dead || z.dist < 0) continue;
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
    // Gießkanne / Rollator: wirkt auf alle in Reichweite
    for (const z of G.zombies) {
      if (z.dead || z.dist < 0) continue;
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

// ------------------------------------------------------------------ Update ---
function update(dt) {
  G.t += dt;
  if (G.mode !== 'play') return;
  const t = G.t;
  // Kaffeekränzchen
  G.coffee = Math.max(0, G.coffee - dt);
  G.coffeeCd = Math.max(0, G.coffeeCd - dt);
  // Spawns
  if (G.spawnQ.length) {
    G.spawnT -= dt;
    while (G.spawnQ.length && G.spawnT <= 0) {
      const s = G.spawnQ.shift();
      spawnZombie(s);
      G.spawnT += s.gap;
    }
  }
  // Zombies
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
      G.lives -= z.def.lives;
      SND.leak();
      if (navigator.vibrate) navigator.vibrate(60);
      W.scene.remove(z.obj);
      G.zombies.splice(i, 1);
      updateHud();
      if (G.lives <= 0) { lose(); return; }
      continue;
    }
    placeZombie(z);
    // Wanken
    const w = Math.sin(t * (z.def.fast ? 12 : 6) + z.ph);
    z.obj.position.y = Math.abs(w) * 0.06;
    z.obj.rotation.z = w * 0.12;
    // Lebensbalken
    z.bar.quaternion.copy(z.obj.quaternion).invert().multiply(camQ);
    const r = Math.max(0, z.hp / z.hpMax);
    const f = z.bar.userData.fill;
    f.scale.x = z.bar.userData.width * r;
    f.position.x = -(z.bar.userData.width * (1 - r)) / 2;
    f.material = r > 0.6 ? HP_MATS.g : r > 0.3 ? HP_MATS.y : HP_MATS.r;
    z.bar.visible = r < 1 || z.def.boss;
  }
  // Omas
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
  // Würfe
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const sh = G.shots[i];
    sh.t += dt;
    if (sh.tgt && !sh.tgt.dead && !sh.arc) sh.to.copy(sh.tgt.obj.position).setY(0.7 * sh.tgt.def.size);
    const k = Math.min(1, sh.t / sh.dur);
    sh.m.position.lerpVectors(sh.from, sh.to, k);
    if (sh.arc) sh.m.position.y += Math.sin(k * Math.PI) * 2.2;
    sh.m.lookAt(sh.to);
    if (sh.kind === 'single' || sh.kind === 'pierce') sh.m.rotateY(0);
    else sh.m.rotation.x += dt * 10;
    if (k >= 1) {
      W.scene.remove(sh.m);
      G.shots.splice(i, 1);
      if (sh.kind === 'fx') continue;
      if (sh.kind === 'splash') {
        for (const z of G.zombies) if (!z.dead && z.obj.position.distanceTo(sh.to.clone().setY(0)) < sh.s.splash) damage(z, sh.s.dmg, 'splash');
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
    $('startWave').classList.remove('hidden');
    updateHud();
  }
  updateHud(true);
  if (G.selected) positionInfo();
}
function win() {
  G.mode = 'won';
  const lost = G.livesStart - G.lives;
  const stars = lost === 0 ? 3 : lost <= 5 ? 2 : 1;
  progress.stars[G.level] = Math.max(progress.stars[G.level] || 0, stars);
  progress.unlocked = Math.max(progress.unlocked, G.level + 1);
  saveProgress();
  SND.win();
  $('wonStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  $('wonText').textContent = `Level ${G.level} geschafft! Noch ${G.lives} Leben übrig.`;
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
  const s = `${Math.floor(G.cookies)}|${G.lives}|${G.wave}|${G.waves.length}|${Math.ceil(G.coffeeCd)}|${G.coffee > 0}`;
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
  document.querySelectorAll('.ocard').forEach((el) => {
    const def = OMA_DEF[el.dataset.id];
    if (!def) return;
    el.classList.toggle('poor', G.cookies < def.cost);
  });
  if (G.selected) renderInfo();
}
const portraits = {};
function renderPortraits() {
  // kleine Bilder der Omas für die Leiste (einmal gezeichnet)
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
  const ids = Object.keys(OMAS);
  $('cards').innerHTML = ids
    .map((id) => {
      const def = OMA_DEF[id];
      const name = OMAS[id].name.replace('Oma ', '').replace('Bingo-', '').toUpperCase();
      if (!def) return `<div class="ocard soon"><img src="${portraits[id]}" alt=""><b>${name}</b><small>BALD</small></div>`;
      const locked = progress.unlocked < def.unlock && G.level < def.unlock;
      if (locked) return `<div class="ocard locked"><img src="${portraits[id]}" alt=""><i class="lock"></i><b>${name}</b><small>LEVEL ${def.unlock}</small></div>`;
      return `<button class="ocard" data-id="${id}" style="--c:${OMAS[id].card}"><img src="${portraits[id]}" alt=""><b>${name}</b><small><span class="ck"></span>${def.cost}</small></button>`;
    })
    .join('');
  document.querySelectorAll('.ocard[data-id]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = b.dataset.id;
    if (G.placing === id) return cancelPlacing();
    if (G.cookies < OMA_DEF[id].cost) { b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 400); return; }
    G.placing = id;
    closeInfo();
    document.querySelectorAll('.ocard').forEach((x) => x.classList.toggle('sel', x === b));
    $('hint').textContent = `Tippe neben den Weg, um ${OMAS[id].name} aufzustellen`;
    $('hint').classList.remove('hidden');
    W.range.visible = true;
    W.range.scale.setScalar(OMA_DEF[id].base.range);
    W.range.position.set(view.tx, 0.04, view.tz);
    setSidebar(false);
  }));
}
function cancelPlacing() {
  G.placing = null;
  W.range.visible = false;
  $('hint').classList.add('hidden');
  document.querySelectorAll('.ocard').forEach((x) => x.classList.remove('sel'));
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
  if (!G.placing && W.range) W.range.visible = false;
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
  bannerT = setTimeout(() => b.classList.add('hidden'), 2200);
}
function showScreen(id) {
  for (const s of ['menu', 'levels', 'hud', 'won', 'lost', 'paused']) $(s).classList.toggle('hidden', !(s === id || (s === 'hud' && ['won', 'lost', 'paused'].includes(id))));
}
function renderLevels() {
  const max = Math.max(progress.unlocked, 1);
  let html = '';
  for (let n = 1; n <= 100; n++) {
    const st = progress.stars[n] || 0;
    const open = n <= max;
    html += `<button class="lvl${open ? '' : ' locked'}${n % 5 === 0 ? ' boss' : ''}" data-n="${n}" ${open ? '' : 'disabled'}><b>${n}</b><small>${open ? '★'.repeat(st) + '☆'.repeat(3 - st) : ''}</small></button>`;
  }
  $('lvlGrid').innerHTML = html;
  document.querySelectorAll('.lvl[data-n]').forEach((b) => b.addEventListener('click', () => startLevel(Number(b.dataset.n))));
  const cur = $('lvlGrid').querySelector(`[data-n="${max}"]`);
  if (cur) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
}
$('play').addEventListener('click', () => startLevel(Math.max(1, Math.min(progress.unlocked, 100))));
$('toLevels').addEventListener('click', () => { renderLevels(); showScreen('levels'); });
$('levelsBack').addEventListener('click', () => showScreen('menu'));
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
$('quit').addEventListener('click', () => { G.mode = 'menu'; showScreen('menu'); });
$('next').addEventListener('click', () => startLevel(Math.min(100, G.level + 1)));
$('wonMenu').addEventListener('click', () => { G.mode = 'menu'; showScreen('menu'); });
$('retry').addEventListener('click', () => startLevel(G.level));
$('lostMenu').addEventListener('click', () => { G.mode = 'menu'; showScreen('menu'); });
$('sfxBtn').addEventListener('click', () => { settings.sfx = !settings.sfx; store.set('oma-settings', settings); $('sfxBtn').textContent = settings.sfx ? '🔊' : '🔇'; });
$('sfxBtn').textContent = settings.sfx ? '🔊' : '🔇';

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
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, tx: view.tx, tz: view.tz, moved: false };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: view.dist }; drag = null; }
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) {
    // Maus: Vorschau beim Platzieren
    if (G.placing) { const p = groundAt(e.clientX, e.clientY); if (p) previewPlace(p); }
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    view.dist = Math.max(view.minD, Math.min(view.maxD, pinch.dist * (pinch.d / d)));
    view.userZoom = true;
    placeCamera();
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 10) drag.moved = true;
    if (drag.moved && !G.placing) {
      const k = view.dist / window.innerHeight * 1.15;
      view.tx = drag.tx - dx * k;
      view.tz = drag.tz - dy * k * 1.3;
      placeCamera();
    }
    if (G.placing) { const p = groundAt(e.clientX, e.clientY); if (p) previewPlace(p); }
  }
});
function previewPlace(p) {
  W.range.position.set(p.x, 0.04, p.z);
  const ok = canPlace(p.x, p.z) && G.cookies >= OMA_DEF[G.placing].cost;
  W.rangeRing.material.color.set(ok ? 0xffffff : 0xff4f4f);
  W.rangeDisc.material.color.set(ok ? 0x7ddc4a : 0xff4f4f);
}
const endPointer = (e) => {
  const wasDrag = drag && drag.moved;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0 && drag && !wasDrag && G.mode === 'play') tap(e.clientX, e.clientY);
  if (pointers.size === 0) drag = null;
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; });
canvas.addEventListener('wheel', (e) => { view.dist = Math.max(view.minD, Math.min(view.maxD, view.dist * (e.deltaY > 0 ? 1.1 : 0.9))); view.userZoom = true; placeCamera(); }, { passive: true });
function tap(cx, cy) {
  const p = groundAt(cx, cy);
  if (!p) return;
  if (G.placing) {
    previewPlace(p);
    const o = placeOma(G.placing, p.x, p.z);
    if (o) cancelPlacing();
    else { $('hint').textContent = G.cookies < OMA_DEF[G.placing].cost ? 'Nicht genug Kekse!' : 'Hier geht das nicht – such dir einen freien Platz neben dem Weg'; tone(200, 150, 0.12, 'square', 0.04); }
    return;
  }
  // Oma antippen?
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
    for (let k = 0; k < G.speed; k++) update(dt);
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
  buildWorld(Math.max(1, progress.unlocked));
  $('loading').classList.add('hidden');
  showScreen('menu');
  $('menuLevel').textContent = `LEVEL ${Math.max(1, Math.min(progress.unlocked, 100))}`;
  requestAnimationFrame(frame);
})();

// zum Testen
window.__oma = { G, W, renderer, sim: (sec) => { for (let i = 0; i < sec * 30 && G.mode === "play"; i++) update(1 / 30); }, startLevel, startWave, placeOma, canPlace, view, OMA_DEF, progress };
