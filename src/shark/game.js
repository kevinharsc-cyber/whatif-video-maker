// SHARK ATTACK – 3D-Endlos-Läufer unter Wasser (Three.js, läuft im Browser auf dem iPhone)
// Erste spielbare Version: 3 Bahnen, Wischen, Hai-Verfolgung, Hindernisse, Münzen, Game Over, Menü.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as Q from './progress.js';
import { createBus, scheduleStep, stepSeconds } from './music.js';
import { savePlayer, topPlayers, searchPlayers, getPlayers, newId, newSecret, isId, NAME_RE } from './online.js';

// ------------------------------------------------------------ Einstellungen ---
const LANES = [-2.2, 0, 2.2];
const FLOOR_Y = -1.6;
const SWIM_Y = 0.6;
const BOOST_Y = 2.8;
const DIVE_Y = -0.75;
const START_SPEED = 13;
const MAX_SPEED = 32;
const CAM = { x: 0, y: 4.6, z: 6.8, lookY: 0, lookZ: -7 };

const lerp = (a, b, k) => a + (b - a) * k;
const smoothstep = (k) => k * k * (3 - 2 * k);

// --------------------------------------------------------------- Speicher ---
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* privat */
    }
  },
};
let best = store.get('shark-best', 0);
let bank = store.get('shark-coins', 0);
const settings = { music: true, sfx: true, ...store.get('shark-settings', {}) };
let top = store.get('shark-top', []);
const today = new Date().toISOString().slice(0, 10);
// Aufgaben (täglich, wöchentlich, Dauer) – siehe progress.js
let quests = Q.ensure(store.get('shark-quests', null));
const saveQuests = () => store.set('shark-quests', quests);
saveQuests();
// Profil: Name, Level, Skins, Haie, Glücksrad, Freunde
const DIVER_SKINS = [
  { id: 'standard', name: 'Standard', price: 0, suit: 0x1d2f6b, acc: 0xffd23f },
  { id: 'black', name: 'Schwarz', price: 10000, suit: 0x17191f, acc: 0x9aa3ad },
  { id: 'red', name: 'Rot', price: 20000, suit: 0xc62828, acc: 0xffffff },
  { id: 'green', name: 'Tarn-Grün', level: 25, suit: 0x2f5d2a, acc: 0xa3c44a },
  { id: 'neon', name: 'Neon', level: 50, suit: 0x14112e, acc: 0x39ff14 },
  { id: 'gold', name: 'Goldtaucher', level: 100, suit: 0xffc21a, acc: 0xfff4b0, gold: true },
  { id: 'santa', name: 'Weihnachtsmann', event: true, suit: 0xd61f26, acc: 0xffffff, santa: true },
];
// Rucksack (Pressluftflaschen) in anderer Farbe
const TANKS = [
  { id: 'default', name: 'Passend zum Skin', color: null },
  { id: 'purple', name: 'Lila-Chrom', level: 60, color: 0x8e44ff },
];
// Diese Werte kennt die Online-Datenbank; neue Skins werden dort als „standard“ gezeigt
const SERVER_SKINS = ['standard', 'black', 'red'];
const SERVER_SHARKS = ['white', 'tiger', 'mega'];
const SHARKS = [
  { id: 'white', name: 'Weißer Hai', price: 0, top: 0x3d6f9e, brow: 0x24476b, eye: 0x4a2a12, stripes: false, size: 1 },
  { id: 'tiger', name: 'Tigerhai', price: 50000, top: 0x7a8a5a, brow: 0x3e4a2a, eye: 0x6a3a12, stripes: true, size: 1.08 },
  { id: 'mega', name: 'Megalodon', price: 100000, top: 0x2d3038, brow: 0x111317, eye: 0xd61f1f, stripes: false, size: 1.28 },
];
const profile = { name: '', skin: 'standard', shark: 'white', tank: 'default', tanks: ['default'], skins: ['standard'], sharks: ['white'], xp: 0, wheelAt: 0, friends: [], ...store.get('shark-profile', {}) };
const saveProfile = () => store.set('shark-profile', profile);
// eigene Online-ID + Geheimnis (bleibt nur auf diesem Handy)
if (!isId(profile.id) || !profile.secret) {
  profile.id = newId();
  profile.secret = newSecret();
  saveProfile();
}
const levelOf = Q.levelOf;
// alte XP (früheres System, viel größere Zahlen) einmalig umrechnen
if (profile.xpv !== 2) {
  profile.xp = Math.floor((profile.xp || 0) / 8);
  profile.xpv = 2;
}

// ------------------------------------------------------------------ Szene ---
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const WATER = new THREE.Color(0x0e78b4);
scene.background = WATER;
scene.fog = new THREE.Fog(0x0e78b4, 14, 62);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
scene.add(new THREE.HemisphereLight(0xbfefff, 0x1a4b6b, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(4, 12, 6);
scene.add(sun);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Hochformat: etwas weiter zurück, damit alle 3 Bahnen ins Bild passen
  camera.fov = w / h < 0.7 ? 66 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ----------------------------------------------------- Cartoon-Materialien ---
const grad = (() => {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra }));
  return matCache.get(key);
}
const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0b2233, side: THREE.BackSide });
// Mesh mit dunklem Umriss (wie die 2D-Cartoons)
function part(geo, color, { outline = true, w = 0.05, extra } = {}) {
  const m = new THREE.Mesh(geo, toon(color, extra));
  if (outline) {
    const o = new THREE.Mesh(geo, OUTLINE);
    o.scale.setScalar(1 + w);
    m.add(o);
  }
  return m;
}

// --------------------------------------------------------------- Taucher ---
function makeDiver(skinId = 'standard', tankId = 'default') {
  const sk = DIVER_SKINS.find((s) => s.id === skinId) || DIVER_SKINS[0];
  const tankCol = (TANKS.find((x) => x.id === tankId) || TANKS[0]).color ?? sk.acc;
  const goldExtra = sk.gold ? { emissive: 0x6a4a00 } : undefined;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SUIT = sk.suit;
  const YEL = sk.acc;
  const SKIN = 0xf2c29b;
  // Körper liegt waagerecht (schwimmt nach vorne = -z)
  const torso = part(new THREE.CapsuleGeometry(0.34, 0.75, 6, 12), SUIT, { extra: goldExtra });
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  const stripe = part(new THREE.CapsuleGeometry(0.35, 0.2, 4, 12), YEL, { outline: false });
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.2;
  body.add(stripe);
  // Flaschen auf dem Rücken
  for (const sx of [-0.15, 0.15]) {
    const tank = part(new THREE.CapsuleGeometry(0.13, 0.6, 4, 10), tankCol, { extra: sk.gold ? { emissive: 0x6a4a00 } : undefined });
    tank.rotation.x = Math.PI / 2;
    tank.position.set(sx, 0.36, 0.05);
    body.add(tank);
  }
  // Kopf mit Haaren und Taucherbrille
  const head = new THREE.Group();
  head.position.set(0, 0.12, -0.78);
  body.add(head);
  head.add(part(new THREE.SphereGeometry(0.3, 16, 12), SKIN));
  for (let i = 0; i < (sk.santa ? 0 : 7); i++) {
    const spike = part(new THREE.ConeGeometry(0.11, 0.32, 6), 0x7a3f1d, { w: 0.08 });
    spike.position.set(-0.18 + (i % 4) * 0.12, 0.22 + (i > 3 ? 0.04 : 0), 0.05 + (i > 3 ? 0.12 : 0));
    spike.rotation.set(-0.9 + Math.random() * 0.3, 0, -0.5 + (i % 4) * 0.33);
    head.add(spike);
  }
  if (sk.santa) {
    // Weihnachtsmann: Mütze mit Bommel + weißer Bart
    const hat = part(new THREE.ConeGeometry(0.3, 0.6, 12), 0xd61f26, { w: 0.06 });
    hat.position.set(0, 0.42, 0.12);
    hat.rotation.x = 0.55;
    head.add(hat);
    const brim = part(new THREE.TorusGeometry(0.29, 0.07, 8, 18), 0xffffff, { w: 0.08 });
    brim.position.set(0, 0.2, 0.02);
    brim.rotation.x = Math.PI / 2 + 0.55;
    head.add(brim);
    const pom = part(new THREE.SphereGeometry(0.09, 8, 6), 0xffffff, { w: 0.1 });
    pom.position.set(0, 0.62, 0.42);
    head.add(pom);
    const beard = part(new THREE.SphereGeometry(0.27, 12, 10), 0xffffff, { w: 0.06 });
    beard.scale.set(1, 0.8, 0.7);
    beard.position.set(0, -0.2, -0.16);
    head.add(beard);
  }
  if (sk.gold) {
    // Goldtaucher: kleine Krone
    const crown = part(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8, 1, true), 0xffd23f, { w: 0.08, extra: { emissive: 0x6a4a00, side: THREE.DoubleSide } });
    crown.position.set(0, 0.34, 0.05);
    head.add(crown);
    for (let i = 0; i < 5; i++) {
      const tip = part(new THREE.ConeGeometry(0.05, 0.14, 4), 0xffd23f, { w: 0.1, extra: { emissive: 0x6a4a00 } });
      const a = (i / 5) * Math.PI * 2;
      tip.position.set(Math.cos(a) * 0.19, 0.46, 0.05 + Math.sin(a) * 0.19);
      head.add(tip);
    }
  }
  const mask = part(new THREE.BoxGeometry(0.52, 0.2, 0.12), 0x2ec4f0);
  mask.position.set(0, 0.04, -0.27);
  head.add(mask);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.04), new THREE.MeshBasicMaterial({ color: 0xbff4ff }));
  glass.position.set(0, 0.04, -0.34);
  head.add(glass);
  const strap = part(new THREE.TorusGeometry(0.31, 0.03, 6, 20), 0x0b2233, { outline: false });
  strap.position.y = 0.04;
  strap.rotation.x = Math.PI / 2;
  head.add(strap);
  // Arme
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * 0.38, 0.05, -0.45);
    const up = part(new THREE.CapsuleGeometry(0.1, 0.45, 4, 8), SUIT);
    up.rotation.x = Math.PI / 2;
    up.position.z = 0.25;
    a.add(up);
    const hand = part(new THREE.SphereGeometry(0.1, 8, 8), SKIN);
    hand.position.z = 0.55;
    a.add(hand);
    body.add(a);
    arms.push(a);
  }
  // Beine mit Flossen
  const legs = [];
  for (const sx of [-1, 1]) {
    const l = new THREE.Group();
    l.position.set(sx * 0.16, -0.02, 0.5);
    const leg = part(new THREE.CapsuleGeometry(0.12, 0.55, 4, 8), SUIT);
    leg.rotation.x = Math.PI / 2;
    leg.position.z = 0.3;
    l.add(leg);
    const fin = part(new THREE.BoxGeometry(0.26, 0.04, 0.55), YEL);
    fin.position.set(0, -0.02, 0.85);
    l.add(fin);
    const finStripe = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.045, 0.08), toon(0x0b2233));
    finStripe.position.set(0, -0.02, 0.8);
    l.add(finStripe);
    body.add(l);
    legs.push(l);
  }
  root.userData = { body, arms, legs, head };
  return root;
}

