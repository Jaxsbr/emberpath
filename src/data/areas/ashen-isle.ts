import {
  AreaDefinition,
  DecorationDefinition,
  InscribedStoneDefinition,
  StoredTile,
  TILE_FLOOR,
  TILE_WALL,
  deriveTerrainFromTileMap,
  deriveObjectsFromTileMap,
} from './types';
import { TerrainId } from '../../maps/terrain';

const F = TILE_FLOOR;
const W = TILE_WALL;

// Tiny Town atlas frame vocabulary used by Ashen Isle. Verified against the
// labeled atlas (see docs/tilesets/tiny-town.md). Topology is authoritative;
// individual frames can be swapped one-line at a time without touching map
// or composition shape.
const FRAME = {
  CLIFF_A: '120',        // light grey stone block (variant A) — substitutes for water (Tiny Town has no water tiles)
  CLIFF_B: '121',        // light grey stone block (variant B) — keeps no single cliff frame above 30% of decoration count
  CLIFF_C: '122',        // light grey stone block (variant C)
  PATH: '51',            // tan dirt path with grass border — clear "trodden" surface
  DOCK: '55',            // green cobblestone — distinct surface marking the exit zone
  FENCE: '80',           // horizontal wooden plank — fence panel
  ROOF: '64',            // red roof segment with white pattern
  WALL_FRONT: '72',      // brown wall middle — pairs with red roof
  DOOR: '97',            // brown wall with brown wooden door
  BUSH: '30',            // green bush cluster
  FLOWER: '22',          // yellow mushroom — substitute for flower (no true flower clusters in atlas)
  SIGN: '95',            // sign post
  TREE: '6',             // pine tree
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
  gates?: { col: number; row: number } | { col: number; row: number }[],
): DecorationDefinition[] {
  const gateList = gates ? (Array.isArray(gates) ? gates : [gates]) : [];
  const isGate = (c: number, r: number): boolean => {
    for (let i = 0; i < gateList.length; i++) {
      if (gateList[i].col === c && gateList[i].row === r) return true;
    }
    return false;
  };
  const out: DecorationDefinition[] = [];
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

  // Old Man's fenced yard — perimeter at rows 23-31 cols 35-44 with gates at
  // (39, 23) north and (39, 31) south. The south gate (US-78) opens a path
  // from below so the player can reach the Old Man without trekking all the
  // way around the cottage from the north — a recent map pass had walled him
  // in entirely.
  for (let c = 35; c <= 44; c++) {
    m[23][c] = W;
    m[31][c] = W;
  }
  for (let r = 24; r <= 30; r++) {
    m[r][35] = W;
    m[r][44] = W;
  }
  m[23][39] = F;
  m[31][39] = F;

  return m;
}

// =============================================================================
// Decorations — visible vocabulary composed over the collision map.
// =============================================================================

// Decorations are now reserved for the one element that needs a feature the
// object layer lacks: the US-81 post-Ember reveal sign, which couples an
// `alphaGatedByLight` flag with a tier-2 `light` (ObjectInstance has neither).
// Every other structure — paths, buildings, fences, trees — moved to real
// terrain (paths) or PixelLab style-matched objects (everything else) below,
// retiring the tiny-town frame atlas that desaturated into grey "gravestones."
const ashenDecorations: DecorationDefinition[] = [
  // Post-Ember reveal (US-81). A sign on the dock path that is INVISIBLE
  // pre-Ember — the player walked past it without seeing it. Once Pip carries
  // the Ember, the tier-2 light at this position renders, and the alpha-gated
  // decoration becomes visible. Paired with the 'ashen-isle-mark' trigger below
  // to fire the "someone walked this way before me" thought when crossed.
  {
    col: 24,
    row: 5,
    spriteFrame: FRAME.SIGN,
    alphaGatedByLight: true,
    light: { tier: 2, radius: 56, intensity: 0.4 },
  },
];

// ───── Ashen Isle objects (US-98 legibility overhaul) ─────
// The old map rendered paths/fences/buildings/scenery from the tiny-town
// decoration atlas, which desaturated into grey gravestone-like blocks
// (Jaco feedback 2026-06-13: "why is everything made of gravestones"). They are
// re-authored here as PixelLab style-matched objects so the world reads as a
// real lived-in island. Collision parity is preserved: every building/fence
// object is `passable: false` (same as the WALL cells it replaces); doors are
// walkable (see objects.ts). The map-edge perimeter keeps its derived
// wall-stone border for collision; only the visible interior structures change.
type OInst = import('../../maps/objects').ObjectInstance;

function rectObjects(col0: number, col1: number, row0: number, row1: number, kind: OInst['kind']): OInst[] {
  const out: OInst[] = [];
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) out.push({ kind, col: c, row: r });
  }
  return out;
}

// Fence perimeter as fence-rail objects (mirrors the old `fencePerimeter`
// decoration helper, with the same gate gaps left open / walkable).
function fenceObjects(
  col0: number,
  col1: number,
  row0: number,
  row1: number,
  gates: { col: number; row: number }[],
): OInst[] {
  const isGate = (c: number, r: number): boolean =>
    gates.some((g) => g.col === c && g.row === r);
  const out: OInst[] = [];
  for (let c = col0; c <= col1; c++) {
    if (!isGate(c, row0)) out.push({ kind: 'fence-rail', col: c, row: row0 });
    if (!isGate(c, row1)) out.push({ kind: 'fence-rail', col: c, row: row1 });
  }
  for (let r = row0 + 1; r <= row1 - 1; r++) {
    if (!isGate(col0, r)) out.push({ kind: 'fence-rail', col: col0, row: r });
    if (!isGate(col1, r)) out.push({ kind: 'fence-rail', col: col1, row: r });
  }
  return out;
}

// Two cohesive cottages (PixelLab, 2026-06-14) replace the old per-tile Kenney
// house blocks (Jaco: "our house is a joke"). Each is ONE 4×4 cottage image
// (`cottage` kind) with collision laid as `collision-block` cells under the
// upper body (roof + walls); the bottom front/door row is left walkable so the
// player walks right up to the doorway — and the Old Man still poses in his open
// doorway at (40,28). Object collision keys the anchor cell only, hence the
// explicit collision-block grid rather than relying on the cottage footprint.
function cottage(anchorCol: number, anchorRow: number): OInst[] {
  return [
    ...rectObjects(anchorCol, anchorCol + 3, anchorRow, anchorRow + 2, 'collision-block'),
    { kind: 'cottage', col: anchorCol, row: anchorRow },
  ];
}

const ashenBuildings: OInst[] = [
  ...cottage(9, 12), // player's cottage in the west yard
  ...cottage(39, 25), // Old Man's cottage; doorway lands at his pose cell (40,28)
];

