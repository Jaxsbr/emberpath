---
status: shipped
type: feature
created: 2026-06-21
issue: 179
relates: ["#177 (FB-23 object collision/shadow authoring)"]
---

# Shadow-shape authoring (objects + Pip + all NPCs)

## Direction (Jaco, 2026-06-21 — narrowed from the original draft)
The first draft of this plan proposed per-character **AABB collision** authoring. Jaco
narrowed the scope after seeing the annotation: **collision stays exactly as shipped**
(per-object sub-cell paint for objects, the AABB body box for characters — both
invisible, both working). The real ask is a **shadow placement tool**, because shadows
are *visible* and currently wrong (a square shadow under a round tree). So this work is
**shadows only**:

> Pick a **circle / oval / rectangle**, **drag to position, drag to size, submit** —
> placed relative to the object/character. (Jaco, msgs 1114→1118.)

Architecture decision (mine, delegated): leave collision untouched; build shadow
authoring as a shape tool for both families (objects + characters), sharing one
`resolveShadow` math so the editor preview equals the shipped render.

## Shipped design

### Schema — `ShadowShape` (`src/maps/shadows.ts`)
`{ shape: 'ellipse' | 'rect'; w; h; dx; dy; alpha }`, world px (1 tile = 32). `ellipse`
with `w==h` = circle, `w!=h` = oval; `rect` = rectangle. `dx,dy` = shape **centre**
offset from a reference point. Pure + unit-tested (`test/shadows.test.ts`, 8 tests).

### Reference points
- **Objects** → the anchor cell top-left `(col*TILE, row*TILE)`.
- **Characters** → the sprite **centre** `(entity.x, entity.y)`, so the shadow tracks
  the entity as it walks.

### Render (VISUAL → GATE-2)
- Objects: authored `def.shadow` wins over the FB-21 heuristic; `noShadow` still wins
  over everything (`GameScene.renderObjects`).
- Characters: `getCharacterShadow(kind)` wins over the feet-ellipse default; an
  unauthored kind keeps the default — **no regression, migrate one kind at a time**.
- Per-frame offset tracking (`playerShadowOffset` / `npcShadowOffsetById`) keeps an
  authored shape pinned to the moving sprite.

### Editor — `?editor=shadow&target=<object|character>&kind=<id>` (`src/systems/shadowEditor.ts`)
One editor, two families. Pick circle/oval/rect, drag the body to move, drag the
east/south handles to size (circle locks w==h), alpha slider, Save / Clear. Renders the
real black shadow at its authored alpha as the live preview. Seeds from the kind's
current authored shadow, else a sensible default.

### Data + save
- `src/data/object-shapes.json` — now holds `collision` AND/OR `shadow` per kind
  (`vite-plugins/object-shape-save.ts` merges each field independently — a shadow save
  never wipes collision).
- `src/data/character-shapes.json` (new) — per-character `shadow`, keyed by `pip` or an
  NPC sprite id (`vite-plugins/character-shape-save.ts`).
- `src/maps/characters.ts` (new) — character registry: `characterTextureKey`,
  `getCharacterKindIds`, `isCharacterKind`, `getCharacterShadow`.

## Verification
- tsc clean · 28 tests pass (8 new shadow tests) · `vite build` OK.
- GATE-2 MP4 captured (`autonomy/feedback/FB-23/shadow-editor-tool.mp4`): tree-oak
  round/oval shadow + Pip feet ellipse. **Jaco approved 2026-06-21** ("works great as
  is") after authoring several object shadows himself (oak/pine ovals, cottage-large
  rect, fence-rail thin oval — captured in this PR).

## Out of scope (unchanged this PR)
- All collision (object sub-cell paint + character AABB) — untouched.
- Authoring shadows for every remaining kind — done opportunistically one at a time;
  unauthored kinds keep the safe default.
