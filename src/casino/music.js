// Entspannte Lounge-Musik im Hintergrund (WebAudio, selbst komponiert, Endlosschleife)
// E-Piano-Akkorde (maj7/9), weicher Bass, Besen-Schlagzeug, ab und zu ein Vibraphon-Motiv.
let ctx = null, bus = null, timer = null, step = 0, nextT = 0, on = false, vol = 0.5;
const BPM = 76, SPB = 60 / BPM / 2; // Achtel
// Akkorde: [Bass-MIDI, Akkordtöne]
const PROG = [
  [50, [62, 65, 69, 72, 76]], // Dm9
  [43, [59, 62, 65, 69, 74]], // G13
  [48, [60, 64, 67, 71, 74]], // Cmaj9
  [45, [60, 64, 67, 69, 72]], // Am7
  [41, [57, 60, 64, 67, 72]], // Fmaj9
  [40, [59, 62, 64, 67, 71]], // Em7
  [38, [57, 60, 62, 65, 69]], // Dm7
  [43, [59, 62, 65, 67, 71]], // G7
];
// Melodie-Motive (Achtel-Schritt, MIDI-Ton relativ zum Akkord-Grundton-Register, Länge)
const MOTIFS = [
  [[0, 76, 3], [3, 74, 1], [4, 72, 4]],
  [[2, 79, 2], [4, 77, 2], [6, 76, 2]],
  [[0, 72, 2], [2, 74, 2], [4, 76, 4]],
  [[1, 81, 2], [4, 79, 4]],
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensure(c) {
  if (bus) return;
  ctx = c;
  bus = ctx.createGain(); bus.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const dl = ctx.createDelay(2); dl.delayTime.value = SPB * 3; const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.22;
  bus.connect(lp); lp.connect(ctx.destination); lp.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(ctx.destination);
}
function ep(f, at, len, v) { // E-Piano: Sinus + leichte FM, weiches Ausklingen, Tremolo
  const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  o.frequency.value = f; m.frequency.value = f * 2; mg.gain.setValueAtTime(f * 0.6, at); mg.gain.exponentialRampToValueAtTime(f * 0.05, at + 0.4);
  m.connect(mg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(bus); o.start(at); m.start(at); o.stop(at + len + 0.05); m.stop(at + len + 0.05);
}
function tone(f, at, len, v, type = 'sine', attack = 0.01) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(g).connect(bus); o.start(at); o.stop(at + len + 0.05);
}
let noiseBuf = null;
function brush(at, v, len = 0.12) {
  if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 6000; f.Q.value = 0.6;
  g.gain.setValueAtTime(v, at); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  s.connect(f).connect(g).connect(bus); s.start(at); s.stop(at + len + 0.02);
}
function schedule(at) {
  const bar = Math.floor(step / 8) % PROG.length, k = step % 8;
  const [bass, ch] = PROG[bar];
  const swing = k % 2 ? SPB * 0.18 : 0; const t = at + swing;
  // Akkord auf 1 und angedeutet auf „und“ von 3
  if (k === 0) ch.forEach((n, i) => ep(hz(n), t + i * 0.012, SPB * 7, 0.035));
  if (k === 5) ch.slice(1, 4).forEach((n) => ep(hz(n), t, SPB * 2.5, 0.022));
  // Bass: 1 und 3, mit Durchgangston
  if (k === 0) tone(hz(bass), t, SPB * 3.5, 0.16, 'triangle', 0.02);
  if (k === 4) tone(hz(bass + 7), t, SPB * 2.5, 0.12, 'triangle', 0.02);
  if (k === 7) tone(hz(bass + (bar % 2 ? 5 : 2)), t, SPB * 0.9, 0.08, 'triangle', 0.02);
  // Besen + leise Kick
  if (k % 2 === 0) brush(t, k === 2 || k === 6 ? 0.035 : 0.018, k === 2 || k === 6 ? 0.22 : 0.08);
  else brush(t, 0.01, 0.05);
  if (k === 0) tone(60, t, 0.25, 0.12, 'sine', 0.005);
  // Vibraphon-Motiv alle 2 Takte, abwechselnd
  if (bar % 2 === 0) {
    const mot = MOTIFS[(Math.floor(step / 16)) % MOTIFS.length];
    for (const [s, n, l] of mot) if (s === k) { tone(hz(n), t, SPB * l * 1.6, 0.05, 'sine', 0.005); tone(hz(n) * 4, t, 0.25, 0.008, 'sine', 0.003); }
  }
}
function tick() {
  if (!ctx) return;
  while (nextT < ctx.currentTime + 0.25) { schedule(nextT); nextT += SPB; step++; }
}
export const Music = {
  start(c) {
    if (!c) return; ensure(c);
    if (on) return; on = true;
    nextT = Math.max(nextT, ctx.currentTime + 0.1);
    bus.gain.cancelScheduledValues(ctx.currentTime); bus.gain.setTargetAtTime(vol, ctx.currentTime, 0.8);
    timer = setInterval(tick, 60);
  },
  stop() {
    if (!on) return; on = false;
    bus.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => { if (!on) { clearInterval(timer); timer = null; } }, 1200);
  },
  setVolume(v) { vol = v; if (on && bus) bus.gain.setTargetAtTime(v, ctx.currentTime, 0.4); },
  get playing() { return on; },
};
