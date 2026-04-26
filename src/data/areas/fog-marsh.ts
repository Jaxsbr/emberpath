import { TileType } from '../../maps/constants';
import { AreaDefinition, DecorationDefinition, StoredTile } from './types';

const F = TileType.FLOOR;
const W = TileType.WALL;

// Tiny Dungeon atlas frame vocabulary used by Fog Marsh. Verified against
// the labeled atlas (see docs/tilesets/tiny-dungeon.md). Tiny Dungeon is a
// dungeon tileset — every "marsh" element is a substitute. Topology is
// authoritative; individual frames can be swapped one-line at a time.
const FRAME = {
  // Dry path — wooden plank frames so the path reads as a boardwalk over
  // the (tan) damp base floor.
  PATH_A: '36',          // wooden plank (variant A)
  PATH_B: '37',          // wooden plank (variant B)
  // Marsh-edge — three dark-blue frames cycled along the impassable left
  // band. Read as deep water / pool, the closest thing Tiny Dungeon has.
  EDGE_A: '33',
  EDGE_B: '34',
  EDGE_C: '35',
  // Ruin walls — proper stone-block wall frames with mortar pattern cycled
  // around the ruin's perimeter (visually distinct from the tan dungeon
  // floor under the player's feet).
  RUIN_A: '4',
  RUIN_B: '5',
  RUIN_C: '16',
  // Ruin door — same wooden door frame the engine uses for EXIT, retained per
  // the schematic's "diegetic exit / ruin door" requirement.
  DOOR: '22',
  // Reeds — Tiny Dungeon has no vegetation frames; log-pile frames are the
  // closest "small, organic clumps growing in the marsh" substitute.
  REED_A: '92',
  REED_B: '93',
  // Whispering Stones — bones-and-rubble floor frame as the visual cue at
  // the trigger position; reads as "old debris on the path side."
  STONES: '24',
} as const;

// Builder helpers (mirrored from ashen-isle.ts; intentionally duplicated to
// keep each area file self-contained — extract to a shared module if a third
// data-driven area lands).

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

// =============================================================================
// Map (collision data) — composed programmatically. Wet base FLOOR everywhere
// except: outer perimeter (W), the ruin walls in the NE corner (W with FLOOR
// at the door), and a wide impassable south band (W) with the EXIT cut into it.
// =============================================================================

function buildFogMarshMap(): StoredTile[][] {
  const m: StoredTile[][] = [];
  for (let r = 0; r < 24; r++) {
    m.push(new Array<StoredTile>(30).fill(F));
  }

  // Outer perimeter — top, bottom, left, right.
  for (let r = 0; r < 24; r++) {
    m[r][0] = W;
    m[r][29] = W;
  }
  for (let c = 0; c < 30; c++) {
    m[0][c] = W;
    m[23][c] = W;
  }

  // Reinforce the south impassable band (row 22) — the schematic shows an
  // edge of impassable wet ground with the EXIT zone cut into it at cols
  // 13-16. Mark all of row 22 as W except the exit cells (which stay FLOOR
  // so the player can walk into them and trip the exit zone).
  for (let c = 0; c < 30; c++) {
    m[22][c] = W;
  }
  for (let c = 13; c <= 16; c++) {
    m[22][c] = F;
  }

  // Reinforce the north impassable band (row 1) — row 0 is already W; row 1
  // also W so the marsh feels enclosed at the top.
  for (let c = 0; c < 30; c++) {
    m[1][c] = W;
  }

  // Ruin walls in the NE corner — outline at rows 3-9 cols 21-27 with door
  // FLOOR at (24, 9). Interior cells stay FLOOR so the player can step inside.
  for (let c = 21; c <= 27; c++) {
    m[3][c] = W;
    m[9][c] = W;
  }
  for (let r = 4; r <= 8; r++) {
    m[r][21] = W;
    m[r][27] = W;
  }
  m[9][24] = F;

  return m;
}

// =============================================================================
// Decorations — visible vocabulary composed over the collision map.
// =============================================================================

const PATH_VARIANTS = [FRAME.PATH_A, FRAME.PATH_B];
const EDGE_VARIANTS = [FRAME.EDGE_A, FRAME.EDGE_B, FRAME.EDGE_C];

