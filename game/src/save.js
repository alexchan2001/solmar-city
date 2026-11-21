// Solmar City — saving.
// Progress is small: money, the next mission, and totals. It lives in
// localStorage so a run survives a closed tab, and Continue on the
// title screen picks it back up.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(world) {
  try {
    const data = {
      seed: world.seed,
      money: world.player.money,
      missionIndex: Math.min(world.mission.index, world.stats.missionsDone),
      missionsDone: world.stats.missionsDone,
      carsStolen: world.stats.carsStolen,
      earned: world.stats.earned,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be unavailable (private mode); the game plays on.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
