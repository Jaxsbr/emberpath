import { TerrainId } from '../../maps/terrain';
import { ObjectInstance, ObjectKindId } from '../../maps/objects';

// Stage-1 authoring tile values for the migration helpers below. Legacy
// FLOOR / WALL enum is gone — stage-1 area files declare
// `const F = TILE_FLOOR; const W = TILE_WALL;` shorthand instead. `map` itself
// is retained on AreaDefinition through stage 1 to preserve the editor's
// current renderer (US-97 fully migrates the editor); US-98's re-author
// removes `map` entirely once every area is hand-painted on terrain + objects.
export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export type StoredTile = 0 | 1;

// Per-element light declaration consumed by LightingSystem (US-75). Tier 1 =
// always rendered. Tier 2 = rendered at intensity 0 until has_ember_mark === true,
// then renders at the configured intensity. Author-controlled — no user-input
// pathway feeds this. All fields optional so omitting the block uses defaults.
export interface LightSpec {
  radius?: number;
  intensity?: number;
  tier?: 1 | 2;
}

export interface NpcDefinition {
  id: string;
  name: string;
  col: number;
  row: number;
  // Retained for editor's map-overview mode — the game scene now renders via sprite.
  color: number;
  sprite: string;
  wanderRadius: number;
  awarenessRadius: number;
  // Optional flag-driven spawn gate. NPCs without a spawnCondition spawn
  // unconditionally on area load (existing behavior). NPCs with a spawnCondition
  // spawn only when evaluateCondition returns true at area load OR when a
  // referenced flag changes value mid-session. GameScene parses each
  // spawnCondition for flag names and subscribes per-flag via onFlagChange;
  // when any subscribed flag changes, the conditional-spawn pass re-evaluates
  // and any newly-eligible NPC fades in (alpha 0 -> 1, KEEPER_FADE_DURATION_MS).
  // Idempotent — already-spawned NPCs are skipped on re-evaluation.
  spawnCondition?: string;
  // Optional per-NPC override of the default tier-1 NPC light registered at
  // spawn (US-75). Omit the block to use LIGHTING_CONFIG.npcRadius/npcIntensity.
  // Set `intensity` lower to read as "fading" (Old Man → Fading metaphor).
  // Set `tier: 2` to make this NPC's light dormant until the player has the Ember.
  lightOverride?: LightSpec;
}

export interface DialogueChoice {
  text: string;
  nextId: string;
  setFlags?: Record<string, string | number | boolean>;
  // When set, picking this choice fires EmberShareSystem.startPulse at the
  // named NPC sprite (resolved via GameScene.npcSpritesById). DialogueSystem
  // does NOT auto-advance to nextId — the GameScene choice handler takes
  // ownership of the dialogue advance via dialogueSystem.advanceAfterPulse(),
  // called from the pulse onComplete callback so the warming flag flip and
  // the next dialogue node land on the same tick (US-85 ember-pulse).
  firePulseTarget?: string;
  // Optional gate evaluated through `systems/conditions.ts:evaluateCondition`
  // (same parser as DialogueScript.condition / TriggerDefinition.condition).
  // When the condition fails, DialogueSystem hides the choice from the
  // rendered list — the player cannot pick it. Used to gate the "Share warmth"
  // option on `has_ember_mark == true AND npc_warmed_<id> == false` (US-82,
  // US-83). Choices without a condition always render.
  condition?: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  nextId?: string;
  choices?: DialogueChoice[];
  portraitId?: string;
  // Optional flag side-effects fired when the node is shown, BEFORE the
  // typewriter starts. Mirrors the DialogueChoice.setFlags shape so the
  // authoring vocabulary stays consistent. Used by US-72 (Keeper rescue) so
  // the action node atomically sets has_ember_mark, keeper_met, and
  // marsh_trapped: false in one place — downstream onFlagChange subscribers
  // (overlay create on has_ember_mark; collision/decoration restore on
  // marsh_trapped) fire within the same call stack as showNode.
  setFlags?: Record<string, string | number | boolean>;
  // Optional Pip inner-thought fired when the dialogue closes *from this node*.
  // Node-scoped sibling of DialogueScript.endStoryScene: it fires only when the
  // dialogue ends on THIS terminal node, never on other exits of the same
  // script. Used for the Wren grace beat — the pre-Ember "I have no warmth yet"
  // exit nudges Pip toward the smoke, while the warm-share exit stays silent.
  endThought?: string;
}

