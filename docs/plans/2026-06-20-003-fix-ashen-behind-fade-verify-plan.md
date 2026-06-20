---
status: active
type: feature
issue: 119
area: ashen
created: 2026-06-20
revised: 2026-06-20
gate1: required
gate2: required
---

# Plan — Walk-behind cottages + collision tooling (debug render · paint editor · staged-commit workflow)

> Revised 2026-06-20 after Jaco's redirect (msg #1092). The original "verify &
> close" framing was wrong: the fade *trigger* is wired, but the residual #119
> bug is real — **Pip cannot walk behind a cottage at all**, because the building
> collision blocks the entire body. Jaco also asked for the tooling to drive this
> safely (debug collision render + a paint editor + a staged→test→approve→commit
> flow) rather than guiding collision edits by text prompt. This plan covers all
> of it.

## Problem frame

The behind-object see-through reveal works for **trees** because a tree blocks
only a tiny base cell (`collisionFootprint {dx:1,dy:3,w:1,h:1}`) and the whole
upper canopy is walkable — Pip steps *into* the canopy zone, gets drawn behind it,
and it fades to 50% + rim. A **cottage blocks its entire body**, so she can never
reach a behind-the-body cell; she has to detour all the way around, "colliding
with empty space" (the roof). The hitbox is the full sprite footprint, not a base.

**Why the cottage over-blocks — collision is DOUBLE-SOURCED:**
1. **Tilemap WALL band** — `buildAshenMap()` paints `W` over the full body
   (`src/data/areas/ashen-isle.ts:153-159` player cottage cols 6-13 rows 8-14;
   `:177-182` Old Man cols 36-43 rows 21-27).
2. **`collision-block` object grid** — `cottageLarge()` lays an 8×7 grid of the
   invisible `passable:false` `collision-block` kind over the same body
   (`src/data/areas/ashen-isle.ts:281`).

Both must be reduced to a thin base band for the body to become walkable. Two
coupled collision sources for one building is precisely why text-guided edits are
error-prone — hence Jaco's request for visual tooling.

The desired model (tree-parity): a building blocks a **thin base band where the
walls meet the ground**, and the **upper roof rows are walkable**, so Pip rounds
into the roof footprint, renders behind, and the already-wired `baseFootprint`
see-through fade fires.

## Scope

**In scope**
- Tree-parity collision for buildings (`cottage-large`, and the model generalizes
  to `cottage` / `hermit-house`): thin base collider, walkable upper body.
- A **debug collision render** (you can't paint/verify what you can't see).
- A **collision paint editor** that saves to a **staged** directory.
- A **staged → port → verify → approve → commit** workflow, scripted where useful.
- Close #119 with an MP4 of Pip walking behind the Old Man's cottage + the fade.

