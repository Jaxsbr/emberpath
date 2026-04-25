import { TileType } from '../../maps/constants';
import { AreaDefinition, DecorationDefinition, StoredTile } from './types';

const F = TileType.FLOOR;
const W = TileType.WALL;

// Tiny Town atlas frame vocabulary used by Ashen Isle.
// See docs/tilesets/tiny-town.md (US-61) for the full per-frame intent and
// the reasoning behind each pick. Frames marked PROVISIONAL are best-guess
// picks based on visual atlas inspection — swap them in tiny-town.md without
// touching topology if any read wrong.
const FRAME = {
  CLIFF_A: '120',        // PROVISIONAL — stone block (variant A) standing in for water (Tiny Town has no water tiles)
  CLIFF_B: '121',        // PROVISIONAL — stone block (variant B) — keeps no single cliff frame above 30% of decoration count
  CLIFF_C: '122',        // PROVISIONAL — stone block (variant C)
  PATH: '16',            // PROVISIONAL — small dirt patch
  DOCK: '17',            // PROVISIONAL — wooden boardwalk substitute (no true dock frame in atlas)
  FENCE: '128',          // wooden fence (per docs/plan/tileset-frame-analysis.md row 10)
  ROOF: '60',            // PROVISIONAL — red roof segment
  WALL_FRONT: '72',      // PROVISIONAL — wall front with window
  DOOR: '96',            // PROVISIONAL — door front
  BUSH: '28',            // bush (existing prop frame)
  FLOWER: '26',          // flower cluster (existing prop frame)
  SIGN: '27',            // sign post (existing prop frame)
  TREE: '6',             // pine tree (existing prop frame)
} as const;

// Builder helpers — keep the decorations array readable. Each helper returns
// a flat DecorationDefinition[] that can be spread into the main array.

function rect(col0: number, col1: number, row0: number, row1: number, frame: string): DecorationDefinition[] {
  const out: DecorationDefinition[] = [];
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      out.push({ col: c, row: r, spriteFrame: frame });
    }
  }
  return out;
}

function hline(col0: number, col1: number, row: number, frame: string): DecorationDefinition[] {
  return rect(col0, col1, row, row, frame);
}

function vline(col: number, row0: number, row1: number, frame: string): DecorationDefinition[] {
  return rect(col, col, row0, row1, frame);
}

// Filled rectangle that cycles through a frame palette per cell so no single
// frame dominates the decoration tally (US-59 done-when ≤30% per frame).
function rectVariants(
  col0: number,
  col1: number,
  row0: number,
  row1: number,
  frames: string[],
): DecorationDefinition[] {
  const out: DecorationDefinition[] = [];
  let i = 0;
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) {
      out.push({ col: c, row: r, spriteFrame: frames[i % frames.length] });
      i++;
    }
  }
  return out;
}

// Fenced rectangle perimeter (no infill), with optional gate cell skipped.
function fencePerimeter(
  col0: number,
  col1: number,
  row0: number,
  row1: number,
  frame: string,
  gate?: { col: number; row: number },
): DecorationDefinition[] {
  const out: DecorationDefinition[] = [];
  const isGate = (c: number, r: number) => gate?.col === c && gate?.row === r;
  for (let c = col0; c <= col1; c++) {
    if (!isGate(c, row0)) out.push({ col: c, row: row0, spriteFrame: frame });
    if (!isGate(c, row1)) out.push({ col: c, row: row1, spriteFrame: frame });
  }
  for (let r = row0 + 1; r <= row1 - 1; r++) {
    if (!isGate(col0, r)) out.push({ col: col0, row: r, spriteFrame: frame });
    if (!isGate(col1, r)) out.push({ col: col1, row: r, spriteFrame: frame });
  }
  return out;
}

// =============================================================================
// Map (collision data) — composed programmatically rather than as a 38×50 ASCII
// grid, so the structural intent (cliff coast, building outlines, fence runs,
// door / gate gaps) reads in code instead of dot-arithmetic. The decoration
// layer below renders the visible representation; the map only controls
// walkability.
// =============================================================================

