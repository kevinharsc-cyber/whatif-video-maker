// Zwischenspeicher für fertig kodierte Video-Abschnitte (IndexedDB = Speicher
// auf dem Gerät, NICHT im Arbeitsspeicher). So liegt nie das ganze Video im RAM,
// und nach einem Absturz kann an der letzten fertigen Szene weitergemacht werden.
// Falls IndexedDB nicht geht (z. B. privates Surfen), wird im RAM gespeichert.

const DB = 'whatif-render';
const STORE = 'kv';
let dbp = null;
const mem = new Map();
let useMem = false;

function open() {
  if (useMem) return Promise.resolve(null);
  if (!dbp) {
    dbp = new Promise((resolve) => {
      // Safari-Fehler: indexedDB.open antwortet manchmal nie → nach 3 s RAM nutzen
      const t = setTimeout(() => {
        useMem = true;
        resolve(null);
      }, 3000);
      const done = (v) => {
        clearTimeout(t);
        resolve(v);
      };
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => done(useMem ? null : req.result);
        req.onerror = () => {
          useMem = true;
          done(null);
        };
        req.onblocked = () => {
          useMem = true;
          done(null);
        };
      } catch {
        useMem = true;
        done(null);
      }
    });
  }
  return dbp;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Gerätespeicher antwortet nicht')), 8000);
    const res0 = resolve;
    const rej0 = reject;
    resolve = (v) => (clearTimeout(timer), res0(v));
    reject = (e) => (clearTimeout(timer), rej0(e));
    const t = db.transaction(STORE, mode);
    const st = t.objectStore(STORE);
    let out;
    const r = fn(st);
    if (r) r.onsuccess = () => (out = r.result);
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error || new Error('Gerätespeicher-Fehler'));
    t.onabort = () => reject(t.error || new Error('Gerätespeicher voll?'));
  });
}

export async function put(key, value) {
  const db = await open();
  if (!db || useMem) return void mem.set(key, value);
  try {
    await tx(db, 'readwrite', (st) => st.put(value, key));
  } catch (e) {
    // Gerätespeicher voll/gesperrt → ab jetzt im Arbeitsspeicher weiter
    mem.set(key, value);
    useMem = true;
    console.warn('IndexedDB nicht nutzbar:', e);
  }
}

export async function get(key) {
  if (mem.has(key)) return mem.get(key);
  const db = await open();
  if (!db || useMem) return undefined;
  try {
    return await tx(db, 'readonly', (st) => st.get(key));
  } catch {
    return undefined;
  }
}

/** Löscht alle Einträge, deren Schlüssel mit prefix beginnt. */
export async function clear(prefix = '') {
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
  const db = await open();
  if (!db) return;
  try {
    await tx(db, 'readwrite', (st) => (prefix ? st.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)) : st.clear()));
  } catch {
    /* egal */
  }
}

export const onDevice = () => !useMem;
