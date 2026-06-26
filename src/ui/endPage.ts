// F2 — end-of-game page (#198). A themed DOM/HTML overlay (no Phaser, no pixel art)
// that fades in when the finale fires `emberpath:game-complete` (dispatched by F1,
// #197). It is the game's reveal-at-credits surface: one gentle warm scroll carrying
// the plainest tract gospel, a button to the Jesus Film watch page, a (pending)
// "Learn more", and a way back to the title so the closing screen is never a dead end.
//
// Palette + serif mirror TitleScene so the bookend reads as the same game.

import { END_PAGE_MODEL, EndPageLink } from './endPageModel';

const GAME_COMPLETE_EVENT = 'emberpath:game-complete';
const OVERLAY_ID = 'emberpath-end-page';
const STYLE_ID = 'emberpath-end-page-style';
const FADE_MS = 1400; // a slow, warm fade-in that picks up where the stag bloom ends

const TITLE_FONT = 'Georgia, "Times New Roman", serif';
const EMBER_GOLD = '#ffd9a0';
const EMBER_DEEP = '#ff9d4d';
const SECONDARY = '#d8c3a5';

let installed = false;

/**
 * Install the end-of-game page. Idempotent — wires a single listener on
 * `emberpath:game-complete` that builds (once) and fades in the overlay.
 * Call once at boot (main.ts). No-op outside a browser (tests/SSR).
 */
export function installEndGamePage(): void {
  if (installed) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;
  window.addEventListener(GAME_COMPLETE_EVENT, () => showEndPage());
}

