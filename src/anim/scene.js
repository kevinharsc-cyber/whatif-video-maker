// Baut aus einer Szenenbeschreibung eine Animation.
// Die Beschreibung kommt von der KI (Gemini) oder wird aus dem Text erraten.

import { actionPose, drawFigure, seg, emotionFor } from './figure.js';
import { seededRandom, cachedGradient, cachedLayer } from '../util.js';
import { polygonize } from './polygon.js';
import { PLACES, drawSportsCar, drawSkyProps, drawGroundProps, drawEffect, effectSkyDarkness, cameraShake } from './world.js';

// Das Labor wirkte unverständlich und wird nicht mehr verwendet
export const PLACE_LIST = Object.keys(PLACES).filter((pl) => pl !== 'lab');
export const ACTIONS = ['look_out', 'call', 'shout', 'grab', 'talk', 'drive', 'phone', 'idle', 'walk', 'run', 'sit', 'sleep', 'get_up', 'scared', 'flee', 'look_up', 'wave', 'shiver', 'fall', 'cheer', 'think', 'sad', 'point', 'swim', 'jump', 'float'];
export const PROPS = ['animals', 'shop', 'sun', 'moon', 'earth', 'clouds', 'birds', 'plane', 'rocket', 'meteor', 'cars', 'bees', 'dinosaur', 'trees', 'house', 'money'];
export const PROP_STATES = ['normal', 'explode', 'vanish', 'grow', 'dim', 'stop', 'fall', 'big', 'red_giant', 'dead', 'storm'];
export const EFFECTS = ['none', 'explosion', 'flash', 'darkness', 'fire', 'flood', 'quake', 'rain', 'storm', 'snow', 'freeze', 'heat'];
export const TIMES = ['day', 'sunset', 'night'];
const POS = { offleft: -0.15, left: 0.22, center: 0.5, right: 0.78, offright: 1.15 };

