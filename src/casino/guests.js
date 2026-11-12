// Gäste: kommen die Straße entlang, spielen an freien Automaten, zahlen, gehen wieder
import * as THREE from 'three';
import { makePerson, animatePerson, rng } from './models.js';
import { resolveCircle, CASINO, INTERIOR } from './world.js';
import { CATALOG } from './economy.js';

const LOOKS = [
  { shirt: '#8e44ad', pants: '#2c3e50', hair: '#d9d9d9', bun: true, glasses: true },
  { shirt: '#27ae60', pants: '#34495e', hair: '#222', hat: '#5a3a22' },
  { shirt: '#f1c40f', pants: '#2d3436', hair: '#8b5a2b' },
  { shirt: '#3498db', pants: '#1e272e', bald: true, beard: true, hair: '#bbb' },
  { shirt: '#e84393', pants: '#2d3436', hair: '#e1b382', bun: true },
  { shirt: '#ffffff', pants: '#2c3e50', hair: '#4a3020', vest: '#c0392b', glasses: true },
];

export class GuestManager {
  constructor(scene, objects, economy, onPay) {
    this.scene = scene; this.objects = objects; this.eco = economy; this.onPay = onPay;
    this.list = []; this.spawnT = 3; this.r = rng(4242); this.n = 0;
  }
  clear() { for (const g of this.list) this.scene.remove(g.p.group); this.list = []; }
  maxGuests() { return Math.min(this.objects.machines().length + 1, 2 + Math.floor(this.eco.attractiveness() / 2) + this.objects.machines().length); }
  spawn() {
    const look = LOOKS[this.n++ % LOOKS.length];
    const p = makePerson({ ...look, skin: ['#f1c7a1', '#d9a47c', '#a86f4c', '#f6d5b8'][Math.floor(this.r() * 4)] });
    const side = this.r() < 0.5 ? -1 : 1;
    const g = { p, pos: new THREE.Vector3(3.9, 0, side * 27), yaw: 0, phase: 0, amount: 0, state: 'toDoor', target: null, wait: 0, machine: null, speed: 1.5 + this.r() * 0.4, side };
    p.group.position.copy(g.pos); this.scene.add(p.group); this.list.push(g);
  }
  freeMachine() {
    const ms = this.objects.machines().filter((m) => !m.user);
    if (!ms.length) return null;
    return ms[Math.floor(this.r() * ms.length)];
  }
  update(dt, t, open, boxes) {
    if (open && this.objects.machines().length) {
      this.spawnT -= dt;
      const busy = this.list.length;
      if (this.spawnT <= 0 && busy < this.maxGuests()) { this.spawn(); this.spawnT = Math.max(3, 11 - this.eco.attractiveness() * 0.5) * (0.7 + this.r() * 0.6); }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      let goal = null;
      const door = new THREE.Vector3(CASINO.x0 - 0.9, 0, 0), inside = new THREE.Vector3(INTERIOR.x0 + 0.8, 0, 0);
      switch (g.state) {
        case 'toDoor': goal = door; if (dist(g.pos, door) < 0.4) g.state = 'enter'; break;
        case 'enter': goal = inside; if (dist(g.pos, inside) < 0.4) { g.machine = this.freeMachine(); if (g.machine) { g.machine.user = g; g.state = 'toMachine'; } else { g.state = 'wander'; g.wait = 4; g.target = new THREE.Vector3(8 + this.r() * 3, 0, (this.r() - 0.5) * 6); } } break;
        case 'wander': goal = g.target; g.wait -= dt; if (g.wait <= 0) { g.machine = this.freeMachine(); if (g.machine) { g.machine.user = g; g.state = 'toMachine'; } else g.state = 'leave'; } break;
        case 'toMachine': {
          if (!this.objects.items.includes(g.machine)) { g.machine = null; g.state = 'leave'; break; }
          goal = this.objects.front(g.machine, 0.75);
          if (dist(g.pos, goal) < 0.25) { g.state = 'play'; const pt = CATALOG[g.machine.data.type].playTime; g.wait = pt[0] + this.r() * (pt[1] - pt[0]); g.machine.spinT = 1.6; g.spinCd = 2.4; }
          break;
        }
        case 'play': {
          if (!this.objects.items.includes(g.machine)) { g.machine = null; g.state = 'leave'; break; }
          const r = (g.machine.data.rot * Math.PI) / 2; g.yaw = r + Math.PI;
          g.wait -= dt; g.spinCd -= dt;
          if (g.spinCd <= 0) { g.machine.spinT = 1.6; g.spinCd = 2.6; }
          if (g.wait <= 0) {
            const amount = CATALOG[g.machine.data.type].income * this.eco.incomeMult();
            this.onPay(g.machine, amount);
            g.machine.user = null; g.machine = null; g.state = 'leave';
          }
          break;
        }
        case 'leave': goal = this.leaveStep(g); break;
      }
      if (g.state === 'gone') { this.scene.remove(g.p.group); this.list.splice(i, 1); continue; }
      const before = g.pos.clone();
      if (goal && g.state !== 'play') {
        const dx = goal.x - g.pos.x, dz = goal.z - g.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          const s = Math.min(d, g.speed * dt);
          g.pos.x += (dx / d) * s; g.pos.z += (dz / d) * s;
          let dy = Math.atan2(dx, dz) - g.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); g.yaw += dy * Math.min(1, dt * 8);
        }
        if (g.state === 'toMachine' || g.state === 'wander') resolveCircle(g.pos, 0.25, boxes);
      }
      const moved = Math.hypot(g.pos.x - before.x, g.pos.z - before.z);
      g.phase += moved * 4.4; g.amount += (Math.min(1, moved / dt / g.speed) - g.amount) * Math.min(1, dt * 8);
      animatePerson(g.p, g.phase, g.amount, t + i);
      if (g.state === 'play') { g.p.arms[1].rotation.x = -1.1 + Math.sin(t * 6) * 0.1; }
      g.p.group.position.copy(g.pos); g.p.group.rotation.y = g.yaw;
    }
  }
  leaveStep(g) {
    if (!g.leaveStage) g.leaveStage = 1;
    const pts = [null, new THREE.Vector3(INTERIOR.x0 + 0.8, 0, 0), new THREE.Vector3(CASINO.x0 - 0.9, 0, 0), new THREE.Vector3(3.9, 0, g.side * 28)];
    const goal = pts[g.leaveStage];
    if (dist(g.pos, goal) < 0.4) { g.leaveStage++; if (g.leaveStage > 3) g.state = 'gone'; }
    return goal;
  }
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
