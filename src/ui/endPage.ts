// F2 — end-of-game page (#198). A themed DOM/HTML overlay (no Phaser, no pixel art)
// that fades in when the finale fires `emberpath:game-complete` (dispatched by F1,
// #197). It is the game's reveal-at-credits surface: one gentle warm scroll carrying
// the plainest tract gospel, three resource buttons (follow Jesus / watch videos /
// download a Bible — #1266) styled as the reference's pills, and a way back to the
// title so the closing screen is never a dead end.
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
  // FB (#1276) — start the drifting-leaf ambience once the page is up (idempotent).
  startLeaves(overlay);
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
  position: relative; z-index: 1;
  max-width: 560px; margin: 0 auto;
  padding: clamp(48px, 12vh, 120px) 28px 72px;
  text-align: center;
  display: flex; flex-direction: column; align-items: center; gap: 26px;
}
/* FB-24 — frame the page with the game's own pixel art (oak / rock / fence) as a
   fixed vignette: opaque at the page edges, faded to nothing behind the words. The
   radial mask does the fade — transparent in the centre (where text + buttons sit),
   solid toward the edges — so the art surrounds the content without competing with
   it. pointer-events:none so it never eats a tap; sits behind .ep-end-inner. */
#${OVERLAY_ID} .ep-end-frame {
  position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  -webkit-mask-image: radial-gradient(ellipse 64% 60% at 50% 47%,
    transparent 0%, transparent 36%, rgba(0,0,0,0.85) 78%, #000 100%);
  mask-image: radial-gradient(ellipse 64% 60% at 50% 47%,
    transparent 0%, transparent 36%, rgba(0,0,0,0.85) 78%, #000 100%);
}
#${OVERLAY_ID} .ep-end-sprite {
  position: absolute; image-rendering: pixelated;
  /* Sit the natural sprite colours into the firelit dark without losing identity. */
  opacity: 0.5; filter: brightness(0.82) saturate(0.85) drop-shadow(0 2px 6px rgba(0,0,0,0.5));
}
/* FB (Jaco #1276) — drifting leaves like Briar Wilds: slow, partly-transparent autumn
   leaves fluttering down the page. Sits ABOVE the frame art and BELOW the text
   (z-index between .ep-end-frame at 0 and .ep-end-inner at 1) so it never obstructs
   the words. pointer-events:none — purely ambient. */
#${OVERLAY_ID} .ep-end-leaves {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
}
#${OVERLAY_ID} .ep-end-header {
  font-size: clamp(34px, 8vw, 52px); font-weight: 700; color: ${EMBER_GOLD};
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
  font-size: clamp(16px, 4vw, 19px); font-weight: 400; line-height: 1.62;
  color: #e7d8c2; margin: 0;
}
#${OVERLAY_ID} .ep-end-closing {
  font-size: clamp(16px, 4vw, 20px); font-style: italic;
  color: ${EMBER_GOLD}; opacity: 0.85; margin: 4px 0 0;
}
#${OVERLAY_ID} .ep-end-actions {
  display: flex; flex-direction: column; gap: 13px; width: 100%;
  max-width: 380px; margin-top: 10px;
}
/* Pill buttons follow the reference Jaco supplied (#1266); the warm ember palette,
   serif, and right-aligned glyph keep them on-brand rather than generic CTAs. */
#${OVERLAY_ID} .ep-end-btn {
  position: relative;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  width: 100%; box-sizing: border-box;
  padding: 15px 22px; border-radius: 999px;
  font-family: ${TITLE_FONT}; font-size: 18px; font-weight: 600; letter-spacing: 0.2px;
  text-align: center; text-decoration: none; cursor: pointer;
  border: 1.5px solid transparent; background: none; color: ${SECONDARY};
  transition: background 180ms ease, color 180ms ease, border-color 180ms ease,
    transform 180ms ease, box-shadow 180ms ease;
}
/* Label is centred (FB-24). The glyph is pinned absolutely to the trailing edge so
   it stays at the reference's right side WITHOUT pushing the text off-centre; the
   label's inline padding keeps centred text clear of the glyph. */
