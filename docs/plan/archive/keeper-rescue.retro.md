# Phase retrospective — keeper-rescue

**Metrics:** 16 logged tasks, 10 investigate (62%), 4 implement, 1 docs, 1 phase-complete-gate, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 62%. Health: **healthy** (>40% investigate, <10% rework — server/schema/cross-cutting phase well within bounds).

The investigate-first mandate (cached server/schema/cross-cutting classification from task 1) was applied for every story — each implement was preceded by a paired investigate that produced a concrete diff plan. Fourth consecutive phase (after `world-legibility`, `save-resume`, `fog-marsh-dead-end`) with 0% build-loop rework using cached cross-cutting classification.

## Build-log failure classes

None. Every task in `log/keeper-rescue.yaml` recorded `result: pass`.

## Review-sourced failure classes

PR #19 is open with `review_stage: pr_created` at retro time — `[review] review-pr pr=19 auto=true` is queued but has not yet executed. No review threads to fetch.

## Post-build-loop / operator-test failure classes

One runtime regression surfaced when the operator manually exited Fog Marsh and re-entered after the Keeper rescue. Captured here because it's the honest delta between "Phase Completion Gate passed by source-read" and "verified by play":

- `scene-lifecycle-leak` — **pattern (second occurrence)**. On `scene.restart`, instance fields persist between runs while their referenced Phaser GameObjects are destroyed by the prior scene's shutdown. US-71's idempotency guard added to `spawnNpcSprite` (`if (npcSpritesById.has(id)) return null`) — necessary for the post-construction `evaluateConditionalSpawns` path — turned the original implicit cleanup (the previous `Map.set` overwrote stale entries each time `renderNpcs` ran) into a hard skip. Second-visit Fog Marsh: `renderNpcs` saw `npcSpritesById.has('marsh-hermit')` as true (stale entry from previous visit), skipped re-creation, then `NpcBehaviorSystem`'s constructor pulled the destroyed sprite from the map and crashed at the next tick when `stepRuntime` called `runtime.sprite.play(...)` (Phaser internal `anims` state gone). Operator caught it; fix landed in `2aa4750` — explicit reset of `this.npcEntities = []` + `this.npcSpritesById.clear()` at the top of `renderNpcs`. **Fix proposed** (twice-seen rule applies — first occurrence was npc-behavior PR #14: `this.anims.create()` re-firing on every `scene.restart` produced "animation key already exists" warnings, fixed with `anims.exists` guards).

## Compounding fixes proposed

