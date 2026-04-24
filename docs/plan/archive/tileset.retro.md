## Phase retrospective — tileset

**Metrics:** 24 tasks, 14 investigate (58%), 9 implement (38%), 1 review (4%), 0 explicit fail, ~2 rework (frame-index re-picks after visual feedback). Rework rate ~8%. Investigate ratio 58%. **Health: healthy** — investigate ratio strong, rework within threshold.

### Build-log failure classes

- `visual-pick-without-verification` — first-seen. Pattern: chose tileset frame indices (FLOOR/WALL/EXIT + ~30 prop frames) from atlas thumbnails without runtime rendering verification. Two reworks:
  1. Task 19 — `monochrome-rpg` WALL swap [51,52] → [34,35,36] and EXIT 39 → 17 failed to resolve floor/wall readability because the pack is fundamentally 1-bit line-art, not a frame-pick issue.
  2. Task 20 — whole-pack swap to `tiny-dungeon`, which actually fixed the underlying problem.
  First occurrence of this class in project history (prior retros don't show it — most phases were code/geometry, not visual asset selection).

### Review-sourced failure classes

- `spec-ambiguity` (retro-gate CI reminder) — pattern (twice-seen). Reviewer noted `retro_complete: false` blocking `retro-gate` on `rig-teardown` PR (first-seen, classified "by-design") and again on `tileset` PR. In both cases the reviewer is highlighting the intended workflow, not a defect. Still by-design — no compounding fix needed.
- `invariant-not-typed` — first-seen. `AreaDefinition.map: TileType[][]` accepted `TileType.EXIT` syntactically even though the constants.ts comment and renderer rely on EXIT never being stored in map data. Reviewer caught the gap; the fix (add `type StoredTile = FLOOR | WALL`, narrow `map: StoredTile[][]`) was trivial and compiler-enforces the invariant. No prior retro mentions a convention-only invariant that could have been typed.
- `scale-anticipation` — first-seen. Reviewer flagged sprite-per-tile scaling (~1900 sprites on Ashen Isle, rebuilt every `scene.restart`) as a future concern, explicitly "not for this PR". Not a failure, forward-looking architectural nudge — tracking as a first-seen pattern only.

### Compounding fixes proposed

None this phase. Decision log:

- `visual-pick-without-verification` (build-log): first-seen — no compounding fix yet. If it recurs in a future visual-heavy phase (e.g., a sprite-swap or map-redesign), propose a compounding fix: add a phase-kickoff step for asset-heavy phases that requires rendering a labeled frame-index preview before picking indices, or ship a small `tools/editor/frames.html` viewer that displays any atlas with overlaid indices.
- `spec-ambiguity` (retro-gate): twice-seen but by-design both times. The reviewer mentioning the retro gate is the system working correctly. No fix.
- `invariant-not-typed`: first-seen. If another convention-only invariant slips into a merge in a future phase without being caught until review, propose a compounding fix to the implementation checklist (AGENTS.md): "when adding a new enum value that is a sub-type (render-only, parse-only, etc.), consider whether the storing container's type can be narrowed to exclude it."
- `scale-anticipation`: first-seen. Purely forward-looking. Mark as planning input for the next map-heavy phase rather than a retro compounding fix.

### Twice-seen summary

| Class | First-seen in | Second-seen in | Status |
|---|---|---|---|
| `spec-ambiguity` (retro-gate reminder) | rig-teardown | tileset | Pattern confirmed by-design; no fix |
| `visual-pick-without-verification` | tileset | — | First-seen |
| `invariant-not-typed` | tileset | — | First-seen |
| `scale-anticipation` | tileset | — | First-seen |
