import {
  AreaDefinition,
  DecorationDefinition,
  StoredTile,
  TILE_FLOOR,
  TILE_WALL,
  deriveTerrainFromTileMap,
  deriveObjectsFromTileMap,
} from './types';
import { ObjectInstance } from '../../maps/objects';

const F = TILE_FLOOR;
const W = TILE_WALL;

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
  // the engine's existing exit-zone rendering — same semantic, different
  // role here).
  { col: 24, row: 9, spriteFrame: FRAME.DOOR },

  // (C12b) Interior reeds moved off the tiny-dungeon atlas: the old log-pile
  // "reed" frames (92/93) read as wooden crates in the grey-out. Real passable
  // marsh tufts (dry-reed / mushroom PixelLab objects) now carry the interior
  // vegetation — see `fogMarshReedTufts` in the `objects` array above. Nothing
  // left here; the positions are preserved there, all strictly OFF the dry path.

  // (US-98) — South-exit closure decorations removed. The terrain-flip
  // pathway (`conditionalTerrain` block on this AreaDefinition) replaces
  // both the PATH overlay and the EDGE deep-water overlay: when
  // `marsh_trapped == true`, the closure vertices flip to `water` and the
  // Wang resolver renders the fog-marsh-floor-water tileset on those
  // cells; collision unifies via water.passable === false. One mechanism,
  // no parallel decoration variants.
];

// Stage-1 migration source — see ashen-isle.ts for the migration note.
const fogMarshTileMap = buildFogMarshMap();

// (C12b, 2026-06-14) Interior marsh life — passable PixelLab tufts scattered in
// the wet ground, replacing the old tiny-dungeon log-pile "reed" decorations
// that read as crates. Same positions as the retired decorations, all OFF the
// dry path (col 14 rows 10-21, cols 15-24 row 10) and the impassable reed
// perimeter; dry-reed/mushroom are passable so they never block movement.
const fogMarshReedTufts: ObjectInstance[] = [
  // Sense-of-place rework (G4-B, 2026-06-15, FB-1 fail B / Jaco #482). The
  // Slice-6 pass left the deadwood reading as evenly-spaced trees on a clean
  // grey floor — a dev grid, not a choked dying marsh. The tufts now pack
  // DENSELY around and between the (tightened) west-side dead-tree stands so
  // each stand reads as an organic thicket of deadwood + undergrowth, with the
  // gaps between stands kept thin (deliberate negative space). Mixed dry-reed +
  // mushroom. All passable — they never block — and all OFF the dry path (col
  // 14 rows 10-21, cols 15-24 row 10) and the impassable reed perimeter.
  // Density raised again (G4-B v2, 2026-06-15) — the cold art-review found the
  // thin reed/mushroom sprites read as faint specks on bare floor. The tufts now
  // pack nearly every floor cell inside each knot (alternating reed/mushroom),
  // so the ground reads as a choked, overgrown marsh rather than clean stone.
  // ── North knot (rows 2-7) ──
  { kind: 'dry-reed', col: 2, row: 4 },
  { kind: 'mushroom', col: 5, row: 3 },
  { kind: 'dry-reed', col: 6, row: 4 },
  { kind: 'mushroom', col: 7, row: 3 },
  { kind: 'dry-reed', col: 3, row: 6 },
  { kind: 'mushroom', col: 5, row: 6 },
  { kind: 'dry-reed', col: 8, row: 5 },
  { kind: 'mushroom', col: 2, row: 6 },
  { kind: 'dry-reed', col: 8, row: 3 },
  // ── Mid knot (rows 9-13) ──
  { kind: 'mushroom', col: 3, row: 11 },
  { kind: 'dry-reed', col: 5, row: 12 },
  { kind: 'mushroom', col: 7, row: 11 },
  { kind: 'dry-reed', col: 4, row: 10 },
  { kind: 'mushroom', col: 6, row: 10 },
  { kind: 'dry-reed', col: 8, row: 11 },
  { kind: 'mushroom', col: 2, row: 12 },
  { kind: 'dry-reed', col: 9, row: 12 },
  { kind: 'mushroom', col: 4, row: 13 },
  // ── South knot (rows 16-21) ──
  { kind: 'dry-reed', col: 2, row: 18 },
  { kind: 'mushroom', col: 5, row: 17 },
  { kind: 'dry-reed', col: 6, row: 18 },
  { kind: 'mushroom', col: 7, row: 19 },
  { kind: 'dry-reed', col: 3, row: 20 },
  { kind: 'mushroom', col: 5, row: 21 },
  { kind: 'dry-reed', col: 8, row: 18 },
  { kind: 'mushroom', col: 2, row: 20 },
  { kind: 'dry-reed', col: 9, row: 19 },
  // ── Thin bridging undergrowth in the gaps (rows 8, 14-15) — keeps the marsh
  // continuous without filling the negative space that separates the knots.
  { kind: 'dry-reed', col: 4, row: 8 },
  { kind: 'mushroom', col: 7, row: 8 },
  { kind: 'dry-reed', col: 3, row: 15 },
  { kind: 'mushroom', col: 8, row: 14 },
];

