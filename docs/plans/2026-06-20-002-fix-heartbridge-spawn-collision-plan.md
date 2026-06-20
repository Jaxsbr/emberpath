---
title: "fix: Pip stuck on top-row stone entering Heart Bridge from Briar"
type: fix
status: active
created: 2026-06-20
issue: 170 (FB-22)
area: bridge
---

# fix: Pip stuck on the top-row stone entering Heart Bridge from Briar (FB-22)

## Problem frame

On the **Briar Wilds → Heart Bridge** transition, Pip spawns into the Heart Bridge
map standing on the **top row of stone** and cannot move (confirmed by Jaco via
playtest, FB-22).

**Root cause (confirmed in code):** an area transition places the player at the
*source exit's* `entryPoint`, **not** at the destination area's `playerSpawn`
(`GameScene.transitionToArea` reads `exit.entryPoint` — `src/scenes/GameScene.ts`
~line 2424/2444). The Briar exit into the bridge still carries the **pre-FB-19
geometry**:

- `src/data/areas/briar-wilds.ts` — the `briar-to-heart-bridge` exit has
  `entryPoint: { col: 1, row: 2 }` (and a stale comment "Drops her at the bridge's
  west spawn (1,2)").
- In the current `src/data/areas/heart-bridge.ts` geometry, **row 2 is
  `DECK_TOP_PARAPET`** — an impassable `marsh-stone` parapet placed on *every*
  column. The walkable corridor is rows **3, 4, 5**; the bridge's own `playerSpawn`
  is correctly `{ col: 1, row: DECK_ROW_MID }` = **row 4**.

So the FB-19 redesign (Jaco #1052) tripled the span and moved the walkable rows
down, updating `playerSpawn` to row 4 — but the **Briar exit's `entryPoint` was
never updated**, leaving it pointing at what is now the top parapet stone. Pip is
dropped inside a colliding tile and the movement system blocks her first step.

This is why the existing `has-words-at-bridge` scenario does **not** catch it: that
scenario boots *directly* into the bridge at `playerSpawn` (1,4), bypassing the
exit's `entryPoint`. Only the real Briar→Bridge transition path is broken.

## Scope

**In scope**
- Correct the Briar→Heart-Bridge exit `entryPoint` so Pip lands on the walkable
  deck corridor and can move.
- Fix the accompanying stale comment so the "(1,2)" claim no longer misleads.
- Add a testbench scenario that exercises the **transition itself** (boots into
  Briar near the east mouth with the Word, walks onto the bridge), since no
  existing scenario does.

**Out of scope (Deferred to Follow-Up Work)**
- Making transitions fall back to the destination `playerSpawn` when an exit's
  `entryPoint` is invalid/colliding (a more general engine guard — see Risks). Worth
  a separate `type:chore` issue; not needed to fix FB-22.
- Auditing every other area's exit `entryPoint` against its current geometry. A
  quick scan is included as a verification step, but a full sweep is its own task.

## Key technical decision

**Fix the data (the exit `entryPoint`), not the engine.** The bug is a single stale
coordinate from a known geometry change, and the destination already declares the
right walkable row via `DECK_ROW_MID`. Point the entry at the deck mid-row (row 4),
matching `heart-bridge.ts` `playerSpawn`. An engine-level "validate/fallback
entryPoint" guard would also fix it but is broader, riskier, and belongs in its own
chore (deferred above). Keep `col: 1` (the west lip of the deck, identical to
`playerSpawn`).

---

## Implementation Units

### U1. Correct the Briar→Heart-Bridge exit entryPoint

**Goal:** Pip spawns on the walkable deck (row 4) when entering from Briar, and can
move immediately.

**Files:**
- `src/data/areas/briar-wilds.ts` (modify) — the `briar-to-heart-bridge` exit:
  `entryPoint: { col: 1, row: 2 }` → `{ col: 1, row: 4 }`. Update the stale inline
  comment ("Drops her at the bridge's west spawn (1,2)") to the correct row 4, and
  note that row 4 = the bridge's `DECK_ROW_MID` walkable corridor (rows 2 and 6 are
  the impassable parapets after FB-19).

**Approach:** One-coordinate data fix. Row 4 is the open walk path: the parapet
objects occupy rows 2 and 6 only; the blooming-bed clusters start at col 8 (rows 3
and 5); the King NPC is at col 70. So `(1, 4)` is provably clear of every placed
object at the west lip — identical to the already-correct `playerSpawn`. Keep the
`condition: 'has_word == true'` gate untouched.

**Patterns to follow:** Mirror `heart-bridge.ts` `playerSpawn: { col: 1, row: DECK_ROW_MID }`
(row 4) — the destination's own declared safe entry. Cross-reference the geometry
constants (`DECK_TOP_PARAPET = 2`, `DECK_ROW_MID = 4`) in the comment so a future
geometry change flags this entryPoint too.

**Test scenarios:**
- Covers FB-22. After the fix, entering the bridge from Briar lands Pip at row 4
  (a non-parapet, non-object cell) — she is not inside a `marsh-stone` collision box.
- Regression guard: the `has-words-at-bridge` scenario (direct boot to (1,4)) still
  works unchanged — `playerSpawn` is not touched.

**Verification:** In the testbench (U2 scenario), Pip is movable on the first input
after the transition; she can walk east along the deck. Confirmed on an MP4 capture
(motion → MP4 per the visual-share rule).

### U2. Add a Briar→Bridge transition testbench scenario

**Goal:** A version-controlled scenario that reproduces (pre-fix) and verifies
(post-fix) the *transition*, not just the bridge interior — the gap that let FB-22
ship.

**Files:**
- `src/scenarios/briar-to-bridge-transition.ts` (create) — boot into `briar-wilds`
  near the east mouth/closing clearing (e.g. on the lit corridor just west of the
  `briar-to-heart-bridge` exit at col 43, rows 10–12), with the Word carried so the
  exit is open. Flags: `has_ember_mark: true`, `has_word: true`,
  `briar_wilds_complete: true`, `ember_warmth: 1`, `ashen_intro_played: true` (intro
  flag so a headless boot skips cutscenes deterministically, per testbench doc).
  Position chosen so a short scripted "walk east" drives Pip through the exit trigger
  onto the bridge.
- `src/scenarios/registry.ts` (modify) — register the new scenario.

**Approach:** Model the file on `src/scenarios/has-words-at-bridge.ts` (same flag
set; differs only in `areaId: 'briar-wilds'` and a `position` near the east exit).
Pick the boot `position` by reading the Briar `SEGMENTS`/exit coords so the walk to
the exit is a straight short eastward leg requiring no serpentine navigation.

**Test scenarios:**
- Covers FB-22 end-to-end: boot scenario → drive Pip east → she crosses the exit →
  lands on the bridge at row 4 → continues moving east. No "stuck" state.
- The scenario boots deterministically headless (intro flag set), canvas renders,
  no console/page errors (boot-smoke parity).

**Test expectation:** behavioral via the headless testbench capture (this is a
scenario/data asset; its "test" is the harness run in Verification, not a unit test).

**Verification:** `?scenario=briar-to-bridge-transition` boots into Briar; scripted
eastward movement carries Pip through the transition and she walks onto the bridge
deck freely. Capture the full transition as an **MP4** (Briar east mouth → on the
bridge, moving) for the bug-fix demonstration to Jaco.

---

## Verification (whole fix)

1. `npm run build` green (`tsc --noEmit && vite build`) — types are the lint.
2. Boot-smoke green (built game boots headless, New Game + move, no console/page
   errors).
3. Testbench: run `?scenario=briar-to-bridge-transition` headless; script Pip east
   through the transition; confirm she lands on row 4 and **moves** on the bridge
   (no stuck-on-stone). Capture an **MP4** of the clean walk-on.
4. Quick scan: grep the other areas' `entryPoint`s against their destination
   geometry for any other stale pre-redesign coordinate (note findings; a full sweep
   is deferred follow-up, not this fix).

## Gates

- **Bug fix → skips GATE 1** (per ways-of-working tiering).
- The change is **data/behavioral, not art** (no sprites/tilesets/placement art
  change), so it **self-merges** after the automated gates (build · boot-smoke ·
  `emberpath-pr-review` APPROVE) once the transition is verified. Per Jaco's
  visual-share rule, still post the **MP4** of Pip walking on cleanly as the
  before/after demonstration.

## Implementation-time notes / unknowns

- Confirm exactly which Briar cell makes the cleanest scripted walk-to-exit at
  scenario-author time (read the live `briar-to-heart-bridge` exit rect: col 43,
  rows 10–12, `width 1, height 3`). The boot `position` should sit a few tiles west
  on the same band so "hold east" reaches the trigger.
- Confirm the testbench harness can script directional input long enough to cross
  the transition and record the post-transition movement in one MP4 (see
  `autonomy/playtest.md` / the record pattern). If a single capture can't span the
  fade, capture the on-bridge movement immediately post-transition as the proof.