**Out of scope**
- Changing the fade rendering (alpha/rim/silhouette) — FB-3/FB-11 canon, fine.
- New homestead art / sprite work (#482 untouched).
- A full general-purpose tilemap/object editor — this editor is **collision-only**
  for now (terrain WALL/FLOOR + per-cell object-block), not decoration authoring.
- Refactoring the area-data format. The editor reads/writes a staged overlay; the
  port step lands values into the existing `ashen-isle.ts` authoring.

## The forks (GATE 1 — need your direction before /ce-work)

**Fork 1 — how the editor SAVES to a staged directory.** A browser can't write to
disk on its own.
- **(1a) Vite dev-server save endpoint (recommended).** A small dev-only Vite
  plugin exposes `POST /__collision/save`; the editor's "Save" button writes
  `staged/collision/<areaId>.json` on disk for real while `npm run dev` runs.
  One clean click → a staged file. *(My pick — matches "save collision maps
  properly in a staged directory" with no manual step.)*
- **(1b) Download-then-drop.** "Save" downloads a JSON you move into
  `staged/collision/` yourself. Zero dev-server code, but a manual step each save.

**Fork 2 — collision source after the fix.** Today it's double-sourced.
- **(2a) Single source = object collider (recommended).** Stop painting the WALL
  band under buildings; the building's collision becomes a `collisionFootprint`
  (thin base band) on the object kind, like a tree. One place collision lives, the
  editor edits that, the bug is fixed. *(My pick.)*
- **(2b) Single source = tilemap WALL.** Keep collision in the tilemap, paint only
  the base band as WALL, drop the collision-block grid. Also single-source, but
  buildings stay special-cased in the tilemap rather than behaving like other
  tall objects.

**Fork 3 — sequencing.**
- **(3a) Tooling first, then the cottage fix (recommended).** Build debug render +
  editor + workflow, then you paint the cottage base band and I port/verify. Slower
  to the #119 close, but you get the durable tooling you asked for and drive the
  fix yourself. *(My pick — it's what your message asks for.)*
- **(3b) Quick cottage fix now, tooling after.** I directly shrink the cottage
  collider to a base band, ship the #119 close + MP4 this cycle, then build the
  tooling as a follow-up. Faster #119, but the first collision edit is text-guided
  (the thing you want to stop doing).
- **(3c) Other — tell me something different.**

## Implementation units

### U1 — Debug collision render (foundation)
- **Goal:** A toggle that draws the LIVE collision map over the rendered area —
  every blocked cell (terrain-WALL OR object-block) tinted, so collision is
  visible while playing/testing. Extends the existing F3 system.
- **Files:**
  - Modify: `src/systems/debugOverlay.ts` — add a collision-grid layer that reads
    the same truth the collision check uses: terrain (all-4-vertices-impassable,
    per `collision.ts`) + `passability.objectBlockMap`. New sub-toggle (e.g. F4, or
    a mode within F3).
  - Reference: `src/scenes/GameScene.ts:1681-1693` already computes per-cell
    `blocked` for its own purposes — mirror that exact rule so the overlay can't
    drift from real collision.
- **Verification:**
  1. Toggle on in `?scenario=at-old-man-cottage` → every WALL/blocked cell under
     the cottage is tinted; walkable cells are not.
  2. The tint set equals the cells where movement is actually blocked (spot-check
     by walking Pip into a tinted cell — she stops; into an untinted cell — she
     passes).
  3. No render/console error; toggle is a no-op during dialogue (existing guard).

### U2 — Collision paint editor + staged save
- **Goal:** A dev-only mode that overlays a paintable grid on the area; click/drag
  toggles a cell blocked⇄clear; "Save" writes `staged/collision/<areaId>.json`.
- **Files:**
  - Create: `src/editor/collisionEditor.ts` (+ minimal UI) — entered via
    `?editor=collision&area=<id>` (reuses the sandbox namespace so it never
    touches a real save). Renders the U1 grid as the paint surface; tracks an
    edited cell-set; "Save" serializes `{areaId, cols, rows, blocked:[[c,r],…]}`.
  - Create (Fork 1a): `vite-plugins/collision-save.ts` — dev middleware handling
    `POST /__collision/save` → writes `staged/collision/<areaId>.json`. Wire into
    `vite.config.ts`. (Fork 1b: replace with a client-side download — no plugin.)
  - Create: `staged/` (gitignored except a `.gitkeep`) — the staging area; staged
    files are throwaway, never committed.
  - Reference: `src/sandbox.ts` (namespace gating), `src/scenarios/*` (URL-param
    boot pattern).
- **Verification (the "tested properly" Jaco asked for):**
  1. Enter editor for `ashen-isle`, paint several cells, Save → the staged JSON
     exists on disk with exactly those cells.
  2. Reload the editor → it loads the staged file and shows the painted state
     (round-trip persists; no silent loss).
  3. Painting is idempotent (toggle a cell twice → back to original; Save reflects
     it). Save while not in editor mode is impossible (guarded).
  4. Playwright headless: boot editor, paint a known cell, Save, assert the staged
     file's bytes — automated proof the save path works.
- **Execution note:** the save round-trip is the load-bearing risk; write the
  Playwright save-assertion (U2.4) before declaring the editor done.

### U3 — Staged → port → verify → commit workflow
- **Goal:** The repeatable flow Jaco specified: he paints+saves → I port staged
  values into the area code → verify (MP4 + Playwright pass) → his approval → drop
  staged file → commit only the proven values.
- **Files:**
  - Create: `autonomy/apply-staged-collision.cjs` — reads
    `staged/collision/<areaId>.json` and emits the diff to apply to the area's
    collision source (per Fork 2: the object `collisionFootprint` and/or the
    tilemap WALL band), or applies it and prints the before/after for review.
  - Doc: `docs/workflow/collision-staging.md` — the staged→commit contract (where
    staged lives, that it's gitignored, the verify gates, that only ported values
    are committed and the staged file is dropped before commit).
- **Verification:**
  1. Given a hand-made staged file, the script reports/applies the correct cell
     changes to `ashen-isle.ts` (no off-by-one vs the painted grid).
  2. After apply, `npm run build` clean and the behind-fade scenario passes.
  3. The staged file is NOT in the committed tree (gitignored + dropped).

### U4 — First real use: cottage walk-behind (the #119 close)
- **Goal:** Using U1–U3, give the Old Man's cottage a thin base collider + walkable
  upper body so Pip walks behind it and the see-through fade fires; capture the MP4.
- **Files:** `src/data/areas/ashen-isle.ts` — reduce BOTH collision sources for the
  Old Man's cottage to the base band (per Fork 2's chosen single-source), via the
  ported staged values. Player cottage same treatment if convenient.
- **Verification:**
  1. Debug render (U1) shows only the base band blocked; roof rows walkable.
  2. New behind-fade scenario drives Pip up into the roof footprint → fade fires
     while she's on a body-occluded cell (alpha→0.5, rim on), reverts on exit.
  3. She no longer detours around empty roof space (the reported bug is gone).
  4. MP4 capture (motion → MP4) for GATE 2; `npm run build` + boot-smoke clean.

## Sequencing & dependencies
U1 → U2 (editor paints on the U1 grid) → U3 (port needs a staged file) → U4 (uses
the whole chain). Under Fork 3b, U4 runs first as a direct edit and U1–U3 follow.

## Gates
- **GATE 1 (this Brief):** Forks 1–3 need your direction before `/ce-work`.
- **GATE 2:** MP4 preview approval before merging U4 (and any visual editor output
  you want to eyeball). Per your staged flow, U4's collision values are committed
  ONLY after you approve the MP4 + Playwright pass; the staged file is dropped at
  that point.
- **Self-merge gates:** build + boot-smoke + `emberpath-pr-review`; `emberpath-art-
  review` only if placement/art shifts (U4 is collision-geometry, not art).

## Verification before PR
Debug-render check, behind-fade scenario, MP4 capture, editor save round-trip
Playwright pass, `bash autonomy/premerge.sh` clean.

## Origin
Issue #119 + Jaco msg #1092 (Jun 20). Supersedes this plan's prior verify-only
revision. Related: #118 (fade→cottage), Jaco #714 (tree/house behind), #153 (yard
widening), #346 (`collisionFootprint` base-only collision — the model U4 reuses),
#482 (homestead placement, untouched).
