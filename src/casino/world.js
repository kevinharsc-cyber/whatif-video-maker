// BuildingSystem + Stadt: Straße, 10 Häuser, das Casino (außen & innen), Kollisionen
import { THREE, M, mesh, box, TEX, bake, makeHouse, makeTree, makeLamp, makeBench, makeCar, makeHydrant, makeHedge, signBoard, rng } from './models.js';

// Casino-Maße (Innenraum ca. 10 m × 6,75 m ≈ 68 m²)
export const CASINO = { x0: 5.5, x1: 12.75, z0: -5.25, z1: 5.25, t: 0.25, h: 3.6, doorW: 1.6 };
export const INTERIOR = { x0: CASINO.x0 + CASINO.t, x1: CASINO.x1 - CASINO.t, z0: CASINO.z0 + CASINO.t, z1: CASINO.z1 - CASINO.t };
export const BOUNDS = { x0: -5.0, x1: 12.6, z0: -29, z1: 29 };
export const DOOR_ZONE = { x0: INTERIOR.x0, x1: INTERIOR.x0 + 1.5, z0: -1.4, z1: 1.4 };
export const LEVER_POS = new THREE.Vector3(INTERIOR.x0 + 0.05, 1.3, 2.4);

export class World {
  constructor(scene) {
    this.scene = scene;
    this.statics = []; // { x0, x1, z0, z1 } – feste Kollisionsboxen
    this.blockers = []; // Meshes, durch die die Kamera nicht schaut
    this.anim = [];
    this.build();
  }
  addBox(x0, x1, z0, z1) { this.statics.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); }

  build() {
    const s = this.scene;
    // Boden
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: TEX.grass, roughness: 1 }));
    TEX.grass.repeat.set(30, 30);
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true; s.add(grass);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 70), new THREE.MeshStandardMaterial({ map: TEX.asphalt, roughness: 0.95 }));
    TEX.asphalt.repeat.set(2, 24);
    road.rotation.x = -Math.PI / 2; road.position.y = 0.01; road.receiveShadow = true; s.add(road);
    const dash = new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.8 });
    for (let z = -33; z < 34; z += 3) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1.4), dash); d.rotation.x = -Math.PI / 2; d.position.set(0, 0.015, z); s.add(d); }
    for (const sx of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 70), new THREE.MeshStandardMaterial({ map: TEX.sidewalk, roughness: 0.9 }));
      TEX.sidewalk.repeat.set(2, 58);
      sw.position.set(sx * 4.2, 0.08, 0); sw.receiveShadow = true; s.add(sw);
      const curb = mesh(new THREE.BoxGeometry(0.18, 0.2, 70), M('#9c968a'), sx * 3.05, 0.1, 0, false); s.add(curb);
      // Vorgärten / Plätze vor den Häusern
      const yard = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 70), new THREE.MeshStandardMaterial({ map: TEX.sidewalk, roughness: 0.9, color: '#e6dccb' }));
      yard.position.set(sx * 5.9, 0.06, 0); yard.receiveShadow = true; s.add(yard);
    }
    // Häuser: links 5, rechts 4 + Casino
    const left = [['small', 1], ['tall', 2], ['shop', 3], ['small', 4], ['deco', 5]];
    const right = [['small', 6], ['old', 7], null, ['tall', 8], ['small', 9]];
    const zs = [-24, -12, 0, 12, 24];
    zs.forEach((z, i) => {
      const L = left[i];
      if (L) this.placeHouse(L[0], L[1], -1, z);
      const R = right[i];
      if (R) this.placeHouse(R[0], R[1], 1, z);
    });
    this.buildCasino();
    // Laternen, Bäume, Bänke …
    for (const z of [-20, -6, 6, 20]) for (const sx of [-1, 1]) {
      const l = makeLamp(); l.position.set(sx * 3.35, 0.16, z + (sx > 0 ? 0 : 3)); s.add(l);
      this.addBox(sx * 3.35 - 0.15, sx * 3.35 + 0.15, l.position.z - 0.15, l.position.z + 0.15);
      this.anim.push({ type: 'lamp', bulb: l.getObjectByName('bulb') });
    }
    for (const [x, z, seed] of [[-4.5, -17.5, 1], [-4.5, 6.5, 2], [4.6, -17.5, 3], [4.6, 17.5, 4], [-4.5, 18, 5]]) {
      const t = makeTree(seed); t.position.set(x, 0.16, z); s.add(t); this.addBox(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
    }
    for (const [x, z, ry] of [[-4.6, -3, Math.PI / 2], [4.75, 9, -Math.PI / 2]]) { const b = makeBench(); b.position.set(x, 0.16, z); b.rotation.y = ry; s.add(b); this.addBox(x - 0.35, x + 0.35, z - 0.85, z + 0.85); }
    const h = makeHydrant(); h.position.set(3.5, 0.16, -8.5); s.add(h); this.addBox(3.3, 3.7, -8.7, -8.3);
    for (const [x, z, c] of [[-1.7, -15, '#e9c46a'], [1.7, 15.5, '#4ea8de']]) { const car = makeCar(c); car.position.set(x, 0, z); car.rotation.y = x < 0 ? 0 : Math.PI; s.add(car); this.addBox(x - 0.9, x + 0.9, z - 1.75, z + 1.75); this.blockers.push(...car.children); }
    // Straßenenden: Hecken + Schilder (unsichtbare Grenze)
    for (const zz of [-30.5, 30.5]) {
      const hg = makeHedge(18); hg.position.set(0, 0, zz); s.add(hg);
      const sb = signBoard(zz < 0 ? 'OPAS STRASSE' : 'OPAS STRASSE', '#2a6f4a', '#ffffff', 2.2, 0.5, 0, 0, 0);
      sb.position.set(zz < 0 ? 2.5 : -2.5, 1.9, zz + (zz < 0 ? 1.2 : -1.2)); sb.rotation.y = zz < 0 ? 0 : Math.PI; s.add(sb);
      s.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 8), M('#666'), sb.position.x, 0.9, sb.position.z - (zz < 0 ? 0.05 : -0.05)));
    }
    // Hintergrund-Bäume hinter den Häusern
    const r = rng(77);
    for (let i = 0; i < 26; i++) { const t = makeTree(100 + i); const sx = i % 2 ? 1 : -1; t.position.set(sx * (15 + r() * 6), 0, -30 + r() * 60); t.scale.setScalar(1.2 + r() * 0.8); s.add(t); }
  }

  placeHouse(kind, seed, side, z) {
    const { group, w, d } = makeHouse(kind, seed);
    // Fassade zeigt zur Straße
    const fx = side * 6.4;
    group.position.set(fx + side * (d / 2), 0, z);
    group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.scene.add(group);
    this.addBox(fx, fx + side * d, z - w / 2, z + w / 2);
    this.blockers.push(...group.children);
  }

  buildCasino() {
    const s = this.scene, C = CASINO, I = INTERIOR;
    const outer = new THREE.Group();
    const facadeMat = new THREE.MeshStandardMaterial({ map: TEX.plaster.clone(), color: '#a7a49d', roughness: 0.95 });
    facadeMat.map.repeat.set(4, 1.5); facadeMat.map.needsUpdate = true;
    this.innerWallMat = new THREE.MeshStandardMaterial({ map: TEX.plaster, color: '#9a9893', roughness: 0.95, side: THREE.FrontSide });
    const walls = []; this.cutWalls = [];
    const wall = (x0, x1, z0, z1, y0, y1, inner) => {
      const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
      const m = new THREE.Mesh(g, [facadeMat, facadeMat, facadeMat, facadeMat, facadeMat, facadeMat]);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = true; m.receiveShadow = true;
      s.add(m); walls.push({ m, inner }); this.blockers.push(m);
      const n = { px: [-1, 0, x0], nx: [1, 0, x1], pz: [0, -1, z0], nz: [0, 1, z1] }[inner];
      this.cutWalls.push({ m, nx: n[0], nz: n[1], d: n[2] });
      return m;
    };
    const dz = C.doorW / 2;
    // Vorderwand mit Türöffnung (x = x0)
    wall(C.x0, C.x0 + C.t, C.z0, -dz, 0, C.h, 'px');
    wall(C.x0, C.x0 + C.t, dz, C.z1, 0, C.h, 'px');
    wall(C.x0, C.x0 + C.t, -dz, dz, 2.4, C.h, 'px');
    wall(C.x1 - C.t, C.x1, C.z0, C.z1, 0, C.h, 'nx');
    wall(C.x0, C.x1, C.z0, C.z0 + C.t, 0, C.h, 'pz');
    wall(C.x0, C.x1, C.z1 - C.t, C.z1, 0, C.h, 'nz');
    // innen liegende Seiten bekommen eigenes Material (für die Renovierung)
    const faceIdx = { px: 0, nx: 1, pz: 4, nz: 5 }; // BoxGeometry-Gruppen: +x,-x,+y,-y,+z,-z
    for (const w of walls) { const mats = w.m.material.slice(); mats[faceIdx[w.inner]] = this.innerWallMat; w.m.material = mats; }
    this.addBox(C.x0, C.x0 + C.t, C.z0, -dz); this.addBox(C.x0, C.x0 + C.t, dz, C.z1);
    this.addBox(C.x1 - C.t, C.x1, C.z0, C.z1); this.addBox(C.x0, C.x1, C.z0, C.z0 + C.t); this.addBox(C.x0, C.x1, C.z1 - C.t, C.z1);
    // Sockel, Dachkante
    outer.add(mesh(box(C.x1 - C.x0 + 0.2, 0.3, C.z1 - C.z0 + 0.2, 0.03), M('#7d7a74'), (C.x0 + C.x1) / 2, 0.15, 0));
    // Innenboden
    this.floorMat = new THREE.MeshStandardMaterial({ map: TEX.concrete, roughness: 0.92 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(I.x1 - I.x0, I.z1 - I.z0), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set((I.x0 + I.x1) / 2, 0.02, 0); floor.receiveShadow = true; s.add(floor);
    // Decke + Dach (Dach wird ausgeblendet, wenn man drinnen ist)
    this.roof = new THREE.Group();
    this.roof.add(mesh(box(C.x1 - C.x0 + 0.3, 0.35, C.z1 - C.z0 + 0.3, 0.04), M('#6f6c66'), (C.x0 + C.x1) / 2, C.h + 0.17, 0));
    this.roof.add(mesh(box(1.2, 0.8, 1.2, 0.05), M('#8a8780'), 11, C.h + 0.75, -3.5));
    s.add(this.roof);
    this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(I.x1 - I.x0, I.z1 - I.z0), new THREE.MeshStandardMaterial({ color: '#77746e', roughness: 1, side: THREE.BackSide }));
    this.ceiling.rotation.x = -Math.PI / 2; this.ceiling.position.set((I.x0 + I.x1) / 2, C.h - 0.01, 0); s.add(this.ceiling);
    // Fenster (verschmutzt, mit Brettern)
    for (const z of [-3.3, 3.3]) {
      const fw = new THREE.Group();
      fw.add(mesh(box(0.1, 1.3, 1.5, 0.02), M('#5a5a5a'), 0, 0, 0));
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), new THREE.MeshStandardMaterial({ map: TEX.dirtyWindow, roughness: 0.3 }));
      gl.rotation.y = -Math.PI / 2; gl.position.x = -0.06; fw.add(gl);
      const b1 = mesh(box(0.06, 0.16, 1.7, 0.01), M('#7a5a3a'), -0.1, 0.2, 0); b1.rotation.x = 0.25; fw.add(b1);
      const b2 = mesh(box(0.06, 0.16, 1.7, 0.01), M('#6b4e33'), -0.1, -0.25, 0); b2.rotation.x = -0.2; fw.add(b2);
      fw.position.set(C.x0 - 0.01, 1.6, z); outer.add(fw);
    }
    // Türrahmen
    outer.add(mesh(box(0.18, 2.55, 0.14, 0.02), M('#4a4038'), C.x0 - 0.05, 1.27, -dz - 0.05), mesh(box(0.18, 2.55, 0.14, 0.02), M('#4a4038'), C.x0 - 0.05, 1.27, dz + 0.05), mesh(box(0.18, 0.14, C.doorW + 0.24, 0.02), M('#4a4038'), C.x0 - 0.05, 2.47, 0));
    outer.add(mesh(box(1.4, 0.14, 2.2, 0.03), M('#8e8a82'), C.x0 - 0.75, 0.07, 0)); // Stufe
    // Müll / Verfall draußen
    outer.add(mesh(box(0.5, 0.35, 0.4, 0.04), M('#6b6b6b'), C.x0 - 0.6, 0.18, -3.9));
    for (let i = 0; i < 6; i++) outer.add(mesh(new THREE.IcosahedronGeometry(0.12, 0), M('#7b7468'), C.x0 - 0.5 - (i % 3) * 0.3, 0.08, 4 - i * 0.2));
    const ob = bake(outer); s.add(ob); this.blockers.push(...ob.children); this.facade = ob;
    // Tür (Drehpunkt an der Angel)
    this.door = new THREE.Group();
    this.door.position.set(C.x0 + C.t / 2, 0, -dz);
    this.doorMesh = mesh(box(0.08, 2.35, C.doorW - 0.04, 0.02), new THREE.MeshStandardMaterial({ map: TEX.door, roughness: 0.85 }), 0, 1.19, dz);
    this.door.add(this.doorMesh);
    this.door.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), M('#b8a070', { metalness: 0.6, roughness: 0.4 }), -0.07, 1.15, C.doorW - 0.2));
    s.add(this.door);
    this.doorAngle = 0; this.doorTarget = 0;
    // Schild CASINO (schief, flackernd)
    this.sign = new THREE.Group();
    this.sign.position.set(C.x0 - 0.12, C.h + 0.75, 0.3);
    this.sign.rotation.y = -Math.PI / 2;
    this.signTilt = 0.13; this.sign.rotation.z = this.signTilt;
    this.sign.add(mesh(box(4.3, 1.1, 0.16, 0.05), M('#2a2622'), 0, 0, -0.05));
    this.sign.add(mesh(box(4.45, 0.08, 0.2, 0.02), M('#6a5a40', { metalness: 0.5 }), 0, -0.55, -0.02));
    this.letters = [];
    'CASINO'.split('').forEach((ch, i) => {
      const t = document.createElement('canvas'); t.width = 128; t.height = 160;
      const c = t.getContext('2d'); c.font = 'bold 140px "Lilita One", Arial Black, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(ch, 64, 88);
      const tex = new THREE.CanvasTexture(t); tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, color: '#ffd9a0', emissive: '#ffb347', emissiveMap: tex, emissiveIntensity: 0.2 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), mat);
      m.position.set(-1.68 + i * 0.67, 0.02, 0.05);
      if (i === 4) { m.rotation.z = -0.35; m.position.y = -0.12; } // ein Buchstabe hängt schief
      this.sign.add(m);
      this.letters.push({ m, mat, dead: i === 1 || i === 4, flick: i === 3 });
    });
    for (const sx of [-1.6, 1.6]) this.sign.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), M('#555'), sx, -0.9, -0.1));
    s.add(this.sign);
    this.signGlow = new THREE.PointLight('#ffb347', 0, 9, 1.5); this.signGlow.position.set(C.x0 - 1.4, C.h + 0.6, 0.3); s.add(this.signGlow);
    this.blockers.push(this.sign.children[0]);
    // Innen: alte Deckenlampen
    this.ceilingLamps = [];
    for (const [x, z] of [[7.8, -2.6], [7.8, 2.6], [10.6, -2.6], [10.6, 2.6]]) {
      const g = new THREE.Group(); g.position.set(x, C.h, z);
      g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), M('#333'), 0, -0.25, 0, false));
      const shade = mesh(new THREE.ConeGeometry(0.32, 0.22, 14, 1, true), M('#5d5f5a', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 }), 0, -0.55, 0, false);
      g.add(shade);
      const bulb = mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#ffd27a', emissiveIntensity: 0.6 }), 0, -0.63, 0, false);
      g.add(bulb);
      s.add(g);
      this.ceilingLamps.push({ g, bulb, broken: x > 10 && z > 0 });
    }
    this.lights = [new THREE.PointLight('#ffd9a0', 12, 10, 1.4), new THREE.PointLight('#ffd9a0', 9, 10, 1.4)];
    this.lights[0].position.set(7.8, 3, 0); this.lights[1].position.set(10.6, 3, -1.5);
    for (const l of this.lights) s.add(l);
    // Spinnweben + Staub-Ecken
    for (const [x, z, ry] of [[I.x1 - 0.01, I.z0 + 0.01, Math.PI * 0.75], [I.x1 - 0.01, I.z1 - 0.01, -Math.PI * 0.75]]) {
      const cw = new THREE.Mesh(new THREE.CircleGeometry(0.6, 3, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ddd', transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
      cw.position.set(x, C.h - 0.02, z); cw.rotation.set(-Math.PI / 2, 0, ry); s.add(cw); this.cobwebs = (this.cobwebs || []).concat(cw);
    }
    // Eröffnungs-Hebel (Sicherungskasten) an der Vorderwand innen
    const lb = new THREE.Group(); lb.position.copy(LEVER_POS);
    lb.add(mesh(box(0.12, 0.6, 0.45, 0.03), M('#4a4f55', { metalness: 0.4 }), 0.06, 0, 0));
    this.leverArm = new THREE.Group(); this.leverArm.position.set(0.14, 0, 0);
    this.leverArm.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6), M('#ccc', { metalness: 0.7 }), 0, 0.14, 0));
    this.leverArm.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), M('#e33'), 0, 0.28, 0));
    this.leverArm.rotation.z = 0.7;
    lb.add(this.leverArm); s.add(lb);
    this.leverLamp = mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshStandardMaterial({ color: '#600', emissive: '#f00', emissiveIntensity: 0.4 }), 0.13, 0.22, 0.15);
    lb.add(this.leverLamp);
    // Erkundungs-Punkte
    this.explorePts = [new THREE.Vector3(11.6, 0, -4.1), new THREE.Vector3(11.6, 0, 4.1), new THREE.Vector3(9, 0, 0)];
    this.exploreMarks = this.explorePts.map((p) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.04, p.z); m.visible = false; s.add(m); return m;
    });
  }

  // ------------------------------------------------------- Renovierungen ---
  applyRepairs(rep, open) {
    // erst alles in den alten Zustand, dann Renovierungen anwenden
    const W = this.innerWallMat;
    W.map = rep.walls ? TEX.wallpaper : TEX.plaster; W.color.set(rep.walls ? '#ffffff' : '#9a9893'); W.roughness = rep.walls ? 0.7 : 0.95; W.needsUpdate = true;
    this.cobwebs?.forEach((c) => (c.visible = !rep.walls));
    this.floorMat.map = rep.floor ? TEX.carpet : TEX.concrete; this.floorMat.needsUpdate = true;
    this.ceilingLamps.forEach((l, i) => { l.broken = !rep.lights && i === 3; l.g.children[1].material = rep.lights ? M('#e8b730', { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }) : M('#5d5f5a', { side: THREE.DoubleSide, metalness: 0.4, roughness: 0.6 }); });
    this.lights.forEach((l, i) => { l.intensity = rep.lights ? 20 : [12, 9][i]; l.color.set(rep.lights ? '#ffcf8a' : '#ffd9a0'); });
    this.signTilt = rep.sign ? 0 : 0.13; this.sign.rotation.z = this.signTilt;
    const cols = ['#ff4d6d', '#ffd23f', '#4dd9ff', '#8cff66', '#ff8fd8', '#ffd23f'];
    this.letters.forEach((L, i) => {
      L.dead = !rep.sign && (i === 1 || i === 4); L.flick = !rep.sign && i === 3;
      L.mat.color.set(rep.sign ? cols[i] : '#ffd9a0'); L.mat.emissive.set(rep.sign ? cols[i] : '#ffb347');
      if (i === 4) { L.m.rotation.z = rep.sign ? 0 : -0.35; L.m.position.y = rep.sign ? 0.02 : -0.12; }
    });
    if (!this.oldDoorMat) this.oldDoorMat = this.doorMesh.material;
    this.doorMesh.material = rep.door ? M('#7a1424', { roughness: 0.4 }) : this.oldDoorMat;
    if (!this.doorTrim) { this.doorTrim = mesh(box(0.1, 2.0, 0.08, 0.02), M('#e8b730', { metalness: 0.8, roughness: 0.3 }), -0.01, 0, -0.55); this.doorMesh.add(this.doorTrim); }
    this.doorTrim.visible = !!rep.door;
    this.open = open;
    this.leverArm.rotation.z = open ? -0.7 : 0.7;
    this.leverLamp.material.color.set(open ? '#063' : '#600'); this.leverLamp.material.emissive.set(open ? '#0f6' : '#f00');
  }

  // Tür & Effekte pro Frame
  update(dt, t, night) {
    this.doorAngle += (this.doorTarget - this.doorAngle) * Math.min(1, dt * 6);
    this.door.rotation.y = this.doorAngle;
    for (const L of this.letters) {
      let k = this.open ? 1.6 : 0.5;
      if (L.dead) k = 0.03;
      else if (L.flick) k *= Math.sin(t * 23) * Math.sin(t * 7.3) > 0.2 ? 0.05 : 1;
      if (!this.open && !L.dead && Math.sin(t * 1.7 + L.m.position.x * 3) > 0.97) k *= 0.2;
      L.mat.emissiveIntensity = k * (night ? 1.6 : 1);
    }
    if (!this.open) this.sign.rotation.z = this.signTilt + Math.sin(t * 0.9) * 0.008;
    for (const [i, l] of this.ceilingLamps.entries()) {
      let k = 0.6;
      if (l.broken) k = Math.sin(t * 31 + i) * Math.sin(t * 5.1) > 0.4 ? 0.9 : 0.02;
      l.bulb.material.emissiveIntensity = k;
    }
    const fl = this.ceilingLamps[3].broken ? (Math.sin(t * 31 + 3) * Math.sin(t * 5.1) > 0.4 ? 1 : 0.55) : 1;
    this.lights[1].intensity = (this.lights[0].intensity > 15 ? 20 : 9) * fl;
    for (const a of this.anim) if (a.bulb) a.bulb.material.emissiveIntensity = night ? 2.2 : 0.25;
    this.signGlow.intensity = night ? (this.open ? 14 : 6 + Math.sin(t * 23) * Math.sin(t * 7.3) * 2) : 0;
    this.exploreMarks.forEach((m, i) => { m.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.12); m.material.opacity = 0.55 + Math.sin(t * 4 + i) * 0.25; });
  }

  // Diorama-Schnitt: Wände zwischen Kamera und Raum ausblenden
  setCutaway(cam) {
    let frontHidden = false;
    for (const w of this.cutWalls) {
      const outside = cam && (w.nx ? (cam.x - w.d) * w.nx > -0.05 : (cam.z - w.d) * w.nz > -0.05);
      w.m.visible = !outside;
      if (outside && w.nx === -1) frontHidden = true;
    }
    this.door.visible = !frontHidden; this.sign.visible = !frontHidden; this.facade.visible = !frontHidden;
    this.ceiling.visible = !cam; this.roof.visible = !cam;
    for (const l of this.ceilingLamps) l.g.visible = !cam;
    this.cobwebs?.forEach((c) => (c.visible = !cam && this.innerWallMat.map !== TEX.wallpaper));
  }

  doorBox() { // Kollisionsbox der geschlossenen Tür
    if (this.doorAngle > 0.6) return null;
    return { x0: CASINO.x0, x1: CASINO.x0 + CASINO.t, z0: -CASINO.doorW / 2, z1: CASINO.doorW / 2 };
  }
}

// Kreis gegen Rechtecke schieben (einfache, robuste Kollision)
export function resolveCircle(p, r, boxes) {
  for (let it = 0; it < 3; it++) {
    for (const b of boxes) {
      if (!b) continue;
      const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += (dx / d) * push; p.z += (dz / d) * push; }
      else { // Mittelpunkt im Rechteck: zur nächsten Kante raus
        const opts = [[p.x - b.x0, -1, 0], [b.x1 - p.x, 1, 0], [p.z - b.z0, 0, -1], [b.z1 - p.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        p.x += opts[1] * (opts[0] + r); p.z += opts[2] * (opts[0] + r);
      }
    }
  }
  p.x = Math.max(BOUNDS.x0 + r, Math.min(BOUNDS.x1 - r, p.x));
  p.z = Math.max(BOUNDS.z0 + r, Math.min(BOUNDS.z1 - r, p.z));
  return p;
}
export function insideCasino(x, z, m = 0) { return x > INTERIOR.x0 + m && x < INTERIOR.x1 - m && z > INTERIOR.z0 + m && z < INTERIOR.z1 - m; }
