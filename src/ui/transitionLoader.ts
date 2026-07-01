// #214 P3 — the area-transition loading indicator.
//
// With per-area lazy loading (systems/areaAssets), walking into a new map fetches
// that map's tilesets / NPC sheets / portraits / music on the spot. On a fast
// connection that's imperceptible; on a slow one the camera would otherwise sit on
// black for a beat with no feedback. This overlay paints a warm ember + a short
// line over that black so the wait reads as "the world is kindling ahead" rather
// than a freeze.
//
// #214 P4 — perceived wait. The loader now also carries a kindling PROGRESS track
// (a known wait feels shorter than an unknown one) and a rotating set of gentle
// world-WHISPERS so the eye has something warm to rest on. Both are driven from
// GameScene (Phaser's loader `progress` event + a timer) through the small pure
// setters below; idle prefetch (systems/areaAssets selectPrefetchTargets) means
// most transitions never show this at all.
//
// Kept Phaser-free and DOM-injectable (like ui/bootLoader.ts) so the logic is
// node-testable and lives outside the scene graph — no dual-camera bookkeeping. It
// styles itself entirely from JS so it has no dependency on index.html.

export const TRANSITION_LOADER_ID = 'transition-loader';
export const TRANSITION_LOADER_FILL_ID = 'transition-loader-fill';
export const TRANSITION_LOADER_HINT_ID = 'transition-loader-hint';
export const TRANSITION_LOADER_DONE_CLASS = 'transition-loader--done';
// Match the CSS opacity transition, with slack before we remove the node so the
// fade-out completes visually rather than snapping.
export const TRANSITION_LOADER_FADE_MS = 360;
// How long each whisper lingers before the next fades in (driven by GameScene).
export const TRANSITION_WHISPER_ROTATE_MS = 2600;
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
#${TRANSITION_LOADER_ID} .tl-track {
  margin-top: 20px; width: 168px; height: 4px; border-radius: 2px;
  background: rgba(255,217,160,0.12); overflow: hidden;
}
#${TRANSITION_LOADER_ID} .tl-fill {
  height: 100%; width: 0%; border-radius: 2px;
  background: linear-gradient(90deg, #e8631e 0%, #ff9d4d 55%, #ffd9a0 100%);
  box-shadow: 0 0 8px 1px rgba(255,157,77,0.6);
  transition: width 200ms ease;
}
#${TRANSITION_LOADER_ID} .tl-hint {
  margin-top: 16px; color: #b9a98f; font-size: 13px; letter-spacing: 1px;
  min-height: 16px; transition: opacity 420ms ease; opacity: 0.85;
}
@keyframes tl-ember-pulse {
  0%, 100% { transform: scale(0.82); box-shadow: 0 0 14px 4px rgba(255,157,77,0.32); }
  50%      { transform: scale(1.12); box-shadow: 0 0 28px 10px rgba(255,157,77,0.65); }
}
@media (prefers-reduced-motion: reduce) {
  #${TRANSITION_LOADER_ID} .tl-ember { animation: none; }
  #${TRANSITION_LOADER_ID} .tl-fill, #${TRANSITION_LOADER_ID} .tl-hint { transition: none; }
}
`;

// The narrative lines under the ember. Short, lowercase, in the warmth/path/light
// register the rest of the game speaks in (governed by biblical-guidance.md:
// kid-level, allegory intact, never naming the source). The first stays the
// original "the path winds on…" so a single transition reads unchanged.
export const TRANSITION_WHISPERS: readonly string[] = [
  'the path winds on…',
  'the next way is kindling…',
  'embers catch up ahead…',
  'warmth gathers further on…',
  'a little light, then a little more…',
];

// Pure accessor so rotation is deterministic + testable: wraps the pool.
export function whisperAt(index: number): string {
  const n = TRANSITION_WHISPERS.length;
  return TRANSITION_WHISPERS[((index % n) + n) % n];
}

// A cursor that survives across transitions so consecutive loads open on a
// different line (variety) without needing Math.random.
let whisperCursor = 0;

type MinimalEl = {
  id: string;
  className: string;
  innerHTML: string;
  textContent: string;
  style: { width: string };
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
// transition) it's left as-is. Opens on the next whisper in the pool. Returns true
// if a loader is present afterwards.
export function showTransitionLoader(doc: MinimalDoc): boolean {
  if (!doc.body) return false;
  if (doc.getElementById(TRANSITION_LOADER_ID)) return true;
  ensureStyle(doc);
  const first = whisperAt(whisperCursor);
  whisperCursor += 1;
  const el = doc.createElement('div');
  el.id = TRANSITION_LOADER_ID;
  el.innerHTML =
    `<div class="tl-ember"></div>` +
    `<div class="tl-track"><div id="${TRANSITION_LOADER_FILL_ID}" class="tl-fill"></div></div>` +
    `<div id="${TRANSITION_LOADER_HINT_ID}" class="tl-hint">${first}</div>`;
  doc.body.appendChild(el);
  return true;
}

// Drive the kindling progress fill from Phaser's loader `progress` (0→1). Clamps,
// so a stray >1 or <0 never breaks the bar. No-op if the loader isn't showing.
export function setTransitionLoaderProgress(doc: MinimalDoc, frac: number): boolean {
  const fill = doc.getElementById(TRANSITION_LOADER_FILL_ID);
  if (!fill) return false;
  const clamped = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  fill.style.width = `${Math.round(clamped * 100)}%`;
  return true;
}

// Advance to the next whisper line (GameScene calls this on a timer while the
// loader lingers). No-op if the loader isn't showing. Returns the line set, if any.
export function advanceTransitionWhisper(doc: MinimalDoc): string | null {
  const hint = doc.getElementById(TRANSITION_LOADER_HINT_ID);
  if (!hint) return null;
  const next = whisperAt(whisperCursor);
  whisperCursor += 1;
  hint.textContent = next;
  return next;
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
