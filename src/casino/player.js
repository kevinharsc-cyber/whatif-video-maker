// PlayerController + CameraController (Third-Person)
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { resolveCircle, insideCasino, BOUNDS } from './world.js';

const SPEED = 3.3, ACCEL = 12, RADIUS = 0.32;

export class PlayerController {
  constructor(scene) {
    this.p = makePerson({ shirt: '#e76f51', pants: '#264653', hair: '#3b2a1a', vest: '#2a9d8f' });
    this.obj = this.p.group; scene.add(this.obj);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector2(); this.yaw = 0; this.phase = 0; this.amount = 0;
    this.inside = false; this.frozen = false;
  }
  place(x, z, yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.vel.set(0, 0); this.sync(); }
  sync() { this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw; }
  // move = Eingabe relativ zur Kamera
  update(dt, move, camYaw, boxes, t) {
    let wx = 0, wz = 0;
    if (!this.frozen) {
      // Kamera-Blickrichtung (nach vorne = von der Kamera weg)
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wx = (fx * move.y + rx * move.x) * SPEED; wz = (fz * move.y + rz * move.x) * SPEED;
    }
    const k = Math.min(1, dt * ACCEL);
    this.vel.x += (wx - this.vel.x) * k; this.vel.y += (wz - this.vel.y) * k;
    const before = this.pos.clone();
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
    resolveCircle(this.pos, RADIUS, boxes);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    const sp = Math.hypot(this.vel.x, this.vel.y);
    if (sp > 0.15) { // in Laufrichtung drehen (weich)
      const target = Math.atan2(this.vel.x, this.vel.y);
      let d = target - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * Math.min(1, dt * 12);
    }
    // Animation an zurückgelegten Weg koppeln -> kein Rutschen
    this.phase += moved * 4.4;
    this.amount += (Math.min(1, moved / dt / SPEED) - this.amount) * Math.min(1, dt * 10);
    animatePerson(this.p, this.phase, this.amount, t);
    this.inside = insideCasino(this.pos.x, this.pos.z, -0.05);
    this.sync();
  }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
}

export class CameraController {
  constructor(camera) {
    this.cam = camera; this.yaw = Math.PI / 2 + Math.PI; this.pitch = 0.42; this.dist = 4.6; this.curDist = 4.6;
    this.target = new THREE.Vector3(); this.ray = new THREE.Raycaster(); this.blockers = [];
    this.cin = null; // Kamerafahrt { from:{p,l}, t, dur }
  }
  snapBehind(player) { this.yaw = player.yaw + Math.PI; this.target.copy(player.pos).setY(1.25); }
  update(dt, player, look, autoFollow) {
    this.yaw -= look.x * 0.006; this.pitch = Math.max(0.12, Math.min(1.15, this.pitch + look.y * 0.004));
    // sanft hinter den Spieler drehen, wenn er läuft und nicht gewischt wird
    if (autoFollow && player.amount > 0.5) {
      const want = player.yaw + Math.PI; let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < 2.4) this.yaw += d * Math.min(1, dt * 0.9);
    }
    const tgt = player.pos.clone().setY(1.25);
    this.target.lerp(tgt, Math.min(1, dt * 10));
    const want = player.inside ? 6.4 : this.dist;
    if (player.inside && this.pitch < 0.82) this.pitch += (0.82 - this.pitch) * Math.min(1, dt * 4);
    const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    // Kollision: nicht durch Wände/Häuser schauen
    let d = want;
    this.ray.set(this.target, dir); this.ray.far = want + 0.3;
    const hit = this.ray.intersectObjects(this.blockers, false)[0];
    if (hit && !player.inside) d = Math.max(0.9, hit.distance - 0.3);
    this.curDist += (d - this.curDist) * Math.min(1, dt * (d < this.curDist ? 18 : 4));
    const p = this.target.clone().addScaledVector(dir, this.curDist);
    if (!player.inside) p.x = Math.max(BOUNDS.x0 - 2, p.x); // drinnen: Diorama-Schnitt (Wände werden ausgeblendet)
    p.y = Math.max(0.4, p.y);
    if (this.cin) {
      const c = this.cin; c.t += dt; const k = Math.min(1, c.t / c.dur), e = k * k * (3 - 2 * k);
      this.cam.position.lerpVectors(c.from.p, p, e);
      const l = new THREE.Vector3().lerpVectors(c.from.l, this.target, e);
      this.cam.lookAt(l);
      if (k >= 1) this.cin = null;
      return;
    }
    this.cam.position.copy(p);
    this.cam.lookAt(this.target);
  }
}
