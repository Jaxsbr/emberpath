// FB-23 part 2 (shadows) — the per-kind ground-shadow model.
//
// Jaco's direction (2026-06-21): shadows are VISIBLE, so they get real shape
// control — a circle / oval / rectangle you size and position under the object or
// character. Collision stays the (invisible) sub-cell paint; this module is shadows
// only. The authored shape is stored per kind ({ shape, w, h, dx, dy, alpha }) and
// drives the renderer, replacing the FB-21 heuristic for any kind that has one.
//
// Coordinate model (world px; 1 tile = TILE_SIZE px):
//   - `w`, `h`   : the shape's size.
//   - `dx`, `dy` : the shape CENTRE, offset from the kind's REFERENCE point.
//   - `alpha`    : 0..1 opacity.
// The reference point differs by kind family and is supplied by the caller:
//   - OBJECTS    : the anchor cell's top-left corner (inst.col*TILE, inst.row*TILE).
//   - CHARACTERS : the sprite centre (the entity's x, y), so the shadow tracks it.
// Keeping the offset relative to a single point is what lets the editor author once
// and the renderer place correctly wherever the kind appears.

export type ShadowShapeKind = 'ellipse' | 'rect';

export interface ShadowShape {
  shape: ShadowShapeKind;
  w: number;
  h: number;
  dx: number;
  dy: number;
  alpha: number;
}

// A resolved, ready-to-draw shadow: absolute centre + size + style. Pure data so
// the placement math is unit-testable without Phaser.
export interface ResolvedShadow {
  shape: ShadowShapeKind;
  cx: number;
  cy: number;
  w: number;
  h: number;
  alpha: number;
}

// Place a shape's centre at reference + (dx, dy). The single source of truth for
// how authored offsets become world coordinates — shared by the renderer and the
// editor's live preview so what you author is exactly what ships.
export function resolveShadow(s: ShadowShape, refX: number, refY: number): ResolvedShadow {
  return { shape: s.shape, cx: refX + s.dx, cy: refY + s.dy, w: s.w, h: s.h, alpha: s.alpha };
}

// The canon entity (Pip / NPC) shadow as a ShadowShape: a soft ellipse pooled at
// the feet, height 0.4× width (FB-21). `footOffset` drops it from the sprite
// centre down to the ground-contact line. Used as the fallback when a character
// has no authored shadow, and as the editor's seed.
export function defaultEntityShadow(widthPx: number, footOffset: number, alpha: number): ShadowShape {
  return { shape: 'ellipse', w: widthPx, h: widthPx * 0.4, dx: 0, dy: footOffset, alpha };
}

// Authored wins; otherwise fall back to the heuristic/default. Centralised so
// every call site applies the same precedence (and `noShadow` is handled by the
// caller, which simply skips drawing).
export function pickShadow(authored: ShadowShape | undefined, fallback: ShadowShape): ShadowShape {
  return authored ?? fallback;
}