// Kurzbeschreibung für den KI-Prompt
export const ANIM_PROMPT_HELP = `"anim" beschreibt die Strichmännchen-Animation der Szene (Werte NUR aus diesen Listen):
- "place": ${PLACE_LIST.join(', ')}
- "time": ${TIMES.join(', ')}
- "props": Liste von {"type": ${PROPS.join('|')}, "state": ${PROP_STATES.join('|')}} – "shop" ist eine Ladenfront, dazu "label" mit dem Schildtext (z. B. "BURGER", "SUPERMARKT")
- "actors": 1-2 Figuren {"action": ${ACTIONS.join('|')}, "from": left|center|right|offleft|offright, "to": left|center|right|offleft|offright}. Die erste Figur ist "du" (Hauptfigur mit roter Kappe).
- "crowd": {"count": 0-4, "action": eine Aktion} für weitere Menschen
- "empty": true, wenn die Stadt menschenleer/ohne Licht sein soll (z. B. beim Ort rooftop)
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
      .map((p) => ({ type: p.type, state: pick(p.state, PROP_STATES, 'normal'), label: typeof p.label === 'string' ? p.label : undefined }))
      .slice(0, 4),
    actors: (Array.isArray(a.actors) ? a.actors : [])
      .map((x) => (typeof x === 'string' ? { action: x } : x))
      .filter(Boolean)
      .map((x) => ({ action: pick(x.action === 'work' ? 'think' : x.action, ACTIONS, 'idle'), from: pick(x.from, Object.keys(POS), null), to: pick(x.to, Object.keys(POS), null) }))
      .slice(0, 2),
    crowd: { count: Math.max(0, Math.min(4, Number(a.crowd?.count) || 0)), action: pick(a.crowd?.action, ACTIONS, 'idle') },
    effect: pick(a.effect, EFFECTS, 'none'),
    empty: a.empty === true,
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
  else if (has(t, /(labor|wissenschaftler|forscher|nasa|experte)/)) spec.place = 'city';
  else if (has(t, /(fernseh|internet|handy|smartphone|zuhause|sofa|wohnung|strom)/)) spec.place = 'living_room';
  else if (has(all, /(letzte mensch|leer|verlassen|niemand|keine menschen|ausgestorben|ruinen)/)) spec.place = 'empty_city';
  else if (has(t, /(dach|wolkenkratzer|hochhaus|über der stadt|aussicht)/)) spec.place = 'rooftop';
  else if (has(t, /(sportwagen|ferrari|lamborghini|rast|fährst|autobahn)/)) {
    spec.place = 'street';
    action = 'drive';
  } else if (has(t, /(verkehr|auto|straße|strasse|stau)/)) spec.place = 'street';
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
  if (has(t, /(tiere|rehe|wölfe|wolf|hirsch|wildschwein)/)) spec.props.push({ type: 'animals', state: 'normal' });
  const shop = t.match(/(burger|pizza|döner|supermarkt|bäckerei|kiosk|café|laden|geschäft|tankstelle|apotheke)/);
  if (shop && !['bedroom', 'living_room', 'lab', 'space', 'earth'].includes(spec.place)) {
    if (!['street', 'city', 'empty_city'].includes(spec.place)) spec.place = 'street';
    spec.props.push({ type: 'shop', state: 'normal', label: shop[1] === 'laden' || shop[1] === 'geschäft' ? 'SHOP' : shop[1].toUpperCase() });
  }
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
    else if (has(t, /(geh|spazier|unterwegs|läufst|draußen|straße)/)) action = 'walk';
    else if (spec.effect !== 'none') action = spec.effect === 'explosion' ? 'flee' : 'scared';
    else action = ['walk', 'look_up', 'think', 'idle'][index % 4];
  }
  if (index === count - 1 && count > 2 && has(t, /(folg|kommentar|abonnier|like|schreib)/)) action = 'wave';
  spec.actors.push({ action });

  // Andere Menschen
  if (has(t, /(menschen|alle|leute|menschheit|milliarden|bevölkerung|wir\b)/) && spec.place !== 'empty_city' && !has(all, /letzte mensch/)) {
    spec.crowd = { count: 3, action: ['flee', 'scared', 'shiver', 'cheer'].includes(action) ? action : 'idle' };
  }
  return spec;
}

// ------------------------------------------------------- Animation ---

export function createAnimVisual(spec, { poly = false } = {}) {
  if (poly) spec._poly = true; // Low-Poly-2D-Stil
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
  const darkPlace = spec.place === 'space' || spec.place === 'earth' || spec.place === 'black';
  const c = {
    W, H, t, p, dur, ev,
    groundY: H * (darkPlace ? 0.62 : 0.7),
    time: spec.time,
    dark: effectSkyDarkness(effect, p),
    sunPos: { x: W * 0.72, y: H * (darkPlace ? 0.3 : 0.17) },
    moonPos: { x: W * 0.25, y: H * 0.16 },
    hasProp: (type) => spec.props.some((x) => x.type === type),
    alarm: effect === 'alarm',
    empty: !!spec.empty,
    flicker: true,
  };
  const skyProps = spec.props.filter((x) => ['sun', 'moon', 'earth', 'clouds', 'birds', 'plane', 'rocket', 'meteor'].includes(x.type));
  const groundProps = spec.props.filter((x) => !skyProps.includes(x));
  c.drawSkyProps = () => drawSkyProps(g, W, H, c, skyProps);
  if (spec.props.some((x) => x.type === 'bees' && x.state === 'vanish')) c.noFlowers = p > 0.6;

  g.save();
  // Kamera: langsamer Zoom + Wackeln
  const [sx, sy] = cameraShake(effect, c);
  // (Zoom macht bereits die Kamera im Renderer – hier nur noch Wackeln)
  g.translate(sx * W, sy * H);

  // Unbewegter Hintergrund (Himmel, Häuser, Zimmer …) wird pro Szene einmal
  // gezeichnet und dann als fertiges Bild eingesetzt.
  const placeFn = PLACES[spec.place] || PLACES.meadow;
  const cacheable = !['house_front', 'earth', 'black'].includes(spec.place) && !['darkness', 'explosion'].includes(effect);
  let info;
  if (cacheable) {
    const key = `bg|${spec.place}|${spec.time}|${spec.empty ? 1 : 0}|${c.noFlowers ? 1 : 0}|${W}|${H}|${spec._poly ? 'poly' : ''}`;
    const layer = cachedLayer(key, W, H, (lg) => {
      const bc = { ...c, t: 0, p: 0, dark: 0, drawSkyProps: () => {} };
      const inf = placeFn(lg, W, H, bc) || {};
      paintGrade(lg, W, H); // Farbstimmung + Abdunklung gleich mit einbacken (spart 2 Vollbild-Ebenen pro Bild)
      if (spec._poly) polygonize(lg, W, H); // Low-Poly-2D: einmal pro Szene in Dreiecke zerlegen
      return { inf, bed: bc.bed, seatY: bc.seatY, seatX: bc.seatX, door: bc.door, window: bc.window };
    });
    g.imageSmoothingQuality = 'low';
    g.drawImage(layer.img, 0, 0, W, H);
    info = layer.info.inf;
    for (const k of ['bed', 'seatY', 'seatX', 'door', 'window']) if (layer.info[k] !== undefined) c[k] = layer.info[k];
    if (info.hasSky) c.drawSkyProps();
  } else {
    info = placeFn(g, W, H, c) || {};
  }
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
    let seatX = null;
    if (st.seated && c.seatY && a.action !== 'get_up' && a.action !== 'drive') {
      groundY = c.seatY + a.size * 0.235;
      // Hauptfigur setzt sich auf Sofa/Bank (statt daneben in die Luft)
      if (a.main && c.seatX && !a.from) seatX = c.seatX;
    }
    const needsStool = st.seated && a.action !== 'get_up' && (spec.place === 'lab' || !c.seatY);
    if (a.action === 'float') groundY = H * 0.55;
    if (a.action === 'swim') groundY = c.groundY - H * 0.03;

    const k = st.move ?? 0;
    let x = seatX ?? (fromX + (toX - fromX) * k) * W;
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

    if (a.action === 'drive') {
      // Sportwagen: Figur sitzt drin, Auto fährt durchs Bild
      const carS = W * 0.62;
      const cx = (0.28 + 0.4 * p) * W;
      const cy = c.groundY + H * 0.06 + Math.sin(t * 22) * H * 0.002;
      const seat = cy - carS * 0.2;
      drawFigure(g, { x: cx + carS * 0.02, groundY: seat + a.size * 0.235, size: a.size * 0.8, dir: 1, pose: st.pose, color: stroke, fill, t: t + idx, look: spec._poly ? (a.main ? LOOK_MAIN_POLY : LOOK_OTHER_POLY) : a.main ? LOOK_MAIN : LOOK_OTHER, emotion: emotionFor(a.action, p, ev, 0) });
      drawSportsCar(g, cx, cy, carS, t);
      return;
    }
    if (needsStool) {
      const seat = st.seated && c.seatY ? c.seatY : c.groundY - S * 0.235;
      if (!c.seatY) groundY = c.groundY;
      g.fillStyle = '#5d6d7e';
      g.fillRect(x - S * 0.13, seat, S * 0.26, S * 0.04);
      g.fillRect(x - S * 0.02, seat, S * 0.04, c.groundY - seat);
    }
    // weicher Schatten am Boden (Tiefe)
    if (!lying && a.action !== 'float' && a.action !== 'swim') {
      g.fillStyle = 'rgba(10,5,15,0.28)';
      g.beginPath();
      g.ellipse(x, groundY + a.size * 0.01, a.size * 0.2, a.size * 0.035, 0, 0, Math.PI * 2);
      g.fill();
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
      holdPhone: !!st.holdPhone,
      bubbleColor: '#fff3e0',
      look: spec._poly ? (a.main ? LOOK_MAIN_POLY : a.crowd != null ? LOOK_CROWD_POLY : LOOK_OTHER_POLY) : a.main ? LOOK_MAIN : a.crowd != null ? LOOK_CROWD : LOOK_OTHER,
      emotion: emotionFor(a.action, p, ev, lying),
    });
  });

  drawForeground(g, W, H, c, spec, t, p);
  drawEffect(g, W, H, c, effect, origin);
  g.restore();
  cinematicGrade(g, W, H, t, spec, cacheable);
}

// Vordergrund-Ebene: dunkle, unscharfe Silhouetten an den Rändern (Tiefe + Parallaxe)
function drawForeground(g, W, H, c, spec, t, p) {
  if (spec.place === 'space' || spec.place === 'earth' || spec.place === 'black') return;
  const shift = (p - 0.5) * W * 0.06;
  g.save();
  g.fillStyle = 'rgba(12,6,16,0.92)';
  const indoor = ['bedroom', 'living_room', 'lab', 'window_view', 'supermarket'].includes(spec.place);
  if (indoor) {
    // drinnen: nur leichte Abdunklung der unteren Ecken
    const layer = cachedLayer(`indoorShade|${W}|${H}`, W, H, (lg) => {
      const v = lg.createLinearGradient(0, H * 0.85, 0, H);
      v.addColorStop(0, 'rgba(12,6,16,0)');
      v.addColorStop(1, 'rgba(12,6,16,0.5)');
      lg.fillStyle = v;
      lg.fillRect(0, H * 0.85, W, H * 0.15);
    });
    g.drawImage(layer.img, 0, 0, W, H);
  } else {
    // Gras/Büsche in den unteren Ecken, wiegen sich im Wind
    for (const side of [0, 1]) {
      const bx = side ? W + shift * 1.3 : -shift * 1.3;
      for (let k = 0; k < 9; k++) {
        const x = bx + (side ? -1 : 1) * (k * W * 0.022);
        const hgt = H * (0.06 + ((k * 37) % 10) * 0.007);
        const sway = Math.sin(t * 1.5 + k) * W * 0.012;
        g.beginPath();
        g.moveTo(x - W * 0.012, H);
        g.quadraticCurveTo(x + sway * 0.5, H - hgt * 0.6, x + sway, H - hgt);
        g.quadraticCurveTo(x + sway * 0.4 + W * 0.006, H - hgt * 0.5, x + W * 0.014, H);
        g.fill();
      }
      g.beginPath();
      g.ellipse(bx, H, W * 0.14, H * 0.05, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// Figuren-Looks: Hauptfigur mit orangem Hoodie, andere in dunklen Warmtönen
const LOOK_MAIN = { skin: '#f6f1ec', cloth: '#7c3aed', pants: '#2b2140', rim: '#ffffff', hoodie: true, eye: '#2a1f3d', ink: '#231a33', shoe: '#17111f' };
const LOOK_OTHER = { skin: '#3a1d10', cloth: '#2f6fd6', pants: '#23140c', rim: '#ffb067', hoodie: true, eye: '#fff1dc', shoe: '#140a05' };
const LOOK_CROWD = { skin: '#3d1f12', cloth: '#5a2c17', pants: '#2e160c', rim: '#ff9a4d', eye: '#ffe7c9', shoe: '#1a0d06' };
// Low-Poly-2D: gleiche Figur wie im 3D-Stil (Hautton, braune Haare, lila Hoodie, weiße Schuhe)
const LOOK_MAIN_POLY = { poly: true, skin: '#f1c7a3', hair: '#4a2c1d', cloth: '#7c3aed', pants: '#2b2f45', hoodie: true, eye: '#2a1f3d', ink: '#3a2618', shoe: '#f2f2f2' };
const LOOK_OTHER_POLY = { ...LOOK_OTHER, poly: true, skin: '#c98d62', hair: '#2a1a10', cloth: '#2f6fd6', pants: '#3a3f55', eye: '#2a1f3d', ink: '#2a1a10', shoe: '#e9e9e9' };
const LOOK_CROWD_POLY = { ...LOOK_CROWD, poly: true, skin: '#b07a55', hair: '#1f140c', cloth: '#5f6b7a', pants: '#3a3f55', eye: '#2a1f3d', ink: '#2a1a10', shoe: '#dcdcdc' };

// Kino-Look: warme Farbstimmung, schwebende Lichtpartikel, dunkle Ränder
// Farbstimmung + dunkle Ränder + Abdunklung oben/unten (für die Untertitel)
function paintGrade(lg, W, H) {
  const warm = lg.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, 'rgba(255,140,60,0.16)');
  warm.addColorStop(0.6, 'rgba(255,110,40,0.10)');
  warm.addColorStop(1, 'rgba(60,15,60,0.24)');
  lg.fillStyle = warm;
  lg.fillRect(0, 0, W, H);
  const v = lg.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(10,3,8,0.6)');
  lg.fillStyle = v;
  lg.fillRect(0, 0, W, H);
  const bottom = lg.createLinearGradient(0, H * 0.66, 0, H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.45)');
  lg.fillStyle = bottom;
  lg.fillRect(0, H * 0.66, W, H * 0.34);
  const top = lg.createLinearGradient(0, 0, 0, H * 0.2);
  top.addColorStop(0, 'rgba(0,0,0,0.5)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  lg.fillStyle = top;
  lg.fillRect(0, 0, W, H * 0.2);
}

function cinematicGrade(g, W, H, t, spec, baked) {
  if (spec.place === 'black') return; // schwarzer Bildschirm bleibt schwarz
  if (!baked) {
    // Nur wenn der Hintergrund nicht vorgezeichnet werden konnte
    const layer = cachedLayer(`grade|${W}|${H}`, W, H, (lg) => paintGrade(lg, W, H));
    g.drawImage(layer.img, 0, 0, W, H);
  }
  // Lichtpartikel (wenige kleine Punkte, günstig)
  const rnd = seededRandom(99);
  const n = 0; // Lichtpartikel abgeschaltet (spart Zeichenarbeit)
  for (let i = 0; i < n; i++) {
    const sp = 0.01 + rnd() * 0.03;
    const x = rnd() * W + Math.sin(t * 0.5 + i) * W * 0.02;
    const y = (((rnd() * H - t * H * sp) % H) + H) % H;
    const r = W * (0.0015 + rnd() * 0.003);
    const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 0.8 + i));
    g.fillStyle = `rgba(255,220,170,${a})`;
    g.beginPath();
    g.arc(x, y, r * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

// ------------------------------------------------- Film-Einstellungen ---
// Feste "Storyboard"-Einstellungen: ein Satz → eine passende Einstellung.

export const SHOTS = {
  wake_up: { place: 'bedroom', actors: [{ action: 'get_up' }] },
  check_phone: { place: 'bedroom', actors: [{ action: 'phone' }] },
  phone_call: { place: 'living_room', actors: [{ action: 'call' }] },
  look_window: { place: 'window_view', actors: [{ action: 'look_out', from: 'left' }] },
  leave_house: { place: 'house_front', actors: [{ action: 'walk', from: 'center', to: 'right' }] },
  empty_street: { place: 'street', actors: [{ action: 'walk', from: 'left', to: 'right' }] },
  empty_city: { place: 'empty_city', actors: [{ action: 'look_up' }] },
  silence: { place: 'empty_city', actors: [{ action: 'think' }] },
  shout: { place: 'empty_city', actors: [{ action: 'shout' }] },
  supermarket: { place: 'supermarket', actors: [{ action: 'grab' }] },
  drive_car: { place: 'street', time: 'sunset', actors: [{ action: 'drive' }] },
  enter_house: { place: 'house_front', time: 'sunset', actors: [{ action: 'walk', from: 'right', to: 'center' }] },
  travel: { place: 'earth', props: [{ type: 'plane' }], actors: [] },
  freedom: { place: 'beach', props: [{ type: 'clouds' }], actors: [{ action: 'cheer' }] },
  party_alone: { place: 'empty_city', time: 'sunset', actors: [{ action: 'jump' }] },
  rooftop_alone: { place: 'rooftop', time: 'sunset', empty: true, actors: [{ action: 'sad' }] },
  talk_to_self: { place: 'living_room', actors: [{ action: 'talk' }] },
  days_pass: { place: 'living_room', actors: [{ action: 'sit' }] },
  night_alone: { place: 'empty_city', time: 'night', actors: [{ action: 'sad' }] },
  stars: { place: 'meadow', time: 'night', actors: [{ action: 'look_up' }] },
  miss_people: { place: 'window_view', time: 'night', actors: [{ action: 'sad', from: 'left' }] },
  earth_view: { place: 'earth', props: [], actors: [] },
  look_ocean: { place: 'beach', props: [{ type: 'clouds' }], actors: [{ action: 'look_out', from: 'center' }] },
  park_walk: { place: 'meadow', props: [{ type: 'clouds' }, { type: 'birds' }], actors: [{ action: 'walk', from: 'left', to: 'right' }] },
  park_bench: { place: 'meadow', actors: [{ action: 'sit' }] },
  enter_supermarket: { place: 'street', props: [{ type: 'shop', label: 'SUPERMARKT' }], actors: [{ action: 'walk', from: 'left', to: 'center' }] },
  bank: { place: 'street', props: [{ type: 'shop', label: 'BANK' }], actors: [{ action: 'walk', from: 'right', to: 'center' }] },
  money: { place: 'street', props: [{ type: 'shop', label: 'BANK' }, { type: 'money' }], actors: [{ action: 'cheer' }] },
  forest_walk: { place: 'forest', actors: [{ action: 'walk', from: 'left', to: 'right' }] },
  animals_return: { place: 'empty_city', time: 'sunset', props: [{ type: 'animals' }], actors: [{ action: 'look_up' }] },
  black: { place: 'black', actors: [] },
};
export const SHOT_LIST = Object.keys(SHOTS);
const SHOT_ALTERNATIVES = {
  empty_city: ['empty_street', 'rooftop_alone'],
  empty_street: ['empty_city', 'silence'],
  silence: ['empty_street', 'look_window'],
  night_alone: ['rooftop_alone', 'stars'],
  rooftop_alone: ['night_alone', 'miss_people'],
  miss_people: ['rooftop_alone', 'night_alone'],
  days_pass: ['talk_to_self', 'miss_people'],
  freedom: ['party_alone', 'drive_car'],
  party_alone: ['freedom', 'drive_car'],
};

export const SHOT_PROMPT_HELP = `"shot": wähle für JEDEN Satz die passendste Film-Einstellung aus dieser Liste:
wake_up (aufwachen/aufstehen), check_phone (aufs Handy schauen, Nachrichten), phone_call (jemanden anrufen, niemand geht ran),
look_window (aus dem Fenster schauen), leave_house (aus der Haustür nach draußen gehen), empty_street (leere Straße entlanggehen),
empty_city (leere Stadt, Hochhäuser), silence (Stille, keine Geräusche), shout (laut rufen/schreien), supermarket (im Supermarkt Sachen nehmen),
drive_car (Auto fahren), enter_house (in ein fremdes Haus gehen), travel (um die Welt reisen), freedom (Freiheit, keine Regeln, Spaß),
party_alone (allein feiern/tanzen), rooftop_alone (allein auf einem Hochhausdach), talk_to_self (mit sich selbst reden),
days_pass (Zeit vergeht, Tage/Wochen), night_alone (nachts allein in der Stadt), stars (Sternenhimmel), miss_people (Menschen vermissen, Einsamkeit),
earth_view (die Erde von oben, "stell dir vor"), look_ocean (aufs Meer schauen), park_walk (durch den Park gehen),
park_bench (auf einer Parkbank sitzen), enter_supermarket (zum Supermarkt gehen/hineingehen), bank (zur Bank gehen),
money (Geld, reich sein), forest_walk (durch den Wald gehen), animals_return (Tiere in der Stadt), black (schwarzer Bildschirm).
Passt keine Einstellung (z. B. bei anderen Themen wie Explosionen), setze "shot": null und beschreibe die Szene stattdessen mit "anim".`;

const SHOT_RULES = [
  [/fenster/, 'look_window'],
  [/(meer|ozean|strand|wellen|küste)/, 'look_ocean'],
  [/(\bbank\b|banken|geldautomat|tresor)/, 'bank'],
  [/(geld|euro|million|milliard|reich)/, 'money'],
  [/(parkbank|auf einer bank|setzt dich)/, 'park_bench'],
  [/(\bpark\b|spaziergang|spazierst)/, 'park_walk'],
  [/(wald|bäume)/, 'forest_walk'],
  [/(tiere|rehe|wölfe|hirsch)/, 'animals_return'],
  [/(rufst .*an|anruf|anrufen|telefonier|geht ran|niemand nimmt ab)/, 'phone_call'],
  [/(handy|whatsapp|nachricht|instagram|smartphone|tiktok)/, 'check_phone'],
  [/(aufwach|wachst .*auf|aufstehst|stehst .*auf|wecker|im bett)/, 'wake_up'],
  [/(schreist|brüllst|rufst laut|hallo)/, 'shout'],
  [/(haustür|vor die tür|nach draußen|gehst raus|rausgehst|verlässt das haus)/, 'leave_house'],
  [/(betrittst|gehst in einen supermarkt|zum supermarkt)/, 'enter_supermarket'],
  [/(supermarkt|regal|nimmst dir|nehmen, was|einkauf)/, 'supermarket'],
  [/(steigst in .*auto|fährst|sportwagen|autobahn|jedes auto)/, 'drive_car'],
  [/(jedes haus|in .*häuser|fremde wohnung)/, 'enter_house'],
  [/(reisen|hinreisen|um die welt|fliegst)/, 'travel'],
  [/(redest mit dir|mit dir selbst|selbstgespräch)/, 'talk_to_self'],
  [/(vermisst|vermissen|einsam|fehlt dir|guten morgen)/, 'miss_people'],
  [/(stell dir vor|auf der erde|die welt .*weiter)/, 'earth_view'],
  [/(keine regeln|keine verpflichtung|keine schule|keine arbeit|geil|frei\b|freiheit)/, 'freedom'],
  [/(nach (einer|ein paar|einigen|zwei|drei|vier|einem|\d+) (tag|tagen|woche|wochen|monat|monaten|jahr|jahren))/, 'days_pass'],
  [/(nachts|in der nacht|dunkel|sterne)/, 'night_alone'],
  [/(geräusch|stille|totenstill|still\b|stimme)/, 'silence'],
  [/(straße|straßen|autos|verkehr|bewegung)/, 'empty_street'],
  [/(stadt|städte|hochhäuser|niemand|kein einziger mensch|keiner|menschen)/, 'empty_city'],
];

/** Errät die Film-Einstellung aus dem Satz (null = keine passt). */
export function guessShot(text, prev = null) {
  const t = String(text).toLowerCase();
  const hit = SHOT_RULES.find(([re]) => re.test(t));
  // kein Hinweis im Satz → in der vorherigen Einstellung bleiben (durchgehende Szene)
  if (!hit) return prev;
  let shot = hit[1];
  if (shot === prev && SHOT_ALTERNATIVES[shot]) shot = SHOT_ALTERNATIVES[shot].find((x) => x !== prev) || shot;
  return shot;
}

export function shotSpec(shot) {
  const base = SHOTS[shot];
  if (!base) return null;
  return normalizeAnim(JSON.parse(JSON.stringify(base)));
}
