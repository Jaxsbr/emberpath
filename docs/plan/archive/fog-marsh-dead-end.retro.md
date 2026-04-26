## Phase retrospective — fog-marsh-dead-end

**Metrics:** 14 tasks, 8 investigate (57%), 4 implement, 1 docs, 1 phase-complete-gate, 1 review-scheduling, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 57%. Health: **healthy** (>40% investigate, <10% rework — server/schema/cross-cutting phase well within bounds).

**Build-log failure classes:**

None. Every task in `log/fog-marsh-dead-end.yaml` recorded `result: pass`. The investigate-first mandate (cached server/schema/cross-cutting classification from task 1) was applied for every story — each implement was preceded by a paired investigate that produced a concrete diff plan, and no implement task subsequently failed verify, golden principles, or quality checks. Third consecutive phase (after `world-legibility` and `save-resume`) with 0% rework using cached cross-cutting classification.

**Review-sourced failure classes:**

PR #18 is open with `review_stage: pr_created` at retro time — `review-pr` has not yet executed. No review threads to fetch.

**Compounding fixes proposed:**

None.

**What worked:**

- **Investigate-first per story, even with two stories collapsed.** Every implement (US-66, US-67, US-69) was preceded by its own investigate that produced a specific diff plan; US-68 was the exception — its investigate was folded into the implement task because the diff was small and tasks 1+5 had already read the relevant sources. The folding decision was explicit in task 7's notes ("small enough to fold investigate into the implement"), and US-68's implement still passed verify + golden principles + quality checks on first try. Folding is acceptable when prior tasks have already covered the unknowns.
- **One shared mechanism, two consumers.** US-67's flag-change subscriber API on `triggers/flags.ts` was designed up front (in task 5's investigate) to be reusable by US-68. The same `onFlagChange('marsh_trapped')` callback fires both `applyMarshTrappedState` (collision flip) and `updateConditionalDecorations` (PATH→EDGE swap), satisfying the explicit done-when criterion "one shared mechanism, not two" by construction. This kept the flag-change machinery to one notify path with one set of listeners — no separate decoration subscriber, no separate collision watcher.
- **Combined-tag criteria handled by deferred milestone commit.** Three of US-66/67/68's done-when criteria spanned multiple stories (`[US-66, US-67, US-68]`, `[US-66, US-68]`, `[US-67, US-68]`). The Story Completion Gate's "ALL tagged criteria" rule meant US-66's and US-67's milestone commits could not fire until US-68 also shipped — so the three milestones were batched into one `feat(US-66, US-67, US-68): complete ...` commit at the moment the last contributor landed. Cleaner than fighting the gate with partial ticks; the per-story implementation commits (`3199bb1`, `177e96f`, `1202f30`) still mark each story's actual delivery.
- **Spec-vs-source discrepancies caught during investigate, not implement.** Two minor spec inaccuracies surfaced during this phase: (1) the spec body wrote the AND combinator as `&&`, but `evaluateCondition` parses literal `AND`; (2) the spec claimed the south exit cells were "currently PATH_VARIANTS plank tiles", but the renderer actually picked the tiny-dungeon EXIT door frame for those cells. Both were caught by the investigate tasks (2 and 7) reading the actual source, recorded in their log entries, and corrected when authoring the implementation — neither produced a failure, neither required a rework cycle. Investigate-first is the right place to absorb spec drift.
- **Schema additions land additively.** Three optional fields were added this phase: `TriggerDefinition.setFlags?`, `TriggerDefinition.incrementFlags?`, `DecorationDefinition.condition?`. Each was placed alongside an existing similar field (`condition?` on TriggerDefinition, `DialogueChoice.setFlags`) so the authoring vocabulary stayed consistent. No existing trigger / decoration / exit needed to change to accommodate the new fields, and the `if (trigger.setFlags) {...}` no-op branch in `tryFire` is the regression guarantee for the variant baseline.
- **Manual-verify doc clarifies a non-obvious behaviour.** The escape-attempt band entry counting has a subtle "5th entry, not 4th" effect — the condition is evaluated BEFORE `incrementFlags` fires, so the 4th entry sees `escape_attempts < 4` and increments to 4; the 5th entry is the first to see `escape_attempts >= 4`. The manual-verify doc walks through this explicitly so a reviewer doesn't expect the despair thought on entry 4.

**What to keep doing:**

- Cached server/schema/cross-cutting classification from the phase-start investigate (task 1), applied to every implement decision. Explicit cite in subsequent investigate tasks ("per cached classification — investigate-first mandated") makes the decision auditable.
- Single concern per iteration where the boundary is clear (US-66, US-67, US-69 each got their own investigate+implement pair). Where the boundary collapses (US-68), name the collapse explicitly in the queue task description so the implement is auditable as covering the merged scope.
- Combined-tag criteria flagged at story-completion time and the milestone commit deferred until the last contributor lands — same pattern as save-resume's `[US-63, US-64]` cross-tags.
- Re-using the previous phase's manual-verify doc structure (Setup → per-story sections → tampered-flag scenarios → full-sequence walk → reads-as observer notes → deploy smoke) — third phase in a row using this shape.

**What to watch:**

- `validation-off-by-one` from save-resume's auto self-review remains first-seen. This phase introduced no new input-validation chains (the `condition?` evaluation is structural, not boundary-precision). Track for recurrence if a future phase adds validation logic with `<` / `<=` / `>` / `>=` comparisons against derived bounds.
- **Spec-body informal syntax vs parser syntax.** The `&&` vs `AND` discrepancy and the "PATH_VARIANTS plank tiles" inaccuracy were both first-seen this phase. Both were caught during investigate, neither produced a failure. If a third spec-body-vs-source discrepancy surfaces in a future phase that DOES cause a failure (e.g. an implement task copies the spec literally and fails verify), promote to a compounding fix — likely a quality-check on the spec-author skill that flags `&&` / `||` outside code blocks in done-when criteria, or a phase-start investigate prompt that explicitly compares spec syntax to parser syntax for any condition string.
- Two `[phase]` deploy criteria (Deploy verification + Deploy smoke) deferred to post-merge per Learning #65 design, ticked optimistically during the Phase Completion Gate. Track in `fog-marsh-dead-end-manual-verify.md` Deploy smoke section; tick verifiably after the GitHub Pages deploy workflow completes on the squash-merge commit on `main`.
- `keeper-rescue` is the next phase and has been spec-author'd already (`docs/product/phases/keeper-rescue.md`). It consumes the `marsh_trapped: true && escape_attempts >= 4` rescue scaffolding from this phase and reuses the conditional decorations + flag-change subscriber in reverse (re-opening the path). Worth re-running `/sabs:spec-author` on `keeper-rescue` before starting it, in case the actual implementation introduced drift the spec author should know about (specifically: the canonical AND combinator, the escape-attempt entry-vs-fire ordering, and the doors-vs-PATH-VARIANTS render layering).
