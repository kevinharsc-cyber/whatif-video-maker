// SHARK ATTACK – eigene Titelmelodie (komplett selbst komponiert, nur WebAudio, keine Dateien)
// Aufbau: 16 Takte à 16 Schritte, 120 BPM ≈ 32 s, dann Schleife.
//   A  (Takt 1–4):  der Hook – „G-C-E-G … A“ springt nach oben, zum Mitsummen
//   A' (Takt 5–8):  Wiederholung, endet diesmal auf dem Grundton (fühlt sich „fertig“ an)
//   B  (Takt 9–16): Refrain, steigt bis zum hohen D und führt zurück zum Hook
// Akkorde: C G Am F | C G Am F | F G Em Am | F G C G

export const BPM = 120;
export const STEPS = 16;

// [Schritt, MIDI-Note, Länge in Schritten]
const HOOK = [
  [[0, 67, 2], [2, 72, 2], [4, 76, 2], [6, 79, 4], [11, 76, 1], [12, 79, 2], [14, 81, 2]], // C
  [[0, 79, 3], [3, 77, 1], [4, 76, 2], [6, 74, 2], [8, 71, 4], [12, 74, 2], [14, 76, 2]], // G
  [[0, 76, 2], [2, 72, 2], [4, 76, 2], [6, 81, 4], [11, 79, 1], [12, 76, 2], [14, 74, 2]], // Am
];
const MELODY = [
  ...HOOK,
  [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 6], [14, 67, 2]], // F – offen, Auftakt
  ...HOOK,
  [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 76, 2], [8, 72, 8]], // F – Ende auf C
  // Refrain
  [[0, 81, 2], [2, 81, 2], [4, 79, 2], [6, 77, 2], [8, 76, 4], [12, 77, 2], [14, 79, 2]], // F
  [[0, 79, 2], [2, 79, 2], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 76, 2], [14, 77, 2]], // G
  [[0, 76, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2], [8, 71, 4], [12, 72, 2], [14, 74, 2]], // Em
  [[0, 76, 6], [6, 72, 2], [8, 69, 8]], // Am
  [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 2], [10, 79, 2], [12, 77, 4]], // F
  [[0, 79, 2], [2, 83, 2], [4, 86, 4], [8, 83, 2], [10, 79, 2], [12, 77, 4]], // G
  [[0, 84, 4], [4, 79, 2], [6, 76, 2], [8, 79, 2], [10, 84, 6]], // C
  [[0, 83, 2], [2, 81, 2], [4, 79, 2], [6, 77, 2], [8, 76, 2], [10, 74, 2], [12, 71, 2], [14, 67, 2]], // G – zurück zum Hook
];
// Akkord je Takt: Bass-Grundton + Stimmen für die Begleitung
const C = { root: 36, v: [60, 64, 67] };
const G = { root: 43, v: [59, 62, 67] };
const Am = { root: 45, v: [60, 64, 69] };
const F = { root: 41, v: [60, 65, 69] };
const Em = { root: 40, v: [59, 64, 67] };
const CHORDS = [C, G, Am, F, C, G, Am, F, F, G, Em, Am, F, G, C, G];
export const BARS = CHORDS.length;

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
let noise = null;
function noiseBuf(a) {
  if (!noise || noise.sampleRate !== a.sampleRate) {
    noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noise;
}
function env(a, gain, at, peak, len, attack = 0.008) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
}
function osc(a, out, type, f, at, len, vol, attack) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  env(a, g, at, vol, len, attack);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.05);
  return o;
}
function hit(a, out, at, { type = 'highpass', freq = 7000, len = 0.05, vol = 0.03, q = 0.7 }) {
  const s = a.createBufferSource();
  s.buffer = noiseBuf(a);
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  env(a, g, at, vol, len, 0.002);
  s.connect(f).connect(g).connect(out);
  s.start(at);
  s.stop(at + len + 0.02);
}

// Ausgänge einmal pro AudioContext bauen: Lead bekommt ein kleines Echo (macht die Melodie „groß“)
export function createBus(a, dest) {
  const master = a.createGain();
  master.gain.value = 1;
  master.connect(dest);
  const lead = a.createGain();
  lead.gain.value = 1;
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 3200;
  lead.connect(tone).connect(master);
  const delay = a.createDelay(1);
  delay.delayTime.value = (60 / BPM) * 0.75; // punktierte Achtel
  const fb = a.createGain();
  fb.gain.value = 0.28;
  const wet = a.createGain();
  wet.gain.value = 0.3;
  tone.connect(delay);
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(master);
  return { master, lead, band: master };
}

// Einen 16tel-Schritt planen. mode: 'menu' (sanft, ohne Schlagzeug) | 'play' · tense 0..1 (Hai nah)
export function scheduleStep(a, bus, step, at, mode = 'play', tense = 0) {
  const bar = Math.floor(step / STEPS) % BARS;
  const k = step % STEPS;
  const ch = CHORDS[bar];
  const stepLen = 60 / BPM / 4;
  const play = mode === 'play';
  // Melodie: Rechteck + Dreieck leicht verstimmt = fröhlicher „Chiptune“-Klang
  for (const [s, n, l] of MELODY[bar]) {
    if (s !== k) continue;
    const len = l * stepLen * 0.95;
    const v = play ? 0.075 : 0.06;
    const o1 = osc(a, bus.lead, 'square', hz(n), at, len, v * 0.55, 0.01);
    osc(a, bus.lead, 'triangle', hz(n) * 1.003, at, len, v, 0.01);
    if (l >= 4) {
      // Vibrato auf langen Tönen
      const lfo = a.createOscillator();
      const lg = a.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.setValueAtTime(0, at);
      lg.gain.linearRampToValueAtTime(hz(n) * 0.012, at + len * 0.6);
      lfo.connect(lg).connect(o1.frequency);
      lfo.start(at);
      lfo.stop(at + len);
    }
  }
  // Bass: hüpfend Grundton / Oktave
  if (k % 2 === 0) {
    const n = ch.root + (k % 4 === 2 ? 12 : 0);
    osc(a, bus.band, 'triangle', hz(n), at, stepLen * 1.6, (play ? 0.2 : 0.13) * (1 + tense * 0.3), 0.005);
  }
  // Akkord-Tupfer auf den Off-Beats
  if (k % 4 === 2) for (const n of ch.v) osc(a, bus.band, 'triangle', hz(n), at, stepLen * 1.4, play ? 0.035 : 0.03, 0.004);
  if (!play) return;
  // Schlagzeug
  if (k === 0 || k === 8 || (k === 10 && bar % 4 === 3)) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.frequency.setValueAtTime(130, at);
    o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
    env(a, g, at, 0.32, 0.18, 0.002);
    o.connect(g).connect(bus.band);
    o.start(at);
    o.stop(at + 0.2);
  }
  if (k === 4 || k === 12) {
    hit(a, bus.band, at, { type: 'bandpass', freq: 1800, len: 0.14, vol: 0.09, q: 0.8 });
    osc(a, bus.band, 'triangle', 190, at, 0.07, 0.05, 0.002);
  }
  if (k % 2 === 0 || tense > 0.5) hit(a, bus.band, at, { vol: k % 4 === 2 ? 0.03 : 0.016, len: 0.04 });
  // kleiner Wirbel am Ende jedes 4. Takts
  if (bar % 4 === 3 && k >= 13) hit(a, bus.band, at, { type: 'bandpass', freq: 2200, len: 0.08, vol: 0.05 });
}
export const stepSeconds = (tense = 0) => 60 / (BPM * (1 + tense * 0.08)) / 4;
