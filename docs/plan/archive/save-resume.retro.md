## Phase retrospective — save-resume

**Metrics:** 19 tasks, 11 investigate (58%), 4 implement, 2 docs, 2 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 58%. Health: **healthy** (>40% investigate, <10% rework — server-class phase well within bounds).

**Build-log failure classes:**

None. Every task in `log/save-resume.yaml` recorded `result: pass`. The investigate-first mandate (cached server/schema/cross-cutting classification from task 1) was applied for every story — each implement was preceded by a paired investigate that produced a concrete diff plan, and no implement task subsequently failed verify, golden principles, or quality checks.

**Review-sourced failure classes:**

PR #17 (`build/save-resume`) attracted 1 self-review concern (auto self-review by the build-loop's `[review] review-pr` task; no human review prior to retro):

- `validation-off-by-one` — first-seen, PR review (1 finding: `src/scenes/TitleScene.ts:101` — Continue position-bounds check used `x > maxX || y > maxY` instead of `x >= maxX || y >= maxY`. The half-open interval `[0, mapCols * TILE_SIZE)` is what the underlying tile array actually covers; a tampered save with `x === maxX` slipped past the bounds step and reached the WALL-tile guard, where `dest.map[row]?.[mapCols]` returned `undefined` (not `WALL`) and validation passed. Player would have spawned on the outer-wall pixel boundary with every move attempt colliding. Fix applied in commit `2967cf5`. Closest taxonomy class is `missing-error-path` since the validation path existed but was imprecise on its boundary — opted for a new label `validation-off-by-one` to keep `missing-error-path` reserved for fully-absent paths.). Pattern not seen in prior retros (closest match in `area-system.retro.md` is `cross-cutting-break` for entry points on wall tiles, but that was a data-authoring error in area definitions, not a runtime input-validation precision issue). **First-seen — no compounding fix.** If a similar boundary-inequality precision concern surfaces again, propose a quality-check or completion-gate compounding fix (e.g. an "audit half-open vs closed interval comparisons in validation chains" check during the Phase Completion Gate).

**Compounding fixes proposed:**

None.

**What worked:**

- **Investigate-first per story.** Every implement task (US-62, US-63, US-64, US-65) was preceded by its own investigate task that produced a specific diff plan with file paths, line numbers, edit shape, and ordering rationale. No implement landed without first knowing exactly what to write — and as a result, no implement failed verify or required a fix iteration. This is the second consecutive phase (after world-legibility) with 0% rework using the cached cross-cutting classification.
- **Story-milestone commits.** Each of US-62 / US-63 / US-64 / US-65 produced its own `feat(US-XX)` story milestone commit after the Story Completion Gate confirmed all source criteria met. `git log --grep="^feat(US-"` now shows exactly when each user story shipped without wading through `chore: progress` noise.
- **Validation chain placed at the Title boundary, not the GameScene boundary.** The Continue handler's 4-step validation (loadSave non-null → getArea defined → bounds → non-WALL) lives in TitleScene before `scene.start`, so any failure path produces ONE responsive scene start (a fresh `GameScene` with no boot data). Putting validation in GameScene.create would have meant `scene.start → validation fail → scene.restart` — two scene starts visible to the player. The auto self-review's positive callout confirmed this design is durable.
- **Loop-invariant audit baked into the implement.** maybeAutosave's guard order (transitionInProgress → dialogue → throttle → delta) returns BEFORE any `JSON.stringify` or `localStorage.setItem`, satisfying Learning EP-01 by construction rather than by post-hoc verification. The relevant comment lives next to the constants declaration so future changes have to confront the invariant.
- **Manual-verify doc shape mirrors the prior phase.** `save-resume-manual-verify.md` follows the world-legibility precedent (Setup → Reads-as observer tests → per-area runtime checklist → mid-edge cases → reset mechanism → error paths → deploy smoke). The shared structure means Jaco can run the checklist with the same protocol for every phase that ships runtime/observer criteria.

**What to keep doing:**

- Single concern per iteration (the 4 implement commits + 2 doc commits in US-65 each landed as their own commit, separable for review).
- Cross-tagged criteria (e.g. `[US-63, US-64]`, `[US-64, US-65]`) flagged at story-completion time so they're not lost between two stories — caught all 4 such criteria during the Phase Completion Gate.
- Re-using the previous phase's manual-verify shape rather than re-inventing one — keeps Jaco's QA cadence consistent across phases.

**What to watch:**

- `validation-off-by-one` is now a known-but-not-yet-recurring class. If a second occurrence appears in any future phase (e.g. a half-open / closed interval mismatch in a different validation chain), promote it to a compounding fix at the quality-check or completion-gate level.
- Two `[phase]` deploy criteria (Deploy verification + Deploy smoke) deferred to post-merge per Learning #65 design. Track these in `save-resume-manual-verify.md` Deploy smoke section; tick after the GitHub Pages deploy workflow completes on `main`.
