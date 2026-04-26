import { TileType } from '../../maps/constants';

// Tiles that may appear in AreaDefinition.map. TileType.EXIT is render-only
// (the renderer selects it for cells that overlap an area.exits zone) and must
// never be stored in map data — narrowing the array type makes that invariant
// compiler-enforced instead of convention.
export type StoredTile = TileType.FLOOR | TileType.WALL;

export interface NpcDefinition {
  id: string;
  name: string;
  col: number;
  row: number;
  // Retained for editor's map-overview mode — the game scene now renders via sprite.
  color: number;
  sprite: string;
  wanderRadius: number;
  awarenessRadius: number;
  // Optional flag-driven spawn gate. NPCs without a spawnCondition spawn
  // unconditionally on area load (existing behavior). NPCs with a spawnCondition
  // spawn only when evaluateCondition returns true at area load OR when a
  // referenced flag changes value mid-session. GameScene parses each
  // spawnCondition for flag names and subscribes per-flag via onFlagChange;
  // when any subscribed flag changes, the conditional-spawn pass re-evaluates
  // and any newly-eligible NPC fades in (alpha 0 -> 1, KEEPER_FADE_DURATION_MS).
  // Idempotent — already-spawned NPCs are skipped on re-evaluation.
  spawnCondition?: string;
}

export interface DialogueChoice {
  text: string;
  nextId: string;
  setFlags?: Record<string, string | number | boolean>;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  nextId?: string;
  choices?: DialogueChoice[];
  portraitId?: string;
  // Optional flag side-effects fired when the node is shown, BEFORE the
  // typewriter starts. Mirrors the DialogueChoice.setFlags shape so the
  // authoring vocabulary stays consistent. Used by US-72 (Keeper rescue) so
  // the action node atomically sets has_ember_mark, keeper_met, and
  // marsh_trapped: false in one place — downstream onFlagChange subscribers
  // (overlay create on has_ember_mark; collision/decoration restore on
  // marsh_trapped) fire within the same call stack as showNode.
  setFlags?: Record<string, string | number | boolean>;
}

export interface DialogueScript {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
  portraitId?: string;
  // Optional story scene id launched on dialogue close. GameScene's setOnEnd
  // callback reads DialogueSystem.getEndStoryScene() AFTER flushSave (so the
  // world state is checkpointed before the story scene pauses GameScene) and
  // calls launchStoryScene with the id. Existing scripts without this field
  // close as before — no story scene launch.
  endStoryScene?: string;
}

export interface StoryBeat {
  text: string;
  imageKey?: string;
  imageColor?: number;
  imageLabel?: string;
}

export interface StorySceneDefinition {
  id: string;
  beats: StoryBeat[];
}

export type TriggerType = 'dialogue' | 'story' | 'thought' | 'exit';

export interface TriggerDefinition {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
  type: TriggerType;
  actionRef: string;
  condition?: string;
  // Optional flag side-effects fired AFTER the one-shot bookkeeping and
  // condition gate, BEFORE the type dispatch — so a downstream callback that
  // reads the flag in the same frame sees the new value. Mirrors the
  // DialogueChoice.setFlags shape so the authoring vocabulary is consistent.
  setFlags?: Record<string, string | number | boolean>;
  // Optional flag counters incremented on every fire. Each entry calls
  // incrementFlag(name) — used by repeatable triggers that need to advance a
  // counter (e.g. escape_attempts band escalation in fog-marsh).
  incrementFlags?: string[];
  repeatable: boolean;
}

export interface ExitDefinition {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
  destinationAreaId: string;
  entryPoint: { col: number; row: number };
  condition?: string;
}

export interface PropDefinition {
  id: string;
  col: number;
  row: number;
  spriteFrame: string;
}

// Tile-snapped decoration overlay. Distinct from PropDefinition: decorations are
// strictly 1×1 atlas frames composed by area authors to build visual vocabulary
// (paths, building walls/roofs, fences, water edges, doors-as-decoration). They
// render at depth 2 — above base tiles, below props — and contribute zero to
// collision (the underlying FLOOR/WALL cell still controls walkability).
export interface DecorationDefinition {
  col: number;
  row: number;
  spriteFrame: string;
  // Optional flag-driven visibility gate. When present, the decoration sprite
  // is created at scene start but its visibility tracks evaluateCondition.
  // GameScene re-evaluates conditional decorations only on flag-change events
  // (Learning EP-01: no per-frame full re-render). Existing decorations without
  // a condition render unconditionally as today.
  condition?: string;
}

export interface AreaDefinition {
  id: string;
  name: string;
  map: StoredTile[][];
  mapCols: number;
  mapRows: number;
  tileset: string;
  npcs: NpcDefinition[];
  props: PropDefinition[];
  decorations: DecorationDefinition[];
  triggers: TriggerDefinition[];
  dialogues: Record<string, DialogueScript>;
  storyScenes: Record<string, StorySceneDefinition>;
  playerSpawn: { col: number; row: number };
  exits: ExitDefinition[];
  // Retained for editor's map-overview mode — the game scene now renders via tileset.
  visual: { floorColor: number; wallColor: number };
}
