// Automatisch synchronisierte Untertitel.
// Für jede Szene kennen wir genau, wann die Stimme beginnt und endet.
// Innerhalb der Szene verteilen wir die Wörter nach ihrer Sprechlänge
// (lange Wörter und Satzzeichen-Pausen brauchen mehr Zeit).

const MAX_WORDS = 3;
const MAX_CHARS = 18;

export function buildSubtitles(scenes, sceneTimes) {
  const chunks = [];
  scenes.forEach((scene, si) => {
    const { start, end } = sceneTimes[si];
    // Wörter ohne Buchstaben/Zahlen (z. B. "*", "-", "•") nicht als Untertitel zeigen
    const words = scene.text
      .replace(/[*•▪►]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((w) => /[\p{L}\p{N}]/u.test(w));
    if (!words.length) return;
    const weights = words.map(wordWeight);
    const sum = weights.reduce((a, b) => a + b, 0);
    const dur = end - start;
    let t = start;
    const timed = words.map((w, i) => {
      const d = (weights[i] / sum) * dur;
      const item = { word: w, start: t, end: t + d };
      t += d;
      return item;
    });
    // Wörter zu kurzen Häppchen (max. 3 Wörter) gruppieren – typischer TikTok-Stil.
    let group = [];
    const flush = () => {
      if (!group.length) return;
      chunks.push({ start: group[0].start, end: group[group.length - 1].end, words: group, scene: si });
      group = [];
    };
    for (const w of timed) {
      const len = group.reduce((a, g) => a + g.word.length + 1, 0) + w.word.length;
      if (group.length >= MAX_WORDS || (group.length && len > MAX_CHARS)) flush();
      group.push(w);
      if (/[.!?;:,]$/.test(w.word)) flush();
    }
    flush();
  });
  // Lücken schließen, damit der Untertitel nicht flackert.
  for (let i = 0; i < chunks.length - 1; i++) {
    const gap = chunks[i + 1].start - chunks[i].end;
    if (gap > 0 && gap < 0.5) chunks[i].end = chunks[i + 1].start;
  }
  return chunks;
}

function wordWeight(w) {
  const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length;
  let pause = 0;
  if (/[.!?]$/.test(w)) pause = 6;
  else if (/[,;:]$/.test(w)) pause = 3;
  return Math.max(2, letters) + 1.5 + pause;
}

// SRT-Datei erzeugen (z. B. für CapCut oder YouTube).
export function toSrt(chunks) {
  const fmt = (t) => {
    const ms = Math.max(0, Math.round(t * 1000));
    const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${h}:${m}:${s},${String(ms % 1000).padStart(3, '0')}`;
  };
  return chunks
    .map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.words.map((w) => w.word).join(' ')}\n`)
    .join('\n');
}
