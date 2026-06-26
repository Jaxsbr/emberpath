// Heart Bridge (heart-bridge phase, US-HB1) — the atonement beat (gospel-arc
// beat 6). Stage 6 of Pip's pilgrim journey: a short, linear, one-direction
// stone span she walks AFTER receiving the Word in Briar Wilds. Crossing it the
// Fading is taken away once and a permanent state changes — the drain places no
// longer take her light.
//
// Shipped on this area: the NON-DOCTRINAL SHELL (US-HB1 — area, entry from Briar
// gated on has_word, the permanent `atoned` flag), the paced colour-return overlay
// (US-HB2), the wordless figure at the crossing (US-HB3 pt1, Decision 1 = FIGURE
// PRESENT), and the CLOSING SEAL SCENE (US-HB3 pt2 — Decisions 2 + 3 answered by
// Jaco 2026-06-15, both = A). Decision 2 = the FADING is drawn out into the stone
// where the King stands; the Ember is KEPT and brightens (never surrendered — it is
// the indwelling Spirit). Decision 3 = the PICTURE carries the substitution, with a
// couple of quiet young-child lines that imply the exchange; the naming/doctrine
// ("atonement", the gospel link) stays in the credits, never in-game. "Trials no
// longer drain" (US-HB4) is still gated on Decision 4 and is NOT in here.
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
  NpcDefinition,
  StoredTile,
  TILE_FLOOR,
  deriveTerrainFromTileMap,
  deriveObjectsFromTileMap,
  TriggerDefinition,
} from './types';
import { ObjectInstance } from '../../maps/objects';

const F = TILE_FLOOR;

// FB-19 redesign (Jaco #1052, GATE-1 Option A "the bridge that blooms", span
// TRIPLED): a long stone deck carried ACROSS WATER. 78 wide × 9 tall — three
// horizontal bands top-to-bottom: open water (rows 0–1), the walled stone deck
// (parapet row 2 · walkable rows 3–5 · parapet row 6), open water again (rows
// 7–8). The walkable corridor is the middle three rows (3,4,5); the player can
// only walk straight across, west→east. All-floor authoring base — the water is
// painted into the terrain vertex grid below and the parapet is carried by the
// placed object layer, so the deck itself renders as clean stone.
const HEART_BRIDGE_COLS = 78;
const HEART_BRIDGE_ROWS = 9;
// Deck geometry (single source of truth for parapet / beds / triggers / spawn).
const DECK_TOP_PARAPET = 2;
const DECK_BOT_PARAPET = 6;
const DECK_ROW_MID = 4; // walkable rows are 3,4,5; Pip spawns and the figure stands on 4
const heartBridgeTileMap: StoredTile[][] = Array.from({ length: HEART_BRIDGE_ROWS }, () =>
  Array.from({ length: HEART_BRIDGE_COLS }, () => F as StoredTile),
);

// ───── Water flanks (terrain vertex paint) ─────
// Base terrain is stone; the top two and bottom two cell-rows are flipped to
// `water` so the deck reads as a bridge OVER water. A cell is impassable water
// only when all four of its corner vertices are water (fog-marsh pattern), so we
// paint vertex rows 0–2 (north) and 7–9 (south): cell-rows 0,1 and 7,8 become
// full water, and the parapet rows 2 and 6 get a one-sided water vertex → the
// Wang resolver renders a stone↔water shore right at the deck edge. The parapet
// objects still carry collision, so the shore is purely visual.
function paintWater(terrain: import('../../maps/terrain').TerrainId[][]): import('../../maps/terrain').TerrainId[][] {
  const lastV = HEART_BRIDGE_COLS; // vertex cols 0..COLS
  for (const vr of [0, 1, 2, 7, 8, 9]) {
    for (let vc = 0; vc <= lastV; vc++) terrain[vr][vc] = 'water';
  }
  return terrain;
}

// ───── Parapet (impassable stone edge) ─────
// A continuous run of weathered umber stone along the deck's north (row 2) and
// south (row 6) edges, walling the walkable corridor (rows 3–5) off from the
// water. marsh-stone is palette-cohesive with the fog-marsh-floor-stone deck and
// collision keys each anchor cell.
const parapet: ObjectInstance[] = [];
for (let c = 0; c < HEART_BRIDGE_COLS; c++) {
  parapet.push({ kind: 'marsh-stone', col: c, row: DECK_TOP_PARAPET });
  parapet.push({ kind: 'marsh-stone', col: c, row: DECK_BOT_PARAPET });
}

