// Briar Wilds (US-100) — Stage 4 of Pip's pilgrim journey, the trials beat.
// Walkable area + west-edge return to Ashen Isle + 2 drain zones + 2 quiet zones
// (one carries the closing reflection). Renders on its OWN PixelLab Wang tileset
// 'briar-wilds-floor-thorn' (briar-floor -> briar-thorn, generated 2026-05-04,
// committed at assets/tilesets/briar-wilds-floor-thorn/tilemap.{png,json}) — NOT
// a placeholder and NOT the ashen-sand atlas (that earlier note was stale; the
// registry atlasKey is 'tileset-briar-wilds-floor-thorn', loaded directly by
// GameScene). Style-matched clustered objects (dead-tree pairs + tight bramble
// thickets) shipped with the FB-1 sense-of-place rework (PR #91).
//
// One NPC only — Quill, the owl who keeps the old words — and he stands at the
// WEST THRESHOLD (the entry), not in the thorns (the-word phase, US-W2). He gives
// Pip the Word as a sending-off and then vanishes (one-shot spawnCondition), so the
// trial proper is still endured ALONE (US-100) — what goes with her into the thorns
// is the Word, not a companion. This is why he can't be missed: a cold player meets
// him the moment they enter, receives the gift, and only then walks east alone.

import {
  AreaDefinition,
  StoredTile,
  TILE_FLOOR,
  TILE_WALL,
  deriveTerrainFromTileMap,
  DrainZoneDefinition,
  QuietZoneDefinition,
  InscribedStoneDefinition,
  TriggerDefinition,
  DecorationDefinition,
} from './types';
import type { ObjectInstance } from '../../maps/objects';

// ───── Winding forced-path layout (FB-2, North-Star "feel" overhaul) ─────
// Jaco's complaint: the old 32×26 Briar was small and you could walk in a
// STRAIGHT line east — it read as a corridor, not a wilds. This replaces it with
// a 44×30 map whose floor is a SERPENTINE the player is forced to wind through:
// enter west (row 15), east along A, climb riser1, east along B, descend the long
// riser2, east along C, climb riser3, east along D to the far-east closing
// clearing + heart-bridge mouth. Walking straight is impossible — each leg
// dead-ends in thorns and forces a turn.
//
// HOW the path is forced: the grid is filled WALL, then the serpentine is carved
// FLOOR (SEGMENTS below). Collision in Briar is object-only (terrain is all
// passable briar-floor), so the wall has to be a real impassable OBJECT barrier:
// `thornBarrier` places a `bramble-cluster` on every wall cell touching the path
// (8-neighbourhood → no diagonal squeeze-through for the 24px player), sealing the
// corridor. `deadTreeAnchors` then layers tall 4×4 dead trees into the forest for
// height + canopy overhang. The carve + barrier generation here mirrors VERBATIM
// the validated single-source-of-truth at autonomy/briar-layout.cjs (BFS
// reachability spawn→both exits + every anchor, plus collision-on-floor asserts).
const COLS = 44;
const ROWS = 30;
const W = TILE_WALL;

// Carve rects, inclusive [c0, r0, c1, r1]. Order/coords identical to the validator.
const SEGMENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 14, 13, 16], //  A  entry corridor (west mouth at col 0)
  [6, 13, 9, 16], //   drain-1 dry pocket on A
  [11, 5, 13, 16], //  riser1 — up
  [11, 5, 24, 7], //   B  east (north band)
  [15, 4, 18, 8], //   quiet-grove clearing (north rest)
  [22, 5, 24, 23], //  riser2 — the long descent
  [22, 21, 35, 23], // C  east (south band)
  [27, 20, 30, 23], // drain-2 dry pocket on C
  [33, 11, 35, 23], // riser3 — up
  [33, 10, 43, 12], // D  east to the edge (east mouth at col 43)
  [37, 9, 42, 14], //  quiet-closing clearing (beacon + complete trigger + bridge)
];

const briarTileMap: StoredTile[][] = Array.from({ length: ROWS }, () =>
  Array.from({ length: COLS }, () => W as StoredTile),
);
for (const [c0, r0, c1, r1] of SEGMENTS)
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) briarTileMap[r][c] = TILE_FLOOR;

const isFloorCell = (c: number, r: number): boolean =>
  r >= 0 && r < ROWS && c >= 0 && c < COLS && briarTileMap[r][c] === TILE_FLOOR;