// ------------------------------------------------------------------- Hai ---
function makeShark(sharkId = 'white') {
  const sv = SHARKS.find((s) => s.id === sharkId) || SHARKS[0];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const TOP = sv.top;
  const BELLY = 0xf1f5f8;
  const b = part(new THREE.SphereGeometry(1, 20, 14), TOP, { w: 0.03 });
  b.scale.set(1.15, 1.0, 3.0);
  body.add(b);
  const belly = part(new THREE.SphereGeometry(1, 20, 14), BELLY, { outline: false });
  belly.scale.set(1.05, 0.75, 2.85);
  belly.position.y = -0.3;
  body.add(belly);
  // Rückenflosse
  const dorsal = part(new THREE.ConeGeometry(0.55, 1.6, 4), TOP, { w: 0.04 });
  dorsal.scale.set(0.25, 1, 1);
  dorsal.position.set(0, 1.4, 0.3);
  dorsal.rotation.x = 0.45;
  body.add(dorsal);
  // Brustflossen
  for (const sx of [-1, 1]) {
    const pf = part(new THREE.ConeGeometry(0.45, 1.6, 4), TOP, { w: 0.04 });
    pf.scale.set(1, 1, 0.2);
    pf.position.set(sx * 1.3, -0.45, -0.6);
    pf.rotation.set(0.2, 0, sx * 1.9);
    body.add(pf);
  }
  // Schwanz
  const tail = new THREE.Group();
  tail.position.set(0, 0.1, 2.9);
  body.add(tail);
  const stem = part(new THREE.SphereGeometry(0.55, 12, 10), TOP, { w: 0.04 });
  stem.scale.set(0.8, 0.8, 1.6);
  stem.position.z = 0.6;
  tail.add(stem);
  for (const sy of [1, -1]) {
    const lobe = part(new THREE.ConeGeometry(0.4, 1.7, 4), TOP, { w: 0.04 });
    lobe.scale.set(0.2, 1, 1);
    lobe.position.set(0, sy * 0.8, 1.5);
    lobe.rotation.x = sy * -0.6;
    tail.add(lobe);
  }
  // Augen (böse Brauen)
  for (const sx of [-1, 1]) {
    const eye = part(new THREE.SphereGeometry(0.22, 12, 10), 0xffffff, { w: 0.12 });
    eye.position.set(sx * 0.72, 0.45, -2.15);
    body.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), sv.id === 'mega' ? new THREE.MeshBasicMaterial({ color: sv.eye }) : toon(sv.eye));
    pupil.position.set(sx * 0.06, 0, -0.14);
    eye.add(pupil);
    const brow = part(new THREE.BoxGeometry(0.5, 0.1, 0.12), sv.brow);
    brow.position.set(sx * 0.72, 0.72, -2.2);
    brow.rotation.z = sx * 0.45;
    body.add(brow);
  }
  // Maul: Oberkiefer bleibt, Unterkiefer klappt auf
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.25, -2.4);
  body.add(mouth);
  const inside = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), toon(0x8a1f2c));
  inside.scale.set(1, 0.6, 0.6);
  mouth.add(inside);
  const jaw = new THREE.Group();
  mouth.add(jaw);
  const jawMesh = part(new THREE.SphereGeometry(0.85, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), BELLY, { w: 0.04 });
  jawMesh.scale.set(1, 0.6, 0.9);
  jaw.add(jawMesh);
  const teethMat = toon(0xffffff);
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.85 + (i / 8) * Math.PI * 0.7;
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.24, 4), teethMat);
    top.position.set(Math.cos(a) * 0.62, -0.02, Math.sin(a) * 0.4);
    top.rotation.x = Math.PI;
    mouth.add(top);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), teethMat);
    bot.position.set(Math.cos(a) * 0.6, 0.05, Math.sin(a) * 0.4);
    jaw.add(bot);
  }
  // Kiemen
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const gill = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.06), toon(sv.brow));
    gill.position.set(sx * 1.1, 0.0, -1.1 + i * 0.22);
    body.add(gill);
  }
  if (sv.stripes) {
    // Tigerstreifen auf dem Rücken
    for (let i = 0; i < 7; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.16), toon(0x2e3520));
      st.position.set(0, 0.97, -1.2 + i * 0.5);
      st.rotation.z = (i % 2 ? 0.25 : -0.25);
      body.add(st);
    }
  }
  if (sv.id === 'mega') {
    // Narben + größere Zähne
    for (let i = 0; i < 3; i++) {
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), toon(0x6b6f78));
      sc.position.set(0.75, 0.55 - i * 0.12, -0.4 + i * 0.25);
      sc.rotation.x = 0.8;
      body.add(sc);
    }
  }
  root.scale.setScalar(sv.size);
  root.userData = { body, tail, jaw, size: sv.size };
  return root;
}

// ----------------------------------------------------------- Umgebung ---
function sandTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8cf9a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#d9bd84' : '#f2dcae';
    g.beginPath();
    g.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 10, 2 + Math.random() * 4, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Sandwellen
  g.strokeStyle = 'rgba(190,150,90,0.45)';
  g.lineWidth = 3;
  for (let y = 10; y < 256; y += 32) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x * 0.05) * 5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 30);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const sand = sandTexture();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 160), new THREE.MeshToonMaterial({ map: sand, gradientMap: grad }));
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, FLOOR_Y, -60);
scene.add(floor);
// Bahn-Markierungen (helle Sandstreifen)
for (const x of [-1.1, 1.1]) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 160), new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.35 }));
  s.rotation.x = -Math.PI / 2;
  s.position.set(x, FLOOR_Y + 0.01, -60);
  scene.add(s);
}
// Lichtstrahlen von oben
const rays = [];
for (let i = 0; i < 6; i++) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 40), new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide }));
  r.position.set(-9 + i * 3.6, 10, -20 - i * 6);
  r.rotation.z = 0.35;
  scene.add(r);
  rays.push(r);
}
// Deko am Rand (Korallen, Seetang, Steine) – wird immer wieder nach hinten gesetzt
const decoKinds = [
  () => {
    const g = new THREE.Group();
    const cols = [0xff6b8b, 0xff9f1c, 0xb06bff, 0xff5a5a];
    for (let i = 0; i < 4; i++) {
      const c = part(new THREE.CylinderGeometry(0.08, 0.16, 1 + Math.random(), 6), cols[i % 4], { w: 0.1 });
      c.position.set((Math.random() - 0.5) * 0.8, 0.5, (Math.random() - 0.5) * 0.8);
      c.rotation.z = (Math.random() - 0.5) * 0.8;
      g.add(c);
      const tip = part(new THREE.SphereGeometry(0.2, 8, 6), cols[(i + 1) % 4], { w: 0.1 });
      tip.position.copy(c.position).add(new THREE.Vector3(0, 0.6, 0));
      g.add(tip);
    }
    return g;
  },
  () => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const s = part(new THREE.BoxGeometry(0.12, 2.4 + Math.random() * 1.5, 0.05), 0x3fa34d, { w: 0.1 });
      s.position.set(i * 0.25 - 0.25, 1.2, 0);
      s.userData.sway = Math.random() * 6;
      g.add(s);
    }
    g.userData.weed = true;
    return g;
  },
  () => {
    const r = part(new THREE.DodecahedronGeometry(0.8, 0), 0x6f7d8c, { w: 0.06 });
    r.scale.set(1.3, 0.7, 1);
    r.position.y = 0.3;
    const g = new THREE.Group();
    g.add(r);
    return g;
  },
];
const decos = [];
for (let i = 0; i < 40; i++) {
  const d = decoKinds[i % 3]();
  const side = i % 2 ? 1 : -1;
  d.position.set(side * (3.8 + Math.random() * 4), FLOOR_Y, -i * 2.4);
  scene.add(d);
  decos.push(d);
}
// Luftblasen
const BUB = 70;
const bubGeo = new THREE.BufferGeometry();
const bubPos = new Float32Array(BUB * 3);
for (let i = 0; i < BUB; i++) {
  bubPos[i * 3] = (Math.random() - 0.5) * 16;
  bubPos[i * 3 + 1] = FLOOR_Y + Math.random() * 10;
  bubPos[i * 3 + 2] = -Math.random() * 50;
}
bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ color: 0xdff8ff, size: 0.18, transparent: true, opacity: 0.75, depthWrite: false }));
scene.add(bubbles);

// ------------------------------------------------------------ Hindernisse ---
// Typen: full = Bahn wechseln, low = drüber (↑), high = drunter (↓)
const OBST = {
  rock: {
    v: 'full',
    make() {
      const g = new THREE.Group();
      const r = part(new THREE.DodecahedronGeometry(1.1, 0), 0x7d8a99, { w: 0.05 });
      r.scale.set(0.95, 1.6, 0.9);
      r.position.y = 1.4;
      g.add(r);
      const r2 = part(new THREE.DodecahedronGeometry(0.6, 0), 0x6a7683, { w: 0.06 });
      r2.position.set(0.5, 0.4, 0.3);
      g.add(r2);
      return g;
    },
  },
  mine: {
    v: 'full',
    make() {
      const g = new THREE.Group();
      const ball = part(new THREE.SphereGeometry(0.7, 14, 10), 0x2b2f36, { w: 0.05 });
      ball.position.y = 2.2;
      g.add(ball);
      for (let i = 0; i < 10; i++) {
        const sp = part(new THREE.ConeGeometry(0.1, 0.35, 6), 0x9aa3ad, { w: 0.1 });
        const d = new THREE.Vector3().randomDirection();
        sp.position.copy(d.clone().multiplyScalar(0.75)).add(new THREE.Vector3(0, 2.2, 0));
        sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
        g.add(sp);
      }
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
      light.position.set(0, 2.92, 0);
      g.add(light);
      g.userData.blink = light;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), toon(0x555b63));
      chain.position.y = 0.8;
      g.add(chain);
      return g;
    },
  },
  coral: {
    v: 'low',
    make() {
      const g = new THREE.Group();
      const cols = [0xff6b8b, 0xff9f1c, 0xff5a5a, 0xb06bff];
      for (let i = 0; i < 6; i++) {
        const c = part(new THREE.CylinderGeometry(0.1, 0.22, 1.6 + Math.random() * 0.8, 6), cols[i % 4], { w: 0.08 });
        c.position.set(-0.7 + (i % 3) * 0.7, 0.9, i > 2 ? 0.3 : -0.3);
        c.rotation.z = (Math.random() - 0.5) * 0.6;
        g.add(c);
        const tip = part(new THREE.SphereGeometry(0.26, 8, 6), cols[(i + 2) % 4], { w: 0.08 });
        tip.position.set(c.position.x, 1.8 + Math.random() * 0.4, c.position.z);
        g.add(tip);
      }
      return g;
    },
  },
  barrier: {
    v: 'low',
    make() {
      const g = new THREE.Group();
      for (const x of [-0.85, 0.85]) {
        const p = part(new THREE.BoxGeometry(0.22, 2.4, 0.22), 0x7a4b2a, { w: 0.06 });
        p.position.set(x, 1.2, 0);
        g.add(p);
      }
      for (const y of [0.9, 1.9]) {
        const b = part(new THREE.BoxGeometry(2.1, 0.32, 0.16), 0xa8723f, { w: 0.05 });
        b.position.set(0, y, 0);
        b.rotation.z = y > 1 ? 0.06 : -0.05;
        g.add(b);
      }
      return g;
    },
  },
  jelly: {
    v: 'high',
    make() {
      const g = new THREE.Group();
      const bell = part(new THREE.SphereGeometry(0.75, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xff8fe0, { w: 0.06, extra: { transparent: true, opacity: 0.85 } });
      bell.position.y = 3.3;
      g.add(bell);
      for (let i = 0; i < 6; i++) {
        const tn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 1.8, 5), toon(0xffb6ec));
        const a = (i / 6) * Math.PI * 2;
        tn.position.set(Math.cos(a) * 0.45, 2.4, Math.sin(a) * 0.45);
        g.add(tn);
      }
      for (const sx of [-0.25, 0.25]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(0x2a1d18));
        e.position.set(sx, 3.45, 0.62);
        g.add(e);
      }
      g.userData.float = true;
      return g;
    },
  },
  beam: {
    v: 'high',
    make() {
      // Wrackteil: Balken quer über der Bahn, man taucht drunter durch
      const g = new THREE.Group();
      const beam = part(new THREE.BoxGeometry(2.3, 0.7, 0.7), 0x6b4426, { w: 0.05 });
      beam.position.y = 1.95;
      beam.rotation.z = 0.08;
      g.add(beam);
      for (const x of [-1.1, 1.1]) {
        const p = part(new THREE.BoxGeometry(0.3, 4.6, 0.3), 0x5a3a1e, { w: 0.05 });
        p.position.set(x, 2.3, 0);
        p.rotation.z = x * 0.04;
        g.add(p);
      }
      const plank = part(new THREE.BoxGeometry(2.4, 2.2, 0.15), 0x7a4b2a, { w: 0.03 });
      plank.position.y = 3.3;
      g.add(plank);
      return g;
    },
  },
};
// vertikale Bereiche (Unterkante, Oberkante) relativ zum Boden
const VBAND = { full: [0, 9], low: [0, 2.9], high: [1.6, 9] };
const HALF_H = 0.38; // halbe Höhe des Tauchers für Treffer