function buildAshenMap(): StoredTile[][] {
  const m: StoredTile[][] = [];
  for (let r = 0; r < 38; r++) {
    m.push(new Array<StoredTile>(50).fill(F));
  }

  // Outer perimeter — keep all 4 map edges as WALL so the player can never
  // step off the world even if a downstream phase removes a coast row.
  for (let r = 0; r < 38; r++) {
    m[r][0] = W;
    m[r][49] = W;
  }
  for (let c = 0; c < 50; c++) {
    m[0][c] = W;
    m[37][c] = W;
  }

  // North coast cliff — rows 1-3 are WALL (cliff face) with two FLOOR breaks:
  // (a) row 2 cols 23-26 carry the dock / exit zone, (b) row 3 cols 24-25
  // carry the path coming south off the dock.
  for (let c = 0; c < 50; c++) {
    m[1][c] = W;
    m[2][c] = W;
    m[3][c] = W;
  }
  for (let c = 23; c <= 26; c++) m[2][c] = F;
  for (let c = 24; c <= 25; c++) m[3][c] = F;

  // Player's cottage — rows 12-15 cols 8-12 are WALL except the door cell at
  // (10, 15) which stays FLOOR so dialogue can pose the player in the doorway.
  for (let r = 12; r <= 15; r++) {
    for (let c = 8; c <= 12; c++) {
      m[r][c] = W;
    }
  }
  m[15][10] = F;

  // Player's fenced yard — perimeter at rows 11-19 cols 5-14 with gate at
  // (9, 19) to the south path branch.
  for (let c = 5; c <= 14; c++) {
    m[11][c] = W;
    m[19][c] = W;
  }
  for (let r = 12; r <= 18; r++) {
    m[r][5] = W;
    m[r][14] = W;
  }
  m[19][9] = F;

  // Old Man's cottage — rows 24-28 cols 38-42 WALL with door at (40, 28) FLOOR.
  for (let r = 24; r <= 28; r++) {
    for (let c = 38; c <= 42; c++) {
      m[r][c] = W;
    }
  }
  m[28][40] = F;

  // Old Man's fenced yard — perimeter at rows 23-31 cols 35-44 with gate at
  // (39, 23) to the east path branch.
  for (let c = 35; c <= 44; c++) {
    m[23][c] = W;
    m[31][c] = W;
  }
  for (let r = 24; r <= 30; r++) {
    m[r][35] = W;
    m[r][44] = W;
  }
  m[23][39] = F;

  return m;
}

// =============================================================================
// Decorations — visible vocabulary composed over the collision map.
// =============================================================================

const CLIFF_VARIANTS = [FRAME.CLIFF_A, FRAME.CLIFF_B, FRAME.CLIFF_C];

