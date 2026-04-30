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
  playerSpawn: { col: number; row: number };
  exits: ExitDefinition[];
  // Retained for editor's map-overview mode — the game scene now renders via tileset.
  visual: { floorColor: number; wallColor: number };
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