// Objekt-Pools (keine neuen Objekte während des Spiels)
const pools = {};
for (const k of Object.keys(OBST)) {
  pools[k] = [];
  for (let i = 0; i < 5; i++) {
    const m = OBST[k].make();
    m.visible = false;
    scene.add(m);
    pools[k].push(m);
  }
}
const coinGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.12, 24);
// Münzseite: Gold mit Rand und großem „C“ (wird nach dem Laden der Schrift neu gezeichnet)
const coinCanvas = document.createElement('canvas');
coinCanvas.width = coinCanvas.height = 128;
const coinTex = new THREE.CanvasTexture(coinCanvas);
coinTex.colorSpace = THREE.SRGBColorSpace;
// Zylinder-Deckel liegen gedreht: Textur um die Mitte drehen, damit das „C“ aufrecht steht
coinTex.center.set(0.5, 0.5);
coinTex.rotation = Math.PI / 2;
function drawCoinFace() {
  const g = coinCanvas.getContext('2d');
  const gr = g.createRadialGradient(48, 44, 8, 64, 64, 64);
  gr.addColorStop(0, '#fff3a6');
  gr.addColorStop(0.55, '#ffd23f');
  gr.addColorStop(1, '#e8a400');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.lineWidth = 9;
  g.strokeStyle = '#c98a00';
  g.beginPath();
  g.arc(64, 64, 50, 0, Math.PI * 2);
  g.stroke();
  g.font = '78px "Lilita One", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#c98a00';
  g.fillText('C', 66, 70);
  g.fillStyle = '#fff6c9';
  g.fillText('C', 62, 66);
  coinTex.needsUpdate = true;
}
drawCoinFace();
const coinMats = [toon(0xe8a400), new THREE.MeshToonMaterial({ map: coinTex, gradientMap: grad }), new THREE.MeshToonMaterial({ map: coinTex, gradientMap: grad })];
const coinPool = [];
for (let i = 0; i < 48; i++) {
  const c = new THREE.Mesh(coinGeo, coinMats);
  const o = new THREE.Mesh(coinGeo, OUTLINE);
  o.scale.setScalar(1.1);
  c.add(o);
  c.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(c);
  holder.visible = false;
  scene.add(holder);
  coinPool.push(holder);
}

// ------------------------------------------------------------- Power-ups ---
function makeMagnet() {
  const g = new THREE.Group();
  const arc = part(new THREE.TorusGeometry(0.42, 0.16, 10, 20, Math.PI), 0xe5383b, { w: 0.08 });
  arc.rotation.z = Math.PI;
  arc.position.y = 0.1;
  g.add(arc);
  for (const sx of [-0.42, 0.42]) {
    const leg = part(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 10), 0xe5383b, { w: 0.08 });
    leg.position.set(sx, 0.32, 0);
    g.add(leg);
    const tip = part(new THREE.CylinderGeometry(0.165, 0.165, 0.2, 10), 0xdfe6ee, { w: 0.08 });
    tip.position.set(sx, 0.62, 0);
    g.add(tip);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), new THREE.MeshBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.18, depthWrite: false })));
  return g;
}
function makePearl() {
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    const half = part(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xffb6c8, { w: 0.06, extra: { side: THREE.DoubleSide } });
    half.scale.set(1, 0.45, 1);
    half.rotation.x = s > 0 ? -0.9 : Math.PI;
    half.position.set(0, s > 0 ? 0.05 : -0.05, s > 0 ? -0.15 : 0);
    g.add(half);
  }
  const pearl = part(new THREE.SphereGeometry(0.3, 16, 12), 0xffe58a, { w: 0.08 });
  pearl.position.y = 0.12;
  g.add(pearl);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.22, depthWrite: false })));
  return g;
}
function makeDolphin() {
  const g = new THREE.Group();
  const body = part(new THREE.SphereGeometry(0.6, 16, 12), 0x5aa9e6, { w: 0.05 });
  body.scale.set(0.8, 0.75, 2.0);
  g.add(body);
  const belly = part(new THREE.SphereGeometry(0.55, 14, 10), 0xe9f6ff, { outline: false });
  belly.scale.set(0.7, 0.55, 1.8);
  belly.position.y = -0.18;
  g.add(belly);
  const beak = part(new THREE.CylinderGeometry(0.12, 0.2, 0.55, 10), 0x5aa9e6, { w: 0.08 });
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, -0.08, -1.35);
  g.add(beak);
  const fin = part(new THREE.ConeGeometry(0.3, 0.7, 4), 0x4a8fc8, { w: 0.06 });
  fin.scale.set(0.25, 1, 1);
  fin.position.set(0, 0.6, 0.1);
  fin.rotation.x = 0.5;
  g.add(fin);
  const tail = new THREE.Group();
  tail.position.z = 1.2;
  g.add(tail);
  const t1 = part(new THREE.ConeGeometry(0.35, 0.9, 4), 0x4a8fc8, { w: 0.06 });
  t1.scale.set(1, 1, 0.2);
  t1.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  t1.position.z = 0.35;
  tail.add(t1);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), toon(0x111111));
    eye.position.set(sx * 0.4, 0.15, -0.9);
    g.add(eye);
  }
  g.userData.tail = tail;
  return g;
}
function makeChest() {
  const g = new THREE.Group();
  const box = part(new THREE.BoxGeometry(1.1, 0.6, 0.75), 0x8a5a30, { w: 0.06 });
  box.position.y = 0.3;
  g.add(box);
  const lid = part(new THREE.CylinderGeometry(0.375, 0.375, 1.1, 12, 1, false, 0, Math.PI), 0x9a6a3c, { w: 0.06 });
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.6;
  g.add(lid);
  for (const x of [-0.4, 0, 0.4]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.98, 0.8), toon(0xd9a400));
    band.position.set(x, 0.45, 0);
    g.add(band);
  }
  const lock = part(new THREE.BoxGeometry(0.2, 0.22, 0.08), 0xffd23f, { w: 0.1 });
  lock.position.set(0, 0.55, -0.4);
  g.add(lock);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe58a, transparent: true, opacity: 0.2, depthWrite: false })));
  return g;
}
const POWER = {
  ride: { make: makeDolphin, dur: 8, label: 'DELFIN-RITT', color: '#5aa9e6', icon: '🐬', chance: 0.012 },
  treasure: { make: makeChest, dur: 0, label: 'SCHATZ', color: '#ffd23f', icon: '🧰', chance: 0.01 },
  magnet: { make: makeMagnet, dur: 8, label: 'MAGNET', color: '#e5383b', icon: '🧲', chance: 0.07 },
  pearl: { make: makePearl, dur: 10, label: 'x2 MÜNZEN', color: '#d9a400', icon: '🦪', chance: 0.035 },
};
const powerObjs = {};
for (const k of Object.keys(POWER)) {
  powerObjs[k] = POWER[k].make();
  powerObjs[k].visible = false;
  scene.add(powerObjs[k]);
}

// --------------------------------------------------------------- Figuren ---
let diver = makeDiver(profile.skin, profile.tank);
diver.scale.setScalar(1.35);
scene.add(diver);
let shark = makeShark(profile.shark);
shark.scale.setScalar(1.15 * shark.userData.size);
scene.add(shark);
function setDiverSkin(id) {
  const pos = diver.position.clone();
  scene.remove(diver);
  diver = makeDiver(id, profile.tank);
  diver.scale.setScalar(1.35);
  diver.position.copy(pos);
  scene.add(diver);
}
function setSharkModel(id) {
  const pos = shark.position.clone();
  scene.remove(shark);
  shark = makeShark(id);
  shark.scale.setScalar(1.15 * shark.userData.size);
  shark.position.copy(pos);
  scene.add(shark);
}
// Delfin, auf dem der Taucher reitet
const rideDolphin = makeDolphin();
rideDolphin.scale.setScalar(1.5);
rideDolphin.visible = false;
scene.add(rideDolphin);
const RIDE_Y = 3.6;

// kleine Fischschwärme im Hintergrund (eine einzige InstancedMesh = günstig)
const FISH = 36;
// richtiger kleiner Fisch: Körper, Schwanzflosse, Rückenflosse, Augen (Kopf zeigt nach -z)
function fishGeometry() {
  const paint = (g, c) => {
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3).fill(c);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const body = new THREE.SphereGeometry(1, 10, 8);
  body.scale(0.09, 0.15, 0.26);
  const tail = new THREE.ConeGeometry(0.15, 0.2, 4);
  tail.rotateX(-Math.PI / 2); // Spitze zum Körper
  tail.scale(0.18, 1, 1);
  tail.translate(0, 0, 0.3);
  const fin = new THREE.ConeGeometry(0.07, 0.13, 3);
  fin.scale(0.25, 1, 1);
  fin.rotateX(0.5);
  fin.translate(0, 0.16, 0.03);
  const parts = [paint(body, 1), paint(tail, 0.8), paint(fin, 0.8)];
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.028, 6, 4);
    eye.translate(sx * 0.072, 0.04, -0.17);
    parts.push(paint(eye, 0.05));
  }
  return mergeGeometries(parts);
}
const fishes = new THREE.InstancedMesh(fishGeometry(), new THREE.MeshToonMaterial({ gradientMap: grad, vertexColors: true }), FISH);
const fishQ = new THREE.Quaternion();
const fishE = new THREE.Euler();
const fishP = new THREE.Vector3();
const fishS = new THREE.Vector3(1.4, 1.4, 1.4);
const fishData = [];
const fishM = new THREE.Matrix4();
const fishCols = [0xffb347, 0xffe066, 0x7fe0ff, 0xff7b9c];
for (let i = 0; i < FISH; i++) {
  const school = Math.floor(i / 9);
  fishData.push({ school, ox: (Math.random() - 0.5) * 2.2, oy: (Math.random() - 0.5) * 1.2, oz: (Math.random() - 0.5) * 2.5, ph: Math.random() * 6 });
  fishes.setColorAt(i, new THREE.Color(fishCols[school % 4]));
}
const schools = [0, 1, 2, 3].map((i) => ({ x: (i % 2 ? 1 : -1) * (6 + Math.random() * 3), y: 2 + Math.random() * 4, z: -16 - i * 10, dir: i % 2 ? -1 : 1 }));
scene.add(fishes);

// ------------------------------------------------------------------ Ton ---
let ac = null;
let ambient = null;
function audio() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!ambient) {
      // Unterwasser-Rauschen
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.5;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 500;
      const gn = ac.createGain();
      gn.gain.value = 0.25;
      src.connect(lp).connect(gn).connect(ac.destination);
      src.start();
      ambient = gn;
    }
  } catch {
    ac = null;
  }
  return ac;
}
function tone(f0, f1, len, type = 'sine', vol = 0.1) {
  if (!settings.sfx) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const gn = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(gn).connect(a.destination);
  o.start(t);
  o.stop(t + len + 0.02);
}
let coinSoundAt = 0;
let coinStep = 0;
const COIN_NOTES = [784, 880, 988, 1047, 1175]; // G A H C D
const sfx = {
  power: () => {
    tone(500, 1000, 0.15, 'triangle', 0.09);
    setTimeout(() => tone(800, 1600, 0.2, 'triangle', 0.09), 110);
  },
  // weiches „Pling“: leise, kurz, wechselnde Töne aus einer Tonleiter, nie zu oft hintereinander
  coin: () => {
    const now = performance.now();
    if (now - coinSoundAt < 90) return;
    coinSoundAt = now;
    coinStep = (coinStep + 1) % COIN_NOTES.length;
    const f = COIN_NOTES[coinStep];
    tone(f, f * 1.01, 0.12, 'sine', 0.035);
  },
  swipe: () => tone(300, 520, 0.12, 'sine', 0.06),
  up: () => tone(260, 700, 0.25, 'sine', 0.07),
  down: () => tone(500, 180, 0.25, 'sine', 0.07),
  hit: () => tone(180, 50, 0.45, 'sawtooth', 0.12),
  beat: () => tone(70, 40, 0.18, 'sine', 0.35),
  chomp: () => {
    tone(140, 40, 0.5, 'sawtooth', 0.16);
    setTimeout(() => tone(90, 30, 0.4, 'square', 0.12), 120);
  },
};

