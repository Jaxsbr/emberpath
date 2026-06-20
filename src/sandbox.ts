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
// `?debugCollision=1` — boot with the F4 collision-render overlay already ON.
// The F4 keyboard toggle is the primary UX in a real browser, but function keys
// are swallowed by headless Chromium before they reach the page, so this URL flag
// gives the testbench (and anyone who'd rather not press F4) a way in.
let debugCollisionActive = false;
// `?editor=collision&area=<id>` — boot into the collision paint editor over the
// named area (default ashen-isle). Editor mode is always a throwaway sandbox run
// (it never touches the real save), so it implies sandbox like `?scenario`.
let editorModeValue: string | null = null;
let editorAreaIdValue: string | null = null;

// Decided ONCE at module import. `?sandbox=1` keeps the throwaway namespace across
// refreshes; `?scenario=<id>` implies sandbox (a scenario boot is always a
// throwaway run). Wrapped in try/catch so a non-browser context (e.g. a unit test
// importing transitively) degrades to the real namespace instead of throwing.
function initFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    editorModeValue = params.get('editor');
    editorAreaIdValue = params.get('area');
    sandboxActive = params.get('sandbox') === '1' || params.has('scenario') || editorModeValue !== null;
    debugCollisionActive = params.get('debugCollision') === '1';
  } catch {
    sandboxActive = false;
    debugCollisionActive = false;
    editorModeValue = null;
    editorAreaIdValue = null;
  }
}
initFromUrl();

export function isSandbox(): boolean {
  return sandboxActive;
}

// True when `?debugCollision=1` is present — GameScene reads this in create() to
// turn the F4 collision overlay on at boot.
export function isDebugCollision(): boolean {
  return debugCollisionActive;
}

// The `?editor=<mode>` value (e.g. 'collision') or null. TitleScene reads this
// to boot straight into an editor instead of the menu.
export function editorMode(): string | null {
  return editorModeValue;
}

// The `?area=<id>` value used by editor mode to pick which area to open, or null.
export function editorAreaId(): string | null {
  return editorAreaIdValue;
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