const ashenFences: OInst[] = [
  // Player's yard (rows 11-19 cols 5-14), gate at (9,19).
  ...fenceObjects(5, 14, 11, 19, [{ col: 9, row: 19 }]),
  // Old Man's yard (rows 23-31 cols 35-44), gates north (39,23) + south (39,31).
  ...fenceObjects(35, 44, 23, 31, [
    { col: 39, row: 23 },
    { col: 39, row: 31 },
  ]),
];

// Dock signpost only — the trees moved to clustered groves below.
const ashenScenery: OInst[] = [
  { kind: 'sign-wood', col: 26, row: 5 },
];

// ───── Tree groves (Jaco directives #344 + #346, 2026-06-14) ─────
// Replaces the old loose scatter ("Random loose placed trees, there is no
// cohesion" — #344). Trees are now CLUSTERED into 8 groves of 3-4, mixed
// oak+pine, with overlapping canopies and dense undergrowth packed around each
// base (ashenUndergrowth below). Each tree is a 3×4 `tall` object (#346): the
// high-top-down canopy fills the top, the trunk base sits at the bottom-center
// cell (anchor +1,+3), Y-sorts against Pip, and collides on the trunk cell only
// so she walks around and under the canopy. Trunk cells + impassable undergrowth
// are kept OFF every path (lane cols 24-25; west branch row 20 cols 9-23; east
// branch row 22 cols 26-41), both fenced yards, NPC poses (Wren 22,18 / Old Man
// 40,28 / Driftwood 32,6), the dock (rows 0-3), the east brambles (47-49 rows
// 17-19), and the spawn (9,20). Groves frame the map edges; the lit lane stays a
// clearing. Anchor (col,row) → canopy rows row..row+2, trunk base cell (col+1,
// row+3).
const ashenGroves: OInst[] = [
  // NW corner treeline
  { kind: 'tree-oak', col: 2, row: 4 }, { kind: 'tree-pine', col: 5, row: 4 },
  { kind: 'tree-pine', col: 3, row: 7 }, { kind: 'tree-oak', col: 7, row: 6 },
  // North-central (between the yard top and the lane)
  { kind: 'tree-pine', col: 15, row: 5 }, { kind: 'tree-oak', col: 18, row: 4 },
  { kind: 'tree-pine', col: 17, row: 7 },
  // NE corner
  { kind: 'tree-oak', col: 42, row: 4 }, { kind: 'tree-pine', col: 45, row: 5 },
  { kind: 'tree-oak', col: 43, row: 8 },
  // SW grove (just south of spawn — the demonstrative grove)
  { kind: 'tree-pine', col: 3, row: 26 }, { kind: 'tree-oak', col: 6, row: 27 },
  { kind: 'tree-pine', col: 2, row: 30 }, { kind: 'tree-oak', col: 8, row: 30 },
  // South-central
  { kind: 'tree-oak', col: 15, row: 28 }, { kind: 'tree-pine', col: 18, row: 29 },
  { kind: 'tree-pine', col: 14, row: 31 },
  // SE, left of the Old Man's yard
  { kind: 'tree-oak', col: 27, row: 30 }, { kind: 'tree-pine', col: 30, row: 30 },
  { kind: 'tree-oak', col: 29, row: 32 },
  // SE, right of the Old Man's yard
  { kind: 'tree-pine', col: 45, row: 27 }, { kind: 'tree-oak', col: 46, row: 29 },
  { kind: 'tree-pine', col: 45, row: 31 },
];

// Dense undergrowth packed around each grove's trunks (#344 — "shrubs are dense
// around them"). Passable bush/flower/grass-tuft fill the gaps so each grove
// reads as a thicket-with-clearing, not lawn ornaments; a few impassable `rock`
// boulders anchor the edges (all kept off paths/yards). Grouped per grove.
const ashenUndergrowth: OInst[] = [
  // NW grove (trunks ~3,7 / 6,7 / 4,10 / 8,9)
  { kind: 'bush', col: 2, row: 8 }, { kind: 'bush', col: 5, row: 8 },
  { kind: 'grass-tuft', col: 4, row: 9 }, { kind: 'grass-tuft', col: 7, row: 8 },
  { kind: 'flower', col: 6, row: 10 }, { kind: 'rock', col: 1, row: 6 },
  { kind: 'bush', col: 9, row: 9 }, { kind: 'grass-tuft', col: 3, row: 11 },
  // North-central grove (trunks ~16,8 / 19,7 / 18,10)
  { kind: 'bush', col: 15, row: 8 }, { kind: 'grass-tuft', col: 17, row: 9 },
  { kind: 'flower', col: 19, row: 9 }, { kind: 'bush', col: 20, row: 8 },
  { kind: 'grass-tuft', col: 16, row: 11 }, { kind: 'rock', col: 21, row: 10 },
  // NE grove (trunks ~43,7 / 46,8 / 44,11)
  { kind: 'bush', col: 42, row: 8 }, { kind: 'grass-tuft', col: 45, row: 9 },
  { kind: 'flower', col: 43, row: 10 }, { kind: 'bush', col: 46, row: 11 },
  { kind: 'rock', col: 48, row: 7 }, { kind: 'grass-tuft', col: 44, row: 12 },
  // SW grove (trunks ~4,29 / 7,30 / 3,33 / 9,33)
  { kind: 'bush', col: 3, row: 30 }, { kind: 'bush', col: 6, row: 31 },
  { kind: 'grass-tuft', col: 5, row: 32 }, { kind: 'grass-tuft', col: 8, row: 31 },
  { kind: 'flower', col: 4, row: 34 }, { kind: 'flower', col: 7, row: 34 },
  { kind: 'rock', col: 1, row: 31 }, { kind: 'bush', col: 10, row: 33 },
  { kind: 'grass-tuft', col: 2, row: 28 },
  // South-central grove (trunks ~16,31 / 19,32 / 15,34)
  { kind: 'bush', col: 16, row: 32 }, { kind: 'grass-tuft', col: 18, row: 33 },
  { kind: 'flower', col: 14, row: 33 }, { kind: 'bush', col: 20, row: 32 },
  { kind: 'rock', col: 21, row: 31 }, { kind: 'grass-tuft', col: 17, row: 35 },
  // SE-left grove (trunks ~28,33 / 31,33 / 30,35)
  { kind: 'bush', col: 27, row: 33 }, { kind: 'grass-tuft', col: 29, row: 34 },
  { kind: 'flower', col: 31, row: 34 }, { kind: 'bush', col: 32, row: 33 },
  { kind: 'rock', col: 33, row: 34 }, { kind: 'grass-tuft', col: 28, row: 35 },
  // SE-right grove (trunks ~46,30 / 48,32 / 46,34)
  { kind: 'bush', col: 45, row: 31 }, { kind: 'grass-tuft', col: 47, row: 32 },
  { kind: 'flower', col: 46, row: 33 }, { kind: 'bush', col: 48, row: 34 },
  { kind: 'rock', col: 46, row: 28 }, { kind: 'grass-tuft', col: 45, row: 35 },
];

