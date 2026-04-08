# Phase: foundation

Status: draft

## Design direction

Programmer art — solid colored rectangles for tiles, player, and UI elements. No aesthetic styling, no AI art. Design direction deferred to a later phase when Midjourney/Flow art assets are integrated. The build-loop should NOT apply frontend-design guidelines for this phase.

## Stories

### US-01 — Project scaffolding with responsive scaling

As a developer, I want a Phaser 3 + TypeScript + Vite project with mobile-first responsive scaling, so that I have a working game shell that runs on mobile and desktop browsers.

**Acceptance criteria:**
- `npm run dev` starts a local dev server rendering a Phaser game canvas
- `npm run build` produces a deployable dist/ bundle
- Phaser Scale Manager uses FIT mode for mobile-first responsive sizing
- TypeScript strict mode enabled
- Game canvas is hosted inside an explicit container div (not directly on body)

**User guidance:** N/A — developer infrastructure

**Design rationale:** Phaser 3 + Vite is the established stack from the master PRD. FIT mode handles mobile scaling without manual viewport math. An explicit `#game-container` div is required because Phaser's Scale Manager measures `parent.offsetWidth` — body padding has no effect on canvas sizing (Learning #62).

### US-02 — Tile-based world with collision

As a player, I want to explore a tile-based area with walls I can't walk through, so that the world feels solid and navigable.

**Acceptance criteria:**
- A hand-coded tile array defines floor and wall tiles
- Wall tiles block player movement via collision detection
- Floor and wall tiles are visually distinct (different colored rectangles)
- Tile size and map dimensions are defined as configurable constants

**User guidance:**
- Discovery: Visible immediately on entering the game world scene
- Manual section: N/A — programmer art foundation, no user manual yet
- Key steps: 1. Start the game from the title screen. 2. Observe the tile map with distinct floor tiles (one color) and wall tiles (another color) forming a navigable area.

**Design rationale:** Hand-coded tile arrays for now to avoid Tiled dependency in foundation. Tiled integration comes in a later phase when real maps are needed. Simple 2D number array is the most direct representation.

**Interaction model:** Player sees a grid-based area rendered with solid-colored rectangles. No direct interaction with tiles beyond collision — the player character moves freely within floor tiles and is blocked by wall tiles. Same movement model as standard top-down tile games (e.g., early Zelda, Pokemon overworld).

### US-03 — Player character with dual-input movement

As a player, I want to control a character using touch (virtual joystick) on mobile and keyboard (WASD) on desktop, so that I can move around the world.

**Acceptance criteria:**
- Player entity renders on the tile map as a colored rectangle
- WASD keys move the player in 4 directions on desktop
- Virtual joystick appears on touch and moves the player on mobile
- Player movement is smooth (frame-based, not tile-snapping)
- Player cannot move through wall tiles

**User guidance:**
- Discovery: On mobile, a virtual joystick appears on first touch. On desktop, WASD keys work immediately.
- Manual section: N/A — controls are self-evident for the foundation phase
- Key steps: 1. On mobile, touch and drag anywhere on the lower portion of the screen to activate the virtual joystick and move. 2. On desktop, press W/A/S/D to move the character up/left/down/right.

**Design rationale:** Dual-input (joystick + keyboard) matches the mobile-first + desktop-fallback strategy from the master PRD. Virtual joystick is the standard touch control for top-down mobile games. Free movement (not tile-snapping) feels more natural for exploration.

**Interaction model:** Mobile: touch-and-drag virtual joystick in the lower screen area — character moves in the drag direction proportional to joystick displacement. Desktop: hold WASD keys — character moves at constant speed in the pressed direction. Both inputs produce the same smooth movement with collision against walls; only the input source differs.

### US-04 — Camera follow with map bounds

As a player, I want the camera to follow my character as I move, so that I can explore areas larger than the screen.

**Acceptance criteria:**
- Camera follows the player entity smoothly
- Camera is bounded to the tile map edges (no empty space beyond map)
- Works correctly on both mobile and desktop viewports

**User guidance:**
- Discovery: Automatic — camera follows the player without any user action
- Manual section: N/A — invisible system behavior
- Key steps: 1. Move the player character around the map. 2. Observe the camera tracking the player and stopping at map edges with no empty space visible.

**Design rationale:** Phaser's built-in camera follow + setBounds is the simplest correct approach. No custom smoothing or lerp needed for foundation — Phaser's default follow behavior is sufficient.

### US-05 — Title screen

As a player, I want to see a title screen when the game loads, so that I know what game I'm playing and can start when ready.

**Acceptance criteria:**
- Title screen displays "Emberpath" text
- A "Start" interactive element responds to tap/click
- Tapping/clicking Start transitions to the game world scene

**User guidance:**
- Discovery: First screen shown when the game loads in a browser
- Manual section: N/A — no user manual yet
- Key steps: 1. Load the game in a browser (or navigate to the deployed URL). 2. See the title "Emberpath" and a Start button. 3. Tap or click Start to enter the game world.

