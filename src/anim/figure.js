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
export function drawFigure(g, { x, groundY, size, dir = 1, pose, lying = 0, color = '#1b1b1f', fill = '#fff', cap = null, bubble = null, t = 0, jitter = 0, bubbleColor }) {
  const P = { ...BASE, ...pose };
  const S = size;
  const vec = (ang, len) => [Math.sin(ang) * len * S * dir, Math.cos(ang) * len * S];
  // Positionen relativ zur Hüfte
  const up = [Math.sin(P.torso) * L.torso * S * dir, -Math.cos(P.torso) * L.torso * S];
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