// ───── Blooming beds (the spatial half of "the bridge that blooms") ─────
// Passable groundcover planted along the deck edges (rows 3 & 5) and floating in
// the water flanks, on a WEST→EAST gradient: sparse, grey, scrubby groundcover at
// the near end where the world is still Fading, thickening into dense flower/bush
// clusters and a far-bank tree grove by the time Pip reaches the figure. Paired
// with the colour-return overlay (which lifts the grey quarter by quarter as she
// walks), the deck literally becomes a garden across the crossing. Clustered, not
// scattered, per directive #344. All these kinds are passable, so they frame the
// path without ever blocking it; the trees sit on the (already impassable) water
// rows as a backdrop grove.
const beds: ObjectInstance[] = [];
// Placement is by hand-authored CLUSTERS, not an even per-tile fill — the binding
// cluster-not-scatter canon (`docs/solutions/art/cluster-not-scatter.md`, Jaco
// #344/#482): groundcover lives in irregular mixed clumps of 2–4 with undergrowth
// packed around, separated by deliberate open clearings, NEVER a regular sprinkle.
// Each cluster anchors at a col on one deck edge (row 3 or 5 — row 4 stays the open
// walk path) and drops a packed run of mixed kinds. Density RAMPS west→east: the
// austere near end has a few lonely tufts and lots of bare grey deck between them;
// the far bank is dense overlapping flower/bush/tuft clusters framing the King —
// so the deck reads as a garden BLOOMING into being as Pip crosses (paired with the
// quarter-by-quarter colour-return overlay). All kinds are passable: they frame the
// path, never block it. Deterministic (no Math.random) so captures/diffs are stable.
type Bed = ObjectInstance['kind'];
interface Cluster { col: number; row: number; items: [number, Bed][]; } // items: [dCol, kind]
const deckClusters: Cluster[] = [
  // WEST — austere: a couple of lonely tufts, wide bare-deck clearings between.
  { col: 8, row: 5, items: [[0, 'grass-tuft']] },
  { col: 15, row: 3, items: [[0, 'grass-tuft'], [1, 'grass-tuft']] },
  { col: 22, row: 5, items: [[0, 'grass-tuft']] },
  // MID — tufts giving way to the first flowers; small mixed clumps of 2–3.
  { col: 28, row: 3, items: [[0, 'grass-tuft'], [1, 'flower']] },
  { col: 34, row: 5, items: [[0, 'flower'], [1, 'grass-tuft'], [2, 'flower']] },
  { col: 41, row: 3, items: [[0, 'grass-tuft'], [1, 'flower'], [2, 'bush']] },
  { col: 46, row: 5, items: [[0, 'flower'], [1, 'flower']] },
  // FAR — the garden: dense overlapping flower+bush+tuft clusters on both edges,
  // tightening toward the far bank so the bloom peaks around the King.
  { col: 52, row: 3, items: [[0, 'bush'], [1, 'flower'], [2, 'flower'], [3, 'grass-tuft']] },
  { col: 53, row: 5, items: [[0, 'flower'], [1, 'bush'], [2, 'flower']] },
  { col: 58, row: 3, items: [[0, 'flower'], [1, 'bush'], [2, 'flower']] },
  { col: 59, row: 5, items: [[0, 'grass-tuft'], [1, 'flower'], [2, 'bush'], [3, 'flower']] },
  { col: 64, row: 3, items: [[0, 'bush'], [1, 'flower'], [2, 'flower'], [3, 'bush']] },
  { col: 64, row: 5, items: [[0, 'flower'], [1, 'grass-tuft'], [2, 'flower']] },
  { col: 69, row: 3, items: [[0, 'flower'], [1, 'bush'], [2, 'flower'], [3, 'flower']] },
  { col: 70, row: 5, items: [[0, 'bush'], [1, 'flower'], [2, 'flower']] }, // frames the King's far bank
];
// Water dressing also clusters (lily-pad clumps + cattail stands), thickening east.
const waterClusters: Cluster[] = [
  { col: 12, row: 7, items: [[0, 'lily-pad']] },
  { col: 24, row: 1, items: [[0, 'lily-pad'], [2, 'lily-pad']] },
  { col: 33, row: 7, items: [[0, 'lily-pad'], [1, 'cattail']] },
  { col: 44, row: 1, items: [[0, 'cattail'], [1, 'lily-pad'], [3, 'lily-pad']] },
  { col: 50, row: 7, items: [[0, 'lily-pad'], [2, 'cattail'], [3, 'lily-pad']] },
  { col: 58, row: 1, items: [[0, 'cattail'], [1, 'cattail'], [3, 'lily-pad']] },
  { col: 63, row: 7, items: [[0, 'lily-pad'], [1, 'cattail'], [2, 'lily-pad']] },
];
for (const { col, row, items } of [...deckClusters, ...waterClusters]) {
  for (const [dCol, kind] of items) beds.push({ kind, col: col + dCol, row });
}
// Far-bank tree grove — the lush garden the bridge arrives into. tree-oak is
// tall + collides only on its trunk cell; placed on the impassable water rows at
// the east end so it never touches the walkway, reading as a grove flanking the
// far shore behind the figure.
for (const [col, row] of [
  [70, 0], [73, 1], [76, 0],
  [70, 8], [73, 7], [76, 8],
] as [number, number][]) {
  beds.push({ kind: 'tree-oak', col, row });
}

