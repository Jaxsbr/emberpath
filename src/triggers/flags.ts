const STORAGE_KEY = 'emberpath_flags';

type FlagValue = string | number | boolean;

let flagStore: Record<string, FlagValue> = {};

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
  } catch {
    // localStorage may be unavailable in some environments
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

export function resetAllFlags(): void {
  flagStore = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
