// InteractionSystem – findet das nächste benutzbare Ding und zeigt den passenden Knopf
export class InteractionSystem {
  constructor() { this.items = []; this.current = null; }
  register(item) { this.items.push(item); return item; } // { id, pos(), radius, label(), enabled(), act() }
  unregister(id) { this.items = this.items.filter((i) => i.id !== id); }
  update(player) {
    let best = null, bd = 1e9;
    const f = player.forward();
    for (const it of this.items) {
      if (it.enabled && !it.enabled()) continue;
      const p = it.pos();
      const dx = p.x - player.pos.x, dz = p.z - player.pos.z, d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const facing = d < 0.5 ? 1 : (dx * f.x + dz * f.z) / d;
      if (facing < -0.25) continue; // muss ungefähr davor stehen
      const score = d - facing * 0.4;
      if (score < bd) { bd = score; best = it; }
    }
    this.current = best;
    return best;
  }
  trigger() { if (this.current) this.current.act(); }
}
