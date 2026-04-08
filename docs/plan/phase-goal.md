## Phase goal

Foundation phase — establish the Phaser 3 + TypeScript + Vite project scaffold with mobile-first responsive scaling, a tile-based world with collision, dual-input player movement (WASD + virtual joystick), camera follow with map bounds, and a title screen. All using programmer art (colored rectangles). This proves the core game shell: character exploration and tile-based world navigation.

### Stories in scope
- US-01 — Project scaffolding with responsive scaling
- US-02 — Tile-based world with collision
- US-03 — Player character with dual-input movement
- US-04 — Camera follow with map bounds
- US-05 — Title screen

### Done-when (observable)
- [x] `package.json` lists `phaser` (^3.x), `typescript`, and `vite` as dependencies [US-01]
- [x] `npm run dev` starts a Vite dev server that renders a Phaser game canvas in the browser [US-01]
- [x] `npm run build` produces a `dist/` directory containing `index.html` and bundled JS [US-01]
- [x] `tsconfig.json` has `"strict": true` [US-01]
- [x] HTML page contains an explicit `<div id="game-container">` element; Phaser game config sets `parent: 'game-container'` [US-01] (Learning #62 — Phaser Scale Manager measures container offsetWidth, body padding is ignored)
- [x] Phaser game config sets `scale.mode` to `Phaser.Scale.FIT` and `scale.autoCenter` to `Phaser.Scale.CENTER_BOTH` [US-01]
- [x] A tile map data module exports a 2D array of tile types (minimum: floor = 0, wall = 1) [US-02]
- [x] `TILE_SIZE`, `MAP_COLS`, and `MAP_ROWS` are defined as named constants (not magic numbers) [US-02]
- [x] GameScene renders the tile map with visually distinct floor and wall tiles — floor reads as "walkable space" (lighter color), wall reads as "solid barrier" (darker/contrasting color) [US-02]
- [x] Collision detection prevents the player entity from overlapping wall tile positions [US-02]
- [x] Player entity renders as a colored rectangle visually distinct from tile map elements — reads as "the character you control" (different color from both floor and wall tiles) [US-03]
- [x] Pressing W/A/S/D moves the player up/left/down/right respectively [US-03]
- [x] Virtual joystick appears on touch input and moves the player in the drag direction [US-03]
- [x] Player movement is frame-based smooth movement (position updates per frame), not tile-snapping [US-03]
- [x] Player cannot move into or through wall tiles — collision stops movement at tile boundary [US-03]
- [x] Movement speed is defined as a named constant (e.g., `PLAYER_SPEED`) [US-03]
- [ ] Camera follows the player entity during movement [US-04]
- [ ] Camera bounds are set to the tile map pixel dimensions — no empty/black space visible beyond map edges [US-04]
- [ ] Camera behavior is consistent across mobile (375x667) and desktop (1280x720) viewport sizes [US-04]
- [ ] TitleScene is the first scene loaded by the Phaser game [US-05]
- [ ] TitleScene displays "Emberpath" text centered horizontally on screen [US-05]
- [ ] TitleScene contains a "Start" interactive element that responds to `pointerdown` event [US-05]
- [ ] Clicking/tapping Start transitions to GameScene — scene switch occurs and GameScene renders the tile map [US-05]
- [ ] `src/` directory has separate modules for input handling, movement/collision, and scene management — establishing the systems-based entity architecture from the master PRD [phase]
- [ ] AGENTS.md includes an explicit depth map defining rendering order for visual layers (e.g., tiles: 0, entities: 5, UI: 100) [phase]
- [ ] AGENTS.md reflects new modules, directories, file ownership, and behavior rules introduced in this phase [phase]
- [ ] README.md documents how to run the project locally (`npm install`, `npm run dev`) and lists controls (WASD on desktop, virtual joystick on mobile) [phase]
- [ ] Verify command configured in progress.yaml: `npx tsc --noEmit && npm run build` [phase] (Learning #15 — Vite uses esbuild for transpilation, not tsc; explicit tsc --noEmit is required to enforce TypeScript strict mode)

### Golden principles (phase-relevant)
- `no-silent-pass` — tests must have unconditional assertions
- `no-bare-except` — catch blocks must log or re-throw
- `error-path-coverage` — error paths must have test coverage
- `agents-consistency` — AGENTS.md rules must match actual code behavior
