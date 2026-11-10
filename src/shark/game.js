// SHARK ATTACK – 3D-Endlos-Läufer unter Wasser (Three.js, läuft im Browser auf dem iPhone)
// Erste spielbare Version: 3 Bahnen, Wischen, Hai-Verfolgung, Hindernisse, Münzen, Game Over, Menü.
import * as THREE from 'three';

// ------------------------------------------------------------ Einstellungen ---
const LANES = [-2.2, 0, 2.2];
const FLOOR_Y = -1.6;
const SWIM_Y = 0.6;
const BOOST_Y = 2.8;
const DIVE_Y = -0.75;
const START_SPEED = 13;
const MAX_SPEED = 32;
const CAM = { x: 0, y: 4.6, z: 6.8, lookY: 0, lookZ: -7 };

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
function makeDiver() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SUIT = 0x1d2f6b;
  const YEL = 0xffd23f;
  const SKIN = 0xf2c29b;
  // Körper liegt waagerecht (schwimmt nach vorne = -z)
  const torso = part(new THREE.CapsuleGeometry(0.34, 0.75, 6, 12), SUIT);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  const stripe = part(new THREE.CapsuleGeometry(0.35, 0.2, 4, 12), YEL, { outline: false });
  stripe.rotation.x = Math.PI / 2;
  stripe.position.z = 0.2;
  body.add(stripe);
  // Flaschen auf dem Rücken
  for (const sx of [-0.15, 0.15]) {
    const tank = part(new THREE.CapsuleGeometry(0.13, 0.6, 4, 10), YEL);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(sx, 0.36, 0.05);
    body.add(tank);
  }
  // Kopf mit Haaren und Taucherbrille
  const head = new THREE.Group();
  head.position.set(0, 0.12, -0.78);
  body.add(head);
  head.add(part(new THREE.SphereGeometry(0.3, 16, 12), SKIN));
  for (let i = 0; i < 7; i++) {
    const spike = part(new THREE.ConeGeometry(0.11, 0.32, 6), 0x7a3f1d, { w: 0.08 });
    spike.position.set(-0.18 + (i % 4) * 0.12, 0.22 + (i > 3 ? 0.04 : 0), 0.05 + (i > 3 ? 0.12 : 0));
    spike.rotation.set(-0.9 + Math.random() * 0.3, 0, -0.5 + (i % 4) * 0.33);
    head.add(spike);
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
function makeShark() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const TOP = 0x3d6f9e;
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
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), toon(0x4a2a12));
    pupil.position.set(sx * 0.06, 0, -0.14);
    eye.add(pupil);
    const brow = part(new THREE.BoxGeometry(0.5, 0.1, 0.12), 0x24476b);
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
    const gill = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.45, 0.06), toon(0x24476b));
    gill.position.set(sx * 1.1, 0.0, -1.1 + i * 0.22);
    body.add(gill);
  }
  root.userData = { body, tail, jaw };
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
      beam.position.y = 1.15;
      beam.rotation.z = 0.08;
      g.add(beam);
      for (const x of [-1.1, 1.1]) {
        const p = part(new THREE.BoxGeometry(0.3, 4.2, 0.3), 0x5a3a1e, { w: 0.05 });
        p.position.set(x, 1.6, 0);
        p.rotation.z = x * 0.04;
        g.add(p);
      }
      const plank = part(new THREE.BoxGeometry(2.4, 2.2, 0.15), 0x7a4b2a, { w: 0.03 });
      plank.position.y = 2.6;
      g.add(plank);
      return g;
    },
  },
};
// vertikale Bereiche (Unterkante, Oberkante) relativ zum Boden
const VBAND = { full: [0, 9], low: [0, 2.9], high: [1.0, 9] };

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
const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20);
const coinPool = [];
for (let i = 0; i < 40; i++) {
  const c = part(coinGeo, 0xffd23f, { w: 0.1 });
  c.rotation.x = Math.PI / 2;
  const holder = new THREE.Group();
  holder.add(c);
  holder.visible = false;
  scene.add(holder);
  coinPool.push(holder);
}

// --------------------------------------------------------------- Figuren ---
const diver = makeDiver();
diver.scale.setScalar(1.35);
scene.add(diver);
const shark = makeShark();
shark.scale.setScalar(1.15);
scene.add(shark);

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
const sfx = {
  coin: () => tone(1100, 1700, 0.1, 'triangle', 0.08),
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
};

function clearWorld() {
  for (const a of G.active) a.obj.visible = false;
  for (const c of G.coinsOn) c.obj.visible = false;
  G.active.length = 0;
  G.coinsOn.length = 0;
}
function startRun() {
  audio();
  clearWorld();
  Object.assign(G, { mode: 'play', t: 0, speed: START_SPEED, dist: 0, coins: 0, danger: 0.85, slow: 0, shake: 0, nextRow: 26, lane: 1, x: 0, y: SWIM_Y, vMode: 'swim', vT: 0, caughtT: 0, dodged: 0 });
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
    for (let i = 0; i < 5; i++) placeCoin(arcOver.lane, z + 4 - i * 2, SWIM_Y + Math.sin((i / 4) * Math.PI) * 2.4);
  } else {
    for (let i = 0; i < 5; i++) placeCoin(free, z + 6 - i * 2.2, SWIM_Y);
  }
}
function placeCoin(lane, z, y) {
  const obj = coinPool.find((c) => !c.visible);
  if (!obj) return;
  obj.visible = true;
  obj.position.set(LANES[lane], y, z);
  G.coinsOn.push({ obj, lane, y, z });
}

