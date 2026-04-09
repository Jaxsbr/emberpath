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
    TitleScene.ts      # Title screen — "Emberpath" + Start button + flag reset
    GameScene.ts       # Game world — tile rendering, player, camera, system orchestration
    StoryScene.ts      # Full-screen story scenes — image placeholder + text panel + fade
  systems/
    input.ts           # InputSystem — WASD keyboard + virtual joystick
    movement.ts        # moveWithCollision — axis-independent movement
    collision.ts       # collidesWithWall + collidesWithNpc — bounding box vs tile map and NPCs
    npcInteraction.ts  # NpcInteractionSystem — proximity detection, interaction prompt, Space/tap trigger
    dialogue.ts        # DialogueSystem — text box, typewriter effect, choices, node graph traversal
    thoughtBubble.ts   # ThoughtBubbleSystem — floating text near player, auto-dismiss, sequential queue
    triggerZone.ts     # TriggerZoneSystem — zone overlap detection, condition parsing, type dispatch
  data/
    npcs.ts            # NPC definitions (id, name, col, row, color)
    dialogues.ts       # Dialogue scripts as typed node graphs
    story-scenes.ts    # Story scene definitions (beats with text + placeholder image)
    triggers.ts        # Trigger zone definitions (position, size, type, condition, repeatable)
  triggers/
    flags.ts           # Flag store — getFlag, setFlag, incrementFlag, resetAllFlags, localStorage persistence
  maps/
    constants.ts       # TILE_SIZE, MAP_COLS, MAP_ROWS, PLAYER_SPEED, TileType
    worldMap.ts        # 2D tile array (50x38)
```

## File ownership

| Module | Owns |
|---|---|
| `scenes/TitleScene.ts` | Title screen UI, scene transition to GameScene, flag reset |
| `scenes/GameScene.ts` | Tile rendering, player entity, camera setup, update loop, system orchestration |
| `scenes/StoryScene.ts` | Full-screen story scenes — beat display, fade transitions, GameScene pause/resume |
| `systems/input.ts` | All input handling — keyboard keys, touch joystick lifecycle |
| `systems/movement.ts` | Position updates with collision checking (walls + NPCs) |
| `systems/collision.ts` | Wall and NPC collision detection against tile map and entity bounds |
| `systems/npcInteraction.ts` | NPC proximity detection, interaction prompt, Space/tap trigger |
| `systems/dialogue.ts` | Dialogue UI (text box, typewriter, choices), node graph state machine |
| `systems/thoughtBubble.ts` | Thought bubble display, auto-dismiss, sequential queue |
| `systems/triggerZone.ts` | Trigger zone evaluation, condition parsing, type dispatch |
| `data/npcs.ts` | NPC definitions — id, name, position, color |
| `data/dialogues.ts` | Dialogue scripts — typed node graphs with choices |
| `data/story-scenes.ts` | Story scene definitions — beats with text and image placeholders |
| `data/triggers.ts` | Trigger zone definitions — position, size, type, conditions |
| `triggers/flags.ts` | Flag store — read/write/increment/reset, localStorage persistence |
| `maps/constants.ts` | All game constants — tile size, map dimensions, player speed |
| `maps/worldMap.ts` | Tile map data — 2D array defining the world layout |

## Depth map

Explicit rendering order for visual layers (Learning #57):

| Layer | Depth | Description |
|---|---|---|
| Tiles | 0 | Floor and wall tile graphics |
| Entities | 5 | Player character and NPCs |
| UI | 100 | Virtual joystick, HUD elements |
| Thoughts | 150 | Thought bubble text and background (scrollFactor 0) |
| Interaction prompt | 150 | NPC interaction prompt text |
| Dialogue | 200 | Dialogue box, speaker name, choice buttons (scrollFactor 0) |

New visual elements must reference this map. Ad-hoc depth values are prohibited.

## Behavior rules

- **Scene flow:** TitleScene → GameScene. StoryScene is a parallel scene launched/stopped by GameScene. TitleScene is always the first scene loaded.
- **Movement:** Frame-based smooth movement (delta-time), not tile-snapping. Axis-independent collision allows sliding along walls and NPCs.
- **Collision:** Bounding box corners checked against tile map and NPC bounds. Out-of-bounds = collision.
- **Input priority:** Keyboard takes priority over joystick when any WASD key is held. Dialogue and StoryScene capture all input while active.
- **Virtual joystick:** Created on pointerdown, destroyed on pointerup. Uses scrollFactor(0) to stay fixed on screen.
- **Camera:** Follows player with bounds set to tile map pixel dimensions.
- **NPC interaction:** Proximity-based (1.5 tile radius). Space (desktop) or tap (mobile) to interact. Interaction prompt appears/disappears based on distance.
- **Dialogue:** Bottom-screen text box with typewriter effect. Space/tap advances or completes typewriter. Choices via arrow keys + Enter or tap/click. Data-driven node graphs in `data/dialogues.ts`.
- **Zone-level mutual exclusion (LEARNINGS #56):** When dialogue is active, movement, NPC interaction, and trigger evaluation are all suppressed. When StoryScene is active, GameScene is fully paused. Thought bubbles queue during dialogue and display after.
- **Trigger zones:** Fire on player entry (bounding box overlap). One-shot triggers use internal flags. Repeatable triggers require exit-then-re-enter. Conditions use flag comparisons with AND logic.
- **Flag persistence:** Flags stored in localStorage under 'emberpath_flags'. Reset available from TitleScene.

## Quality checks

- no-silent-pass
- no-bare-except
- error-path-coverage
- agents-consistency

## Testing

No test framework configured in foundation phase. Verify command: `npx tsc --noEmit && npm run build` (Learning #15 — Vite uses esbuild, explicit tsc --noEmit enforces TypeScript strict mode).