// ───── Drain zones (US-102) ─────
// Two patches with internal-weariness doubt lines. Tone is the believer's
// own discouragement — never external menace, never cruel.
const drainZones: DrainZoneDefinition[] = [
  {
    id: 'drain-1',
    col: 6,
    row: 13,
    width: 4,
    height: 4,
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
    col: 27,
    row: 20,
    width: 4,
    height: 4,
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
    col: 15,
    row: 4,
    width: 4,
    height: 4,
    narration: {
      lines: ["Pip's little spark grows calm and strong.", 'The thorns open up here.'],
    },
  },
  {
    id: 'quiet-closing',
    col: 37,
    row: 9,
    width: 5,
    height: 5,
    narration: {
      lines: [
        'The thorny woods end in this open spot.',
        'Pip looks back. Far away, she can see warm, glowing spots — the friends she helped.',
        'A long stone bridge is ahead. Its stones are old and cracked, like something hurt them long ago...',
      ],
    },
  },
];

// ───── Inscribed stones (the-word phase, US-W3/US-W4) ─────
// One carved stone sits inside drain-1 (cols 6–9 / rows 13–16). Before Pip
// receives the Word she can't read the marks; once she has it, remembering the
// stone steadies her ember so drain-1 no longer pulls her warmth down — the
// literal "the Word stabilises the ember in the dry places."
const inscribedStones: InscribedStoneDefinition[] = [
  {
    id: 'briar-stone-1',
    col: 8,
    row: 15,
    steadyRadius: 96,
    preWordThought: 'There are marks carved on this stone. Pip cannot read them yet.',
    rememberedLines: [
      'Pip remembers the words she was given.',
      'I am not alone. A light goes with me, even in the thorns.',
      'Her little ember holds steady and warm.',
    ],
  },
];

// ───── Quill, the owl who keeps the words (the-word phase, US-W2) ─────
// The gift hand-off that makes the merged "remember" verb reachable in-game: a
// short kid-level dialogue whose final node sets `has_word: true`, then chains the
// 'word-given' story scene. Free-gift framing per master-prd + biblical-guidance —
// the Word is GIVEN, not earned, and cannot be lost. Stays allegorical: the Word is
// never named as the Bible, Jesus is never named. Modeled on the Keeper hand-off
// (fog-marsh keeper-intro → ember-given): same setFlags-on-terminal-node +
// endStoryScene-on-script pattern. Quill is found by the `${npc.id}-intro`
// convention (GameScene), so his dialogue key MUST be 'quill-intro'.
const quillDialogue: import('./types').DialogueScript = {
  id: 'quill-intro',
  startNodeId: 'greeting',
  portraitId: 'quill',
  endStoryScene: 'word-given',
  nodes: [
    {
      id: 'greeting',
      speaker: 'Quill',
      text: 'You came a long way, little one. Your light is small. But it is true.',
      nextId: 'ask',
    },
    {
      id: 'ask',
      speaker: 'Quill',
      text: 'The thorns ahead are hard. What do you carry to help you?',
      choices: [
        { text: 'Only my little light.', nextId: 'gift' },
        { text: 'Who are you?', nextId: 'who' },
      ],
    },
    {
      id: 'who',
      speaker: 'Quill',
      text: 'I keep old words. They were true before the fog. They are true still.',
      nextId: 'gift',
    },
    {
      id: 'gift',
      speaker: 'Quill',
      text: 'I have something for you. Not because you earned it. Because it is given.',
      choices: [{ text: 'Take the words.', nextId: 'grant' }],
    },
    {
      // Terminal node — grants the Word. has_word flips here; Quill's spawnCondition
      // (has_word == false) then despawns him as the scene plays, exactly like the
      // Keeper after keeper_met. The remember verb + steadied drain read has_word.
      id: 'grant',
      speaker: 'Quill',
      text: 'Keep them close. When the dark pulls at your light, remember them — and your light will hold.',
      setFlags: { has_word: true },
    },
  ],
};

// Chained from quill-intro on dialogue close. Four warm beats (gold → cream),
// brighter than Briar's desaturated greens so the Word reads as "light given." The
// gift framing (beats 1-2), the payoff that the stones are now readable (beat 3),
// and Pip's own first-person carry-line (beat 4) — which echoes, without repeating,
// the inscribed stone's remembered line.
const wordGivenScene: import('./types').StorySceneDefinition = {
  id: 'word-given',
  beats: [
    {
      text: 'Quill opens his wings. A warm light spills out — like a book made of morning.',
      imageColor: 0xe0b15a,
      imageLabel: 'The words are opened',
    },
    {
      text: "The words are not Pip's. They were given. She did not earn them. She cannot lose them.",
      imageColor: 0xf2d98a,
      imageLabel: 'A gift, not a prize',
    },
    {
      text: 'Now the marks on the old stones are not just marks. Pip can read them. She can remember.',
      imageColor: 0xe8dcc0,
      imageLabel: 'The stones can be read',
    },
    {
      text: 'I am not alone. The words go with me — even in the thorns.',
      imageColor: 0xf4ead2,
      imageLabel: 'Into the thorns',
    },
  ],
};

