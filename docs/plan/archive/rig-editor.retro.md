## Phase retrospective — rig-editor

**Metrics:** 13 tasks, 4 investigate, 4 implement, 2 structural, 3 review, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 40% (build tasks only). Health: healthy.

**Build-log failure classes:**

No build-log failures. All 13 tasks passed on first attempt.

**Review-sourced failure classes:**

- 2 Concern findings (0 Critical). Both are design trade-off observations for future awareness, not defects:
  - Module-level singleton mutable state in rigRenderer.ts — acceptable for dev tool
  - Bounding-box hit detection with depth priority — hierarchy panel provides alternative selection

**Post-review operator-reported bugs (fixed before retro):**

- `cross-cutting-break` — pattern (direction state lost when switching animation mode; `startAnimation` → `stopAnimation` → `createRig` reset direction to S). Fixed by re-applying `currentDirection` after rig recreation. Previously seen in foundation, interaction, area-system, character-rig. Existing Learning #71 covers animation state reset on mode transitions.
- `edit-policy-drift` — first-seen (walk animation auto-transitioned to run after 0.8s because editor reused game WalkRunController without overriding `walkToRunDelay`; game behavior inappropriate for editor preview context). Fixed by overriding params: walk=Infinity delay, run=0 delay.

**Compounding fixes proposed:**

None. The `cross-cutting-break` pattern already has Learning #71 as a compounding fix. The `edit-policy-drift` is first-seen — logged for tracking. If seen again in a future phase, a compounding fix will be proposed (e.g., spec-author checklist item: "when reusing game runtime components in dev tools, enumerate behavioral assumptions that need overriding").
