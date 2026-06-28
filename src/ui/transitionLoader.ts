// #214 P3 — the area-transition loading indicator.
//
// With per-area lazy loading (systems/areaAssets), walking into a new map fetches
// that map's tilesets / NPC sheets / portraits / music on the spot. On a fast
// connection that's imperceptible; on a slow one the camera would otherwise sit on
// black for a beat with no feedback. This overlay paints a warm ember + a short
// line over that black so the wait reads as "the world is kindling ahead" rather
// than a freeze.
//
// Kept Phaser-free and DOM-injectable (like ui/bootLoader.ts) so the logic is
// node-testable and lives outside the scene graph — no dual-camera bookkeeping. It
// styles itself entirely from JS so it has no dependency on index.html. GameScene
// shows it at the start of a transition preload and dismisses it on load complete,
// which lands exactly as the destination camera fades in from black — seamless.

export const TRANSITION_LOADER_ID = 'transition-loader';
export const TRANSITION_LOADER_DONE_CLASS = 'transition-loader--done';
// Match the CSS opacity transition, with slack before we remove the node so the
// fade-out completes visually rather than snapping.
export const TRANSITION_LOADER_FADE_MS = 360;
const STYLE_ID = 'transition-loader-style';

const STYLE_TEXT = `
#${TRANSITION_LOADER_ID} {
  position: fixed; inset: 0; z-index: 9;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(ellipse at center, #241f3a 0%, #14111f 70%, #0d0b14 100%);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: opacity ${TRANSITION_LOADER_FADE_MS}ms ease; opacity: 1;
}
#${TRANSITION_LOADER_ID}.${TRANSITION_LOADER_DONE_CLASS} { opacity: 0; pointer-events: none; }
#${TRANSITION_LOADER_ID} .tl-ember {
  width: 16px; height: 16px; border-radius: 50%;
  background: radial-gradient(circle, #ffd9a0 0%, #ff9d4d 45%, #e8631e 75%, rgba(232,99,30,0) 100%);
  box-shadow: 0 0 22px 7px rgba(255,157,77,0.5);
  animation: tl-ember-pulse 1.5s ease-in-out infinite;
}
#${TRANSITION_LOADER_ID} .tl-hint {
  margin-top: 18px; color: #b9a98f; font-size: 13px; letter-spacing: 1px;
  animation: tl-hint-fade 1.8s ease-in-out infinite;
}
@keyframes tl-ember-pulse {
  0%, 100% { transform: scale(0.82); box-shadow: 0 0 14px 4px rgba(255,157,77,0.32); }
  50%      { transform: scale(1.12); box-shadow: 0 0 28px 10px rgba(255,157,77,0.65); }
}
@keyframes tl-hint-fade { 0%, 100% { opacity: 0.45; } 50% { opacity: 0.9; } }
@media (prefers-reduced-motion: reduce) {
  #${TRANSITION_LOADER_ID} .tl-ember, #${TRANSITION_LOADER_ID} .tl-hint { animation: none; }
}
`;

// The narrative line under the ember. Short, lowercase, echoes the boot loader's
// "kindling the fire…" so the two reads belong to the same world.
const HINT_TEXT = 'the path winds on…';

type MinimalEl = {
  id: string;
  className: string;
  innerHTML: string;
  textContent: string;
  classList: { add(token: string): void };
  remove(): void;
};
type MinimalDoc = {
  getElementById(id: string): MinimalEl | null;
  createElement(tag: string): MinimalEl;
  // `any` param so the real DOM `Document` (whose appendChild takes a `Node`) is
  // structurally assignable to this minimal shape — the test stub passes MinimalEl.
  head: { appendChild(el: any): unknown } | null;
  body: { appendChild(el: any): unknown } | null;
};

function ensureStyle(doc: MinimalDoc): void {
  if (doc.getElementById(STYLE_ID) || !doc.head) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  doc.head.appendChild(style);
}

// Show the loader. Idempotent: if it's already on screen (a rapid double
// transition) it's left as-is. Returns true if a loader is present afterwards.
export function showTransitionLoader(doc: MinimalDoc): boolean {
  if (!doc.body) return false;
  if (doc.getElementById(TRANSITION_LOADER_ID)) return true;
  ensureStyle(doc);
  const el = doc.createElement('div');
  el.id = TRANSITION_LOADER_ID;
  el.innerHTML = `<div class="tl-ember"></div><div class="tl-hint">${HINT_TEXT}</div>`;
  doc.body.appendChild(el);
  return true;
}

// Fade the loader out, then remove it. Idempotent and a no-op if it's already
// gone (e.g. a transition whose assets were all cached — nothing was shown).
export function hideTransitionLoader(
  doc: MinimalDoc,
  schedule: (fn: () => void, ms: number) => void,
): boolean {
  const el = doc.getElementById(TRANSITION_LOADER_ID);
  if (!el) return false;
  el.classList.add(TRANSITION_LOADER_DONE_CLASS);
  schedule(() => el.remove(), TRANSITION_LOADER_FADE_MS);
  return true;
}