// ----------------------------------------------------------------- Musik ---
// eigene Titelmelodie „SHARK ATTACK“ (siehe music.js): im Menü sanft, im Spiel mit Schlagzeug,
// wenn der Hai nah ist etwas schneller und treibender
const music = { on: false, bus: null, next: 0, step: 0, timer: null };
function musicTick() {
  const a = ac;
  if (!a || !music.on) return;
  const tense = G.mode === 'play' ? Math.max(0, (G.danger - 0.3) / 0.7) : 0;
  const mode = G.mode === 'play' || G.mode === 'caught' ? 'play' : 'menu';
  if (music.next < a.currentTime - 0.2) music.next = a.currentTime + 0.05; // nach Pause/Hintergrund nicht nachholen
  while (music.next < a.currentTime + 0.2) {
    scheduleStep(a, music.bus, music.step, music.next, mode, tense);
    music.next += stepSeconds(tense);
    music.step++;
  }
}
function startMusic() {
  const a = audio();
  if (!a || music.on || !settings.music) return;
  if (!music.bus) music.bus = createBus(a, a.destination);
  music.bus.master.gain.cancelScheduledValues(a.currentTime);
  music.bus.master.gain.setValueAtTime(0.0001, a.currentTime);
  music.bus.master.gain.exponentialRampToValueAtTime(0.9, a.currentTime + 0.6);
  music.on = true;
  music.next = a.currentTime + 0.05;
  music.timer = setInterval(musicTick, 50);
}
function stopMusic() {
  music.on = false;
  clearInterval(music.timer);
  if (music.bus && ac) {
    music.bus.master.gain.cancelScheduledValues(ac.currentTime);
    music.bus.master.gain.setValueAtTime(0.0001, ac.currentTime + 0.05);
  }
}

// ----------------------------------------------------------------- Spiel ---
const G = {
  mode: 'menu', // menu | play | paused | caught | over
  t: 0,
  speed: START_SPEED,
  dist: 0,
  coins: 0,
  danger: 0.35, // 0 = Hai weit weg, 1 = gefressen
  slow: 0,
  shake: 0,
  nextRow: 20,
  active: [], // { obj, kind, lane, z, hit }
  coinsOn: [], // { obj, lane, y, z }
  lane: 1,
  x: 0,
  y: SWIM_Y,
  vMode: 'swim', // swim | up | down
  vT: 0,
  caughtT: 0,
  beatT: 0,
  dodged: 0,
  power: { ride: 0, magnet: 0, pearl: 0 },
  vFrom: SWIM_Y,
  baseY: SWIM_Y,
  pickup: null,
};

function clearWorld() {
  for (const a of G.active) a.obj.visible = false;
  for (const c of G.coinsOn) c.obj.visible = false;
  if (G.pickup) G.pickup.obj.visible = false;
  G.pickup = null;
  for (const k of Object.keys(G.power)) G.power[k] = 0;
  rideDolphin.visible = false;
  G.active.length = 0;
  G.coinsOn.length = 0;
}
function startRun() {
  audio();
  startMusic();
  G.camBlend = 0;
  clearWorld();
  Object.assign(G, { mode: 'play', t: 0, speed: START_SPEED, dist: 0, coins: 0, danger: 0.85, slow: 0, shake: 0, nextRow: 26, lane: 1, x: 0, y: SWIM_Y, vMode: 'swim', vT: 0, vFrom: SWIM_Y, baseY: SWIM_Y, caughtT: 0, dodged: 0, treasureMsg: '' });
  G.runStart = performance.now();
  if (music.on) music.step = 0; // jeder Lauf startet mit dem Hook
  G.vx = 0;
  G.vy = 0;
  G.camX = 0;
  G.camY = 0;
  G.run = { dives: 0, jumps: 0, powers: 0, rides: 0, chests: 0 };
  showOnly('hud');
}
function take(kind) {
  const p = pools[kind];
  const free = p.find((m) => !m.visible);
  return free || null;
}
// Eine Reihe Hindernisse – immer mindestens ein Weg frei
function spawnRow(z) {
  const level = Math.min(1, G.dist / 1500);
  const kinds = Object.keys(OBST);
  const free = Math.floor(Math.random() * 3); // diese Bahn bleibt ganz frei
  const blockCount = Math.random() < 0.35 + level * 0.4 ? 2 : 1;
  const lanes = [0, 1, 2].filter((l) => l !== free).sort(() => Math.random() - 0.5).slice(0, blockCount);
  for (const lane of lanes) {
    let kind = kinds[Math.floor(Math.random() * kinds.length)];
    const obj = take(kind) || take((kind = 'rock'));
    if (!obj) continue;
    obj.visible = true;
    obj.position.set(LANES[lane], FLOOR_Y, z);
    obj.rotation.y = (Math.random() - 0.5) * 0.3;
    G.active.push({ obj, kind, lane, z, hit: false, passed: false });
  }
  // Münzen: Reihe in der freien Bahn, manchmal als Bogen über einem niedrigen Hindernis
  const arcOver = G.active.find((a) => a.z === z && OBST[a.kind].v === 'low');
  if (arcOver && Math.random() < 0.5) {
    for (let i = 0; i < 5; i++) placeCoin(arcOver.lane, z + 5 - i * 2.6, SWIM_Y + Math.sin((i / 4) * Math.PI) * 2.4);
  } else {
    for (let i = 0; i < 5; i++) placeCoin(free, z + 7 - i * 2.9, SWIM_Y);
  }
  // seltenes Power-up (nie zwei gleichzeitig unterwegs, nicht direkt nach dem Start)
  if (!G.pickup && G.dist > 120) {
    for (const k of Object.keys(POWER)) {
      if (G.power[k] > 0 || G.power.ride > 0 || Math.random() > POWER[k].chance) continue;
      const obj = powerObjs[k];
      obj.visible = true;
      obj.position.set(LANES[free], SWIM_Y + 0.2, z - 6);
      G.pickup = { kind: k, obj, lane: free, z: z - 6 };
      break;
    }
  }
}
function placeCoin(lane, z, y) {
  const obj = coinPool.find((c) => !c.visible);
  if (!obj) return;
  obj.visible = true;
  obj.position.set(LANES[lane], y, z);
  G.coinsOn.push({ obj, lane, y, z, pull: false });
}

let powersHtml = '';
function renderPowers() {
  let html = '';
  for (const k of Object.keys(POWER)) {
    const left = G.power[k] || 0;
    if (left <= 0 || !POWER[k].dur) continue;
    const pct = Math.round((left / POWER[k].dur) * 100);
    html += `<div class="pw" style="--c:${POWER[k].color}"><span>${POWER[k].icon}</span><b>${POWER[k].label}</b><i style="width:${pct}%"></i></div>`;
  }
  if (html !== powersHtml) {
    powersHtml = html;
    $('powers').innerHTML = html;
  }
}
// Hoch/Runter: man kann mitten in der Bewegung umschalten (hoch → sofort runter = abtauchen)
function setVertical(mode) {
  if (G.power.ride > 0) return;
  if (G.vMode === mode && G.vT < 0.5) return;
  G.vFrom = G.y;
  G.vMode = mode;
  G.vT = 0;
  if (G.run && G.mode === 'play') G.run[mode === 'up' ? 'jumps' : 'dives']++;
  (mode === 'up' ? sfx.up : sfx.down)();
}
function move(dir) {
  const n = Math.max(0, Math.min(2, G.lane + dir));
  if (n !== G.lane) {
    G.lane = n;
    sfx.swipe();
  }
}

function hitObstacle(a) {
  a.hit = true;
  G.danger += 0.5;
  G.slow = 1;
  G.shake = 1;
  sfx.hit();
  if (navigator.vibrate) navigator.vibrate(80);
  if (G.danger >= 1) caught();
}
// Erfahrung gutschreiben; bei jedem neuen Level gibt es die Belohnung aus dem Belohnungspfad
function unlockName(u) {
  if (u.type === 'skin') return `Skin „${DIVER_SKINS.find((x) => x.id === u.id).name}“`;
  if (u.type === 'tank') return `Rucksack „${TANKS.find((x) => x.id === u.id).name}“`;
  return `Hai „${SHARKS.find((x) => x.id === u.id).name}“`;
}
function grantUnlock(u) {
  const list = u.type === 'skin' ? profile.skins : u.type === 'tank' ? profile.tanks : profile.sharks;
  if (!list.includes(u.id)) list.push(u.id);
}
function addXp(n) {
  const before = levelOf(profile.xp).lvl;
  profile.xp += n;
  const after = levelOf(profile.xp).lvl;
  const ups = [];
  let coins = 0;
  const items = [];
  for (let l = before + 1; l <= after; l++) {
    const rw = Q.levelReward(l);
    ups.push(l);
    coins += rw.coins;
    if (rw.unlock) {
      grantUnlock(rw.unlock);
      items.push(unlockName(rw.unlock));
    }
  }
  bank += coins;
  store.set('shark-coins', bank);
  saveProfile();
  const text = ups.length ? `+${fmt(coins)} C${items.length ? ` · ${items.join(', ')} freigeschaltet!` : ''}` : '';
  return { ups, coins, items, text };
}
// Geheime Schatzkiste: Münzen oder ein seltener Skin
function openTreasure() {
  const lockedSkins = DIVER_SKINS.filter((sk) => sk.price && !profile.skins.includes(sk.id));
  let msg;
  if (lockedSkins.length && Math.random() < 0.08) {
    const sk = lockedSkins[0];
    profile.skins.push(sk.id);
    saveProfile();
    msg = `🧰 SCHATZ! Skin „${sk.name}“ freigeschaltet!`;
  } else {
    const amount = Math.random() < 0.15 ? 1500 + Math.floor(Math.random() * 16) * 100 : 300 + Math.floor(Math.random() * 8) * 100;
    bank += amount;
    store.set('shark-coins', bank);
    msg = `🧰 SCHATZ! +${amount.toLocaleString('de-DE')} Münzen`;
  }
  banner(msg);
}
let bannerTimer = 0;
function banner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('hidden');
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
}
function caught() {
  G.mode = 'caught';
  G.caughtT = 0;
  G.danger = 1;
  sfx.chomp();
  if (navigator.vibrate) navigator.vibrate([60, 40, 160]);
}
function finish() {
  G.mode = 'over';
  showOnly('over');
  const score = Math.floor(G.dist) + G.coins * 10;
  const isBest = score > best;
  if (isBest) {
    best = score;
    store.set('shark-best', best);
  }
  bank += G.coins;
  store.set('shark-coins', bank);
  // Aufgaben-Fortschritt + Erfahrung
  quests = Q.ensure(quests);
  const doneBefore = Q.claimable(quests);
  const r = G.run || {};
  Q.addRun(quests, { coins: G.coins, dist: Math.floor(G.dist), runs: 1, dodged: G.dodged, powers: r.powers || 0, dives: r.dives || 0, jumps: r.jumps || 0, rides: r.rides || 0, chests: r.chests || 0, runDist: Math.floor(G.dist), runCoins: G.coins });
  saveQuests();
  const newDone = Q.claimable(quests) - doneBefore;
  const xpGain = 1 + Math.floor(G.dist / 80) + Math.floor(G.coins / 15);
  const lv = addXp(xpGain);
  $('oXp').innerHTML =
    (lv.ups.length ? `<span class="newbest">LEVEL ${lv.ups[lv.ups.length - 1]}! ${lv.text}</span>` : `+${xpGain} XP · Level ${levelOf(profile.xp).lvl}`) +
    (newDone > 0 ? `<br><span class="newbest">📋 ${newDone} Aufgabe${newDone > 1 ? 'n' : ''} geschafft!</span>` : '');
  top = [...top, { score, dist: Math.floor(G.dist), coins: G.coins, day: today }].sort((a, b) => b.score - a.score).slice(0, 10);
  store.set('shark-top', top);
  syncOnline();
  $('oScore').textContent = score;
  $('oDist').textContent = Math.floor(G.dist);
  $('oCoins').textContent = G.coins;
  $('oBestRow').className = isBest ? 'row newbest' : 'row';
  $('oBestRow').innerHTML = isBest ? 'NEUER REKORD!' : `Rekord: <b>${best}</b>`;
  showOnly('over');
}