export interface DialogueScript {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
  portraitId?: string;
  // Optional story scene id launched on dialogue close. GameScene's setOnEnd
  // callback reads DialogueSystem.getEndStoryScene() AFTER flushSave (so the
  // world state is checkpointed before the story scene pauses GameScene) and
  // calls launchStoryScene with the id. Existing scripts without this field
  // close as before — no story scene launch.
  endStoryScene?: string;
  // Optional flag-driven script gate. When two scripts target the same NPC
  // (matched by id prefix `${npc.id}-`), GameScene.selectScriptForNpc walks
  // all variants and picks the first whose condition evaluates true; the base
  // script `${npc.id}-intro` (no condition) is the fallback. Used by US-81 so
  // the Old Man's post-Ember branch (`old-man-illumined`, condition
  // `has_ember_mark == true`) takes precedence when the player carries the
  // Ember, without disturbing the base Fading dialogue.
  condition?: string;
}

export interface StoryBeat {
  text: string;
  imageKey?: string;
  imageColor?: number;
  imageLabel?: string;
  // Optional asset-manifest override key (US-90). When set, StoryScene resolves
  // the texture key as `scene-${assetRef}` instead of the default
  // `scene-${storySceneId}-${beatIndex}`. Existing beats without `assetRef`
  // continue to use the positional default — no migration needed.
  assetRef?: string;
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
  // Optional flag side-effects fired AFTER the one-shot bookkeeping and
  // condition gate, BEFORE the type dispatch — so a downstream callback that
  // reads the flag in the same frame sees the new value. Mirrors the
  // DialogueChoice.setFlags shape so the authoring vocabulary is consistent.
  setFlags?: Record<string, string | number | boolean>;
  // Optional flag counters incremented on every fire. Each entry calls
  // incrementFlag(name) — used by repeatable triggers that need to advance a
  // counter (e.g. escape_attempts band escalation in fog-marsh).
  incrementFlags?: string[];
  repeatable: boolean;
  // Optional light registered at the trigger's centre (US-75). Used to mark
  // "this is a place worth investigating" — wayfinding without exposition.
  // Tier 2 lights only render post-Ember (US-77 reveal pattern).
  light?: LightSpec;
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

// Tile-snapped decoration overlay. Distinct from PropDefinition: decorations are
// strictly 1×1 atlas frames composed by area authors to build visual vocabulary
// (paths, building walls/roofs, fences, water edges, doors-as-decoration). They
// render at depth 2 — above base tiles, below props — and contribute zero to
// collision (the underlying FLOOR/WALL cell still controls walkability).
export interface DecorationDefinition {
  col: number;
  row: number;
  spriteFrame: string;
  // Optional flag-driven visibility gate. When present, the decoration sprite
  // is created at scene start but its visibility tracks evaluateCondition.
  // GameScene re-evaluates conditional decorations only on flag-change events
  // (Learning EP-01: no per-frame full re-render). Existing decorations without
  // a condition render unconditionally as today.
  condition?: string;
  // Optional light registered at the decoration's centre (US-75). E.g. a glowing
  // path stone or a lantern. Tier 2 = dormant until Ember.
  light?: LightSpec;
  // Optional alpha gating (US-77). When true, the decoration's alpha is set
  // per movement-tick to its lit coverage: 1.0 if its centre falls inside any
  // active light, 0.0 otherwise. Combined with `light: { tier: 2 }` registered
  // at the same position, this hides the decoration until post-Ember.
  alphaGatedByLight?: boolean;
}

// Conditional terrain block — declared on AreaDefinition, evaluated by
// GameScene.applyConditionalTerrain (US-98). When the named flag value
// changes, every listed vertex in `vertices` flips its terrain id between
// `whenTrue` and `whenFalse`. The Wang resolver re-renders affected cells
// and collision unifies via terrain passability (e.g. water `passable: false`
// blocks the cell when all 4 vertices flip to water). The condition string
// goes through the existing systems/conditions.ts:evaluateCondition parser —
// no new condition syntax is introduced.
export interface ConditionalTerrainBlock {
  condition: string;
  vertices: {
    col: number;
    row: number;
    whenTrue: TerrainId;
    whenFalse: TerrainId;
  }[];
}

// Wayfinding signpost (C7, Jaco idea 2026-06-14). A sign the player can walk up
// to: entering its radius fades in a white outline highlight on the sign plus a
// short destination label ("Dock → Fog Marsh") so a first-time player can read
// where a path leads — turning the existing decorative signposts into real
// directions (North Star clarity track). Place `col`,`row` on the matching sign
// object so the highlight aligns with the rendered sign; `kind` selects the
// atlas/footprint for the outline clone and defaults to 'sign-wood'. Keep
// `label` to a couple of kid-readable words.
export interface SignpostDefinition {
  col: number;
  row: number;
  label: string;
  kind?: ObjectKindId;
}

export interface AreaDefinition {
  id: string;
  name: string;
  // Stage-1 migration: `map` remains alongside `terrain` + `objects` while
  // consumer code is migrated. Final state (US-92 cleanup) removes `map` and
  // every legacy tile-type reference.
  map: StoredTile[][];
  // Vertex-grid terrain. Dimensions are (rows + 1) × (cols + 1) so that every
  // cell (row, col) is bounded by the four vertices [row][col], [row][col+1],
  // [row+1][col+1], [row+1][col]. Wang resolver (US-93) samples these 4
  // vertices to pick the atlas frame; collision (US-94) ANDs their passability.
  terrain: TerrainId[][];
  // Sparse list of placed objects. Rendered above terrain at depth 2.5 (US-94).
  // Each instance contributes to cell collision via the kind's `passable` flag.
  objects: ObjectInstance[];
  // Optional flag-gated terrain-flip blocks. Used by Fog Marsh (US-98) to flip
  // path↔water at the marsh-trap closure on `marsh_trapped` flag change.
  conditionalTerrain?: ConditionalTerrainBlock[];
  mapCols: number;
  mapRows: number;
  // Tileset id used for terrain Wang resolution (US-95 PixelLab tilesets).
  tileset: string;
  // Tileset id used for decoration + prop atlas frame lookups. Stage-1 / 2A
  // decorations and props still reference Kenney atlas frame numbers (e.g.
  // '36' wooden plank, '120' cliff stone) rather than PixelLab frames; this
  // field keeps the legacy Kenney atlas resolvable for them. US-98's
  // re-author migrates decorations + props to the new authoring vocabulary
  // and deletes this field.
  decorationsTileset: string;
  npcs: NpcDefinition[];
  props: PropDefinition[];
  decorations: DecorationDefinition[];
  triggers: TriggerDefinition[];
  dialogues: Record<string, DialogueScript>;
  storyScenes: Record<string, StorySceneDefinition>;
  // Optional opening cinematic (C2-a). When set, GameScene plays this story
  // scene once at a true New Game start in this area (no area-transition
  // entryPoint, no Continue resumePosition), gated by the `ashen_intro_played`
  // flag so it never repeats. The id must exist in `storyScenes`.
  introStoryScene?: string;
  // Standing "what to do next" cue (C2-b). When set, GameScene shows this single
  // short, concrete goal in a screen-fixed top-centre banner so a first-time
  // player always knows where to head — guidance isn't only the reactive
  // thought bubbles you stumble into. Keep it one kid-readable sentence.
  objective?: string;
  // Objective that changes as the story moves (C8 follow-up). `objective` above
  // is the opening goal; once the player progresses, the banner should point at
  // the NEXT step instead of standing stale ("Find the smoke" still showing
  // after the smoke is found). Each entry is a flag condition + the goal to show
  // while it holds; GameScene picks the FIRST matching entry (top to bottom) and
  // falls back to `objective` when none match. A genuine change replays the
  // banner's attention beat (objectiveBanner.ts), so the player sees it update.
  // Keep every line one kid-readable sentence. Wayfinding only — no doctrine.
  conditionalObjective?: { condition: string; text: string }[];
  // Wayfinding signposts (C7). Optional; areas without any read the same as
  // before. Each entry lights its sign + shows a destination label on approach.
  signposts?: SignpostDefinition[];
  // Distant smoke beacon (C6, Issue #46). Optional. When set, a thin smoke plume
  // rises from this tile (with a warm fire glow at its base) as the literal far
  // target for a "find the smoke"-style objective. Place it on impassable
  // water/horizon so it reads as distant, not something the player walks into.
  smokeBeacon?: { col: number; row: number };
  // Glow-only beacon (C13, Issue #59). Same system as smokeBeacon but with the
  // smoke plume omitted — a standalone warm light the player walks TOWARD as a
  // wayfinding goal. Used where a smoke column would mis-read (e.g. Briar Wilds'
  // far clearing where "the thorns open up" toward the light). Place on the goal
  // tile. UI-camera, so it survives desaturation and is tileset-independent.
  lightBeacon?: { col: number; row: number };
  // Atmospheric fog overlay (C12). When true, a drifting bank of pale mist plus a
  // center-clear screen veil is layered over the scene so the area reads as actual
  // fog — used by Fog Marsh, whose dungeon-substitute tileset otherwise reads as
  // grey stone, not marsh. Procedural (no assets). Opt-in; omitting it is a no-op.
  fogOverlay?: boolean;
  playerSpawn: { col: number; row: number };
  exits: ExitDefinition[];
  // Drain zones (US-102) — twisted false-hope patches that drain ember warmth
  // and queue doubt-voice thought bubbles on entry. Briar Wilds defines ≥2.
  drainZones?: DrainZoneDefinition[];
  // Quiet places (US-103) — small clearings that restore ember warmth and
  // play first-entry narration. Briar Wilds defines ≥2 (one carries the
  // closing-reflection beat).
  quietZones?: QuietZoneDefinition[];
  // Inscribed stones (the-word phase, US-W3/US-W4) — carved stones that read as
  // unreadable before Pip receives the Word and become readable after. Once
  // *remembered* (`remembered_<id>` flag set), a stone steadies the ember: while
  // the player stands within its radius, drain zones no longer pull warmth down
  // (the Word stabilises the ember in the dry places). Opt-in; omitting is a
  // no-op.
  inscribedStones?: InscribedStoneDefinition[];
  // Retained for editor's map-overview mode — the game scene now renders via tileset.
  visual: { floorColor: number; wallColor: number };
}

// Doubt-voice / narration sequence shape — a list of bubble lines cycled
// through on re-entry (drain) or shown once on first entry (quiet).
export interface ThoughtSequence {
  lines: string[];
}

// Drain zone (US-102) — rectangular patch in tile coordinates. While the
// player bounding-box centre overlaps the zone, ember warmth drains at
// `WARMTH_DRAIN_PER_SECOND × (drainMultiplier ?? 1)`. On entry transition
// (outside → inside), the next doubt line is queued via the thought-bubble
// system (cycled by `doubt_count_<id>` modulo `doubts.lines.length`).
export interface DrainZoneDefinition {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
  drainMultiplier?: number;
  doubts?: ThoughtSequence;
}

// Quiet place (US-103) — rectangular patch in tile coordinates. While the
// player bounding-box centre overlaps the zone, ember warmth restores at
// `WARMTH_RESTORE_PER_SECOND × (restoreMultiplier ?? 1)`. On first entry
// (`quiet_seen_<id>` flag false), the narration sequence is queued via the
// thought-bubble system (one-shot per zone). Quiet wins over drain on
// overlap (US-103 design — grace stronger than trial).
export interface QuietZoneDefinition {
  id: string;
  col: number;
  row: number;
  width: number;
  height: number;
  restoreMultiplier?: number;
  narration?: ThoughtSequence;
}

// Inscribed stone (the-word phase, US-W3/US-W4) — a carved stone at a tile
// coordinate. Before Pip receives the Word (`has_word` flag), tapping it shows
// `preWordThought` (she can't read the marks yet). After the Word, tapping it
// shows `rememberedLines` in sequence and sets `remembered_<id>` — the act of
// *remembering* a gift she was given. Once remembered, the stone steadies the
// ember within `steadyRadius` pixels of its tile centre: drain zones overlapping
// that radius stop pulling warmth down. `steadyRadius` defaults to 96px (3 tiles)
// if omitted. All player-facing text is young-child level + allegorical (the
// Word / Bible / Jesus are never named in-game).
export interface InscribedStoneDefinition {
  id: string;
  col: number;
  row: number;
  steadyRadius?: number;
  preWordThought: string;
  rememberedLines: string[];
}

// ───── Stage-1 migration helpers ─────
//
// Used by ashen-isle.ts and fog-marsh.ts to derive the new vertex-terrain
// grid and sparse-object list from their existing StoredTile[][] authoring
// arrays — no manual re-author until US-98. The helpers preserve visual
// parity: every vertex is set to the area's base terrain (uniform), and
// every WALL cell becomes an impassable ObjectInstance whose Kenney atlas
// frame is the area's wall-class kind.

/**
 * Derive a uniform (rows+1) × (cols+1) vertex-terrain grid from a
 * StoredTile[][] authoring array. Every vertex is set to `baseTerrain`.
 * Stage-1 only — US-98 replaces with hand-painted vertex data.
 */
export function deriveTerrainFromTileMap(
  tileMap: StoredTile[][],
  baseTerrain: TerrainId,
): TerrainId[][] {
  const rows = tileMap.length;
  const cols = tileMap[0]?.length ?? 0;
  const out: TerrainId[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: TerrainId[] = [];
    for (let c = 0; c <= cols; c++) {
      row.push(baseTerrain);
    }
    out.push(row);
  }
  return out;
}

/**
 * Derive a sparse ObjectInstance[] from a StoredTile[][] authoring array.
 * Emits one impassable object of `wallKind` for every WALL cell so that
 * stage-1 collision unification (US-94) reproduces today's collision
 * exactly.  Stage-2 (US-98) re-authors objects by hand.
 */
export function deriveObjectsFromTileMap(
  tileMap: StoredTile[][],
  wallKind: ObjectKindId,
): ObjectInstance[] {
  const out: ObjectInstance[] = [];
  for (let r = 0; r < tileMap.length; r++) {
    const row = tileMap[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] === TILE_WALL) {
        out.push({ kind: wallKind, col: c, row: r });
      }
    }
  }
  return out;
}