// ───── The figure at the crossing (US-HB3, Decision 1 = FIGURE PRESENT) ─────
// The wordless regal King — an antlered, cloaked figure — stands near the FAR end
// of the long span (col 70), before the seal at col 74, so Pip walks the whole
// crossing up to him. FB-19 (Jaco #1052) gives him the engine's NPC AWARENESS:
// he is now an NPC (not a static object), stationary (wanderRadius 0) but with an
// awarenessRadius so he TURNS to face Pip as she approaches — present and
// attentive, still WORDLESS (Decision 1 preserved; no dialogue, no gospel line —
// that stays Jaco's to bless). A warm lightOverride pools a benevolent golden key-
// light on him so he reads kind, not flat/menacing (#102). See `figureNpc` below.

// ───── The closing seal scene (US-HB3 pt2 — Decisions 2 + 3, both = A) ─────
// The emotional climax (master-prd #4: "the most felt, not the longest"). It plays
// once, at the far-end seal, AFTER `atoned` is set and the colour has fully returned
// — so the player steps off the bridge into a world made whole, having just been
// shown WHY. Restraint is the brief: four short warm beats, the picture doing the
// work, the King wordless (Decision 1). Decision 2 (=A): the FADING — the last grey —
// is drawn off Pip into the stone where he stands; her Ember does NOT leave her, it
// stays and brightens (the indwelling Spirit is kept, never surrendered). Decision 3
// (=A): the substitution is IMPLIED in a couple of kid-level lines ("the grey is his
// now — not hers to carry"); the word atonement, the naming, and the gospel link are
// reserved for the credits per master-prd + biblical-guidance. Uses the shipped
// imageColor/imageLabel palette idiom (gold → cream, brighter than the bridge stone),
// exactly like ember-given / word-given — no bespoke scene art is generated here.
// ───── The stag finale (F1, issue #197 — Jaco #1254: dialogue/choice/visual=b, finale=a) ─────
// The bridge is the game's deliberate ENDING (the Citadel beat is cut — no art
// budget). After the wordless seal scene draws the grey away, the once-silent King
// SPEAKS for the first and only time: a short warm build — he waited for Pip, he
// watched her the whole way, he carried the grey for her, and his home is a city of
// light with a place kept for her. Pip answers "Yes" (a soft "Is it far?" loops back
// with reassurance, never a real "no"). Picking "Yes" sets `game_complete`, which the
// GameScene reads on dialogue close to fire the glory-bloom finale + the end-of-game
// page (F2, #198). Gated `atoned == true` so he stays wordless until the crossing is
// sealed — before that, selectScriptForNpc finds no script and he shows no talk prompt.
// Allegory: the King = the High King (Jesus, never named in-game); the invitation home
// = glorification / heaven (master-prd beat 8, delivered as words + light, not a new map).
const kingFinaleDialogue: import('./types').DialogueScript = {
  id: 'antlered-king-intro',
  startNodeId: 'invite-waited',
  condition: 'atoned == true',
  // The King's face for the finale (Jaco-supplied art, #1258): a luminous golden-stag
  // portrait. Script-level so it shows on every beat of the invitation. Registered as
  // 'golden-stag' in NPC_PORTRAITS (linear filter — it's a painterly, not pixel, bust).
  portraitId: 'golden-stag',
  nodes: [
    {
      id: 'invite-waited',
      speaker: 'The King',
      text: 'Pip. I have been waiting for you. All this long way, I was waiting.',
      nextId: 'invite-watched',
    },
    {
      id: 'invite-watched',
      speaker: 'The King',
      text: 'I saw every step you took. The dark places too. I never once looked away.',
      nextId: 'invite-cared',
    },
    {
      id: 'invite-cared',
      speaker: 'The King',
      text: 'I cared for you before you knew my name. I took the grey so you would not have to. You are dear to me, little one.',
      nextId: 'invite-home',
    },
    {
      id: 'invite-home',
      speaker: 'The King',
      text: 'My home is a city of warm light. Tall golden halls, doors that are always open, and a place inside kept just for you.',
      nextId: 'invite-ask',
    },
    {
      id: 'invite-ask',
      speaker: 'The King',
      text: 'Will you come, and live with me there? For always?',
      choices: [
        { text: 'Yes. I will come with you.', nextId: 'invite-yes', setFlags: { game_complete: true } },
        { text: 'Is it far?', nextId: 'invite-far' },
      ],
    },
    {
      id: 'invite-far',
      speaker: 'The King',
      text: 'Not far at all. And you will not walk it alone — I will carry you the rest of the way home.',
      nextId: 'invite-ask',
    },
    {
      id: 'invite-yes',
      speaker: 'The King',
      text: 'Then take my hand, Pip. You are home now. You are home.',
    },
  ],
};