// ───── Triggers ─────
// Co-located with quiet-closing's tiles — the same place serves restoration
// (quiet zone) and the journey-turn flag (this trigger). Empty actionRef
// because the narration is fired by the quiet zone, not this trigger.
const triggers: TriggerDefinition[] = [
  {
    id: 'briar-wilds-complete',
    col: 38,
    row: 11,
    width: 2,
    height: 2,
    type: 'thought',
    actionRef: '',
    condition: 'briar_wilds_complete == false',
    setFlags: { briar_wilds_complete: true },
    repeatable: false,
  },
  // bearing-fruit (Beat 7) — Briar's fruit is environmental. After the
  // heart-bridge seal (`atoned == true`) the drain zones no longer pull Pip's
  // warmth down (US-HB4 makes them inert on revisit). This one-shot thought, on
  // the central corridor so it fires whichever way Pip re-enters, names what she
  // feels: the dry place that used to drain her can't anymore. Kid-level, no
  // theological vocabulary; pairs with the inert drains for a felt change.
  {
    id: 'briar-atoned-return',
    col: 11,
    row: 14,
    width: 3,
    height: 2,
    type: 'thought',
    actionRef: 'The thorny woods used to pull at Pip\'s light. Now it stays warm, no matter how dark it gets.',
    condition: 'atoned == true AND briar_atoned_seen == false',
    setFlags: { briar_atoned_seen: true },
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
  // Breadcrumb that traces the SERPENTINE — one warm pool at each turn so the next
  // bend is in view as you reach the current one, pulling the cold player around
  // the snake instead of into the dark forest. Deliberately skips the two drain
  // pockets (they stay dark so the dry beats still feel bleak between the lights).
  lightAnchor('briar-light-1', 3, 15, 72, 0.75), //    entry, just east of spawn — pulls the player in
  lightAnchor('briar-light-2', 12, 11, 72, 0.75), //   riser1 — "turn up here"
  lightAnchor('briar-light-grove', 16, 6, 80, 0.8), // the north rest clearing ("the thorns open up here")
  lightAnchor('briar-light-3', 23, 9, 72, 0.75), //    riser2 top — "turn down here"
  lightAnchor('briar-light-4', 23, 18, 76, 0.78), //   riser2 bottom — the long descent's far end
  lightAnchor('briar-light-5', 34, 15, 80, 0.8), //    riser3 — "turn up here"
  lightAnchor('briar-light-6', 39, 11, 96, 0.85), //   closing clearing, co-located with the beacon — warm arrival
];

// No DecorationDefinitions in Briar — the terrain Wang tileset + the clustered
// object layer (dead-trees, bramble thickets) carry the visual load.
const decorations: DecorationDefinition[] = [];

// ───── Object placement (FB-2 winding overhaul; dead-tree per #346) ─────
// Two generated layers + a small hand-placed ground layer. Generation mirrors the
// validator (autonomy/briar-layout.cjs) exactly.
//
// 1. thornBarrier — a `bramble-cluster` on EVERY wall cell in the 8-neighbourhood
//    of the carved path. This is the wall: it seals the serpentine so the player
//    is forced to wind (no diagonal squeeze-through for the 24px box, since both
//    cells of any diagonal pinch are brambled). Impassable, 1×1, static depth.
const thornBarrier: ObjectInstance[] = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    if (briarTileMap[r][c] !== W) continue;
    let edge = false;
    for (let dr = -1; dr <= 1 && !edge; dr++)
      for (let dc = -1; dc <= 1 && !edge; dc++)
        if (!(dr === 0 && dc === 0) && isFloorCell(c + dc, r + dr)) edge = true;
    if (edge) thornBarrier.push({ kind: 'bramble-cluster', col: c, row: r });
  }

