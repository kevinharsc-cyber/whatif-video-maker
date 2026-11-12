// QuestManager – Aufgaben mit Belohnung
export const QUESTS = [
  { id: 'enter', text: 'Betritt dein neues Casino', hint: 'Geh zur Tür und schließ sie mit Opas Schlüssel auf.', reward: 50, xp: 30 },
  { id: 'explore', text: 'Erkunde das Gebäude', hint: 'Lauf zu den 3 leuchtenden Kreisen im Raum.', reward: 50, xp: 30, goal: 3 },
  { id: 'select', text: 'Stelle deinen ersten Spielautomaten auf', hint: 'Tippe auf 🔨 BAUEN und wähle dein Geschenk.', reward: 25, xp: 20 },
  { id: 'place', text: 'Platziere den Spielautomaten', hint: 'Lauf an eine freie Stelle und tippe auf PLATZIEREN.', reward: 100, xp: 50 },
  { id: 'open', text: 'Eröffne dein Casino', hint: 'Leg den roten Hebel neben der Tür um.', reward: 200, xp: 80 },
  { id: 'collect', text: 'Sammle Einnahmen am Automaten ein', hint: 'Warte auf Gäste und tippe dann am Automaten auf INTERAGIEREN.', reward: 50, xp: 30 },
  { id: 'slot2', text: 'Kaufe einen zweiten Spielautomaten', hint: 'Im Bau-Menü für 500 $.', reward: 75, xp: 60 },
  { id: 'counter', text: 'Stelle den Kassentresen auf', hint: 'Im Bau-Menü für 750 $ – sammelt dann automatisch.', reward: 150, xp: 100 },
  { id: 'repair', text: 'Renoviere etwas am Casino', hint: 'Bau-Menü → Renovieren (ab Level 2).', reward: 150, xp: 100 },
  { id: 'slots4', text: 'Stelle 4 Spielautomaten auf', hint: 'Mehr Automaten = mehr Gäste.', reward: 300, xp: 150, goal: 4 },
  { id: 'deco', text: 'Richte einen Sitzbereich ein', hint: 'Kaufe einen Samt-Sessel.', reward: 120, xp: 80 },
  { id: 'level5', text: 'Erreiche Level 5', hint: 'Renovieren, Automaten, Deko – alles bringt Erfahrung.', reward: 500, xp: 0 },
];

export class QuestManager {
  constructor(state, onDone) { this.s = state; this.onDone = onDone; }
  get current() { return QUESTS[this.s.quest] || null; }
  progressText() {
    const q = this.current; if (!q) return '';
    if (q.id === 'explore') return ` (${this.s.explored.length}/3)`;
    if (q.id === 'slots4') return ` (${Math.min(4, this.s.objects.filter((o) => o.type === 'slot').length)}/4)`;
    return '';
  }
  // Prüft den Fortschritt anhand des Spielzustands / Ereignissen
  check(ev = {}) {
    const q = this.current; if (!q) return;
    const s = this.s; let done = false;
    switch (q.id) {
      case 'enter': done = !!ev.enteredCasino; break;
      case 'explore': done = s.explored.length >= 3; break;
      case 'select': done = !!ev.selectedGift || s.objects.some((o) => o.type === 'slot'); break;
      case 'place': done = s.objects.some((o) => o.type === 'slot'); break;
      case 'open': done = s.open; break;
      case 'collect': done = !!ev.collected; break;
      case 'slot2': done = s.objects.filter((o) => o.type === 'slot').length + (s.inv.slot || 0) >= 2; break;
      case 'counter': done = s.objects.some((o) => o.type === 'counter'); break;
      case 'repair': done = Object.values(s.repairs).some(Boolean); break;
      case 'slots4': done = s.objects.filter((o) => o.type === 'slot').length >= 4; break;
      case 'deco': done = s.objects.some((o) => o.type === 'chair'); break;
      case 'level5': done = s.level >= 5; break;
    }
    if (done) { s.quest++; this.onDone(q); this.check(); }
  }
}
