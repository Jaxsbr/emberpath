## Phase retrospective — editor-ux

**Metrics:** 10 tasks, 4 investigate, 6 implement, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 40%. Health: Healthy.

**Build-log failure classes:**

No build-log failures. All 10 tasks passed on first attempt.

**Review-sourced failure classes:**

- `edit-policy-drift` — pattern (2 findings: (1) `lineStyle()` called inside per-child recursive loop with constant values — should be hoisted before the walk to avoid redundant state-set on every edge; (2) `if (isDragging && dragBoneName)` guard is misleading — `dragBoneName` is nulled unconditionally after the guard regardless of condition, making the condition dead. Both resolved in task 10. Prior occurrences: bone-chain retro — misleading rotation-propagation comment in `idle.ts` (first-seen); rig-editor retro — editor reused game `WalkRunController` without overriding behavioral params (first-seen). Editor-ux is the third occurrence.) **Fix proposed.**

**Compounding fixes proposed:**

- [spec-author gate] Add a checklist item to the spec-author's phase-review process: "scan implementation tasks for loop-invariant operations hoisted outside the loop, and for guard conditions that are redundant given surrounding logic." Reason: `edit-policy-drift` in bone-chain (misleading comment), rig-editor (reused component without behavioral override), and editor-ux (loop-body redundancy, dead guard). Three occurrences spanning three consecutive phases confirm this is a recurring pattern. Prevention point: (a) spec-author gate — embed awareness in the implementation brief so agents flag redundant patterns before code review. Target: `docs/plan/LEARNINGS.md`.
