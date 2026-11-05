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
  visualMode: 'animation',
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
    return { ...DEFAULTS, ...(raw ? JSON.parse(raw) : {}) };
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