const fogMarshDecorations: DecorationDefinition[] = [
  // Marsh-edge "deep water" along the impassable left band — rows 1-22
  // cols 0-1 — reads as "you cannot go this way; the marsh is too deep."
  // Cycled across three frames so no single edge frame dominates the count.
  ...rectVariants(0, 1, 1, 22, EDGE_VARIANTS),

  // Dry path — vertical south-to-north col 14 rows 10-21, then horizontal
  // east on row 10 cols 15-24 to the Marsh Hermit's stoop adjacent to the
  // ruin's door. Cycled across two path frames so neither dominates.
  ...rectVariants(14, 14, 10, 21, PATH_VARIANTS),
  ...rectVariants(15, 24, 10, 10, PATH_VARIANTS),

  // Ruin walls in the NE corner. Top + bottom rows + left + right cols — the
  // door cell at (24, 9) is intentionally skipped so the wooden door frame
  // shows through.
  ...rectVariants(21, 27, 3, 3, [FRAME.RUIN_A, FRAME.RUIN_B, FRAME.RUIN_C]),
  ...rectVariants(21, 21, 4, 8, [FRAME.RUIN_A, FRAME.RUIN_B, FRAME.RUIN_C]),
  ...rectVariants(27, 27, 4, 8, [FRAME.RUIN_A, FRAME.RUIN_B, FRAME.RUIN_C]),
  ...rect(21, 23, 9, 9, FRAME.RUIN_A),
  ...rect(25, 27, 9, 9, FRAME.RUIN_A),

  // Ruin door — wooden door frame in the south wall of the ruin (mirrors
  // the engine's existing TileType.EXIT rendering — same semantic, different
  // role here).
  { col: 24, row: 9, spriteFrame: FRAME.DOOR },

  // Reeds / vegetation in the wet interior — eight scattered entries placed
  // strictly OFF the dry path (col 14 rows 10-21 and cols 15-24 row 10 are
  // the path; nothing here lands on those cells). Two-frame variant keeps
  // the marsh from looking stamped.
  { col: 5, row: 4, spriteFrame: FRAME.REED_A },
  { col: 9, row: 6, spriteFrame: FRAME.REED_B },
  { col: 17, row: 5, spriteFrame: FRAME.REED_A },
  { col: 5, row: 12, spriteFrame: FRAME.REED_B },
  { col: 9, row: 14, spriteFrame: FRAME.REED_A },
  { col: 19, row: 13, spriteFrame: FRAME.REED_B },
  { col: 5, row: 18, spriteFrame: FRAME.REED_A },
  { col: 19, row: 19, spriteFrame: FRAME.REED_B },
  { col: 22, row: 16, spriteFrame: FRAME.REED_A },
  { col: 7, row: 20, spriteFrame: FRAME.REED_B },

  // Whispering Stones — small carved-stone visual cue immediately west of
  // the path, sitting beside the trigger zone at (13, 16) so the player sees
  // it as they walk past on the path.
  { col: 13, row: 16, spriteFrame: FRAME.STONES },
];

