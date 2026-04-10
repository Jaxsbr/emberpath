## Phase retrospective — area-system

**Metrics:** 17 tasks, 8 investigate, 6 implement, 1 gate, 2 review. 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 47%. Health: Healthy.

**Build-log failure classes:**
- None — all 17 tasks passed on first attempt.

**Review-sourced failure classes:**
- `cross-cutting-break` — pattern (3 findings: wall spawn on exit entry point targeting wall tile in another area's map, NPC_SIZE constant duplicated in 3 files after parameterization refactor, condition evaluation logic reimplemented in GameScene instead of extracting shared utility. Previous occurrences: foundation retro (`.gitignore` overwrite), interaction retro (dialogue double-fire, fix: Learning #69). Existing Learning #64 covers logic duplication scene→system; #69 covers input handler guards. Neither covers constants duplication during refactoring or cross-area data validation.) **Fix proposed.**

**Compounding fixes proposed:**
- [LEARNINGS.md] Add learning: When refactoring from global imports to parameterized architecture, audit for constants and logic that were previously shared implicitly via the global. Extract to a shared module — do not copy into each consumer. Cross-area data references (entry points, exit destinations) must land on valid tiles. Reason: `cross-cutting-break` in area-system PR review (3 findings: duplicated NPC_SIZE, duplicated evaluateCondition, entry point on wall tile) continuing pattern from foundation and interaction phases.

**Notes:**
- Zero rework continues the 4-phase streak (foundation, interaction, mobile-ux, area-system). The investigate-first pattern at 47% is in the healthy range.
- The 3 review findings all emerged from the US-15 parameterization refactor: converting from global imports to per-area data created opportunities for duplication and stale cross-references. The review caught all 3 before merge.
- Post-review operator testing surfaced 6 additional issues (thought bubble invisible on mobile, no dialogue continuation hint, crash on area transition, story text instant/too small, exit bounce-back). These were product-level fixes applied directly to the PR branch — the build loop's compile-only verify cannot catch rendering or UX issues, consistent with the `platform-testing-gap` class noted in foundation and mobile-ux retros.
