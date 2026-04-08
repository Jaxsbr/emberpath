# Emberpath

## Purpose
Mobile-first top-down exploration game with story scenes, inspired by Pilgrim's Progress, using AI-generated art (Midjourney + Flow). An allegorical journey game POC that proves three things: character exploration, story scene triggers, and AI art rendering in-engine.

## Running

```bash
npm install
npm run dev      # Vite dev server at localhost:5173
npm run build    # Production build to dist/
```

## Controls

- **Desktop:** W/A/S/D to move up/left/down/right
- **Mobile:** Touch and drag anywhere to activate virtual joystick

## Directory layout

```
src/
  main.ts              # Phaser game config + bootstrap
  scenes/
    TitleScene.ts      # Title screen — "Emberpath" + Start button
    GameScene.ts       # Game world — tile rendering, player, camera
  systems/
    input.ts           # InputSystem — WASD keyboard + virtual joystick
    movement.ts        # moveWithCollision — axis-independent movement
    collision.ts       # collidesWithWall — bounding box vs tile map
  maps/
    constants.ts       # TILE_SIZE, MAP_COLS, MAP_ROWS, PLAYER_SPEED, TileType
    worldMap.ts        # 2D tile array (50x38)
```

## File ownership

| Module | Owns |
|---|---|
| `scenes/TitleScene.ts` | Title screen UI, scene transition to GameScene |
| `scenes/GameScene.ts` | Tile rendering, player entity, camera setup, update loop |
| `systems/input.ts` | All input handling — keyboard keys, touch joystick lifecycle |
| `systems/movement.ts` | Position updates with collision checking |
| `systems/collision.ts` | Wall collision detection against tile map |
| `maps/constants.ts` | All game constants — tile size, map dimensions, player speed |
| `maps/worldMap.ts` | Tile map data — 2D array defining the world layout |

## Depth map

Explicit rendering order for visual layers (Learning #57):

| Layer | Depth | Description |
|---|---|---|
| Tiles | 0 | Floor and wall tile graphics |
| Entities | 5 | Player character and future NPCs |
| UI | 100 | Virtual joystick, HUD elements |

New visual elements must reference this map. Ad-hoc depth values are prohibited.

## Behavior rules

- **Scene flow:** TitleScene → GameScene. TitleScene is always the first scene loaded.
- **Movement:** Frame-based smooth movement (delta-time), not tile-snapping. Axis-independent collision allows sliding along walls.
- **Collision:** Bounding box corners checked against tile map. Out-of-bounds = collision.
- **Input priority:** Keyboard takes priority over joystick when any WASD key is held.
- **Virtual joystick:** Created on pointerdown, destroyed on pointerup. Uses scrollFactor(0) to stay fixed on screen.
- **Camera:** Follows player with bounds set to tile map pixel dimensions.

## Quality checks

- no-silent-pass
- no-bare-except
- error-path-coverage
- agents-consistency

## Testing

No test framework configured in foundation phase. Verify command: `npx tsc --noEmit && npm run build` (Learning #15 — Vite uses esbuild, explicit tsc --noEmit enforces TypeScript strict mode).
