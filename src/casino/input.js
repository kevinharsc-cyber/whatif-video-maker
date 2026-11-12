// MobileJoystick (links unten) + Kamera-Wischen (rechte Hälfte) + Tastatur/Maus zum Testen am PC
export class MobileJoystick {
  constructor(base, knob) {
    this.base = base; this.knob = knob;
    this.x = 0; this.y = 0; // -1..1 (y = nach vorne)
    this.id = null; this.cx = 0; this.cy = 0; this.r = 52;
    this.enabled = true;
  }
  tryStart(t) {
    if (!this.enabled || this.id !== null) return false;
    const b = this.base.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    // großzügiger Greifbereich: linkes unteres Viertel
    if (t.clientX > window.innerWidth * 0.5 || t.clientY < window.innerHeight * 0.45) return false;
    this.id = t.identifier; this.cx = cx; this.cy = cy; this.r = b.width * 0.42;
    this.move(t);
    this.base.classList.add('on');
    return true;
  }
  move(t) {
    let dx = t.clientX - this.cx, dy = t.clientY - this.cy;
    const d = Math.hypot(dx, dy), m = this.r;
    if (d > m) { dx = (dx / d) * m; dy = (dy / d) * m; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const k = Math.min(1, d / m);
    const dead = 0.12, kk = k < dead ? 0 : (k - dead) / (1 - dead);
    this.x = d ? (dx / Math.max(d, 1e-6)) * kk : 0;
    this.y = d ? (-dy / Math.max(d, 1e-6)) * kk : 0;
  }
  end() { this.id = null; this.x = this.y = 0; this.knob.style.transform = ''; this.base.classList.remove('on'); }
}

export class InputManager {
  constructor(canvas, joy) {
    this.joy = joy; this.camDX = 0; this.camDY = 0; this.lookId = null; this.lx = 0; this.ly = 0; this.lastLook = 0;
    this.keys = new Set(); this.onInteract = null; this.sens = 1;
    const opts = { passive: false };
    const start = (e) => {
      for (const t of e.changedTouches) {
        if (e.target.closest && e.target.closest('button, .panel, .sheet')) continue;
        if (this.joy.tryStart(t)) continue;
        if (this.lookId === null && t.clientX > window.innerWidth * 0.35) { this.lookId = t.identifier; this.lx = t.clientX; this.ly = t.clientY; }
      }
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.move(t); e.preventDefault(); }
        else if (t.identifier === this.lookId) { this.camDX += t.clientX - this.lx; this.camDY += t.clientY - this.ly; this.lx = t.clientX; this.ly = t.clientY; this.lastLook = performance.now(); e.preventDefault(); }
      }
    };
    const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === this.joy.id) this.joy.end(); if (t.identifier === this.lookId) this.lookId = null; } };
    document.addEventListener('touchstart', start, opts);
    document.addEventListener('touchmove', move, opts);
    document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
    // Maus (PC)
    let drag = false;
    canvas.addEventListener('mousedown', () => { drag = true; });
    window.addEventListener('mouseup', () => { drag = false; });
    window.addEventListener('mousemove', (e) => { if (drag) { this.camDX += e.movementX; this.camDY += e.movementY; this.lastLook = performance.now(); } });
    window.addEventListener('keydown', (e) => { this.keys.add(e.key.toLowerCase()); if (e.key.toLowerCase() === 'e' && this.onInteract) this.onInteract(); });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
  }
  // Bewegungswunsch (x = rechts, y = vorne), -1..1
  move() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) y = 1; if (k.has('s') || k.has('arrowdown')) y = -1;
    if (k.has('a') || k.has('arrowleft')) x = -1; if (k.has('d') || k.has('arrowright')) x = 1;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  takeLook() { const d = { x: this.camDX * this.sens, y: this.camDY * this.sens }; this.camDX = this.camDY = 0; return d; }
  looking() { return this.lookId !== null || performance.now() - this.lastLook < 1200; }
}
