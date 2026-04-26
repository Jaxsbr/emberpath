# Phase retrospective — world-legibility

**Metrics:** 14 logged tasks (4 investigate, 7 implement, 1 phase-complete, 2 review). 0 explicit fail entries. 1 mid-phase rework (US-59 task 7 shipped without the Old-Man-on-path tile, fixed in task 8) plus ~1 post-review rework off-log (operator-requested frame-pick verification swapped ~10 PROVISIONAL frame constants and reverted the tiny-dungeon FLOOR remap). Rework rate: ~14% (2 / 14 — counting the off-log frame-fix). Investigate ratio: 29% (4 / 14). **Health: Warning** on both axes — investigate ratio under the >40% server-phase target; rework rate over the <10% healthy threshold.

The investigate ratio is depressed by combined-investigate-then-implement tasks (US-59 and US-60 each shipped as a single implement with the investigation folded in), which is the npc-behavior pattern reused. The rework rate would be ~7% on the build-log alone, but the off-log frame-fix is the dominant story of the phase and counting it honestly puts the phase in Warning territory.

## Build-log failure classes

- `visual-pick-without-verification` — **PATTERN (twice-seen).** First-seen in `tileset` (frame indices for the original tile mapping picked from atlas thumbnails without runtime rendering, two reworks). Recurred here in two waves: (a) the initial PROVISIONAL frame picks in `ashen-isle.ts` and `fog-marsh.ts`'s `FRAME` constants and the `tilesets.ts` `tiny-dungeon` FLOOR remap (frames 36-39 picked as "wet floor" turned out to be wooden planks); (b) the post-review fix-up where ~10 frame constants were swapped after generating a labeled atlas grid (e.g. `FENCE 128` was a hammer, `DOOR 96` was a window, `STONES 116` was a wizard portrait, `REED 108/109` were character frames). The `tileset` retro explicitly flagged this as the recurrence trigger:

  > "If it recurs in a future visual-heavy phase (e.g., a sprite-swap or map-redesign), propose a compounding fix: add a phase-kickoff step for asset-heavy phases that requires rendering a labeled frame-index preview before picking indices, or ship a small `tools/editor/frames.html` viewer that displays any atlas with overlaid indices."

  **Compounding fix proposed below.**

- `partial-story-criterion` — first-seen. Task 7 shipped the US-59 Ashen Isle redesign with the Old Man at (40, 29) on a yard-interior FLOOR cell, even though the US-59 done-when explicitly required "on a path tile adjacent to a building door tile." Task 8 added a 5-tile yard-interior path and moved the Old Man to (39, 28). Caught by the Story Completion Gate before US-59 closed; cost was one extra task. Not yet a pattern.

## Review-sourced failure classes

The auto-review (posted via `gh pr comment` rather than `sabs:review-pr`, anticipating the npc-portraits inline-comment limitation) produced 4 concerns + 2 nits. The PR's GraphQL `reviewThreads` is empty (the auto-review went in as a body comment), so this section is sourced from the body summary on PR #16 and the build log's task 13 transcription.

