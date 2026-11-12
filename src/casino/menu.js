// MainMenuManager – Hauptmenü, Einstellungen, Intro mit Opas Brief
import { $ } from './ui.js';
import { SaveSystem } from './save.js';
import { SFX, unlockAudio } from './audio.js';

const LETTER = [
  'Mein Junge,',
  'wenn du diesen Brief liest, bin ich nicht mehr da. Ich hinterlasse dir mein altes Casino in der Opas Straße.',
  '„Dieses Gebäude war immer mein Traum. Ich wollte daraus einen Ort machen, an dem Menschen zusammenkommen und Spaß haben. Jetzt liegt es an dir, diesen Traum weiterzuführen.“',
  'Der Schlüssel liegt bei. Etwas Startgeld auch – und mein allererster Spielautomat. Mach was Schönes draus!',
];

export class MainMenuManager {
  constructor(game) {
    this.g = game;
    $('mStart').onclick = () => { unlockAudio(); SFX.click(); if (SaveSystem.has()) this.g.ui.confirm('Neues Spiel?', 'Dein gespeicherter Spielstand wird überschrieben.', () => this.startIntro()); else this.startIntro(); };
    $('mLoad').onclick = () => { unlockAudio(); SFX.click(); this.g.loadGame(); };
    $('mSet').onclick = () => { unlockAudio(); SFX.click(); this.openSettings(); };
    $('sClose').onclick = () => { SFX.click(); $('settings').classList.add('hidden'); };
    $('sSound').onclick = () => { this.g.settings.sound = !this.g.settings.sound; this.g.applySettings(); this.syncSettings(); SFX.click(); };
    $('sQual').onclick = () => { this.g.settings.quality = this.g.settings.quality === 'low' ? 'high' : 'low'; this.g.applySettings(); this.syncSettings(); SFX.click(); };
    $('sSens').oninput = (e) => { this.g.settings.sens = +e.target.value; this.g.applySettings(); };
    $('sDel').onclick = () => { SFX.click(); this.g.ui.confirm('Spielstand löschen?', 'Das kann nicht rückgängig gemacht werden.', () => { SaveSystem.clear(); this.refresh(); if (this.g.mode !== 'menu') this.g.toMenu(); this.g.ui.toast('Spielstand gelöscht'); }); };
  }
  refresh() { $('mLoad').disabled = !SaveSystem.has(); }
  syncSettings() { const s = this.g.settings; $('sSound').textContent = s.sound ? 'AN' : 'AUS'; $('sQual').textContent = s.quality === 'low' ? 'NIEDRIG' : 'HOCH'; $('sSens').value = s.sens; }
  openSettings() { this.syncSettings(); $('settings').classList.remove('hidden'); }
  show() { this.refresh(); $('menu').classList.remove('hidden'); }
  hide() { $('menu').classList.add('hidden'); }
  startIntro() {
    this.hide();
    this.g.newGame();
    $('intro').classList.remove('hidden');
    $('gifts').classList.add('hidden'); $('letterSig').classList.add('hidden');
    $('letterBtn').textContent = 'WEITER'; $('letterBtn').disabled = true;
    const box = $('letterTxt'); box.innerHTML = '';
    let i = 0;
    const next = () => {
      if (i >= LETTER.length) { $('letterSig').classList.remove('hidden'); $('letterBtn').disabled = false; return; }
      const p = document.createElement('p'); p.style.margin = '0 0 8px'; p.style.opacity = '0'; p.style.transition = 'opacity .6s'; p.textContent = LETTER[i++];
      box.appendChild(p); requestAnimationFrame(() => (p.style.opacity = '1'));
      setTimeout(next, this.g.fast ? 10 : 700);
    };
    next();
    let stage = 0;
    $('letterBtn').onclick = () => {
      SFX.click();
      if (stage === 0) {
        stage = 1; box.innerHTML = '<p style="margin:0 0 6px">Im Umschlag findest du:</p>'; $('letterSig').classList.add('hidden');
        $('gifts').classList.remove('hidden');
        [...$('gifts').children].forEach((c, k) => { c.classList.remove('on'); setTimeout(() => { c.classList.add('on'); SFX.coin(); }, 250 + k * 450); });
        $('letterBtn').textContent = "LOS GEHT'S!";
      } else { $('intro').classList.add('hidden'); this.g.beginPlay(true); }
    };
  }
}