export const fogMarsh: AreaDefinition = {
  id: 'fog-marsh',
  name: 'Fog Marsh',
  mapCols: 30,
  mapRows: 24,
  tileset: 'tiny-dungeon',
  map: buildFogMarshMap(),
  npcs: [
    // Marsh Hermit on the dry path immediately south of the ruin's door at
    // (24, 9); his spawn at (24, 10) is the path tile adjacent to the door.
    { id: 'marsh-hermit', name: 'Marsh Hermit', col: 24, row: 10, color: 0x5a7a6b, sprite: 'marsh-hermit', wanderRadius: 1, awarenessRadius: 3 },
  ],
  // Tile-snapped layout vocabulary lives in `decorations` below; the prior
  // dungeon-prop list assumed the old "stone pen" map and would now sit on
  // top of edge or ruin cells. Future props can return as the world grows.
  props: [],
  decorations: fogMarshDecorations,
  triggers: [
    {
      // Fires as the player takes their first northward step from the south
      // entry along the dry path — preserves the original "fog air" thought.
      id: 'fog-entry-thought',
      col: 13,
      row: 18,
      width: 3,
      height: 1,
      type: 'thought',
      actionRef: 'The air is thick here. Each breath tastes of damp earth and something older.',
      repeatable: false,
    },
    {
      // Fires only after the player has spoken with the Marsh Hermit, so the
      // story scene caps the conversational thread. Placed on the path side
      // so the player walks back south through it after the conversation.
      id: 'marsh-vision',
      col: 14,
      row: 14,
      width: 1,
      height: 2,
      type: 'story',
      actionRef: 'marsh-depths',
      condition: 'spoke_to_marsh_hermit == true',
      repeatable: false,
    },
    {
      // Whispering Stones — re-positioned to (13, 16) per schematic, immediately
      // west of the dry path so the player triggers it just by passing by.
      id: 'whispering-stones',
      col: 13,
      row: 16,
      width: 1,
      height: 1,
      type: 'dialogue',
      actionRef: 'whispering-stones',
      repeatable: true,
    },
    {
      // Threshold north of the Marsh Hermit (10, 24) — crossing this band sets
      // marsh_trapped, which closes the south exit (US-67) and swaps the path
      // decorations to deep-water EDGE frames (US-68). One-shot; player-walked
      // entry only — direct loads at playerSpawn (14, 12) do not fire it.
      id: 'marsh-deepens',
      col: 14,
      row: 5,
      width: 1,
      height: 2,
      type: 'thought',
      actionRef: 'The fog rolls in behind me. The path is gone.',
      repeatable: false,
      setFlags: { marsh_trapped: true },
    },
  ],
  dialogues: {
    'marsh-hermit-intro': {
      id: 'marsh-hermit-intro',
      startNodeId: 'greeting',
      portraitId: 'marsh-hermit',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Marsh Hermit',
          text: 'Another soul wandering into the fog? Most turn back before reaching this far.',
          nextId: 'question',
        },
        {
          id: 'question',
          speaker: 'Marsh Hermit',
          text: 'The marsh tests those who enter. What do you seek here?',
          choices: [
            { text: 'A way through the fog.', nextId: 'way-through', setFlags: { spoke_to_marsh_hermit: true } },
            { text: 'I followed a path from the Ashen Isle.', nextId: 'from-ashen', setFlags: { spoke_to_marsh_hermit: true } },
          ],
        },
        {
          id: 'way-through',
          speaker: 'Marsh Hermit',
          text: 'Through? There is no through. Only deeper. But deeper is sometimes where the light hides.',
          nextId: 'advice',
        },
        {
          id: 'from-ashen',
          speaker: 'Marsh Hermit',
          text: 'The Ashen Isle... I remember it. Grey skies and old men with older stories.',
          nextId: 'advice',
        },
        {
          id: 'advice',
          speaker: 'Marsh Hermit',
          text: 'Listen to the stones if you can. They remember what the fog has forgotten.',
        },
      ],
    },
    'whispering-stones': {
      id: 'whispering-stones',
      startNodeId: 'whisper',
      nodes: [
        {
          id: 'whisper',
          speaker: 'Whispering Stones',
          text: 'The stones hum with a low vibration. Words form at the edge of hearing...',
          nextId: 'message',
        },
        {
          id: 'message',
          speaker: 'Whispering Stones',
          text: '"The ember does not die. It waits beneath the ash for one who will carry it."',
        },
      ],
    },
  },
  storyScenes: {
    'marsh-depths': {
      id: 'marsh-depths',
      beats: [
        {
          text: 'The fog parts for a moment. Below the murky water, something glows — faint and warm, like a coal refusing to die.',
          imageColor: 0x2a3a2a,
          imageLabel: 'Glowing depths',
        },
        {
          text: 'A voice, not heard but felt: "What was lost can be found. What was broken can be mended. But first, you must see."',
          imageColor: 0x3a4a3a,
          imageLabel: 'Voice in the fog',
        },
      ],
    },
  },
  // Direct-load spawn lands the player on the dry path mid-marsh. Transitions
  // from Ashen Isle land them at the south entry instead (see Ashen Isle's
  // exit-to-fog entryPoint).
  playerSpawn: { col: 14, row: 12 },
  exits: [
    {
      // Walk south off the dry path into the EXIT zone at row 22 cols 13-16
      // and arrive on Ashen Isle just south of the dock.
      id: 'fog-to-ashen',
      col: 13,
      row: 22,
      width: 4,
      height: 1,
      destinationAreaId: 'ashen-isle',
      entryPoint: { col: 24, row: 4 },
    },
  ],
  visual: { floorColor: 0x3a4a3a, wallColor: 0x1a2a1a },
};
