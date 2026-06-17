// Sandbox / scenario test-bench kernel.
//
// The test bench lets us boot the game into an arbitrary mid-game state ("Pip has
// the ember and the words, standing in the Fog Marsh") WITHOUT ever touching the
// player's real save. It does that by routing every localStorage read/write
// through a namespace chosen here, once, from the URL.
//
// ── IMPORT-ORDER CONTRACT (load-bearing) ────────────────────────────────────
// `flags.ts` reads localStorage at *module-init* time (its top-level
// `loadFromStorage()`), so the namespace must already be decided before flags.ts
// is first imported. This module has NO dependency on flags.ts / saveState.ts and
// is imported FIRST from `main.ts` (`import './sandbox';` ahead of the scene
// imports), so `initFromUrl()` runs before any flag/save code. Keep it that way:
// never import flags.ts or saveState.ts from here, and keep the `import './sandbox'`
// line above the scene imports in main.ts.

const REAL_KEYS = { flags: 'emberpath_flags', save: 'emberpath_save' } as const;
const SANDBOX_KEYS = { flags: 'emberpath_sandbox_flags', save: 'emberpath_sandbox_save' } as const;

let sandboxActive = false;

// Decided ONCE at module import. `?sandbox=1` keeps the throwaway namespace across
// refreshes; `?scenario=<id>` implies sandbox (a scenario boot is always a
// throwaway run). Wrapped in try/catch so a non-browser context (e.g. a unit test
// importing transitively) degrades to the real namespace instead of throwing.
function initFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    sandboxActive = params.get('sandbox') === '1' || params.has('scenario');
  } catch {
    sandboxActive = false;
  }
}
initFromUrl();

export function isSandbox(): boolean {
  return sandboxActive;
}

export function flagsStorageKey(): string {
  return sandboxActive ? SANDBOX_KEYS.flags : REAL_KEYS.flags;
}

export function saveStorageKey(): string {
  return sandboxActive ? SANDBOX_KEYS.save : REAL_KEYS.save;
}

// Explicit override — not used in normal boot (the URL drives it), kept for tests
// or programmatic harness control.
export function setSandbox(active: boolean): void {
  sandboxActive = active;
}