// Marsh-stone clusters at the deadwood bases (G4-B v2, 2026-06-15). The guide
// puts rocks at cluster bases; here they also add bigger, higher-contrast
// silhouette mass than the small reed/mushroom tufts, so the choked ground reads
// at game zoom. Impassable, but they sit in the WEST scenery half (cols 2-9) —
// the player's route is the east dry path, with a passable cols 10-13 buffer —
// so they read as "the marsh is too thick this way," never blocking progression.
const fogMarshGroundStones: ObjectInstance[] = [
  { kind: 'marsh-stone', col: 6, row: 5 },
  { kind: 'marsh-stone', col: 3, row: 3 },
  { kind: 'marsh-stone', col: 6, row: 11 },
  { kind: 'marsh-stone', col: 3, row: 13 },
  { kind: 'marsh-stone', col: 6, row: 20 },
  { kind: 'marsh-stone', col: 2, row: 17 },
];

// East-half lived-in pass (G4-B v3, 2026-06-15). The cold art-review found the
// WEST stands good but the EAST half a dev-grid: a "uniform grey room" of bare
// floor, a ruler-straight perimeter reed line, and a tidy ruin box. The route
// itself (col 14 path, the row-10 boardwalk to the Hermit, the south mouth) must
// stay OPEN — it is the deliberate "way through" negative space the cold player
// reads. So this clutter lands only in the OFF-ROUTE south-east quadrant (cols
// 17-27, rows 11-21) and at the ruin's south base, applying the same west-half
// vocabulary (clustered reed/mushroom + tumbled marsh-stones in irregular bunches
// with gaps) so the eye stops reading a bare floor + lone reed wall. Around the
// ruin, tumbled stones + reeds creeping the base make it read as a FALLEN ruin the
// marsh is reclaiming, not a freshly-built box. All marsh-stones are impassable
// but sit off every route cell, the door approach (col 24 rows 10-11), the
// boardwalk (row 10 cols 15-24) and the perimeter — they never wall progression.
const fogMarshEastClutter: ObjectInstance[] = [
  // SE marsh patch — bunch 1 (cols 18-20, rows 13-15)
  { kind: 'dry-reed', col: 18, row: 13 },
  { kind: 'marsh-stone', col: 20, row: 13 },
  { kind: 'mushroom', col: 19, row: 14 },
  { kind: 'dry-reed', col: 18, row: 15 },
  { kind: 'mushroom', col: 20, row: 15 },
  // SE marsh patch — bunch 2 (cols 22-25, rows 17-19)
  { kind: 'marsh-stone', col: 23, row: 17 },
  { kind: 'dry-reed', col: 25, row: 17 },
  { kind: 'mushroom', col: 22, row: 18 },
  { kind: 'dry-reed', col: 24, row: 18 },
  { kind: 'marsh-stone', col: 24, row: 19 },
  // SE marsh patch — bunch 3 (cols 17-18, rows 18-20)
  { kind: 'mushroom', col: 17, row: 18 },
  { kind: 'dry-reed', col: 18, row: 19 },
  { kind: 'marsh-stone', col: 17, row: 20 },
  // Scattered loose stones — ground variation breaking the bare-floor read
  { kind: 'marsh-stone', col: 26, row: 14 },
  { kind: 'marsh-stone', col: 21, row: 20 },
  { kind: 'marsh-stone', col: 27, row: 17 },
  // Ruin south base — tumbled rubble + marsh creep (fallen, reclaimed read)
  { kind: 'marsh-stone', col: 21, row: 11 },
  { kind: 'marsh-stone', col: 22, row: 11 },
  { kind: 'marsh-stone', col: 26, row: 11 },
  { kind: 'marsh-stone', col: 25, row: 12 },
  { kind: 'dry-reed', col: 23, row: 11 },
  { kind: 'mushroom', col: 26, row: 12 },
];

