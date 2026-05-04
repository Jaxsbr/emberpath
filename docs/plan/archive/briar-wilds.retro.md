# Phase retrospective — briar-wilds

**Status note:** This retro runs against the in-progress phase (`phase_complete: false` at retro time — operator manual-verify smoke is the remaining gate). Build-log-only analysis; no PR exists yet, so Step 1.5 (review-pattern extraction) is skipped.

## Metrics

14 logged tasks. 2 investigate (T1, T7), 11 implement, 1 fix (T9, operator-caught conditional-decoration subscriber gap). 0 failed builds, 0 spec-misread reworks.

- **Rework rate:** 7.1% (1/14 — T9 counted as rework against T8). **Healthy** (<10%).
- **Investigate ratio:** 14.3% (2/14). **Warning** by the strict server-phase threshold (<40%), but the two investigates were front-loaded comprehensive surveys (T1: full lighting/flag/system landscape; T7: ashen-isle east-edge + briar-wilds skeleton coordinates + PixelLab task split) — many subsequent implements were contained calibration / wiring work where re-investigating would have been noise. Same shape as `tile-architecture` (15% ratio, "one consolidated inventory rather than per-story") and the same tradeoff is acceptable here.
- **Health:** Healthy overall.

## Build-log failure classes

- **`pattern-incomplete-extension`** — first-seen (task 9: operator caught that conditional brambles I added with `condition: 'has_ember_mark == false'` did NOT hide on the same frame the Ember was granted; root cause was that `GameScene` had general `subscribeToConditionalObjects` and `subscribeToConditionalTerrain` flag-change subscribers but NO equivalent `subscribeToConditionalDecorations`. The original `marsh_trapped` decoration re-eval was a hand-rolled per-flag subscriber inside fog-marsh's specific block — when objects + terrain were generalized to flag-name-extracting subscribers during tile-architecture, the parallel decoration generalization was missed. Latent for one phase; surfaced when US-100's bramble use case was the first mid-area decoration-condition flip on a flag other than `marsh_trapped`).

  The class signature: a hand-rolled mechanism for one specific use case is later generalized for some sibling concerns (objects, terrain) but not all (decorations). The original specific case keeps working; the gap surfaces only when a second use case touches the unconverted sibling.

  **First-seen — no compounding fix.** Track for recurrence: if a future phase ships a "Object/Decoration/Terrain X works for [some case] but breaks for [another case]" bug where the cause is the same asymmetric-generalization shape, propose a compounding fix at the spec-author or quality-check level (e.g., a phase-completion check that asserts every entity type with a `condition` field has a matching general flag-change subscriber wired in `GameScene.create`).

## Operator-driven calibration (not a failure class — note for future phases)

US-99 had two operator-driven calibration cycles:
1. T2: shipped `npcWarmedRadius=96` / `npcWarmedIntensity=0.65` (2.4× / 2.6× base — well above spec floor).
2. T3: operator asked for "more x3"; bumped to `288` / `1.0` (clamped at max).

The spec explicitly framed US-99 as "operator-calibrated against the in-engine smoke" so iteration is in scope, not rework. But two cycles within a single feature is borderline — worth tracking. If a future visual-tuning phase needs three or more cycles, that's signal for a different prevention point (spec-time visual mockup or a dev-only slider rather than code-edit-and-rebuild iteration).

## Strengths

- **Front-loaded investigation paid off.** T1 covered the entire phase's structural unknowns in one comprehensive survey; T7 paid the same dividend for the area + PixelLab plan. Subsequent implements landed on first try.
- **Operator-caught decoration bug → root-cause fix in one iteration.** T9 wasn't "patch the symptom" (re-evaluate visibility for has_ember_mark specifically); it was "add the missing general subscriber and unsubscribe path that mirrors the object/terrain pattern." Fixed the underlying gap, not just the surface.
- **PixelLab generation strategy worked.** 4 calls fired in parallel against `mcp__pixellab__` (personal — Learning EP-05 honoured); none failed; tileset Wang mask layout matched the existing `pixellabCornerMaskTable()` so no new mapping helper was needed.
- **Visual-pick-without-verification (Learning EP-03) handled honestly.** PixelLab tileset returned redder than the "no red" negative prompt intended; surfaced to operator with three options before committing rather than shipping silently. Operator picked "accept" with explicit rationale (warm-sienna at 4× zoom fits the uneasy/oppressive vibe).
- **One-concern-per-iteration discipline mostly held.** The seven feat commits (US-99 absolute values, US-99 calibration bump, US-101 foundation, US-101 visual binding, US-101 zone consumption, US-100 skeleton, US-100 decoration-fix, US-103 tier-2 lights, US-102/103 F3 rectangles, T12 PixelLab wiring) each landed a single concern with a tight commit message and verify green between commits.

## Compounding fixes proposed

**No compounding fixes this phase.** Single failure class, first-seen. Track `pattern-incomplete-extension` for recurrence in future phases that introduce or extend a generalized subscriber/registry mechanism.

## Remaining work

- Operator manual-verify smoke per `docs/plan/briar-wilds-manual-verify.md` (sections US-99..US-103 + reset-progress-clears-everything).
- After smoke confirms zero blockers: set `phase_complete: true` in `progress.yaml`. Phase Completion Gate runs (done-when audit + AGENTS consistency + error-path spot check). Loop opens PR + auto review-pr + handle-pr-review.
