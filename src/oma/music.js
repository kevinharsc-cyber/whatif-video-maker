// OMA vs ZOMBIES – Musik: 4 selbst komponierte Songs (Menü + je Karte), nur WebAudio
// Jeder Song: 16 Takte à 16 Schritte, dann Schleife. Melodie: [Schritt, MIDI-Note, Länge in Schritten]

const CH = {
  C: [36, [60, 64, 67]], Dm: [38, [62, 65, 69]], Em: [40, [64, 67, 71]], F: [41, [60, 65, 69]], G: [43, [62, 67, 71]],
  Am: [45, [60, 64, 69]], E: [40, [64, 68, 71]], Bb: [46, [62, 65, 70]], Gm: [43, [62, 67, 70]], A: [45, [61, 64, 69]],
  D: [38, [62, 66, 69]], Bm: [47, [62, 66, 71]], Fsm: [42, [61, 66, 69]],
};

export const SONGS = {
  // Menü: gruselig-lustig in a-Moll, leicht geswingt („Omas Gruselwalzer“)
  menu: {
    bpm: 108, swing: 0.18, style: 'menu',
    bars: [
      ['Am', [[0, 69, 3], [3, 72, 1], [4, 76, 2], [6, 75, 2], [8, 76, 4], [12, 72, 2], [14, 69, 2]]],
      ['Am', [[0, 71, 2], [2, 72, 2], [4, 74, 4], [8, 72, 2], [10, 71, 2], [12, 69, 4]]],
      ['Dm', [[0, 74, 3], [3, 77, 1], [4, 81, 2], [6, 80, 2], [8, 81, 4], [12, 77, 2], [14, 74, 2]]],
      ['Dm', [[0, 76, 2], [2, 77, 2], [4, 79, 4], [8, 77, 2], [10, 76, 2], [12, 74, 4]]],
      ['E', [[0, 76, 2], [2, 80, 2], [4, 83, 4], [8, 80, 2], [10, 76, 2], [12, 74, 2], [14, 71, 2]]],
      ['E', [[0, 72, 2], [2, 71, 2], [4, 68, 4], [8, 71, 2], [10, 74, 2], [12, 76, 4]]],
      ['Am', [[0, 81, 2], [2, 76, 2], [4, 72, 2], [6, 76, 2], [8, 69, 6], [14, 64, 2]]],
      ['Am', [[0, 69, 6], [8, 64, 2], [10, 68, 2], [12, 69, 4]]],
      ['F', [[0, 72, 2], [2, 72, 2], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 72, 4]]],
      ['G', [[0, 71, 2], [2, 71, 2], [4, 74, 2], [6, 79, 2], [8, 77, 4], [12, 74, 4]]],
      ['Am', [[0, 76, 4], [4, 72, 2], [6, 69, 2], [8, 72, 4], [12, 76, 4]]],
      ['Am', [[0, 81, 8], [8, 79, 2], [10, 77, 2], [12, 76, 4]]],
      ['Dm', [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 77, 2], [10, 81, 2], [12, 77, 4]]],
      ['E', [[0, 80, 2], [2, 83, 2], [4, 80, 2], [6, 76, 2], [8, 71, 4], [12, 68, 4]]],
      ['Am', [[0, 69, 2], [2, 72, 2], [4, 76, 2], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 72, 4]]],
      ['E', [[0, 71, 4], [4, 68, 4], [8, 64, 4], [12, 68, 4]]],
    ],
  },
  // Schrebergarten: fröhliche Polka in G-Dur mit Umpa-Bass
  garten: {
    bpm: 132, swing: 0, style: 'polka',
    bars: [
      ['G', [[0, 67, 2], [2, 71, 2], [4, 74, 4], [8, 71, 2], [10, 74, 2], [12, 79, 4]]],
      ['G', [[0, 78, 2], [2, 79, 2], [4, 81, 2], [6, 79, 2], [8, 78, 2], [10, 76, 2], [12, 74, 4]]],
      ['C', [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 81, 2], [12, 79, 4]]],
      ['D', [[0, 78, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2], [8, 71, 2], [10, 69, 2], [12, 66, 4]]],
      ['G', [[0, 67, 2], [2, 71, 2], [4, 74, 2], [6, 79, 2], [8, 83, 4], [12, 81, 4]]],
      ['Em', [[0, 79, 2], [2, 76, 2], [4, 71, 4], [8, 76, 2], [10, 79, 2], [12, 83, 4]]],
      ['Am', [[0, 81, 3], [3, 79, 1], [4, 76, 2], [6, 72, 2], [8, 76, 2], [10, 79, 2], [12, 81, 4]]],
      ['D', [[0, 78, 2], [2, 81, 2], [4, 86, 4], [8, 84, 2], [10, 81, 2], [12, 78, 4]]],
      ['C', [[0, 79, 2], [2, 79, 2], [4, 76, 2], [6, 79, 2], [8, 84, 4], [12, 79, 4]]],
      ['D', [[0, 78, 2], [2, 78, 2], [4, 74, 2], [6, 78, 2], [8, 81, 4], [12, 78, 4]]],
      ['G', [[0, 79, 2], [2, 83, 2], [4, 86, 2], [6, 83, 2], [8, 79, 2], [10, 74, 2], [12, 71, 4]]],
      ['Em', [[0, 76, 4], [4, 79, 4], [8, 83, 4], [12, 81, 4]]],
      ['C', [[0, 84, 2], [2, 83, 2], [4, 81, 2], [6, 79, 2], [8, 76, 4], [12, 79, 4]]],
      ['D', [[0, 78, 2], [2, 76, 2], [4, 74, 2], [6, 76, 2], [8, 78, 4], [12, 81, 4]]],
      ['G', [[0, 79, 4], [4, 74, 2], [6, 71, 2], [8, 67, 4], [12, 71, 4]]],
      ['G', [[0, 74, 2], [2, 71, 2], [4, 67, 8], [14, 62, 2]]],
    ],
  },
  // Friedhof: unheimlich in d-Moll, Cembalo + Orgel, Herzschlag-Trommel
  friedhof: {
    bpm: 96, swing: 0, style: 'spooky',
    bars: [
      ['Dm', [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 77, 2], [8, 74, 2], [10, 73, 2], [12, 74, 4]]],
      ['Dm', [[0, 74, 2], [2, 77, 2], [4, 81, 2], [6, 86, 2], [8, 85, 4], [12, 81, 4]]],
      ['Bb', [[0, 82, 3], [3, 81, 1], [4, 77, 2], [6, 74, 2], [8, 77, 4], [12, 70, 4]]],
      ['A', [[0, 73, 2], [2, 76, 2], [4, 79, 2], [6, 81, 2], [8, 79, 2], [10, 76, 2], [12, 73, 4]]],
      ['Dm', [[0, 69, 2], [2, 74, 2], [4, 77, 4], [8, 76, 2], [10, 74, 2], [12, 73, 2], [14, 74, 2]]],
      ['Gm', [[0, 70, 2], [2, 74, 2], [4, 79, 4], [8, 77, 2], [10, 74, 2], [12, 70, 4]]],
      ['A', [[0, 69, 2], [2, 73, 2], [4, 76, 2], [6, 79, 2], [8, 81, 4], [12, 76, 4]]],
      ['A', [[0, 73, 4], [4, 69, 4], [8, 64, 4], [12, 69, 4]]],
      ['Bb', [[0, 77, 2], [2, 82, 2], [4, 86, 4], [8, 84, 2], [10, 82, 2], [12, 81, 4]]],
      ['C', [[0, 79, 2], [2, 84, 2], [4, 88, 4], [8, 86, 2], [10, 84, 2], [12, 82, 4]]],
      ['Dm', [[0, 81, 4], [4, 77, 2], [6, 74, 2], [8, 81, 2], [10, 86, 2], [12, 85, 4]]],
      ['Dm', [[0, 86, 8], [8, 81, 4], [12, 77, 4]]],
      ['Gm', [[0, 79, 2], [2, 82, 2], [4, 86, 2], [6, 82, 2], [8, 79, 2], [10, 77, 2], [12, 74, 4]]],
      ['A', [[0, 76, 2], [2, 79, 2], [4, 81, 2], [6, 85, 2], [8, 88, 4], [12, 85, 4]]],
      ['Dm', [[0, 86, 2], [2, 81, 2], [4, 77, 2], [6, 74, 2], [8, 77, 2], [10, 73, 2], [12, 74, 4]]],
      ['A', [[0, 69, 4], [4, 73, 4], [8, 76, 4], [12, 73, 4]]],
    ],
  },
  // Winterdorf: festlich in D-Dur mit Glöckchen und Schlittenschellen
  winter: {
    bpm: 120, swing: 0, style: 'winter',
    bars: [
      ['D', [[0, 78, 2], [2, 78, 2], [4, 81, 4], [8, 78, 2], [10, 74, 2], [12, 78, 4]]],
      ['D', [[0, 79, 2], [2, 78, 2], [4, 76, 2], [6, 74, 2], [8, 76, 8]]],
      ['G', [[0, 79, 2], [2, 79, 2], [4, 83, 4], [8, 79, 2], [10, 76, 2], [12, 79, 4]]],
      ['A', [[0, 81, 2], [2, 79, 2], [4, 78, 2], [6, 76, 2], [8, 73, 8]]],
      ['D', [[0, 74, 2], [2, 78, 2], [4, 81, 2], [6, 86, 2], [8, 85, 4], [12, 81, 4]]],
      ['Bm', [[0, 83, 2], [2, 81, 2], [4, 78, 2], [6, 74, 2], [8, 78, 4], [12, 83, 4]]],
      ['G', [[0, 86, 2], [2, 83, 2], [4, 79, 2], [6, 83, 2], [8, 81, 2], [10, 79, 2], [12, 78, 4]]],
      ['A', [[0, 76, 4], [4, 81, 4], [8, 79, 2], [10, 78, 2], [12, 76, 4]]],
      ['G', [[0, 83, 3], [3, 81, 1], [4, 79, 4], [8, 83, 3], [11, 81, 1], [12, 79, 4]]],
      ['A', [[0, 81, 3], [3, 79, 1], [4, 78, 4], [8, 81, 2], [10, 85, 2], [12, 88, 4]]],
      ['Fsm', [[0, 85, 2], [2, 81, 2], [4, 78, 2], [6, 81, 2], [8, 85, 4], [12, 78, 4]]],
      ['Bm', [[0, 83, 4], [4, 78, 2], [6, 74, 2], [8, 71, 4], [12, 74, 4]]],
      ['G', [[0, 79, 2], [2, 81, 2], [4, 83, 2], [6, 86, 2], [8, 88, 4], [12, 86, 4]]],
      ['A', [[0, 85, 2], [2, 83, 2], [4, 81, 2], [6, 79, 2], [8, 78, 2], [10, 76, 2], [12, 73, 4]]],
      ['D', [[0, 74, 4], [4, 78, 4], [8, 81, 4], [12, 86, 4]]],
      ['D', [[0, 85, 2], [2, 86, 2], [4, 81, 8]]],
    ],
  },
};

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
function env(g, at, peak, len, attack = 0.008) {
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
}
function osc(a, out, type, f, at, len, vol, attack) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  env(g, at, vol, len, attack);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + len + 0.05);
  return o;
}
function hit(a, out, at, { type = 'highpass', freq = 7000, len = 0.05, vol = 0.03, q = 0.7 }) {
  const s = a.createBufferSource();
  s.buffer = noiseBuf(a);
  const f = a.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain();
  env(g, at, vol, len, 0.002);
  s.connect(f).connect(g).connect(out);
  s.start(at);
  s.stop(at + len + 0.02);
}
function kick(a, out, at, vol = 0.3) {
  const o = a.createOscillator(), g = a.createGain();
  o.frequency.setValueAtTime(130, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  env(g, at, vol, 0.18, 0.002);
  o.connect(g).connect(out); o.start(at); o.stop(at + 0.2);
}
// Ausgang mit kleinem Echo für die Melodie
export function createBus(a, dest) {
  const master = a.createGain();
  master.gain.value = 0.0001;
  master.connect(dest);
  const lead = a.createGain();
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass'; tone.frequency.value = 3400;
  lead.connect(tone).connect(master);
  const delay = a.createDelay(1);
  delay.delayTime.value = 0.3;
  const fb = a.createGain(); fb.gain.value = 0.25;
  const wet = a.createGain(); wet.gain.value = 0.25;
  tone.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master);
  return { master, lead, band: master };
}
export const stepSeconds = (song, step, intense = 0) => {
  const base = 60 / (song.bpm * (1 + intense * 0.05)) / 4;
  return song.swing ? base * (step % 2 === 0 ? 1 + song.swing : 1 - song.swing) : base;
};
// Einen 16tel-Schritt planen · intense 0..1 (Welle läuft / Boss)
export function scheduleStep(song, a, bus, step, at, intense = 0) {
  const bar = Math.floor(step / 16) % song.bars.length;
  const k = step % 16;
  const [chName, mel] = song.bars[bar];
  const [root, voices] = CH[chName];
  const sl = 60 / song.bpm / 4;
  const st = song.style;
  // Melodie
  for (const [s, n, l] of mel) {
    if (s !== k) continue;
    const len = l * sl * 0.95;
    if (st === 'winter') {
      // Glocke: Grundton + Obertöne, schnell abklingend
      osc(a, bus.lead, 'sine', hz(n), at, Math.min(1.2, len * 1.6), 0.09, 0.003);
      osc(a, bus.lead, 'sine', hz(n) * 2.01, at, 0.4, 0.035, 0.002);
      osc(a, bus.lead, 'sine', hz(n) * 3.02, at, 0.2, 0.015, 0.002);
    } else if (st === 'spooky') {
      // Cembalo: kurz und spitz
      osc(a, bus.lead, 'sawtooth', hz(n), at, Math.min(0.5, len), 0.04, 0.002);
      osc(a, bus.lead, 'square', hz(n) * 0.5, at, Math.min(0.4, len), 0.02, 0.002);
    } else {
      const o1 = osc(a, bus.lead, 'square', hz(n), at, len, st === 'polka' ? 0.035 : 0.03, 0.01);
      osc(a, bus.lead, 'triangle', hz(n) * 1.004, at, len, 0.065, 0.01);
      if (l >= 4) {
        const lfo = a.createOscillator(), lg = a.createGain();
        lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, at); lg.gain.linearRampToValueAtTime(hz(n) * 0.012, at + len * 0.6);
        lfo.connect(lg).connect(o1.frequency); lfo.start(at); lfo.stop(at + len);
      }
    }
  }
  // Begleitung je Stil
  if (st === 'polka') {
    if (k % 8 === 0) osc(a, bus.band, 'triangle', hz(root), at, sl * 2, 0.22, 0.004);
    if (k % 8 === 4) osc(a, bus.band, 'triangle', hz(root + 7), at, sl * 2, 0.2, 0.004);
    if (k % 4 === 2) for (const v of voices) osc(a, bus.band, 'square', hz(v), at, sl * 1.2, 0.018, 0.003);
    if (k % 4 === 0) kick(a, bus.band, at, 0.22 + intense * 0.08);
    if (k % 2 === 1 || intense > 0.5) hit(a, bus.band, at, { vol: 0.02, len: 0.035 });
    if (k === 4 || k === 12) hit(a, bus.band, at, { type: 'bandpass', freq: 1800, len: 0.12, vol: 0.06, q: 0.8 });
  } else if (st === 'spooky') {
    if (k === 0) for (const v of voices) osc(a, bus.band, 'sine', hz(v - 12), at, sl * 16, 0.035, 0.3); // Orgel
    if (k % 4 === 0) osc(a, bus.band, 'triangle', hz(root), at, sl * 3, 0.2, 0.01);
    if (k === 0 || k === 3) kick(a, bus.band, at, k === 0 ? 0.28 : 0.18); // Herzschlag
    if (intense > 0.3 && k % 2 === 0) hit(a, bus.band, at, { vol: 0.015, len: 0.04 });
    if (k === 8) hit(a, bus.band, at, { type: 'bandpass', freq: 900, len: 0.25, vol: 0.03, q: 3 });
  } else if (st === 'winter') {
    if (k % 4 === 0) osc(a, bus.band, 'sine', hz(root), at, sl * 3.5, 0.22, 0.01);
    if (k % 4 === 2) for (const v of voices) osc(a, bus.band, 'triangle', hz(v), at, sl * 1.5, 0.022, 0.004);
    hit(a, bus.band, at, { freq: 8500, vol: k % 2 ? 0.012 : 0.03, len: 0.06 }); // Schlittenschellen
    if (k === 0 || k === 8) kick(a, bus.band, at, 0.2 + intense * 0.08);
    if (k === 12) hit(a, bus.band, at, { type: 'bandpass', freq: 2000, len: 0.1, vol: 0.05 });
  } else {
    // Menü: walzerhaftes Zupfen + leises Schlagzeug
    if (k % 4 === 0) osc(a, bus.band, 'triangle', hz(root + (k % 8 === 4 ? 7 : 0)), at, sl * 2, 0.2, 0.005);
    if (k % 4 === 2) for (const v of voices) osc(a, bus.band, 'triangle', hz(v), at, sl * 1.3, 0.03, 0.004);
    if (k === 0 || k === 8) kick(a, bus.band, at, 0.2);
    if (k === 4 || k === 12) hit(a, bus.band, at, { type: 'bandpass', freq: 2200, len: 0.08, vol: 0.04 });
    if (k % 2 === 0) hit(a, bus.band, at, { vol: 0.012, len: 0.03 });
  }
}
