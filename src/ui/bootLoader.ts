// #214 P1 — the pre-boot loader bridge.
//
// The actual loader is pure HTML/CSS in index.html (#boot-loader): it paints on
// the FIRST byte, before this bundle downloads or parses, so the player sees a
// warm ember instead of a dark screen. This module's only job is to crossfade it
// out once the game's first real frame has rendered — kept Phaser-free and tiny
// so it's node-testable and can't silently regress.

export const BOOT_LOADER_ID = 'boot-loader';
export const BOOT_LOADER_DONE_CLASS = 'boot-loader--done';
// Match the CSS `transition: opacity 360ms` with a little slack before we yank
// the node, so the fade completes visually rather than snapping.
export const BOOT_LOADER_FADE_MS = 400;

type MinimalDoc = {
  getElementById(id: string): {
    classList: { add(token: string): void };
    remove(): void;
  } | null;
};

// Fade the loader out, then remove it after the transition. Idempotent and a
// no-op if the loader is already gone (e.g. a Continue-resume that re-renders).
export function dismissBootLoader(
  doc: MinimalDoc,
  schedule: (fn: () => void, ms: number) => void,
): boolean {
  const el = doc.getElementById(BOOT_LOADER_ID);
  if (!el) return false;
  el.classList.add(BOOT_LOADER_DONE_CLASS);
  schedule(() => el.remove(), BOOT_LOADER_FADE_MS);
  return true;
}