function updateFish(t, dt) {
  const v = G.mode === 'play' ? G.speed * 0.6 : 3;
  for (const sc of schools) {
    sc.x += sc.dir * dt * 1.2;
    sc.z += v * dt * 0.5;
    if (sc.z > -8 || Math.abs(sc.x) > 14) {
      sc.z = -40 - Math.random() * 12;
      sc.dir = Math.random() < 0.5 ? -1 : 1;
      sc.x = -sc.dir * (7 + Math.random() * 4);
      sc.y = 1.5 + Math.random() * 5;
    }
  }
  for (let i = 0; i < FISH; i++) {
    const f = fishData[i];
    const sc = schools[f.school];
    // Schwimmbewegung: leichtes Hin-und-her-Wedeln
    fishE.set(0, (sc.dir > 0 ? -Math.PI / 2 : Math.PI / 2) + Math.sin(t * 9 + f.ph) * 0.22, Math.sin(t * 2 + f.ph) * 0.08);
    fishQ.setFromEuler(fishE);
    fishP.set(sc.x + f.ox + Math.sin(t * 2 + f.ph) * 0.2, sc.y + f.oy + Math.sin(t * 3 + f.ph) * 0.1, sc.z + f.oz);
    fishM.compose(fishP, fishQ, fishS);
    fishes.setMatrixAt(i, fishM);
  }
  fishes.instanceMatrix.needsUpdate = true;
}
function update(dt) {
  const t = (G.t += dt);
  const playing = G.mode === 'play';
  // Tempo
  if (playing) {
    G.speed = Math.min(MAX_SPEED, START_SPEED + G.dist * 0.012);
    G.slow = Math.max(0, G.slow - dt * 1.2);
    // Hai fällt langsam zurück (fair: man kann sich erholen)
    // Start: Hai ist erst ganz nah (Schreckmoment), dann fällt er zurück
    G.danger = Math.max(G.power.ride > 0 ? 0 : 0.18, G.danger - dt * (G.power.ride > 0 ? 0.35 : t < 1.4 ? 0 : t < 3.2 ? 0.3 : 0.06));
  }
  const v = playing ? G.speed * (1 - 0.45 * G.slow) : G.mode === 'menu' ? 6 : 0;
  const dz = v * dt;
  if (playing) G.dist += dz;

  // Spieler: Bahn + Höhe
  // Bahnwechsel mit weicher Feder (kein Ruckeln, kein Überschwingen)
  const SPRING = 170;
  G.vx = (G.vx || 0) + (SPRING * (LANES[G.lane] - G.x) - 2 * Math.sqrt(SPRING) * G.vx) * dt;
  G.x += G.vx * dt;
  const prevY = G.y;
  // Delfin-Ritt: hoch über allen Hindernissen
  G.baseY += ((G.power.ride > 0 ? RIDE_Y : SWIM_Y) - G.baseY) * Math.min(1, dt * 4);
  if (G.vMode !== 'swim') {
    G.vT += dt;
    const dur = 0.85;
    const k = Math.min(1, G.vT / dur);
    const target = G.vMode === 'up' ? BOOST_Y : DIVE_Y;
    // erste Hälfte: vom Startpunkt zum Ziel (schnell), zweite Hälfte: zurück zur Schwimmhöhe
    G.y = k < 0.45 ? lerp(G.vFrom, target, Math.sin((k / 0.45) * Math.PI / 2)) : k < 0.6 ? target : lerp(target, G.baseY, smoothstep((k - 0.6) / 0.4));
    if (k >= 1) {
      G.vMode = 'swim';
      G.y = G.baseY;
    }
  } else G.y = G.baseY;
  G.vy = lerp(G.vy || 0, dt > 0 ? (G.y - prevY) / dt : 0, Math.min(1, dt * 10));
  updateFish(t, dt);
  if (G.mode === 'menu') {
    rideDolphin.visible = false;
    // Menü: Taucher schaut in die Kamera, Hai lauert dahinter
    // aufrecht, Bauch und Gesicht zur Kamera
    diver.rotation.order = 'YXZ';
    diver.position.set(1.0, 0.4 + Math.sin(t * 1.6) * 0.12, 0.2);
    diver.rotation.set(1.15, Math.PI + 0.35, 0.08);
    diver.userData.head.rotation.x = -0.95;
    diver.userData.arms[0].rotation.y = 0.9 + Math.sin(t * 3) * 0.2;
    diver.userData.arms[1].rotation.y = -0.6;
    const kk = Math.sin(t * 6);
    diver.userData.legs[0].rotation.x = kk * 0.4;
    diver.userData.legs[1].rotation.x = -kk * 0.4;
    const big = shark.userData.size - 1;
    shark.position.set(-1.3 - big * 2, 2.5 + big * 2 + Math.sin(t * 1.2) * 0.2, -4.6 - big * 14);
    shark.rotation.set(0.12, Math.PI - 0.38 + Math.sin(t * 0.8) * 0.06, 0);
    shark.userData.tail.rotation.y = Math.sin(t * 5) * 0.4;
    shark.userData.jaw.rotation.x = 0.35 + Math.sin(t * 2.2) * 0.25;
    if (friendShark) {
      friendShark.visible = true;
      const fx = Math.sin(t * 0.35);
      friendShark.position.set(2.6 + fx * 1.2, 2.4 + Math.sin(t * 1.1) * 0.15, -9);
      friendShark.rotation.set(0, Math.cos(t * 0.35) >= 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      friendShark.userData.tail.rotation.y = Math.sin(t * 5) * 0.4;
    }
    camera.position.set(0, 1.9 + Math.sin(t * 0.5) * 0.08, 6.2);
    camera.lookAt(-0.3, 1.9, 0);
    for (const d of decos) if (d.userData.weed) d.children.forEach((s) => (s.rotation.z = Math.sin(t * 2 + s.userData.sway) * 0.25));
    return;
  }
  G.camBlend = Math.min(1, (G.camBlend ?? 1) + dt * 1.6);
  if (friendShark) friendShark.visible = false;
  shark.rotation.x = 0;
  diver.rotation.order = 'XYZ';
  diver.userData.head.rotation.x = 0;
  diver.position.set(G.x, G.y + Math.sin(t * 3) * 0.06, 0);
  const riding = (G.power.ride > 0 || G.grace > 0) && G.mode === 'play';
  rideDolphin.visible = G.power.ride > 0;
  if (rideDolphin.visible) {
    rideDolphin.position.set(G.x, G.y - 0.75, 0.15);
    rideDolphin.rotation.set(Math.sin(t * 4) * 0.08, 0, -(LANES[G.lane] - G.x) * 0.25);
    rideDolphin.userData.tail.rotation.x = Math.sin(t * 9) * 0.5;
  }
  // Neigung aus der echten Bewegung: in die Kurve legen, Kopf hoch/runter beim Auf- und Abtauchen
  const roll = Math.max(-0.6, Math.min(0.6, -G.vx * 0.07));
  const pitch = Math.max(-0.6, Math.min(0.6, -G.vy * 0.09));
  const yaw = Math.max(-0.35, Math.min(0.35, -G.vx * 0.035));
  diver.rotation.set(lerp(diver.rotation.x, pitch, Math.min(1, dt * 12)), lerp(diver.rotation.y, yaw, Math.min(1, dt * 12)), lerp(diver.rotation.z, roll, Math.min(1, dt * 12)));
  const ud = diver.userData;
  // Beinschlag und Armzüge laufen über eine eigene Phase (ändert sich weich mit dem Tempo)
  G.swimPh = (G.swimPh || 0) + dt * (playing ? 7 + G.speed * 0.12 : 5);
  const kick = Math.sin(G.swimPh);
  ud.legs[0].rotation.x = kick * 0.45;
  ud.legs[1].rotation.x = -kick * 0.45;
  ud.arms[0].rotation.y = 0.2 + Math.sin(G.swimPh * 0.5) * 0.25;
  ud.arms[1].rotation.y = -0.2 - Math.sin(G.swimPh * 0.5) * 0.25;
  ud.body.rotation.z = Math.sin(G.swimPh * 0.5) * 0.06;
  ud.head.rotation.y = Math.sin(G.swimPh * 0.5 + 1) * 0.08;

  // Hai: Abstand je nach Gefahr, folgt der Bahn verzögert
  const sz = 11 - G.danger * 8.6 + (G.mode === 'caught' ? -1.2 * Math.min(1, G.caughtT * 3) : 0);
  shark.position.x += (G.x - shark.position.x) * Math.min(1, dt * 2.5);
  shark.position.y = 0.2 + Math.sin(t * 1.6) * 0.25 + (G.mode === 'caught' ? G.y * 0.5 : 0);
  shark.position.z = sz;
  shark.rotation.y = (G.x - shark.position.x) * -0.15;
  const su = shark.userData;
  su.tail.rotation.y = Math.sin(t * (6 + G.danger * 6)) * 0.45;
  su.body.rotation.y = Math.sin(t * (6 + G.danger * 6) - 1) * 0.06;
  const open = G.mode === 'caught' ? 0.9 : Math.max(0, (G.danger - 0.45) * 1.6) * (0.6 + 0.4 * Math.sin(t * 7));
  su.jaw.rotation.x = Math.min(0.9, open);

  // Welt bewegt sich auf die Kamera zu
  for (const d of decos) {
    d.position.z += dz;
    if (d.position.z > 12) {
      d.position.z -= 40 * 2.4;
      d.position.x = (d.position.x > 0 ? 1 : -1) * (3.8 + Math.random() * 4);
    }
    if (d.userData.weed) d.children.forEach((s) => (s.rotation.z = Math.sin(t * 2 + s.userData.sway) * 0.25));
  }
  sand.offset.y += (dz / 160) * 30;
  const bp = bubGeo.attributes.position.array;
  for (let i = 0; i < BUB; i++) {
    bp[i * 3 + 1] += dt * (0.8 + (i % 5) * 0.2);
    bp[i * 3 + 2] += dz;
    if (bp[i * 3 + 1] > 9 || bp[i * 3 + 2] > 10) {
      bp[i * 3] = (Math.random() - 0.5) * 16;
      bp[i * 3 + 1] = FLOOR_Y + Math.random();
      bp[i * 3 + 2] = -45 - Math.random() * 10;
    }
  }
  bubGeo.attributes.position.needsUpdate = true;
  rays.forEach((r, i) => (r.material.opacity = 0.06 + 0.04 * Math.sin(t * 0.7 + i)));

  if (playing) {
    // neue Reihen
    G.nextRow -= dz;
    if (G.nextRow <= 0) {
      spawnRow(-58);
      const level = Math.min(1, G.dist / 1500);
      G.nextRow = 22 - level * 7 + Math.random() * 6;
    }
    const py0 = G.y - HALF_H - FLOOR_Y;
    const py1 = G.y + HALF_H - FLOOR_Y;
    for (let i = G.active.length - 1; i >= 0; i--) {
      const a = G.active[i];
      a.z += dz;
      a.obj.position.z = a.z;
      if (a.obj.userData.float) a.obj.position.y = FLOOR_Y + Math.sin(t * 2 + a.z) * 0.15;
      if (a.obj.userData.blink) a.obj.userData.blink.visible = Math.sin(t * 8) > 0;
      // Treffer prüfen, wenn das Hindernis auf Höhe des Tauchers ist
      if (!a.hit && !riding && Math.abs(a.z) < 0.9 && Math.abs(LANES[a.lane] - G.x) < 1.0) {
        const [b0, b1] = VBAND[OBST[a.kind].v];
        if (py1 > b0 && py0 < b1) hitObstacle(a);
      }
      if (!a.passed && a.z > 1.5) {
        a.passed = true;
        if (!a.hit) G.dodged++;
      }
      if (a.z > 14) {
        a.obj.visible = false;
        G.active.splice(i, 1);
      }
    }
    for (let i = G.coinsOn.length - 1; i >= 0; i--) {
      const c = G.coinsOn[i];
      c.z += dz;
      c.obj.position.z = c.z;
      c.obj.rotation.y = Math.sin(t * 2 + c.z) * 0.6;
      // Magnet: Münzen in der Nähe fliegen zum Taucher
      if ((G.power.magnet > 0 || riding) && c.z > -16 && c.z < 2) c.pull = true;
      if (c.pull) {
        c.px = (c.px ?? c.obj.position.x) + (G.x - (c.px ?? c.obj.position.x)) * Math.min(1, dt * 9);
        c.py = (c.py ?? c.y) + (G.y - (c.py ?? c.y)) * Math.min(1, dt * 9);
        c.z += (0 - c.z) * Math.min(1, dt * 9);
        c.obj.position.set(c.px, c.py, c.z);
      }
      const near = c.pull ? Math.hypot(c.obj.position.x - G.x, c.obj.position.y - G.y, c.z) < 0.9 : Math.abs(c.z) < 0.8 && Math.abs(LANES[c.lane] - G.x) < 0.9 && Math.abs(c.y - G.y) < 1.2;
      if (near) {
        G.coins += G.power.pearl > 0 ? 2 : 1;
        sfx.coin();
        c.obj.visible = false;
        G.coinsOn.splice(i, 1);
        continue;
      }
      if (c.z > 12) {
        c.obj.visible = false;
        G.coinsOn.splice(i, 1);
      }
    }
    if (G.pickup) {
      const p = G.pickup;
      p.z += dz;
      p.obj.position.z = p.z;
      p.obj.position.y = SWIM_Y + 0.2 + Math.sin(t * 3) * 0.2;
      p.obj.rotation.y = t * 2;
      if (Math.abs(p.z) < 0.9 && Math.abs(LANES[p.lane] - G.x) < 1.0 && Math.abs(G.y - SWIM_Y) < 1.6) {
        if (p.kind === 'treasure') openTreasure();
        else {
          G.power[p.kind] = POWER[p.kind].dur;
          if (p.kind === 'ride') {
            G.vMode = 'swim';
            banner('🐬 DELFIN-RITT! Flieg über alles drüber!');
          }
        }
        G.run.powers++;
        if (p.kind === 'ride') G.run.rides++;
        if (p.kind === 'treasure') G.run.chests++;
        p.obj.visible = false;
        G.pickup = null;
        sfx.power();
      } else if (p.z > 12) {
        p.obj.visible = false;
        G.pickup = null;
      }
    }
    const rideBefore = G.power.ride;
    for (const k of Object.keys(G.power)) G.power[k] = Math.max(0, G.power[k] - dt);
    if (rideBefore > 0 && G.power.ride === 0) G.grace = 1.3; // sanft landen, ohne sofort zu crashen
    G.grace = Math.max(0, (G.grace || 0) - dt);
    renderPowers();
    // Herzschlag, wenn der Hai nah ist
    G.beatT -= dt;
    if (G.danger > 0.45 && G.beatT <= 0) {
      sfx.beat();
      G.beatT = 0.9 - G.danger * 0.5;
    }
    $('hDist').textContent = Math.floor(G.dist);
    $('hScore').textContent = Math.floor(G.dist) + G.coins * 10;
    $('hCoins').textContent = G.coins;
  }
  if (G.mode === 'caught') {
    G.caughtT += dt;
    G.shake = 1;
    if (G.caughtT > 1.1) {
      G.mode = 'over';
      finish();
    }
  }
  // Warn-Rand + Kamera
  G.shake = Math.max(0, G.shake - dt * 2.5);
  const warn = Math.max(0, (G.danger - 0.4) / 0.6);
  $('warn').style.boxShadow = `inset 0 0 ${80 + warn * 80}px ${warn * 50}px rgba(255,30,30,${(warn * 0.55).toFixed(2)})`;
  // Wackeln mit weichem Rauschen statt Zufall pro Bild
  const sh = G.shake * 0.25;
  const nx = Math.sin(t * 37) * 0.6 + Math.sin(t * 23 + 1) * 0.4;
  const ny = Math.sin(t * 31 + 2) * 0.6 + Math.sin(t * 19) * 0.4;
  const cb = smoothstep(G.camBlend ?? 1);
  const rideLift = (G.baseY - SWIM_Y) * 0.55;
  // Kamera folgt weich hinterher
  G.camX = lerp(G.camX ?? G.x, G.x, Math.min(1, dt * 5));
  G.camY = lerp(G.camY ?? 0, rideLift + (G.y - G.baseY) * 0.25, Math.min(1, dt * 4));
  camera.position.set(lerp(0, CAM.x + G.camX * 0.35, cb) + nx * sh * 0.5, lerp(1.9, CAM.y + G.camY, cb) + ny * sh * 0.5, lerp(6.2, CAM.z, cb));
  camera.lookAt(lerp(-0.3, G.camX * 0.3, cb), lerp(1.9, CAM.lookY + G.camY * 0.5, cb), lerp(0, CAM.lookZ, cb));
}

// --------------------------------------------------------------- Steuerung ---
let sx = 0;
let sy = 0;
let swiping = false;
canvas.addEventListener('pointerdown', (e) => {
  sx = e.clientX;
  sy = e.clientY;
  swiping = true;
});
const onUp = (e) => {
  if (!swiping) return;
  swiping = false;
  if (G.mode !== 'play') return;
  const dx = e.clientX - sx;
  const dy = e.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1);
  else setVertical(dy < 0 ? 'up' : 'down');
};
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', () => (swiping = false));
// schon während des Wischens reagieren (fühlt sich schneller an)
canvas.addEventListener('pointermove', (e) => {
  if (!swiping || G.mode !== 'play') return;
  const dx = e.clientX - sx;
  const dy = e.clientY - sy;
  if (Math.max(Math.abs(dx), Math.abs(dy)) >= 40) onUp(e);
});
window.addEventListener('keydown', (e) => {
  if (G.mode !== 'play') return;
  if (e.key === 'ArrowLeft') move(-1);
  if (e.key === 'ArrowRight') move(1);
  if (e.key === 'ArrowUp') setVertical('up');
  if (e.key === 'ArrowDown') setVertical('down');
});