const bridgeSealedScene: import('./types').StorySceneDefinition = {
  id: 'bridge-sealed',
  beats: [
    {
      text: 'As Pip walks, the last of the grey lifts off her. It flows down into the stone — to where he stands.',
      imageColor: 0xe0b15a,
      imageLabel: 'The grey lifts away',
    },
    {
      text: 'He does not speak. He only takes it in. The grey is his now — not hers to carry. Not ever again.',
      imageColor: 0xf2d98a,
      imageLabel: 'He takes the grey',
    },
    {
      text: 'Pip’s own little light did not go out. It only grew warmer. Brighter. It was always hers to keep.',
      imageColor: 0xf4ead2,
      imageLabel: 'Her light stays',
    },
    {
      text: 'I did not carry it across. He did. I only had to walk.',
      imageColor: 0xfaf3e0,
      imageLabel: 'I only walked',
    },
  ],
};

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
// FB-19: 7 bands evenly spaced across the tripled deck (was 3 on the short span).
// Each increments `heart_bridge_crossing`; with the far-end seal that's 8 beats
// (HEART_BRIDGE_CROSSING_BEATS = 8), so the grey lifts in small gradual steps over
// the long walk instead of a few big jumps.
const crossingBands: TriggerDefinition[] = [9, 18, 27, 36, 45, 54, 63].map((col, i) => ({
  id: `heart-bridge-band-${i + 1}`,
  col,
  row: 3,
  width: 1,
  height: 3,
  type: 'thought' as const,
  actionRef: '',
  condition: 'atoned == false',
  incrementFlags: ['heart_bridge_crossing'],
  repeatable: false,
}));

// The far-end one-shot that grants the permanent atonement state AND plays the
// closing seal scene (US-HB3 pt2). `setFlags`/`incrementFlags` fire BEFORE the type
// dispatch (see TriggerDefinition contract), so `atoned` seals and the crossing
// counter reaches its final (4th) tick — full colour restored — and THEN the
// 'bridge-sealed' story scene launches over the now-whole world. Gated
// `atoned == false` so re-crossing never re-fires (a Reset clears both `atoned` and
// the counter to allow a fresh crossing). The scene is the felt climax; the flag is
// the permanent change.
const triggers: TriggerDefinition[] = [
  ...crossingBands,
  {
    id: 'heart-bridge-crossed',
    // F1: pulled west to col 70 so the wordless seal scene (the grey lifting) plays
    // BEFORE Pip reaches the now-speaking King at col 74 — she steps into his
    // presence after the substitution, and he gives the closing invitation home.
    col: 70,
    row: 3,
    width: 2,
    height: 3,
    type: 'story',
    actionRef: 'bridge-sealed',
    condition: 'atoned == false',
    setFlags: { atoned: true },
    incrementFlags: ['heart_bridge_crossing'],
    repeatable: false,
  },
];