// ───── Decoration density pass (2026-06-14, Jaco directive #332) ─────
// The island read as bare grey floor between a few sparse props ("lacks so
// much"). This dresses it to the density of a real top-down village
// (ref/terrain-ground/test_map_1.png): boulders lining the sand paths, grass
// tufts filling the open bands, flower clusters, and bushes flanking the cottage
// doorways. Everything here is set-dressing — grass-tuft/flower/bush are
// passable; `rock` is impassable but sits BESIDE the paths in open grass (never
// on a path cell, gate, door approach, or fence), so it adds texture without
// ever blocking a route. Cells checked against: main lane cols 24-25 rows 4-36,
// west branch row 20 cols 9-23, east branch row 22 cols 26-41, both fenced yards.
const ashenDressing: OInst[] = [
  // Boulders beside the path edges + a couple as open-grass landmarks.
  { kind: 'rock', col: 23, row: 8 },
  { kind: 'rock', col: 26, row: 12 },
  { kind: 'rock', col: 23, row: 28 },
  { kind: 'rock', col: 26, row: 32 },
  { kind: 'rock', col: 8, row: 21 },
  { kind: 'rock', col: 22, row: 21 },
  { kind: 'rock', col: 30, row: 23 },
  { kind: 'rock', col: 37, row: 21 },
  { kind: 'rock', col: 45, row: 33 },
  // Grass tufts — fill the open bands (NW, central, around both yards, south).
  { kind: 'grass-tuft', col: 3, row: 6 },
  { kind: 'grass-tuft', col: 7, row: 9 },
  { kind: 'grass-tuft', col: 2, row: 12 },
  { kind: 'grass-tuft', col: 16, row: 5 },
  { kind: 'grass-tuft', col: 19, row: 9 },
  { kind: 'grass-tuft', col: 14, row: 3 },
  { kind: 'grass-tuft', col: 4, row: 16 },
  { kind: 'grass-tuft', col: 15, row: 16 },
  { kind: 'grass-tuft', col: 6, row: 21 },
  { kind: 'grass-tuft', col: 28, row: 14 },
  { kind: 'grass-tuft', col: 30, row: 18 },
  { kind: 'grass-tuft', col: 20, row: 28 },
  { kind: 'grass-tuft', col: 16, row: 26 },
  { kind: 'grass-tuft', col: 34, row: 26 },
  { kind: 'grass-tuft', col: 45, row: 28 },
  { kind: 'grass-tuft', col: 37, row: 33 },
  { kind: 'grass-tuft', col: 33, row: 29 },
  { kind: 'grass-tuft', col: 8, row: 34 },
  { kind: 'grass-tuft', col: 20, row: 34 },
  { kind: 'grass-tuft', col: 10, row: 28 },
  // Flower clusters (grouped with the existing singles for a "bed" feel).
  { kind: 'flower', col: 8, row: 17 },
  { kind: 'flower', col: 11, row: 17 },
  { kind: 'flower', col: 27, row: 11 },
  { kind: 'flower', col: 29, row: 12 },
  { kind: 'flower', col: 7, row: 34 },
  // Bushes flanking the Old Man's doorway (the player's yard is dressed as a
  // full tended garden in ashenHomeGarden below).
  { kind: 'bush', col: 38, row: 29 },
  { kind: 'bush', col: 42, row: 29 },
];

// ───── Player's cottage garden (Jaco #482, 2026-06-15) ─────
// The opening homestead read as a nice house marooned in a uniform field with a
// thin, hard-to-read fence — "dev-tutorial vibes." This dresses the fenced yard
// (rows 12-18, cols 6-13, around the 4×4 cottage and the central walkway) as a
// lived-in garden: flower & herb beds along both inner fence lines, bushes
// flanking the door, and a soft border framing the walkway. All passable
// (flower/bush/grass-tuft) and kept entirely OFF the door cell (10,15) and the
// walkway (cols 9-10 rows 16-18) so the player always walks straight in.
const ashenHomeGarden: OInst[] = [
  // West bed — along the inner fence (col 5), flanking the door's west side.
  { kind: 'flower', col: 6, row: 12 }, { kind: 'flower', col: 7, row: 12 },
  { kind: 'bush', col: 6, row: 13 }, { kind: 'flower', col: 7, row: 13 },
  { kind: 'bush', col: 7, row: 14 },
  { kind: 'flower', col: 6, row: 15 }, { kind: 'bush', col: 6, row: 16 },
  { kind: 'flower', col: 7, row: 16 }, { kind: 'bush', col: 6, row: 17 },
  { kind: 'flower', col: 6, row: 18 }, { kind: 'grass-tuft', col: 7, row: 18 },
  // East bed — along the inner fence (col 14), flanking the door's east side.
  { kind: 'bush', col: 13, row: 12 }, { kind: 'flower', col: 13, row: 13 },
  { kind: 'bush', col: 13, row: 14 },
  { kind: 'flower', col: 13, row: 15 }, { kind: 'bush', col: 13, row: 16 },
  { kind: 'flower', col: 13, row: 17 }, { kind: 'grass-tuft', col: 13, row: 18 },
  // South border — frames the walkway as it leaves the door.
  { kind: 'grass-tuft', col: 8, row: 17 }, { kind: 'flower', col: 8, row: 18 },
  { kind: 'grass-tuft', col: 11, row: 17 }, { kind: 'flower', col: 11, row: 18 },
  { kind: 'bush', col: 12, row: 18 },
];

// ───── East-edge bramble objects (US-100) ─────
// Conditional ObjectInstances using the PixelLab bramble-cluster asset. Each
// cell is impassable while has_ember_mark == false — collision and visibility
// flip together when the Ember is granted (existing conditional-object path).
// Replaces the earlier BUSH-decoration placeholder; brambles now both LOOK
// like brambles and physically block the path pre-Ember.
// Dock props — weathered sepia/umber world objects (PixelLab, 2026-06-13) that
// dress the otherwise-bare exit landing so the dock reads as a real, lived-in
// shore rather than a blank cobble strip. Placed on the dock FLOOR cells flanking
// the 24-25 walking lane (so they never block the exit) with the water/cliff edge
// immediately beside each: a rowboat moored at the west edge, a cargo barrel at
// the east edge. Impassable.
// Dock furniture — a wooden pier reaching off the north shore out over the
// water, a rowboat moored at its seaward end, and a cargo barrel on the beach
// beside it. The pier (2×3) and boat (2×2) render at true scale via their
// `footprint`; both anchor in the impassable sea (rows 0-1) so they decorate
// without blocking the walkable shore or the exit landing. The player walks the
// path up cols 24-25 onto the pier head (row 2 = the ashen->fog exit zone).
const ashenDockProps: import('../../maps/objects').ObjectInstance[] = [
  { kind: 'pier-wood', col: 24, row: 0 },
  { kind: 'boat-row', col: 26, row: 0 },
  { kind: 'barrel-wood', col: 22, row: 2 },
];

