// Baut aus einer Szenenbeschreibung eine Animation.
// Die Beschreibung kommt von der KI (Gemini) oder wird aus dem Text erraten.

import { actionPose, drawFigure, seg, emotionFor } from './figure.js';
import { seededRandom } from '../util.js';
import { PLACES, drawSkyProps, drawGroundProps, drawEffect, effectSkyDarkness, cameraShake } from './world.js';

export const PLACE_LIST = Object.keys(PLACES);
export const ACTIONS = ['idle', 'walk', 'run', 'sit', 'sleep', 'get_up', 'scared', 'flee', 'look_up', 'wave', 'shiver', 'fall', 'cheer', 'think', 'sad', 'work', 'point', 'swim', 'jump', 'float'];
export const PROPS = ['sun', 'moon', 'earth', 'clouds', 'birds', 'plane', 'rocket', 'meteor', 'cars', 'bees', 'dinosaur', 'trees', 'house', 'money'];
export const PROP_STATES = ['normal', 'explode', 'vanish', 'grow', 'dim', 'stop', 'fall', 'big', 'red_giant', 'dead', 'storm'];
export const EFFECTS = ['none', 'explosion', 'flash', 'darkness', 'fire', 'flood', 'quake', 'rain', 'storm', 'snow', 'freeze', 'heat', 'alarm'];
export const TIMES = ['day', 'sunset', 'night'];
const POS = { offleft: -0.15, left: 0.22, center: 0.5, right: 0.78, offright: 1.15 };

// Kurzbeschreibung für den KI-Prompt
export const ANIM_PROMPT_HELP = `"anim" beschreibt die Strichmännchen-Animation der Szene (Werte NUR aus diesen Listen):
- "place": ${PLACE_LIST.join(', ')}
- "time": ${TIMES.join(', ')}
- "props": Liste von {"type": ${PROPS.join('|')}, "state": ${PROP_STATES.join('|')}}
- "actors": 1-2 Figuren {"action": ${ACTIONS.join('|')}, "from": left|center|right|offleft|offright, "to": left|center|right|offleft|offright}. Die erste Figur ist "du" (Hauptfigur mit roter Kappe).
- "crowd": {"count": 0-4, "action": eine Aktion} für weitere Menschen
- "effect": ${EFFECTS.join(', ')} (Ereignisse wie Explosionen passieren bei ca. 30 % der Szene; Figuren mit "scared"/"flee"/"fall" reagieren genau dann)
Beispiele: Aufwachen = {"place":"bedroom","actors":[{"action":"get_up"}]}; Sonne explodiert = {"place":"meadow","props":[{"type":"sun","state":"explode"}],"actors":[{"action":"flee"}],"crowd":{"count":3,"action":"scared"},"effect":"explosion"}`;

// --------------------------------------------------------- Normieren ---

export function normalizeAnim(a) {
  if (!a || typeof a !== 'object') return null;
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const spec = {
    place: pick(a.place, PLACE_LIST, null),
    time: pick(a.time, TIMES, 'day'),
    props: (Array.isArray(a.props) ? a.props : [])
      .map((p) => (typeof p === 'string' ? { type: p } : p))
      .filter((p) => p && PROPS.includes(p.type))
      .map((p) => ({ type: p.type, state: pick(p.state, PROP_STATES, 'normal') }))
      .slice(0, 4),
    actors: (Array.isArray(a.actors) ? a.actors : [])
      .map((x) => (typeof x === 'string' ? { action: x } : x))
      .filter(Boolean)
      .map((x) => ({ action: pick(x.action, ACTIONS, 'idle'), from: pick(x.from, Object.keys(POS), null), to: pick(x.to, Object.keys(POS), null) }))
      .slice(0, 2),
    crowd: { count: Math.max(0, Math.min(4, Number(a.crowd?.count) || 0)), action: pick(a.crowd?.action, ACTIONS, 'idle') },
    effect: pick(a.effect, EFFECTS, 'none'),
  };
  if (!spec.place) return null;
  return spec;
}

// --------------------------------------------- Aus dem Text erraten ---

const has = (t, re) => re.test(t);

