// Platzierte Objekte + ObjectPlacementSystem (Aufstellen, Drehen, Aufheben)
import * as THREE from 'three';
import { makeSlot, makeCounter, makeChair, makeFloorLamp, makePlant, makeRug, makeStatue } from './models.js';
import { CATALOG } from './economy.js';
import { INTERIOR, DOOR_ZONE, LEVER_POS } from './world.js';

const MAKERS = { slot: () => makeSlot('classic'), deluxe: () => makeSlot('deluxe'), counter: makeCounter, chair: makeChair, lamp: makeFloorLamp, plant: makePlant, rug: makeRug, statue: makeStatue };
export const ROT = (r) => (r * Math.PI) / 2;

export function footprint(type, x, z, rot) {
  const [w, d] = CATALOG[type].size;
  const hw = (rot % 2 ? d : w) / 2, hd = (rot % 2 ? w : d) / 2;
  return { x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd };
}
const overlap = (a, b, m = 0) => a.x0 < b.x1 + m && a.x1 > b.x0 - m && a.z0 < b.z1 + m && a.z1 > b.z0 - m;

export class ObjectManager {
  constructor(scene) { this.scene = scene; this.items = []; this.lights = []; }
  add(data) {
    const obj = MAKERS[data.type]();
    obj.position.set(data.x, 0, data.z); obj.rotation.y = ROT(data.rot);
    this.scene.add(obj);
    const it = { data, obj, ud: obj.userData, spin: 0, spinT: 0, user: null, blink: 0 };
    this.items.push(it);
    return it;
  }
  remove(it) { this.scene.remove(it.obj); this.items = this.items.filter((x) => x !== it); }
  clear() { for (const it of this.items) this.scene.remove(it.obj); this.items = []; }
  boxes() { return this.items.filter((it) => !CATALOG[it.data.type].walkable).map((it) => footprint(it.data.type, it.data.x, it.data.z, it.data.rot)); }
  front(it, dist = 0.8) { const r = ROT(it.data.rot); return new THREE.Vector3(it.data.x + Math.sin(r) * dist, 0, it.data.z + Math.cos(r) * dist); }
  machines() { return this.items.filter((it) => it.data.type === 'slot' || it.data.type === 'deluxe'); }
  // Walzen drehen, Lampe blinken
  update(dt, t) {
    for (const it of this.items) {
      const u = it.ud;
      if (!u.reels) continue;
      if (it.spinT > 0) {
        it.spinT -= dt;
        u.reels.forEach((tex, i) => { if (it.spinT > 0.25 * (2 - i)) tex.offset.y = (tex.offset.y + dt * (3.2 + i * 0.4)) % 1; else tex.offset.y = Math.round(tex.offset.y * 8) / 8; });
        u.lever.rotation.x = Math.max(0, it.spinT > 1.0 ? 1 : 0) * 0.9;
      } else u.lever.rotation.x *= 0.85;
      const playing = it.user || it.spinT > 0;
      u.lamp.material.emissiveIntensity = playing ? (Math.sin(t * 12) > 0 ? 2.2 : 0.4) : 0.5 + Math.sin(t * 2 + it.data.x) * 0.15;
    }
  }
}

// Geister-Vorschau beim Aufstellen
const okMat = new THREE.MeshStandardMaterial({ color: '#55e07a', transparent: true, opacity: 0.55, emissive: '#1a6b2e', depthWrite: false });
const badMat = new THREE.MeshStandardMaterial({ color: '#ff5a5a', transparent: true, opacity: 0.55, emissive: '#6b1a1a', depthWrite: false });

export class ObjectPlacementSystem {
  constructor(scene, objects) {
    this.scene = scene; this.objects = objects; this.active = null;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.72, 4, 1), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; scene.add(this.ring);
  }
  start(type, src = null) {
    this.cancel(true);
    const ghost = MAKERS[type]();
    ghost.traverse((o) => { if (o.isMesh) { o.material = okMat; o.castShadow = false; } });
    this.scene.add(ghost);
    // rotOff: zusätzliche Drehung durch den Spieler (Standard: Vorderseite schaut zu dir)
    this.active = { type, ghost, rot: 0, rotOff: 0, x: 0, z: 0, ok: false, src };
    if (src) src.obj.visible = false;
  }
  rotate() { if (this.active) this.active.rotOff = (this.active.rotOff + 1) % 4; }
  cancel(silent) {
    if (!this.active) return null;
    const a = this.active;
    this.scene.remove(a.ghost);
    if (a.src) a.src.obj.visible = true;
    this.active = null; this.ring.visible = false;
    return silent ? null : a;
  }
  // Ego-Sicht: Objekt erscheint dort, wo das Fadenkreuz den Boden trifft
  update(eye, dir, camYaw, player) {
    const a = this.active; if (!a) return;
    let dist = 4.5;
    if (dir.y < -0.05) dist = Math.min(4.5, ((eye.y - 0.02) / -dir.y) * Math.hypot(dir.x, dir.z));
    const [w, d] = CATALOG[a.type].size;
    dist = Math.max(0.55 + Math.max(w, d) / 2, dist);
    const h = Math.max(1e-6, Math.hypot(dir.x, dir.z));
    const x = eye.x + (dir.x / h) * dist, z = eye.z + (dir.z / h) * dist;
    // auf 0,25-m-Raster einrasten
    a.x = Math.round(x * 4) / 4; a.z = Math.round(z * 4) / 4;
    const auto = ((Math.round(camYaw / (Math.PI / 2)) % 4) + 4) % 4; // Vorderseite zeigt zum Spieler
    a.rot = (auto + a.rotOff) % 4;
    a.ghost.position.set(a.x, 0.02, a.z); a.ghost.rotation.y = ROT(a.rot);
    a.ok = this.valid(a.type, a.x, a.z, a.rot, a.src, player);
    const mat = a.ok ? okMat : badMat;
    a.ghost.traverse((o) => { if (o.isMesh) o.material = mat; });
    this.ring.visible = true; this.ring.position.set(a.x, 0.03, a.z);
    const fp = footprint(a.type, 0, 0, a.rot);
    this.ring.scale.set((fp.x1 - fp.x0) * 0.8, (fp.z1 - fp.z0) * 0.8, 1); this.ring.rotation.z = Math.PI / 4;
    this.ring.material.color.set(a.ok ? '#7dffa0' : '#ff7d7d');
  }
  valid(type, x, z, rot, src, player) {
    const fp = footprint(type, x, z, rot), I = INTERIOR, m = 0.05;
    if (fp.x0 < I.x0 + m || fp.x1 > I.x1 - m || fp.z0 < I.z0 + m || fp.z1 > I.z1 - m) return false; // nur im Gebäude
    if (overlap(fp, DOOR_ZONE)) return false; // Eingang frei lassen
    if (overlap(fp, { x0: LEVER_POS.x, x1: LEVER_POS.x + 0.9, z0: LEVER_POS.z - 0.5, z1: LEVER_POS.z + 0.5 })) return false;
    const walk = !!CATALOG[type].walkable;
    for (const it of this.objects.items) {
      if (it === src) continue;
      if (walk !== !!CATALOG[it.data.type].walkable) continue; // Teppich darf unter Möbel
      if (overlap(fp, footprint(it.data.type, it.data.x, it.data.z, it.data.rot), 0.05)) return false;
    }
    if (!walk && player) { const p = player.pos; if (p.x > fp.x0 - 0.3 && p.x < fp.x1 + 0.3 && p.z > fp.z0 - 0.3 && p.z < fp.z1 + 0.3) return false; }
    return true;
  }
}