const ashenEastBrambles: import('../../maps/objects').ObjectInstance[] = [
  { kind: 'bramble-cluster', col: 47, row: 17, condition: 'has_ember_mark == false' },
  { kind: 'bramble-cluster', col: 47, row: 18, condition: 'has_ember_mark == false' },
  { kind: 'bramble-cluster', col: 48, row: 17, condition: 'has_ember_mark == false' },
  { kind: 'bramble-cluster', col: 48, row: 18, condition: 'has_ember_mark == false' },
  { kind: 'bramble-cluster', col: 49, row: 18, condition: 'has_ember_mark == false' },
  { kind: 'bramble-cluster', col: 49, row: 19, condition: 'has_ember_mark == false' },
];

// bearing-fruit (Beat 7) — visible fruit of the journey. After the heart-bridge
// seal (`atoned == true`), life returns to the two homes Pip warmed: small
// flower blooms appear where there was only grey before. Gated on `atoned`
// alone (single persisted flag → robust live re-eval on flag change and on
// scene re-entry) so the world visibly answers the change in Pip, not just the
// dialogue. Cells are open yard/clearing floor, clear of the cottage footprint
// (anchor 39,25 → cols 39-42 rows 25-28) and Wren's wander core (22,18, r2).
const ashenFruitBlooms: import('../../maps/objects').ObjectInstance[] = [
  // Old Man's yard — blooms flanking his doorway
  { kind: 'flower', col: 37, row: 30, condition: 'atoned == true' },
  { kind: 'flower', col: 38, row: 30, condition: 'atoned == true' },
  { kind: 'flower', col: 42, row: 30, condition: 'atoned == true' },
  { kind: 'flower', col: 43, row: 30, condition: 'atoned == true' },
  // Wren's clearing — two bloom clusters flanking where she sings (clustered,
  // not scattered per #344), just outside her r2 wander core
  { kind: 'flower', col: 19, row: 18, condition: 'atoned == true' },
  { kind: 'flower', col: 19, row: 19, condition: 'atoned == true' },
  { kind: 'flower', col: 25, row: 18, condition: 'atoned == true' },
  { kind: 'flower', col: 25, row: 19, condition: 'atoned == true' },
];

// the-word phase (US-W5) — a retroactive inscribed stone at the village's east
// edge, beside the Briar gate. SPRITE + collision is a carved `cliff-stone` (the
// same object Briar's stone uses, so "inscribed stone" reads consistently); the
// `remember` verb + lines live in `ashenInscribedStones` below — keep this cell
// in sync with `ashen-word-stone`'s col/row. Sits one tile NW of the Briar→Ashen
// return corridor (player re-enters at 48,18 and walks west along row 18), clear
// of the conditional east brambles (47-49) so the two never overlap pre-ember.
// The payoff is reachable: the Word is granted in Briar, and Briar's west exit
// returns here — a curious player who walks back can finally read the marks.
const ashenWordStone: OInst[] = [{ kind: 'cliff-stone', col: 46, row: 17 }];

// the-word phase (US-W5). Before the Word the marks are just cold carving Pip
// cannot read; once Quill gives the Word in Briar, a player who walks back west
// can remember here. No steadyRadius — Ashen has no drain zones, so this stone is
// a flavour/wayfinding reveal (the spec's "earlier-area stones are not required
// for the mechanic"), not a steadied patch. Lines are young-child level and
// allegorical (the marks remember that Pip was known and loved first, and that
// the light she carries was given, not earned) — no named scripture, per master-prd.
const ashenInscribedStones: InscribedStoneDefinition[] = [
  {
    id: 'ashen-stone-1',
    col: 46,
    row: 17,
    preWordThought: 'Old words are carved on this stone. Pip cannot read them yet.',
    rememberedLines: [
      'These words were carved long before Pip was born.',
      'You were known before you could speak. You were loved first.',
      'The light you carry was given to you. It will not leave you.',
    ],
  },
];

// Stage-1 migration source: the existing FLOOR/WALL authoring array remains
// the source of truth, with terrain + objects derived from it via the helpers
// in types.ts. US-98 replaces this with hand-painted vertex data + authored
// objects.
const ashenTileMap = buildAshenMap();

// Cells now covered by explicit building/fence objects — excluded from the
// derived wall-stone border so collision isn't doubled and no grey block draws
// under the new art. Doors (FLOOR cells) are harmless extras in this set.
const explicitWallCells = new Set<string>(
  [...ashenBuildings, ...ashenFences].map((o) => `${o.col},${o.row}`),
);
// The new cottages cover less ground than the old per-tile house blocks, but the
// FULL original footprints were WALL cells in the source map. Drop the derived
// wall-stone across those whole rectangles so no stray grey block draws beside
// the cottage art (collision now comes from the cottage collision-block grid).
for (const f of [
  { c0: 8, c1: 12, r0: 12, r1: 15 }, // old player house
  { c0: 38, c1: 42, r0: 24, r1: 28 }, // old Old-Man house
]) {
  for (let r = f.r0; r <= f.r1; r++) {
    for (let c = f.c0; c <= f.c1; c++) explicitWallCells.add(`${c},${r}`);
  }
}
// Derived wall-stone, kept ONLY for the world-edge perimeter: drop the north
// coast (rows 0-3, now water/beach terrain) and every explicitly-objectified
// building/fence cell. What survives is the thin map-edge border collision.
const ashenBorderWalls: OInst[] = deriveObjectsFromTileMap(ashenTileMap, 'wall-stone').filter(
  (o) => o.row > 3 && !explicitWallCells.has(`${o.col},${o.row}`),
);

