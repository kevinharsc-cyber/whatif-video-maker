// Strichmännchen mit Gelenken (Kopf, Rumpf, Arme, Beine).
// Jede Bewegung ("Aktion") ist eine Funktion, die für einen Zeitpunkt die
// Winkel aller Gelenke liefert. Daraus wird die Figur gezeichnet.

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => {
  k = clamp(k);
  return k * k * (3 - 2 * k);
};
export const seg = (p, a, b) => clamp((p - a) / (b - a));

// Proportionen relativ zur Figurgröße
const L = { head: 0.085, torso: 0.3, ua: 0.16, la: 0.15, th: 0.21, sh: 0.21 };

export const BASE = {
  torso: 0, head: 0, la1: 0.12, la2: -0.1, ra1: -0.12, ra2: -0.1,
  lt1: 0.06, lt2: 0, rt1: -0.06, rt2: 0, rot: 0, dy: 0,
};

function mix(a, b, k) {
  const o = {};
  for (const key of Object.keys(BASE)) o[key] = lerp(a[key] ?? BASE[key], b[key] ?? BASE[key], k);
  return o;
}

// ------------------------------------------------------------ Posen ---

function walkPose(t, speed = 1, run = false) {
  const ph = t * TAU * (run ? 2.6 : 1.6) * speed;
  const s = Math.sin(ph);
  const amp = run ? 0.75 : 0.45;
  return {
    ...BASE,
    torso: run ? 0.28 : 0.05,
    lt1: s * amp,
    lt2: -Math.max(0, -Math.sin(ph)) * (run ? 1.3 : 0.7),
    rt1: -s * amp,
    rt2: -Math.max(0, Math.sin(ph)) * (run ? 1.3 : 0.7),
    la1: -s * (run ? 0.9 : 0.5),
    la2: run ? 1.4 : 0.3,
    ra1: s * (run ? 0.9 : 0.5),
    ra2: run ? 1.4 : 0.3,
    dy: Math.abs(Math.cos(ph)) * (run ? 0.03 : 0.012),
  };
}

const SIT = { ...BASE, lt1: 1.45, lt2: -1.45, rt1: 1.35, rt2: -1.35, la1: 0.5, la2: 0.6, ra1: 0.4, ra2: 0.7 };
const ARMS_UP = { la1: 2.6, la2: 0.2, ra1: 2.8, ra2: -0.2 };
const idle = (t) => ({ ...BASE, la1: 0.1 + Math.sin(t * 2) * 0.03, ra1: -0.1 - Math.sin(t * 2) * 0.03, dy: Math.sin(t * 2) * 0.004 });

/**
 * Liefert {pose, x (0..1 Anteil von Start→Ziel), bubble, lying}
 * p = Fortschritt der Szene (0..1), t = Sekunden seit Szenenbeginn, ev = Ereigniszeitpunkt (0..1)
 */
