# Phase: bone-chain

Status: Shipped

## Summary

Convert the rig engine (`CharacterRig`, `BoneDefinition`, animation controller contract) from flat absolute positioning to parent-relative hierarchical transforms using manual tree-walk position resolution — no Phaser nested Containers. Each bone's profile coordinates become relative to its parent bone. `CharacterRig.update()` resolves world positions via depth-first tree walk each frame. Animation controllers gain automatic propagation (body bob moves all descendants) without manual per-bone duplication. The editor displays and edits parent-relative coordinates, with visual hierarchy following automatically.

**Approach:** Option C from Sage RES-7 research — parent-relative profiles + manual tree-walk resolver. Avoids Phaser nested Container overhead and version-stability risk. `inheritScale` and `inheritRotation` default to `false` (opt-in per bone). Migration preserves current absolute positions exactly via automated conversion.

## Stories

### US-32 — Parent-relative coordinate model in CharacterRig

As a rig system consumer, I want bone positions resolved through a parent-relative hierarchy, so that moving a parent bone automatically moves all descendants without manual propagation.

**Acceptance criteria:**
- `BoneDefinition` includes `inheritScale` and `inheritRotation` boolean fields, both defaulting to `false`
- `CharacterRig.update()` resolves world positions via depth-first tree walk: world position = parent world position + local profile offset + local state offset
- When `inheritRotation` is `true`, local offset is rotated around parent's pivot by parent's world rotation
- When `inheritScale` is `true`, local offset and sprite scale are multiplied by parent's world scale
- `setDirection()` uses the same tree-walk resolution (shared with `update()`, not a separate implementation)
- Sprites remain flat siblings in the root Phaser Container — no nested Containers introduced
- Fox renders identically to pre-change state with migrated profiles

**User guidance:** N/A — internal engine change, no player-facing behavior change.

**Design rationale:** Manual tree-walk over nested Phaser Containers avoids documented per-frame tree traversal overhead in Phaser 3.80 and removes dependency on Phaser's historically unstable Container nesting support. The rig already knows the bone hierarchy; it simply doesn't use it for positioning yet.

### US-33 — Profile migration tooling

As a rig author, I want an automated tool to convert absolute profile coordinates to parent-relative coordinates, so that existing rig definitions work with the new coordinate model without manual recalculation.

**Acceptance criteria:**
- A migration script or editor feature converts absolute profiles to parent-relative
- Migration walks the bone hierarchy per direction, subtracting parent absolute position to derive local offset
- All 5 unique direction profiles are converted (mirrored directions are derived, not migrated separately)
- After migration, the fox renders at identical screen positions as before for all 8 directions

**User guidance:** N/A — developer tooling for rig authoring.

**Design rationale:** Automated conversion over manual re-authoring — preserves current positions exactly. Re-authoring can happen incrementally in the editor after the system is in place. Conflating migration correctness with artistic quality would make the migration unverifiable.

### US-34 — Animation controller cleanup

As a rig system maintainer, I want animation controllers to set deltas on parent bones only and trust the tree walk to propagate, so that controllers are simpler and adding new body parts doesn't require updating every controller.

**Acceptance criteria:**
- `walkRun.ts` body bob applied only to `body` — manual propagation to neck, head, shoulders removed
- `idle.ts` sit-down applied only to `body` and `hips` — manual propagation to shoulders, neck, head, foot parts removed
- `idle.ts` head turn applied only to `neck` — manual propagation to head and snout removed
- Walk/run and idle animations remain functionally correct after cleanup
- `BoneState` interface is unchanged — controllers still write local deltas in the same format
- Net line count of both controllers decreases

**User guidance:** N/A — internal refactor, no player-facing behavior change.

**Design rationale:** The tree walk makes manual propagation redundant. Removing it first (after the tree walk is in place) and then re-tuning amplitudes if needed is safer than trying to rewrite controllers and change the coordinate model simultaneously.

### US-35 — Editor chain-aware editing

As a rig author, I want the editor to display and edit parent-relative coordinates with visual hierarchy, so that positioning body parts is intuitive and moving a parent visually moves all children.

**Acceptance criteria:**
- Property panel shows parent-relative coordinates for the selected part
- Editing a parent bone's offset updates visual positions of all descendants in the preview
- Save JSON exports parent-relative profile data
- Load JSON imports parent-relative profile data
- Export TS outputs parent-relative data compatible with `rig/characters/fox.ts` format
- Both game and editor type-check and build cleanly

**User guidance:** N/A — developer tool, not player-facing.

**Design rationale:** The editor's embedded Phaser scene already renders the actual CharacterRig (which now does the tree walk), so visual hierarchy follows automatically. The property panel needs to show local coordinates matching the data model, not world-space coordinates.

## Done-when (observable)

### US-32 — Parent-relative coordinate model

- [x] `BoneDefinition` in `rig/types.ts` includes `inheritScale: boolean` and `inheritRotation: boolean` fields, both defaulting to `false` [US-32]
- [x] `CharacterRig.update()` resolves world positions via depth-first tree walk of the bone hierarchy: each bone's world position = parent world position + local profile offset + local state offset [US-32]
- [x] When `inheritRotation` is `true` on a bone, the local offset is rotated around the parent's pivot by the parent's world rotation [US-32]
- [x] When `inheritScale` is `true` on a bone, the local offset and sprite scale are multiplied by the parent's world scale [US-32]
- [x] `setDirection()` resolves world positions from parent-relative profile data using the same tree-walk logic (not a separate flat loop) [US-32]
- [x] Sprites remain flat siblings in the root Phaser Container — no nested Containers are introduced [US-32]
- [x] `npx tsc --noEmit && npm run build` passes with zero errors [US-32]
- [x] Fox renders identically to pre-change state when using migrated parent-relative profiles (visual equivalence — same sprite positions on screen for all 5 direction profiles + 3 mirrored) [US-32]