/** Build the overlay if needed and fade it in. Exported for the testbench harness. */
export function showEndPage(): HTMLElement {
  ensureStyle();
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = buildOverlay();
    document.body.appendChild(overlay);
  }
  // Reveal on the next frame so the opacity transition actually runs.
  overlay.style.display = 'block';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay!.style.opacity = '1';
    });
  });
  return overlay;
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID} {
  position: fixed; inset: 0; z-index: 9999;
  display: none; opacity: 0;
  transition: opacity ${FADE_MS}ms ease;
  overflow-y: auto; -webkit-overflow-scrolling: touch;
  font-family: ${TITLE_FONT};
  color: ${SECONDARY};
  /* Warm firelit dark — a deep ember glow pooled behind the words. */
  background:
    radial-gradient(120% 80% at 50% 18%, rgba(255,150,70,0.16), rgba(20,16,12,0) 60%),
    linear-gradient(180deg, #1a1410 0%, #15131f 55%, #0f0d16 100%);
}
#${OVERLAY_ID} .ep-end-inner {
  max-width: 560px; margin: 0 auto;
  padding: clamp(48px, 12vh, 120px) 28px 72px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 26px;
}
#${OVERLAY_ID} .ep-end-header {
  font-size: clamp(34px, 8vw, 52px); color: ${EMBER_GOLD};
  text-shadow: 0 0 26px rgba(255,157,77,0.55); margin: 0; line-height: 1.15;
}
#${OVERLAY_ID} .ep-end-subtitle {
  font-size: clamp(18px, 4.5vw, 24px); font-style: italic;
  color: ${SECONDARY}; opacity: 0.92; margin: 0;
}
#${OVERLAY_ID} .ep-end-rule {
  width: 64px; height: 1px; border: 0; margin: 6px 0;
  background: linear-gradient(90deg, rgba(255,200,130,0), rgba(255,200,130,0.6), rgba(255,200,130,0));
}
#${OVERLAY_ID} .ep-end-gospel {
  display: flex; flex-direction: column; gap: 16px;
}
#${OVERLAY_ID} .ep-end-gospel p {
  font-size: clamp(16px, 4vw, 19px); line-height: 1.62;
  color: #e7d8c2; margin: 0;
}
#${OVERLAY_ID} .ep-end-closing {
  font-size: clamp(16px, 4vw, 20px); font-style: italic;
  color: ${EMBER_GOLD}; opacity: 0.85; margin: 4px 0 0;
}
#${OVERLAY_ID} .ep-end-actions {
  display: flex; flex-direction: column; gap: 14px; width: 100%;
  max-width: 340px; margin-top: 10px;
}
#${OVERLAY_ID} .ep-end-btn {
  display: block; width: 100%; box-sizing: border-box;
  padding: 14px 20px; border-radius: 10px;
  font-family: ${TITLE_FONT}; font-size: 18px; text-decoration: none;
  cursor: pointer; border: 1px solid transparent; background: none;
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease;
}
#${OVERLAY_ID} .ep-end-btn-primary {
  background: rgba(255,157,77,0.16); color: ${EMBER_GOLD};
  border-color: rgba(255,200,130,0.5);
}
#${OVERLAY_ID} .ep-end-btn-primary:hover {
  background: rgba(255,157,77,0.30); color: #fff; border-color: ${EMBER_DEEP};
}
#${OVERLAY_ID} .ep-end-btn-secondary {
  color: ${SECONDARY}; border-color: rgba(216,195,165,0.32);
}
#${OVERLAY_ID} .ep-end-btn-secondary:hover {
  color: #fff; border-color: rgba(216,195,165,0.7);
}
#${OVERLAY_ID} .ep-end-btn-ghost {
  color: #9a8f7e; border-color: transparent; font-size: 16px;
}
#${OVERLAY_ID} .ep-end-btn-ghost:hover { color: ${SECONDARY}; }
#${OVERLAY_ID} .ep-end-btn-pending {
  opacity: 0.4; cursor: default; pointer-events: none;
}
`;
  document.head.appendChild(style);
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Thank you for playing');

  const inner = document.createElement('div');
  inner.className = 'ep-end-inner';

  const header = document.createElement('h1');
  header.className = 'ep-end-header';
  header.textContent = END_PAGE_MODEL.header;
  inner.appendChild(header);

  const subtitle = document.createElement('p');
  subtitle.className = 'ep-end-subtitle';
  subtitle.textContent = END_PAGE_MODEL.subtitle;
  inner.appendChild(subtitle);

  const rule = document.createElement('hr');
  rule.className = 'ep-end-rule';
  inner.appendChild(rule);

  const gospel = document.createElement('div');
  gospel.className = 'ep-end-gospel';
  for (const para of END_PAGE_MODEL.gospel) {
    const p = document.createElement('p');
    p.textContent = para;
    gospel.appendChild(p);
  }
  inner.appendChild(gospel);

  if (END_PAGE_MODEL.closing) {
    const closing = document.createElement('p');
    closing.className = 'ep-end-closing';
    closing.textContent = END_PAGE_MODEL.closing;
    inner.appendChild(closing);
  }

  const actions = document.createElement('div');
  actions.className = 'ep-end-actions';
  for (const link of END_PAGE_MODEL.links) {
    actions.appendChild(buildButton(link));
  }
  inner.appendChild(actions);

  overlay.appendChild(inner);
  return overlay;
}

function buildButton(link: EndPageLink): HTMLElement {
  const variantClass = `ep-end-btn-${link.variant}`;

  // An internal action (restart) → a <button>; a real link → an <a>; a pending
  // placeholder → a disabled <span>-like button (never an invented href).
  if (link.action === 'restart') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ep-end-btn ${variantClass}`;
    btn.textContent = link.label;
    btn.addEventListener('click', restartToTitle);
    return btn;
  }

  if (link.pending || link.href === null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = true;
    btn.className = `ep-end-btn ${variantClass} ep-end-btn-pending`;
    btn.textContent = link.label;
    return btn;
  }

  const a = document.createElement('a');
  a.className = `ep-end-btn ${variantClass}`;
  a.textContent = link.label;
  a.href = link.href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function restartToTitle(): void {
  // Drop any query (e.g. a testbench `?scenario=`) and return to a clean Title.
  // The save lives in localStorage, so Continue still works from there.
  window.location.href = window.location.pathname;
}