export function actionPose(action, p, t, ev = 0.3) {
  switch (action) {
    case 'walk':
      return { pose: walkPose(t), move: p };
    case 'run':
      return { pose: walkPose(t, 1, true), move: p };
    case 'sit':
      return { pose: { ...SIT, head: Math.sin(t * 0.8) * 0.08 }, seated: true };
    case 'sleep':
      return { pose: { ...BASE, la1: 0.3, ra1: 0.2 }, lying: 1, bubble: 'Z' };
    case 'get_up': {
      // liegt im Bett → setzt sich auf → steht auf → geht los
      if (p < 0.3) return { pose: { ...BASE, la1: 0.3 }, lying: 1, bubble: p < 0.22 ? 'Z' : null };
      if (p < 0.45) {
        const k = ease(seg(p, 0.3, 0.45));
        return { pose: mix({ ...BASE }, { ...SIT, la1: 2.4, la2: 1.2, ra1: 0.3 }, k), lying: 1 - k, seated: k > 0.5 };
      }
      if (p < 0.55) {
        const k = ease(seg(p, 0.45, 0.55));
        return { pose: mix({ ...SIT, la1: 2.4, la2: 1.2 }, { ...BASE, la1: 2.6, ra1: 2.7 }, k), stretch: true };
      }
      const k = seg(p, 0.55, 1);
      return { pose: walkPose(t), move: k };
    }
    case 'scared': {
      if (p < ev) return { pose: idle(t) };
      const k = seg(p, ev, ev + 0.08);
      const shake = Math.sin(t * 40) * 0.05;
      return {
        pose: { ...BASE, ...ARMS_UP, torso: -0.15 + shake, head: -0.2, la2: 0.4, ra2: -0.4, dy: Math.sin(k * Math.PI) * 0.12 },
        bubble: '!',
      };
    }
    case 'flee': {
      if (p < ev) return { pose: idle(t) };
      if (p < ev + 0.12) {
        const k = seg(p, ev, ev + 0.12);
        return { pose: { ...BASE, ...ARMS_UP, torso: -0.2, dy: Math.sin(k * Math.PI) * 0.12 }, bubble: '!' };
      }
      const k = seg(p, ev + 0.12, 1);
      return { pose: { ...walkPose(t, 1.2, true), ...ARMS_UP, la1: 2.6 + Math.sin(t * 20) * 0.2 }, move: k, bubble: '!' };
    }
    case 'look_up': {
      const k = ease(seg(p, 0, 0.25));
      return { pose: { ...idle(t), head: -0.5 * k, ra1: lerp(-0.1, 2.5, k), ra2: 0.1 } };
    }
    case 'wave':
      return { pose: { ...idle(t), ra1: 2.6, ra2: 0.6 + Math.sin(t * 9) * 0.6 } };
    case 'shiver':
      return {
        pose: { ...BASE, la1: 0.9, la2: 1.9, ra1: 0.8, ra2: 2.0, torso: Math.sin(t * 45) * 0.04, head: 0.15 },
        jitter: 0.004,
        bubble: '~',
      };
    case 'fall': {
      const k = ease(seg(p, ev, ev + 0.15));
      return { pose: { ...BASE, ...ARMS_UP }, lying: k, bubble: k > 0 && k < 1 ? '!' : null };
    }
    case 'cheer': {
      const j = Math.abs(Math.sin(t * 6));
      return { pose: { ...BASE, ...ARMS_UP, lt1: 0.3 * j, rt1: -0.3 * j, dy: j * 0.08 } };
    }
    case 'think':
      return { pose: { ...idle(t), ra1: 0.6, ra2: 2.4, head: 0.15 }, bubble: '?' };
    case 'sad':
      return { pose: { ...BASE, torso: 0.25, head: 0.45, la1: 0.05, ra1: -0.05 }, bubble: '…' };
    case 'work':
      return { pose: { ...SIT, la1: 1.3, la2: 0.2 + Math.sin(t * 12) * 0.15, ra1: 1.2, ra2: 0.25 - Math.sin(t * 12) * 0.15 }, seated: true };
    case 'point':
      return { pose: { ...idle(t), ra1: 1.9, ra2: 0 } };
    case 'swim': {
      const s = Math.sin(t * 6);
      return { pose: { ...BASE, la1: 2.5 * (0.5 + 0.5 * s), ra1: 2.5 * (0.5 - 0.5 * s), lt1: s * 0.3, rt1: -s * 0.3 }, lying: 1, swim: true, move: p };
    }
    case 'jump':
      return { pose: { ...BASE, la1: 1.2, ra1: 1.3, lt1: 0.4, lt2: -0.8, rt1: 0.3, rt2: -0.8, dy: Math.abs(Math.sin(t * 4)) * 0.25 } };
    case 'float': // Schwerelosigkeit
      return { pose: { ...BASE, ...ARMS_UP, la1: 1.8 + Math.sin(t) * 0.3, ra1: 2.0 - Math.sin(t) * 0.3, lt1: 0.3, rt1: -0.4, rot: Math.sin(t * 0.7) * 0.6, dy: 0.25 + Math.sin(t * 1.3) * 0.05 } };
    default:
      return { pose: idle(t) };
  }
}

// ---------------------------------------------------------- Zeichnen ---

/**
 * Zeichnet eine Figur. (x, groundY) = Fußpunkt, size = Figurhöhe in px,
 * dir = Blickrichtung (1 rechts, -1 links)
 */