export function guessAnim(text, topic = '', index = 0, count = 1) {
  const t = `${text}`.toLowerCase();
  const all = `${text} ${topic}`.toLowerCase();
  const spec = { place: null, time: 'day', props: [], actors: [], crowd: { count: 0, action: 'idle' }, effect: 'none' };
  let action = null;

  // Ort
  if (has(t, /(schlaf|bett|aufwach|wachst\b.*\bauf|morgens|aufstehen|wecker)/)) {
    spec.place = 'bedroom';
    action = 'get_up';
  } else if (has(t, /(weltall|\ball\b|astronaut|raumstation|schwerelos|rakete)/)) spec.place = 'space';
  else if (has(all, /(erde|planet)/) && has(t, /(dreh|rotation|umlaufbahn|stehen bleibt|stillstand|kern|von oben|achse)/)) spec.place = 'earth';
  else if (has(t, /(labor|wissenschaftler|forscher|nasa|experte)/)) spec.place = 'lab';
  else if (has(t, /(fernseh|internet|handy|smartphone|zuhause|sofa|wohnung|strom)/)) spec.place = 'living_room';
  else if (has(all, /(letzte mensch|leer|verlassen|niemand|keine menschen|ausgestorben|ruinen)/)) spec.place = 'empty_city';
  else if (has(t, /(verkehr|auto|straße|strasse|stau)/)) spec.place = 'street';
  else if (has(t, /(stadt|städte|gebäude|hochhaus)/)) spec.place = 'city';
  else if (has(t, /(meer|strand|ozean|welle|insel|küste|meeresspiegel)/)) spec.place = 'beach';
  else if (has(t, /(wüste|dürre|trocken|verdurst)/)) spec.place = 'desert';
  else if (has(t, /(wald|bäume|baum|sauerstoff)/)) spec.place = 'forest';
  else if (has(t, /(eiszeit|schnee|gefrier|eis\b|kälte|minus)/)) spec.place = 'snow';
  else if (has(all, /(biene|blume|natur|wiese|pflanze|bestäub|obst)/)) spec.place = 'meadow';
  else spec.place = ['meadow', 'street', 'city', 'meadow', 'beach'][index % 5];

  // Tageszeit
  if (has(t, /(nacht|dunkel|finster|sterne)/)) spec.time = 'night';
  else if (has(t, /(abend|sonnenuntergang)/)) spec.time = 'sunset';

  // Dinge
  const sun = has(all, /sonne/);
  if (sun && spec.place !== 'bedroom') {
    let state = 'normal';
    if (has(all, /(explod|explosion|supernova)/)) state = 'explode';
    else if (has(all, /(erlisch|ausgeht|geht aus|verschwind|erlosch)/) && has(t, /sonne/)) state = 'vanish';
    else if (has(all, /(rote[rn]? riese|größer|wächst|näher)/)) state = 'grow';
    spec.props.push({ type: 'sun', state });
  }
  if (has(all, /mond/) && spec.place !== 'bedroom') spec.props.push({ type: 'moon', state: has(all, /(verschwind|weg|fehlt)/) ? 'vanish' : has(t, /(näher|riesig|groß)/) ? 'big' : 'normal' });
  if (has(all, /biene/)) spec.props.push({ type: 'bees', state: has(t, /(verschwind|sterben|aussterb|weg|keine)/) ? 'vanish' : 'normal' });
  if (has(t, /(auto|verkehr|stau)/)) spec.props.push({ type: 'cars', state: has(t, /(still|stehen|stopp|chaos)/) ? 'stop' : 'normal' });
  if (has(all, /dinosaur/)) spec.props.push({ type: 'dinosaur', state: 'normal' });
  if (has(t, /(rakete|raumschiff)/)) spec.props.push({ type: 'rocket', state: 'normal' });
  if (has(t, /(meteor|asteroid|komet)/)) spec.props.push({ type: 'meteor', state: 'normal' });
  if (has(t, /flugzeug/)) spec.props.push({ type: 'plane', state: has(t, /(absturz|stürz|fall)/) ? 'fall' : 'normal' });
  if (has(t, /(vogel|vögel|tiere)/)) spec.props.push({ type: 'birds', state: 'normal' });
  if (has(t, /(geld|reich|million|milliard|euro)/) && !has(t, /menschen/)) spec.props.push({ type: 'money', state: 'normal' });
  if (spec.place === 'earth' && has(t, /(stehen bleibt|stillstand|stopp)/)) spec.props.push({ type: 'earth', state: 'stop' });
  if (['meadow', 'street', 'beach', 'forest'].includes(spec.place) && spec.time === 'day' && spec.props.length < 3) spec.props.push({ type: 'clouds', state: 'normal' });

  // Effekt
  if (has(t, /(explod|explosion|knall|supernova|einschlag)/) || spec.props.some((p) => p.type === 'meteor')) spec.effect = 'explosion';
  else if (has(t, /(erdbeben|beben|wackel|erschütter)/)) spec.effect = 'quake';
  else if (has(t, /(feuer|brand|brenn|flammen|lava|vulkan)/)) spec.effect = 'fire';
  else if (has(t, /(flut|überschwemm|überflut|tsunami)/)) spec.effect = 'flood';
  else if (has(t, /(sturm|orkan|gewitter|blitz)/)) spec.effect = 'storm';
  else if (has(t, /regen/)) spec.effect = 'rain';
  else if (has(t, /(gefrier|eiszeit|erfrier)/)) spec.effect = 'freeze';
  else if (has(t, /(schnee|kalt|kälte)/)) spec.effect = 'snow';
  else if (has(t, /(hitze|heiß|glühend|grad)/)) spec.effect = 'heat';
  else if (has(t, /(dunkel|finster|stromausfall)/) && spec.time !== 'night') spec.effect = 'darkness';
  else if (has(t, /(alarm|warnung|schlagen alarm)/)) spec.effect = 'alarm';

  // Aktion der Hauptfigur
  if (!action) {
    if (spec.place === 'space') action = 'float';
    else if (has(t, /(renn|flucht|flieh|panik|lauf weg|fliehen)/)) action = 'flee';
    else if (has(t, /(angst|schock|schrei|erschreck|entsetz|katastroph)/)) action = 'scared';
    else if (has(t, /(frier|zitter|kalt)/)) action = 'shiver';
    else if (has(t, /(schwimm|tauch)/)) action = 'swim';
    else if (has(t, /(jubel|feier|freu|endlich|glück)/)) action = 'cheer';
    else if (has(t, /(einsam|allein|traurig|vermiss|niemand)/)) action = 'sad';
    else if (has(t, /(denk|frag|überleg|stell dir vor|was glaubst|weißt du)/)) action = 'think';
    else if (has(t, /(himmel|schau|blick|siehst|nach oben)/)) action = 'look_up';
    else if (has(t, /(spring|hüpf|schwerkraft)/)) action = 'jump';
    else if (has(t, /(fall|stürz|umkipp|ohnmacht)/)) action = 'fall';
    else if (spec.place === 'lab') action = 'work';
    else if (has(t, /(geh|spazier|unterwegs|läufst|draußen|straße)/)) action = 'walk';
    else if (spec.effect !== 'none') action = spec.effect === 'explosion' ? 'flee' : 'scared';
    else action = ['walk', 'look_up', 'think', 'idle'][index % 4];
  }
  if (index === count - 1 && count > 2 && has(t, /(folg|kommentar|abonnier|like|schreib)/)) action = 'wave';
  spec.actors.push({ action });

  // Andere Menschen
  if (has(t, /(menschen|alle|leute|menschheit|milliarden|bevölkerung|wir\b)/) && spec.place !== 'empty_city' && !has(all, /letzte mensch/)) {
    spec.crowd = { count: 3, action: ['flee', 'scared', 'shiver', 'cheer', 'work'].includes(action) ? action : 'idle' };
  }
  return spec;
}

