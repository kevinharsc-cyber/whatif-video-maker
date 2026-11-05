// Einstellungen werden nur lokal auf deinem Gerät gespeichert (localStorage).
// Dein API-Schlüssel verlässt das iPhone nur in Richtung Google.

const KEY = 'whatif-settings-v1';

export const DEFAULTS = {
  geminiKey: '',
  pollinationsKey: '',
  voice: 'piper:de_DE-thorsten-medium',
  speed: 1.0,
  quality: '1080',
  imageStyle: 'cinematic',
  visualMode: '3d',
  followEnabled: true,
  followName: '',
  followImage: '',
  followAt: 0.2,
  followButton: 'Folgen',
  music: true,
  musicMood: 'dark',
  exportMode: 'auto',
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    const s = { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
    // Stabiler Weg (Echtzeit-Aufnahme) wieder als Standard – einmalige Umstellung
    if (!s.lowpolyV1) {
      s.visualMode = '3d'; // neuer Standard: Low-Poly-3D
      s.lowpolyV1 = true;
    }
    if (!s.segV1) {
      // neuer speichersicherer Export (Szene für Szene) als Standard
      s.exportMode = 'auto';
      s.segV1 = true;
      s.stableV1 = true;
    }
    return s;
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* privates Surfen: dann eben nicht speichern */
  }
}
