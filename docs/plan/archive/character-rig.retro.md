## Phase retrospective — character-rig

**Metrics:** 14 tasks, 5 investigate, 6 implement, 1 gate, 2 review. 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 36%. Health: Warning (investigate ratio below 40%).

**Build-log failure classes:**
- None — all 14 tasks passed on first attempt.

**Review-sourced failure classes:**
- `cross-cutting-break` — pattern (2 findings: ear flick progress fields not reset when movement resumes, causing mid-animation jump; state ordering dependency between speed capture and isRunning reset, requiring comment to prevent future reorder breakage. Both fixed. Prior occurrences: foundation retro (`.gitignore` overwrite), interaction retro (input handler double-fire, fix: Learning #69), area-system retro (constant duplication after refactor, fix: Learning #70). New manifestation: animation controller internal state leaks between modes.) **Fix proposed.**
- `silent-test-pass` — first-seen (1 finding: missing direction profile entries silently hidden via `setVisible(false)` — bone name typos invisible at runtime, compile-only verify cannot catch. Skipped as POC scope.)

**Compounding fixes proposed:**
- [LEARNINGS.md] Add learning: Animation controllers with internal state (timers, progress counters, flags) must reset ALL fields when transitioning between modes (e.g., idle → moving). Incomplete resets cause visual glitches (mid-animation jumps) that compile-only verify cannot catch. Spec done-when criteria for stateful controllers should include "all internal state fields reset on mode exit." Reason: `cross-cutting-break` in character-rig PR review (ear flick state leak, state ordering fragility) continuing pattern from foundation, interaction (#69), and area-system (#70) — existing learnings cover input handler guards and refactoring duplication but not animation state machine transitions. **Scope:** phaser-game. Prevention point: spec-author gate.

**Notes:**
- Zero rework continues the 6-phase streak (foundation, interaction, mobile-ux, area-system, story-visualizer, character-rig). The build loop completed all 5 stories (US-23 through US-27) without a single failure or rework task.
- The investigate ratio (36%) is slightly below the 40% healthy threshold. This reflects the phase's clean implementation — each story needed only one investigate + one implement cycle, with no ambiguity-driven re-investigation. The low ratio is a symptom of efficiency, not insufficient investigation.
- Both review concerns were genuine state-management issues in the animation controllers. The ear flick state leak (6 of 8 fields reset, 2 missed) is a classic incomplete-reset bug that only manifests visually — no type error, no runtime exception, just a subtle animation jump. This class of bug is invisible to `tsc --noEmit && vite build` verification.
- Post-phase operator refinement added eyes/nose (eye squint states), feet/paws/toes (24 new parts with per-direction toe splay), depth ordering fix (Container.sort('depth')), foot-to-leg animation propagation, and anatomical joints (neck/shoulders/hips). These were product-level iterations applied directly to the PR branch after formal phase completion — not build-loop failures.
