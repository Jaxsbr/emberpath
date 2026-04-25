# Phase retrospective — npc-portraits

**Metrics:** 19 logged tasks, 6 investigate, 8 implement, 1 phase-complete, 4 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 32% (6/19). Health: **Healthy** on rework, **Warning** on investigate ratio (server/cross-cutting phase target is >40%).

The investigate ratio sits between the strict server-phase target (>40%) and the npc-behavior precedent (25%). Two stories with a tightly-coupled schema + render plan let the loop pre-clear several implement tasks during the early investigates, so the later UI-only iterations (AGENTS.md updates, manual-verify doc, editor sync) shipped without dedicated investigates. Zero rework suggests this was appropriate for a 2-story phase with clear interfaces, but the metric remains a flag if this style becomes the default for larger phases.

## Build-log failure classes

None. No fail or rework entries across all 19 task iterations.

## Review-sourced failure classes

The auto-review (sabs:review-pr, COMMENT mode) posted findings as a single body summary because GitHub returned `"Line could not be resolved"` on the inline comment attempt with `(commit_id, line)` from `headRefOid`. Two concerns and one nit were extracted from the body summary. Nits are filtered per the retro rules. Both concerns carry an explicit "open to leaving as-is" or "skip if you prefer" hedge from the review and were skipped during handle-pr-review.

- `error-fallback-relog` — first-seen. **Source:** pr-review (1 finding). When `applyPortrait()` resolves to a registered-but-broken portrait id (typo) or a registered id whose texture is missing, the error branch destroys the portrait and sets `currentPortraitId = null`. The next `showNode` with the same broken id fails the `id === currentPortraitId` early return (null vs broken-id), so the registry-miss / missing-texture path runs again and logs another `console.error` per node transition. Skipped per reviewer hedge — not a correctness bug; only fires during a typo-fix dev cycle. Could compound by storing the broken id (or a sentinel) instead of null after a failure, but no prior phase has seen this pattern.

- `transition-path-redundant-call` — first-seen. **Source:** pr-review (1 finding). On a node transition, `showNode` calls `redrawBox()` first (which calls `repositionPortrait` + `repositionSpeakerLabel` against the OLD portrait), then `applyPortrait()` (which may swap the texture and call the same two methods again). Result: the reposition pair runs twice on every node transition. Visually invisible (sync code; nothing renders between calls) but slightly wasteful. Skipped per reviewer hedge. Adjacent to `edit-policy-drift` / Learning EP-01 (loop-invariant ops) but EP-01's scope is "setup operations that run every loop iteration but only need to run once" — a node transition is not a per-frame loop, so this is a related-but-distinct sub-pattern.

## Tooling friction (process observation)

- `inline-comment-line-resolution` — first-seen, build-loop tooling. `sabs:review-pr` could not attach inline comments to lines 137 and 153 of `src/systems/dialogue.ts` despite both being `+`-additions in the diff and the `commit_id` matching `gh pr view --json headRefOid`. GitHub responded with `422 Line could not be resolved`. Falling back to a body-only summary review worked, but the inline-anchored UX is the goal. No prior retro mentions this. Tracking as a first-seen tooling observation; if it recurs, consider a compounding fix to `review-pr` SKILL.md to add a fallback (post body summary if inline attempt fails) or a pre-flight diff-line validation step.

## Compounding fixes proposed

None. Both concerns are first-seen and explicitly skippable per the reviewer's own hedges; the tooling friction is also first-seen.

## Notes for future phases

- Two-story phases with tightly-coupled schema + render planning can land in 19 iterations with zero rework. The build-loop's strict B-then-A round-trip pattern adds bookkeeping commits that doubled the iteration count for some implement tasks; the npc-behavior style of combining Branch B+A in one entry when investigation is pre-cleared (see tasks 12, 13, 14 in this phase log) was used here without rework cost.
- Manual-verify checklist (`docs/plan/npc-portraits-manual-verify.md`) is the durable artefact for visual + observer criteria — every "verified manually" criterion in phase-goal.md traces to a line in the checklist. This is the second phase using this pattern (after tileset).
- Per-asset texture filter on the registry (rather than at the consumer site) is the right shape — consumers (GameScene, DialogueSystem) read `filter` from the registry without per-asset branching. Worth applying to future asset-importing phases that mix aesthetic conventions (pixel-art vs painterly).