// 1b. backThorns (FB-2 art-gate fix) — the `bramble-cluster` sprite is a ROUND
//    ball, so a single ring tiles with dark diamond gaps at every 4-corner
//    junction (the art gate read PR #127's first cut as "separated dots, not a
//    thorn wall"). Add a SECOND ring one cell deeper — wall cells 8-adjacent to a
//    ring-1 cell, themselves wall (never floor) — so a back ball sits behind each
//    front-ring corner gap and the barrier reads as one continuous dark thicket.
//    Every 7th back cell is a passable `twisted-root` instead (pale undergrowth
//    peeking through, breaks the all-balls monotony). These are all DEEP wall
//    cells → floor reachability and the ring-1 collision seal are UNCHANGED. The
//    back ring is rendered BEHIND ring-1 (placed first in briarObjects; non-tall
//    objects share static depth 2.5, so array order is draw order).
const thornSet = new Set(thornBarrier.map((b) => `${b.col},${b.row}`));
const backThorns: ObjectInstance[] = [];
let backIdx = 0;
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    if (briarTileMap[r][c] !== W) continue;
    if (thornSet.has(`${c},${r}`)) continue; // skip ring-1
    let touches = false;
    for (let dr = -1; dr <= 1 && !touches; dr++)
      for (let dc = -1; dc <= 1 && !touches; dc++)
        if (!(dr === 0 && dc === 0) && thornSet.has(`${c + dc},${r + dr}`)) touches = true;
    if (!touches) continue;
    backThorns.push({ kind: backIdx % 7 === 0 ? 'twisted-root' : 'bramble-cluster', col: c, row: r });
    backIdx++;
  }

// 2. deadTreeAnchors — tall 4×4 dead trees layered into the forest for height +
//    canopy overhang along the route (#346: collides ONLY on trunk-base (c+1,r+3),
//    the rest is walk-under shade; Y-sorted so Pip passes behind from above). The
//    trunk base is always a barrier wall cell (never the path), spaced ≥3 apart.
const deadTreeAnchors: ObjectInstance[] = [];
const TREE_MAX = 34;
const takenBases = new Set<string>();
for (let i = 0; i < thornBarrier.length && deadTreeAnchors.length < TREE_MAX; i++) {
  if (i % 11 !== 0) continue;
  const b = thornBarrier[i];
  const anchorC = b.col - 1;
  const anchorR = b.row - 3; // trunk base (anchorC+1, anchorR+3) == (b.col, b.row): a wall cell
  if (anchorC < 0 || anchorR < 0 || anchorC + 3 >= COLS || anchorR + 3 >= ROWS) continue;
  const key = `${b.col},${b.row}`;
  if (takenBases.has(key)) continue;
  let tooClose = false;
  for (const k of takenBases) {
    const [kc, kr] = k.split(',').map(Number);
    if (Math.abs(kc - b.col) <= 2 && Math.abs(kr - b.row) <= 2) {
      tooClose = true;
      break;
    }
  }
  if (tooClose) continue;
  takenBases.add(key);
  deadTreeAnchors.push({ kind: 'briar-dead-tree', col: anchorC, row: anchorR });
}

// 3. Ground layer — passable twisted-roots inside the two drain pockets (the
//    false-hope read), plus the inscribed stone's sprite+collision (kept in sync
//    with briar-stone-1 at 8,15 inside drain-1).
const briarGround: ObjectInstance[] = [
  { kind: 'twisted-root', col: 7, row: 14 }, { kind: 'twisted-root', col: 9, row: 15 },
  { kind: 'twisted-root', col: 7, row: 16 },
  { kind: 'twisted-root', col: 28, row: 21 }, { kind: 'twisted-root', col: 29, row: 22 },
  { kind: 'twisted-root', col: 28, row: 23 },
  { kind: 'cliff-stone', col: 8, row: 15 },
];

// backThorns first → rendered BEHIND the ring-1 thornBarrier (shared depth 2.5,
// array order = draw order), so the back balls fill the front ring's corner gaps.
const briarObjects: ObjectInstance[] = [...backThorns, ...thornBarrier, ...deadTreeAnchors, ...briarGround];