#${OVERLAY_ID} .ep-end-btn-label { flex: 0 1 auto; padding: 0 14px; }
#${OVERLAY_ID} .ep-end-btn-icon {
  position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
  display: inline-flex; align-items: center; opacity: 0.92;
}
#${OVERLAY_ID} .ep-end-btn-icon svg { display: block; }
/* Motion budget: one subtle CTA lift on hover; no bounce, no decorative float. */
#${OVERLAY_ID} .ep-end-btn:hover { transform: translateY(-1px); }
#${OVERLAY_ID} .ep-end-btn:focus-visible {
  outline: 2px solid rgba(255,205,140,0.9); outline-offset: 3px;
}
/* Primary = the single filled "sharp accent" (the next step after the reveal). */
#${OVERLAY_ID} .ep-end-btn-primary {
  background: linear-gradient(180deg, rgba(255,176,98,0.96), rgba(255,142,62,0.94));
  color: #2a1708; border-color: rgba(255,214,158,0.75); font-weight: 700;
  box-shadow: 0 6px 20px rgba(255,140,60,0.22);
}
#${OVERLAY_ID} .ep-end-btn-primary:hover {
  color: #1c0f04; box-shadow: 0 9px 26px rgba(255,140,60,0.34);
}
#${OVERLAY_ID} .ep-end-btn-primary .ep-end-btn-icon { opacity: 0.85; }
/* Secondary = outlined, warm — the two supporting resources. */
#${OVERLAY_ID} .ep-end-btn-secondary {
  color: ${EMBER_GOLD}; border-color: rgba(255,200,130,0.42);
  background: rgba(255,157,77,0.05);
}
#${OVERLAY_ID} .ep-end-btn-secondary:hover {
  color: #fff; border-color: rgba(255,200,130,0.85); background: rgba(255,157,77,0.14);
}
/* Ghost = the quiet way back home; centred, no icon, no lift. */
#${OVERLAY_ID} .ep-end-btn-ghost {
  color: #b6a892; border-color: transparent; font-size: 16px; font-weight: 500;
  justify-content: center;
}
#${OVERLAY_ID} .ep-end-btn-ghost:hover { color: ${EMBER_GOLD}; transform: none; }
#${OVERLAY_ID} .ep-end-btn-pending {
  opacity: 0.4; cursor: default; pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  #${OVERLAY_ID} { transition: none; }
  #${OVERLAY_ID} .ep-end-btn:hover { transform: none; }
}
`;
  document.head.appendChild(style);
}

// FB-24 — the framing sprites. The game's own Ashen-Isle pixel art (oak / pine /
// rock / bush / fence), grouped into corner clusters (clustering rule: 2-4 mixed
// types together, never scattered) and a low fence run along the bottom so the page
// reads as a clearing ringed by the world. Each spec is asset path + inline
// position/size; the radial mask on .ep-end-frame fades them all out behind the text.
const OBJ = (f: string) => `objects/ashen-isle/${f}`;
const FRAME_SPRITES: Array<{ asset: string; style: string }> = [
  // Bottom-left cluster — a big oak grounded in the corner with rock + bush at its feet.
  { asset: OBJ('tree-oak.png'), style: 'left:-16px; bottom:-12px; width:172px;' },
  { asset: OBJ('rock.png'), style: 'left:66px; bottom:-2px; width:52px;' },
  { asset: OBJ('bush.png'), style: 'left:122px; bottom:-4px; width:60px;' },
  // Bottom-right cluster — mixed pine + oak, rock + bush.
  { asset: OBJ('tree-pine.png'), style: 'right:-14px; bottom:-14px; width:156px;' },
  { asset: OBJ('tree-oak.png'), style: 'right:92px; bottom:-10px; width:130px;' },
  { asset: OBJ('rock.png'), style: 'right:150px; bottom:0; width:46px;' },
  { asset: OBJ('bush.png'), style: 'right:18px; bottom:70px; width:48px;' },
  // Bottom-centre fence run + a rock, low under the buttons.
  { asset: OBJ('fence-rail.png'), style: 'left:calc(50% - 78px); bottom:-4px; width:82px; transform:translateX(-50%);' },
  { asset: OBJ('fence-rail.png'), style: 'left:50%; bottom:-4px; width:82px; transform:translateX(-50%);' },
  { asset: OBJ('fence-rail.png'), style: 'left:calc(50% + 78px); bottom:-4px; width:82px; transform:translateX(-50%);' },
  { asset: OBJ('rock.png'), style: 'left:calc(50% - 132px); bottom:2px; width:40px; transform:translateX(-50%);' },
  // Top corners — canopies peeking in to surround the header, partly off-frame.
  { asset: OBJ('tree-oak.png'), style: 'left:-48px; top:-58px; width:144px;' },
  { asset: OBJ('tree-pine.png'), style: 'right:-44px; top:-62px; width:144px;' },
];

function buildFrame(): HTMLElement {
  const frame = document.createElement('div');
  frame.className = 'ep-end-frame';
  frame.setAttribute('aria-hidden', 'true');
  for (const spec of FRAME_SPRITES) {
    const img = document.createElement('img');
    img.className = 'ep-end-sprite';
    img.src = spec.asset;
    img.alt = '';
    img.setAttribute('style', spec.style);
    frame.appendChild(img);
  }
  return frame;
}

// FB (Jaco #1276) — drifting-leaf ambience, ported from the Briar Wilds
// LeafFallSystem (src/systems/leafFall.ts) to a plain <canvas> since the end page
// is a DOM overlay, not Phaser. Softer than Briar: slower fall and lower alpha so it
// reads as a gentle settling, and it sits behind the text so it never obstructs
// reading. Same almond-blade leaf shape + amber/umber palette as the in-game effect.
const LEAF_COUNT = 16;
const LEAF_FALL_MIN = 9; // px/s — Briar is 24–52; ~halved here for a calm drift
const LEAF_FALL_MAX = 22;
const LEAF_DRIFT_VX = 5; // px/s sideways bias
const LEAF_SWAY_AMP = 14; // px/s sway velocity amplitude
const LEAF_SWAY_SPEED = 0.7; // rad/s
const LEAF_ROT_MIN = 0.25;
const LEAF_ROT_MAX = 0.9; // rad/s tumble
const LEAF_ALPHA_MIN = 0.22;
const LEAF_ALPHA_MAX = 0.46; // partly transparent (Jaco's spec)
const LEAF_SIZE_MIN = 14;
const LEAF_SIZE_MAX = 26; // px

interface Leaf {
  x: number;
  y: number;
  fall: number;
  drift: number;
  swayPhase: number;
  rot: number;
  rotSpeed: number;
  alpha: number;
  size: number;
}

let leafCanvas: HTMLCanvasElement | null = null;

// One baked almond-blade leaf (amber blade + umber edge + midrib), reused for every
// leaf via drawImage — matches the Briar leaf texture (no per-frame path building).
function makeLeafSprite(): HTMLCanvasElement | null {
  const S = 48;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const cx = S / 2;
  g.beginPath();
  g.moveTo(cx, 4);
  g.quadraticCurveTo(S - 8, S / 2, cx, S - 4);
  g.quadraticCurveTo(8, S / 2, cx, 4);
  g.closePath();
  g.fillStyle = 'rgba(206,140,52,1)';
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(110,68,28,0.95)';
  g.stroke();
  g.beginPath();
  g.moveTo(cx, 6);
  g.lineTo(cx, S - 6);
  g.strokeStyle = 'rgba(110,68,28,0.8)';
  g.lineWidth = 1.5;
  g.stroke();
  return c;
}

function spawnLeaf(w: number, h: number, atTop: boolean): Leaf {
  const r = Math.random;
  return {
    x: r() * w,
    y: atTop ? -20 - r() * h * 0.25 : r() * h,
    fall: LEAF_FALL_MIN + r() * (LEAF_FALL_MAX - LEAF_FALL_MIN),
    drift: r() * 2 - 1,
    swayPhase: r() * Math.PI * 2,
    rot: r() * Math.PI * 2,
    rotSpeed: (LEAF_ROT_MIN + r() * (LEAF_ROT_MAX - LEAF_ROT_MIN)) * (r() < 0.5 ? -1 : 1),
    alpha: LEAF_ALPHA_MIN + r() * (LEAF_ALPHA_MAX - LEAF_ALPHA_MIN),
    size: LEAF_SIZE_MIN + r() * (LEAF_SIZE_MAX - LEAF_SIZE_MIN),
  };
}

// Mount the leaf canvas behind the text content and run the drift loop. Idempotent
// (a second showEndPage call is a no-op). Honours prefers-reduced-motion with a
// single static settle instead of animating. Guards getContext so it's safe under
// jsdom/SSR (no canvas backend → silently skips).
function startLeaves(overlay: HTMLElement): void {
  if (leafCanvas) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const sprite = makeLeafSprite();
  if (!sprite) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'ep-end-leaves';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  leafCanvas = canvas;
  const inner = overlay.querySelector('.ep-end-inner');
  overlay.insertBefore(canvas, inner);

  let w = 0;
  let h = 0;
  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const leaves = Array.from({ length: LEAF_COUNT }, () => spawnLeaf(w, h, false));

  const drawLeaf = (leaf: Leaf): void => {
    ctx.save();
    ctx.globalAlpha = leaf.alpha;
    ctx.translate(leaf.x, leaf.y);
    ctx.rotate(leaf.rot);
    const s = leaf.size;
    ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  };

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduce || typeof requestAnimationFrame === 'undefined') {
    ctx.clearRect(0, 0, w, h);
    for (const leaf of leaves) drawLeaf(leaf);
    return;
  }

  let last = performance.now();
  const tick = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;
    ctx.clearRect(0, 0, w, h);
    for (const leaf of leaves) {
      // Briar's motion model: fall + a drift bias + a sinusoidal sway velocity.
      leaf.x += (LEAF_DRIFT_VX * leaf.drift + Math.sin(t * LEAF_SWAY_SPEED + leaf.swayPhase) * LEAF_SWAY_AMP) * dt;
      leaf.y += leaf.fall * dt;
      leaf.rot += leaf.rotSpeed * dt;
      if (leaf.y - leaf.size > h) Object.assign(leaf, spawnLeaf(w, h, true));
      if (leaf.x > w + 30) leaf.x = -30;
      else if (leaf.x < -30) leaf.x = w + 30;
      drawLeaf(leaf);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function buildOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Thank you for playing');

  // Decorative pixel-art frame sits behind the content (FB-24).
  overlay.appendChild(buildFrame());

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

// Inline SVG glyphs for the right-aligned icon (#1266 reference). Static constant
// strings only — never user/model input — so `innerHTML` here is safe. `currentColor`
// makes each glyph inherit its button's text colour (filled-dark on primary, ember on
// the rest). Simple line glyphs to match the storybook serif, not a heavy icon set.
const ICONS: Record<NonNullable<EndPageLink['icon']>, string> = {
  // open book — "learn / follow"
  discipleship:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.5C10.5 5 8 4.5 4 4.8v12.6c4-.3 6.5.2 8 1.6 1.5-1.4 4-1.9 8-1.6V4.8c-4-.3-6.5.2-8 1.7Z"/><path d="M12 6.5v12.1"/></svg>',
  // play triangle — "watch videos"
  play:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.8 15 12l-4.8 3.2Z" fill="currentColor"/></svg>',
  // closed book — "download a Bible"
  bible:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4Z"/><path d="M5 17.5h13"/><path d="M11.5 7.5v3M10 9h3"/></svg>',
};

// Lay a button's content out as label (left, flex-grow) + optional right glyph, so the
// flex `space-between` pushes the icon to the trailing edge (the reference layout).
function appendLabelAndIcon(el: HTMLElement, link: EndPageLink): void {
  const label = document.createElement('span');
  label.className = 'ep-end-btn-label';
  label.textContent = link.label;
  el.appendChild(label);
  if (link.icon) {
    const icon = document.createElement('span');
    icon.className = 'ep-end-btn-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS[link.icon]; // static constant SVG — safe
    el.appendChild(icon);
  }
}

function buildButton(link: EndPageLink): HTMLElement {
  const variantClass = `ep-end-btn-${link.variant}`;

  // An internal action (restart) → a <button>; a real link → an <a>; a pending
  // placeholder → a disabled <span>-like button (never an invented href).
  if (link.action === 'restart') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ep-end-btn ${variantClass}`;
    appendLabelAndIcon(btn, link);
    btn.addEventListener('click', restartToTitle);
    return btn;
  }

  if (link.pending || link.href === null) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.disabled = true;
    btn.className = `ep-end-btn ${variantClass} ep-end-btn-pending`;
    appendLabelAndIcon(btn, link);
    return btn;
  }

  const a = document.createElement('a');
  a.className = `ep-end-btn ${variantClass}`;
  a.href = link.href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  appendLabelAndIcon(a, link);
  return a;
}

function restartToTitle(): void {
  // Drop any query (e.g. a testbench `?scenario=`) and return to a clean Title.
  // The save lives in localStorage, so Continue still works from there.
  const go = (): void => {
    window.location.href = window.location.pathname;
  };
  // Jaco (#1294): leaving the end screen should be a graceful transition, NOT an
  // abrupt reload. Fade the overlay back out (the same warm FADE_MS used to fade it
  // in) so it dissolves toward the title, then reload once the fade has played. The
  // reveal-at-end direction is intentionally NOT animated this way (it fades up over
  // the finale, handled by showEndPage); only this exit gets the fade-out.
  const overlay = document.getElementById(OVERLAY_ID);
  const reduce = !!(
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  if (!overlay || reduce || typeof window.setTimeout === 'undefined') {
    go();
    return;
  }
  overlay.style.opacity = '0';
  window.setTimeout(go, FADE_MS);
}
