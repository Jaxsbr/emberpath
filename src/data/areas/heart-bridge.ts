// Heart Bridge (heart-bridge phase, US-HB1) — the atonement beat (gospel-arc
// beat 6). Stage 6 of Pip's pilgrim journey: a short, linear, one-direction
// stone span she walks AFTER receiving the Word in Briar Wilds. Crossing it the
// Fading is taken away once and a permanent state changes — the drain places no
// longer take her light.
//
// THIS SLICE (US-HB1) is the NON-DOCTRINAL SHELL only: the area, the entry from
// Briar (gated on has_word), and the permanent `atoned` flag the crossing grants
// — written exactly once by the far-end one-shot trigger below, no pickup path,
// no other writer. The paced colour-return overlay (US-HB2), the closing seal
// SCENE + any figure/wording (US-HB3), and "trials no longer drain" (US-HB4) are
// later slices; their gospel/allegory staging is Jaco's reserved domain
// (Decisions 1–4 in docs/product/phases/heart-bridge.md) and is NOT in here.
//
// "Received, not performed" (master-prd): the span has no fail state, no timer,
// no skill check, no branching — walking forward is the only verb. A slow walker
// gets the same beat as a fast one.
//
// ART: placeholder terrain for the mechanics slice (uniform `stone`, rendered on
// the shipped fog-marsh-floor-stone Wang tileset, framed by impassable
// marsh-stone parapets so it reads as a walled span). The bespoke scarred-stone
// bridge tileset + scarred-stone visual is its own Track A art slice (top-down +
// clustered per directive #344), not owed by this slice.

import {
  AreaDefinition,
  StoredTile,
  TILE_FLOOR,
  deriveTerrainFromTileMap,
  deriveObjectsFromTileMap,
  TriggerDefinition,
} from './types';
import { ObjectInstance } from '../../maps/objects';

const F = TILE_FLOOR;

// 26 wide × 5 tall. Walkable corridor is the middle three rows (1,2,3); rows 0
// and 4 are walled by parapet stones below so the span reads as a bridge and the
// player can only walk straight across. All-floor base — the parapet is carried
// by the placed object layer, not the terrain (so the floor renders as clean
// uniform stone).
const HEART_BRIDGE_COLS = 26;
const HEART_BRIDGE_ROWS = 5;
const heartBridgeTileMap: StoredTile[][] = Array.from({ length: HEART_BRIDGE_ROWS }, () =>
  Array.from({ length: HEART_BRIDGE_COLS }, () => F as StoredTile),
);

// ───── Parapet (impassable stone edge) ─────
// A continuous run of weathered umber stone along the top (row 0) and bottom
// (row 4) edges. marsh-stone is palette-cohesive with the fog-marsh-floor-stone
// floor; collision keys each anchor cell, so the corridor (rows 1–3) stays open
// while the edges are walled. Placeholder — the real scarred-stone parapet is a
// Track A art slice.
const parapet: ObjectInstance[] = [];
for (let c = 0; c < HEART_BRIDGE_COLS; c++) {
  parapet.push({ kind: 'marsh-stone', col: c, row: 0 });
  parapet.push({ kind: 'marsh-stone', col: c, row: HEART_BRIDGE_ROWS - 1 });
}

// ───── The figure at the crossing (US-HB3, Decision 1 = FIGURE PRESENT) ─────
// A wordless regal golden stag standing at the FAR THIRD of the span (cols 18–20),
// before the seal at col 22 — so Pip walks up the bridge, meets the figure, and the
// crossing seals just beyond it. It is a placed OBJECT, not an NPC: no dialogue, no
// "talk" prompt, no interaction — present, not conversational, exactly as Decision 1
// blessed it ("someone meeting her there", wordless). 3×3 footprint reads slightly
// larger than Pip; `tall` Y-sort + a single base-cell collision let her step past it
// (rows 1–2 stay walkable under the body) to reach the seal. No gospel text is added
// here — what the figure DOES (the Fading drawn out, substitution) is Decisions 2–3,
// still reserved for Jaco and not in this slice.
const figure: ObjectInstance[] = [{ kind: 'golden-stag', col: 18, row: 1 }];