const ashenDecorations: DecorationDefinition[] = [
  // North coast — cliff (substituting for water) on rows 0-3 with dock /
  // path breaks. Rows 0-1 are full-width cliff (the open water beyond the
  // shore); rows 2-3 are cliff on either side of the dock/path break so the
  // dock reads as cutting through the rocky shore.
  ...rectVariants(0, 49, 0, 1, CLIFF_VARIANTS),
  ...rectVariants(0, 22, 2, 3, CLIFF_VARIANTS),
  ...rectVariants(27, 49, 2, 3, CLIFF_VARIANTS),

  // Dock at exit zone — wooden boardwalk reads as the way off the island.
  ...hline(23, 26, 2, FRAME.DOCK),

  // Main vertical path — cols 24 + 25 from the dock down to the south edge.
  ...vline(24, 4, 36, FRAME.PATH),
  ...vline(25, 4, 36, FRAME.PATH),

  // West branch — row 20 cols 10-23, joining the player's gate to the main path.
  ...hline(10, 23, 20, FRAME.PATH),

  // East branch — row 22 cols 26-41, joining the main path to the Old Man's gate.
  ...hline(26, 41, 22, FRAME.PATH),

  // Player's cottage — 5×4 building at rows 12-15 cols 8-12.
  ...hline(8, 12, 12, FRAME.ROOF),
  ...hline(8, 12, 13, FRAME.ROOF),
  ...hline(8, 12, 14, FRAME.WALL_FRONT),
  ...hline(8, 9, 15, FRAME.WALL_FRONT),
  { col: 10, row: 15, spriteFrame: FRAME.DOOR },
  ...hline(11, 12, 15, FRAME.WALL_FRONT),

  // Player's fenced yard perimeter at rows 11-19 cols 5-14, gate at (9, 19).
  ...fencePerimeter(5, 14, 11, 19, FRAME.FENCE, { col: 9, row: 19 }),

  // Old Man's cottage — 5×4 building at rows 24-28 cols 38-42.
  ...hline(38, 42, 24, FRAME.ROOF),
  ...hline(38, 42, 25, FRAME.ROOF),
  ...hline(38, 42, 26, FRAME.WALL_FRONT),
  ...hline(38, 42, 27, FRAME.WALL_FRONT),
  ...hline(38, 39, 28, FRAME.WALL_FRONT),
  { col: 40, row: 28, spriteFrame: FRAME.DOOR },
  ...hline(41, 42, 28, FRAME.WALL_FRONT),

  // Old Man's fenced yard perimeter at rows 23-31 cols 35-44, gate at (39, 23).
  ...fencePerimeter(35, 44, 23, 31, FRAME.FENCE, { col: 39, row: 23 }),

  // Yard-interior path inside Old Man's yard — runs from the gate at (39, 23)
  // south to the Old Man's stoop at (39, 28), placing him on a path tile
  // adjacent to his door at (40, 28) (US-59 done-when).
  ...vline(39, 24, 28, FRAME.PATH),

  // Scattered decorations across open grass — sign by the dock plus a mix of
  // bushes, trees, and flowers in the bands away from the path so no single
  // frame dominates the decoration vocabulary.
  { col: 26, row: 5, spriteFrame: FRAME.SIGN },
  { col: 8, row: 6, spriteFrame: FRAME.TREE },
  { col: 36, row: 7, spriteFrame: FRAME.TREE },
  { col: 3, row: 9, spriteFrame: FRAME.TREE },
  { col: 28, row: 10, spriteFrame: FRAME.FLOWER },
  { col: 12, row: 32, spriteFrame: FRAME.TREE },
  { col: 6, row: 34, spriteFrame: FRAME.FLOWER },
  { col: 44, row: 25, spriteFrame: FRAME.BUSH },
  { col: 30, row: 33, spriteFrame: FRAME.BUSH },
];

