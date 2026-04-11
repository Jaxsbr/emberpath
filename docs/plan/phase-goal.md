## Phase goal

Remove the experimental skeletal rig system (CharacterRig, fox definition, animation controllers, rig editor tab, fox atlas generator) from the codebase. Replace the fox CharacterRig player in GameScene with a plain Phaser Sprite using the existing fox atlas frame. The game must remain fully playable — movement, collision, camera, and area transitions all intact — using the simplified sprite placeholder.

### Stories in scope
- US-39 — Remove rig engine and fox definition from game codebase
- US-40 — Replace fox player with static sprite placeholder
- US-41 — Remove rig tab from editor

### Done-when (observable)

#### US-39 — Remove rig engine and fox definition from game codebase
- [ ] `src/rig/` directory does not exist in the repository [US-39]
- [ ] `src/rig/CharacterRig.ts` is deleted [US-39]
- [ ] `src/rig/types.ts` is deleted [US-39]
- [ ] `src/rig/characters/fox.ts` is deleted [US-39]
- [ ] `src/rig/animations/walkRun.ts` is deleted [US-39]
- [ ] `src/rig/animations/idle.ts` is deleted [US-39]
- [ ] No file in `src/` imports from `../rig/`, `./rig/`, or `@game/rig/` (grep confirms zero matches) [US-39]
- [ ] `npx tsc --noEmit && npm run build` passes with no rig-related type errors [US-39]

#### US-40 — Replace fox player with static sprite placeholder
- [x] `GameScene.ts` declares `player` as `Phaser.GameObjects.Sprite` (or `Phaser.GameObjects.Rectangle`), not `CharacterRig` [US-40]
- [x] `GameScene.ts` has zero imports from `src/rig/` [US-40]
- [x] The player sprite is positioned at the spawn point with correct pixel coordinates matching prior behavior (`spawn.col * TILE_SIZE + offset + PLAYER_SIZE / 2`, `spawn.row * TILE_SIZE + offset + PLAYER_SIZE / 2`) [US-40]
- [x] The player is rendered at depth 5 (Entities layer per depth map) [US-40]
- [x] The player moves with WASD / joystick using the same `moveWithCollision` path as before (no changes to `systems/movement.ts`) [US-40]
- [x] Collision bounding box is PLAYER_SIZE (24px) — `moveWithCollision` call uses the same halfSize math as before [US-40]
- [x] Camera `startFollow` targets the player sprite [US-40]
- [x] `walkRunController.getCurrentSpeed()` is no longer called — movement speed is a fixed constant (`PLAYER_SPEED`) derived from input velocity [US-40]
- [x] No reference to `.container` on `this.player` exists anywhere in `GameScene.ts` — all position reads use `this.player.x` / `this.player.y` directly (grep confirms zero `.container` references on `player`) [US-40]
- [x] `uiCam.ignore([..., this.player, ...])` uses the sprite directly (not `this.player.container`) [US-40]
- [x] `cleanupResize` calls `this.player?.destroy()` without referencing `.container` — Sprite's `destroy()` is called correctly [US-40]
- [x] `npx tsc --noEmit && npm run build` passes [US-40]

#### US-41 — Remove rig tab from editor
- [ ] `tools/editor/src/rigRenderer.ts` is deleted [US-41]
- [ ] `tools/editor/src/main.ts` has zero imports from `rigRenderer` [US-41]
- [ ] The `ViewName` type in `main.ts` no longer includes `'rig'` [US-41]
- [ ] The Rig tab button is absent from `tools/editor/index.html` (no `data-view="rig"` button) [US-41]
- [ ] The `view-rig` div is absent from `tools/editor/index.html` [US-41]
- [ ] `renderActiveView()` in `main.ts` has no `'rig'` branch [US-41]
- [ ] `destroyRig()` call is removed from `main.ts` [US-41]
- [ ] The editor still builds and runs: Map, Dialogue, and Flow tabs work (verified by build passing) [US-41]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes with no rig-related import errors [US-41]

#### Structural / cross-cutting
- [ ] `tools/generate-fox-atlas.mjs` is either retained as-is (atlas still used by placeholder sprite) or deleted — whichever is consistent with the chosen placeholder strategy; the decision is documented in a code comment in `GameScene.ts` [phase]
- [ ] No file in `tools/editor/src/` imports from `@game/rig/` or any rig path [phase]
- [ ] `npx tsc --noEmit && npm run build` passes (game root verify) [phase]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes (editor verify) [phase]
- [ ] AGENTS.md does not require update in this phase (per task constraints — spec notes impact only) [phase]

### Golden principles (phase-relevant)
- Depth map is non-negotiable: the placeholder player sprite must sit at depth 5 (Entities layer). Ad-hoc depth values are prohibited.
- PLAYER_SIZE (24px) is the collision bounding box constant — do not change it during teardown.
- Camera: `cam.startFollow(player)` must target the replacement sprite (not a container). Dual-camera `uiCam.ignore()` call must be updated to reference the new sprite.
- Area transitions: the transitionInProgress guard, cleanupResize, and fade logic all reference `this.player` — ensure these still compile and work after the rig → sprite swap.
- No silent breaking changes: all systems that previously read `this.player.container.x / .y` must read `this.player.x / .y` (Phaser Sprite, not Container).
- Axis-independent movement and wall-sliding behavior must be preserved unchanged — moveWithCollision is not touched.
