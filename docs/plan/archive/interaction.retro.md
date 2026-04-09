## Phase retrospective — interaction

**Metrics:** 20 tasks, 8 investigate, 8 implement, 1 gate, 3 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 40%. Health: healthy.

**Build-log failure classes:**
- None — all 20 tasks passed on first attempt.

**Review-sourced failure classes:**
- `cross-cutting-break` — pattern (1 critical finding: dialogue choice double-fire — `pointerdown` on choice text in DialogueSystem fired `selectChoice()`, then scene-level `pointerup` fired `handleAdvance()` on the same tap, completing the next node's typewriter instantly. Two input systems registered handlers on the same scene input without coordinating event consumption. Fixed with `choiceJustSelected` guard flag. First seen in foundation phase retro: scaffolding task overwrote `.gitignore` security patterns.) **Fix proposed.**

**Compounding fixes proposed:**
- [LEARNINGS.md] Add learning #69: Phaser scene-level input handlers (`pointerdown`/`pointerup`) registered by multiple systems fire independently on the same event — systems that consume an event must set a guard flag to prevent downstream handlers from acting on the same gesture. Prevention point: build-time awareness. Reason: `cross-cutting-break` in foundation (`.gitignore` overwrite) and interaction (dialogue choice double-fire).

**Notes:**
- Zero rework and zero failures across 20 tasks indicates the investigate-first pattern and systems-based architecture are working well for this project.
- The cross-cutting-break in the review was an input event coordination issue specific to Phaser's event model — multiple handlers on the same scene input object fire independently with no built-in propagation control. This is a recurring pattern when multiple game systems register their own input handlers.
- Post-review operator testing identified two additional issues (dialogue restart on close, mobile UX scaling) that were fixed or captured in `docs/product/mobile-ux.md`. These are product feedback, not build-system failures.