- `visual-pick-without-verification` (concern #1) — **PATTERN (third source).** Same class as build-log; the auto-review flagged the PROVISIONAL picks before the operator requested the visual-verification follow-up. Triple-confirmed: the build-loop SAW the gap in its own review, but the path-of-least-resistance was to ship and defer to manual-verify. Counts under the same compounding fix.

- `cross-phase-baseline-drift` (concern #2) — first-seen. The `tilesets.ts` `tiny-dungeon` FLOOR remap from `[48-51]` to `[36-39]` would have changed the visual baseline of the `npc-portraits` Marsh Hermit dialogue — i.e. one phase's work silently invalidated a prior phase's manual-verify artefacts. Resolved during the post-review fix-up by reverting the FLOOR remap and achieving wet/dry contrast purely via the dry-path overlay. Adjacent to `cross-cutting-break` but distinct: the break is across-phases (visual baseline of a shipped feature) rather than across-modules within a phase.

- `silent-skip-without-warning` (concern #3) — first-seen. Editor `mapRenderer.ts` silently skipped decorations on areas using a tileset not present in `ATLAS_GRID`. Future areas using a third tileset would have lost decoration rendering in the editor with no console signal. Fixed inline during handle-pr-review (one-time `console.warn` per unknown tileset id, gated on `area.decorations.length > 0`).

- `wanderRadius-tuning-without-call-out` (concern #4) — first-seen. NPC `wanderRadius` reduced from 2 to 1 for both NPCs without a spec-level call-out. Deliberate (the new yards/stoop areas are smaller), but not flagged anywhere except the diff. Skipped per "revisit during play-testing" hedge.

- `helper-duplication` (nit #5) — first-seen. `rect/hline/vline/fencePerimeter/rectVariants` builder helpers duplicated between `ashen-isle.ts` and `fog-marsh.ts`. Acceptable for two consumers but flagged for future extraction.

- `schematic-row-mismatch` (nit #6) — first-seen. `ashen-isle.ts` row 37 is `W` (bottom-edge engine safety) but the schematic shows the path continuing south. Cosmetic.

## Tooling friction (process observation)

- `inline-comment-line-resolution` — twice-observed (npc-portraits + world-legibility), but did NOT recur in the failure mode this time. The npc-portraits retro flagged it; in this phase the build-loop pre-emptively posted as a body comment without attempting inline (task 13 description: "mirrors the npc-portraits flow where GitHub line resolution prevented inline comments"). Working around a known limitation rather than re-discovering it is good behaviour, but the workaround is hard-coded — `sabs:review-pr` itself was never invoked here. If the goal is inline-anchored review (which it should be for small focused PRs), the build-loop should be calling `sabs:review-pr` and letting it handle the fallback. **Not a compounding event** — but worth noting that the review-pr skill could compound a fallback path internally so the build-loop doesn't need to bypass it. Skill-level note for the future.

## Compounding fixes proposed

**1. `visual-pick-without-verification` → spec-author skill update + project tool**

   - **Workspace-level (allowlisted):** Update `${CLAUDE_PLUGIN_ROOT}/skills/spec-author/SKILL.md` Step 2b "Compounded done-when rules" with a new rule:

     > **Atlas frame-pick verification:** Any story that introduces or modifies tile / sprite atlas frame indices (entries in `TILESETS` registries, decoration `FRAME` constants, prop `spriteFrame` values) must include a done-when criterion requiring a labeled-atlas preview be generated and each frame visually verified before the commit lands. The verification artefact (labeled atlas PNG) need not be committed — only the verification step is gated. Rationale: `visual-pick-without-verification` in the `tileset` retro (frame-index swaps after first-pass picks) and again in the `world-legibility` retro (~10 frame constants swapped post-review when ~half the picks turned out to render as completely wrong concepts — DOOR was a window, FENCE was a hammer).

   - **Project-level (no allowlist needed):** Check in `tools/atlas-preview.py` (the labeled-atlas script that lives in `/tmp/` today) so the verification step has a one-line invocation: `python3 tools/atlas-preview.py assets/tilesets/<id>/tilemap.png /tmp/preview.png`. This makes the spec-author rule executable rather than aspirational.

   Cite: `tileset.retro.md` (first-seen, with explicit recurrence-trigger note); `world-legibility.retro.md` (this file — three sources: build-log mid-phase, build-log post-review fix-up, PR-review concern #1).

## Twice-seen summary

| Class | First-seen in | Second-seen in | Status |
|---|---|---|---|
| `visual-pick-without-verification` | tileset | world-legibility (×3 sources) | **PATTERN — compounding fix proposed** |
| `inline-comment-line-resolution` | npc-portraits | world-legibility (anticipated, not recurred) | Workaround in place; skill-level fallback worth considering if it actually recurs in inline mode |
| `partial-story-criterion` | world-legibility | — | First-seen |
| `cross-phase-baseline-drift` | world-legibility | — | First-seen (resolved inline) |
| `silent-skip-without-warning` | world-legibility | — | First-seen (resolved inline) |
| `helper-duplication` | world-legibility | — | First-seen (acceptable for now) |
| `schematic-row-mismatch` | world-legibility | — | First-seen (cosmetic) |
| `wanderRadius-tuning-without-call-out` | world-legibility | — | First-seen (deferred) |

## Notes for future phases

- The `tileset` retro's recurrence prediction was exactly right — same class, same pattern, same kind of rework. The fact that the build-loop's own auto-review caught concern #1 *before* the operator requested the follow-up is informative: the loop knows when frame picks are unverified, but ships them anyway because there's no gate to block. The proposed spec-author rule moves the gate from "post-merge manual-verify follow-up" to "pre-commit verification" so the loop's own quality bar is enforced.
- Builder-helper duplication between `ashen-isle.ts` and `fog-marsh.ts` is fine at two consumers; if a third area lands, extract to `src/data/areas/decorationHelpers.ts` (no engine code, pure data utility) at that point.
- The post-review off-log work — visual frame verification + tilesets.ts revert + vocabulary doc rewrite — was 4 commits worth of substantive work that didn't go through the build-loop's task structure (it was driven by the operator's "let it rip" + "proceed with follow-up now" prompts). The retro counts it as rework but the build-loop log doesn't reflect it. If the phase had been driven entirely through the build-loop, this work would have appeared as 4-5 additional tasks bringing total iterations to ~18-19. Either way the rework rate is in Warning territory; the spec-author fix above addresses the root cause.
