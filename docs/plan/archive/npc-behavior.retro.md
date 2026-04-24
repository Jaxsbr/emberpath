# Phase retrospective — npc-behavior

**Metrics:** 20 tasks, 5 investigate, 10 implement, 1 docs, 4 review/gate, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 25% (5/20). Health: **Healthy** on rework, **Warning** on investigate ratio (server/cross-cutting phase target is >40%).

The low investigate ratio reflects a change of style mid-phase: the first handful of iterations followed the strict investigate → implement cadence, but once the data model + registry + octant extraction were done, several implement cycles (NPC_SPEED constants, debug overlay circles, editor circles, AGENTS.md reconciliation) shipped without a queued investigate task because the next concern was mechanical and fully informed by the earlier audit. Zero rework suggests this was appropriate — but the metric would flag a server-phase deviation if this style became the default, so it's worth watching.

### Build-log failure classes

None. Eleven consecutive phases (foundation → npc-behavior) now close with zero rework.

### Review-sourced failure classes

PR #14 surfaced 2 concerns + 1 nit (no critical). Triage:

- `total-function-gap` — first-seen. `vectorToDirection(0, 0)` silently returned `'east'` because `Math.atan2(0, 0) === 0`. Callers from `npcBehavior.ts` (`enterDialogue`, aware-state facing update) could hit the zero vector on exact colocation. Fix landed: defensive early-return of `'south'` (project default facing). Not previously seen — this is the first phase where multiple consumers shared an octant function and could plausibly pass a zero vector through it.
- `scene-lifecycle-leak` — first-seen. `this.anims.create()` fires on every `scene.restart()`; Phaser's anim manager is global, so every area transition produced "animation key already exists" warnings for the ~48 registered keys (16 fox-pip + 32 NPC). Pre-existing for fox-pip but raised in volume when NPC animation registration landed in this phase. Fix landed: guard both loops with `this.anims.exists(key)`. Not previously seen.
- `nit` (skipped) — module-scope direction array + shuffle buffer in `npcBehavior.pickWanderStep`. Reviewer explicitly flagged as "not a change I would make now — flagging for the future." Not a failure class.

### Compounding fixes proposed

None this phase. Decision log:

- `total-function-gap` — first-seen. If a second phase ships a pure function that is undefined on a degenerate input and the gap is caught only in review, propose a compounding fix to `AGENTS.md`'s golden principles or to the spec-author gate: "Pure helper functions with a known degenerate input (zero vector, empty array, NaN time) must either return a defined fallback or document the precondition at the call sites." For now a single instance doesn't warrant a rule.
- `scene-lifecycle-leak` — first-seen. If another phase lands setup code that runs on every `scene.restart()` without checking whether it is idempotent, propose a compounding fix: add a sub-pattern to Learning EP-01 ("scene-lifecycle setup operations that are safe to run once but emit warnings/duplicates on re-invocation must be guarded idempotently"). EP-01 already covers loop-invariant setup; this is the scene-restart variant. One occurrence is not enough to expand the learning yet.

### Notes

- Zero rework extends the streak to 11 consecutive phases (foundation through npc-behavior).
- The behaviour system's state machine (idle/walk/aware/dialogue) shipped in one commit alongside the GameScene wire-up without rework, which reflects the thorough Branch B investigation at the start of the phase (NPC consumer map + octant audit + fox-pip preload-pattern trace before any code was written).
- The Phase Completion Gate marked all 72 done-when criteria met on the basis of structural + mechanism-proxy source verification. A handful of criteria that require human runtime observation (60-second unattended wander watches, observer reads-as notes, post-merge deploy workflow) were explicitly deferred to PR review smoke-testing and documented in the phase-complete log entry. This is the honest boundary of autonomous execution.
- Both PR concerns surfaced patterns (total-function-gap, scene-lifecycle-leak) the reviewer framed as "low priority / not blocking" but which were cheap to address — the fix landed in ~12 lines. Low-cost high-signal review feedback.

### Twice-seen summary

| Class | First-seen in | Second-seen in | Status |
|---|---|---|---|
| `total-function-gap` | npc-behavior | — | First-seen |
| `scene-lifecycle-leak` | npc-behavior | — | First-seen |
