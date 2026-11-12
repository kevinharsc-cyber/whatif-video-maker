// SaveSystem – Spielstand & Einstellungen im Gerät (localStorage)
import { START_MONEY } from './economy.js';

const KEY = 'grandpas-casino-save-v1';
const SKEY = 'grandpas-casino-settings-v1';

export function newState() {
  return {
    v: 1, money: START_MONEY, xp: 0, level: 1, quest: 0,
    inv: { slot: 1 }, // Geschenk von Opa
    objects: [], // { id, type, x, z, rot, cash }
    repairs: {}, explored: [],
    doorUnlocked: false, open: false,
    player: { x: 0.6, z: -1.6, yaw: Math.PI / 2 },
    nextId: 1, playTime: 0, stats: { guests: 0, earned: 0 },
  };
}
export const SaveSystem = {
  has() { try { return !!localStorage.getItem(KEY); } catch { return false; } },
  load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return { ...newState(), ...s }; } catch { /* leer */ } return null; },
  save(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* egal */ } },
  settings() { try { return { sound: true, quality: 'auto', sens: 1, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return { sound: true, quality: 'auto', sens: 1 }; } },
  saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* egal */ } },
};