// Dead-tree clusters (Slice 6, 2026-06-14, directives #344 + #346) — the marsh
// was a bare reed-rimmed floor with no real silhouettes ("lacks so much", North
// Star id=68). Three tight clusters of gnarled dead trees fill the open WEST
// half as a desolate deadwood, leaving the EAST half (the dry path corridor at
// col 14, the row-10 boardwalk to the ruin, the ruin itself, the Hermit, the
// Keeper's clearing, and the south exit) as deliberate negative space the cold
// player still reads as "the way through." Each tree is a `tall` 4×4 object
// anchored top-left; it Y-sorts on its trunk base and collides ONLY at
// (col+1, row+3), so the bare branch spread overhangs walkable ground and the
// trunks never wall off a route.
//
// Sense-of-place rework (G4-B, 2026-06-15, FB-1 fail B / Jaco #482): the stands
// were tightened from evenly-spaced singles into irregular groups whose canopies
// OVERLAP — anchors ~2 cols apart so the bare crowns knit into one mass per stand
// instead of reading as a row of separate trees on a clean floor. North + south
// stands grew to 4 (irregular), mid stays 3. Trunk collision cells stay distinct
// and all west of the dry path (col 14) — the deadwood is scenery, never a route.
// Gaps at rows 8 and 14-15 keep the three stands legibly separate (negative space).
const fogMarshDeadTrees: ObjectInstance[] = [
  // Tightened to overlapping knots (G4-B v2, 2026-06-15 — cold art-review asked
  // for genuine canopy overlap; the thin bare-branch silhouette needs anchors
  // 1-2 cols apart to knit). Each stand is now a clustered knot whose crowns
  // touch into one deadwood mass rather than a spaced row. Trunk cells stay
  // distinct and all west of the col-11 buffer / col-14 path.
  // North knot (4) — trunks (3,5) (5,5) (4,7) (7,6)
  { kind: 'dead-tree', col: 2, row: 2 },
  { kind: 'dead-tree', col: 4, row: 2 },
  { kind: 'dead-tree', col: 3, row: 4 },
  { kind: 'dead-tree', col: 6, row: 3 },
  // Mid knot (3) — trunks (4,12) (6,13) (8,12)
  { kind: 'dead-tree', col: 3, row: 9 },
  { kind: 'dead-tree', col: 5, row: 10 },
  { kind: 'dead-tree', col: 7, row: 9 },
  // South knot (4) — trunks (3,19) (5,19) (4,21) (8,20)
  { kind: 'dead-tree', col: 2, row: 16 },
  { kind: 'dead-tree', col: 4, row: 16 },
  { kind: 'dead-tree', col: 3, row: 18 },
  { kind: 'dead-tree', col: 7, row: 17 },
];