// --------------------------------------------------------------------- UI ---
const $ = (id) => document.getElementById(id);
function showOnly(id) {
  for (const s of ['menu', 'hud', 'paused', 'over']) $(s).classList.toggle('hidden', s !== id && !(id === 'paused' && s === 'hud'));
}
function menu() {
  G.mode = 'menu';
  clearWorld();
  G.danger = 0.55;
  G.x = 0;
  updateMenu();
  showOnly('menu');
  if (Date.now() - lastRefresh > 60000) {
    lastRefresh = Date.now();
    refreshFriends();
  }
}
let lastRefresh = 0;
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n).toLocaleString('de-DE');
const PANELS = ['ranking', 'skins', 'sharks', 'locker', 'missions', 'wheel', 'friends', 'settings'];
function updateMenu() {
  $('mCoins').textContent = fmt(bank);
  quests = Q.ensure(quests);
  $('missionDot').classList.toggle('hidden', !Q.claimable(quests));
  $('wheelDot').classList.toggle('hidden', Date.now() - profile.wheelAt < WHEEL_COOLDOWN);
  $('musicBtn').textContent = settings.music ? 'AN' : 'AUS';
  $('sfxBtn').textContent = settings.sfx ? 'AN' : 'AUS';
  const lv = levelOf(profile.xp);
  $('mLevel').textContent = lv.lvl;
  $('mXp').style.width = `${(lv.rest / lv.need) * 100}%`;
  const f = profile.friends.find((x) => x.n === profile.showFriend);
  $('friendTag').classList.toggle('hidden', !f);
  if (f) $('friendTag').innerHTML = `🦈 ${esc(f.n)} · Rekord <b>${fmt(f.b)}</b>`;
  updateFriendShark();
}

// ---- Vorschaubilder (einmal mit einem kleinen Extra-Renderer gezeichnet) ----
const thumbs = {};
function makeThumbs() {
  if (thumbs.done) return;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(160, 160);
  r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xbfefff, 0x1a4b6b, 1.8));
  const l = new THREE.DirectionalLight(0xffffff, 1.6);
  l.position.set(4, 8, 6);
  sc.add(l);
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const shot = (obj, pos, look) => {
    sc.add(obj);
    cam.position.set(...pos);
    cam.lookAt(...look);
    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');
    sc.remove(obj);
    return url;
  };
  for (const sk of DIVER_SKINS) {
    const d = makeDiver(sk.id);
    d.rotation.order = 'YXZ';
    d.rotation.set(1.15, Math.PI + 0.5, 0.08);
    d.userData.head.rotation.x = -0.95;
    thumbs[`d-${sk.id}`] = shot(d, [0, 0.2, 4.2], [0, 0.15, 0]);
  }
  for (const tk of TANKS) {
    const d = makeDiver(profile.skin, tk.id);
    d.rotation.order = 'YXZ';
    d.rotation.set(1.15, 0.5, -0.08); // Rücken zur Kamera
    thumbs[`t-${tk.id}`] = shot(d, [0, 0.2, 4.2], [0, 0.15, 0]);
  }
  for (const sv of SHARKS) {
    const h = makeShark(sv.id);
    h.rotation.set(0.1, -Math.PI / 2 - 0.5, 0);
    h.userData.jaw.rotation.x = 0.5;
    thumbs[`s-${sv.id}`] = shot(h, [0, 1.2, 10], [0, 0, 0]);
  }
  r.dispose();
  r.forceContextLoss?.();
  thumbs.done = true;
}
const thumbImg = (key, locked) => `<img class="thumb${locked ? ' locked' : ''}" src="${thumbs[key]}" alt="">`;

function itemList(kind) {
  const list = kind === 'skins' ? DIVER_SKINS : SHARKS;
  const owned = kind === 'skins' ? profile.skins : profile.sharks;
  const cur = kind === 'skins' ? profile.skin : profile.shark;
  return list
    .map((it) => {
      const has = owned.includes(it.id);
      const on = cur === it.id;
      const btn = on ? '<em>✓</em>' : has ? `<button class="claim" data-pick="${it.id}">WÄHLEN</button>` : it.price ? `<button class="claim buy" data-buy="${it.id}" ${bank >= it.price ? '' : 'disabled'}>${fmt(it.price)} C</button>` : `<em class="lockinfo">${lockText(it)}</em>`;
      return `<div class="skin${on ? ' on' : ''}">${thumbImg(`${kind === 'skins' ? 'd' : 's'}-${it.id}`, !has)}<div>${it.name}<small>${on ? 'ausgewählt' : has ? 'freigeschaltet' : '🔒 gesperrt'}</small></div>${btn}</div>`;
    })
    .join('') + (kind === 'skins' ? tankList() : '');
}
const lockText = (it) => (it.level ? `🔒 Level ${it.level}` : it.event ? '🎄 Event' : `🔒 ${fmt(it.price)} C`);
function tankList() {
  return (
    '<p class="sub">🎒 RUCKSACK</p>' +
    TANKS.map((tk) => {
      const has = profile.tanks.includes(tk.id);
      const on = profile.tank === tk.id;
      const btn = on ? '<em>✓</em>' : has ? `<button class="claim" data-tank="${tk.id}">WÄHLEN</button>` : `<em class="lockinfo">${lockText(tk)}</em>`;
      return `<div class="skin${on ? ' on' : ''}">${thumbImg(`t-${tk.id}`, !has)}<div>${tk.name}<small>${on ? 'ausgewählt' : has ? 'freigeschaltet' : '🔒 gesperrt'}</small></div>${btn}</div>`;
    }).join('')
  );
}
function bindItems(kind) {
  const list = kind === 'skins' ? DIVER_SKINS : SHARKS;
  const owned = kind === 'skins' ? profile.skins : profile.sharks;
  const box = $(`${kind}List`);
  box.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
    const it = list.find((x) => x.id === b.dataset.buy);
    if (!it || owned.includes(it.id) || bank < it.price) return;
    bank -= it.price;
    store.set('shark-coins', bank);
    owned.push(it.id);
    pick(kind, it.id);
    sfx.power();
  }));
  box.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => pick(kind, b.dataset.pick)));
  box.querySelectorAll('[data-tank]').forEach((b) => b.addEventListener('click', () => {
    profile.tank = b.dataset.tank;
    setDiverSkin(profile.skin);
    saveProfile();
    openPanel('skins');
  }));
}
function pick(kind, id) {
  if (kind === 'skins') {
    profile.skin = id;
    setDiverSkin(id);
  } else {
    profile.shark = id;
    setSharkModel(id);
  }
  saveProfile();
  openPanel(kind);
  updateMenu();
}