// North-coast terrain paint (US-98). `deriveTerrainFromTileMap` fills the whole
// vertex grid with grass; here we overpaint the top rows so the coast is real
// water meeting a sand beach instead of the old faked grey cliff. Terrain is a
// (rows+1)×(cols+1) vertex grid; a cell blocks only when ALL 4 of its vertices
// are impassable, so:
//   vertex rows 0-2 = water  -> cells in rows 0-1 are all-water (impassable sea)
//   vertex row 3    = sand   -> cell row 2 blends water/sand (the passable
//                               shoreline landing), cell row 3 blends sand/grass
// The matching all-water cells render via `ashen-isle-sand-water` (the only
// tileset with water as primary); the shore cells pick it for their water/sand
// vertex pair. Coast `wall-stone` objects are dropped below so no grey blocks
// draw over the water — rows 0-1 stay blocked by the all-water terrain, and the
// beach (rows 2-3) becomes walkable, which is natural and harmless.
function buildAshenTerrain(): TerrainId[][] {
  const t = deriveTerrainFromTileMap(ashenTileMap, 'grass');
  const cols = ashenTileMap[0].length; // 50 cells -> 51 vertices (0..50)
  for (let c = 0; c <= cols; c++) {
    t[0][c] = 'water';
    t[1][c] = 'water';
    t[2][c] = 'water';
    t[3][c] = 'sand';
  }
  // Walkable paths painted as `sand` terrain so they render via the existing
  // grass-sand Wang tileset — a warm, trodden sandy lane with feathered grassy
  // edges — instead of the old tiny-town frame-51 decoration that desaturated
  // into a column of grey "gravestone" blocks (Jaco feedback 2026-06-13). To
  // make a CELL fully sand, all 4 of its vertices must be sand; the edge cells
  // pick up a natural grass/sand transition. Path cells (matching the old
  // PATH decoration runs): main lane cols 24-25 rows 4-36, the spawn→main west
  // branch row 20 cols 9-23, and the main→Old-Man east branch row 22 cols 26-41.
  const paintCellSand = (col: number, row: number): void => {
    for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const vr = row + dr;
      const vc = col + dc;
      if (t[vr] && t[vr][vc] !== undefined) t[vr][vc] = 'sand';
    }
  };
  for (let r = 4; r <= 36; r++) {
    paintCellSand(24, r);
    paintCellSand(25, r);
  }
  for (let c = 9; c <= 23; c++) paintCellSand(c, 20);
  for (let c = 26; c <= 41; c++) paintCellSand(c, 22);
  // Cottage walkway (Jaco #482 — the home read as "marooned"). A short tended
  // path from the door (10,15) down through the yard to the gate (9,19), two
  // cells wide where the yard allows, so the homestead connects to the west
  // branch lane (row 20) instead of floating on bare grass. All cells are FLOOR
  // inside the fenced yard; (9,19) is the gate.
  for (const [c, r] of [[9, 16], [10, 16], [9, 17], [10, 17], [9, 18], [10, 18], [9, 19]] as [number, number][]) {
    paintCellSand(c, r);
  }
  return t;
}

