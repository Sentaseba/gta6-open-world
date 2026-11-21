// The save: cash, story progress and lifetime totals in localStorage, this
// browser only. Anything unreadable is treated as no save at all.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : 60,
      story: Number.isFinite(data.story) ? data.story : 0,
      earned: Number.isFinite(data.earned) ? data.earned : 0,
    };
  } catch {
    return null;
  }
}

export function storeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash,
      story: state.storyIndex,
      earned: state.stats.earned,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
