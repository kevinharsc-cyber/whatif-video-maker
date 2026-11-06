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
  visualMode: 'verein',
  vereinFans: 0,
  vereinNames: '',
  zombieFollowers: 0,
  zombieAllies: '',
  zombieCount: 10,
  zombieGoal: 11,
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
    if (!s.voiceV3) {
      // Wunsch: freundlich erzählt statt aufgedreht → Achird
      if (s.visualMode === 'verein' && ['gemini:Puck', 'gemini:Charon'].includes(s.voice)) s.voice = 'gemini:Achird';
      s.voiceV3 = true;
      s.voiceV2 = true;
    }
    if (!s.voiceV2) {
      // Verein: freundliche, gut gelaunte Stimme statt des ruhigen Erzählers
      if (s.visualMode === 'verein' && (s.voice === 'gemini:Charon' || (s.geminiKey && s.voice.startsWith('piper:')))) s.voice = 'gemini:Puck';
      s.voiceV2 = true;
    }
    if (!s.vereinV1) {
      s.visualMode = 'verein'; // Wunsch: alles im Look des SV Kieselbach
      s.vereinV1 = true;
      s.clear2dV1 = true;
      s.poly2dV1 = true;
    }
    if (!s.clear2dV1) {
      s.visualMode = 'animation'; // Wunsch: klare 2D-Grafik ohne Polygone
      s.clear2dV1 = true;
      s.poly2dV1 = true;
    }
    if (!s.poly2dV1) {
      s.visualMode = 'poly2d'; // neuer Standard: Low-Poly-Look in 2D (kein 3D-Grafikspeicher)
      s.poly2dV1 = true;
    }
    if (!s.zombieV1) {
      s.visualMode = 'zombie'; // Wunsch: App für die Zombie-Apokalypse-Serie
      if (['gemini:Puck', 'gemini:Charon'].includes(s.voice)) s.voice = 'gemini:Achird';
      s.zombieV1 = true;
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