export const briarWilds: AreaDefinition = {
  id: 'briar-wilds',
  name: 'Briar Wilds',
  // Objective banner (C10 — Briar Wilds had none). Base goal sends the cold
  // player along the lit serpentine toward the far clearing; once they reach it
  // (briar_wilds_complete flips at the closing trigger, live in-scene) the goal
  // becomes a reflective close. The breadcrumb lights, not a straight "go east",
  // are the wayfinding now that the path winds. Wayfinding only — no doctrine.
  objective: 'Wind your way through the thorny woods. Follow the warm lights.',
  // First-match-wins (GameScene picks the first true rung, else the base objective).
  // Order = journey state: meet Quill → remember at the stone → cross → closed.
  conditionalObjective: [
    {
      // On entry Pip always has the ember (from Fog Marsh), so this points the cold
      // player straight at the threshold owl before they can wander into the dark.
      condition: 'has_ember_mark == true AND has_word == false',
      text: 'An owl waits by the thorns with a gift for you. Go and meet Quill.',
    },
    {
      condition: 'has_word == true AND remembered_briar-stone-1 == false',
      text: 'Remember the words at the carved stone. They will steady your light.',
    },
    {
      // The thorns are behind her; the long stone bridge foreshadowed at the
      // east clearing is now walkable (gated on has_word, true by here). Point
      // the cold player onto it. Wayfinding only — no doctrine.
      condition: 'briar_wilds_complete == true',
      text: 'You crossed the thorns. The old stone bridge is just east. Cross it.',
    },
  ],
  mapCols: COLS,
  mapRows: ROWS,
  // Briar's own PixelLab Wang tileset (briar-floor -> briar-thorn). Its registry
  // atlasKey is 'tileset-briar-wilds-floor-thorn' and GameScene loads
  // assets/tilesets/briar-wilds-floor-thorn/tilemap.png directly — it does NOT
  // reuse the ashen-sand atlas (earlier comment was stale).
  tileset: 'briar-wilds-floor-thorn',
  decorationsTileset: 'tiny-town',
  map: briarTileMap,
  // Vertex grid all 'briar-floor' (passable). The impassable thorn patches are
  // carried by the placed object layer (shipped — PRs #87, #91), not the terrain.
  terrain: deriveTerrainFromTileMap(briarTileMap, 'briar-floor'),
  // The serpentine's walls are the generated thornBarrier (bramble) layer — NOT
  // derived wall-stone objects (the map is wall-filled, so deriving would emit a
  // stone for every forest cell). briarObjects = thornBarrier + dead trees + ground.
  objects: briarObjects,
  // Quill, the word-keeper owl, at the west threshold (col 4, row 13) on the lit
  // entry corridor — two tiles east of the player spawn (1,13), so he's the first
  // thing a cold player meets. One-shot: spawns only while the Word is ungiven
  // (has_ember_mark true, the entry state) and despawns the instant 'grant' flips
  // has_word, leaving the thorns to be walked alone. sprite 'quill' falls back to a
  // warm-amber marker until the owl sprite set lands; color tuned to read owl-ish.
  npcs: [
    { id: 'quill', name: 'Quill', col: 5, row: 15, color: 0xe0b15a, sprite: 'quill', wanderRadius: 0, awarenessRadius: 2, spawnCondition: 'has_ember_mark == true AND has_word == false' },
  ],
  props: [],
  decorations,
  triggers: [...triggers, ...lightAnchors],
  dialogues: { 'quill-intro': quillDialogue },
  storyScenes: { 'word-given': wordGivenScene },
  drainZones,
  quietZones,
  inscribedStones,
  // Glow-only wayfinding beacon (C13, Issue #59). Briar read as a void with
  // nothing to aim at. This warm glow sits on the far-east goal clearing
  // (quiet-closing / the completion trigger at ~39,11) so a cold player who has
  // wound the serpentine has a light to walk toward — the literal payoff of
  // "the thorns open up here" toward the light. UI-camera, so it survives the
  // desaturation pass and is independent of the deferred real Briar tileset. No
  // smoke plume (would mis-read as a fire); just the glow. Wayfinding, no doctrine.
  lightBeacon: { col: 39, row: 11 },
  // Player enters from the west edge. Exit back to Ashen Isle on the same edge.
  playerSpawn: { col: 2, row: 15 },
  exits: [
    {
      // West-edge return to Ashen Isle — drops the player at the east-exit
      // approach tile so back-and-forth navigation is symmetric.
      id: 'briar-to-ashen',
      col: 0,
      row: 14,
      width: 1,
      height: 3,
      destinationAreaId: 'ashen-isle',
      entryPoint: { col: 48, row: 18 },
    },
    {
      // East-edge mouth of the Heart Bridge (heart-bridge phase, US-HB1). Sits at
      // the far clearing the whole map points toward (lightBeacon 39,11), past the
      // completion trigger. Gated on has_word so the span only opens once Pip
      // carries the Word out of the thorns — the atonement beat follows receiving
      // the Word, never precedes it. Drops her at the bridge's west spawn (1,2).
      id: 'briar-to-heart-bridge',
      col: 43,
      row: 10,
      width: 1,
      height: 3,
      destinationAreaId: 'heart-bridge',
      entryPoint: { col: 1, row: 2 },
      condition: 'has_word == true',
    },
  ],
  visual: { floorColor: 0x4a5a4a, wallColor: 0x2a2a30 },
};