// ---- Glücksrad ----
const WHEEL_COOLDOWN = 24 * 3600 * 1000;
const WHEEL = [100, 500, 150, 1000, 200, 300, 250, 750];
const WHEEL_W = [24, 9, 20, 3, 16, 10, 12, 6];
const WHEEL_COL = ['#3fb6ff', '#ff9800', '#7ddc4a', '#e5383b', '#b06bff', '#ffd23f', '#2ec4f0', '#ff6b8b'];
let wheelAngle = 0;
let spinning = false;
function drawWheel() {
  const c = $('wheelCanvas');
  const g = c.getContext('2d');
  const R = c.width / 2;
  g.clearRect(0, 0, c.width, c.height);
  const seg = (Math.PI * 2) / WHEEL.length;
  WHEEL.forEach((v, i) => {
    g.beginPath();
    g.moveTo(R, R);
    g.arc(R, R, R - 6, i * seg - Math.PI / 2 - seg / 2, (i + 1) * seg - Math.PI / 2 - seg / 2);
    g.closePath();
    g.fillStyle = WHEEL_COL[i];
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#0b2233';
    g.stroke();
    g.save();
    g.translate(R, R);
    g.rotate(i * seg);
    g.font = '26px "Lilita One", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 5;
    g.strokeText(v, 0, -R * 0.62);
    g.fillStyle = '#fff';
    g.fillText(v, 0, -R * 0.62);
    g.restore();
  });
  g.beginPath();
  g.arc(R, R, R - 4, 0, Math.PI * 2);
  g.lineWidth = 8;
  g.stroke();
}
function wheelInfo() {
  const left = WHEEL_COOLDOWN - (Date.now() - profile.wheelAt);
  const btn = $('spinBtn');
  if (spinning) return;
  if (left > 0) {
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    btn.disabled = true;
    btn.textContent = `WIEDER IN ${h} STD ${m} MIN`;
  } else {
    btn.disabled = false;
    btn.textContent = 'DREHEN!';
  }
}
$('spinBtn').addEventListener('click', () => {
  if (spinning || Date.now() - profile.wheelAt < WHEEL_COOLDOWN) return;
  let r = Math.random() * WHEEL_W.reduce((a, b) => a + b, 0);
  let idx = 0;
  while ((r -= WHEEL_W[idx]) > 0) idx++;
  spinning = true;
  profile.wheelAt = Date.now();
  saveProfile();
  const seg = 360 / WHEEL.length;
  wheelAngle += 360 * 5 + ((360 - idx * seg - (wheelAngle % 360)) % 360 + 360) % 360;
  $('wheelCanvas').style.transform = `rotate(${wheelAngle}deg)`;
  $('spinBtn').disabled = true;
  $('spinBtn').textContent = '...';
  $('wheelWin').textContent = '';
  const tick = setInterval(() => tone(900, 700, 0.03, 'square', 0.03), 120);
  setTimeout(() => {
    clearInterval(tick);
    spinning = false;
    bank += WHEEL[idx];
    store.set('shark-coins', bank);
    $('wheelWin').textContent = `GEWONNEN: +${WHEEL[idx]} MÜNZEN!`;
    sfx.power();
    wheelInfo();
    updateMenu();
  }, 4200);
});

// ---- Freunde (online über Supabase + weiterhin per Link) ----
function myCode() {
  const data = { i: profile.id, n: profile.name || 'Taucher', b: best, s: profile.skin, h: profile.shark, l: levelOf(profile.xp).lvl };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}
function shareLink() {
  return `${location.origin}${location.pathname}#f=${myCode()}`;
}
// Spieler aus der Datenbank / aus einem Link → Freund-Eintrag (alles geprüft, weil es von außen kommt)
function toFriend(d) {
  return {
    i: isId(d.i ?? d.id) ? d.i ?? d.id : undefined,
    n: String(d.n ?? d.name ?? '').slice(0, 16),
    b: Math.max(0, Math.floor(Number(d.b ?? d.best) || 0)),
    s: DIVER_SKINS.some((x) => x.id === (d.s ?? d.skin)) ? d.s ?? d.skin : 'standard',
    h: SHARKS.some((x) => x.id === (d.h ?? d.shark)) ? d.h ?? d.shark : 'white',
    l: Math.max(1, Math.floor(Number(d.l ?? d.level) || 1)),
  };
}
function readFriendFromHash() {
  const m = location.hash.match(/f=([A-Za-z0-9+/=]+)/);
  if (!m) return null;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if (!d || typeof d.n !== 'string' || (d.i && d.i === profile.id)) return null;
    return toFriend(d);
  } catch {
    return null;
  }
}
function addFriend(f) {
  const i = profile.friends.findIndex((x) => (f.i && x.i === f.i) || x.n === f.n);
  if (i >= 0) profile.friends[i] = f;
  else profile.friends.push(f);
  if (!profile.showFriend) profile.showFriend = f.n;
  saveProfile();
}
// Eigenen Eintrag online speichern (nur mit Namen). Ergebnis: 'ok' | 'taken' | 'offline' | ...
let lastSync = '';
async function syncOnline() {
  if (!profile.name || !NAME_RE.test(profile.name)) return 'noname';
  try {
    lastSync = await savePlayer({ id: profile.id, secret: profile.secret, name: profile.name, best, skin: SERVER_SKINS.includes(profile.skin) ? profile.skin : 'standard', shark: SERVER_SHARKS.includes(profile.shark) ? profile.shark : 'white', level: levelOf(profile.xp).lvl });
  } catch {
    lastSync = 'offline';
  }
  return lastSync;
}
// Rekorde/Skins der Freunde vom Server holen
async function refreshFriends() {
  const ids = profile.friends.map((f) => f.i).filter(Boolean);
  if (!ids.length) return;
  try {
    const rows = await getPlayers(ids);
    for (const r of rows) {
      const f = profile.friends.find((x) => x.i === r.id);
      if (!f) continue;
      if (profile.showFriend === f.n) profile.showFriend = r.name;
      Object.assign(f, toFriend(r));
    }
    saveProfile();
    if (!$('p-friends').classList.contains('hidden')) renderFriends();
    updateMenu();
  } catch {
    /* offline – alte Werte bleiben */
  }
}
let friendShark = null;
let friendSharkId = '';
function updateFriendShark() {
  const f = profile.friends.find((x) => x.n === profile.showFriend);
  const id = f ? f.h : '';
  if (id === friendSharkId) return;
  if (friendShark) scene.remove(friendShark);
  friendShark = null;
  friendSharkId = id;
  if (!id) return;
  friendShark = makeShark(id);
  friendShark.scale.setScalar(friendShark.userData.size);
  scene.add(friendShark);
}
const friendRow = (f, btn, on) => {
  const sk = DIVER_SKINS.find((x) => x.id === f.s);
  const sv = SHARKS.find((x) => x.id === f.h);
  return `<div class="skin${on ? ' on' : ''}">${thumbImg(`s-${f.h}`)}<div>${esc(f.n)} <small>Level ${f.l} · Rekord ${fmt(f.b)}<br>Skin: ${sk.name} · ${sv.name}</small></div>${btn}</div>`;
};
let found = [];
let searchSeq = 0;
function renderFriends() {
  const q = $('friendSearch').value.trim().toLowerCase();
  const list = profile.friends.filter((f) => f.n.toLowerCase().includes(q)).sort((a, b) => b.b - a.b);
  let html = list.length
    ? list.map((f) => friendRow(f, `<button class="claim" data-show="${esc(f.n)}">${profile.showFriend === f.n ? 'IM MENÜ ✓' : 'ZEIGEN'}</button>`, profile.showFriend === f.n)).join('')
    : q
      ? ''
      : '<p class="hint">Noch keine Freunde. Such oben nach einem Namen oder teile deinen Link.</p>';
  const extra = found.filter((p) => p.i !== profile.id && !profile.friends.some((f) => f.i === p.i));
  if (q.length >= 2) {
    html += `<p class="sub">🌍 ONLINE GEFUNDEN</p>`;
    html += extra.length ? extra.map((p, k) => friendRow(p, `<button class="claim buy" data-add="${k}">+ ADD</button>`)).join('') : `<p class="hint">${found.searching ? 'Suche…' : found.offline ? 'Keine Verbindung zum Server.' : 'Niemand gefunden.'}</p>`;
  }
  $('friendList').innerHTML = html;
  $('friendList').querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => {
    profile.showFriend = profile.showFriend === b.dataset.show ? '' : b.dataset.show;
    saveProfile();
    renderFriends();
    updateMenu();
  }));
  $('friendList').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    const p = extra[Number(b.dataset.add)];
    if (!p) return;
    addFriend(p);
    sfx.power();
    renderFriends();
    updateMenu();
  }));
}
let searchTimer = 0;
$('friendSearch').addEventListener('input', () => {
  const q = $('friendSearch').value.trim();
  clearTimeout(searchTimer);
  found = [];
  if (q.length >= 2) {
    found.searching = true;
    const seq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      let res = [];
      let offline = false;
      try {
        res = (await searchPlayers(q)).map(toFriend);
      } catch {
        offline = true;
      }
      if (seq !== searchSeq) return;
      found = res;
      found.offline = offline;
      renderFriends();
    }, 350);
  }
  renderFriends();
});
async function saveName() {
  const name = $('nameInput').value.trim().slice(0, 16);
  if (!name) return false;
  if (!NAME_RE.test(name)) {
    $('shareMsg').textContent = 'Nur Buchstaben, Zahlen, Leerzeichen, - _ . (2–16 Zeichen)';
    return false;
  }
  const old = profile.name;
  profile.name = name;
  $('shareMsg').textContent = 'Speichere…';
  const r = await syncOnline();
  if (r === 'taken') {
    profile.name = old;
    $('shareMsg').textContent = `„${name}“ ist schon vergeben – nimm einen anderen Namen.`;
    saveProfile();
    return false;
  }
  saveProfile();
  $('shareMsg').textContent = r === 'ok' ? '✓ Online gespeichert – andere können dich jetzt finden!' : 'Gespeichert (gerade offline – wird später hochgeladen).';
  return true;
}
$('nameInput').addEventListener('change', saveName);
$('shareBtn').addEventListener('click', async () => {
  if (!$('nameInput').value.trim()) {
    $('nameInput').focus();
    $('shareMsg').textContent = 'Gib zuerst deinen Namen ein.';
    return;
  }
  if ($('nameInput').value.trim() !== profile.name && !(await saveName())) return;
  const url = shareLink();
  try {
    if (navigator.share) await navigator.share({ title: 'SHARK ATTACK', text: `Schaffst du meinen Rekord von ${fmt(best)}? 🦈 Such mich unter „${profile.name}“!`, url });
    else {
      await navigator.clipboard.writeText(url);
      $('shareMsg').textContent = 'Link kopiert!';
    }
  } catch {
    /* abgebrochen */
  }
});
$('addFriendYes').addEventListener('click', () => {
  if (pendingFriend) addFriend(pendingFriend);
  pendingFriend = null;
  $('p-addfriend').classList.add('hidden');
  updateMenu();
  openPanel('friends');
});
$('addFriendNo').addEventListener('click', () => {
  pendingFriend = null;
  $('p-addfriend').classList.add('hidden');
});
let pendingFriend = readFriendFromHash();
if (pendingFriend) {
  history.replaceState(null, '', location.pathname + location.search);
  $('addFriendText').innerHTML = `<b>${esc(pendingFriend.n)}</b> (Level ${pendingFriend.l}, Rekord ${fmt(pendingFriend.b)}) als Freund hinzufügen?`;
  $('p-addfriend').classList.remove('hidden');
}

