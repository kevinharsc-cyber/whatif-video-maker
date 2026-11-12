// PlayerController + CameraController (Ego-Perspektive)
import * as THREE from 'three';
import { makePerson, animatePerson } from './models.js';
import { resolveCircle, insideCasino } from './world.js';

const SPEED = 3.0, ACCEL = 12, RADIUS = 0.3;
export const EYE = 1.62;

export class PlayerController {
  constructor(scene) {
    // Körper existiert, ist in der Ego-Sicht aber unsichtbar
    this.p = makePerson({ shirt: '#e76f51', pants: '#264653', hair: '#3b2a1a', vest: '#2a9d8f' });
    this.obj = this.p.group; this.obj.visible = false; scene.add(this.obj);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector2(); this.yaw = 0; this.phase = 0; this.amount = 0;
    this.inside = false; this.frozen = false;
  }
  place(x, z, yaw) { this.pos.set(x, 0, z); this.yaw = yaw; this.vel.set(0, 0); this.sync(); }
  sync() { this.obj.position.copy(this.pos); this.obj.rotation.y = this.yaw; }
  // move = Eingabe relativ zur Blickrichtung (x = seitlich, y = vorwärts)
  update(dt, move, camYaw, boxes, t) {
    let wx = 0, wz = 0;
    if (!this.frozen) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wx = (fx * move.y + rx * move.x) * SPEED; wz = (fz * move.y + rz * move.x) * SPEED;
    }
    const k = Math.min(1, dt * ACCEL);
    this.vel.x += (wx - this.vel.x) * k; this.vel.y += (wz - this.vel.y) * k;
    const bx = this.pos.x, bz = this.pos.z;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.y * dt;
    resolveCircle(this.pos, RADIUS, boxes);
    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    this.yaw = camYaw + Math.PI; // Körper schaut wie die Kamera
    this.phase += moved * 4.2;
    this.amount += (Math.min(1, moved / Math.max(dt, 1e-4) / SPEED) - this.amount) * Math.min(1, dt * 10);
    animatePerson(this.p, this.phase, this.amount, t);
    this.inside = insideCasino(this.pos.x, this.pos.z, -0.05);
    this.sync();
  }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
}

export class CameraController {
  constructor(camera) {
    this.cam = camera; this.yaw = -Math.PI / 2; this.pitch = 0.05;
    this.cin = null; // Kamerafahrt { from:{p,l}, t, dur }
    this.dir = new THREE.Vector3(0, 0, -1);
  }
  snapBehind(player) { this.yaw = player.yaw + Math.PI; this.pitch = -0.08; }
  lookDir() {
    const c = Math.cos(this.pitch);
    return this.dir.set(-Math.sin(this.yaw) * c, -Math.sin(this.pitch), -Math.cos(this.yaw) * c);
  }
  eye(player) {
    const bob = Math.sin(player.phase) * 0.035 * player.amount;
    return new THREE.Vector3(player.pos.x, EYE + Math.abs(bob), player.pos.z);
  }
  update(dt, player, look) {
    this.yaw -= look.x * 0.0055;
    this.pitch = Math.max(-1.25, Math.min(1.3, this.pitch + look.y * 0.0045));
    const e = this.eye(player);
    const target = e.clone().add(this.lookDir());
    if (this.cin) {
      const c = this.cin; c.t += dt; const k = Math.min(1, c.t / c.dur), s = k * k * (3 - 2 * k);
      this.cam.position.lerpVectors(c.from.p, e, s);
      this.cam.lookAt(new THREE.Vector3().lerpVectors(c.from.l, target, s));
      if (k >= 1) this.cin = null;
      return;
    }
    this.cam.position.copy(e);
    this.cam.lookAt(target);
  }
}
