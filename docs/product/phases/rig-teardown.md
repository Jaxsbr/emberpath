# Phase: rig-teardown

Status: Draft

## Stories

### US-39 — Remove rig engine and fox definition from game codebase

As a developer, I want the `src/rig/` directory and all its contents removed from the repository, so that the codebase carries no dead skeletal animation code after the rig system is retired.

**Acceptance criteria**:
- `src/rig/` directory does not exist in the repository after teardown.
- No file in `src/` contains any import referencing `../rig/`, `./rig/`, or `@game/rig/`.
- The game TypeScript project compiles and builds without errors after deletion.

**User guidance:** N/A — internal dev teardown, no user-facing change.

**Design rationale:** The rig system was an experimental feature built across three phases (character-rig, rig-editor, bone-chain). It is being removed before sprite sheet integration to avoid carrying two player-rendering code paths simultaneously. Tearing down the rig first keeps the codebase clean and ensures the replacement sprite placeholder can be introduced on a stable baseline with no competing imports.

---

### US-40 — Replace fox player with static sprite placeholder

As a developer, I want `GameScene.ts` to use a plain `Phaser.GameObjects.Sprite` for the player (using the existing fox atlas frame), so that the game still runs with movement, collision, and camera intact while the rig system is absent.

**Acceptance criteria**:
- `GameScene.ts` declares `player` as `Phaser.GameObjects.Sprite` (or `Phaser.GameObjects.Rectangle`), not `CharacterRig`.
- `GameScene.ts` has zero imports from `src/rig/`.
- The player is positioned at the spawn point with the same pixel coordinate math as before.
- The player is rendered at depth 5 (Entities layer).
- Movement uses WASD / joystick with the same `moveWithCollision` path — `movement.ts` is not modified.
- Collision bounding box remains PLAYER_SIZE (24px).
- `cam.startFollow` targets the player sprite directly (not a container).
- `walkRunController.getCurrentSpeed()` is no longer called; movement speed is a fixed constant (`PLAYER_SPEED`) derived from input velocity.
- No `.container` references remain on `this.player` — all position reads use `this.player.x` / `this.player.y`.
- `uiCam.ignore([..., this.player, ...])` uses the sprite directly.
- `cleanupResize` calls `this.player?.destroy()` without `.container`.

**User guidance:** N/A — internal dev teardown, no user-facing change.

**Design rationale:** Using a plain Phaser Sprite (from the existing fox atlas) as a stand-in avoids introducing new art assets while maintaining full game playability. This provides a clear, low-risk checkpoint before sprite sheet integration. A rectangle alternative is acceptable if atlas frame selection is ambiguous, but the atlas sprite is preferred for visual continuity.

---

### US-41 — Remove rig tab from editor

As a developer, I want the Rig tab removed from the dev editor tool, so that the editor reflects only the active toolset after the rig system is retired.

**Acceptance criteria**:
- `tools/editor/src/rigRenderer.ts` is deleted.
- `tools/editor/src/main.ts` has zero imports from `rigRenderer`.
- The `ViewName` type in `main.ts` no longer includes `'rig'`.
- The Rig tab button is absent from `tools/editor/index.html` (no `data-view="rig"` button).
- The `view-rig` div is absent from `tools/editor/index.html`.
- `renderActiveView()` in `main.ts` has no `'rig'` branch.
- `destroyRig()` call is removed from `main.ts`.
- Map, Dialogue, and Flow tabs still function (verified by editor build passing).
- The editor TypeScript project compiles and builds without errors after deletion.

**User guidance:** N/A — internal dev tool, no end-user exposure.

**Design rationale:** The Rig tab depended entirely on `CharacterRig` and fox rig data. With both removed, the tab would be broken dead code. Deleting it alongside the engine keeps the editor in a working state and removes the maintenance surface.

---

## Done-when (observable)

### US-39 — Remove rig engine and fox definition from game codebase
- [ ] `src/rig/` directory does not exist in the repository [US-39]
- [ ] `src/rig/CharacterRig.ts` is deleted [US-39]
- [ ] `src/rig/types.ts` is deleted [US-39]
- [ ] `src/rig/characters/fox.ts` is deleted [US-39]
- [ ] `src/rig/animations/walkRun.ts` is deleted [US-39]
- [ ] `src/rig/animations/idle.ts` is deleted [US-39]
- [ ] No file in `src/` imports from `../rig/`, `./rig/`, or `@game/rig/` (grep confirms zero matches) [US-39]
- [ ] `npx tsc --noEmit && npm run build` passes with no rig-related type errors [US-39]