// ---- Spind ----
function renderLocker() {
  const lv = levelOf(profile.xp);
  const all = [
    ...DIVER_SKINS.map((x) => ({ ...x, key: `d-${x.id}`, has: profile.skins.includes(x.id) })),
    ...TANKS.filter((x) => x.level).map((x) => ({ ...x, key: `t-${x.id}`, has: profile.tanks.includes(x.id) })),
    ...SHARKS.map((x) => ({ ...x, key: `s-${x.id}`, has: profile.sharks.includes(x.id) })),
  ];
  $('lockerTop').innerHTML = `<div class="lvl">LEVEL <b>${lv.lvl}</b>${lv.max ? ' 👑' : ''}</div><div class="bar"><i style="width:${(lv.rest / lv.need) * 100}%"></i></div><small>${lv.max ? 'Maximales Level erreicht!' : `${fmt(lv.rest)} / ${fmt(lv.need)} XP bis Level ${lv.lvl + 1}`} · ${all.filter((x) => x.has).length}/${all.length} freigeschaltet</small>`;
  $('lockerGrid').innerHTML = all.map((x) => `<div class="locker${x.has ? '' : ' off'}">${thumbImg(x.key, !x.has)}<small>${x.name}</small><em>${x.has ? '✓' : lockText(x)}</em></div>`).join('');
  // Belohnungspfad: die nächsten Level + alle großen Meilensteine
  const shown = new Set();
  for (let l = Math.max(2, lv.lvl - 1); l <= Math.min(Q.MAX_LEVEL, lv.lvl + 8); l++) shown.add(l);
  for (const l of Object.keys(Q.LEVEL_UNLOCKS)) shown.add(Number(l));
  $('rewardPath').innerHTML = [...shown]
    .sort((a, b) => a - b)
    .map((l) => {
      const rw = Q.levelReward(l);
      const got = lv.lvl >= l;
      const u = rw.unlock;
      const img = u ? thumbImg(`${u.type === 'skin' ? 'd' : u.type === 'tank' ? 't' : 's'}-${u.id}`, !got) : '<span class="lvcoin">C</span>';
      return `<div class="path${got ? ' got' : ''}${u ? ' big' : ''}${l === lv.lvl + 1 ? ' next' : ''}"><b>Lv ${l}</b>${img}<div>+${fmt(rw.coins)} C${u ? `<small>${unlockName(u)}</small>` : ''}</div><em>${got ? '✓' : '🔒'}</em></div>`;
    })
    .join('');
}

// ---- Rangliste: eigene Läufe oder weltweit ----
let rankTab = 'world';
let worldSeq = 0;
async function renderRanking() {
  document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === rankTab));
  if (rankTab === 'me') {
    $('rankList').innerHTML = top.length
      ? top.map((r, i) => `<div class="rank${i === 0 ? ' gold' : ''}"><span>${i + 1}.</span><b>${r.score}</b><small>${r.dist} m · ${r.coins} C</small></div>`).join('')
      : '<p class="hint">Noch keine Läufe – schwimm los!</p>';
    return;
  }
  const seq = ++worldSeq;
  $('rankList').innerHTML = '<p class="hint">Lade Weltrangliste…</p>';
  try {
    const rows = (await topPlayers(50)).map(toFriend);
    if (seq !== worldSeq || rankTab !== 'world') return;
    const friendIds = new Set(profile.friends.map((f) => f.i));
    $('rankList').innerHTML =
      (rows.length
        ? rows.map((r, i) => `<div class="rank${i === 0 ? ' gold' : ''}${r.i === profile.id ? ' me' : ''}"><span>${i + 1}.</span><b>${fmt(r.b)}</b><small>${esc(r.n)}${r.i === profile.id ? ' (du)' : friendIds.has(r.i) ? ' 👥' : ''} · Lv ${r.l}</small></div>`).join('')
        : '<p class="hint">Noch niemand online – sei der Erste!</p>') + (profile.name ? '' : '<p class="hint">Gib unter FREUNDE deinen Namen ein, dann erscheinst du hier auch.</p>');
  } catch {
    if (seq === worldSeq) $('rankList').innerHTML = '<p class="hint">Keine Verbindung zum Server. Versuch es gleich nochmal.</p>';
  }
}
document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
  rankTab = b.dataset.tab;
  renderRanking();
}));
// ---- Aufgaben: täglich, wöchentlich, 14-Tage-Event, Dauer ----
let questTab = 'day';
function timeLeft(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return d ? `${d} T ${h} Std` : h ? `${h} Std ${m} Min` : `${m} Min`;
}
function renderQuests() {
  quests = Q.ensure(quests);
  saveQuests();
  document.querySelectorAll('[data-qtab]').forEach((b) => {
    b.classList.toggle('on', b.dataset.qtab === questTab);
    const sc = b.dataset.qtab;
    const n = quests[sc].tasks.filter((t) => !t.claimed && Q.isDone(quests, sc, t)).length;
    b.querySelector('i')?.classList.toggle('hidden', !n);
  });
  const sc = questTab;
  let head = '';
  if (sc === 'day') head = `<p class="hint">Neue Aufgaben in ${timeLeft(Q.msUntil('day'))}</p>`;
  if (sc === 'week') head = `<p class="hint">Neue Wochenaufgaben in ${timeLeft(Q.msUntil('week'))}</p>`;
  if (sc === 'endless') head = '<p class="hint">Immer 3 Aufgaben. Geschafft = sofort eine neue, etwas schwerere.</p>';
  if (sc === 'event') {
    const has = profile.skins.includes('santa');
    head = `<div class="event">${thumbImg('d-santa', !has)}<div><b>🎄 WEIHNACHTS-EVENT</b><small>Schaffe alle 5 Aufgaben in 14 Tagen und hol dir den Weihnachtsmann-Skin!${has ? ' (Hast du schon – diesmal gibt es 10.000 C + 150 XP.)' : ''}</small><small>Endet in ${timeLeft(Q.msUntil('event'))} · ${quests.event.tasks.filter((t) => t.claimed).length}/5 geschafft</small></div></div>`;
  }
  const rows = quests[sc].tasks
    .map((t, i) => {
      const v = Math.min(t.goal, Q.value(quests, sc, t));
      const done = v >= t.goal;
      return `<div class="mission"><div>${Q.taskText(t)}<div class="bar"><i style="width:${(v / t.goal) * 100}%"></i></div><small>${fmt(v)} / ${fmt(t.goal)} · Belohnung: ${t.xp} XP + ${fmt(t.coins)} C</small></div>${t.claimed ? '<em>✓</em>' : `<button class="claim" data-q="${i}" ${done ? '' : 'disabled'}>HOLEN</button>`}</div>`;
    })
    .join('');
  const final = sc === 'event' && quests.event.final ? '<p class="row newbest" style="text-align:center">🎅 Event geschafft!</p>' : '';
  $('missionList').innerHTML = head + rows + final;
  $('missionList').querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
    const rw = Q.claim(quests, sc, Number(b.dataset.q));
    if (!rw) return;
    bank += rw.coins;
    store.set('shark-coins', bank);
    let msg = `+${rw.xp} XP · +${fmt(rw.coins)} C`;
    if (sc === 'event' && Q.eventComplete(quests) && !quests.event.final) {
      quests.event.final = true;
      if (!profile.skins.includes('santa')) {
        profile.skins.push('santa');
        msg = '🎅 WEIHNACHTSMANN-SKIN freigeschaltet!';
      } else {
        bank += 10000;
        rw.xp += 150;
        msg = '🎄 Event geschafft: +10.000 C + 150 XP';
      }
    }
    saveQuests();
    const lv = addXp(rw.xp);
    if (lv.ups.length) msg += ` · ⭐ LEVEL ${lv.ups[lv.ups.length - 1]}! ${lv.text}`;
    banner(msg);
    sfx.power();
    renderQuests();
    updateMenu();
  }));
}
document.querySelectorAll('[data-qtab]').forEach((b) => b.addEventListener('click', () => {
  questTab = b.dataset.qtab;
  renderQuests();
}));
function openPanel(id) {
  makeThumbs();
  if (id === 'ranking') renderRanking();
  if (id === 'missions') renderQuests();
  if (id === 'skins' || id === 'sharks') {
    $(`${id}Coins`).textContent = fmt(bank);
    $(`${id}List`).innerHTML = itemList(id);
    bindItems(id);
  }
  if (id === 'wheel') {
    drawWheel();
    wheelInfo();
  }
  if (id === 'friends') {
    $('nameInput').value = profile.name;
    $('shareMsg').textContent = profile.name ? (lastSync === 'ok' ? '✓ Online – andere können dich finden.' : '') : 'Gib einen Namen ein, damit Freunde dich finden.';
    renderFriends();
    refreshFriends();
  }
  if (id === 'locker') renderLocker();
  for (const p of PANELS) $(`p-${p}`).classList.toggle('hidden', p !== id);
}
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
  audio();
  openPanel(b.dataset.open);
}));
document.querySelectorAll('.close').forEach((b) => b.addEventListener('click', () => {
  for (const p of PANELS) $(`p-${p}`).classList.add('hidden');
  updateMenu();
}));
setInterval(() => !$('p-wheel').classList.contains('hidden') && wheelInfo(), 20000);
$('musicBtn').addEventListener('click', () => {
  settings.music = !settings.music;
  store.set('shark-settings', settings);
  if (settings.music) startMusic();
  else stopMusic();
  updateMenu();
});
$('sfxBtn').addEventListener('click', () => {
  settings.sfx = !settings.sfx;
  store.set('shark-settings', settings);
  updateMenu();
});
$('play').addEventListener('click', startRun);
$('again').addEventListener('click', startRun);
$('toMenu').addEventListener('click', menu);
$('pause').addEventListener('click', () => {
  if (G.mode !== 'play') return;
  G.mode = 'paused';
  showOnly('paused');
});
$('resume').addEventListener('click', () => {
  G.mode = 'play';
  showOnly('hud');
});
$('quit').addEventListener('click', menu);
document.addEventListener('visibilitychange', () => {
  // im Hintergrund keine Musik
  if (ac) document.hidden ? ac.suspend() : ac.resume();
  if (document.hidden && G.mode === 'play') {
    G.mode = 'paused';
    showOnly('paused');
  }
});

// ------------------------------------------------------------------- Loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame); // zuerst: die Schleife läuft immer weiter, auch wenn etwas schiefgeht
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (G.mode !== 'paused') update(dt);
  } catch (e) {
    console.warn(e);
    // Notbremse: nie im „gefressen“-Zustand hängen bleiben
    if (G.mode === 'caught' || G.mode === 'play') {
      try {
        finish();
      } catch {
        G.mode = 'over';
        showOnly('over');
      }
    }
  }
  // Wächter: wenn „gefressen“ zu lange dauert, Game Over erzwingen
  if (G.mode === 'caught' && G.caughtT > 2) finish();
  renderer.render(scene, camera);
}
menu();
syncOnline(); // Rekord hochladen, falls zwischendurch offline gespielt
requestAnimationFrame(frame);
document.fonts?.load('80px "Lilita One"').then(drawCoinFace).catch(() => {});
window.addEventListener('pointerdown', () => startMusic(), { once: true });

// zum Testen
window.__shark = { G, coinPool, addXp, Q, get quests() { return quests; }, move, setVertical, startRun, openPanel, profile, addFriend, shareLink, get bank() { return bank; }, set bank(v) { bank = v; } };
