import { clearSave } from './saveState';

const STORAGE_KEY = 'emberpath_flags';

type FlagValue = string | number | boolean;

let flagStore: Record<string, FlagValue> = {};
let writeFailureLogged = false;

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      flagStore = JSON.parse(raw);
    }
  } catch {
    flagStore = {};
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flagStore));
  } catch (err) {
    if (!writeFailureLogged) {
      console.warn('emberpath: flags write failed', err);
      writeFailureLogged = true;
    }
  }
}

// Load on module init
loadFromStorage();

export function getFlag(name: string): FlagValue | undefined {
  return flagStore[name];
}

export function setFlag(name: string, value: FlagValue): void {
  flagStore[name] = value;
  saveToStorage();
}

export function incrementFlag(name: string): void {
  const current = flagStore[name];
  if (typeof current === 'number') {
    flagStore[name] = current + 1;
  } else {
    flagStore[name] = 1;
  }
  saveToStorage();
}

// Wipes flags AND world save together — the only legitimate reset path.
// Save is cleared first so a watcher reacting to flag changes can assume
// the save is already gone (US-62 atomic-reset contract).
export function resetAllFlags(): void {
  clearSave();
  flagStore = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Backward-compatible re-export so existing imports of resetAllFlags can
// migrate to resetWorld without changing their import path (US-65).
export { resetWorld } from './saveState';
