// LOW-POLY-3D-Darstellung (Three.js / WebGL).
// Zeichnet jede Szene als kleine 3D-Simulation: gleichbleibende Spielfigur,
// Umgebungen im Low-Poly-Stil, Kamera-Einstellungen wie im Film.
// Läuft auf dem Grafikchip (GPU) – deutlich sparsamer als die bisherige 2D-Zeichnung.
//
// Bewegungen kommen aus derselben Bewegungs-Bibliothek wie die 2D-Animation
// (actionPose): die Gelenkwinkel werden auf ein 3D-Skelett übertragen.

import * as THREE from 'three';
import { actionPose, emotionFor, BASE } from '../anim/figure.js';
import { drawEffect, effectSkyDarkness } from '../anim/world.js';
import { seededRandom } from '../util.js';

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);

// ------------------------------------------------------------ Renderer ---

let renderer = null;
let rSize = '';
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    // Test-Zeichenfläche sofort wieder freigeben (sonst bleibt ein Grafik-Kontext belegt)
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function getRenderer(W, H) {
  if (!renderer) {
    // preserveDrawingBuffer aus: spart einen kompletten zusätzlichen Bildspeicher.
    // Das Bild wird direkt nach dem Zeichnen übernommen, daher nicht nötig.
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  if (rSize !== `${W}x${H}`) {
    renderer.setSize(W, H, false);
    rSize = `${W}x${H}`;
  }
  return renderer;
}

// --------------------------------------------- Gemeinsame Bausteine ---
// Geometrien und Materialien werden geteilt (spart Speicher und Zeit).

const matCache = new Map();
function mat(color, extra = {}) {
  const key = `${color}|${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
    matCache.set(key, m);
  }
  return m;
}
const geoCache = new Map();
function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
const boxGeo = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylGeo = (r1, r2, h, s = 7) => geo(`c${r1},${r2},${h},${s}`, () => new THREE.CylinderGeometry(r1, r2, h, s));
const sphGeo = (r, d = 1) => geo(`s${r},${d}`, () => new THREE.IcosahedronGeometry(r, d));
const coneGeo = (r, h, s = 7) => geo(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));

/** Box mit Unterkante auf y */
function B(parent, w, h, d, color, x, y, z, extra) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat(color, extra));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function C(parent, r1, r2, h, color, x, y, z, s) {
  const m = new THREE.Mesh(cylGeo(r1, r2, h, s), mat(color));
  m.position.set(x, y + h / 2, z);
  parent.add(m);
  return m;
}
function S(parent, r, color, x, y, z, detail = 1, extra) {
  const m = new THREE.Mesh(sphGeo(r, detail), mat(color, extra));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// Canvas-Texturen (einmal erzeugt)
const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = false) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    texCache.set(key, t);
  }
  return t;
}

// Fassade mit Fenstern (4×4 Fenster pro Kachel)
function facadeTex(wall, lit) {
  return canvasTex(`fac|${wall}|${lit}`, 128, 128, (g, w, h) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, w, h);
    const rnd = seededRandom(wall.length * 7 + (lit ? 3 : 1));
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const on = lit && rnd() < lit;
        g.fillStyle = on ? '#ffe39a' : 'rgba(30,40,60,0.85)';
        g.fillRect(c * 32 + 8, r * 32 + 7, 16, 18);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(c * 32 + 8, r * 32 + 7, 16, 3);
      }
    }
  }, true);
}

// Gebäude: Box, deren Seiten die Fenster-Textur in passender Größe zeigen
function building(parent, w, h, d, wall, lit, x, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // Flächen: px, nx, py, ny, pz, nz – je 4 Ecken
  for (let f = 0; f < 6; f++) {
    const fw = f < 2 ? d : w;
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) uv.setXY(i, 0.01, 0.01);
      else uv.setXY(i, uv.getX(i) * (fw / 3), uv.getY(i) * (h / 3));
    }
  }
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: facadeTex(wall, lit), flatShading: true }));
  m.position.set(x, h / 2, z);
  parent.add(m);
  // Dachkante
  B(parent, w + 0.2, 0.25, d + 0.2, '#5d5866', x, h, z);
  return m;
}

function skyTex(time) {
  const cols = {
    day: ['#5aa9f0', '#cfe9ff', '#f3f7ff'],
    sunset: ['#3a3f86', '#f08a5d', '#ffd28c'],
    night: ['#05081c', '#16204a', '#2a3466'],
    space: ['#000006', '#03030c', '#05051a'],
  }[time] || ['#5aa9f0', '#cfe9ff', '#f3f7ff'];
  return canvasTex(`sky|${time}`, 4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, cols[0]);
    gr.addColorStop(0.65, cols[1]);
    gr.addColorStop(1, cols[2]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

function signTex(text, bg = '#2a1a1a', fg = '#fff3d6') {
  return canvasTex(`sign|${text}|${bg}`, 512, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '900 78px "Arial Black", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(text).toUpperCase().slice(0, 12), w / 2, h / 2 + 4);
  });
}

// ------------------------------------------------------------ Figur ---

const LOOK = { skin: '#f1c7a3', hair: '#4a2c1d', hoodie: '#7c3aed', hoodieDark: '#6229c9', pants: '#2b2f45', shoe: '#f4f4f4', sole: '#333333' };
const DIM = { thigh: 0.42, shin: 0.42, upper: 0.3, fore: 0.28, torso: 0.56 };

function faceTex(emo, blink) {
  return canvasTex(`face|${emo}|${blink ? 1 : 0}`, 256, 256, (g) => {
    const ink = '#2a1c18';
    // Augen
    for (const ex of [88, 168]) {
      if (emo === 'sleep' || blink) {
        g.strokeStyle = ink;
        g.lineWidth = 9;
        g.lineCap = 'round';
        g.beginPath();
        g.arc(ex, 112, 16, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      } else {
        const big = emo === 'scared' || emo === 'wow' ? 1.25 : 1;
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(ex, 112, 19 * big, 23 * big, 0, 0, TAU);
        g.fill();
        g.fillStyle = ink;
        g.beginPath();
        g.ellipse(ex + 2, emo === 'wow' ? 104 : emo === 'sad' ? 118 : 113, 11 * big, 13 * big, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(ex + 6, 106, 4, 0, TAU);
        g.fill();
      }
    }
    // Augenbrauen
    g.strokeStyle = '#4a2c1d';
    g.lineWidth = 10;
    g.lineCap = 'round';
    for (const [ex, side] of [[88, -1], [168, 1]]) {
      let inner = 0;
      if (emo === 'scared' || emo === 'worried' || emo === 'sad') inner = -10;
      if (emo === 'think') inner = side > 0 ? 8 : -4;
      const lift = emo === 'wow' || emo === 'scared' ? -8 : 0;
      g.beginPath();
      g.moveTo(ex - side * 18, 76 + lift + inner);
      g.lineTo(ex + side * 18, 76 + lift - inner * 0.4);
      g.stroke();
    }
    // Mund
    g.strokeStyle = ink;
    g.fillStyle = ink;
    g.lineWidth = 9;
    g.beginPath();
    if (emo === 'happy') {
      g.arc(128, 168, 34, 0.1 * Math.PI, 0.9 * Math.PI);
      g.closePath();
      g.fill();
    } else if (emo === 'scared' || emo === 'shout' || emo === 'wow') {
      g.ellipse(128, 182, 15, emo === 'wow' ? 14 : 22, 0, 0, TAU);
      g.fill();
    } else if (emo === 'sad') {
      g.arc(128, 206, 26, 1.2 * Math.PI, 1.8 * Math.PI);
      g.stroke();
    } else if (emo === 'worried') {
      g.moveTo(102, 184);
      g.bezierCurveTo(115, 172, 128, 194, 141, 180);
      g.lineTo(154, 184);
      g.stroke();
    } else if (emo === 'talk') {
      g.ellipse(128, 180, 14, 12, 0, 0, TAU);
      g.fill();
    } else if (emo === 'sleep') {
      g.ellipse(128, 180, 9, 6, 0, 0, TAU);
      g.stroke();
    } else {
      g.arc(128, 160, 24, 0.25 * Math.PI, 0.75 * Math.PI);
      g.stroke();
    }
  });
}

function bubbleTex(ch) {
  return canvasTex(`bub|${ch}`, 128, 128, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.arc(64, 60, 50, 0, TAU);
    g.fill();
    g.fillStyle = ch === '!' ? '#e11d48' : '#1a1033';
    g.font = '900 64px "Arial Black", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(ch === '…' ? '…' : ch, 64, 64);
  });
}

let hero = null;
function getHero() {
  if (hero) return hero;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  root.add(hips);
  // Rumpf (Hoodie) mit Kapuze
  const torso = new THREE.Group();
  hips.add(torso);
  B(torso, 0.5, DIM.torso, 0.3, LOOK.hoodie, 0, 0, 0);
  B(torso, 0.3, 0.12, 0.05, LOOK.hoodieDark, 0, 0.12, 0.155); // Bauchtasche
  B(torso, 0.52, 0.1, 0.32, LOOK.pants, 0, -0.04, 0); // Bund
  const hood = S(torso, 0.2, LOOK.hoodieDark, 0, DIM.torso + 0.02, -0.08, 1);
  hood.scale.set(1.3, 0.6, 0.9);
  // Kopf
  const head = new THREE.Group();
  head.position.y = DIM.torso + 0.06;
  torso.add(head);
  const skull = S(head, 0.24, LOOK.skin, 0, 0.24, 0, 2);
  skull.scale.set(1, 1.05, 0.95);
  const hair = S(head, 0.255, LOOK.hair, 0, 0.3, -0.02, 1);
  hair.scale.set(1.02, 0.8, 1.02);
  S(head, 0.05, LOOK.skin, 0.235, 0.24, 0, 0); // Ohren
  S(head, 0.05, LOOK.skin, -0.235, 0.24, 0, 0);
  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex('neutral', false), transparent: true });
  const face = new THREE.Mesh(geo('faceplane', () => new THREE.PlaneGeometry(0.4, 0.4)), faceMat);
  face.position.set(0, 0.22, 0.232);
  head.add(face);
  // Arme
  const arm = (side) => {
    const up = new THREE.Group();
    up.position.set(side * 0.31, DIM.torso - 0.05, 0);
    torso.add(up);
    B(up, 0.13, DIM.upper, 0.14, LOOK.hoodie, 0, -DIM.upper, 0);
    const lo = new THREE.Group();
    lo.position.y = -DIM.upper;
    up.add(lo);
    B(lo, 0.12, DIM.fore, 0.13, LOOK.hoodie, 0, -DIM.fore, 0);
    const hand = S(lo, 0.07, LOOK.skin, 0, -DIM.fore - 0.05, 0, 0);
    return { up, lo, hand };
  };
  const armL = arm(1);
  const armR = arm(-1);
  // Beine
  const leg = (side) => {
    const up = new THREE.Group();
    up.position.set(side * 0.12, -0.02, 0);
    hips.add(up);
    B(up, 0.17, DIM.thigh, 0.18, LOOK.pants, 0, -DIM.thigh, 0);
    const lo = new THREE.Group();
    lo.position.y = -DIM.thigh;
    up.add(lo);
    B(lo, 0.15, DIM.shin, 0.16, LOOK.pants, 0, -DIM.shin, 0);
    const foot = new THREE.Group();
    foot.position.set(0, -DIM.shin, 0.04);
    lo.add(foot);
    B(foot, 0.16, 0.09, 0.28, LOOK.shoe, 0, -0.09, 0.03);
    B(foot, 0.17, 0.03, 0.29, LOOK.sole, 0, -0.1, 0.03);
    const tip = new THREE.Object3D();
    tip.position.y = -0.1;
    foot.add(tip);
    return { up, lo, tip };
  };
  const legL = leg(1);
  const legR = leg(-1);
  // Handy (in der rechten Hand)
  const phone = new THREE.Group();
  B(phone, 0.09, 0.17, 0.015, '#111', 0, -0.085, 0);
  const screen = new THREE.Mesh(geo('phonescreen', () => new THREE.PlaneGeometry(0.075, 0.15)), new THREE.MeshBasicMaterial({ color: '#9cc3ff' }));
  screen.position.set(0, 0, 0.009);
  phone.add(screen);
  phone.position.set(0, -DIM.fore - 0.06, 0.07);
  phone.rotation.x = -1.2;
  armR.lo.add(phone);
  // Kontaktschatten
  const shadow = new THREE.Mesh(
    geo('blob', () => new THREE.CircleGeometry(0.45, 16)),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  // Sprechblase
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex('!'), depthTest: false }));
  bubble.scale.set(0.45, 0.45, 1);
  bubble.position.set(0.35, 1.0, 0);
  head.add(bubble);
  hero = { root, hips, torso, head, faceMat, armL, armR, legL, legR, phone, screen, shadow, bubble };
  return hero;
}

const tmpV = new THREE.Vector3();
/** Überträgt eine Pose aus der Bewegungs-Bibliothek auf das 3D-Skelett. */
function poseHero(h, st, t, emotion) {
  const P = { ...BASE, ...st.pose };
  h.torso.rotation.set(P.torso, 0, 0);
  h.head.rotation.set(P.head * 0.8, 0, 0);
  h.armL.up.rotation.set(-P.la1, 0, 0.08);
  h.armL.lo.rotation.set(-P.la2, 0, 0);
  h.armR.up.rotation.set(-P.ra1, 0, -0.08);
  h.armR.lo.rotation.set(-P.ra2, 0, 0);
  h.legL.up.rotation.set(-P.lt1, 0, 0);
  h.legL.lo.rotation.set(-P.lt2, 0, 0);
  h.legR.up.rotation.set(-P.rt1, 0, 0);
  h.legR.lo.rotation.set(-P.rt2, 0, 0);
  h.phone.visible = !!st.holdPhone;
  h.screen.material.color.set(Math.sin(t * 5) > 0 ? '#9cc3ff' : '#ff8a96');
  const blink = emotion !== 'sleep' && Math.sin(t * 1.3) > 0.985;
  h.faceMat.map = faceTex(emotion, blink);
  if (st.bubble && st.bubble !== '~') {
    h.bubble.visible = true;
    h.bubble.material.map = bubbleTex(st.bubble === 'Z' ? 'Z' : st.bubble);
    h.bubble.position.y = 0.95 + Math.sin(t * 3) * 0.04;
  } else h.bubble.visible = false;
}

/** Stellt die Figur so, dass der tiefere Fuß auf groundY steht (bzw. liegt). */
function groundHero(h, groundY, lying, dy, lieY) {
  h.hips.position.set(0, 0, 0);
  h.hips.rotation.set(0, 0, 0);
  h.root.updateMatrixWorld(true);
  const fl = h.legL.tip.getWorldPosition(tmpV).y;
  const fr = h.legR.tip.getWorldPosition(tmpV).y;
  const rootY = h.root.position.y;
  const minFoot = Math.min(fl, fr) - rootY;
  const standY = groundY - minFoot + dy;
  h.hips.position.y = lerp(standY, (lieY ?? groundY) + 0.18, lying);
  h.hips.rotation.z = lying * (Math.PI / 2);
}

// ---------------------------------------------------------- Umgebungen ---
// Jede Umgebung: Figur bewegt sich entlang X (z≈0), Kamera schaut aus +Z.

function lights(group, time, interior = false) {
  const dayish = time === 'day';
  const hemi = new THREE.HemisphereLight(
    time === 'night' ? '#4a5a9a' : time === 'sunset' ? '#ffc6a0' : '#dfefff',
    time === 'night' ? '#141428' : '#6b5a4a',
    time === 'night' ? 1.5 : interior ? 1.6 : 1.8,
  );
  group.add(hemi);
  const sun = new THREE.DirectionalLight(time === 'sunset' ? '#ffb070' : time === 'night' ? '#9fb2ff' : '#fff4e0', time === 'night' ? 1.1 : dayish ? 2.2 : 1.6);
  sun.position.set(4, 8, 6);
  group.add(sun);
  // weiches Fülllicht von vorne (Gesichter bleiben immer gut erkennbar)
  const fill = new THREE.DirectionalLight('#ffffff', time === 'night' ? 0.6 : 0.4);
  fill.position.set(-2, 3, 8);
  group.add(fill);
  group.userData.lights = [hemi, sun, fill];
}

function ground(group, color, w = 60, d = 60, y = 0) {
  const m = new THREE.Mesh(geo(`plane${w}x${d}`, () => new THREE.PlaneGeometry(w, d)), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  group.add(m);
  return m;
}

function tree(group, x, z, s = 1, color = '#3f9b4f') {
  C(group, 0.1 * s, 0.14 * s, 1.0 * s, '#6b4423', x, 0, z, 6);
  const c1 = new THREE.Mesh(coneGeo(0.75 * s, 1.4 * s), mat(color));
  c1.position.set(x, 1.5 * s, z);
  group.add(c1);
  const c2 = new THREE.Mesh(coneGeo(0.55 * s, 1.1 * s), mat(color));
  c2.position.set(x, 2.2 * s, z);
  group.add(c2);
}

function lampPost(group, x, z, on) {
  C(group, 0.05, 0.07, 3.2, '#2b2b33', x, 0, z, 6);
  B(group, 0.5, 0.06, 0.12, '#2b2b33', x + 0.2, 3.15, z);
  S(group, 0.12, on ? '#fff1b8' : '#666', x + 0.4, 3.1, z, 0, on ? { emissive: '#ffd27a', emissiveIntensity: 1 } : {});
}

function car(group, x, z, color, rotY = 0) {
  const c = new THREE.Group();
  B(c, 1.9, 0.5, 0.95, color, 0, 0.25, 0);
  B(c, 1.0, 0.42, 0.85, color, -0.1, 0.75, 0);
  B(c, 0.95, 0.34, 0.87, '#a9d4ff', -0.1, 0.79, 0);
  for (const [wx, wz] of [[-0.6, 0.48], [0.6, 0.48], [-0.6, -0.48], [0.6, -0.48]]) {
    const w = new THREE.Mesh(cylGeo(0.22, 0.22, 0.16, 10), mat('#1b1b1f'));
    w.rotation.x = Math.PI / 2;
    w.position.set(wx, 0.22, wz);
    c.add(w);
  }
  c.position.set(x, 0, z);
  c.rotation.y = rotY;
  group.add(c);
  return c;
}

function streetScene(g, time, { empty = false, tall = false, shop = null } = {}) {
  const night = time === 'night';
  ground(g, empty ? '#6d7064' : '#7a7a7a');
  // Gehweg vorne, Straße, Gehweg hinten
  B(g, 60, 0.12, 2.6, '#b9b4ab', 0, 0, 0.2);
  B(g, 60, 0.02, 6, '#3d3f45', 0, 0, -4.2);
  for (let x = -24; x < 24; x += 3) B(g, 1.4, 0.03, 0.14, '#f2f2f2', x, 0.01, -4.2);
  B(g, 60, 0.12, 2.6, '#b9b4ab', 0, 0, -8.5);
  // Häuserzeile
  const rnd = seededRandom(tall ? 31 : 17);
  const walls = ['#c97b5a', '#d9b48f', '#8e9aaf', '#a3a9b8', '#b5838d', '#6d8a96'];
  let x = -20;
  while (x < 20) {
    const w = 3 + rnd() * 2.5;
    const h = tall ? 7 + rnd() * 14 : 5 + rnd() * 6;
    const isShop = shop && x < -1 && x + w > 1;
    if (isShop) {
      building(g, w, 5, 3, '#4a3333', 0, x + w / 2, -11.5);
      const sign = new THREE.Mesh(geo('signplane', () => new THREE.PlaneGeometry(3.2, 0.8)), new THREE.MeshBasicMaterial({ map: signTex(shop) }));
      sign.position.set(x + w / 2, 3.9, -9.98);
      g.add(sign);
      B(g, 2.8, 2.2, 0.05, '#ffe9b8', x + w / 2, 0.12, -9.98, { emissive: '#ffd99a', emissiveIntensity: 0.6 });
    } else {
      building(g, w, h, 3, walls[Math.floor(rnd() * walls.length)], empty ? 0 : night ? 0.6 : 0.15, x + w / 2, -11.5);
    }
    x += w + 0.15;
  }
  for (let lx = -12; lx <= 12; lx += 6) lampPost(g, lx, -7.6, night && !empty);
  for (let tx = -15; tx <= 15; tx += 7.5) tree(g, tx + 2, -8.3, 0.8);
  if (empty) {
    // Unkraut auf der Straße, liegengebliebenes Auto
    for (let k = 0; k < 14; k++) S(g, 0.25 + rnd() * 0.2, '#5f8f3a', -14 + rnd() * 28, 0.05, -2 - rnd() * 6, 0);
    car(g, 6, -5.5, '#7a4b4b', 0.2);
  } else {
    car(g, -7, -2.8, '#e53935');
    car(g, 9, -5.6, '#1e88e5', Math.PI);
  }
  return { info: { walkZ: 0 } };
}

function interiorShell(g, wall, floor, w = 8, d = 6) {
  ground(g, floor, w, d + 8);
  B(g, w, 4.2, 0.2, wall, 0, 0, -d / 2); // Rückwand
  B(g, 0.2, 4.2, d + 8, wall, -w / 2, 0, 0); // linke Wand
  B(g, 0.2, 4.2, d + 8, wall, w / 2, 0, 0); // rechte Wand
  B(g, w, 0.15, d + 8, '#f4f1ea', 0, 4.2, 0); // Decke
  B(g, w, 0.12, 0.25, '#ffffff', 0, 0, -d / 2 + 0.12); // Fußleiste
}

function windowOpening(g, x, y, z, w, h, time) {
  const sky = new THREE.Mesh(geo(`win${w}x${h}`, () => new THREE.PlaneGeometry(w, h)), new THREE.MeshBasicMaterial({ map: skyTex(time) }));
  sky.position.set(x, y + h / 2, z + 0.11);
  g.add(sky);
  B(g, w + 0.2, 0.12, 0.12, '#f3e4d0', x, y - 0.06, z + 0.12);
  B(g, w + 0.2, 0.12, 0.12, '#f3e4d0', x, y + h, z + 0.12);
  B(g, 0.1, h, 0.12, '#f3e4d0', x, y, z + 0.12);
  B(g, 0.1, h, 0.12, '#f3e4d0', x - w / 2, y, z + 0.12);
  B(g, 0.1, h, 0.12, '#f3e4d0', x + w / 2, y, z + 0.12);
}

const PLACES3D = {
  bedroom(g, time) {
    interiorShell(g, time === 'night' ? '#3a3448' : '#e6cfb3', '#9c6b49');
    windowOpening(g, 0.6, 1.1, -3, 2.0, 1.3, time);
    // Bett links
    B(g, 2.2, 0.35, 1.5, '#6d4c41', -2.2, 0, -1.2);
    B(g, 2.1, 0.22, 1.42, '#f4ede4', -2.2, 0.35, -1.2);
    B(g, 1.3, 0.12, 1.45, '#7c9cd6', -1.8, 0.56, -1.2);
    B(g, 0.45, 0.16, 0.8, '#ffffff', -3.0, 0.57, -1.2);
    B(g, 0.15, 1.0, 1.5, '#5a3a2e', -3.3, 0, -1.2);
    // Nachttisch + Lampe
    B(g, 0.5, 0.5, 0.45, '#8a5a3c', -0.8, 0, -2.2);
    C(g, 0.12, 0.18, 0.3, '#ffe9b8', -0.8, 0.5, -2.2, 8);
    // Tür rechts, Schrank, Teppich
    B(g, 1.0, 2.2, 0.08, '#8a5a35', 2.6, 0, -2.86);
    B(g, 1.2, 2.1, 0.6, '#b98c62', 3.2, 0, -1.6);
    B(g, 2.4, 0.02, 1.6, '#c7a0d9', 0.5, 0, 0.2);
    return { info: { bed: { x: -2.2, z: -1.2, top: 0.6 }, door: { x: 2.6 } } };
  },
  living_room(g, time) {
    interiorShell(g, time === 'night' ? '#2c2a38' : '#d8e2e6', '#a07a5a');
    windowOpening(g, -2.0, 1.0, -3, 1.6, 1.3, time);
    // Sofa
    B(g, 2.6, 0.45, 0.9, '#c0392b', 0, 0, -2.2);
    B(g, 2.6, 0.6, 0.25, '#a93226', 0, 0.45, -2.55);
    B(g, 0.25, 0.65, 0.9, '#a93226', -1.3, 0, -2.2);
    B(g, 0.25, 0.65, 0.9, '#a93226', 1.3, 0, -2.2);
    // Fernseher rechts, Tisch, Pflanze
    B(g, 1.4, 0.5, 0.45, '#3b2a20', 3.0, 0, -0.8);
    B(g, 1.5, 0.85, 0.08, '#111111', 3.0, 0.55, -0.8);
    B(g, 1.38, 0.75, 0.02, '#2b3a55', 3.0, 0.6, -0.75, { emissive: '#3a5a9a', emissiveIntensity: 0.6 });
    B(g, 1.2, 0.4, 0.7, '#8a6a4a', 0, 0, -0.8);
    C(g, 0.18, 0.15, 0.4, '#b07050', -3.3, 0, -2.4, 8);
    S(g, 0.45, '#3f9b4f', -3.3, 0.8, -2.4, 0);
    return { info: { seatY: 0.45, seatX: 0, seatZ: -2.0 } };
  },
  window_view(g, time) {
    // Innenraum, großes Fenster in der Rückwand, draußen die leere Straße
    const night = time === 'night';
    ground(g, '#8a5a3c', 10, 8);
    // Wand mit Öffnung (aus 4 Teilen)
    const wall = night ? '#2a2433' : '#d9b48f';
    B(g, 10, 0.9, 0.2, wall, 0, 0, -2.5);
    B(g, 10, 1.2, 0.2, wall, 0, 2.9, -2.5);
    B(g, 3.0, 2.0, 0.2, wall, -3.5, 0.9, -2.5);
    B(g, 3.0, 2.0, 0.2, wall, 3.5, 0.9, -2.5);
    B(g, 4.0, 0.12, 0.35, '#f3e4d0', 0, 0.88, -2.4);
    B(g, 0.1, 2.0, 0.15, '#f3e4d0', 0, 0.9, -2.45);
    B(g, 0.35, 2.4, 0.1, '#7c3aed', -2.15, 0.7, -2.3);
    B(g, 0.35, 2.4, 0.1, '#7c3aed', 2.15, 0.7, -2.3);
    // Draußen: Straße + Häuser
    const out = new THREE.Group();
    out.position.set(0, -0.2, -6);
    streetScene(out, time, { empty: true });
    out.scale.setScalar(0.9);
    g.add(out);
    return { info: {} };
  },
  house_front(g, time) {
    ground(g, '#6aa84f');
    B(g, 60, 0.03, 3, '#b9b4ab', 0, 0, 1.6); // Gehweg
    B(g, 1.6, 0.04, 3.5, '#c9c2b6', 0, 0, -0.9); // Weg zur Tür
    // Haus
    const house = new THREE.Group();
    house.position.set(0, 0, -5);
    g.add(house);
    B(house, 7, 3.6, 5, '#e8d5b7', 0, 0, 0);
    const roof = new THREE.Mesh(geo('roofprism', () => new THREE.CylinderGeometry(0.01, 4.4, 2.0, 4, 1)), mat('#b5483c'));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.15, 1, 0.85);
    roof.position.y = 4.6;
    house.add(roof);
    for (const wx of [-2.2, 2.2]) {
      B(house, 1.3, 1.1, 0.1, '#3a4a66', wx, 1.6, 2.5);
      B(house, 1.5, 0.12, 0.2, '#ffffff', wx, 1.5, 2.55);
    }
    B(house, 1.3, 2.3, 0.08, '#1d1520', 0, 0, 2.52); // Türöffnung
    const door = new THREE.Group();
    door.position.set(-0.65, 0, 2.6);
    B(door, 1.3, 2.3, 0.08, '#7a4a2a', 0.65, 0, 0);
    house.add(door);
    // Zaun + Bäume + Straße hinter der Kamera nicht sichtbar
    for (let fx = -9; fx <= 9; fx += 0.6) if (Math.abs(fx) > 1.2) B(g, 0.08, 0.7, 0.08, '#ffffff', fx, 0, 0.2);
    B(g, 18, 0.06, 0.06, '#ffffff', 0, 0.55, 0.2);
    tree(g, -6, -3, 1.1);
    tree(g, 6.5, -2.5, 1);
    return { info: { door, doorZ: -2.3 } };
  },
  street(g, time, opt) {
    return streetScene(g, time, opt);
  },
  city(g, time, opt) {
    return streetScene(g, time, { ...opt, tall: true });
  },
  empty_city(g, time, opt) {
    return streetScene(g, time, { ...opt, empty: true, tall: true });
  },
  supermarket(g) {
    interiorShell(g, '#e9e4dc', '#d8d2c6', 12, 10);
    // Deckenlampen
    for (const lx of [-3, 0, 3]) B(g, 2.2, 0.08, 0.4, '#ffffff', lx, 3.0, -1.5, { emissive: '#ffffff', emissiveIntensity: 0.8 });
    // Regale mit Produkten (Instancing: ein Objekt, viele Kopien)
    const prodGeo = boxGeo(0.22, 0.28, 0.2);
    const cols = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff'];
    const shelves = [[-1.6, -2.2], [1.6, -2.2], [-1.6, -4.6], [1.6, -4.6]];
    const count = shelves.length * 4 * 12;
    const inst = new THREE.InstancedMesh(prodGeo, new THREE.MeshLambertMaterial({ flatShading: true }), count);
    const rnd = seededRandom(5);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    let n = 0;
    for (const [sx, sz] of shelves) {
      B(g, 2.9, 1.9, 0.5, '#8d6e63', sx, 0, sz);
      for (let r = 0; r < 4; r++) {
        B(g, 2.9, 0.04, 0.55, '#5d4037', sx, 0.12 + r * 0.45, sz + 0.02);
        for (let k = 0; k < 12; k++) {
          m4.makeTranslation(sx - 1.3 + k * 0.235, 0.3 + r * 0.45, sz + 0.25);
          inst.setMatrixAt(n, m4);
          inst.setColorAt(n, col.set(cols[Math.floor(rnd() * cols.length)]));
          n++;
        }
      }
    }
    g.add(inst);
    const sign = new THREE.Mesh(geo('signplane2', () => new THREE.PlaneGeometry(3, 0.7)), new THREE.MeshBasicMaterial({ map: signTex('Alles gratis?', '#d32f2f') }));
    sign.position.set(0, 2.6, -4.9);
    g.add(sign);
    B(g, 1.4, 0.9, 0.6, '#9e9e9e', 4.2, 0, 0.2); // Kasse
    return { info: { faceShelf: true } };
  },
  rooftop(g, time, opt) {
    ground(g, '#2b2433', 14, 10);
    for (let x = -6; x <= 6; x += 0.7) B(g, 0.06, 1.0, 0.06, '#1a1520', x, 0, -3.2);
    B(g, 12.5, 0.06, 0.06, '#1a1520', 0, 1.0, -3.2);
    B(g, 1.2, 0.8, 0.9, '#7a7a85', 3.5, 0, -1.5);
    C(g, 0.04, 0.04, 3, '#1a1520', -4.5, 0, -2.5, 5);
    // Stadt tief unten
    const city = new THREE.Group();
    city.position.set(0, -30, -30);
    const rnd = seededRandom(9);
    for (let i = 0; i < 26; i++) {
      const w = 3 + rnd() * 4;
      building(city, w, 8 + rnd() * 22, 4 + rnd() * 3, ['#5d5870', '#6a6378', '#4a4258'][i % 3], opt.empty ? 0 : time === 'night' ? 0.6 : 0.1, -45 + i * 3.6, -rnd() * 20);
    }
    g.add(city);
    return { info: {} };
  },
  meadow(g, time) {
    ground(g, time === 'night' ? '#1f3d22' : '#6cbf5b');
    B(g, 3, 0.02, 40, '#d8c9a3', 0, 0, -10); // Weg
    for (const [x, z, s] of [[-5, -4, 1.2], [6, -6, 1.4], [-9, -9, 1.6], [10, -12, 1.5], [3, -14, 1.3], [-4, -16, 1.6]]) tree(g, x, z, s);
    // Bank
    B(g, 2.0, 0.08, 0.6, '#8d6e63', 0, 0.45, -1.6);
    B(g, 2.0, 0.5, 0.08, '#8d6e63', 0, 0.55, -1.9);
    B(g, 0.1, 0.45, 0.5, '#5d4037', -0.9, 0, -1.6);
    B(g, 0.1, 0.45, 0.5, '#5d4037', 0.9, 0, -1.6);
    const rnd = seededRandom(3);
    for (let k = 0; k < 40; k++) S(g, 0.07, ['#ff6fa8', '#ffffff', '#b388ff', '#ffd54f'][k % 4], -10 + rnd() * 20, 0.08, -1 - rnd() * 12, 0);
    return { info: { seatY: 0.49, seatX: 0, seatZ: -1.5 } };
  },
  beach(g, time) {
    ground(g, '#f2d58d');
    const water = new THREE.Mesh(geo('water', () => new THREE.PlaneGeometry(200, 120)), mat(time === 'night' ? '#123a66' : '#2a8fd6'));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.05, -64);
    g.add(water);
    B(g, 200, 0.02, 0.5, '#ffffff', 0, 0.04, -4.2); // Schaumkante
    for (const [x, z] of [[-6, -1.5], [7, -2.5]]) {
      const trunk = C(g, 0.12, 0.18, 3.4, '#8d6e63', x, 0, z, 6);
      trunk.rotation.z = 0.15;
      for (let k = 0; k < 6; k++) {
        const leaf = B(g, 1.6, 0.05, 0.4, '#2e7d32', x + Math.cos(k) * 0.8 + 0.5, 3.3, z + Math.sin(k) * 0.8);
        leaf.rotation.y = k;
        leaf.rotation.z = -0.3;
      }
    }
    return { info: {} };
  },
  forest(g, time) {
    ground(g, '#3e7b3a');
    const rnd = seededRandom(11);
    for (let i = 0; i < 40; i++) {
      const x = -14 + rnd() * 28;
      const z = -2 - rnd() * 18;
      if (Math.abs(x) < 1.5 && z > -4) continue;
      tree(g, x, z, 0.9 + rnd() * 0.9, i % 2 ? '#2f7d43' : '#256b37');
    }
    return { info: {} };
  },
  desert(g) {
    ground(g, '#d9944a');
    for (const [x, z] of [[-5, -6], [6, -9]]) {
      C(g, 0.25, 0.25, 2.2, '#2e7d32', x, 0, z, 7);
      C(g, 0.15, 0.15, 0.8, '#2e7d32', x + 0.4, 1.0, z, 7);
    }
    return { info: {} };
  },
  snow(g) {
    ground(g, '#f2f6fb');
    for (const [x, z, s] of [[-8, -14, 6], [6, -18, 8]]) {
      const m = new THREE.Mesh(coneGeo(s, s * 1.2, 6), mat('#dfe9f5'));
      m.position.set(x, s * 0.6, z);
      g.add(m);
    }
    return { info: {} };
  },
  space(g) {
    return { info: { space: true } };
  },
  earth(g) {
    const earth = new THREE.Mesh(geo('earth', () => {
      const e = new THREE.IcosahedronGeometry(2.2, 3);
      const rnd = seededRandom(7);
      const colors = [];
      const blobs = Array.from({ length: 9 }, () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize());
      const p = e.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        const land = blobs.some((b) => b.dot(v) > 0.82);
        const c = new THREE.Color(land ? '#4caf50' : '#1e6fd0');
        if (Math.abs(v.y) > 0.9) c.set('#ffffff');
        colors.push(c.r, c.g, c.b);
      }
      e.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      return e;
    }), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    earth.position.set(0, 1.6, -2);
    g.add(earth);
    g.userData.earth = earth;
    return { info: { space: true } };
  },
};

// Sterne für Nacht/Weltall
function stars(group) {
  const pts = geo('stars', () => {
    const rnd = seededRandom(21);
    const arr = [];
    for (let i = 0; i < 600; i++) {
      const v = new THREE.Vector3(rnd() - 0.5, rnd() * 0.9 + 0.05, rnd() - 0.5).normalize().multiplyScalar(80);
      arr.push(v.x, v.y, v.z - 20);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  });
  group.add(new THREE.Points(pts, new THREE.PointsMaterial({ color: '#ffffff', size: 0.35, sizeAttenuation: true })));
}

const sceneCache = new Map();
function placeKey(spec) {
  return `${spec.place}|${spec.time}|${spec.empty ? 1 : 0}|${spec.props.find((p) => p.type === 'shop')?.label || ''}`;
}
function getPlace(spec) {
  const key = placeKey(spec);
  let e = sceneCache.get(key);
  if (e) return e;
  const g = new THREE.Group();
  const interior = ['bedroom', 'living_room', 'supermarket', 'window_view'].includes(spec.place);
  const shop = spec.props.find((p) => p.type === 'shop');
  const res = (PLACES3D[spec.place] || PLACES3D.meadow)(g, spec.time, { empty: spec.empty, shop: shop ? shop.label || 'SHOP' : null }) || { info: {} };
  const space = res.info.space;
  if (!space) lights(g, spec.time, interior);
  else {
    g.add(new THREE.AmbientLight('#ffffff', 0.6));
    const d = new THREE.DirectionalLight('#ffffff', 2.4);
    d.position.set(-5, 3, 4);
    g.add(d);
    g.userData.lights = [d];
  }
  if (spec.time === 'night' || space) stars(g);
  const bg = space ? new THREE.Color('#02020a') : interior && spec.place !== 'window_view' ? new THREE.Color('#e9e2d6') : skyTex(spec.time);
  e = { group: g, info: res.info, bg, interior, space };
  // Umgebung bleibt im Speicher, solange eine spätere Szene sie noch braucht
  // (siehe plan3D/releaseUnused) – so wird nichts doppelt aufgebaut.
  sceneCache.set(key, e);
  return e;
}

// Bewegliche Dinge: Sonne, Mond, Wolken, Tiere, Auto
let sky3d = null;
function getSkyProps() {
  if (sky3d) return sky3d;
  const sun = S(new THREE.Group(), 2.2, '#ffe066', 0, 0, 0, 1, { emissive: '#ffcc33', emissiveIntensity: 1.2 });
  const moon = S(new THREE.Group(), 1.4, '#f1f1e6', 0, 0, 0, 1, { emissive: '#bbbbaa', emissiveIntensity: 0.6 });
  const clouds = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) S(c, 1.2 - k * 0.2, '#ffffff', k * 1.2 - 1.2, 0, 0, 1);
    c.position.set(-20 + i * 12, 12 + (i % 2) * 2, -30);
    clouds.add(c);
  }
  const deer = () => {
    const d = new THREE.Group();
    B(d, 1.0, 0.45, 0.35, '#8a5a3a', 0, 0.75, 0);
    B(d, 0.18, 0.55, 0.18, '#8a5a3a', 0.5, 1.05, 0).rotation.z = -0.4;
    B(d, 0.35, 0.22, 0.22, '#8a5a3a', 0.72, 1.35, 0);
    for (const [x, z] of [[-0.4, 0.12], [-0.4, -0.12], [0.4, 0.12], [0.4, -0.12]]) B(d, 0.09, 0.75, 0.09, '#6b4630', x, 0, z);
    return d;
  };
  const animals = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const d = deer();
    d.position.set(i * 2.2, 0, -i * 1.3 - 6);
    animals.add(d);
  }
  const plane = new THREE.Group();
  B(plane, 1.6, 0.25, 0.25, '#eceff1', 0, 0, 0);
  B(plane, 0.4, 0.05, 1.6, '#eceff1', 0, 0.05, 0);
  B(plane, 0.25, 0.4, 0.05, '#e53935', -0.7, 0.2, 0);
  const vehicle = new THREE.Group();
  car(vehicle, 0, 0, '#e11d48');
  sky3d = { sun, moon, clouds, animals, plane, vehicle };
  return sky3d;
}

// ----------------------------------------------------------- Kamera ---

const CAMS = {
  wide: { off: [0, 2.6, 9.5], look: [0, 1.6, -2] },
  medium: { off: [1.8, 1.8, 4.6], look: [0, 1.15, 0] },
  close: { off: [0.9, 1.65, 3.1], look: [0, 1.3, 0] },
  ots: { off: [0.85, 1.95, 2.2], look: [-0.1, 1.25, -1.6] }, // über die Schulter (Figur schaut nach -Z)
  follow: { off: [0.5, 2.0, 6.2], look: [0, 1.2, -1] },
  room: { off: [1.2, 2.2, 5.2], look: [-0.5, 1.0, -1.2] },
  low: { off: [1.2, 0.7, 4.2], look: [0, 2.2, -3] }, // Untersicht (z. B. Hochhäuser)
};

function chooseCam(spec, action, shot) {
  if (shot === 'look_window' || shot === 'miss_people' || shot === 'look_ocean') return 'ots';
  if (action === 'phone' || shot === 'check_phone') return 'ots';
  if (action === 'get_up' || action === 'sleep') return 'room';
  if (['walk', 'run', 'flee', 'drive'].includes(action)) return 'follow';
  if (action === 'shout' || action === 'scared' || action === 'talk' || action === 'call') return 'close';
  if (shot === 'empty_city' || shot === 'party_alone' || shot === 'rooftop_alone' || shot === 'stars') return 'wide';
  if (action === 'look_up') return 'low';
  if (['bedroom', 'living_room'].includes(spec.place)) return 'room';
  return 'medium';
}

// ---------------------------------------------------------- Szene ---

const scene = new THREE.Scene();
// Nebel-Objekte wiederverwenden (ein neues pro Bild zwang Three.js, bei JEDEM
// Bild alle Materialien neu zu prüfen – unnötige Rechenarbeit und Speicher-Müll)
const fogs = new Map();
function fogFor(time) {
  let f = fogs.get(time);
  if (!f) {
    f = new THREE.Fog(time === 'night' ? '#0b1030' : time === 'sunset' ? '#f0a070' : '#cfe3f5', 25, 90);
    fogs.set(time, f);
  }
  return f;
}
const camera = new THREE.PerspectiveCamera(50, 9 / 16, 0.1, 400);
const worldX = (x) => (x - 0.5) * 7;

/**
 * Erzeugt eine 3D-Szene als "visual" für den Video-Renderer.
 * spec = Szenenbeschreibung (Ort, Zeit, Figuren, Effekte), shot = Film-Einstellung.
 */
export function createAnim3DVisual(spec, shot = null) {
  const v = {
    isAnim: true,
    is3d: true,
    needsShade: true,
    spec,
    placeKey: spec.place === 'black' ? null : placeKey(spec),
    order: -1,
    draw(g, W, H, t, dur) {
      if (spec.place === 'black') {
        g.fillStyle = '#000';
        g.fillRect(0, 0, W, H);
        return;
      }
      if (v.order > maxOrder) {
        maxOrder = v.order;
        releaseUnused(maxOrder);
      }
      render3D(g, W, H, spec, shot, t, Math.max(0.5, dur));
    },
  };
  return v;
}

// ------------------------------------------------- Speicherverwaltung ---
// Jede Umgebung wird nur so lange im Grafikspeicher gehalten, wie sie noch von
// einer späteren Szene gebraucht wird. Teile, die andere Szenen (oder die Figur)
// noch nutzen, werden NICHT gelöscht.

let lastUse = new Map(); // placeKey → letzte Szene, die sie braucht
let maxOrder = -1;

/** Vor dem Video aufrufen: merkt sich, welche Szene welche Umgebung braucht. */
export function plan3D(visuals) {
  lastUse = new Map();
  maxOrder = -1;
  visuals.forEach((v, i) => {
    if (!v?.is3d) return;
    v.order = i;
    if (v.placeKey) lastUse.set(v.placeKey, i);
  });
}

function collect(obj, into) {
  obj.traverse((o) => {
    if (o.geometry) into.add(o.geometry);
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) {
      into.add(m);
      if (m.map) into.add(m.map);
    }
  });
  return into;
}

function disposePlace(key) {
  const e = sceneCache.get(key);
  if (!e) return;
  sceneCache.delete(key);
  scene.remove(e.group);
  // Alles, was noch woanders gebraucht wird, behalten
  const keep = new Set();
  for (const o of sceneCache.values()) {
    collect(o.group, keep);
    if (o.bg?.isTexture) keep.add(o.bg);
  }
  if (hero) {
    collect(hero.root, keep);
    collect(hero.shadow, keep);
  }
  if (sky3d) for (const o of Object.values(sky3d)) if (o) collect(o, keep);
  for (const o of fogs.values()) keep.add(o);
  const mine = collect(e.group, new Set());
  if (e.bg?.isTexture) mine.add(e.bg);
  for (const r of mine) {
    if (keep.has(r) || !r.dispose) continue;
    r.dispose();
    for (const cache of [geoCache, matCache, texCache]) {
      for (const [k, v] of cache) if (v === r) cache.delete(k);
    }
  }
}

function releaseUnused(current) {
  for (const key of [...sceneCache.keys()]) {
    const last = lastUse.get(key);
    // vorherige Szene noch behalten (Überblendung), alles davor freigeben
    if (last === undefined || last < current - 1) disposePlace(key);
  }
}

/** Nach dem Video: kompletten Grafikspeicher freigeben. */
export function dispose3D() {
  for (const key of [...sceneCache.keys()]) disposePlace(key);
  const all = new Set();
  if (hero) collect(hero.root, all), collect(hero.shadow, all);
  if (sky3d) for (const o of Object.values(sky3d)) if (o) collect(o, all);
  for (const c of [geoCache, matCache, texCache]) for (const v of c.values()) all.add(v);
  for (const r of all) r.dispose?.();
  geoCache.clear();
  matCache.clear();
  texCache.clear();
  hero = null;
  sky3d = null;
  scene.clear();
  scene.background = null;
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss?.();
    renderer = null;
    rSize = '';
  }
  lastUse = new Map();
  maxOrder = -1;
}

function render3D(g2, W, H, spec, shot, t, dur) {
  const p = clamp(t / dur);
  const ev = 0.3;
  const r = getRenderer(W, H);
  const place = getPlace(spec);
  const h = getHero();
  const sp = getSkyProps();
  scene.clear();
  scene.add(place.group);
  scene.background = place.bg;
  scene.fog = place.interior || place.space ? null : fogFor(spec.time);

  // Dunkelheit (Stromausfall etc.)
  const dark = effectSkyDarkness(spec.effect, p);
  for (const l of place.group.userData.lights || []) l.intensity = (l.userData.base ??= l.intensity) * (1 - dark * 0.85);

  // Erde dreht sich
  if (place.group.userData.earth) place.group.userData.earth.rotation.y = t * 0.15;

  // Himmelsobjekte
  for (const pr of spec.props) {
    if (pr.type === 'sun' && !place.interior) {
      sp.sun.position.set(place.space ? 6 : 14, place.space ? 5 : 16, -40);
      let s = 1;
      if (pr.state === 'grow' || pr.state === 'red_giant') s = 1 + p * 2;
      if (pr.state === 'explode' && p > ev) s = 0.001;
      sp.sun.scale.setScalar(s);
      sp.sun.material.color.set(pr.state === 'red_giant' ? '#ff5722' : '#ffe066');
      scene.add(sp.sun);
    }
    if (pr.type === 'moon' && !place.interior && !(pr.state === 'vanish' && p > 0.5)) {
      sp.moon.position.set(-12, 15, -40);
      scene.add(sp.moon);
    }
    if (pr.type === 'clouds' && !place.interior) {
      sp.clouds.position.x = (t * 0.8) % 12;
      scene.add(sp.clouds);
    }
    if (pr.type === 'animals' && !place.interior) {
      sp.animals.position.set(8 - t * 1.4, 0, 0);
      sp.animals.children.forEach((d, i) => (d.position.y = Math.abs(Math.sin(t * 6 + i)) * 0.15));
      sp.animals.rotation.y = Math.PI;
      scene.add(sp.animals);
    }
    if (pr.type === 'money' && !place.interior) {
      // Geldscheine flattern von oben herab
      if (!sp.money) {
        sp.money = new THREE.Group();
        for (let i = 0; i < 24; i++) {
          const bill = B(sp.money, 0.32, 0.01, 0.16, '#5aa55a', 0, 0, 0);
          bill.userData.seed = i;
        }
      }
      sp.money.children.forEach((bill, i) => {
        const fall = (t * 0.6 + i * 0.37) % 4;
        bill.position.set(-3 + ((i * 1.7) % 6), 4 - fall, -1 - (i % 4) * 0.6);
        bill.rotation.set(t * 2 + i, t + i, Math.sin(t * 3 + i));
      });
      scene.add(sp.money);
    }
    if (pr.type === 'plane') {
      const a = t * 0.6;
      sp.plane.position.set(Math.cos(a) * 3.2, 1.6 + Math.sin(a) * 0.6, -2 + Math.sin(a) * 3.2);
      sp.plane.rotation.y = -a;
      scene.add(sp.plane);
    }
  }

  // Hauptfigur
  const a0 = spec.actors[0];
  let camType = chooseCam(spec, a0?.action, shot);
  let focus = new THREE.Vector3(0, 0, 0);
  if (a0) {
    const action = a0.action;
    const st = actionPose(action, p, t, ev);
    const emotion = emotionFor(action, p, ev, st.lying || 0);
    poseHero(h, st, t, emotion);
    // Position und Blickrichtung
    let fromX = a0.from ? { offleft: -0.15, left: 0.25, center: 0.5, right: 0.75, offright: 1.15 }[a0.from] : 0.5;
    let toX = a0.to ? { offleft: -0.15, left: 0.25, center: 0.5, right: 0.75, offright: 1.15 }[a0.to] : fromX;
    if (['walk', 'run', 'flee'].includes(action) && toX === fromX) {
      fromX = 0.25;
      toX = 0.75;
    }
    const k = st.move ?? 0;
    let x = worldX(lerp(fromX, toX, k));
    let z = 0;
    let groundY = ['street', 'city', 'empty_city'].includes(spec.place) ? 0.12 : 0;
    let lieY = null;
    let heading = toX > fromX ? Math.PI / 2 : toX < fromX ? -Math.PI / 2 : 0;
    if (place.info.bed && (action === 'get_up' || action === 'sleep')) {
      const bed = place.info.bed;
      if (action === 'sleep' || p < 0.3) {
        x = bed.x + 0.35;
        z = bed.z;
        lieY = bed.top;
        heading = 0;
      } else if (p < 0.55) {
        x = bed.x + 0.9;
        z = bed.z + 0.75;
        groundY = 0;
        heading = 0;
      } else {
        x = lerp(bed.x + 0.9, 2.6, smooth(clamp((p - 0.55) / 0.45)));
        z = lerp(bed.z + 0.75, -2.2, clamp((p - 0.55) / 0.45));
        heading = Math.PI / 2 + 0.6;
      }
    }
    if (st.seated && place.info.seatY && action !== 'drive') {
      x = place.info.seatX ?? 0;
      z = place.info.seatZ ?? -1.5;
      heading = 0;
    }
    if (action === 'call' || action === 'shout' || action === 'scared' || action === 'talk' || action === 'think' || action === 'sad' || action === 'wave' || action === 'cheer' || action === 'jump') {
      heading = 0.35; // leicht seitlich zur Kamera
    }
    if (action === 'phone' || action === 'look_out' || action === 'grab' || shot === 'look_window' || shot === 'miss_people' || shot === 'check_phone' || shot === 'look_ocean') {
      heading = Math.PI; // Rücken zur Kamera (über die Schulter)
      if (spec.place === 'window_view') {
        x = 0;
        z = -1.6;
      }
      if (spec.place === 'supermarket') {
        x = 0.4;
        z = -1.4;
      }
    }
    if (spec.place === 'house_front' && ['walk', 'run'].includes(action)) {
      // aus der Haustür nach vorne/rechts
      const door = place.info.door;
      if (door) door.rotation.y = -smooth(clamp(p / 0.2)) * 1.4;
      const kk = smooth(clamp((p - 0.1) / 0.9));
      x = lerp(0, a0.to === 'center' ? 0 : 3.2, kk);
      z = lerp(-2.4, 0.6, kk);
      heading = Math.atan2(x - 0, 1) * 0.8 + 0.2;
    }
    h.root.position.set(x, 0, z);
    h.root.rotation.set(0, heading, 0);
    groundHero(h, groundY, st.lying || 0, (st.pose?.dy || 0) * 1.75, lieY);
    // Lebendigkeit: leichtes Atmen
    h.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.008;
    // Fahren: Figur sitzt im Auto, Auto fährt
    if (action === 'drive') {
      const cx = lerp(-6, 6, p);
      sp.vehicle.position.set(cx, 0, -2.6);
      sp.vehicle.rotation.y = 0;
      scene.add(sp.vehicle);
      h.root.position.set(cx - 0.1, 0, -2.6);
      h.root.rotation.y = Math.PI / 2;
      h.hips.position.y = 0.55;
      x = cx;
      z = -2.6;
    }
    scene.add(h.root);
    h.shadow.position.set(x, (lieY ?? groundY) + 0.015, z);
    h.shadow.scale.setScalar(st.lying ? 1.6 : 1);
    scene.add(h.shadow);
    focus = new THREE.Vector3(x, 0, z);
  } else {
    camType = place.space ? 'wide' : camType;
  }

  // Kamera (mit langsamer Fahrt)
  const cam = CAMS[camType] || CAMS.medium;
  const drift = (p - 0.5) * 0.35;
  const [ox, oy, oz] = cam.off;
  const [lx, ly, lz] = cam.look;
  if (place.space && !a0) {
    camera.position.set(Math.sin(t * 0.1) * 1.5, 2.2, 8.5 - p * 0.8);
    camera.lookAt(0, 1.6, -2);
  } else if (camType === 'room') {
    camera.position.set(focus.x * 0.4 + ox + drift, oy, oz - p * 0.4);
    camera.lookAt(focus.x * 0.6 + lx, ly, lz);
  } else if (camType === 'ots') {
    camera.position.set(focus.x + ox + drift * 0.3, oy, focus.z + oz);
    camera.lookAt(focus.x + lx, ly, focus.z + lz);
  } else {
    camera.position.set(focus.x + ox + drift, oy, focus.z + oz - p * 0.5);
    camera.lookAt(focus.x + lx, ly, focus.z + lz);
  }
  // Erdbeben/Explosion: Kamera wackelt
  const qk = (p - ev) * dur;
  if (spec.effect === 'quake' || ((spec.effect === 'explosion' || spec.effect === 'flash') && qk > 0 && qk < 1.5)) {
    camera.position.x += Math.sin(t * 47) * 0.08;
    camera.position.y += Math.cos(t * 39) * 0.06;
  }
  camera.aspect = W / H;
  camera.updateProjectionMatrix();

  r.render(scene, camera);
  g2.drawImage(r.domElement, 0, 0, W, H);

  // 2D-Effekte darüber (Blitz, Regen, Schnee, Feuer, Flut, Dunkelheit …)
  if (spec.effect && spec.effect !== 'none') {
    const c = { W, H, t, p, dur, ev, groundY: H * 0.7 };
    drawEffect(g2, W, H, c, spec.effect, { x: W * 0.72, y: H * 0.2 });
  }
}

// Diagnose: wie viele 3D-Ressourcen liegen gerade im Grafikspeicher?
export function stats3D() {
  const m = renderer?.info?.memory || {};
  return { geometries: m.geometries || 0, textures: m.textures || 0, programs: renderer?.info?.programs?.length || 0, calls: renderer?.info?.render?.calls || 0, places: sceneCache.size, canvasTextures: texCache.size, materials: matCache.size };
}
if (typeof window !== 'undefined') window.__stats3D = stats3D;