export const ashenIsle: AreaDefinition = {
  id: 'ashen-isle',
  name: 'Ashen Isle',
  mapCols: 50,
  mapRows: 38,
  tileset: 'tiny-town',
  map: buildAshenMap(),
  npcs: [
    // Old Man stands on the yard-interior path one step west of his cottage
    // door at (40, 28); his spawn at (39, 28) is the path tile adjacent to
    // the door.
    { id: 'old-man', name: 'Old Man', col: 39, row: 28, color: 0x8b6914, sprite: 'old-man', wanderRadius: 1, awarenessRadius: 3 },
  ],
  // Tile-snapped layout vocabulary lives in `decorations` below; props are
  // intentionally empty during the world-legibility phase — the prior
  // scattered prop list assumed the old "stone pen" map and would now sit on
  // top of cliff or fence cells. Future props can return as the world grows.
  props: [],
  decorations: ashenDecorations,
  triggers: [
    {
      // Fires as the player takes their first eastward step on the west path
      // branch — the spawn-adjacent grass-thought from the original layout.
      id: 'start-thought',
      col: 11,
      row: 20,
      width: 3,
      height: 1,
      type: 'thought',
      actionRef: 'Where am I? Everything feels... grey.',
      repeatable: false,
    },
    {
      // South interior — fires only after the player has spoken with the
      // Old Man, so the story scene caps the conversational thread.
      id: 'ashen-isle-vision',
      col: 24,
      row: 33,
      width: 2,
      height: 2,
      type: 'story',
      actionRef: 'ashen-isle-intro',
      condition: 'spoke_to_old_man == true',
      repeatable: false,
    },
    {
      // South-west — repeatable ambient thought as the player explores.
      id: 'room-echo',
      col: 3,
      row: 32,
      width: 2,
      height: 2,
      type: 'thought',
      actionRef: 'The walls hum faintly, as if remembering something.',
      repeatable: true,
    },
  ],
  dialogues: {
    'old-man-intro': {
      id: 'old-man-intro',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'Ah, a traveler. These ashen lands have not seen a soul in ages.',
          nextId: 'ask-choice',
        },
        {
          id: 'ask-choice',
          speaker: 'Old Man',
          text: 'Tell me, what brings you to the Ashen Isle?',
          choices: [
            { text: 'I seek the path forward.', nextId: 'path-response' },
            { text: 'I woke up here. I remember nothing.', nextId: 'memory-response' },
            { text: 'Who are you?', nextId: 'identity-response' },
          ],
        },
        {
          id: 'path-response',
          speaker: 'Old Man',
          text: 'The path... yes. There is a way through the fog, but it demands more than courage.',
          nextId: 'path-choice',
        },
        {
          id: 'path-choice',
          speaker: 'Old Man',
          text: 'Will you listen to what I know of it?',
          choices: [
            { text: 'Yes, tell me everything.', nextId: 'path-detail', setFlags: { spoke_to_old_man: true } },
            { text: 'I will find my own way.', nextId: 'farewell-alone' },
          ],
        },
        {
          id: 'path-detail',
          speaker: 'Old Man',
          text: 'Beyond the fog lies a bridge of embers. Only those who carry a light within can cross it. Remember that.',
        },
        {
          id: 'farewell-alone',
          speaker: 'Old Man',
          text: 'Bold words. The fog cares nothing for bravery alone. But go, if you must.',
        },
        {
          id: 'memory-response',
          speaker: 'Old Man',
          text: 'You remember nothing? Then perhaps you were brought here for a reason. The Isle does not call to just anyone.',
          nextId: 'memory-advice',
        },
        {
          id: 'memory-advice',
          speaker: 'Old Man',
          text: 'Explore. Speak to the stones and the silence. The answers are here, if you look.',
        },
        {
          id: 'identity-response',
          speaker: 'Old Man',
          text: 'Who am I? Just a keeper of stories. I have watched the embers fade and the fog roll in, season after season.',
          nextId: 'identity-offer',
        },
        {
          id: 'identity-offer',
          speaker: 'Old Man',
          text: 'But enough about me. You have a journey ahead.',
        },
      ],
    },
  },
  storyScenes: {
    'ashen-isle-intro': {
      id: 'ashen-isle-intro',
      beats: [
        {
          text: 'You open your eyes to a grey sky. Ash drifts like snow, settling on everything.',
          imageColor: 0x3a3a4a,
          imageLabel: 'Ashen sky',
        },
        {
          text: 'The ground beneath you is cracked and dry. A faint warmth rises from below, as though the earth itself remembers fire.',
          imageColor: 0x5a4030,
          imageLabel: 'Cracked earth',
        },
        {
          text: 'In the distance, a thin trail of smoke curls upward. Someone — or something — is out there.',
          imageColor: 0x2a2a3a,
          imageLabel: 'Distant smoke',
        },
        {
          text: 'You stand. Your legs feel heavy, but your heart feels heavier. You cannot remember how you got here.',
          imageColor: 0x444455,
          imageLabel: 'Standing figure',
        },
      ],
    },
  },
  playerSpawn: { col: 9, row: 20 },
  exits: [
    {
      // Dock at the north coast — leaves Ashen Isle by walking onto the
      // boardwalk decoration. Fog Marsh's reciprocal entryPoint will move
      // onto its own dry path during US-60; for now players still arrive at
      // the existing fog-marsh entry tile.
      id: 'ashen-to-fog',
      col: 23,
      row: 2,
      width: 4,
      height: 1,
      destinationAreaId: 'fog-marsh',
      entryPoint: { col: 2, row: 12 },
    },
  ],
  visual: { floorColor: 0x4a6741, wallColor: 0x2c2c3a },
};
