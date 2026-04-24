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
  color: number;
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
}

export interface DialogueScript {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
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

export interface AreaDefinition {
  id: string;
  name: string;
  map: StoredTile[][];
  mapCols: number;
  mapRows: number;
  tileset: string;
  npcs: NpcDefinition[];
  props: PropDefinition[];
  triggers: TriggerDefinition[];
  dialogues: Record<string, DialogueScript>;
  storyScenes: Record<string, StorySceneDefinition>;
  playerSpawn: { col: number; row: number };
  exits: ExitDefinition[];
  // Retained for editor's map-overview mode — the game scene now renders via tileset.
  visual: { floorColor: number; wallColor: number };
}