export function drawFigure(g, { x, groundY, size, dir = 1, pose, lying = 0, color = '#1b1b1f', fill = '#fff', cap = null, bubble = null, t = 0, jitter = 0, bubbleColor, look = null, emotion = 'neutral' }) {
  const P = { ...BASE, ...pose };
  const S = size;
  const vec = (ang, len) => [Math.sin(ang) * len * S * dir, Math.cos(ang) * len * S];
  // Positionen relativ zur Hüfte
  const TL = look ? 0.22 : L.torso; // Comic-Figur: kürzerer Rumpf, größerer Kopf
  const up = [Math.sin(P.torso) * TL * S * dir, -Math.cos(P.torso) * TL * S];
  const neck = up;
  const headDir = P.torso + P.head;
  const head = [neck[0] + Math.sin(headDir) * (L.head + 0.02) * S * dir, neck[1] - Math.cos(headDir) * (L.head + 0.02) * S];
  const limb = (from, a1, a2, l1, l2) => {
    const v1 = vec(a1, l1);
    const j = [from[0] + v1[0], from[1] + v1[1]];
    const v2 = vec(a1 + a2, l2);
    return [j, [j[0] + v2[0], j[1] + v2[1]]];
  };
  const hip = [0, 0];
  const [lk, lf] = limb(hip, P.lt1, P.lt2, L.th, L.sh);
  const [rk, rf] = limb(hip, P.rt1, P.rt2, L.th, L.sh);
  const [le, lh] = limb(neck, P.la1, P.la2, L.ua, L.la);
  const [re, rh] = limb(neck, P.ra1, P.ra2, L.ua, L.la);

  // Hüfte so setzen, dass der tiefste Fuß auf dem Boden steht
  const footY = Math.max(lf[1], rf[1]);
  const hx = x + (jitter ? Math.sin(t * 70) * jitter * S : 0);
  const standHipY = groundY - footY - P.dy * S;
  // Liegend: Körper um 90° gedreht, Rücken auf dem Boden
  const lyingHipY = groundY - 0.03 * S;
  const hy = lerp(standHipY, lyingHipY, lying);

  g.save();
  g.translate(hx, hy);
  g.rotate(-dir * (Math.PI / 2) * lying + P.rot);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (look) {
    drawBean(g, S, dir, { hip, neck, lk, lf, rk, rf, le, lh, re, rh, headDir }, look, emotion, t);
    g.restore();
    if (bubble && bubble !== '~') {
      const bx = hx + (lying > 0.5 ? dir * S * 0.35 : 0.2 * S * dir);
      const by = lying > 0.5 ? groundY - S * 0.4 : hy - (L.torso + 0.34) * S;
      drawBubble(g, bubble, bx, by, S * 0.9, t, bubbleColor || '#fff');
    }
    return;
  }
  g.strokeStyle = color;
  g.lineWidth = Math.max(3, S * 0.045);
  const line = (pts) => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
    g.stroke();
  };
  // hintere Gliedmaßen etwas heller
  g.globalAlpha *= 0.75;
  line([hip, lk, lf]);
  line([neck, le, lh]);
  g.globalAlpha /= 0.75;
  line([hip, neck]);
  line([hip, rk, rf]);
  line([neck, re, rh]);
  // Kopf
  g.beginPath();
  g.arc(head[0], head[1], L.head * S, 0, TAU);
  g.fillStyle = fill;
  g.fill();
  g.stroke();
  // Auge (zeigt Blickrichtung)
  g.fillStyle = color;
  g.beginPath();
  g.arc(head[0] + L.head * S * 0.45 * dir, head[1] - L.head * S * 0.1, Math.max(1.5, S * 0.012), 0, TAU);
  g.fill();
  // Kappe der Hauptfigur (damit man "dich" in jeder Szene erkennt)
  if (cap) {
    g.fillStyle = cap;
    g.beginPath();
    g.arc(head[0], head[1], L.head * S * 1.02, Math.PI * 1.05, Math.PI * 1.95);
    g.closePath();
    g.fill();
    g.fillRect(head[0] + (dir > 0 ? 0 : -L.head * S * 1.5), head[1] - L.head * S * 0.35, L.head * S * 1.5, L.head * S * 0.28);
  }
  g.restore();

  if (bubble) {
    const bx = hx + (lying > 0.5 ? dir * S * 0.35 : L.head * S * dir);
    const by = lying > 0.5 ? groundY - S * 0.35 : hy - (L.torso + L.head * 2.6) * S;
    drawBubble(g, bubble, bx, by, S, t, bubbleColor || color);
  }
}