// ───── Triggers ─────
// CROSSING BANDS (US-HB2) — the paced colour-return mechanic. Three invisible
// one-shot bands divide the span into quarters; each crossed band increments
// `heart_bridge_crossing`, and the far-end seal trigger increments it a fourth
// time as it grants `atoned`. The GameScene desat hook reads that counter
// (0→4) and lifts the grey overlay one quarter per band, so colour returns to
// the world AS Pip walks — fully restored exactly when she's across. type
// 'thought' + empty actionRef = no text shown (same no-op idiom as the seal
// trigger / Briar's light anchors): these are pure mechanical flag flips. The
// figure/wording that may eventually accompany the crossing (Decisions 1–3) is
// NOT here — this slice is the pacing mechanic only. Each band is gated so it
// fires once per fresh crossing (re-cross only happens after a Reset clears
// both `atoned` and the counter).
const crossingBands: TriggerDefinition[] = [6, 12, 18].map((col, i) => ({
  id: `heart-bridge-band-${i + 1}`,
  col,
  row: 1,
  width: 1,
  height: 3,
  type: 'thought' as const,
  actionRef: '',
  condition: 'atoned == false',
  incrementFlags: ['heart_bridge_crossing'],
  repeatable: false,
}));

// The far-end one-shot that grants the permanent atonement state. type 'thought'
// + empty actionRef = no thought is shown (same idiom as Briar's light anchors /
// completion trigger): this is a pure mechanical flag flip for the shell. It also
// increments `heart_bridge_crossing` a final (4th) time, so the colour-return
// overlay reaches full restoration exactly as `atoned` seals. The closing seal
// SCENE that will play here (US-HB3) is a later slice and replaces nothing
// structural — it will set `atoned` via its own terminal beat once the gospel
// Decisions land. Gated `atoned == false` so re-crossing never re-fires.
const triggers: TriggerDefinition[] = [
  ...crossingBands,
  {
    id: 'heart-bridge-crossed',
    col: 22,
    row: 1,
    width: 2,
    height: 3,
    type: 'thought',
    actionRef: '',
    condition: 'atoned == false',
    setFlags: { atoned: true },
    incrementFlags: ['heart_bridge_crossing'],
    repeatable: false,
  },
];

export const heartBridge: AreaDefinition = {
  id: 'heart-bridge',
  name: 'Heart Bridge',
  // Wayfinding only — no doctrine in the shell. The one verb is "forward".
  objective: 'Walk across the bridge.',
  conditionalObjective: [
    {
      // Once crossed, the way onward (back to the thorns for now) is open.
      condition: 'atoned == true',
      text: 'You made it across. Keep going.',
    },
  ],
  mapCols: HEART_BRIDGE_COLS,
  mapRows: HEART_BRIDGE_ROWS,
  // Placeholder stone floor on the shipped fog-marsh stone Wang tileset (uniform
  // 'stone' → the all-stone frame, exactly as Fog Marsh's stone apron renders).
  tileset: 'fog-marsh-floor-stone',
  decorationsTileset: 'tiny-town',
  map: heartBridgeTileMap,
  terrain: deriveTerrainFromTileMap(heartBridgeTileMap, 'stone'),
  // Map has no walls, so deriveObjectsFromTileMap returns nothing — only the
  // hand-authored parapet appears.
  objects: [...deriveObjectsFromTileMap(heartBridgeTileMap, 'wall-stone'), ...parapet, ...figure],
  npcs: [],
  props: [],
  decorations: [],
  triggers,
  dialogues: {},
  storyScenes: {},
  playerSpawn: { col: 1, row: 2 },
  exits: [
    {
      // Far (east) end — onward. No later area exists yet, so it returns to the
      // Briar east clearing (just west of Briar's bridge mouth so the player
      // doesn't immediately step back onto the span). Re-routes to a forward
      // area when bearing-fruit ships.
      id: 'heart-bridge-onward',
      col: HEART_BRIDGE_COLS - 1,
      row: 1,
      width: 1,
      height: 3,
      destinationAreaId: 'briar-wilds',
      entryPoint: { col: 29, row: 12 },
    },
  ],
  visual: { floorColor: 0x6a6a72, wallColor: 0x3a3a42 },
};