// ------------------------------------------------------- Animation ---

export function createAnimVisual(spec) {
  return {
    isAnim: true,
    spec,
    draw(g, W, H, t, dur) {
      drawAnimScene(g, W, H, spec, t, Math.max(0.5, dur));
    },
  };
}

export function drawAnimScene(g, W, H, spec, t, dur) {
  const p = Math.min(1, Math.max(0, t / dur));
  const ev = 0.3;
  const effect = spec.effect;
  const sunProp = spec.props.find((x) => x.type === 'sun');
  const darkPlace = spec.place === 'space' || spec.place === 'earth';
  const c = {
    W, H, t, p, dur, ev,
    groundY: H * (darkPlace ? 0.62 : 0.7),
    time: spec.time,
    dark: effectSkyDarkness(effect, p),
    sunPos: { x: W * 0.72, y: H * (darkPlace ? 0.3 : 0.17) },
    moonPos: { x: W * 0.25, y: H * 0.16 },
    hasProp: (type) => spec.props.some((x) => x.type === type),
    alarm: effect === 'alarm',
    flicker: true,
  };
  const skyProps = spec.props.filter((x) => ['sun', 'moon', 'earth', 'clouds', 'birds', 'plane', 'rocket', 'meteor'].includes(x.type));
  const groundProps = spec.props.filter((x) => !skyProps.includes(x));
  c.drawSkyProps = () => drawSkyProps(g, W, H, c, skyProps);
  if (spec.props.some((x) => x.type === 'bees' && x.state === 'vanish')) c.noFlowers = p > 0.6;

  g.save();
  // Kamera: langsamer Zoom + Wackeln
  const [sx, sy] = cameraShake(effect, c);
  const zoom = 1 + p * 0.05;
  g.translate(W / 2 + sx * W, H / 2 + sy * H);
  g.scale(zoom, zoom);
  g.translate(-W / 2, -H / 2);

  const info = (PLACES[spec.place] || PLACES.meadow)(g, W, H, c) || {};
  drawGroundProps(g, W, H, c, groundProps);

  // Figuren
  const darkBg = info.space || spec.time === 'night';
  const stroke = darkBg ? '#f5f5f5' : '#1b1b1f';
  const fill = darkBg ? '#2a2a35' : '#ffffff';
  const S = H * 0.3; // Hauptfigur groß im Vordergrund
  const origin = sunProp && spec.place !== 'bedroom' ? c.sunPos : spec.props.some((x) => x.type === 'earth') ? { x: W * 0.5, y: H * 0.38 } : spec.props.some((x) => x.type === 'meteor') ? { x: W * 0.55, y: c.groundY } : { x: W * 0.5, y: H * 0.3 };

  const actors = [];
  // Ohne Figurenangabe: im Weltall/bei der Erde keine Figur, sonst die Hauptfigur
  const main = spec.actors[0] || (darkPlace ? null : { action: 'idle' });
  if (main) actors.push({ ...main, main: true, size: S });
  if (spec.actors[1]) actors.push({ ...spec.actors[1], size: S * 0.95 });
  const slots = [0.12, 0.32, 0.68, 0.88];
  for (let i = 0; i < spec.crowd.count; i++) {
    const x = slots[(i + 1) % slots.length];
    actors.push({ action: spec.crowd.action, fromX: x, size: S * (0.55 + (i % 2) * 0.06), crowd: i });
  }

  const usedX = [];
  // Hintergrund-Menschen zuerst (stehen weiter hinten), dann die Hauptfiguren
  actors.sort((a, b) => (b.crowd != null) - (a.crowd != null));
  actors.forEach((a, idx) => {
    const st = actionPose(a.action, Math.min(1, Math.max(0, p - (a.crowd != null ? a.crowd * 0.015 : 0))), t + idx * 0.37, ev);
    let fromX = a.fromX ?? (a.from ? POS[a.from] : idx === 0 ? (actors.length > 1 ? 0.5 : 0.5) : 0.72);
    if (idx === 0 && actors.length > 2 && !a.from) fromX = 0.5;
    let toX = a.to ? POS[a.to] : fromX;
    let groundY = a.crowd != null ? c.groundY - H * 0.035 : c.groundY;
    let lying = st.lying || 0;
    const moving = ['walk', 'run', 'flee', 'swim', 'get_up'].includes(a.action);
    if (moving && toX === fromX) {
      if (a.action === 'flee') toX = origin.x > W / 2 ? -0.2 : 1.2;
      else if (a.action === 'get_up') toX = 0.93;
      else if (a.action === 'swim') toX = fromX < 0.5 ? 0.8 : 0.2;
      else {
        fromX = a.main ? 0.2 : fromX;
        toX = a.main ? 0.75 : 1 - fromX;
      }
      if (a.action === 'flee' && a.crowd != null) toX = a.crowd % 2 ? -0.2 : 1.2;
    }
    // Spezialfälle
    if (a.action === 'get_up' && c.bed) {
      const bedX = (c.bed.x + c.bed.w * 0.62) / W;
      const edgeX = (c.bed.x + c.bed.w * 0.95) / W;
      if (p < 0.3) {
        fromX = bedX;
        toX = bedX;
        groundY = c.bed.top;
      } else if (p < 0.55) {
        fromX = edgeX;
        toX = edgeX;
        groundY = st.seated ? c.bed.top + S * 0.235 : c.groundY;
        if (lying > 0) groundY = c.bed.top + (1 - lying) * S * 0.235;
      } else {
        fromX = edgeX;
        toX = 0.93;
      }
    } else if ((a.action === 'sleep' || a.action === 'get_up') && c.bed) {
      groundY = c.bed.top;
      fromX = toX = (c.bed.x + c.bed.w * 0.62) / W;
    }
    if (st.seated && c.seatY && a.action !== 'get_up') groundY = c.seatY + S * 0.235;
    const needsStool = st.seated && a.action !== 'get_up' && (spec.place === 'lab' || !c.seatY);
    if (a.action === 'float') groundY = H * 0.55;
    if (a.action === 'swim') groundY = c.groundY - H * 0.03;

    const k = st.move ?? 0;
    let x = (fromX + (toX - fromX) * k) * W;
    // Figuren nicht übereinander stellen
    if (!moving) {
      const minGap = a.size * 0.55;
      const step = x < W / 2 ? 1 : -1; // Richtung einmal festlegen (sonst Endlosschleife)
      for (let k = 0; k < 6 && usedX.some((u) => Math.abs(u - x) < minGap); k++) x += minGap * step;
      usedX.push(x);
    }
    let dir = toX > fromX ? 1 : toX < fromX ? -1 : x < W / 2 ? 1 : -1;
    if (a.action === 'get_up' && p < 0.55) dir = 1;
    if (['look_up', 'point', 'scared'].includes(a.action) && origin) dir = origin.x >= x ? 1 : -1;
    if (a.action === 'scared' && p > ev) dir = origin.x >= x ? 1 : -1;

    if (needsStool) {
      const seat = st.seated && c.seatY ? c.seatY : c.groundY - S * 0.235;
      if (!c.seatY) groundY = c.groundY;
      g.fillStyle = '#5d6d7e';
      g.fillRect(x - S * 0.13, seat, S * 0.26, S * 0.04);
      g.fillRect(x - S * 0.02, seat, S * 0.04, c.groundY - seat);
    }
    drawFigure(g, {
      x,
      groundY,
      size: a.size,
      dir,
      pose: st.pose,
      lying,
      color: stroke,
      fill,
      cap: a.main ? '#e53935' : null,
      bubble: st.bubble,
      t: t + idx,
      jitter: st.jitter || 0,
      bubbleColor: '#fff3e0',
      look: a.main ? LOOK_MAIN : a.crowd != null ? LOOK_CROWD : LOOK_OTHER,
      emotion: emotionFor(a.action, p, ev, lying),
    });
  });

  drawEffect(g, W, H, c, effect, origin);
  g.restore();
  cinematicGrade(g, W, H, t, spec);
}

