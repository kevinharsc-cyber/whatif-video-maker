// UIManager – HUD, Meldungen, Bau-Menü, Dialoge
import { CATALOG, REPAIRS } from './economy.js';
import { SFX } from './audio.js';

export const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('de-DE');

export class UIManager {
  constructor(game) {
    this.g = game; this.confirmCb = null;
    $('shopX').onclick = () => this.closeShop();
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
    if (this.g.building) this.renderHotbar();
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
  // ----------------------------------------------------------- Bau-Leiste
  renderHotbar() {
    const g = this.g, s = g.state, eco = g.eco, bar = $('hotbar');
    const sel = g.placement.active && !g.placement.active.src ? g.placement.active.type : null;
    bar.innerHTML = '';
    const tile = (ic, name, price, cls, onClick) => {
      const b = document.createElement('button'); b.className = 'slotx ' + cls;
      b.innerHTML = `<span class="i">${ic}</span><span class="n"></span><span class="p"></span>`;
      b.querySelector('.n').textContent = name; const p = b.querySelector('.p'); p.textContent = price;
      if (price.startsWith('GRATIS') || price.startsWith('×')) p.classList.add('free');
      b.onclick = () => { SFX.click(); onClick(); };
      bar.appendChild(b);
    };
    for (const t of Object.keys(CATALOG)) {
      const c = CATALOG[t], inv = s.inv[t] || 0, u = eco.unlockInfo(t), price = eco.price(t);
      const short = c.name.replace('Spielautomat „Lucky 7“', 'Lucky 7').replace('Automat „Diamond“', 'Diamond').replace('Goldmünzen-Statue', 'Statue');
      const usable = inv > 0 || u.ok;
      let label = inv > 0 ? (t === 'slot' && !s.objects.some((o) => o.type === 'slot') ? 'GRATIS 🎁' : `× ${inv}`) : `${fmt(price)} $`;
      let cls = (sel === t ? 'sel ' : '') + (!usable ? 'lock ' : '') + (usable && inv === 0 && s.money < price ? 'poor' : '');
      tile(c.icon, short, label, cls, () => {
        if (!usable) { SFX.error(); this.toast(`🔒 ${u.why}`); return; }
        if (sel === t) { g.placement.cancel(); this.renderHotbar(); return; }
        g.selectBuild(t);
      });
    }
    tile('🧰', 'Renovieren', '', '', () => this.openShop());
  }
  // -------------------------------------------------------- Renovieren
  openShop() { this.show('shop'); this.renderShop(); }
  closeShop() { SFX.click(); this.show('shop', false); }
  renderShop() {
    const g = this.g, s = g.state, eco = g.eco;
    $('shopMoney').textContent = fmt(s.money);
    const grid = $('shopGrid'); grid.innerHTML = '';
    for (const id of Object.keys(REPAIRS)) {
      const r = REPAIRS[id], u = eco.repairInfo(id);
      const c = document.createElement('div'); c.className = 'card' + (u.ok ? '' : ' locked');
      c.innerHTML = `<div class="ic">${r.icon}</div><div class="nm"></div><div class="ds"></div>`;
      c.querySelector('.nm').textContent = r.name;
      c.querySelector('.ds').textContent = u.ok ? `Macht das Casino schöner. +${r.attract} Beliebtheit.` : s.repairs[id] ? '✅ Erledigt' : `🔒 ${u.why}`;
      const b = document.createElement('button'); b.className = u.ok ? 'gold' : 'glass';
      b.textContent = s.repairs[id] ? 'FERTIG' : `${fmt(r.price)} $`; b.disabled = !u.ok || s.money < r.price;
      b.onclick = () => { SFX.click(); g.repair(id); };
      c.appendChild(b); grid.appendChild(c);
    }
  }
}
