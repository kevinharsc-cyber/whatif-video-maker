// SHARK ATTACK – Online-Rangliste und Freunde (Supabase, kostenloser Tarif)
// Der „publishable“ Schlüssel ist absichtlich öffentlich: Er darf nur lesen und die Funktion save_player aufrufen.
// Jeder Spieler hat eine zufällige ID + ein Geheimnis, das nur auf seinem Handy liegt – nur damit kann er seinen Eintrag ändern.
const URL = 'https://diiftjeuklmcjiopaioo.supabase.co';
const KEY = 'sb_publishable_fiAMOLODLni2TmJQMyS7Cg_rRJm8Vdt';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NAME_RE = /^[\p{L}\p{N} _.-]{2,16}$/u;
export const isId = (v) => typeof v === 'string' && UUID_RE.test(v);

function randomHex(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const h = randomHex(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const newSecret = () => randomHex(24);

async function req(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${URL}/rest/v1/${path}`, {
      ...opts,
      signal: ctrl.signal,
      headers: { apikey: KEY, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}
const COLS = 'id,name,best,skin,shark,level';

// Speichert/aktualisiert den eigenen Eintrag. Antwort: 'ok' | 'taken' | 'denied' | 'bad'
export function savePlayer(p) {
  return req('rpc/save_player', {
    method: 'POST',
    body: JSON.stringify({ p_id: p.id, p_secret: p.secret, p_name: p.name, p_best: p.best, p_skin: p.skin, p_shark: p.shark, p_level: p.level }),
  });
}
export const topPlayers = (n = 50) => req(`players?select=${COLS}&order=best.desc&limit=${n}`);
export function searchPlayers(q) {
  const clean = q.replace(/[^\p{L}\p{N} _.-]/gu, '').trim();
  if (clean.length < 2) return Promise.resolve([]);
  return req(`players?select=${COLS}&name=ilike.*${encodeURIComponent(clean)}*&order=best.desc&limit=20`);
}
export function getPlayers(ids) {
  const ok = ids.filter(isId);
  if (!ok.length) return Promise.resolve([]);
  return req(`players?select=${COLS}&id=in.(${ok.join(',')})`);
}