// Figuren-Looks: Hauptfigur mit orangem Hoodie, andere in dunklen Warmtönen
const LOOK_MAIN = { skin: '#3a1d10', cloth: '#ff7a1a', pants: '#2a140b', rim: '#ffb067', hoodie: true, eye: '#fff1dc', shoe: '#140a05' };
const LOOK_OTHER = { skin: '#3a1d10', cloth: '#2f6fd6', pants: '#23140c', rim: '#ffb067', hoodie: true, eye: '#fff1dc', shoe: '#140a05' };
const LOOK_CROWD = { skin: '#3d1f12', cloth: '#5a2c17', pants: '#2e160c', rim: '#ff9a4d', eye: '#ffe7c9', shoe: '#1a0d06' };

// Kino-Look: warme Farbstimmung, schwebende Lichtpartikel, dunkle Ränder
function cinematicGrade(g, W, H, t, spec) {
  g.save();
  g.globalCompositeOperation = 'soft-light';
  const warm = g.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, 'rgba(255,150,60,0.75)');
  warm.addColorStop(0.6, 'rgba(255,110,40,0.5)');
  warm.addColorStop(1, 'rgba(60,15,60,0.8)');
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  // Lichtpartikel
  const rnd = seededRandom(99);
  const n = spec.place === 'space' || spec.place === 'earth' ? 20 : 45;
  for (let i = 0; i < n; i++) {
    const sp = 0.01 + rnd() * 0.03;
    const x = rnd() * W + Math.sin(t * 0.5 + i) * W * 0.02;
    const y = (((rnd() * H - t * H * sp) % H) + H) % H;
    const r = W * (0.0015 + rnd() * 0.003);
    const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + i));
    g.fillStyle = `rgba(255,190,110,${a * 0.35})`;
    g.beginPath();
    g.arc(x, y, r * 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(255,220,170,${a})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Vignette
  const v = g.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,3,8,0.6)');
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  g.restore();
}
