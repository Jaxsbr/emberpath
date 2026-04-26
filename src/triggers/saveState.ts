import { getAllAreaIds } from '../data/areas/registry';
import { resetAllFlags } from './flags';

const STORAGE_KEY = 'emberpath_save';

export interface SaveState {
  version: 1;
  areaId: string;
  position: { x: number; y: number };
}

let writeFailureLogged = false;

function isValidSave(payload: unknown): payload is SaveState {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (p.version !== 1) return false;
  if (typeof p.areaId !== 'string' || p.areaId.length === 0) return false;
  if (!getAllAreaIds().includes(p.areaId)) return false;
  const pos = p.position as Record<string, unknown> | undefined;
  if (!pos || typeof pos !== 'object') return false;
  if (typeof pos.x !== 'number' || !Number.isFinite(pos.x)) return false;
  if (typeof pos.y !== 'number' || !Number.isFinite(pos.y)) return false;
  return true;
}

export function loadSave(): SaveState | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`emberpath: corrupt save (parse error) at ${STORAGE_KEY} — clearing`);
    clearSave();
    return null;
  }
  if (!isValidSave(parsed)) {
    console.warn(`emberpath: corrupt save (validation failed) at ${STORAGE_KEY} — clearing`);
    clearSave();
    return null;
  }
  return parsed;
}

export function writeSave(state: SaveState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    if (!writeFailureLogged) {
      console.warn('emberpath: save write failed', err);
      writeFailureLogged = true;
    }
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage may be unavailable in some environments
  }
}

export function hasSave(): boolean {
  return loadSave() !== null;
}

// Single internal entry point for wiping the world state. Order is
// save-first then flags so a watcher reacting to flag changes can assume
// the save is already gone (US-65). clearSave is idempotent, so the
// resetAllFlags-internal clearSave call (US-62) is a harmless no-op on
// the second pass.
export function resetWorld(): void {
  clearSave();
  resetAllFlags();
}
