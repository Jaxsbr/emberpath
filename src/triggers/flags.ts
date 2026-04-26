import { clearSave } from './saveState';

const STORAGE_KEY = 'emberpath_flags';

type FlagValue = string | number | boolean;

let flagStore: Record<string, FlagValue> = {};
let writeFailureLogged = false;

// Flag-change subscribers. Listeners fire ONLY when a flag's value actually
// changes (Learning EP-01: once per change, not per setFlag call). resetAllFlags
// notifies all subscribed names with `undefined` so a listener that flipped
// state on truthy values can restore default state on reset.
type FlagChangeListener = (name: string, value: FlagValue | undefined) => void;
const listeners: Map<string, Set<FlagChangeListener>> = new Map();

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

function notifyChange(name: string, oldValue: FlagValue | undefined, newValue: FlagValue | undefined): void {
  if (oldValue === newValue) return;
  const set = listeners.get(name);
  if (!set) return;
  for (const cb of set) cb(name, newValue);
}

// Load on module init
loadFromStorage();

export function getFlag(name: string): FlagValue | undefined {
  return flagStore[name];
}

export function setFlag(name: string, value: FlagValue): void {
  const oldValue = flagStore[name];
  flagStore[name] = value;
  saveToStorage();
  notifyChange(name, oldValue, value);
}

export function incrementFlag(name: string): void {
  const oldValue = flagStore[name];
  const next = typeof oldValue === 'number' ? oldValue + 1 : 1;
  flagStore[name] = next;
  saveToStorage();
  notifyChange(name, oldValue, next);
}

export function onFlagChange(name: string, cb: FlagChangeListener): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(cb);
  return () => {
    listeners.get(name)?.delete(cb);
  };
}

// Wipes flags AND world save together — the only legitimate reset path.
// Save is cleared first so a watcher reacting to flag changes can assume
// the save is already gone (US-62 atomic-reset contract). After the wipe,
// notify every subscribed listener whose flag actually had a value so
// state-driven UIs (e.g. Fog Marsh's marsh_trapped collision flip) restore
// their default state on Reset Progress.
export function resetAllFlags(): void {
  clearSave();
  // Snapshot pre-wipe values for change notifications. Listeners on flags
  // that were never set get no notification (Learning EP-01: once per change).
  const previous = flagStore;
  flagStore = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  for (const name of listeners.keys()) {
    notifyChange(name, previous[name], undefined);
  }
}

// Backward-compatible re-export so existing imports of resetAllFlags can
// migrate to resetWorld without changing their import path (US-65).
export { resetWorld } from './saveState';
