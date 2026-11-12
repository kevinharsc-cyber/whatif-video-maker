// Kleine Soundeffekte (WebAudio, ohne Dateien)
let ctx = null, out = null, enabled = true;
export function setSound(on) { enabled = on; }
export function unlockAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(f0, f1, len, type = 'sine', vol = 0.15, delay = 0) {
  if (!enabled || !unlockAudio()) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.05);
}
function noise(len, freq, vol = 0.1, delay = 0, type = 'bandpass') {
  if (!enabled || !unlockAudio()) return;
  const t = ctx.currentTime + delay, b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = b; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  s.connect(f).connect(g).connect(out); s.start(t);
}
export const SFX = {
  click: () => tone(900, 700, 0.05, 'triangle', 0.08),
  door: () => { noise(0.5, 400, 0.12); tone(180, 120, 0.5, 'sawtooth', 0.03); },
  unlock: () => { tone(1200, 1200, 0.05, 'square', 0.05); tone(800, 800, 0.08, 'square', 0.05, 0.08); },
  coin: () => { tone(1320, 1320, 0.06, 'square', 0.05); tone(1760, 1760, 0.12, 'square', 0.05, 0.06); },
  cash: () => { for (let i = 0; i < 4; i++) tone(1400 + i * 200, 1400 + i * 200, 0.06, 'square', 0.04, i * 0.05); noise(0.15, 5000, 0.05, 0.2); },
  place: () => { noise(0.15, 300, 0.2, 0, 'lowpass'); tone(160, 80, 0.2, 'sine', 0.2); },
  error: () => { tone(220, 180, 0.15, 'square', 0.05); tone(180, 150, 0.2, 'square', 0.05, 0.12); },
  quest: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.12, i * 0.09)),
  level: () => [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.12, i * 0.08)),
  spin: () => { for (let i = 0; i < 10; i++) tone(700 + (i % 3) * 120, 700, 0.03, 'square', 0.025, i * 0.07); },
  lever: () => { noise(0.12, 1500, 0.1); tone(300, 140, 0.25, 'sawtooth', 0.04); },
  buy: () => { tone(880, 1320, 0.12, 'triangle', 0.1); tone(1320, 1760, 0.15, 'triangle', 0.08, 0.1); },
};
