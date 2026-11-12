// InteractionSystem – Ego-Sicht: benutzt wird, was man anschaut (Fadenkreuz in der Mitte)
import * as THREE from 'three';

const _v = new THREE.Vector3();
export class InteractionSystem {
  constructor() { this.items = []; this.current = null; }
  register(item) { this.items.push(item); return item; } // { id, pos(), y?, radius, label(), enabled(), act(), kind? }
  unregister(id) { this.items = this.items.filter((i) => i.id !== id); }
  // eye = Augenposition, dir = Blickrichtung; filter = welche Dinge gerade zählen
  pick(eye, dir, filter = () => true) {
    let best = null, bs = -1;
    for (const it of this.items) {
      if (!filter(it)) continue;
      if (it.enabled && !it.enabled()) continue;
      const p = it.pos();
      const hd = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (hd > it.radius) continue;
      _v.set(p.x - eye.x, (it.y ?? 1.0) - eye.y, p.z - eye.z);
      const d = _v.length(); if (d < 1e-3) continue;
      const dot = _v.dot(dir) / d;
      const need = hd < 0.9 ? 0.55 : 0.82; // ganz nah: großzügiger
      if (dot < need) continue;
      const score = dot - hd * 0.04;
      if (score > bs) { bs = score; best = it; }
    }
    return best;
  }
  update(eye, dir, filter) { this.current = this.pick(eye, dir, filter); return this.current; }
  trigger() { if (this.current) this.current.act(); }
}
