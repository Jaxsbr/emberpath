## Phase goal

Convert the rig engine (`CharacterRig`, `BoneDefinition`, animation controller contract) from flat absolute positioning to parent-relative hierarchical transforms using manual tree-walk position resolution — no Phaser nested Containers. Each bone's profile coordinates become relative to its parent bone. `CharacterRig.update()` resolves world positions via depth-first tree walk each frame. Animation controllers gain automatic propagation (body bob moves all descendants) without manual per-bone duplication. The editor displays and edits parent-relative coordinates, with visual hierarchy following automatically.

**Approach:** Option C from Sage RES-7 research — parent-relative profiles + manual tree-walk resolver. Avoids Phaser nested Container overhead and version-stability risk. `inheritScale` and `inheritRotation` default to `false` (opt-in per bone). Migration preserves current absolute positions exactly via automated conversion.

### Stories in scope
- US-32 — Parent-relative coordinate model in CharacterRig
- US-33 — Profile migration tooling
- US-34 — Animation controller cleanup
- US-35 — Editor chain-aware editing

### Done-when (observable)

#### US-32 — Parent-relative coordinate model
- [ ] `BoneDefinition` in `rig/types.ts` includes `inheritScale: boolean` and `inheritRotation: boolean` fields, both defaulting to `false` [US-32]
- [ ] `CharacterRig.update()` resolves world positions via depth-first tree walk of the bone hierarchy: each bone's world position = parent world position + local profile offset + local state offset [US-32]
- [ ] When `inheritRotation` is `true` on a bone, the local offset is rotated around the parent's pivot by the parent's world rotation [US-32]
- [ ] When `inheritScale` is `true` on a bone, the local offset and sprite scale are multiplied by the parent's world scale [US-32]
- [ ] `setDirection()` resolves world positions from parent-relative profile data using the same tree-walk logic (not a separate flat loop) [US-32]
- [ ] Sprites remain flat siblings in the root Phaser Container — no nested Containers are introduced [US-32]
- [ ] `npx tsc --noEmit && npm run build` passes with zero errors [US-32]
- [ ] Fox renders identically to pre-change state when using migrated parent-relative profiles (visual equivalence — same sprite positions on screen for all 5 direction profiles + 3 mirrored) [US-32]

#### US-33 — Profile migration tooling
- [ ] A migration script or editor feature exists that reads absolute fox.ts profiles and outputs parent-relative profiles [US-33]
- [ ] Migration walks the bone hierarchy per direction, subtracting each bone's parent absolute position to derive the local offset [US-33]
- [ ] Migration output covers all 5 unique direction profiles (S, N, E, SE, NE) — mirrored directions (W, SW, NW) are derived, not migrated separately [US-33]
- [ ] Migration output is written to `rig/characters/fox.ts` replacing the absolute profile data [US-33]
- [ ] After migration, the fox renders at identical screen positions as before migration for all 8 directions (verified by running the game and checking each direction) [US-33]
- [ ] `npx tsc --noEmit && npm run build` passes after migration [US-33]

#### US-34 — Animation controller cleanup
- [ ] `walkRun.ts` body bob is applied only to the `body` bone — manual propagation lines for neck, head, shoulders are removed [US-34]
- [ ] `idle.ts` sit-down offset is applied only to `body` and `hips` — manual propagation lines for shoulders, neck, head, and foot parts are removed [US-34]
- [ ] `idle.ts` head turn is applied only to `neck` — manual propagation to head and snout is removed [US-34]
- [ ] Walk/run animation: body bob oscillates on Y axis, legs alternate swing, tail segments have non-zero rotation deltas — verified by running the game and observing walk cycle in all 8 directions [US-34]
- [ ] Idle animation: breathing applies scaleY oscillation to body, sit-down lowers body offsetY after 6s stationary, head turn applies rotation to neck after 3s — verified by running the game and waiting through the idle sequence [US-34]
- [ ] Net line count of `walkRun.ts` decreases (manual propagation lines removed exceed any new lines added) [US-34]
- [ ] Net line count of `idle.ts` decreases (manual propagation lines removed exceed any new lines added) [US-34]
- [ ] `BoneState` interface in `rig/types.ts` is unchanged — controllers still write local deltas in the same format [US-34]
- [ ] `npx tsc --noEmit && npm run build` passes [US-34]

#### US-35 — Editor chain-aware editing
- [ ] Rig editor property panel shows parent-relative coordinates (matching the profile data model) for the selected part [US-35]
- [ ] Editing a parent bone's local offset in the property panel updates the visual positions of all descendant bones in the editor preview [US-35]
- [ ] Editor Save JSON exports parent-relative profile data (not absolute positions) [US-35]
- [ ] Editor Load JSON correctly imports parent-relative profile data [US-35]
- [ ] Editor Export TS outputs parent-relative profile data compatible with `rig/characters/fox.ts` format [US-35]
- [ ] `npx tsc --noEmit && npm run build` passes for both game and editor (`cd tools/editor && npx tsc --noEmit && npm run build`) [US-35]

#### Structural / cross-cutting
- [ ] No constants or logic from `rig/` modules are duplicated in scene files — shared values remain in their canonical modules (`maps/constants.ts`, `rig/types.ts`) [phase]
- [ ] Depth map in AGENTS.md is unchanged — bone-chain changes do not affect rendering depth assignments [phase]
- [ ] AGENTS.md reflects new `inheritScale`/`inheritRotation` fields in the rig system description and any behavior rule changes introduced in this phase [phase]

### Golden principles (phase-relevant)
- Movement: Frame-based smooth movement (delta-time), not tile-snapping. Axis-independent collision allows sliding along walls and NPCs.
- Character rig (fox): Player is a CharacterRig (Phaser Container at Entities depth 5) with fox rig definition. Direction derived from velocity via 8-sector atan2 mapping. Collision bounding box is PLAYER_SIZE (24px).
- Walk/run speed: WalkRunController is the source of truth for player movement speed.
- Idle progression: At velocity 0: breathing + tail sway start immediately. After 3s: random head turn. After 6s: sit-down with eased leg tuck and body lower.
- Responsive scaling: Phaser Scale.RESIZE mode — canvas adapts to container/viewport size.
- File ownership: Each module owns its specific domain (see AGENTS.md File ownership table). Scene code must call system-module functions, not duplicate them.