### US-40 — Replace fox player with static sprite placeholder
- [ ] `GameScene.ts` declares `player` as `Phaser.GameObjects.Sprite` (or `Phaser.GameObjects.Rectangle`), not `CharacterRig` [US-40]
- [ ] `GameScene.ts` has zero imports from `src/rig/` [US-40]
- [ ] The player sprite is positioned at the spawn point with correct pixel coordinates matching prior behavior (`spawn.col * TILE_SIZE + offset + PLAYER_SIZE / 2`, `spawn.row * TILE_SIZE + offset + PLAYER_SIZE / 2`) [US-40]
- [ ] The player is rendered at depth 5 (Entities layer per depth map) [US-40]
- [ ] The player moves with WASD / joystick using the same `moveWithCollision` path as before (no changes to `systems/movement.ts`) [US-40]
- [ ] Collision bounding box is PLAYER_SIZE (24px) — `moveWithCollision` call uses the same halfSize math as before [US-40]
- [ ] Camera `startFollow` targets the player sprite [US-40]
- [ ] `walkRunController.getCurrentSpeed()` is no longer called — movement speed is a fixed constant (`PLAYER_SPEED`) derived from input velocity [US-40]
- [ ] No reference to `.container` on `this.player` exists anywhere in `GameScene.ts` — all position reads use `this.player.x` / `this.player.y` directly (grep confirms zero `.container` references on `player`) [US-40]
- [ ] `uiCam.ignore([..., this.player, ...])` uses the sprite directly (not `this.player.container`) [US-40]
- [ ] `cleanupResize` calls `this.player?.destroy()` without referencing `.container` — Sprite's `destroy()` is called correctly [US-40]
- [ ] `npx tsc --noEmit && npm run build` passes [US-40]

### US-41 — Remove rig tab from editor
- [ ] `tools/editor/src/rigRenderer.ts` is deleted [US-41]
- [ ] `tools/editor/src/main.ts` has zero imports from `rigRenderer` [US-41]
- [ ] The `ViewName` type in `main.ts` no longer includes `'rig'` [US-41]
- [ ] The Rig tab button is absent from `tools/editor/index.html` (no `data-view="rig"` button) [US-41]
- [ ] The `view-rig` div is absent from `tools/editor/index.html` [US-41]
- [ ] `renderActiveView()` in `main.ts` has no `'rig'` branch [US-41]
- [ ] `destroyRig()` call is removed from `main.ts` [US-41]
- [ ] The editor still builds and runs: Map, Dialogue, and Flow tabs work (verified by build passing) [US-41]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes with no rig-related import errors [US-41]

### Structural / cross-cutting
- [ ] `tools/generate-fox-atlas.mjs` is either retained as-is (atlas still used by placeholder sprite) or deleted — whichever is consistent with the chosen placeholder strategy; the decision is documented in a code comment in `GameScene.ts` [phase]
- [ ] No file in `tools/editor/src/` imports from `@game/rig/` or any rig path [phase]
- [ ] `npx tsc --noEmit && npm run build` passes (game root verify) [phase]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes (editor verify) [phase]
- [ ] AGENTS.md does not require update in this phase (per task constraints — spec notes impact only) [phase]

Safety criteria: N/A — this phase introduces no API endpoints, user input fields, or query interpolation. It is a code deletion and simplification pass.

## Golden principles (phase-relevant)

- Depth map is non-negotiable: the placeholder player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it during teardown.
- Camera: `cam.startFollow(player)` must target the replacement sprite (not a container). Dual-camera `uiCam.ignore()` call must be updated to reference the new sprite.
- Area transitions: the transitionInProgress guard, cleanupResize, and fade logic all reference `this.player` — ensure these still compile and work after the rig → sprite swap.
- No silent breaking changes: all systems that previously read `this.player.container.x / .y` must read `this.player.x / .y` (Phaser Sprite, not Container).
- Axis-independent movement and wall-sliding behavior must be preserved unchanged — moveWithCollision is not touched.

## AGENTS.md sections affected

When this phase ships, the following AGENTS.md sections will need to be updated by the build-loop's Phase Reconciliation Gate:

### File ownership table
- Remove rows for: `rig/types.ts`, `rig/CharacterRig.ts`, `rig/characters/fox.ts`, `rig/animations/walkRun.ts`, `rig/animations/idle.ts`, `tools/editor/src/rigRenderer.ts`
- Update `scenes/GameScene.ts` row — remove "fox rig player (CharacterRig + WalkRunController + IdleController)" from its description; replace with "Phaser Sprite placeholder player"

### Directory layout
- Remove `rig/` subtree from the `src/` directory layout block.
- Remove `rigRenderer.ts` entry from the `tools/editor/src/` directory layout block.

### Behavior rules
- Remove the **Character rig (fox)** bullet (currently describes CharacterRig, atlas preload, direction mapping, PLAYER_SIZE).
- Remove the **Rig coordinate model (bone-chain)** bullet (BoneDefinition, inheritScale, inheritRotation, resolvePositions).
- Remove the **Walk/run speed** bullet — WalkRunController is no longer present; movement speed becomes the fixed `PLAYER_SPEED` constant.
- Remove the **Idle progression** bullet — IdleController is no longer present.
- Remove the **Editor bone connections** bullet (teal lines in RigPreviewScene).
- Remove the **Editor canvas drag** bullet (bone drag in Edit mode).
- Remove the **Editor propagation highlighting** bullet (amber outlines on descendants).
- Update **Camera** bullet — remove reference to `.container`; camera now targets the sprite directly.

### Editor canvas depth map
- Remove the entire Editor canvas depth map section (it exists solely for the rig editor's Phaser scene, which is deleted in this phase).

### User documentation impact

No end-user documentation exists for this project. The editor is an internal dev tool only. No manual pages need to be created or updated in this phase.
