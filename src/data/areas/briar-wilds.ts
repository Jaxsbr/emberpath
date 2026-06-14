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
        'Did that little spark really help at all?',
        'Maybe I should have stayed in the village...',
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
        'No one knows I am out here.',
        'My light is so small now.',
        'Maybe the thorns never really opened for me...',
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
      lines: ["Pip's little spark grows calm and strong.", 'The thorns open up here.'],
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
        'The thorny woods end in this open spot.',
        'Pip looks back. Far away, she can see warm, glowing spots — the friends she helped.',
        'A long stone bridge is ahead. Its stones are old and cracked, like something hurt them long ago...',
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

// ───── Light anchors (C13 — Briar "near-black void" clarity, Issue #72) ─────
// Cold playtest: a first-time player dropped into Briar saw a near-black void —
// the global grey-out model (dark overlay + full desaturation) over a dark floor
// left no readable ground and nothing to walk toward but the lone far-east
// beacon. These are LIGHT-ONLY triggers (the documented "wayfinding without
// exposition" use of TriggerDefinition.light): each registers a tier-1 light
// that erases the dark overlay AND, because the same RT is the desaturation
// colour-mask, lets the floor's true GREEN read inside the pool. So the player
// sees a breadcrumb of small green clearings stepping west→east toward the goal
// — literally "the thorns open up here" (the quiet-grove line). They never fire
// (never-true condition + empty actionRef = pure light, no thought, no flags),
// and the drain zones are deliberately left dark so the trial still feels bleak
// between the rest-pockets. Data-only, no new art; reversible. Tunable by eye.
const NEVER = 'briar_light_anchor == true'; // sentinel flag, never set → never fires
const lightAnchor = (
  id: string,
  col: number,
  row: number,
  radius: number,
  intensity: number,
): TriggerDefinition => ({
  id,
  col,
  row,
  width: 1,
  height: 1,
  type: 'thought',
  actionRef: '',
  condition: NEVER,
  repeatable: false,
  light: { radius, intensity, tier: 1 },
});
const lightAnchors: TriggerDefinition[] = [
  // Main breadcrumb across the middle band (rows 12–13), spaced ~6 tiles so the
  // next clearing is in view as you reach the current one. Avoids the drain
  // zones (drain-1 ~cols 8–11/rows 8–10, drain-2 ~cols 18–21/rows 16–18), which
  // stay dark on purpose.
  lightAnchor('briar-light-1', 5, 13, 72, 0.75), // just east of spawn — pulls the player in off the start
  lightAnchor('briar-light-2', 11, 13, 72, 0.75),
  lightAnchor('briar-light-3', 17, 12, 72, 0.75),
  lightAnchor('briar-light-4', 23, 12, 80, 0.8),
  lightAnchor('briar-light-5', 28, 12, 96, 0.85), // closing clearing, co-located with the beacon — a warm green arrival
  // The northern rest clearing — honours quiet-grove's "the thorns open up here".
  lightAnchor('briar-light-grove', 15, 6, 80, 0.8),
];

// Skeleton has no decorations — terrain + objects carry the visual load.
const decorations: DecorationDefinition[] = [];

// ───── Object scatter (T12 — PixelLab content) ─────
// Sparse impassable bramble + dead-tree pockets along the trial road, plus
// passable twisted-root ground decoration in the drain zones (visual cue
// for the false-hope read). Player path stays open: a clear vertical lane
// roughly cols 1-7 down the west side and cols 22-26 across the middle
// keeps the route to quiet-closing reachable. Edges are dressed thicker.
const briarObjects: import('../../maps/objects').ObjectInstance[] = [
  // North edge cluster — frames the area
  { kind: 'briar-dead-tree', col: 5, row: 2 },
  { kind: 'bramble-cluster', col: 12, row: 2 },
  { kind: 'briar-dead-tree', col: 20, row: 1 },
  { kind: 'bramble-cluster', col: 25, row: 3 },
  { kind: 'briar-dead-tree', col: 30, row: 2 },
  // West edge cluster — leaves col 0 entry open at row 12-14
  { kind: 'bramble-cluster', col: 1, row: 4 },
  { kind: 'bramble-cluster', col: 2, row: 9 },
  { kind: 'bramble-cluster', col: 1, row: 19 },
  // Middle obstacles between drain-1 and drain-2 — push the player to weave
  { kind: 'briar-dead-tree', col: 13, row: 12 },
  { kind: 'bramble-cluster', col: 16, row: 14 },
  // South edge cluster
  { kind: 'briar-dead-tree', col: 7, row: 23 },
  { kind: 'bramble-cluster', col: 14, row: 24 },
  { kind: 'briar-dead-tree', col: 22, row: 23 },
  { kind: 'bramble-cluster', col: 28, row: 24 },
  // East edge cluster — frames the closing-reflection clearing without
  // blocking the cells inside quiet-closing (cols 27-30, rows 11-14)
  { kind: 'bramble-cluster', col: 31, row: 9 },
  { kind: 'briar-dead-tree', col: 31, row: 18 },
  // Twisted-root ground decoration inside the drain zones — passable, signals
  // false-hope visually (the trap and the lie are one — phase-goal direction)
  { kind: 'twisted-root', col: 9, row: 9 },
  { kind: 'twisted-root', col: 10, row: 10 },
  { kind: 'twisted-root', col: 19, row: 17 },
  { kind: 'twisted-root', col: 20, row: 18 },
];

export const briarWilds: AreaDefinition = {
  id: 'briar-wilds',
  name: 'Briar Wilds',
  // Objective banner (C10 — Briar Wilds had none). Base goal points the cold
  // player east across the thorns to the far clearing; once they reach it
  // (briar_wilds_complete flips at the closing trigger, live in-scene) the goal
  // becomes a reflective close rather than standing stale. No east exit exists
  // yet (heart-bridge unbuilt), so the closing line is non-directional on
  // purpose. Wayfinding only — no doctrine.
  objective: 'Find your way through the thorny woods. Keep going east.',
  conditionalObjective: [
    {
      condition: 'briar_wilds_complete == true',
      text: 'You crossed the thorns. Your light made it through.',
    },
  ],
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
  // PixelLab-generated briar objects (T12). Sparse impassable scatter +
  // passable twisted-root ground decoration in drain zones. The map itself
  // has no walls, so deriveObjectsFromTileMap returns nothing — only the
  // hand-authored briarObjects appear.
  objects: [...deriveObjectsFromTileMap(briarTileMap, 'wall-stone'), ...briarObjects],
  npcs: [],
  props: [],
  decorations,
  triggers: [...triggers, ...lightAnchors],
  dialogues: {},
  storyScenes: {},
  drainZones,
  quietZones,
  // Glow-only wayfinding beacon (C13, Issue #59). Briar read as a void with the
  // banner saying "keep going east" but nothing visible to aim at. This warm glow
  // sits on the far-east goal clearing (quiet-closing / the completion trigger at
  // ~28,12) so a cold player has a light to walk toward — the literal payoff of
  // "the thorns open up here" toward the light. UI-camera, so it survives the
  // desaturation pass and is independent of the deferred real Briar tileset. No
  // smoke plume (would mis-read as a fire); just the glow. Wayfinding, no doctrine.
  lightBeacon: { col: 28, row: 12 },
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
