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
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          useMem = true;
          resolve(null);
        };
        req.onblocked = () => {
          useMem = true;
          resolve(null);
        };
      } catch {
        useMem = true;
        resolve(null);
      }
    });
  }
  return dbp;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
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
  if (!db) return void mem.set(key, value);
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
  if (!db) return undefined;
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