function setVertical(mode) {
  if (G.vMode !== 'swim') return;
  G.vMode = mode;
  G.vT = 0;
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
function caught() {
  G.mode = 'caught';
  G.caughtT = 0;
  G.danger = 1;
  sfx.chomp();
  if (navigator.vibrate) navigator.vibrate([60, 40, 160]);
}
function finish() {
  G.mode = 'over';
  const score = Math.floor(G.dist) + G.coins * 10;
  const isBest = score > best;
  if (isBest) {
    best = score;
    store.set('shark-best', best);
  }
  bank += G.coins;
  store.set('shark-coins', bank);
  $('oScore').textContent = score;
  $('oDist').textContent = Math.floor(G.dist);
  $('oCoins').textContent = G.coins;
  $('oBest').textContent = best;
  $('oBestRow').className = isBest ? 'row newbest' : 'row';
  $('oBestRow').innerHTML = isBest ? 'NEUER REKORD!' : `Rekord: <b>${best}</b>`;
  showOnly('over');
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
    G.danger = Math.max(0.18, G.danger - dt * (t < 1.4 ? 0 : t < 3.2 ? 0.3 : 0.06));
  }
  const v = playing ? G.speed * (1 - 0.45 * G.slow) : G.mode === 'menu' ? 6 : 0;
  const dz = v * dt;
  if (playing) G.dist += dz;

  // Spieler: Bahn + Höhe
  G.x += (LANES[G.lane] - G.x) * Math.min(1, dt * 12);
  if (G.vMode !== 'swim') {
    G.vT += dt;
    const dur = 0.85;
    const k = Math.min(1, G.vT / dur);
    const target = G.vMode === 'up' ? BOOST_Y : DIVE_Y;
    G.y = SWIM_Y + (target - SWIM_Y) * Math.sin(k * Math.PI);
    if (k >= 1) {
      G.vMode = 'swim';
      G.y = SWIM_Y;
    }
  }
  diver.position.set(G.x, G.y + Math.sin(t * 3) * 0.06, 0);
  const tilt = (LANES[G.lane] - G.x) * 0.25;
  diver.rotation.set(G.vMode === 'up' ? -0.5 * Math.sin(Math.min(1, G.vT / 0.85) * Math.PI) : G.vMode === 'down' ? 0.5 * Math.sin(Math.min(1, G.vT / 0.85) * Math.PI) : 0, 0, -tilt);
  const ud = diver.userData;
  const kick = Math.sin(t * (playing ? 10 : 6));
  ud.legs[0].rotation.x = kick * 0.45;
  ud.legs[1].rotation.x = -kick * 0.45;
  ud.arms[0].rotation.y = 0.2 + Math.sin(t * 5) * 0.25;
  ud.arms[1].rotation.y = -0.2 - Math.sin(t * 5) * 0.25;

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
    const py0 = G.y - 0.55 - FLOOR_Y;
    const py1 = G.y + 0.55 - FLOOR_Y;
    for (let i = G.active.length - 1; i >= 0; i--) {
      const a = G.active[i];
      a.z += dz;
      a.obj.position.z = a.z;
      if (a.obj.userData.float) a.obj.position.y = FLOOR_Y + Math.sin(t * 2 + a.z) * 0.15;
      if (a.obj.userData.blink) a.obj.userData.blink.visible = Math.sin(t * 8) > 0;
      // Treffer prüfen, wenn das Hindernis auf Höhe des Tauchers ist
      if (!a.hit && Math.abs(a.z) < 0.9 && Math.abs(LANES[a.lane] - G.x) < 1.0) {
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
      if (Math.abs(c.z) < 0.8 && Math.abs(LANES[c.lane] - G.x) < 0.9 && Math.abs(c.y - G.y) < 1.2) {
        G.coins++;
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
    if (G.caughtT > 1.1) finish();
  }
  // Warn-Rand + Kamera
  G.shake = Math.max(0, G.shake - dt * 2.5);
  const warn = Math.max(0, (G.danger - 0.4) / 0.6);
  $('warn').style.boxShadow = `inset 0 0 ${80 + warn * 80}px ${warn * 50}px rgba(255,30,30,${(warn * 0.55).toFixed(2)})`;
  const sh = G.shake * 0.25;
  camera.position.set(CAM.x + G.x * 0.35 + (Math.random() - 0.5) * sh, CAM.y + (Math.random() - 0.5) * sh + (G.mode === 'menu' ? Math.sin(t * 0.5) * 0.3 : 0), CAM.z);
  camera.lookAt(G.x * 0.3, CAM.lookY, CAM.lookZ);
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
  $('mBest').textContent = best;
  $('mCoins').textContent = bank;
  showOnly('menu');
}
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
  if (document.hidden && G.mode === 'play') {
    G.mode = 'paused';
    showOnly('paused');
  }
});

// ------------------------------------------------------------------- Loop ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.mode !== 'paused') update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);

// zum Testen
window.__shark = { G, move, setVertical, startRun };