- [docs/plan/LEARNINGS.md] Add Learning EP-02: Phaser scene.restart hygiene — instance-field reset for GameObject references. **Reason:** `scene-lifecycle-leak` second occurrence (npc-behavior PR #14 + keeper-rescue post-build-loop fix). The npc-behavior retro explicitly anticipated this exact second-occurrence pattern: "If another phase lands setup code that runs on every `scene.restart()` without checking whether it is idempotent, propose a compounding fix as a sub-pattern of Learning EP-01." This is that phase. Different sub-mechanism (Map of stale references vs. anims double-registration), same root pattern (scene.restart preserves instance fields, GameObject references go stale, naive idempotency guards block fresh re-creation). **Scope:** phaser-game. **Prevention point:** project-local LEARNINGS.md entry — read by spec-author and investigate-first iterations on phases that touch GameScene class-field state (sprites, tweens, timers, particle emitters).

## What worked

- **Investigate-first per story.** Every implement task (US-70, US-71, US-72, US-73) was preceded by its own investigate task that produced a specific diff plan with file paths, line numbers, edit shape, and ordering rationale. No implement landed without first knowing exactly what to write — and as a result, no implement failed verify or required a fix iteration. Fourth phase in a row with 0% build-loop rework using the cached cross-cutting classification.
- **Story-milestone commits.** Each of US-70 / US-71 / US-72 / US-73 produced its own `feat(US-XX)` story milestone commit after the Story Completion Gate confirmed all source criteria met. `git log --grep="^feat(US-"` shows exactly when each user story shipped without wading through `chore: progress` noise.
- **One shared mechanism, two consumers — applied in reverse.** US-72's `marsh_trapped: false` flip in the keeper-intro action node feeds the existing US-67/US-68 `onFlagChange('marsh_trapped')` subscriber unchanged: collision restores to FLOOR, conditional decorations flip to PATH, exit re-fires. US-73's path-re-opens criterion was source-true the moment US-72 shipped — no new mechanism, no new condition, no new decoration set. The "in reverse" framing came directly from the spec ("Path re-opens by undoing the trap"), and the build loop preserved it through implementation.
- **Spec drift reconciled at start, not at implement.** The spec-author refinement pass on `docs/product/phases/keeper-rescue.md` (operator-run before this phase started) reconciled four drifts against the shipped Phase 1: AND-only condition parser, heron assets-on-disk, additive `DialogueNode.setFlags` + `DialogueScript.endStoryScene`, generalised flag-change subscriber. The build loop carried the spec edit cleanly into the new branch and never re-encountered any of the four drifts during implementation.
- **One-shot guard folded into spawnCondition.** The phase-level "Keeper does not respawn after rescue" criterion was satisfied by extending the spawnCondition to a third clause `keeper_met == false` — author-choice option from the spec, simpler than tracking already-spawned NPC ids externally. The regex flag-name parser auto-subscribed to `keeper_met` so the exact-once spawn semantics fall out of the same generalised mechanism. **Pragma chosen:** declarative over imperative — fewer moving parts.
- **Loop-invariant audit baked into the implement.** The ember overlay's per-frame update path is a single conditional + single `setPosition` call with zero allocations — verified by `grep -nE "this.emberOverlay" src/scenes/GameScene.ts` showing only `setDepth`, `setPosition`, `destroy`, `?.ignore`, no `new` keywords or object literals inside the update branch. Learning EP-01 satisfied by construction.

## What to keep doing

- Single concern per iteration (the 4 implement commits + 1 docs reconciliation each landed as their own commit, separable for review).
- Cross-tagged criteria (e.g. `[US-71, phase]`, `[US-73, phase]`) flagged at story-completion time so the story milestone fires only when every tagged criterion is met — caught all such criteria during the Story Completion Gate.
- Re-using the previous phase's manual-verify shape rather than re-inventing one — fourth phase running the same scaffold (Setup → per-story scenarios → tampered-flag scenarios → 6-row variant grid → deploy smoke).
- Spec-author refinement pass before phase start, after the dependency phase ships — caught four real drifts that would have been failure-class material if the implementation had read the original spec literally.

## What to watch

- **`scene-lifecycle-leak` is now a confirmed pattern with a project-local learning attached.** Future phases that add new instance-field state holding Phaser GameObject references (sprites, tweens, particle emitters, timers) must reset those fields explicitly at the top of the corresponding `renderXxx` method — *especially* when the field is also touched by a post-construction code path (idempotency guards, runtime spawn, conditional re-render). The new Learning EP-02 documents the failure mode + the reset-at-top pattern.
- **Verify command vs. play.** `npx tsc --noEmit && npm run build` cannot exercise scene transitions. The runtime bug shipped through the Phase Completion Gate cleanly because every checked criterion was source-readable — but scene re-entry was not part of the gate's scope. The manual-verify doc (scenario 4) covers re-entry now, but the gate itself remains compile-only. Tracking via the existing `platform-testing-gap` class noted in foundation/mobile-ux retros — not promoting yet (this is a known limitation, not a new failure mode).
- **Two `[phase]` deploy criteria** (Deploy verification + Deploy smoke) ticked optimistically during the Phase Completion Gate per Learning #65 design. Track in `keeper-rescue-manual-verify.md` scenario 9; tick verifiably after the GitHub Pages deploy workflow completes on the squash-merge commit on `main`.
- **PR #19 review pending.** `[review] review-pr pr=19 auto=true` is queued for the next iterate run. Any concerns surfaced there will be folded into a `keeper-rescue.retro.md` addendum if they classify as new patterns or twice-seen recurrences.

## Twice-seen summary

| Class | First-seen in | Second-seen in | Status |
|---|---|---|---|
| `scene-lifecycle-leak` | npc-behavior (PR #14: anim re-registration warnings) | keeper-rescue (operator-test: npcSpritesById stale-ref crash on scene re-entry) | **Compounding fix proposed** — Learning EP-02 |
