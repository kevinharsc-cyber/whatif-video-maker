// GRANDPA'S CASINO – Spielablauf (verbindet alle Systeme)
import * as THREE from 'three';
import { buildTextures } from './models.js';
import { World, CASINO, INTERIOR, LEVER_POS, insideCasino } from './world.js';
import { PlayerController, CameraController } from './player.js';
import { MobileJoystick, InputManager } from './input.js';
import { InteractionSystem } from './interact.js';
import { ObjectManager, ObjectPlacementSystem } from './placement.js';
import { GuestManager } from './guests.js';
import { EconomyManager, CATALOG, REPAIRS } from './economy.js';
import { QuestManager } from './quests.js';
import { SaveSystem, newState } from './save.js';
import { UIManager, $ } from './ui.js';
import { MainMenuManager } from './menu.js';
import { SFX, setSound, unlockAudio } from './audio.js';
import { Music } from './music.js';

class Game {
  constructor() {
    this.fast = new URLSearchParams(location.search).has('test');
    this.settings = SaveSystem.settings();
    // Renderer
    this.canvas = $('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 150);
    this.setupLights();
    buildTextures();
    this.world = new World(this.scene);
    this.objects = new ObjectManager(this.scene);
    this.placement = new ObjectPlacementSystem(this.scene, this.objects);
    this.interact = new InteractionSystem();
    this.player = new PlayerController(this.scene);
    this.cam = new CameraController(this.camera);
    this.cam.blockers = this.world.blockers;
    this.input = new InputManager(this.canvas, new MobileJoystick($('joy'), $('knob')));
    this.input.onInteract = () => this.pressAct();
    this.ui = new UIManager(this);
    this.menu = new MainMenuManager(this);
    this.state = newState();
    this.bindState();
    this.registerInteractions();
    this.bindHud();
    this.applySettings();
    window.addEventListener('resize', () => this.resize());
    const kick = () => { this.musicReady = true; if (this.settings.music && !document.hidden) Music.start(unlockAudio()); };
    document.addEventListener('touchend', kick, { once: true }); document.addEventListener('click', kick, { once: true });
    this.resize();
    this.mode = 'menu'; this.t = 0; this.saveT = 0;
    this.toMenu();
    this.last = performance.now();
    this.renderer.setAnimationLoop((now) => this.frame(now));
  }
  bindState() {
    this.eco = new EconomyManager(this.state);
    this.quests = new QuestManager(this.state, (q) => this.questDone(q));
    if (this.guests) this.guests.clear();
    this.guests = new GuestManager(this.scene, this.objects, this.eco, (m, amt) => this.guestPaid(m, amt));
  }
  setupLights() {
    this.hemi = new THREE.HemisphereLight('#fff1dc', '#5a4a3a', 0.9);
    this.sun = new THREE.DirectionalLight('#ffe2b8', 2.4);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    const sky = (top, mid, bot) => { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(0, 0, 4, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    this.skyDay = sky('#6fb6ef', '#bfe0f7', '#ffe9c9');
    this.skyNight = sky('#0b0a26', '#2a1a52', '#6a3a6a');
  }
  setNight(n) {
    this.night = n;
    this.scene.background = n ? this.skyNight : this.skyDay;
    this.scene.fog = new THREE.Fog(n ? '#2a1a4a' : '#f2e2c8', 28, 70);
    this.hemi.intensity = n ? 0.7 : 0.9; this.hemi.color.set(n ? '#8a8aff' : '#fff1dc');
    this.sun.intensity = n ? 0.45 : 2.4; this.sun.color.set(n ? '#9aa8ff' : '#ffe2b8');
    this.renderer.toneMappingExposure = n ? 1.15 : 1.0;
  }
  applySettings() {
    const s = this.settings;
    setSound(s.sound);
    if (this.musicReady) { if (s.music) Music.start(unlockAudio()); else Music.stop(); }
    this.input.sens = s.sens;
    const low = s.quality === 'low';
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !low;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    SaveSystem.saveSettings(s);
    this.resize();
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 72 : 60; this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------- Modi
  toMenu() {
    if (this.mode === 'play') this.save();
    this.mode = 'menu';
    ['hud', 'pause', 'shop', 'objPanel', 'intro'].forEach((id) => this.ui.show(id, false));
    this.placement.cancel(true);
    this.setNight(true);
    this.world.setCutaway(null);
    this.loadWorldState(SaveSystem.load() || newState(), true);
    this.menu.show();
  }
  newGame() { this.state = newState(); this.bindState(); this.loadWorldState(this.state); }
  loadGame() {
    const s = SaveSystem.load(); if (!s) return;
    this.state = s; this.bindState(); this.loadWorldState(s);
    this.menu.hide(); this.beginPlay(false);
    this.ui.toast('Spielstand geladen');
  }
  loadWorldState(s, menuOnly = false) {
    this.objects.clear(); this.guests.clear();
    this.interact.items = this.interact.items.filter((i) => !i.id.startsWith('obj'));
    this.placement.cancel(true); this.closePanel?.();
    for (const o of s.objects) this.registerObject(this.objects.add(o));
    this.world.applyRepairs(s.repairs, s.open);
    this.world.doorTarget = s.open ? 1.75 : 0; this.world.doorAngle = this.world.doorTarget;
    this.player.place(s.player.x, s.player.z, s.player.yaw);
    this.player.obj.visible = false; void menuOnly;
    this.setBuild(false);
  }
  beginPlay(intro) {
    this.mode = 'play';
    this.setNight(false);
    this.menu.hide(); this.ui.show('hud');
    this.cam.snapBehind(this.player); this.world.setCutaway(null);
    if (intro) { // Kamerafahrt aus der Luft
      this.cam.cin = { from: { p: new THREE.Vector3(-6, 12, -12), l: new THREE.Vector3(6, 1, 0) }, t: 0, dur: this.fast ? 0.1 : 3.2 };
      setTimeout(() => this.ui.toast('Willkommen in der Opas Straße!', true), this.fast ? 0 : 1600);
      this.save();
    }
    this.ui.hud();
  }
  pause(on) {
    if (this.mode !== 'play' && this.mode !== 'paused') return;
    this.mode = on ? 'paused' : 'play'; this.ui.show('pause', on);
  }
  save() { if (this.mode !== 'menu') { const p = this.player; this.state.player = { x: p.pos.x, z: p.pos.z, yaw: p.yaw }; } SaveSystem.save(this.state); }

  // ---------------------------------------------------------- HUD-Knöpfe
  bindHud() {
    $('btnMenu').onclick = () => { SFX.click(); this.pause(true); };
    $('pResume').onclick = () => { SFX.click(); this.pause(false); };
    $('pSave').onclick = () => { SFX.click(); this.save(); this.ui.toast('Gespeichert ✓'); };
    $('pSet').onclick = () => { SFX.click(); this.menu.openSettings(); };
    $('pMenu').onclick = () => { SFX.click(); this.toMenu(); };
    $('act').onclick = () => this.pressAct();
    $('build').onclick = () => { unlockAudio(); SFX.click(); this.setBuild(!this.building); };
    $('bStore').onclick = () => { SFX.click(); if (this.buildTarget) this.storeObject(this.buildTarget.obj); };
    $('pRotate').onclick = () => { SFX.click(); this.placement.rotate(); };
    $('pCancel').onclick = () => { SFX.click(); this.cancelPlace(); this.ui.renderHotbar(); };
    $('opClose').onclick = () => { SFX.click(); this.closePanel(); };
    $('opCollect').onclick = () => this.collect(this.panelItem);
    $('opSpin').onclick = () => this.testSpin(this.panelItem);
    $('opMove').onclick = () => { SFX.click(); const it = this.panelItem; this.closePanel(); this.setBuild(true); this.startMove(it); };
    // Spiel pausiert, wenn die App in den Hintergrund geht
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { Music.stop(); if (this.mode === 'play') { this.save(); this.pause(true); } } else if (this.settings.music && this.musicReady) Music.start(unlockAudio());
    });
  }
  pressAct() {
    if (this.mode !== 'play') return;
    unlockAudio();
    if (this.placement.active) return this.confirmPlace();
    if (this.building) { if (this.buildTarget) { SFX.click(); this.startMove(this.buildTarget.obj); } return; }
    this.interact.trigger();
  }

  // ---------------------------------------------------------- Interaktionen
  registerInteractions() {
    const W = this.world;
    this.interact.register({
      id: 'door', radius: 2.4, y: 1.2,
      pos: () => new THREE.Vector3(CASINO.x0 + 0.1, 0, 0),
      enabled: () => !this.state.open,
      label: () => (!this.state.doorUnlocked ? ['Aufschließen', '🔑'] : W.doorTarget > 0 ? ['Tür schließen', '🚪'] : ['Tür öffnen', '🚪']),
      act: () => {
        if (!this.state.doorUnlocked) { this.state.doorUnlocked = true; SFX.unlock(); this.ui.toast('Opas Schlüssel passt! 🔑'); setTimeout(() => SFX.door(), 200); W.doorTarget = 1.75; this.save(); return; }
        W.doorTarget = W.doorTarget > 0 ? 0 : 1.75; SFX.door();
      },
    });
    this.interact.register({
      id: 'lever', radius: 2.2, y: 1.3,
      pos: () => LEVER_POS.clone().setY(0),
      enabled: () => !this.state.open && this.state.doorUnlocked,
      label: () => (this.objects.machines().length ? ['Casino eröffnen', '🎉'] : ['Hebel (noch zu)', '🔴']),
      act: () => {
        if (!this.objects.machines().length) { SFX.error(); this.ui.toast('Stell zuerst einen Spielautomaten auf!'); return; }
        this.state.open = true; W.doorTarget = 1.75; W.applyRepairs(this.state.repairs, true);
        SFX.lever(); setTimeout(() => SFX.level(), 300);
        this.ui.toast('🎉 GRANDPA\'S CASINO IST GEÖFFNET!', true);
        this.ui.toast('Gleich kommen die ersten Gäste …');
        this.guests.spawnT = 2;
        this.quests.check(); this.save(); this.ui.hud();
      },
    });
  }
  registerObject(it) {
    const game = this;
    const type = it.data.type, machine = type === 'slot' || type === 'deluxe';
    const H = { slot: 1.2, deluxe: 1.2, counter: 0.9, chair: 0.5, lamp: 1.0, plant: 0.6, rug: 0.02, statue: 0.8 };
    this.interact.register({
      id: 'obj' + it.data.id, kind: 'obj', obj: it, y: H[type],
      get radius() { return game.building ? 5 : type === 'counter' ? 2.6 : 2.4; },
      pos: () => new THREE.Vector3(it.data.x, 0, it.data.z),
      enabled: () => !this.placement.active,
      label: () => (machine ? [it.data.cash > 0 ? `Interagieren · ${Math.round(it.data.cash)} $` : 'Interagieren', '🎰'] : type === 'counter' ? ['Kasse ansehen', '💰'] : ['Aufheben', '✋']),
      act: () => (machine || type === 'counter' ? this.openPanel(it) : this.startMove(it)),
    });
  }

  // ---------------------------------------------------------- Bauen (Bau-Modus mit Leiste)
  setBuild(on) {
    if (on && !this.player.inside) { SFX.error(); this.ui.toast('Geh dafür ins Casino!'); return; }
    this.building = on;
    if (!on) { this.placement.cancel(true); this.buildTarget = null; }
    $('build').classList.toggle('on', on); $('build').textContent = on ? '✓ FERTIG' : '🔨 BAUEN';
    this.ui.show('buildBar', on);
    if (on) this.ui.renderHotbar();
  }
  selectBuild(type) {
    this.placement.start(type);
    if (type === 'slot') this.quests.check({ selectedGift: true });
    this.ui.renderHotbar(); this.ui.hud();
  }
  canUse(type) { const s = this.state; return (s.inv[type] || 0) > 0 || (this.eco.unlockInfo(type).ok && s.money >= this.eco.price(type)); }
  startMove(it) { this.placement.start(it.data.type, it); this.ui.renderHotbar(); }
  cancelPlace() { this.placement.cancel(); }
  confirmPlace() {
    const a = this.placement.active;
    if (!a.ok) { SFX.error(); this.ui.toast('Hier ist kein Platz!'); return; }
    if (a.src) { // verschieben
      Object.assign(a.src.data, { x: a.x, z: a.z, rot: a.rot });
      a.src.obj.position.set(a.x, 0, a.z); a.src.obj.rotation.y = (a.rot * Math.PI) / 2;
      this.placement.cancel(true);
      SFX.place(); this.save(); this.ui.renderHotbar();
      return;
    }
    const s = this.state, type = a.type;
    if ((s.inv[type] || 0) > 0) s.inv[type]--;
    else {
      const p = this.eco.price(type);
      if (!this.eco.unlockInfo(type).ok) { SFX.error(); this.ui.toast(`🔒 ${this.eco.unlockInfo(type).why}`); return; }
      if (!this.eco.spend(p)) { SFX.error(); this.ui.toast('Nicht genug Geld!'); return; }
      SFX.buy(); this.eco.addXp(Math.round(p / 10)) && this.levelUp();
      this.floatText(a.x, a.z, `−${p.toLocaleString('de-DE')} $`);
    }
    const data = { id: s.nextId++, type, x: a.x, z: a.z, rot: a.rot, cash: 0 };
    s.objects.push(data);
    this.registerObject(this.objects.add(data));
    this.eco.addXp(10) && this.levelUp();
    SFX.place();
    // gleich weiterbauen, wenn möglich (gleiches Objekt, gleiche Drehung)
    const off = a.rotOff;
    this.placement.cancel(true);
    if (this.canUse(type) && !CATALOG[type].max) { this.placement.start(type); this.placement.active.rotOff = off; }
    this.quests.check(); this.save(); this.ui.hud(); this.ui.renderHotbar();
  }
  storeObject(it) { // zurück ins Inventar (Geld in der Kasse wird gutgeschrieben)
    const s = this.state;
    if (it.data.cash > 0) { this.eco.earn(it.data.cash); this.ui.toast(`+${Math.round(it.data.cash)} $ aus der Kasse`); }
    if (it.user) it.user.machine = null;
    s.objects = s.objects.filter((o) => o !== it.data);
    s.inv[it.data.type] = (s.inv[it.data.type] || 0) + 1;
    this.objects.remove(it); this.interact.unregister('obj' + it.data.id);
    SFX.place(); this.ui.toast(`📦 ${CATALOG[it.data.type].name} eingelagert`);
    this.buildTarget = null; this.save(); this.ui.hud(); this.ui.renderHotbar();
  }
  floatText(x, z, text) {
    const v = new THREE.Vector3(x, 1.2, z).project(this.camera);
    if (v.z > 1) return;
    this.ui.floatAt((v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight, text);
  }
  repair(id) {
    const r = REPAIRS[id];
    if (!this.eco.repairInfo(id).ok || !this.eco.spend(r.price)) { SFX.error(); return; }
    this.state.repairs[id] = true;
    this.world.applyRepairs(this.state.repairs, this.state.open);
    SFX.level(); this.ui.toast(`${r.icon} ${r.name} – fertig!`, true);
    this.eco.addXp(Math.round(r.price / 8)) && this.levelUp();
    this.quests.check(); this.save(); this.ui.hud(); this.ui.renderShop(); if (this.building) this.ui.renderHotbar();
  }

  // ---------------------------------------------------------- Automaten
  openPanel(it) {
    this.panelItem = it;
    const machine = it.data.type !== 'counter';
    $('opTitle').textContent = CATALOG[it.data.type].name;
    this.ui.show('opReels', machine); this.ui.show('opCollect', machine); this.ui.show('opSpin', machine);
    this.refreshPanel();
    this.ui.show('objPanel');
  }
  refreshPanel() {
    const it = this.panelItem; if (!it) return;
    const stat = (a, b) => `<div class="stat"><span>${a}</span><b>${b}</b></div>`;
    if (it.data.type === 'counter') {
      $('opStats').innerHTML = stat('Automaten', this.objects.machines().length) + stat('Beliebtheit', this.eco.attractiveness()) + stat('Bonus', `+${Math.round((this.eco.incomeMult() - 1) * 100)} %`) + stat('Gäste bisher', this.state.stats.guests) + stat('Einnahmen gesamt', `${Math.round(this.state.stats.earned)} $`);
    } else {
      $('opStats').innerHTML = stat('In der Kasse', `${Math.round(it.data.cash)} $`) + stat('Pro Spiel', `≈ ${Math.round(CATALOG[it.data.type].income * this.eco.incomeMult())} $`) + stat('Gerade', it.user ? 'Gast spielt 🙂' : 'frei');
      $('opCollect').disabled = it.data.cash < 1;
    }
  }
  closePanel() { this.ui.show('objPanel', false); this.panelItem = null; }
  collect(it) {
    if (!it || it.data.cash < 1) return;
    const n = Math.round(it.data.cash); it.data.cash = 0;
    this.eco.earn(n); SFX.cash();
    this.ui.toast(`+${n} $ eingesammelt`);
    this.quests.check({ collected: true }); this.save(); this.ui.hud(); this.refreshPanel();
  }
  testSpin(it) {
    if (!it || it.spinT > 0) return;
    it.spinT = 1.6; SFX.lever(); setTimeout(() => SFX.spin(), 150);
    const S = ['🍒', '🔔', '7️⃣', '🍋', '⭐', '💎'];
    let n = 0; const iv = setInterval(() => { $('opReels').textContent = [0, 1, 2].map(() => S[Math.floor(Math.random() * S.length)]).join(''); if (++n > 12) { clearInterval(iv); SFX.coin(); } }, 90);
  }
  guestPaid(m, amount) {
    const s = this.state;
    s.stats.guests++; s.stats.earned += amount;
    if (this.objects.items.some((i) => i.data.type === 'counter')) { this.eco.earn(amount); this.floatMoney(m, `+${Math.round(amount)} $`); SFX.coin(); }
    else { m.data.cash += amount; this.floatMoney(m, `💰 ${Math.round(m.data.cash)} $`); }
    this.eco.addXp(3) && this.levelUp();
    this.ui.hud(); if (this.panelItem === m) this.refreshPanel();
  }
  floatMoney(m, text) {
    const v = new THREE.Vector3(m.data.x, 2.4, m.data.z).project(this.camera);
    if (v.z > 1) return;
    this.ui.floatAt((v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight, text);
  }
  questDone(q) {
    this.eco.earn(q.reward);
    const up = this.eco.addXp(q.xp);
    SFX.quest();
    this.ui.toast(`✅ ${q.text}  +${q.reward} $`, true);
    $('quest').classList.add('done'); setTimeout(() => $('quest').classList.remove('done'), 1200);
    if (up) setTimeout(() => this.levelUp(), 900);
    this.save(); this.ui.hud();
  }
  levelUp() { SFX.level(); this.ui.toast(`⭐ LEVEL ${this.state.level}! Neue Sachen im Bau-Menü`, true); this.ui.hud(); }

  // ---------------------------------------------------------- Frame
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    const t = this.t;
    try {
      if (this.mode === 'menu') this.menuFrame(dt, t);
      else if (this.mode === 'play') this.playFrame(dt, t);
      this.world.update(dt, t, this.night);
      this.objects.update(dt, t);
    } catch (e) { console.warn(e); }
    this.renderer.render(this.scene, this.camera);
  }
  menuFrame(dt, t) {
    const a = Math.sin(t * 0.1) * 0.5 - 0.25;
    const c = new THREE.Vector3(7.5, 0, 0);
    this.camera.position.set(c.x - Math.cos(a) * 17, 5.5 + Math.sin(t * 0.2) * 0.4, Math.sin(a) * 17);
    this.camera.lookAt(c.x - 2, 2.2, 0);
    this.sun.position.set(-10, 20, 8); this.sun.target.position.set(4, 0, 0);
  }
  playFrame(dt, t) {
    const s = this.state; s.playTime += dt;
    const wasInside = this.player.inside;
    const boxes = this.world.statics.concat(this.objects.boxes(), [this.world.doorBox()]);
    this.player.update(dt, this.input.move(), this.cam.yaw, boxes, t);
    this.cam.update(dt, this.player, this.input.takeLook());
    const p = this.player.pos;
    this.sun.position.set(p.x - 9, 18, p.z + 7); this.sun.target.position.set(p.x, 0, p.z);
    if (this.player.inside && !wasInside) this.quests.check({ enteredCasino: true });
    if (!this.player.inside && this.building) { this.setBuild(false); this.ui.toast('Bau-Modus beendet (draußen)'); }
    // Erkunden
    const q = this.quests.current;
    const exploring = q && q.id === 'explore';
    this.world.exploreMarks.forEach((m, i) => {
      m.visible = exploring && !s.explored.includes(i);
      if (m.visible && Math.hypot(p.x - this.world.explorePts[i].x, p.z - this.world.explorePts[i].z) < 0.9) { s.explored.push(i); SFX.coin(); this.ui.toast(`Erkundet ${s.explored.length}/3`); this.quests.check(); this.ui.hud(); }
    });
    this.guests.update(dt, t, s.open, boxes);
    // Bauen / Interaktion (was man anschaut)
    const eye = this.cam.eye(this.player), dir = this.cam.lookDir().clone();
    let hot = false;
    if (this.placement.active) {
      const a = this.placement.active;
      this.placement.update(eye, dir, this.cam.yaw, this.player);
      const inv = (s.inv[a.type] || 0) > 0, price = this.eco.price(a.type);
      const label = a.src ? 'Hier abstellen' : inv ? 'Platzieren' : `Kaufen · ${price.toLocaleString('de-DE')} $`;
      this.ui.setAction(label, a.src ? '📍' : inv ? '📦' : '🛒', !a.ok || (!a.src && !inv && s.money < price));
      this.ui.show('placeRow'); this.ui.show('objRow', false);
      $('bHint').textContent = a.ok ? 'Schau, wohin es soll · ⟳ dreht · Vorderseite zeigt zu dir' : 'Hier passt es nicht – schau auf eine freie Stelle';
    } else if (this.building) {
      this.ui.show('placeRow', false);
      const it = this.interact.update(eye, dir, (i) => i.kind === 'obj');
      this.buildTarget = it; hot = !!it;
      if (it) this.ui.setAction('Verschieben', '✋'); else this.ui.setAction(null);
      this.ui.show('objRow', !!it);
      $('bHint').textContent = it ? `${CATALOG[it.obj.data.type].name}: verschieben oder einlagern` : 'Wähle unten etwas aus – oder schau ein Möbelstück an';
    } else {
      this.ui.show('placeRow', false); this.ui.show('objRow', false);
      const it = this.interact.update(eye, dir, (i) => i.kind !== 'obj' || ['slot', 'deluxe', 'counter'].includes(i.obj.data.type));
      hot = !!it;
      if (it) { const [l, ic] = it.label(); this.ui.setAction(l, ic); } else this.ui.setAction(null);
    }
    $('cross').classList.toggle('hot', hot || (!!this.placement.active && this.placement.active.ok));
    this.ui.show('build', this.player.inside && s.doorUnlocked);
    this.saveT += dt; if (this.saveT > 15) { this.saveT = 0; this.save(); }
    if (this.panelItem && Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.refreshPanel();
  }
}

(async () => {
  try { await document.fonts.load('40px "Lilita One"'); } catch { /* egal */ }
  const g = new Game();
  window.__gc = g; // für Tests
  $('loading').classList.add('hidden');
  void INTERIOR;
})();
