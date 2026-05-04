// Briar Wilds (US-100) — Stage 4 of Pip's pilgrim journey, the trials beat.
// Skeleton commit: walkable area + west-edge return to Ashen Isle + 2 drain
// zones + 2 quiet zones (one carries the closing reflection). PixelLab Wang
// tileset and style-matched objects (US-95/96 pattern) land in subsequent
// tasks; this skeleton uses the placeholder tileset 'briar-wilds-floor-thorn'
// (atlasKey points to ashen-isle-grass-sand) so the build is green and the
// path is walkable end-to-end before the visual content arrives.
//
// Zero NPCs in this area — by design (the trial is endured alone, US-100).

import {
  AreaDefinition,
  StoredTile,
  TILE_FLOOR,
  deriveTerrainFromTileMap,
  deriveObjectsFromTileMap,
  DrainZoneDefinition,
  QuietZoneDefinition,
  TriggerDefinition,
  DecorationDefinition,
} from './types';

const F = TILE_FLOOR;

// 32 wide × 26 tall — exceeds the spec floor of 30×24. All-floor for the
// skeleton; thorn impassable patches are introduced when the PixelLab object
// kinds (bramble-cluster / dead-tree) land.
const briarTileMap: StoredTile[][] = Array.from({ length: 26 }, () =>
  Array.from({ length: 32 }, () => F as StoredTile),
);

// ───── Drain zones (US-102) ─────
// Two patches with internal-weariness doubt lines. Tone is the believer's
// own discouragement — never external menace, never cruel.
const drainZones: DrainZoneDefinition[] = [
  {
    id: 'drain-1',
    col: 8,
    row: 8,
    width: 4,
    height: 3,
    doubts: {
      lines: [
        'This path is too long...',
        'Did the Ember really change anything?',
        'You should have stayed at the village...',
      ],
    },
  },
  {
    id: 'drain-2',
    col: 18,
    row: 16,
    width: 4,
    height: 3,
    doubts: {
      lines: [
        'No one knows you are out here.',
        'The light is so small now.',
        'Maybe the brambles never really parted...',
      ],
    },
  },
];

// ───── Quiet places (US-103) ─────
// Two clearings. quiet-grove is a small mid-area rest. quiet-closing is the
// far-east clearing that carries the closing-reflection narration AND is
// co-located with a one-shot trigger that flips briar_wilds_complete (the
// "separate setFlags mechanism" per US-103 spec — narration handled by the
// quiet zone, flag flip handled by the trigger system).
const quietZones: QuietZoneDefinition[] = [
  {
    id: 'quiet-grove',
    col: 14,
    row: 5,
    width: 3,
    height: 3,
    narration: {
      lines: ["Pip's ember steadies.", 'The bramble parts here.'],
    },
  },
  {
    id: 'quiet-closing',
    col: 27,
    row: 11,
    width: 4,
    height: 4,
    narration: {
      lines: [
        'The wilds end at this clearing.',
        'Pip looks back — bright pockets of grace, where she left them.',
        'A long stone bridge waits ahead, its stones scarred by something old...',
      ],
    },
  },
];

// ───── Triggers ─────
// Co-located with quiet-closing's tiles — the same place serves restoration
// (quiet zone) and the journey-turn flag (this trigger). Empty actionRef
// because the narration is fired by the quiet zone, not this trigger.
const triggers: TriggerDefinition[] = [
  {
    id: 'briar-wilds-complete',
    col: 28,
    row: 12,
    width: 2,
    height: 2,
    type: 'thought',
    actionRef: '',
    condition: 'briar_wilds_complete == false',
    setFlags: { briar_wilds_complete: true },
    repeatable: false,
  },
];

// Skeleton has no decorations — PixelLab object kinds populate sparse thorn
// scatter and dead-tree clusters in T11. Empty array preserves the
// AreaDefinition contract.
const decorations: DecorationDefinition[] = [];

export const briarWilds: AreaDefinition = {
  id: 'briar-wilds',
  name: 'Briar Wilds',
  mapCols: 32,
  mapRows: 26,
  // Tileset placeholder — entry exists in TILESETS pointing at the
  // ashen-isle-grass-sand atlas until T9's PixelLab generation lands.
  tileset: 'briar-wilds-floor-thorn',
  decorationsTileset: 'tiny-town',
  map: briarTileMap,
  // Vertex grid all 'briar-floor' (passable). Thorn patches arrive with the
  // PixelLab tileset content + object placement in T9-T11.
  terrain: deriveTerrainFromTileMap(briarTileMap, 'briar-floor'),
  // No wall-class objects — the skeleton has no impassable cells. Object
  // kinds (bramble-cluster, dead-tree, twisted-root) land in T10/T11.
  objects: deriveObjectsFromTileMap(briarTileMap, 'wall-stone'),
  npcs: [],
  props: [],
  decorations,
  triggers,
  dialogues: {},
  storyScenes: {},
  drainZones,
  quietZones,
  // Player enters from the west edge. Exit back to Ashen Isle on the same edge.
  playerSpawn: { col: 1, row: 13 },
  exits: [
    {
      // West-edge return to Ashen Isle — drops the player at the east-exit
      // approach tile so back-and-forth navigation is symmetric.
      id: 'briar-to-ashen',
      col: 0,
      row: 12,
      width: 1,
      height: 3,
      destinationAreaId: 'ashen-isle',
      entryPoint: { col: 48, row: 18 },
    },
  ],
  visual: { floorColor: 0x4a5a4a, wallColor: 0x2a2a30 },
};
