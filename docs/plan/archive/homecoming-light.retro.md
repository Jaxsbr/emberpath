## Phase retrospective — homecoming-light

**Metrics:** 20 logged tasks, 5 investigate (25%), 12 implement, 1 docs, 2 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 25% (5/20). Health: **Healthy** on rework, **Warning** on investigate ratio (server/cross-cutting phase target is >40%).

The low investigate ratio continues the npc-behavior / npc-portraits / world-legibility pattern: once the foundational systems were investigated (US-85 EmberShareSystem integration points), the downstream implement tasks (Wren/Driftwood asset placement, dialogue scripts, US-84 Old Man extension, US-86 trigger + cumulative-desat derived value, per-choice DialogueChoice.condition refactor) shipped without dedicated investigates because each was mechanical and fully informed by the foundation work. Twelve consecutive phases (foundation → homecoming-light) now close with zero build-log rework. Four of the last five server/cross-cutting phases have run at 25-32% investigate ratio with zero rework — the threshold target may be calibrated for a different style.

## Build-log failure classes

None. Twelve consecutive phases close with zero rework.

## Review-sourced failure classes

`cross-cutting-break` — **first-seen** in this specific manifestation (implicit callback-timing contracts in callback-coordinating handlers). 2 review concerns + 1 nit on PR #21:

- **Concern A** — `src/scenes/GameScene.ts` `setOnChoice`: `choice.setFlags` fires synchronously at choice-pick time while `choice.firePulseTarget` defers the warming flag flip and the dialogue advance to pulse-land (~600ms). Currently no choice mixes both, so no bug — but the asymmetry is implicit. A future "Share warmth + setFlags" choice would get pre-pulse setFlags fires, breaking the spec design that warming flags fire at pulse-land. **Fixed pre-merge** (commit f1bbe21) with a TIMING CONTRACT block comment at the top of the handler documenting the rule and the future `pulseSetFlags` extension path.
- **Concern B** — `src/scenes/GameScene.ts` `firePulseTarget` block: missing explicit `return;` after `this.emberShare.startPulse(...)`. Nothing follows the block today, so harmless — but a future code addition appended below would run mid-pulse before `onComplete` fires. **Fixed pre-merge** (same commit) with `return;` after `startPulse`.
- **Nit** — `src/systems/emberShare.ts` constructor: `scene.events.once('shutdown', ...)` registered with no matching `.off()`. Idempotent under current usage (each scene gets a new EmberShareSystem instance via `create()`; `once()` fires exactly once per scene lifecycle). **Skipped** per `auto=true` rules.

The `cross-cutting-break` taxonomy class has been compounded multiple times in prior retros (foundation, interaction, area-system → Learning #69, #70; character-rig → Learning #71). Each prior compounding produced a specific learning for that manifestation. The homecoming-light manifestation (implicit callback timing contracts in choice-orchestrating handlers) is new but the in-place fix (TIMING CONTRACT comment + `return`) is the canonical prevention point — the next author touching `GameScene.setOnChoice` reads the contract directly.

## Compounding fixes proposed

**None.** Both review concerns were fixed in-place with documentation that locks the contract for future authors at the exact spot the future modification would happen. A project-wide learning would duplicate guidance that's already inline at the call site.

The investigate-ratio warning is its 4th occurrence (npc-behavior, npc-portraits, world-legibility, homecoming-light). All four had zero build-log rework. Continuing to flag-and-watch rather than recalibrate — the metric still surfaces phases where the cadence is genuinely off, but the recurrent low-ratio-with-zero-rework signals the target threshold may be tuned for a stricter style than emberpath's spec-driven flow needs. If a future phase shows low investigate ratio + non-zero rework, recalibration becomes warranted.

## Notes

- PixelLab Pro mode at size=60 (anthropomorphic bipedal animals matching heron precedent) produced usable Wren and Driftwood characters on first generation — no re-rolls needed. Animation pipeline (breathing-idle + walking-4-frames templates) cost 1 generation per direction × 8 directions × 2 animations × 2 characters = 32 generations, plus 2 standard portraits = ~34 generations on top of the 40 character generations. Total spend ~80 generations on Jaco's personal pixellab account.
- The 8-concurrent-job cap on PixelLab forced a serialised animation pipeline. The build loop interleaved code work (US-85 foundation, warming subscribers, US-86 derived-value refactor) between asset batches so total wall-clock was bounded by the longest async path, not the sum.
- Reconciliation debt cleared this phase: keeper-rescue per-phase Status: planned→shipped + stories tagged [Shipped], fog-and-light same + added to PRD index (it had bypassed the build loop entirely). Worth flagging that any future phase started immediately after a "ad-hoc" merge to main needs the same reconciliation pass during `start`.
- The per-choice `DialogueChoice.condition` primitive (added during the spec-compliance refactor) is now a reusable mechanism — future NPCs with state-gated choices can use it without further extending the type system.