**Design rationale:** Minimal title screen — text + button only, programmer art. No animated intro or menu system needed for POC foundation. Establishes the scene-transition pattern (TitleScene → GameScene) that story scenes and area transitions will build on later.

## Done-when (observable)

- [ ] `package.json` lists `phaser` (^3.x), `typescript`, and `vite` as dependencies [US-01]
- [ ] `npm run dev` starts a Vite dev server that renders a Phaser game canvas in the browser [US-01]
- [ ] `npm run build` produces a `dist/` directory containing `index.html` and bundled JS [US-01]
- [ ] `tsconfig.json` has `"strict": true` [US-01]
- [ ] HTML page contains an explicit `<div id="game-container">` element; Phaser game config sets `parent: 'game-container'` [US-01] (Learning #62 — Phaser Scale Manager measures container offsetWidth, body padding is ignored)
- [ ] Phaser game config sets `scale.mode` to `Phaser.Scale.FIT` and `scale.autoCenter` to `Phaser.Scale.CENTER_BOTH` [US-01]
- [ ] A tile map data module exports a 2D array of tile types (minimum: floor = 0, wall = 1) [US-02]
- [ ] `TILE_SIZE`, `MAP_COLS`, and `MAP_ROWS` are defined as named constants (not magic numbers) [US-02]
- [ ] GameScene renders the tile map with visually distinct floor and wall tiles — floor reads as "walkable space" (lighter color), wall reads as "solid barrier" (darker/contrasting color) [US-02]
- [ ] Collision detection prevents the player entity from overlapping wall tile positions [US-02]
- [ ] Player entity renders as a colored rectangle visually distinct from tile map elements — reads as "the character you control" (different color from both floor and wall tiles) [US-03]
- [ ] Pressing W/A/S/D moves the player up/left/down/right respectively [US-03]
- [ ] Virtual joystick appears on touch input and moves the player in the drag direction [US-03]
- [ ] Player movement is frame-based smooth movement (position updates per frame), not tile-snapping [US-03]
- [ ] Player cannot move into or through wall tiles — collision stops movement at tile boundary [US-03]
- [ ] Movement speed is defined as a named constant (e.g., `PLAYER_SPEED`) [US-03]
- [ ] Camera follows the player entity during movement [US-04]
- [ ] Camera bounds are set to the tile map pixel dimensions — no empty/black space visible beyond map edges [US-04]
- [ ] Camera behavior is consistent across mobile (375x667) and desktop (1280x720) viewport sizes [US-04]
- [ ] TitleScene is the first scene loaded by the Phaser game [US-05]
- [ ] TitleScene displays "Emberpath" text centered horizontally on screen [US-05]
- [ ] TitleScene contains a "Start" interactive element that responds to `pointerdown` event [US-05]
- [ ] Clicking/tapping Start transitions to GameScene — scene switch occurs and GameScene renders the tile map [US-05]
- [ ] `src/` directory has separate modules for input handling, movement/collision, and scene management — establishing the systems-based entity architecture from the master PRD [phase]
- [ ] AGENTS.md includes an explicit depth map defining rendering order for visual layers (e.g., tiles: 0, entities: 5, UI: 100) [phase] (Learning #57 — ad-hoc depth assignment causes invisible elements in Phaser)
- [ ] AGENTS.md reflects new modules, directories, file ownership, and behavior rules introduced in this phase [phase]
- [ ] README.md documents how to run the project locally (`npm install`, `npm run dev`) and lists controls (WASD on desktop, virtual joystick on mobile) [phase]
- [ ] Verify command configured in progress.yaml: `npx tsc --noEmit && npm run build` [phase] (Learning #15 — Vite uses esbuild for transpilation, not tsc; explicit tsc --noEmit is required to enforce TypeScript strict mode)

## Golden principles (phase-relevant)

From AGENTS.md quality checks:
- `no-silent-pass` — tests must have unconditional assertions
- `no-bare-except` — catch blocks must log or re-throw
- `error-path-coverage` — error paths must have test coverage
- `agents-consistency` — AGENTS.md rules must match actual code behavior

## AGENTS.md sections affected

When this phase ships, AGENTS.md should be updated with:
- **Directory layout** — new `src/` structure with scenes, systems, maps modules
- **File ownership** — which modules own input, movement, collision, rendering
- **Depth map** — explicit rendering order for visual layers
- **Running instructions** — `npm install`, `npm run dev`, `npm run build`
- **Testing conventions** — test file locations and patterns
- **Behavior rules** — player movement, collision, scene transitions

## User documentation

No user guide exists. For foundation phase, `README.md` serves as minimal documentation (run instructions + controls). A full user/player guide is deferred until the game has substantive content (story scenes, NPCs) — at that point, a `docs/GUIDE.md` or in-game help should be created.