function drawBubble(g, kind, x, y, S, t, color) {
  g.save();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'Z') {
    for (let k = 0; k < 3; k++) {
      const ph = (t * 0.6 + k / 3) % 1;
      g.globalAlpha = 1 - ph;
      g.font = `900 ${Math.round(S * (0.07 + ph * 0.08))}px system-ui, sans-serif`;
      g.fillText('Z', x + ph * S * 0.25, y - ph * S * 0.35);
    }
  } else {
    const pop = 1 + Math.sin(t * 8) * 0.06;
    g.font = `900 ${Math.round(S * 0.16 * pop)}px system-ui, sans-serif`;
    g.fillText(kind, x, y - S * 0.06);
  }
  g.restore();
}

// ------------------------------------------------- Comic-Figur (Bean) ---
// Dicke, runde Gliedmaßen, großer Kopf mit Gesicht, Kleidung (Hoodie),
// warmes Randlicht – wie in modernen Erklär-Animationen.

function thick(g, pts, w, c) {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
  g.stroke();
}

function drawBean(g, S, dir, J, look, emotion, t) {
  const { hip, neck, lk, lf, rk, rf, le, lh, re, rh, headDir } = J;
  const legW = S * 0.11;
  const armW = S * 0.09;
  const back = look.shade || 'rgba(0,0,0,0.25)';
  // hintere Seite (etwas dunkler)
  thick(g, [hip, lk, lf], legW, look.pants);
  thick(g, [neck, le, lh], armW, look.cloth);
  thick(g, [hip, lk, lf], legW, back);
  thick(g, [neck, le, lh], armW, back);
  shoe(g, lf, S, dir, look);
  hand(g, lh, S, look, true);
  // Rumpf: Hoodie als dicke, runde Form
  const mid = [(hip[0] + neck[0]) / 2, (hip[1] + neck[1]) / 2];
  thick(g, [[hip[0], hip[1] - S * 0.02], neck], S * 0.23, look.cloth);
  thick(g, [[hip[0], hip[1] + S * 0.015], [hip[0], hip[1] + S * 0.015]], S * 0.17, look.pants);
  // Bauchtasche / Hoodie-Details
  if (look.hoodie) {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.ellipse(mid[0] + dir * S * 0.02, mid[1] + S * 0.05, S * 0.07, S * 0.035, 0, 0, Math.PI * 2);
    g.fill();
  }
  // vordere Seite
  thick(g, [hip, rk, rf], legW, look.pants);
  shoe(g, rf, S, dir, look);
  // Kopf
  const hr = S * 0.16;
  const hc = [neck[0] + Math.sin(headDir) * hr * 0.95 * dir, neck[1] - Math.cos(headDir) * hr * 0.95];
  if (look.hoodie) {
    g.fillStyle = look.cloth;
    g.beginPath();
    g.arc(hc[0] - dir * hr * 0.12, hc[1] + hr * 0.05, hr * 1.18, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = look.skin;
  g.beginPath();
  g.arc(hc[0], hc[1], hr, 0, Math.PI * 2);
  g.fill();
  // Randlicht
  if (look.rim) {
    g.strokeStyle = look.rim;
    g.lineWidth = hr * 0.12;
    g.beginPath();
    g.arc(hc[0], hc[1], hr * 0.94, -Math.PI * 0.95, -Math.PI * 0.35);
    g.stroke();
  }
  face(g, hc, hr, dir, emotion, t, look);
  // Arm vorne
  thick(g, [neck, re, rh], armW, look.cloth);
  hand(g, rh, S, look, false);
}

function shoe(g, f, S, dir, look) {
  g.fillStyle = look.shoe || '#1a0f0a';
  g.beginPath();
  g.ellipse(f[0] + dir * S * 0.03, f[1] + S * 0.01, S * 0.06, S * 0.032, 0, 0, Math.PI * 2);
  g.fill();
}

function hand(g, h, S, look, isBack) {
  g.fillStyle = look.skin;
  g.beginPath();
  g.arc(h[0], h[1], S * 0.045, 0, Math.PI * 2);
  g.fill();
  if (isBack) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fill();
  }
}

function face(g, c, r, dir, emo, t, look) {
  const ex = c[0] + dir * r * 0.28;
  const ey = c[1] - r * 0.05;
  const gap = r * 0.36;
  const eyeC = look.eye || '#fff3e0';
  const blink = emo !== 'sleep' && Math.sin(t * 1.3) > 0.985;
  // Augen
  for (const k of [-1, 1]) {
    const x = ex + k * gap * 0.5;
    if (emo === 'sleep' || blink) {
      g.strokeStyle = eyeC;
      g.lineWidth = r * 0.08;
      g.beginPath();
      g.arc(x, ey, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      continue;
    }
    const big = emo === 'scared' || emo === 'wow' ? 1.25 : 1;
    g.fillStyle = eyeC;
    g.beginPath();
    g.ellipse(x, ey, r * 0.11 * big, r * 0.14 * big, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a0d06';
    const look_y = emo === 'wow' ? -r * 0.05 : emo === 'sad' ? r * 0.04 : 0;
    g.beginPath();
    g.arc(x + dir * r * 0.035, ey + look_y, r * 0.055 * big, 0, Math.PI * 2);
    g.fill();
  }
  // Augenbrauen
  g.strokeStyle = eyeC;
  g.lineWidth = r * 0.075;
  g.lineCap = 'round';
  for (const k of [-1, 1]) {
    const x = ex + k * gap * 0.5;
    const y = ey - r * 0.27;
    // innen = zur Gesichtsmitte hin
    let inner = 0;
    if (emo === 'scared' || emo === 'worried' || emo === 'sad') inner = -r * 0.07;
    if (emo === 'angry') inner = r * 0.06;
    if (emo === 'think') inner = k === 1 ? r * 0.05 : -r * 0.03;
    const lift = emo === 'wow' || emo === 'scared' ? -r * 0.06 : 0;
    g.beginPath();
    g.moveTo(x - k * r * 0.11, y + lift + inner);
    g.lineTo(x + k * r * 0.11, y + lift - inner * 0.4);
    g.stroke();
  }
  // Mund
  const mx = ex;
  const my = c[1] + r * 0.4;
  g.strokeStyle = eyeC;
  g.lineWidth = r * 0.08;
  g.beginPath();
  if (emo === 'happy') {
    g.fillStyle = eyeC;
    g.arc(mx, my - r * 0.06, r * 0.2, 0.1 * Math.PI, 0.9 * Math.PI);
    g.closePath();
    g.fill();
  } else if (emo === 'scared' || emo === 'wow') {
    g.fillStyle = '#1a0d06';
    g.ellipse(mx, my, r * 0.1, r * (emo === 'scared' ? 0.14 : 0.1), 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (emo === 'worried') {
    for (let k = 0; k <= 8; k++) {
      const px = mx - r * 0.18 + (k / 8) * r * 0.36;
      const py = my + Math.sin(k * 1.4 + t * 6) * r * 0.035;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  } else if (emo === 'sad') {
    g.arc(mx, my + r * 0.16, r * 0.15, 1.15 * Math.PI, 1.85 * Math.PI);
    g.stroke();
  } else if (emo === 'think') {
    g.moveTo(mx - r * 0.12, my + r * 0.02);
    g.lineTo(mx + r * 0.12, my - r * 0.04);
    g.stroke();
  } else if (emo === 'sleep') {
    g.ellipse(mx, my, r * 0.06, r * 0.04, 0, 0, Math.PI * 2);
    g.stroke();
  } else {
    g.arc(mx, my - r * 0.1, r * 0.15, 0.25 * Math.PI, 0.75 * Math.PI);
    g.stroke();
  }
}

// Gefühl passend zur Aktion
export function emotionFor(action, p, ev = 0.3, lying = 0) {
  switch (action) {
    case 'sleep':
      return 'sleep';
    case 'get_up':
      return p < 0.25 ? 'sleep' : p < 0.55 ? 'worried' : 'neutral';
    case 'scared':
    case 'flee':
    case 'fall':
      return p < ev ? 'neutral' : 'scared';
    case 'sad':
      return 'sad';
    case 'shiver':
      return 'worried';
    case 'cheer':
    case 'wave':
    case 'jump':
      return 'happy';
    case 'think':
      return 'think';
    case 'look_up':
    case 'float':
      return 'wow';
    default:
      return 'neutral';
  }
}