### US-33 — Profile migration tooling

- [x] A migration script or editor feature exists that reads absolute fox.ts profiles and outputs parent-relative profiles [US-33]
- [x] Migration walks the bone hierarchy per direction, subtracting each bone's parent absolute position to derive the local offset [US-33]
- [x] Migration output covers all 5 unique direction profiles (S, N, E, SE, NE) — mirrored directions (W, SW, NW) are derived, not migrated separately [US-33]
- [x] Migration output is written to `rig/characters/fox.ts` replacing the absolute profile data [US-33]
- [x] After migration, the fox renders at identical screen positions as before migration for all 8 directions (verified by running the game and checking each direction) [US-33]
- [x] `npx tsc --noEmit && npm run build` passes after migration [US-33]

### US-34 — Animation controller cleanup

- [x] `walkRun.ts` body bob is applied only to the `body` bone — manual propagation lines for neck, head, shoulders are removed [US-34]
- [x] `idle.ts` sit-down offset is applied only to `body` and `hips` — manual propagation lines for shoulders, neck, head, and foot parts are removed [US-34]
- [x] `idle.ts` head turn is applied only to `neck` — manual propagation to head and snout is removed [US-34]
- [x] Walk/run animation: body bob oscillates on Y axis, legs alternate swing, tail segments have non-zero rotation deltas — verified by running the game and observing walk cycle in all 8 directions [US-34]
- [x] Idle animation: breathing applies scaleY oscillation to body, sit-down lowers body offsetY after 6s stationary, head turn applies rotation to neck after 3s — verified by running the game and waiting through the idle sequence [US-34]
- [x] Net line count of `walkRun.ts` decreases (manual propagation lines removed exceed any new lines added) [US-34]
- [x] Net line count of `idle.ts` decreases (manual propagation lines removed exceed any new lines added) [US-34]
- [x] `BoneState` interface in `rig/types.ts` is unchanged — controllers still write local deltas in the same format [US-34]
- [x] `npx tsc --noEmit && npm run build` passes [US-34]

### US-35 — Editor chain-aware editing

- [x] Rig editor property panel shows parent-relative coordinates (matching the profile data model) for the selected part [US-35]
- [x] Editing a parent bone's local offset in the property panel updates the visual positions of all descendant bones in the editor preview [US-35]
- [x] Editor Save JSON exports parent-relative profile data (not absolute positions) [US-35]
- [x] Editor Load JSON correctly imports parent-relative profile data [US-35]
- [x] Editor Export TS outputs parent-relative profile data compatible with `rig/characters/fox.ts` format [US-35]
- [x] `npx tsc --noEmit && npm run build` passes for both game and editor (`cd tools/editor && npx tsc --noEmit && npm run build`) [US-35]

### Structural / cross-cutting

- [x] No constants or logic from `rig/` modules are duplicated in scene files — shared values remain in their canonical modules (`maps/constants.ts`, `rig/types.ts`) [phase]
- [x] Depth map in AGENTS.md is unchanged — bone-chain changes do not affect rendering depth assignments [phase]
- [x] AGENTS.md reflects new `inheritScale`/`inheritRotation` fields in the rig system description and any behavior rule changes introduced in this phase [phase]

### Safety criteria: N/A

This phase introduces no API endpoints, user input fields, or query interpolation. All changes are internal engine/tooling. No safety criteria required.

## AGENTS.md sections affected

When this phase ships, the following AGENTS.md sections will need updates:
- **File ownership** — `rig/CharacterRig.ts` description updated to mention parent-relative tree-walk resolution
- **File ownership** — `rig/types.ts` description updated to include `inheritScale`/`inheritRotation` on BoneDefinition
- **File ownership** — `rig/animations/walkRun.ts` and `idle.ts` descriptions updated to reflect simplified propagation model
- **Behavior rules — Character rig** — Updated to describe parent-relative coordinate model and tree-walk resolution
- **Behavior rules** — New rule for `inheritScale`/`inheritRotation` defaults and opt-in behavior

## Golden principles (phase-relevant)

- Movement: Frame-based smooth movement (delta-time), not tile-snapping. Axis-independent collision allows sliding along walls and NPCs.
- Character rig (fox): Player is a CharacterRig (Phaser Container at Entities depth 5) with fox rig definition. Direction derived from velocity via 8-sector atan2 mapping. Collision bounding box is PLAYER_SIZE (24px).
- Walk/run speed: WalkRunController is the source of truth for player movement speed.
- Idle progression: At velocity 0: breathing + tail sway start immediately. After 3s: random head turn. After 6s: sit-down with eased leg tuck and body lower.
- Responsive scaling: Phaser Scale.RESIZE mode — canvas adapts to container/viewport size.
- File ownership: Each module owns its specific domain (see AGENTS.md File ownership table). Scene code must call system-module functions, not duplicate them (Learning #70).
