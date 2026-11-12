// UIManager – HUD, Meldungen, Bau-Menü, Dialoge
import { CATALOG, REPAIRS } from './economy.js';
import { SFX } from './audio.js';

export const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('de-DE');

export class UIManager {
  constructor(game) {
    this.g = game; this.tab = 'inv'; this.confirmCb = null;
    $('shopX').onclick = () => this.closeShop();
    document.querySelectorAll('#shop .tabs button').forEach((b) => (b.onclick = () => { SFX.click(); this.tab = b.dataset.tab; this.renderShop(); }));
    $('cNo').onclick = () => { SFX.click(); $('confirm').classList.add('hidden'); };
    $('cYes').onclick = () => { SFX.click(); $('confirm').classList.add('hidden'); this.confirmCb?.(); };
  }
  show(id, on = true) { $(id).classList.toggle('hidden', !on); }
  hud() {
    const s = this.g.state;
    $('money').textContent = fmt(s.money);
    $('lvlTxt').textContent = `Lv ${s.level}`;
    $('xp').style.width = `${this.g.eco.levelProgress() * 100}%`;
    const q = this.g.quests.current;
    $('qText').textContent = q ? q.text + this.g.quests.progressText() : 'Alle Aufgaben erledigt! 🎉';
    $('qHint').textContent = q ? q.hint : 'Phase 2 bringt Pokertische, Mitarbeiter & neue Räume.';
    if (!$('shop').classList.contains('hidden')) $('shopMoney').textContent = fmt(s.money);
  }
  toast(text, big = false) {
    const el = document.createElement('div'); el.className = 'toast' + (big ? ' big' : ''); el.textContent = text;
    $('toasts').appendChild(el); setTimeout(() => el.remove(), 2700);
    while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
  }
  floatAt(x, y, text) {
    const el = document.createElement('div'); el.className = 'float'; el.textContent = text;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
    $('floats').appendChild(el); setTimeout(() => el.remove(), 1500);
  }
  confirm(title, text, cb) { $('cTitle').textContent = title; $('cText').textContent = text; this.confirmCb = cb; this.show('confirm'); }
  setAction(label, icon, bad = false) {
    const b = $('act');
    if (!label) { b.classList.add('hidden'); return; }
    b.classList.remove('hidden'); b.classList.toggle('bad', bad);
    $('actTxt').textContent = label; $('actIc').textContent = icon;
  }
  // -------------------------------------------------------------- Bau-Menü
  openShop(tab) { if (tab) this.tab = tab; this.show('shop'); this.renderShop(); }
  closeShop() { SFX.click(); this.show('shop', false); }
  renderShop() {
    const g = this.g, s = g.state, eco = g.eco;
    $('shopMoney').textContent = fmt(s.money);
    document.querySelectorAll('#shop .tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.tab));
    const grid = $('shopGrid'); grid.innerHTML = '';
    const card = (ic, name, desc, btn, onClick, cls = '', disabled = false) => {
      const c = document.createElement('div'); c.className = 'card ' + cls;
      c.innerHTML = `<div class="ic">${ic}</div><div class="nm"></div><div class="ds"></div>`;
      c.querySelector('.nm').textContent = name; c.querySelector('.ds').textContent = desc;
      const b = document.createElement('button'); b.className = cls.includes('locked') ? 'glass' : 'gold'; b.textContent = btn; b.disabled = disabled;
      b.onclick = () => { SFX.click(); onClick(); };
      c.appendChild(b); grid.appendChild(c);
    };
    if (this.tab === 'inv') {
      const types = Object.keys(s.inv).filter((k) => s.inv[k] > 0);
      if (!types.length) { const e = document.createElement('div'); e.className = 'ds'; e.style.cssText = 'grid-column:1/-1;opacity:.7;font-family:system-ui;font-size:13px;padding:10px'; e.textContent = 'Dein Inventar ist leer. Kaufe neue Sachen im Reiter „Kaufen“.'; grid.appendChild(e); }
      for (const t of types) {
        const c = CATALOG[t];
        const gift = t === 'slot' && s.objects.filter((o) => o.type === 'slot').length === 0;
        card(c.icon, `${c.name} ×${s.inv[t]}`, gift ? '🎁 Geschenk von Opa! Stell ihn im Casino auf.' : c.desc, 'AUFSTELLEN', () => g.beginPlace(t), gift ? 'gift' : '');
      }
    } else if (this.tab === 'buy') {
      for (const t of Object.keys(CATALOG)) {
        const c = CATALOG[t], u = eco.unlockInfo(t), p = eco.price(t);
        if (!u.ok) { card(c.icon, c.name, `🔒 ${u.why}`, `${fmt(p)} $`, () => {}, 'locked', true); continue; }
        card(c.icon, c.name, c.desc, `${fmt(p)} $`, () => g.buy(t), '', s.money < p);
      }
    } else {
      for (const id of Object.keys(REPAIRS)) {
        const r = REPAIRS[id], u = eco.repairInfo(id);
        if (!u.ok) { card(r.icon, r.name, s.repairs[id] ? '✅ Erledigt' : `🔒 ${u.why}`, s.repairs[id] ? 'FERTIG' : `${fmt(r.price)} $`, () => {}, 'locked', true); continue; }
        card(r.icon, r.name, `Macht das Casino schöner. +${r.attract} Beliebtheit.`, `${fmt(r.price)} $`, () => g.repair(id), '', s.money < r.price);
      }
    }
  }
}