// Marsh-trap closure (US-98) — terrain-flip pathway. The 8 vertices spanning
// row 22 cols 13-16 + row 23 cols 13-16 flip from `path` (default state) to
// `water` when `marsh_trapped == true`. The Wang resolver re-renders the 4
// closure cells using the fog-marsh-floor-water tileset (per-cell tileset
// selection picks it because the cell corners now include water), and
// collision unifies via `water.passable === false` (the AND-of-4-vertices
// rule blocks every closure cell once all 4 vertices are water).
//
// Replaces the legacy applyMarshTrappedState map-mutation AND the US-94
// conditional `wall-tomb` ObjectInstances on the same cells.

export const fogMarsh: AreaDefinition = {
  id: 'fog-marsh',
  name: 'Fog Marsh',
  // C12 — the area borrows the Tiny Dungeon tileset as a substitute, so its floor
  // and walls read as grey stone. A drifting mist + center-clear fog veil give the
  // player the fog the area is named for, softening the dungeon read.
  fogOverlay: true,
  // Objective banner (C10 — Fog Marsh had none, a "don't know where to go" gap).
  // Base goal sends the cold player deeper toward the light; the ladder re-points
  // as the marsh story flips its flags (the banner re-resolves live — both flags
  // flip while this scene is alive). First matching entry wins, top to bottom.
  // Wayfinding only — the grace/surrender meaning is carried by the Keeper, not
  // here; "hold still" mirrors the already-shipped surrender cue (C4-b).
  objective: 'Go deeper into the fog. Look for the light.',
  conditionalObjective: [
    {
      condition: 'keeper_met == true',
      text: 'You have a light now. Carry it home. Go back south.',
    },
    {
      // After surrender the Keeper appears (spawnCondition marsh_trapped &&
      // marsh_surrendered && !keeper_met). Without this entry the banner fell
      // through to the "hold still" line below and stayed stale while the Keeper
      // stood lit right beside Pip (C11 cold audit, 2026-06-14). Point the player
      // to him — wayfinding only; the grace meaning is carried by his dialogue.
      condition: 'marsh_surrendered == true',
      text: 'Someone is here in the fog now. Go to him.',
    },
    {
      condition: 'marsh_trapped == true',
      text: 'You are stuck. Stop pulling. Hold still and wait.',
    },
    {
      // C12c (2026-06-14): point the cold player to the Marsh Hermit FIRST, before
      // they walk north and spring the trap. He sits east on the row-10 boardwalk
      // (24,10) with a warm NPC-presence glow, but the base "go deeper / look for
      // the light" objective sends players north past him — so a literal-following
      // player misses his dialogue AND the `marsh-vision` story beat it gates
      // (the `marsh-depths` trigger requires spoke_to_marsh_hermit). Ordered LAST
      // so trapped/surrendered/keeper above still win once those flags flip; this
      // rung only shows pre-trap while the Hermit is unmet, then falls through to
      // the base "go deeper" objective once met. Wayfinding only — his guidance
      // and the grace meaning live in his dialogue and the Keeper, not here.
      condition: 'spoke_to_marsh_hermit == false',
      text: 'A light glows nearby. Go and see who it is.',
    },
  ],
  mapCols: 30,
  mapRows: 24,
  tileset: 'fog-marsh-floor-path',
  decorationsTileset: 'tiny-dungeon',
  map: fogMarshTileMap,
  terrain: deriveTerrainFromTileMap(fogMarshTileMap, 'marsh-floor'),
  // C12b (2026-06-14, Issue #67): the impassable boundary is now a reed/cattail
  // bank, not a stone-block crypt wall — same cells, same collision, marsh
  // vocabulary. Plus a scatter of passable dry-reed tufts + a mushroom for
  // interior marsh life (these replace the old tiny-dungeon log-pile "reed"
  // DECORATIONS that read as crates — see fogMarshDecorations).
  objects: [
    ...deriveObjectsFromTileMap(fogMarshTileMap, 'marsh-reeds'),
    ...fogMarshDeadTrees,
    ...fogMarshGroundStones,
    ...fogMarshReedTufts,
    ...fogMarshEastClutter,
  ],
  conditionalTerrain: [
    {
      condition: 'marsh_trapped == true',
      vertices: [
        { col: 13, row: 22, whenTrue: 'water', whenFalse: 'path' },
        { col: 14, row: 22, whenTrue: 'water', whenFalse: 'path' },
        { col: 15, row: 22, whenTrue: 'water', whenFalse: 'path' },
        { col: 16, row: 22, whenTrue: 'water', whenFalse: 'path' },
        { col: 13, row: 23, whenTrue: 'water', whenFalse: 'path' },
        { col: 14, row: 23, whenTrue: 'water', whenFalse: 'path' },
        { col: 15, row: 23, whenTrue: 'water', whenFalse: 'path' },
        { col: 16, row: 23, whenTrue: 'water', whenFalse: 'path' },
      ],
    },
  ],
  npcs: [
    // Marsh Hermit on the dry path immediately south of the ruin's door at
    // (24, 9); his spawn at (24, 10) is the path tile adjacent to the door.
    { id: 'marsh-hermit', name: 'Marsh Hermit', col: 24, row: 10, color: 0x5a7a6b, sprite: 'marsh-hermit', wanderRadius: 1, awarenessRadius: 3 },
    // The Keeper (white heron) — appears mid-marsh once Pip has crossed the
    // threshold (marsh_trapped == true) AND surrendered (marsh_surrendered ==
    // true — set by GameScene.updateSurrender after Pip has tried at least
    // twice and then held still in proximity for SURRENDER_DURATION_MS, US-80).
    // The 'keeper_met == false' clause is the one-shot guard — once US-72's
    // keeper-intro dialogue fires keeper_met, the Keeper never re-spawns even
    // if the player resets escape_attempts. wanderRadius 0 (stationary).
    // awarenessRadius 2 so he turns to face Pip when Pip approaches.
    // Linear-filter portrait via NPC_PORTRAITS registry.
    { id: 'keeper', name: 'The Keeper', col: 14, row: 8, color: 0xfff5d6, sprite: 'heron', wanderRadius: 0, awarenessRadius: 2, spawnCondition: 'marsh_trapped == true AND marsh_surrendered == true AND keeper_met == false' },
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
      actionRef: 'The air is heavy here. Each breath smells like wet mud. And something very old.',
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
      actionRef: 'The fog closes in behind me. The path is gone now.',
      repeatable: false,
      setFlags: { marsh_trapped: true },
    },
    // Escape-attempt feedback (US-79). One trigger band on row 21 cols 13-16,
    // immediately north of the now-walled south exit. Each entry increments
    // escape_attempts; GameScene's escape_attempts onFlagChange subscriber
    // then selects the matching escalating thought AND fires the fog-flash.
    //
    // Originally implemented as four condition-gated triggers stacked on the
    // same tiles. That cascaded on first entry: TriggerZoneSystem evaluates
    // triggers in array order, and each band's incrementFlags mutates the
    // flag synchronously BEFORE the next band's evaluateCondition runs —
    // so all four bands fired in one frame and escape_attempts jumped 0→4
    // immediately, trivialising the surrender threshold. Collapsing to one
    // trigger removes the cascade surface entirely.
    //
    // actionRef is empty because the message comes from the subscriber, not
    // the dispatch — onThought guards against empty strings.
    {
      id: 'escape-attempt',
      col: 13,
      row: 21,
      width: 4,
      height: 1,
      type: 'thought',
      actionRef: '',
      condition: 'marsh_trapped == true',
      repeatable: true,
      incrementFlags: ['escape_attempts'],
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
          text: 'Another little one, out in the fog? Most turn back before they come this far.',
          nextId: 'question',
        },
        {
          id: 'question',
          speaker: 'Marsh Hermit',
          text: 'The marsh is hard on everyone. What are you looking for?',
          choices: [
            { text: 'A way through the fog.', nextId: 'way-through', setFlags: { spoke_to_marsh_hermit: true } },
            { text: 'I followed a path from the Ashen Isle.', nextId: 'from-ashen', setFlags: { spoke_to_marsh_hermit: true } },
          ],
        },
        {
          id: 'way-through',
          speaker: 'Marsh Hermit',
          text: 'Through? There is no way through. You can only go down, deeper in. Sometimes the light hides down there.',
          nextId: 'advice',
        },
        {
          id: 'from-ashen',
          speaker: 'Marsh Hermit',
          text: 'The Ashen Isle... I remember it. Grey skies. Old people with very old stories.',
          nextId: 'advice',
        },
        {
          id: 'advice',
          speaker: 'Marsh Hermit',
          text: 'Listen to the stones if you can. They remember things the fog made everyone forget.',
        },
      ],
    },
    // Keeper rescue (US-72). Two-node script: greeting acknowledges Pip's
    // depth; action grants the Ember Mark and atomically flips marsh_trapped
    // back to false (US-73 path re-opens via the same Phase 1 mechanism in
    // reverse). endStoryScene chains 'ember-given' (3 warm-toned beats) so
    // dialogue close → flushSave → story scene launch in one user-visible
    // beat. portraitId 'heron' uses the linear-filter painterly portrait
    // registered in US-70.
    'keeper-intro': {
      id: 'keeper-intro',
      startNodeId: 'greeting',
      portraitId: 'heron',
      endStoryScene: 'ember-given',
      nodes: [
        {
          id: 'greeting',
          speaker: 'The Keeper',
          text: 'You went deeper than the path goes. Most do not.',
          nextId: 'action',
        },
        {
          id: 'action',
          speaker: 'The Keeper',
          text: 'You cannot find the way out by yourself. I am the way. Take this light — and follow me.',
          setFlags: { has_ember_mark: true, keeper_met: true, marsh_trapped: false },
        },
      ],
    },
  },
  storyScenes: {
    // Keeper rescue chained from keeper-intro dialogue (US-72). Three warm-toned
    // beats: Keeper draws near (warm gold) -> ember passes (brighter ember) ->
    // fog parts (pale dawn). All warmer than the surrounding marsh visuals
    // (marsh-depths uses 0x2a3a2a / 0x3a4a3a — desaturated greens) so the
    // ember reads as "light breaks in" against the established palette.
    'ember-given': {
      id: 'ember-given',
      beats: [
        {
          text: 'The Keeper steps closer through the fog. His feathers glow with a soft light. It does not come from the sun.',
          imageColor: 0xd9a657,
          imageLabel: 'The Keeper draws near',
        },
        {
          text: 'A small, warm spark passes from the Keeper to Pip. It rests in her chest. It feels like it was always meant to be there.',
          imageColor: 0xf2c878,
          imageLabel: 'The ember passes',
        },
        {
          text: 'For a moment, the fog thins out. The path south was gone. Now Pip can just see it again. The Keeper says nothing. He does not need to.',
          imageColor: 0xe8d8b8,
          imageLabel: 'The fog parts',
        },
      ],
    },
    'marsh-depths': {
      id: 'marsh-depths',
      beats: [
        {
          text: 'The fog opens for a moment. Deep under the dark water, something glows. It is small and warm, like a little fire that will not go out.',
          imageColor: 0x2a3a2a,
          imageLabel: 'Glowing depths',
        },
        {
          text: 'A voice. Pip does not hear it. She feels it: "What is lost can be found. What is broken can be fixed. But first, you must see."',
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
      // and arrive on Ashen Isle just south of the dock. Gated on the trap
      // flag — once marsh-deepens fires (col 14, row 5) and sets
      // marsh_trapped: true, this exit becomes inert AND the cells become
      // impassable via the conditional wall-tomb objects in
      // fogMarshConditionalClosure (US-67 / US-94 conditional-object pathway).
      id: 'fog-to-ashen',
      col: 13,
      row: 22,
      width: 4,
      height: 1,
      destinationAreaId: 'ashen-isle',
      entryPoint: { col: 24, row: 4 },
      condition: 'marsh_trapped == false',
    },
  ],
  visual: { floorColor: 0x3a4a3a, wallColor: 0x1a2a1a },
};