export const ashenIsle: AreaDefinition = {
  id: 'ashen-isle',
  name: 'Ashen Isle',
  mapCols: 50,
  mapRows: 38,
  tileset: 'ashen-isle-grass-sand',
  decorationsTileset: 'tiny-town',
  map: ashenTileMap,
  terrain: buildAshenTerrain(),
  objects: [
    // Map-edge perimeter only. Auto-derived wall-stone is dropped on (a) the
    // north coast rows 0-3 (now impassable all-water + walkable beach terrain)
    // and (b) every cell now covered by an explicit building/fence object, so
    // no grey block draws under the new art or re-introduces the gravestone
    // coast/structures Jaco flagged. What remains is the thin world-edge border.
    ...ashenBorderWalls,
    ...ashenBuildings,
    ...ashenFences,
    ...ashenScenery,
    ...ashenDressing,
    ...ashenHomeGarden,
    ...ashenGroves,
    ...ashenUndergrowth,
    ...ashenDockProps,
    ...ashenEastBrambles,
    ...ashenFruitBlooms,
    ...ashenWordStone,
  ],
  inscribedStones: ashenInscribedStones,
  npcs: [
    // Old Man stands in the doorway of his cottage (40, 28 — the door FLOOR
    // tile). With wanderRadius 1 he drifts a step south to (40, 29) and back,
    // an unsteady silhouette in the doorway. Player reaches him via the
    // north or south gate of the yard (added below). lightOverride.intensity
    // dim so he reads as a faint silhouette through fog (US-75).
    { id: 'old-man', name: 'Old Man', col: 40, row: 28, color: 0x8b6914, sprite: 'old-man', wanderRadius: 1, awarenessRadius: 3, lightOverride: { intensity: 0.15 } },
    // Wren — the hopeful one (US-82). Stands in the central open area, well
    // clear of the player's cottage (cols 8-12 rows 12-15), Old Man's cottage
    // (cols 38-42 rows 24-28), and the dock (rows 1-5). FLOOR tile assumption
    // is safe — no walls, fences, or props are placed at (22, 18) by the map
    // builder. wanderRadius 2 lets the chirpy young wren bounce a bit;
    // awarenessRadius 3 matches Old Man so she halts at the same proximity.
    // No lightOverride — defaults to LIGHTING_CONFIG.npcRadius / npcIntensity,
    // and the warming subscriber (US-85) re-registers brighter on warm.
    { id: 'wren', name: 'Wren', col: 22, row: 18, color: 0x8b5a3c, sprite: 'wren', wanderRadius: 2, awarenessRadius: 3 },
    // Driftwood — the charming refusal (US-83). Stands near the dock — the
    // shore tile region (rows 4-7) per spec. (32, 6) is a FLOOR tile in the
    // open dock zone, > 2 tiles from Wren (22, 18) and Old Man (40, 28), and
    // visually distinct from the existing dock-adjacent ashen-isle-mark
    // trigger at (24, 5). lightOverride: lower intensity makes Driftwood read
    // as "lit by his own thing" — a worldly light, not the Ember (criterion
    // for US-83). wanderRadius 1 keeps him hovering at the dock; awarenessRadius
    // 3 matches the others.
    { id: 'driftwood', name: 'Driftwood', col: 32, row: 6, color: 0x4d2f1a, sprite: 'driftwood', wanderRadius: 1, awarenessRadius: 3, lightOverride: { intensity: 0.18 } },
  ],
  // Tile-snapped layout vocabulary lives in `decorations` below; props are
  // intentionally empty during the world-legibility phase — the prior
  // scattered prop list assumed the old "stone pen" map and would now sit on
  // top of cliff or fence cells. Future props can return as the world grows.
  props: [],
  decorations: ashenDecorations,
  triggers: [
    {
      // Post-Ember reveal trigger (US-81). Tier-2 — invisible pre-Ember, lit
      // post-Ember. Fires the first time the player walks over this tile while
      // carrying the Ember; one-shot. Hints at beat 3 (the Heart Bridge —
      // "someone walked this way before me, wounded" — without naming it).
      // Paired with the alpha-gated SIGN decoration at the same position.
      id: 'ashen-isle-mark',
      col: 24,
      row: 5,
      width: 1,
      height: 1,
      type: 'thought',
      actionRef: 'A warm mark on the dock. Someone walked here before me.',
      condition: 'has_ember_mark == true',
      repeatable: false,
    },
    {
      // Fires as the player takes their first eastward step on the west path
      // branch — the spawn-adjacent grass-thought. Repurposed for C2-a to echo
      // the cinematic's goal as a concrete next step, so the very first thought
      // after the intro points forward ("find the smoke") rather than restating
      // the confusion the intro already set up.
      id: 'start-thought',
      col: 11,
      row: 20,
      width: 3,
      height: 1,
      type: 'thought',
      actionRef: 'I should find that smoke. Someone is out there.',
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
      actionRef: 'The walls make a soft sound. Like they remember something.',
      repeatable: true,
    },
    {
      // Homecoming reflection (US-86). One-shot, condition-gated, fires after
      // both Wren AND Old Man are warmed and the player walks through the
      // village-centre tile. setFlags { homecoming_complete: true } closes the
      // beat — the spec's soft turn toward Briar Wilds. (24, 22) sits in the
      // open grass between Wren (22, 18) and Old Man (40, 28); the player
      // naturally walks this tile when returning to the Old Man for the
      // post-Wren warming, OR when leaving Old Man toward the dock. Multi-line
      // text via \n — Phaser Text renders newlines natively, the bubble
      // measures dynamic width/height per request (thoughtBubble.ts).
      id: 'homecoming-reflection',
      col: 24,
      row: 22,
      width: 1,
      height: 1,
      type: 'thought',
      actionRef:
        'I helped two of them feel warm.\n' +
        'I will carry my light with me.\n' +
        'There is more light to share, far past this island...',
      condition: 'npc_warmed_wren == true AND npc_warmed_old_man == true AND homecoming_complete == false',
      repeatable: false,
      setFlags: { homecoming_complete: true },
    },
    {
      // Bearing-fruit arrival thought (Beat 7, Jaco routing 2026-06-16). One-shot,
      // fires when Pip steps back into the west yard after the heart-bridge seal
      // (the onward exit now lands her at home, col 9 row 20). It frames the
      // return — why she's home and what to look for (her friends, the fruit) —
      // so the revisit reads clearly instead of feeling like a reset. Zone sits
      // just east/south of the home spawn (cols 11-13, rows 21-22) on the natural
      // path toward the village; gated on `atoned` so it only plays on the
      // post-atonement homecoming, once.
      id: 'home-return-thought',
      col: 11,
      row: 21,
      width: 3,
      height: 2,
      type: 'thought',
      actionRef:
        'I crossed the bridge. The grey is gone for good.\n' +
        'My light stayed warm the whole way home.\n' +
        'Let me go and see my friends again.',
      condition: 'atoned == true AND home_return_seen == false',
      repeatable: false,
      setFlags: { home_return_seen: true },
    },
    {
      // East-path first-arrival thought (US-100). One tile west of the east
      // exit so it fires the moment the player commits to the new road. Gated
      // on has_ember_mark + east_path_seen so it plays exactly once after
      // the brambles have parted.
      id: 'east-path-thought',
      col: 47,
      row: 18,
      width: 1,
      height: 1,
      type: 'thought',
      actionRef: 'The thorns have opened up. A road goes east.',
      condition: 'has_ember_mark == true AND east_path_seen == false',
      repeatable: false,
      setFlags: { east_path_seen: true },
    },
  ],
  dialogues: {
    // Old Man Fading dialogue (US-78). Three nodes, ≤200 chars total. Tone:
    // dim, resigned, no exclamations. No theological vocabulary — show, don't
    // preach. The greeting sets spoke_to_old_man as a "met the Old Man" marker
    // (the opening cinematic now plays at New Game start via introStoryScene —
    // C2-a — so this flag no longer gates a story trigger).
    'old-man-intro': {
      id: 'old-man-intro',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'You can walk. I forgot how to do that.',
          nextId: 'middle',
          setFlags: { spoke_to_old_man: true },
        },
        {
          id: 'middle',
          speaker: 'Old Man',
          text: 'I used to shine. The grey fog took it away, bit by bit.',
          nextId: 'farewell',
        },
        {
          id: 'farewell',
          speaker: 'Old Man',
          text: 'Follow your path. Mine has stopped here.',
        },
      ],
    },
    // Post-Ember Old Man dialogue (US-81). Selected by GameScene.selectScriptForNpc
    // when has_ember_mark == true; falls back to old-man-intro when the flag
    // is unset (Reset Progress, fresh New Game). Tone: still short, still dim,
    // but no longer hopeless — the Old Man recognises the light he himself
    // does not carry. The greeting does NOT re-set spoke_to_old_man (the flag
    // is already true from the pre-Ember conversation).
    // old-man-warmed (US-84). Most specific Old Man variant — checked first by
    // selectScriptForNpc (iterates dictionary in insertion order, returns the
    // first whose condition matches). When npc_warmed_old_man is true, this
    // wins over old-man-receptive and old-man-illumined regardless of the
    // other warming flag states. 2 nodes.
    // old-man-fruit (bearing-fruit / Beat 7). Most specific Old Man variant —
    // inserted BEFORE old-man-warmed so selectScriptForNpc (insertion-order,
    // first condition match wins) picks it once Pip has crossed the heart-bridge
    // (`atoned == true`) AND warmed the Old Man. The fruit is generosity that
    // multiplies: the man who hoarded his last warmth now gives it away and
    // finds there is more. Kid-level, no theological vocabulary, allegory intact.
    'old-man-fruit': {
      id: 'old-man-fruit',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      condition: 'atoned == true AND npc_warmed_old_man == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'You came back, friend. Sit — I made enough soup for two.',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Old Man',
          text: 'I used to keep my last bit of warmth for myself. Now I give it away.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Old Man',
          text: 'Funny thing. The more I share it, the more there seems to be.',
        },
      ],
    },
    'old-man-warmed': {
      id: 'old-man-warmed',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      condition: 'npc_warmed_old_man == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'You came back. Come sit with me.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Old Man',
          text: 'I forgot how nice the morning feels. Now I remember.',
        },
      ],
    },
    // old-man-receptive (US-84). Wren has been warmed first — Old Man can now
    // receive. selectScriptForNpc reaches this variant after old-man-warmed
    // (which fails for `npc_warmed_old_man == false`); its longer condition
    // beats old-man-illumined which would otherwise also match. The Share
    // warmth choice fires the pulse via firePulseTarget='old-man'; the
    // GameScene setOnChoice handler sets npc_warmed_old_man=true at pulse
    // landing and the warming subscriber re-registers Old Man's light at
    // brighter values + force-evals alpha-gates on the same tick (US-85).
    'old-man-receptive': {
      id: 'old-man-receptive',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      condition: 'has_ember_mark == true AND npc_warmed_wren == true AND npc_warmed_old_man == false',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'Something woke up in me. The little bird is humming again.',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Old Man',
          text: 'Maybe a small part of me is still here. Just a small part.',
          nextId: 'offer',
        },
        {
          id: 'offer',
          speaker: 'Old Man',
          text: 'If you have a little light to give. I will only ask once.',
          choices: [
            { text: 'Share warmth', nextId: 'received', firePulseTarget: 'old-man' },
            { text: 'Just sitting with you', nextId: 'company' },
          ],
        },
        {
          id: 'received',
          speaker: 'Old Man',
          text: '...oh. Oh.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Old Man',
          text: 'There. Yes. Come see me again when you pass by.',
        },
        {
          id: 'company',
          speaker: 'Old Man',
          text: 'Alright. The chair across is yours.',
        },
      ],
    },
    // old-man-illumined (US-81 + US-84). Post-Ember default when Wren is NOT
    // yet warmed. Existing two nodes preserved; greeting now leads into a
    // middle node with a Share-warmth choice that routes to a wary-decline.
    // The choice has NO firePulseTarget (no pulse on wary-decline per US-84
    // spec) and NO setFlags (no npc_warmed_old_man flip — verifiable via flag
    // store inspection: nothing changes).
    'old-man-illumined': {
      id: 'old-man-illumined',
      startNodeId: 'greeting',
      portraitId: 'old-man',
      condition: 'has_ember_mark == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Old Man',
          text: 'You carry the light now. So you are not faded like me. Not yet.',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Old Man',
          text: 'I have heard hopeful words before. The light always died.',
          choices: [
            { text: 'Share warmth', nextId: 'wary_decline' },
            { text: 'Walk on', nextId: 'farewell' },
          ],
        },
        {
          id: 'wary_decline',
          speaker: 'Old Man',
          text: 'No. Not yet. I was fooled before.',
        },
        {
          id: 'farewell',
          speaker: 'Old Man',
          text: 'Go on. There is so much more than this grey place.',
        },
      ],
    },
    // Wren — the hopeful one (US-82). Three scripts, mutually exclusive at any
    // given world state (selectScriptForNpc walks them in insertion order and
    // returns the first whose condition evaluates true; falls back to the
    // unconditional `wren-intro` when none match). Tone: light, chirpy, young
    // — child voice. Per Gospel principle: "Free gift" (the player chooses to
    // share); per "Mechanical truth" — the warming reads as a felt moment, not
    // exposition. portraitId points to 'wren' even though the portrait file is
    // not yet generated; DialogueSystem's graceful error-fallback logs once
    // and renders no portrait until portrait.png lands (slot-cap blocked).
    // wren-intro is the canonical Wren script — fallback for selectScriptForNpc
    // (no condition; baseId path). The pre-Ember encounter shows greeting →
    // middle → offer node where the "Share warmth" choice is gated by a
    // per-choice condition and hidden until the player carries the Ember.
    // The "Not yet" choice is always visible so the player has a graceful exit
    // pre-Ember and post-Ember-not-ready alike.
    'wren-intro': {
      id: 'wren-intro',
      startNodeId: 'greeting',
      portraitId: 'wren',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Wren',
          text: 'Oh — you walked! I forgot what walking sounds like.',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Wren',
          text: 'Mama said the light comes from inside us. But mine went grey too.',
          nextId: 'offer',
        },
        {
          id: 'offer',
          speaker: 'Wren',
          text: 'Could you... share some? Just a little?',
          choices: [
            {
              text: 'Share warmth',
              nextId: 'grateful',
              firePulseTarget: 'wren',
              condition: 'has_ember_mark == true AND npc_warmed_wren == false',
            },
            // Pre-Ember: Pip can't share a warmth she hasn't received yet. This
            // is honest inability, not refusal — the grace beat. The endThought
            // on `grey-too` sends her toward the smoke to go receive first.
            { text: 'My light is grey too', nextId: 'grey-too', condition: 'has_ember_mark == false' },
            // Post-Ember but not ready to warm Wren yet: a graceful "not now".
            { text: 'Not yet', nextId: 'demure', condition: 'has_ember_mark == true AND npc_warmed_wren == false' },
          ],
        },
        {
          id: 'grateful',
          speaker: 'Wren',
          text: '...!! Oh — oh, that\'s it. That\'s what Mama meant.',
          nextId: 'thanks',
        },
        {
          id: 'thanks',
          speaker: 'Wren',
          text: 'I\'ll keep it close. Thank you.',
        },
        {
          id: 'grey-too',
          speaker: 'Wren',
          text: 'Oh. Yours is grey too. That\'s okay. Go find your light. I\'ll be here.',
          endThought: 'I have no warmth to give yet. I should find the smoke first.',
        },
        {
          id: 'demure',
          speaker: 'Wren',
          text: 'Okay. I\'ll wait. I\'m good at waiting.',
        },
      ],
    },
    // wren-fruit (bearing-fruit / Beat 7). Inserted BEFORE wren-warmed so it
    // wins once `atoned == true` AND Wren was warmed. Her fruit is that the
    // warmth she received now passes ONWARD — the child who got a little light
    // is now the one giving it. Kid-level, joyful, allegory intact.
    'wren-fruit': {
      id: 'wren-fruit',
      startNodeId: 'greeting',
      portraitId: 'wren',
      condition: 'atoned == true AND npc_warmed_wren == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Wren',
          text: 'You\'re back! Listen — I can sing again. The notes don\'t come out grey.',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Wren',
          text: 'I sang for the old man down the path. He smiled. Me! I helped someone.',
        },
      ],
    },
    // wren-warmed — Wren has been warmed; light is brighter, demeanor brighter.
    'wren-warmed': {
      id: 'wren-warmed',
      startNodeId: 'greeting',
      portraitId: 'wren',
      condition: 'npc_warmed_wren == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Wren',
          text: 'You walked back! I hoped you would.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Wren',
          text: 'I can still feel the light. It is warm, right under my wings.',
        },
      ],
    },
    // Driftwood — the charming refusal (US-83). Same script-swap pattern as
    // Wren. Pre-Ember script `driftwood-intro` runs as the fallback. Post-Ember
    // and not-yet-asked script `driftwood-receptive` offers a "Share warmth"
    // choice — but choosing it does NOT set firePulseTarget (refusal produces
    // NO pulse per spec; just a polite-decline node + npc_refused_driftwood
    // setFlag via the choice's setFlags). Once refused, the post-refusal
    // variant `driftwood-refused` swaps in and the Share-warmth choice is
    // absent. Tone: smooth, worldly, knowing. He talks about other lights he
    // has seen — never abrasive, never evil ("No villains" Gospel principle).
    // driftwood-intro is the canonical Driftwood script — fallback for
    // selectScriptForNpc (no condition). Pre-Ember the offer node still plays
    // but the "Share warmth" choice is hidden by its per-choice condition;
    // post-Ember, pre-refusal it appears. Refusal does NOT use firePulseTarget
    // (no pulse on refusal per spec — restoration is given, not taken;
    // refusal returns nothing to Pip but a polite goodbye).
    'driftwood-intro': {
      id: 'driftwood-intro',
      startNodeId: 'greeting',
      portraitId: 'driftwood',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Driftwood',
          text: 'Oh — you can walk. Most can\'t now. Where did you come from, friend?',
          nextId: 'middle',
        },
        {
          id: 'middle',
          speaker: 'Driftwood',
          text: 'I have seen so many islands. Bright ones and grey ones. They all go grey one day.',
          nextId: 'offer',
        },
        {
          id: 'offer',
          speaker: 'Driftwood',
          text: 'I bet you want to share some light? That is kind of you.',
          choices: [
            {
              text: 'Share warmth',
              nextId: 'decline',
              setFlags: { npc_refused_driftwood: true },
              condition: 'has_ember_mark == true AND npc_refused_driftwood == false',
            },
            { text: 'Just talking', nextId: 'small_talk' },
          ],
        },
        {
          id: 'decline',
          speaker: 'Driftwood',
          text: 'That is kind. Really. But I have my own light. The sea and the road. I am okay.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Driftwood',
          text: 'Walk well, friend. I hope your light lasts longer than mine.',
        },
        {
          id: 'small_talk',
          speaker: 'Driftwood',
          text: 'Then stay by the dock a while. The water has seen everyone who passes.',
        },
      ],
    },
    'driftwood-refused': {
      id: 'driftwood-refused',
      startNodeId: 'greeting',
      portraitId: 'driftwood',
      condition: 'npc_refused_driftwood == true',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Driftwood',
          text: 'Still walking? Good. The dock is here when you get tired.',
          nextId: 'parting',
        },
        {
          id: 'parting',
          speaker: 'Driftwood',
          text: 'Take care of that little spark of yours. It is pretty.',
        },
      ],
    },
  },
  storyScenes: {
    'ashen-isle-intro': {
      id: 'ashen-isle-intro',
      // C2-a: opening cinematic, played once at New Game start. Reading level
      // pitched to a young child (Jaco's daughter is the bar — short sentences,
      // common words, concrete images), allegory intact: the world is grey and
      // drained, but a small warm spark waits inside Pip, and the last beat hands
      // the player ONE clear goal — go find the one by the smoke.
      beats: [
        {
          text: 'You wake up. The sky is grey. Soft ash falls down like snow.',
          imageColor: 0x3a3a4a,
          imageLabel: 'Ashen sky',
        },
        {
          text: 'The ground is dry and cracked. But deep inside you, something feels warm. Like a tiny spark.',
          imageColor: 0x5a4030,
          imageLabel: 'Cracked earth',
        },
        {
          text: 'Far away, smoke goes up into the sky. Someone is out there.',
          imageColor: 0x2a2a3a,
          imageLabel: 'Distant smoke',
        },
        {
          text: 'You stand up. You do not know how you got here. The little spark says: go and find them.',
          imageColor: 0x444455,
          imageLabel: 'Standing figure',
        },
      ],
    },
  },
  introStoryScene: 'ashen-isle-intro',
  objective: 'Find the smoke. Someone needs you.',
  // Changing objective (C8 follow-up). The opening goal ("find the smoke") stays
  // until the Keeper grants the Ember in Fog Marsh; coming back to Ashen Isle,
  // the banner now points at the next step instead of the goal already met.
  // First matching entry wins, so the both-warmed line must sit ABOVE the
  // has-ember line. Wayfinding only — the grace beat itself lives in dialogue.
  conditionalObjective: [
    {
      // Bearing-fruit revisit (Beat 7, Jaco routing 2026-06-16). After the
      // heart-bridge seal (`atoned == true`) Pip returns home; the way east is
      // already walked, so point her back into the village to see her friends —
      // where the fruit dialogue + blooms now wait. Sits ABOVE the both-warmed
      // rung so it wins on the post-atonement return. (First match wins.)
      condition: 'atoned == true',
      text: 'You carried the light home. Go and see your friends.',
    },
    {
      // Both villagers warmed → the homecoming is done; point at the road east.
      // Matches the east-path thought's voice ("A road goes east.").
      condition: 'npc_warmed_wren == true AND npc_warmed_old_man == true',
      text: 'You shared your light. Follow the road east.',
    },
    {
      // Has the Ember but the village is still cold → carry it home. "The ones
      // who are waiting" echoes Wren ("I'll wait. I'm good at waiting.").
      condition: 'has_ember_mark == true',
      text: 'Take your light home. Warm the ones who are waiting.',
    },
  ],
  // Wayfinding signposts (C7). The dock post at the north coast (the sign-wood
  // in ashenScenery at 26,5) sits right beside the boardwalk exit to Fog Marsh
  // (exit zone cols 23-26, row 2) — walking up to it now lights the sign and
  // tells the player where that road goes.
  signposts: [
    // The dock exit is NORTH of this post (exit zone row 2). A "→" route arrow
    // read as "go right" (Jaco, 2026-06-14); use an "↑" so the arrow IS the
    // correct direction the player must walk.
    { col: 26, row: 5, label: 'Fog Marsh ↑' },
  ],
  // Distant smoke beacon (C6). The intro promises "Far away, smoke goes up into
  // the sky. Someone is out there." and the objective is "Find the smoke." — this
  // is that smoke: a plume rising from the open water just off the north dock
  // (col 28, row 3 is impassable sea, east of the boats), so when the player
  // reaches the dock they SEE the goal across the water and the C7 sign tells
  // them the dock leads to Fog Marsh.
  smokeBeacon: { col: 28, row: 3 },
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
      entryPoint: { col: 14, row: 21 },
    },
    {
      // East-gated exit to Briar Wilds (US-100). Ember-only — the brambles
      // visually block pre-Ember (conditional decorations) and the condition
      // gate suppresses the transition itself so a player without the Ember
      // who somehow reaches the cell does not phase through.
      id: 'ashen-to-briar',
      col: 49,
      row: 18,
      width: 1,
      height: 2,
      destinationAreaId: 'briar-wilds',
      entryPoint: { col: 1, row: 13 },
      condition: 'has_ember_mark == true',
    },
  ],
  visual: { floorColor: 0x4a6741, wallColor: 0x2c2c3a },
};