// ───── The figure as an NPC (FB-19, Jaco #1052) ─────
// The antlered King, converted from a static prop to an NPC so he inherits the
// engine's awareness behaviour: stationary (wanderRadius 0) but, once Pip steps
// inside awarenessRadius, he TURNS to face her (npcBehavior `aware` state). Still
// WORDLESS — no dialogue node is wired, so there is no "talk" prompt and no
// spoken line (Decision 1 preserved; any words remain Jaco's to bless). The warm
// lightOverride pools a benevolent golden key-light on him (brighter + wider than
// the baseline NPC light) so he reads kind across the long, still-grey approach.
const figureNpc: NpcDefinition = {
  id: 'antlered-king',
  name: 'The King',
  // F1: stands at the FAR end (col 74), east of the seal at col 70, so he is the
  // last beat of the bridge — and of the game. Pip crosses, the grey lifts at the
  // seal, then she walks the final few steps into his light and he speaks.
  col: 74,
  row: DECK_ROW_MID,
  color: 0xe0b15a,
  sprite: 'golden-stag',
  wanderRadius: 0,
  awarenessRadius: 5,
  lightOverride: { radius: 220, intensity: 0.9, tier: 1 },
  // F1 (#197): no longer silent. He stays effectively wordless until the crossing
  // is sealed — his only dialogue script (`antlered-king-intro`) is gated
  // `atoned == true`, so pre-seal selectScriptForNpc finds nothing and shows no
  // talk prompt; after the seal he gives the closing invitation home.
};

export const heartBridge: AreaDefinition = {
  id: 'heart-bridge',
  name: 'Heart Bridge',
  // Wayfinding only — no doctrine in the shell. The one verb is "forward".
  objective: 'Walk across the bridge.',
  conditionalObjective: [
    {
      // F1 (#197): once the crossing is sealed, the one thing left is to reach the
      // King at the far end — he is the last beat of the bridge and of the game.
      // (The old "Go home" wording is retired: there is no walk-home now; the King
      // invites Pip to HIS home, so "go home" both contradicted the ending and
      // pointed at a removed exit.)
      condition: 'atoned == true',
      text: 'The King is waiting.',
    },
  ],
  mapCols: HEART_BRIDGE_COLS,
  mapRows: HEART_BRIDGE_ROWS,
  // Placeholder stone floor on the shipped fog-marsh stone Wang tileset (uniform
  // 'stone' → the all-stone frame, exactly as Fog Marsh's stone apron renders).
  tileset: 'fog-marsh-floor-stone',
  decorationsTileset: 'tiny-town',
  map: heartBridgeTileMap,
  // Stone deck with the top/bottom cell-rows painted to water (the bridge spans
  // open water). The Wang resolver renders fog-marsh-floor-water on the water
  // vertices and a stone↔water shore at the deck edge.
  terrain: paintWater(deriveTerrainFromTileMap(heartBridgeTileMap, 'stone')),
  // Map has no walls, so deriveObjectsFromTileMap returns nothing — only the
  // hand-authored parapet + blooming beds appear (the figure is now an NPC).
  objects: [...deriveObjectsFromTileMap(heartBridgeTileMap, 'wall-stone'), ...parapet, ...beds],
  npcs: [figureNpc],
  props: [],
  decorations: [],
  triggers,
  dialogues: { 'antlered-king-intro': kingFinaleDialogue },
  storyScenes: { 'bridge-sealed': bridgeSealedScene },
  playerSpawn: { col: 1, row: DECK_ROW_MID },
  // F1 (#197, Jaco #1254 finale=a): the Heart Bridge is the END of the game — there
  // is no walk-home afterward. The east exit that used to route back to Ashen for the
  // bearing-fruit revisit is removed; the only way forward is the King's invitation,
  // and answering "Yes" sets `game_complete` → the glory-bloom finale + the end page.
  exits: [],
  visual: { floorColor: 0x6a6a72, wallColor: 0x3a3a42 },
};
