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
}

export interface DialogueScript {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
  portraitId?: string;
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
