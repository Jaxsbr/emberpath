# Phase retrospective — npc-behavior

**Metrics:** 20 logged tasks, 5 investigate, 10 implement, 1 docs, 4 review/gate, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 25% (5/20). Health: **Healthy** on rework, **Warning** on investigate ratio (server/cross-cutting phase target is >40%).

The low investigate ratio reflects a change of style mid-phase: the first handful of iterations followed the strict investigate → implement cadence, but once the data model + registry + octant extraction were done, several implement cycles (NPC_SPEED constants, debug overlay circles, editor circles, AGENTS.md reconciliation) shipped without a queued investigate task because the next concern was mechanical and fully informed by the earlier audit. Zero rework suggests this was appropriate — but the metric would flag a server-phase deviation if this style became the default, so it's worth watching.

### Build-log failure classes

None. Eleven consecutive phases (foundation → npc-behavior) now close with zero rework.

### Review-sourced failure classes

PR #14 surfaced 2 concerns + 1 nit (no critical). Triage:

- `total-function-gap` — first-seen. `vectorToDirection(0, 0)` silently returned `'east'` because `Math.atan2(0, 0) === 0`. Callers from `npcBehavior.ts` (`enterDialogue`, aware-state facing update) could hit the zero vector on exact colocation. Fix landed: defensive early-return of `'south'` (project default facing).
- `scene-lifecycle-leak` — first-seen. `this.anims.create()` fires on every `scene.restart()`; Phaser's anim manager is global, so every area transition produced "animation key already exists" warnings for the ~48 registered keys (16 fox-pip + 32 NPC). Pre-existing for fox-pip but raised in volume when NPC animation registration landed in this phase. Fix landed: guard both loops with `this.anims.exists(key)`.
- `nit` (skipped) — module-scope direction array + shuffle buffer in `npcBehavior.pickWanderStep`. Reviewer explicitly flagged as "not a change I would make now — flagging for the future." Not a failure class.

### Post-review smoke-test failure classes

Operator caught three issues during manual smoke-testing of PR #14 that the autonomous loop and the structural review both missed. Captured here because they're the honest delta between "verified by source read" and "verified by play".

- `asset-source-mislabel` — first-seen. The Old Man's idle and walk asset directories had each other's frames — PixelLab's output was mislabelled at the staging path (`/Users/jacobusbrink/Jaxs/assets/emberpath/npc/old-man/`) and the `cp -R` faithfully reproduced that mismatch in the repo. Marsh Hermit was correct, so the registry / preload / animation-key code paths all worked — the bug lived purely in the file content. Caught only by running the game and seeing the wrong cycle play during movement. Fix landed: swap `assets/npc/old-man/{idle,walk}/` directory contents in the repo. Staging path was flagged but not modified (out of project scope).
- `atlas-bleed-asset-not-code` — first-seen, but a legacy of the tileset phase exposed in this one. Packed Kenney atlases (no margin / no edge extrusion) produce 1px tile-seam artefacts under fractional camera zoom or fractional camera scroll. First user report (static seams) was resolved by snapping `calculateZoom()` to `Math.floor`. Second report (diagonal-movement flashes) the right fix is asset-side — re-export the atlases with 1px edge extrusion (e.g. `tile-extruder` npm package) and update the `load.spritesheet` margin/spacing config. Recommended a separate "asset hygiene" PR rather than further code-side patching.
- `speculative-fix-without-repro` — first-seen. Attempted a code-side fix for the diagonal-movement seams (`roundPixels: true` in the Phaser config + `cam.setRoundPixels(true)`) without first reproducing the failure mode locally and without anticipating that rounding camera scroll on a smoothly-moving float-position player produces a 1-frame snap-back stutter. The "fix" introduced player jitter and a persistent vertical seam on map load — operator caught it, asked for a revert, and trust took a small hit. The class signature: a runtime visual/timing bug fixed by changing render config without a local repro of the original symptom and without explicitly enumerating the new render invariants the change might break.

### Compounding fixes proposed

None this phase. Decision log:

- `total-function-gap` — first-seen. If a second phase ships a pure function that is undefined on a degenerate input and the gap is caught only in review, propose a compounding fix to the spec-author gate: "Pure helper functions with a known degenerate input (zero vector, empty array, NaN time) must either return a defined fallback or document the precondition at the call sites."
- `scene-lifecycle-leak` — first-seen. If another phase lands setup code that runs on every `scene.restart()` without checking whether it is idempotent, propose a compounding fix as a sub-pattern of Learning EP-01 ("scene-lifecycle setup operations that are safe to run once but emit warnings/duplicates on re-invocation must be guarded idempotently"). EP-01 already covers loop-invariant setup; this is the scene-restart variant.
- `asset-source-mislabel` — first-seen. If a second asset-import phase ships content that doesn't match its directory labels and the mismatch is caught only in play, propose a compounding fix to the build-loop's asset-staging investigate template: "After `cp -R` of a labeled asset tree, spot-check at least one frame per top-level category (idle/walk/static) by visual inspection or filename-vs-content sanity check."
- `atlas-bleed-asset-not-code` — first-seen, but the underlying root cause has now been documented: packed atlases without margin / edge extrusion will produce sub-pixel seams on any non-trivial camera setup. If a future visual-asset phase imports a packed atlas without confirming it has been extruded, propose a compounding fix to the tileset/asset-import phase template: "Verify packed-atlas source has at least 1px transparent margin or edge extrusion. If not, run `tile-extruder` (or equivalent) before bundling."
- `speculative-fix-without-repro` — first-seen. If a second post-review fix introduces a regression because the change was not locally reproduced first, propose a compounding fix as a new entry in `docs/plan/LEARNINGS.md` (project-local): "Render-config / camera / input-handling fixes for runtime visual or timing bugs require either (a) a local repro of the original symptom + a verification pass that the fix doesn't introduce a new render invariant violation, or (b) explicit acknowledgement of the trade-off in the commit message + an offer to bundle as a small standalone PR rather than the active branch."

### Notes

- Zero rework on the core phase; the post-review smoke-test surfaced three patterns. The autonomous loop legitimately closed with `phase_complete: true` on structural + mechanism-proxy verification — these issues are *exactly* the kind that the Phase Completion Gate explicitly defers to PR-review smoke-testing. The system worked as designed.
- The behaviour system's state machine (idle/walk/aware/dialogue) shipped in one commit alongside the GameScene wire-up without rework, which reflects the thorough Branch B investigation at the start of the phase (NPC consumer map + octant audit + fox-pip preload-pattern trace before any code was written).
- Both PR concerns (`total-function-gap`, `scene-lifecycle-leak`) were low-cost high-signal review feedback — fix landed in ~12 lines.
- The `speculative-fix-without-repro` incident is the most actionable lesson of the phase. Honest read: the operator's previous 11 zero-rework phases set an implicit expectation of "agent ships code; operator checks PR; nothing breaks". The roundPixels attempt broke that pattern by guessing at a Phaser-specific interaction (camera scroll vs. sprite snap) without first verifying the diagonal-seam bug locally or running through a "what could this break?" pass. If this recurs, it goes to LEARNINGS.md as a discipline rule.

### Twice-seen summary

| Class | First-seen in | Second-seen in | Status |
|---|---|---|---|
| `total-function-gap` | npc-behavior | — | First-seen |
| `scene-lifecycle-leak` | npc-behavior | — | First-seen |
| `asset-source-mislabel` | npc-behavior | — | First-seen |
| `atlas-bleed-asset-not-code` | npc-behavior | — | First-seen (latent in tileset phase) |
| `speculative-fix-without-repro` | npc-behavior | — | First-seen |
