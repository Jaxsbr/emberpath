## Phase retrospective — sprite-animation

**Metrics:** 17 tasks, 9 investigate, 6 implement, 2 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 53% (9/17). Health: **Healthy**.

**Build-log failure classes:**

None — all 17 tasks passed on first attempt.

**Review-sourced failure classes:**

- `edit-policy-drift` — pattern (1 finding: `getVelocity()` returns direction pre-multiplied by PLAYER_SPEED, but the method name implies raw velocity — GameScene normalizes it back to a unit vector then re-multiplies by currentSpeed, so the PLAYER_SPEED factor cancels out. Math is correct, API contract is misleading. Deferred to future cleanup. Prior occurrences: bone-chain (misleading rotation comment), rig-editor (WalkRunController reuse without param override), editor-ux (loop-invariant ops, dead guard — compounding fix applied as Learning EP-01). EP-01 covers stale comments, loop-invariant ops, and dead guards, but not misleading method names. New sub-pattern.) **Fix proposed.**

**Compounding fixes proposed:**

- [LEARNINGS.md] Expand Learning EP-01 to add sub-pattern: "method/function names that imply a different return-type or contract than what the implementation provides." Reason: `edit-policy-drift` recurred in sprite-animation (`getVelocity()` misleading name) despite EP-01 covering three prior sub-patterns from bone-chain, rig-editor, and editor-ux. The root class continues to surface with new manifestations — broadening the checklist captures the general principle. Prevention point: (a) spec-author gate.

**Notes:**

- Zero rework extends the streak to 10 consecutive phases (foundation through sprite-animation). The build loop completed all 4 stories (US-42 through US-45) without a single failure.
- The investigate ratio (53%) is comfortably in the healthy range. The alternating investigate→implement pattern shows disciplined scoping.
- This phase marked the project's pivot from procedural rigging to PixelLab sprite sheets (96 pre-rendered PNGs). The AnimationSystem extraction from GameScene follows the golden principle of modular systems.
- The single review concern was minor — correct math with a misleading API name, not a functional defect.

---

*Retrospective completed: 2026-04-12*
