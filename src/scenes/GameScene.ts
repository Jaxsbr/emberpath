import Phaser from 'phaser';
import { TILE_SIZE, PLAYER_SIZE, NPC_SIZE } from '../maps/constants';
import { TILESETS, hasTileset } from '../maps/tilesets';
import { resolveWangFrame, pickWangTilesetForCell } from '../maps/wang';
import { TerrainId, TERRAINS } from '../maps/terrain';
import { OBJECT_KINDS, ObjectInstance } from '../maps/objects';
import { AreaDefinition, NpcDefinition, DialogueScript } from '../data/areas/types';
import { AreaPassability } from '../systems/collision';
import { STYLE_PALETTE } from '../art/styleGuide';
import { getArea, getDefaultAreaId } from '../data/areas/registry';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { InscribedStoneSystem } from '../systems/inscribedStone';
import { DialogueSystem } from '../systems/dialogue';
import { ThoughtBubbleSystem } from '../systems/thoughtBubble';
import { ObjectiveBannerSystem } from '../systems/objectiveBanner';
import { WaterShimmerSystem } from '../systems/waterShimmer';
import { AmbientMotesSystem } from '../systems/ambientMotes';
import { FogOverlaySystem } from '../systems/fogOverlay';
import { SmokeBeaconSystem } from '../systems/smokeBeacon';
import { SignpostWayfindingSystem } from '../systems/signpostWayfinding';
import { TriggerZoneSystem } from '../systems/triggerZone';
import { DebugOverlaySystem } from '../systems/debugOverlay';
import { AnimationSystem } from '../systems/animation';
import { evaluateCondition } from '../systems/conditions';
import { DIRECTIONS } from '../systems/direction';
import { NPC_SPRITES, getNpcSpriteIds, hasNpcSprite, NPC_PORTRAITS, getNpcPortraitIds } from '../systems/npcSprites';
import { NpcBehaviorSystem } from '../systems/npcBehavior';
import { LightingSystem, RegisteredLight } from '../systems/lighting';
import { LIGHTING_CONFIG } from '../systems/lightingConfig';
import { DesaturationPipeline } from '../systems/desaturationPipeline';
import { EmberShareSystem } from '../systems/emberShare';
import { EmberWarmthSystem, WARMTH_FLOOR, WARMTH_MAX } from '../systems/emberWarmth';
import { getFlag, setFlag, onFlagChange } from '../triggers/flags';
import { writeSave } from '../triggers/saveState';

const TARGET_VISIBLE_TILES = 10;
const FADE_DURATION = 400;
// The deep painted beyond the map edge for any area smaller than the viewport (the
// Heart Bridge span, #108) — a near-black cool tone that reads as the gulf the bridge
// crosses. Full-screen maps cover the frame, so this never shows for them.
const VOID_DEEP_COLOR = '#0d0e14';
// Conditional NPC spawn fade (US-71). Sprite alpha tweens from 0 to 1 over
// KEEPER_FADE_DURATION_MS so the appearance reads as "light breaks in" rather
// than a pop-in. Player input is suspended for KEEPER_INPUT_SUSPEND_MS — the
// fade itself is 500ms but the input lock holds 1000ms so the player has a
// beat to register the appearance before regaining control.
const KEEPER_FADE_DURATION_MS = 500;
const KEEPER_INPUT_SUSPEND_MS = 1000;
// Player ember overlay (US-73). Vertical offset from the player's centre to
// the ember's centre — placed above the head silhouette without z-fighting
// the body sprite. The overlay renders at depth 5.5 (literal fractional
// depth between Entities at 5 and Thoughts at 8) so it always shows above
// the player but below thought bubbles.
const EMBER_OFFSET_Y = -28;
// Soft ember glow (replaces the old flat orange Arc — Jaco 2026-06-13: "just an
// orange circle, looks pretty bad"). A pre-baked warm radial-gradient texture
// (white-hot core → gold → transparent) drawn ADD-blended so it reads as a
// living glow rather than a hard disc, with a gentle breathing pulse so the
// Ember feels alive on Pip. Render radius lerps with warmth (US-101).
const EMBER_GLOW_KEY = 'player-ember-glow';
const EMBER_GLOW_TEX_SIZE = 64;
const EMBER_DEPTH = 5.5;
// Carried Word lantern (US-W1 carried visual, Issue #93). After Pip receives the
// Word from Quill (`has_word`), she carries a lit lantern — "the Word as light",
// the same lamp she is handed in the the-word-gift scene (a lamp unto her feet).
// A small sprite that bobs at her side with a soft warm halo, mirroring the
// emberOverlay lifecycle: created when has_word flips true OR is already true on
// scene create (area transitions / Continue-from-save), destroyed when unset
// (Reset Progress via resetAllFlags). Deliberately distinct from the ember (a
// round white-hot glow on her body): this is a recognizable lamp held at her side
// so a first-time player gets a persistent "I carry the Word now" confirmation.
const WORD_LANTERN_KEY = 'word-lantern-lit';
const WORD_LANTERN_DEPTH = 5.5; // ember band — composites above every entity
const WORD_LANTERN_OFFSET_X = 12; // held out at her side
const WORD_LANTERN_OFFSET_Y = 0; // body level (the ember rides higher at -28)
const WORD_LANTERN_DISPLAY_W = 18; // on-screen px (source is 48×64, kept in ratio) — large enough the flame reads
const WORD_LANTERN_DISPLAY_H = 24;
const WORD_LANTERN_GLOW_DIAMETER = 26; // tight, bright halo — a concentrated lit point, not a wide wash
const WORD_LANTERN_CAST_W = 28; // ground cast-glow: the flat warm pool the lamp throws at Pip's feet
const WORD_LANTERN_CAST_H = 13;
const WORD_LANTERN_CAST_DEPTH = 4.55; // on the ground, below the entity band [5,5.49) so it pools under Pip
// Y-sort entity band (#346). The player, NPCs, and `tall` objects (trees) all
// render in [ENTITY_DEPTH_BASE, ENTITY_DEPTH_BASE + ENTITY_DEPTH_SPAN), keyed
// on the world-y of their ground contact: an entity lower on the map (larger y)
// draws on top. This lets Pip pass behind a tree's canopy when she's above its
// trunk and in front when below. The span stays under EMBER_DEPTH (5.5) so the
// ember/lighting overlays always composite above every entity. Tile/decoration/
// prop layers (0–3) and non-tall objects (2.5) are unaffected.
const ENTITY_DEPTH_BASE = 5;
const ENTITY_DEPTH_SPAN = 0.49;
// NPC presence marker (C4-a, 2026-06-13). Audit F4: post the grey-out model the
// whole world is visible, but an un-warmed NPC reads as just another grey shape —
// nothing says "a soul to approach." A faint warm amber aura (the same soft
// additive radial-glow brush as Pip's ember, dimmer + cooler) haloes each
// un-warmed NPC so a first-time player always has clear targets to walk toward.
// It is a UI-camera object (so it survives the world desaturation, see
// createNpcPresenceGlow), which means it composites OVER the main camera — the
// NPC sprite never reads as washed out only because the glow texture is a ring
// (transparent centre), not a filled disc. It breathes gently (phase-varied per
// NPC so they don't pulse in lockstep), and is removed the moment the NPC is warmed — the full warmed light
// (npcWarmedRadius) is the payoff that replaces the waiting spark.
const NPC_PRESENCE_GLOW_KEY = 'npc-presence-glow';
const NPC_PRESENCE_TEX_SIZE = 64;
const NPC_PRESENCE_DEPTH = 4.6;
const NPC_PRESENCE_DIAMETER = NPC_SIZE * 2.4;
const NPC_PRESENCE_BASE_ALPHA = 0.5;
// Stable per-NPC phase offset (0..2π) from the id so auras breathe out of sync
// without Math.random (unavailable / non-deterministic in this build).
function npcPresencePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return (h / 360) * Math.PI * 2;
}
// NPCs that can be warmed via the ember-share verb (US-85). Each ID maps to a
// `npc_warmed_<id>` flag; on flip-to-true the matching NPC's tier-1 light is
// re-registered at brighter values and alpha-gated decorations within its new
// radius bloom in. Driftwood is intentionally absent — refusal sets a
// different flag (`npc_refused_driftwood`) and produces NO pulse / NO bump.
const WARMING_NPC_IDS = ['wren', 'old-man'] as const;
// Cumulative warming reduces the desaturation strength (US-86). Each warming
// flips the world a notch toward color; floor preserves Ashen Isle's faded
// identity so the island never reads as fully restored — only the Heart Bridge
// fully removes the Fading. With 2 warmings + base 1.0: 1.0 × (1 − 0.30) = 0.70
// (above the 0.40 floor).
const DESAT_REDUCTION_PER_WARMING = 0.15;
const DESAT_FLOOR = 0.4;
// US-HB2: number of crossing beats on the heart bridge (3 mid-span bands + the
// far-end seal). At the final beat the desat lift reaches 1 → full colour.
const HEART_BRIDGE_CROSSING_BEATS = 4;
// Autosave write throttle. The world-walk-frame autosave path returns before any
// localStorage IO when either guard fails — Learning EP-01 (loop invariants):
// no per-frame JSON.stringify, no per-frame setItem.
const SAVE_THROTTLE_MS = 1000;
const SAVE_MIN_DELTA_PX = 2;
// Source tilesets are 16×16; game tile size is 32×32 — sprites are scaled to TILE_SIZE on render.
const TILESET_SOURCE_SIZE = 16;

// Surrender trigger (US-80). The Keeper rescue fires when the player has tried,
// then stopped, near the closed exit. Configurable here so the timing can be
// tuned without editing code paths. Values chosen so the player must (a) attempt
// at least twice (effort), (b) come within ~4 tiles of the closed exit
// (location-significant), and (c) hold still for 4 seconds (genuine stop).
// Surrender is local to fog-marsh; the constants are declared at the top of
// GameScene to keep them discoverable next to other phase-level magic numbers.
const SURRENDER_MIN_ATTEMPTS = 2;
const SURRENDER_PROXIMITY_TILES = 4;
const SURRENDER_DURATION_MS = 4000;
// Closed exit centre in world pixels — col 14.5 (cols 13-16), row 22.
const SURRENDER_TARGET_X = 14.5 * TILE_SIZE;
const SURRENDER_TARGET_Y = 22 * TILE_SIZE;
// Stillness cue (C4-b / F5): a soft pale ring that gathers around Pip while she
// holds still, so a first-time player gets visible feedback that being still is
// *doing* something — the surrender trigger was previously a silent 4s wait that
// felt arbitrary. Rendered on the UI camera (projected to Pip's screen pos) so it
// survives the marsh desaturation, same as the NPC presence auras.
const STILLNESS_CUE_KEY = 'stillness-cue';
const STILLNESS_CUE_TEX_SIZE = 96;
const STILLNESS_CUE_DIAMETER = PLAYER_SIZE * 3.4;
const STILLNESS_CUE_MAX_ALPHA = 0.7;
const SURRENDER_HINT_DURATION_MS = 5200;

// Fox-pip sprite animation constants
// Idle: 4 frames per direction; Walk: 8 frames per direction (matches PixelLab output)
const ANIM_TYPES = ['idle', 'walk'] as const;
const FRAME_COUNTS: Record<typeof ANIM_TYPES[number], number> = { idle: 4, walk: 8 };
const ANIM_FRAME_RATE = 8;

export class GameScene extends Phaser.Scene {
  private area!: AreaDefinition;
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private inscribedStone!: InscribedStoneSystem;
  private dialogueSystem!: DialogueSystem;
  private thoughtBubble!: ThoughtBubbleSystem;
  private objectiveBanner!: ObjectiveBannerSystem;
  private triggerZone!: TriggerZoneSystem;
  private debugOverlay!: DebugOverlaySystem;
  private animationSystem!: AnimationSystem;
  private player!: Phaser.GameObjects.Sprite;
  private tileLayer: Phaser.GameObjects.GameObject[] = [];
  // Water cells (any corner is `water` terrain) tagged during renderTileMap for
  // the shimmer system. Mutated in place (.length=0 + push) so the reference
  // handed to WaterShimmerSystem survives a redrawTerrainOnly rebuild.
  private waterTiles: { sprite: Phaser.GameObjects.Sprite; col: number; row: number }[] = [];
  private waterShimmer!: WaterShimmerSystem;
  private ambientMotes!: AmbientMotesSystem;
  private fogOverlay: FogOverlaySystem | null = null;
  private smokeBeacon!: SmokeBeaconSystem;
  private signpostWayfinding!: SignpostWayfindingSystem;
  private decorationSprites: Phaser.GameObjects.Sprite[] = [];
  // Conditional decorations: visibility re-evaluated on flag changes only,
  // never per-frame (Learning EP-01).
  private conditionalDecorations: { sprite: Phaser.GameObjects.Sprite; condition: string }[] = [];
  // Alpha-gated decorations (US-77). Re-evaluated when the player has moved
  // more than alphaGateRecheckPx since last check OR when has_ember_mark
  // flips. Each entry stores the world centre so the lighting query is
  // primitive-only (Learning EP-01).
  private alphaGatedDecorations: { sprite: Phaser.GameObjects.Sprite; cx: number; cy: number }[] = [];
  private lastAlphaGateCheckX = Number.NaN;
  private lastAlphaGateCheckY = Number.NaN;
  private propSprites: Phaser.GameObjects.Sprite[] = [];
  // Object layer (US-94) — sparse list, rendered above terrain at depth 2.5.
  // Tracked as instance fields so cleanupResize can destroy them and uiCam can
  // ignore them. Reset to [] at the top of renderObjects().
  private objectSprites: Phaser.GameObjects.Image[] = [];
  // Conditional objects: visibility re-evaluated only on flag changes
  // (Learning EP-01). Each entry stores the underlying ObjectInstance so the
  // condition string is available for re-eval and so buildObjectCollisionMap
  // can re-derive the cell-block flag.
  private conditionalObjects: { sprite: Phaser.GameObjects.Image; instance: ObjectInstance }[] = [];
  // Translucent exit-zone overlays (US-92). Rendered at depth 0.5 between
  // terrain and decorations using STYLE_PALETTE.hopeGoldLight at alpha 0.25 so
  // exit invitations remain visible without a dedicated terrain frame.
  private exitOverlays: Phaser.GameObjects.Rectangle[] = [];
  // Per-flag unsubscribes for object-collision-map rebuild + conditional-
  // object visibility (US-94). One subscriber per unique flag named in any
  // ObjectInstance.condition; collected at create() and invoked in
  // cleanupResize.
  private objectFlagUnsubscribes: (() => void)[] = [];
  // Per-flag unsubscribes for conditionalTerrain flips (US-98). One
  // subscriber per unique flag named in any ConditionalTerrainBlock.condition.
  private conditionalTerrainUnsubscribes: (() => void)[] = [];
  // Per-flag unsubscribes for conditional decoration visibility (US-100).
  // One subscriber per unique flag named in any DecorationDefinition.condition.
  // Mirrors objectFlagUnsubscribes — flag flip drives setVisible re-evaluation.
  private decorationFlagUnsubscribes: (() => void)[] = [];
  // Per-flag unsubscribes for the changing objective banner (C8 follow-up). One
  // subscriber per unique flag named in any area.conditionalObjective entry; a
  // flip re-resolves which goal is active and re-sets the banner (replaying its
  // attention beat). Mirrors the decoration/object subscriber shape.
  private objectiveFlagUnsubscribes: (() => void)[] = [];
  // Cell-keyed runtime passability snapshot consumed by collision +
  // npcBehavior + movement (US-94). Built once at create() AND rebuilt on
  // any flag change referenced by an object's `condition`.
  private passability: AreaPassability = {
    terrain: [],
    objectBlockMap: new Map(),
  };
  private npcEntities: Phaser.GameObjects.GameObject[] = [];
  private npcSpritesById: Map<string, Phaser.GameObjects.Sprite> = new Map();
  // Faint warm "presence" auras for un-warmed NPCs (C4-a discoverability). Keyed
  // by NPC id; created alongside the sprite, removed on warming. Reset in
  // renderNpcs alongside npcSpritesById.
  private npcPresenceGlowById: Map<string, Phaser.GameObjects.Image> = new Map();
  private npcBehavior!: NpcBehaviorSystem;
  private activeDialogueNpcId: string | null = null;
  private boundWindowResize: (() => void) | null = null;
  private transitionInProgress = false;
  private lastSaveTime = 0;
  private lastSaveX = 0;
  private lastSaveY = 0;
  private marshTrappedUnsubscribe: (() => void) | null = null;
  private escapeAttemptsUnsubscribe: (() => void) | null = null;
  // Surrender timer (US-80). Single number field, accumulated each frame the
  // player is still + in proximity + has met min attempts + marsh is trapped.
  // Reset on input, proximity exit, condition fail. Not persisted — partial
  // surrender does not survive a force-close (spec: surrender must be a single
  // continuous moment of giving up).
  private surrenderTimerMs = 0;
  // C4-b / F5: one-shot "be still" inner-thought hint, fired the first frame the
  // player is eligible-and-still so they learn to stop struggling; the gather
  // ring gives ongoing feedback. Reset implicitly — the scene is recreated per
  // area load, so a fresh marsh entry re-arms the hint.
  private surrenderHintShown = false;
  private stillnessCue: Phaser.GameObjects.Image | null = null;
  // Per-flag unsubscribes for NPC spawnCondition watchers (US-71). Collected as
  // GameScene parses each conditional NPC's condition for flag names; invoked
  // from cleanupResize. activeNpcs is the filtered list passed to subsystems
  // (renderNpcs, NpcBehaviorSystem, NpcInteractionSystem, moveWithCollision) —
  // a Keeper that hasn't yet spawned is absent from this array so the player
  // doesn't collide with or interact with an invisible NPC.
  private spawnConditionUnsubscribes: (() => void)[] = [];
  private spawnInProgress = false;
  // Ember-share pulse zone-level mutual exclusion (US-85). Set true while the
  // pulse plays so movement, NPC interaction, trigger-zone evaluation, and
  // exit-zone checks all suppress on the same early-return chain as
  // transitionInProgress / spawnInProgress.
  private sharingInProgress = false;
  private emberShare!: EmberShareSystem;
  private activeNpcs: NpcDefinition[] = [];
  // Player ember overlay (US-73). Created when has_ember_mark flips true OR
  // when the flag is already true on scene create (covers area transitions
  // and Continue-from-save). Destroyed when the flag is unset (Reset Progress
  // notifies via resetAllFlags). The unsubscribe handle is invoked on
  // cleanupResize.
  private emberOverlay: Phaser.GameObjects.Image | null = null;
  private hasEmberMarkUnsubscribe: (() => void) | null = null;
  // Carried Word lantern + its warm halo (US-W1 / Issue #93). Lifecycle mirrors
  // emberOverlay: created on has_word flip-true or already-true at create,
  // destroyed on unset. Unsubscribe invoked in cleanupResize.
  private wordLantern: Phaser.GameObjects.Image | null = null;
  private wordLanternGlow: Phaser.GameObjects.Image | null = null;
  private wordLanternCast: Phaser.GameObjects.Image | null = null;
  private hasWordUnsubscribe: (() => void) | null = null;
  // Atoned carried-change (heart-bridge phase, US-HB1). The permanent `atoned`
  // state is granted once at the Heart Bridge crossing; thereafter the ember
  // burns brighter and steadier everywhere (applied in update()). Cached as a
  // primitive so the per-frame overlay update reads a boolean, not the flag
  // store (Learning EP-01). Unsubscribe invoked in cleanupResize.
  private atonedUnsubscribe: (() => void) | null = null;
  // Warming-flag onFlagChange unsubscribes (US-85). One per NPC in
  // WARMING_NPC_IDS. Each subscriber re-registers the NPC's tier-1 light at
  // brighter values on flip-to-true and restores baseline on flip-to-false /
  // undefined (resetAllFlags), forcing alpha-gate re-eval on the same tick
  // (mirrors US-77's has_ember_mark atomic flip pattern). Cleaned up in
  // cleanupResize (Async-cleanup safety criterion).
  private warmingUnsubscribes: (() => void)[] = [];
  // Cached has_ember_mark — read from localStorage once on create and updated
  // by the existing onFlagChange subscriber. LightingSystem.update reads this
  // each frame; reading the flag store directly would re-parse JSON on every
  // tick (Learning EP-01 facet — keep per-frame paths allocation-free).
  private hasEmberCached = false;
  // Cached `atoned` flag (heart-bridge phase, US-HB1). Read by the ember-overlay
  // update each frame; kept in sync by the onFlagChange subscriber so the loop
  // never touches the flag store (Learning EP-01).
  private atonedCached = false;
  // Cached `heart_bridge_crossing` counter (heart-bridge phase, US-HB2). Read by
  // updateEffectiveDesaturation to lift the grey overlay one quarter per crossed
  // band; kept in sync by its onFlagChange subscriber (set on flag-change only,
  // never per-frame — Learning EP-01). Unsubscribe invoked in cleanupResize.
  private heartBridgeCrossingCached = 0;
  private heartBridgeCrossingUnsubscribe: (() => void) | null = null;
  private lightingSystem!: LightingSystem;
  private desaturationPipeline: DesaturationPipeline | null = null;
  // EmberWarmthSystem (US-101) — constructed regardless of area (cheap on
  // areas with no drain/quiet zones; safer than conditional construction
  // because the system also handles ember_warmth load + Reset Progress).
  private emberWarmthSystem!: EmberWarmthSystem;

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    // Load all 96 fox-pip animation frames (2 types × 8 directions, idle:4 frames, walk:8 frames)
    for (const anim of ANIM_TYPES) {
      const frameCount = FRAME_COUNTS[anim];
      for (const dir of DIRECTIONS) {
        for (let i = 0; i < frameCount; i++) {
          const key = `fox-pip-${anim}-${dir}-${i}`;
          const path = `characters/fox-pip/${anim}/${dir}/frame_00${i}.png`;
          this.load.image(key, path);
        }
      }
    }

    // Load tileset atlases as uniform-grid spritesheets. Frame ids are numeric
    // indices; resolveWangFrame returns them as strings which Phaser accepts directly.
    // Nearest-neighbor filtering is applied globally via `pixelArt: true` in main.ts.
    //
    // Dedupe by atlasKey: two TILESETS entries may share one atlasKey (and thus
    // one on-disk tilemap.png), so the dedupe avoids enqueuing the same image
    // twice. The first entry with each atlasKey wins; subsequent entries skip.
    // (Each shipped area — including Briar's own 'tileset-briar-wilds-floor-thorn'
    // — has its own real atlas; the old "Briar reuses the ashen-sand placeholder"
    // note was stale, corrected in #95.)
    const loadedAtlasKeys = new Set<string>();
    for (const [id, def] of Object.entries(TILESETS)) {
      if (loadedAtlasKeys.has(def.atlasKey)) continue;
      loadedAtlasKeys.add(def.atlasKey);
      this.load.spritesheet(def.atlasKey, `tilesets/${id}/tilemap.png`, {
        frameWidth: TILESET_SOURCE_SIZE,
        frameHeight: TILESET_SOURCE_SIZE,
      });
    }

    // Load PixelLab object PNGs (US-96). One image per ObjectKindDefinition;
    // each is 32×32 with a transparent background. Phaser's default frame
    // (`__BASE`) is used at render time — renderObjects does not pass a
    // frame argument.
    for (const def of Object.values(OBJECT_KINDS)) {
      this.load.image(def.atlasKey, def.assetPath);
    }

    // Carried Word lantern sprite (Issue #93). A standalone overlay image (not a
    // placed map object), shown at Pip's side while `has_word` is set.
    this.load.image(WORD_LANTERN_KEY, 'objects/the-word/lantern-lit.png');

    // Load per-NPC sprite frames driven by the registry — adding a new NPC becomes
    // a registry entry plus an AreaDefinition row, with no scene-file edit.
    for (const spriteId of getNpcSpriteIds()) {
      const def = NPC_SPRITES[spriteId];
      for (const dir of DIRECTIONS) {
        for (let i = 0; i < def.idleFrameCount; i++) {
          this.load.image(`npc-${spriteId}-idle-${dir}-${i}`, `npc/${spriteId}/idle/${dir}/frame_00${i}.png`);
        }
        for (let i = 0; i < def.walkFrameCount; i++) {
          this.load.image(`npc-${spriteId}-walk-${dir}-${i}`, `npc/${spriteId}/walk/${dir}/frame_00${i}.png`);
        }
        // Static poses are single-frame — loaded as plain image keys and applied via setTexture.
        this.load.image(`npc-${spriteId}-static-${dir}`, `npc/${spriteId}/static/${dir}.png`);
      }
    }

    // Portraits — registry-driven; one image per dialogue-capable NPC. Per-portrait
    // filter mode is applied after load so painterly portraits (filter: 'linear')
    // override the global pixelArt: true nearest-neighbor default.
    for (const portraitId of getNpcPortraitIds()) {
      const def = NPC_PORTRAITS[portraitId];
      this.load.image(`npc-portrait-${portraitId}`, `npc/${portraitId}/${def.file}`);
    }
    this.load.once('complete', () => {
      for (const portraitId of getNpcPortraitIds()) {
        const def = NPC_PORTRAITS[portraitId];
        if (def.filter === 'linear') {
          this.textures.get(`npc-portrait-${portraitId}`).setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
      }
    });
  }

  create(data?: {
    areaId?: string;
    entryPoint?: { col: number; row: number };
    resumePosition?: { x: number; y: number };
  }): void {
    this.transitionInProgress = false;
    const areaId = data?.areaId ?? getDefaultAreaId();
    const area = getArea(areaId);
    if (!area) {
      console.error(`Area not found: ${areaId}`);
      return;
    }
    this.area = area;

    // Snapshot terrain into the runtime passability struct BEFORE collision-
    // dependent subsystems initialise. The objectBlockMap is filled in by
    // buildObjectCollisionMap below. Apply conditional terrain so a
    // Continue-resume on Fog Marsh with `marsh_trapped` already true rebuilds
    // the water vertices before the player can walk on them.
    this.passability = {
      terrain: this.area.terrain,
      objectBlockMap: new Map(),
    };
    this.applyConditionalTerrain();
    // Build the object-collision map and subscribe to every flag named in any
    // ObjectInstance.condition so conditional-object impassability flips on
    // flag change (US-94). The marsh-trap closure now flows through the
    // terrain-flip path (US-98 conditionalTerrain), but other conditional
    // objects in future areas still wire through this path.
    this.buildObjectCollisionMap();
    this.subscribeToConditionalObjects();
    this.subscribeToConditionalTerrain();
    this.subscribeToConditionalDecorations();
    if (this.area.id === 'fog-marsh') {
      this.marshTrappedUnsubscribe = onFlagChange('marsh_trapped', () => {
        // Conditional-object visibility + cell-block lookup re-evaluate; the
        // conditional-decoration update path is unchanged.
        this.rebuildObjectCollisionMap();
        this.updateConditionalObjects();
        this.updateConditionalDecorations();
      });
      // US-79: each escape_attempts increment fires a fog-flash visual at the
      // closed exit centre AND queues the escalating monologue line matching
      // the new value. Subscribed here (not driven by the trigger dispatch)
      // because the trigger system's "fire 4 condition-gated bands stacked
      // on the same tile" approach cascaded on first entry: each band's
      // incrementFlags mutated the flag mid-frame, satisfying the next
      // band's condition in the same TriggerZoneSystem.update pass. One
      // trigger + one subscriber removes the cascade surface entirely.
      // Cleaned up in cleanupResize.
      this.escapeAttemptsUnsubscribe = onFlagChange('escape_attempts', (_, value) => {
        // Closed exit: row 22, cols 13-16. Centre = col 14.5, row 22.
        const cx = 14.5 * TILE_SIZE;
        const cy = 22 * TILE_SIZE;
        this.lightingSystem?.flashFog(cx, cy);
        const n = (value as number | undefined) ?? 0;
        // The voice walks from "the way is gone" to the end of her own effort.
        // It must NOT tell her to keep searching once she can surrender
        // (SURRENDER_MIN_ATTEMPTS = 2) — that fought the stillness trigger and
        // made the rescue feel arbitrary (F5). The "be still" cue is delivered
        // separately by updateSurrender when she stops near the exit.
        const line =
          n === 1 ? 'The way out is gone.' :
          n === 2 ? 'I push and push. It will not open.' :
          n === 3 ? 'My legs are so tired.' :
          'I cannot do this on my own.';
        this.showThought(line);
      });
    }

    // Filter NPCs by spawnCondition so a Keeper whose flags haven't fired yet
    // is fully absent from the scene — no sprite, no behavior runtime, no
    // interaction prompt, no collision. activeNpcs is mutated post-spawn (push)
    // and the same array reference is held by all subsystems so they pick up
    // the new entry automatically.
    this.activeNpcs = this.area.npcs.filter(
      (n) => !n.spawnCondition || evaluateCondition(n.spawnCondition),
    );
    this.subscribeToConditionalSpawns();

    this.renderTileMap();
    this.renderExitOverlays();
    this.renderDecorations();
    this.renderObjects();
    this.renderProps();
    this.registerAnimations();
    this.renderNpcs();
    this.npcBehavior = new NpcBehaviorSystem(this, this.activeNpcs, this.passability, this.npcSpritesById);
    this.activeDialogueNpcId = null;
    this.createPlayer(data?.entryPoint, data?.resumePosition);
    this.setupCamera();
    // LightingSystem must be created AFTER setupCamera so the UI camera exists
    // for the rt.ignore wiring. World dimensions match the tile map; the dark
    // overlay covers the full world and follows the main camera scroll.
    this.lightingSystem = new LightingSystem(this);
    this.lightingSystem.create(this.area.mapCols * TILE_SIZE, this.area.mapRows * TILE_SIZE);
    this.registerInitialLights();
    this.attachDesaturationPipeline();
    // US-101: construct after lighting so a future visual-binding hook can
    // reference both. Always constructed (even on areas without drain/quiet
    // zones) — it owns ember_warmth load + Reset Progress reseed.
    // ThoughtBubble is wired below in the system-creation chain; pass null
    // here and inject after the bubble exists. Zones come from the area.
    this.emberWarmthSystem = new EmberWarmthSystem(
      this,
      this.area.drainZones,
      this.area.quietZones,
      null,
      this.area.mapCols,
      this.area.mapRows,
      this.lightingSystem,
      this.area.inscribedStones,
    );
    // Fade in when entering from an area transition OR a Continue resume
    if (data?.entryPoint || data?.resumePosition) {
      this.cameras.main.fadeIn(FADE_DURATION, 0, 0, 0);
    }
    this.inputSystem = new InputSystem(this);
    this.dialogueSystem = new DialogueSystem(this);
    // Ember-share pulse system (US-85). Instantiated after the UI camera
    // exists so the pulse Arc can be uiCam.ignore'd on creation. Reset
    // sharingInProgress here so a scene.restart never resumes mid-pulse
    // (Learning EP-02 — class fields persist across restart).
    this.sharingInProgress = false;
    this.emberShare = new EmberShareSystem(this);
    this.thoughtBubble = new ThoughtBubbleSystem(this);
    this.thoughtBubble.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    // US-101: now that the bubble exists, wire it into the warmth system so
    // drain/quiet zone entry transitions can queue doubt/narration lines.
    this.emberWarmthSystem.setThoughtBubble(this.thoughtBubble);
    // the-word phase (US-W3): the "remember" verb at inscribed stones. Needs
    // both lighting (to bloom a remembered stone's warm pool) and the thought
    // bubble (to read the lines / show the pre-Word "cannot read this yet"
    // thought), so it's constructed here after both exist. Empty list = no-op.
    this.inscribedStone = new InscribedStoneSystem(
      this,
      this.area.inscribedStones ?? [],
      this.lightingSystem,
      this.thoughtBubble,
    );
    // C2-b: standing "what to do next" cue. Screen-fixed banner showing the
    // area's one concrete goal so a first-time player is never lost. On a fresh
    // start the intro StoryScene overlays GameScene, so the banner is hidden
    // until the intro finishes and play resumes.
    this.objectiveBanner = new ObjectiveBannerSystem(this);
    const activeObjective = this.resolveObjective();
    if (activeObjective) {
      // When we faded in (area transition / Continue resume), hold the banner's
      // attention beat until the fade clears so the goal blooms in on a visible
      // screen rather than invisibly under the black. Fresh start has no fade.
      const objectiveDelay = data?.entryPoint || data?.resumePosition ? FADE_DURATION : 0;
      this.objectiveBanner.setObjective(activeObjective, objectiveDelay);
    }
    // C8 follow-up: watch the flags that drive the changing objective so the
    // banner re-points the moment the story moves (e.g. the Keeper grants the
    // Ember → the goal flips from "find the smoke" to "carry your light home").
    this.subscribeToConditionalObjective();
    // Subtle water animation (Jaco request): luminance shimmer over the water
    // cells tagged during renderTileMap. Reads as light drifting on dark water
    // without breaking the drained/grey vision.
    this.waterShimmer = new WaterShimmerSystem(this, this.waterTiles);
    // Drifting ambient motes (C4-d): a little life in the air so areas don't read
    // as frozen dioramas. On the main camera, so the desat pipeline greys them in
    // the cold world and warms them inside Pip's ember light.
    this.ambientMotes = new AmbientMotesSystem(this);
    // Atmospheric fog (C12): drifting pale mist banks so a "fog" area reads as fog,
    // not as its grey-stone substitute tileset. Opt-in per area; null when unset.
    this.fogOverlay = this.area.fogOverlay ? new FogOverlaySystem(this) : null;
    // Distant beacon (C6 smoke / C13 glow-only): a far warm target the player
    // walks toward. smokeBeacon rises a plume ("find the smoke"); lightBeacon is
    // glow-only (a goal where smoke would mis-read, e.g. Briar's far clearing).
    // An area has at most one; no-op when neither is set.
    const beaconCfg =
      this.area.smokeBeacon ??
      (this.area.lightBeacon ? { ...this.area.lightBeacon, plume: false } : undefined);
    this.smokeBeacon = new SmokeBeaconSystem(this, beaconCfg);
    this.signpostWayfinding = new SignpostWayfindingSystem(this, this.area.signposts ?? []);
    this.triggerZone = new TriggerZoneSystem(this.area.triggers, {
      onDialogue: (actionRef) => {
        const script = this.area.dialogues[actionRef];
        if (!script) {
          console.error(`Dialogue script not found: ${actionRef}`);
          return;
        }
        this.dialogueSystem.start(script);
      },
      onStory: (actionRef) => {
        this.launchStoryScene(actionRef);
      },
      onThought: (actionRef) => {
        // Empty actionRef = increment-only trigger (e.g. fog-marsh
        // 'escape-attempt' uses this so the message is driven by the
        // escape_attempts onFlagChange subscriber rather than the dispatch).
        // Skipping prevents queuing an empty thought bubble.
        if (actionRef) this.showThought(actionRef);
      },
    });
    this.triggerZone.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.npcInteraction = new NpcInteractionSystem(this, this.activeNpcs);
    this.npcInteraction.setLivePositionsProvider(() => this.npcBehavior.getLivePositions());
    this.npcInteraction.setInteractionCallback((npc) => {
      const script = this.selectScriptForNpc(npc);
      if (!script) {
        console.error(`NPC dialogue script not found: ${npc.id}-intro`);
        return;
      }
      const playerCenter = { x: this.player.x, y: this.player.y };
      this.npcBehavior.enterDialogue(npc.id, playerCenter);
      try {
        this.dialogueSystem.start(script);
      } catch (err) {
        // Recovery: don't let the NPC get stuck in 'dialogue' with no UI open.
        console.error(`Dialogue start failed for NPC '${npc.id}':`, err);
        this.npcBehavior.exitDialogue(npc.id);
        return;
      }
      // Track which NPC this dialogue belongs to so onEnd can release it.
      this.activeDialogueNpcId = npc.id;
    });
    this.dialogueSystem.setOnEnd(() => {
      if (this.activeDialogueNpcId) {
        this.npcBehavior.exitDialogue(this.activeDialogueNpcId);
        this.activeDialogueNpcId = null;
      }
      // Dialogue exit returns the player to the world layer — checkpoint here so
      // a tab close immediately after a conversation resumes at the same spot.
      this.flushSave();
      // Chain a story scene if the script declared endStoryScene (US-72:
      // keeper-intro chains ember-given). flushSave runs FIRST so the world
      // state is checkpointed before launchStoryScene pauses GameScene.
      const endStoryScene = this.dialogueSystem.getEndStoryScene();
      if (endStoryScene) {
        this.launchStoryScene(endStoryScene);
      } else {
        // Node-scoped Pip inner-thought fired when the dialogue closes from a
        // node that declared endThought (Wren grace beat: the pre-Ember "no
        // warmth yet" exit nudges Pip toward the smoke). Skipped when a story
        // scene is chained — that scene would immediately cover the bubble.
        const endThought = this.dialogueSystem.getEndThought();
        if (endThought) {
          this.showThought(endThought);
        }
      }
    });
    this.dialogueSystem.setOnChoice((choice) => {
      // TIMING CONTRACT (read before adding logic below). `choice.setFlags`
      // fires synchronously at pick time — useful for refusal markers like
      // `npc_refused_driftwood` where the flag is set BECAUSE the choice was
      // picked, regardless of subsequent pulse lifecycle. `choice.firePulseTarget`
      // routes through EmberShareSystem.startPulse, which DEFERS the warming
      // flag flip (`npc_warmed_<id>`) and the dialogue advance to pulse-land
      // (~600ms). Authoring rule: pick ONE — don't mix `setFlags` with
      // `firePulseTarget` on the same choice. A future "warm + side-effect"
      // pattern would need a `pulseSetFlags` field on DialogueChoice that
      // defers alongside the warming flag, not the existing pre-pulse setFlags.
      if (choice.setFlags) {
        for (const [key, value] of Object.entries(choice.setFlags)) {
          setFlag(key, value);
        }
      }
      // Ember-share pulse (US-85). When firePulseTarget is set, DialogueSystem
      // defers the advance to nextId — we own resuming via advanceAfterPulse()
      // from the pulse onComplete, so the warming flag flip and the next
      // dialogue node land on the same tick. Falls through to advance if the
      // target NPC sprite is missing (defensive — should not happen in
      // authored content, but a stale flag would otherwise lock the dialogue).
      // Explicit `return` at the end of this branch — the pulse owns the rest
      // of the choice lifecycle and any future code added below this block
      // would otherwise run mid-pulse before onComplete.
      if (choice.firePulseTarget) {
        const targetId = choice.firePulseTarget;
        const npcSprite = this.npcSpritesById.get(targetId);
        if (!npcSprite) {
          console.warn(`[ember-share] No sprite for NPC '${targetId}'; skipping pulse`);
          this.dialogueSystem.advanceAfterPulse(choice);
          return;
        }
        this.sharingInProgress = true;
        this.emberShare.startPulse(this.player, npcSprite, () => {
          // Set the warming flag at pulse-land so downstream subscribers
          // (light brightening, alpha-gate force-eval) flip on the same tick.
          setFlag(`npc_warmed_${targetId}`, true);
          this.sharingInProgress = false;
          this.dialogueSystem.advanceAfterPulse(choice);
        });
        return;
      }
    });
    this.debugOverlay = new DebugOverlaySystem(this);
    this.debugOverlay.setDialogueActiveCheck(() => this.dialogueSystem.isActive);
    this.debugOverlay.loadArea(this.area);

    // StoryScene close path: GameScene is paused on launchStoryScene and resumed
    // when StoryScene stops itself. Flushing here mirrors the dialogue close —
    // the player is back on the world layer so this is a safe checkpoint.
    this.events.on('resume', this.flushSave, this);

    // Player ember overlay (US-73). Created on flag flip OR if the flag is
    // already true on scene create (covers area transitions to Ashen Isle
    // post-rescue and Continue-from-save). Destroyed on flag unset (Reset
    // Progress notifies via resetAllFlags). The same subscriber updates
    // hasEmberCached so LightingSystem.update reads a primitive each frame
    // rather than re-parsing the flag store (Learning EP-01).
    this.hasEmberCached = getFlag('has_ember_mark') === true;
    if (this.hasEmberCached) this.maybeCreateEmberOverlay();
    this.hasEmberMarkUnsubscribe = onFlagChange('has_ember_mark', (_, value) => {
      this.hasEmberCached = value === true;
      if (value === true) this.maybeCreateEmberOverlay();
      else this.destroyEmberOverlay();
      // Force alpha-gate re-evaluation so tier-2 decorations reveal/hide on
      // the same frame as the flag flip — no scene restart, no waiting for
      // movement (US-77 atomic flip parity).
      this.maybeUpdateAlphaGates(true);
    });

    // Carried Word lantern (US-W1 / Issue #93). Same create-or-subscribe pattern
    // as the ember: show it if has_word is already set on entry (Quill is in the
    // previous area; the flag persists), and flip it on/off with the flag (the
    // word-given dialogue sets has_word; resetAllFlags notifies with undefined).
    if (getFlag('has_word') === true) this.maybeCreateWordLantern();
    this.hasWordUnsubscribe = onFlagChange('has_word', (_, value) => {
      if (value === true) this.maybeCreateWordLantern();
      else this.destroyWordLantern();
    });

    // Atoned carried-change (heart-bridge phase, US-HB1). `atoned` is granted
    // once at the Heart Bridge crossing and persists across area transitions +
    // reload (flag store is localStorage-backed), so read it on entry to every
    // area and lift the ember (in update()) for the rest of the run. Same
    // create-or-subscribe + cached-primitive pattern as the ember; resetAllFlags
    // notifies with undefined → cache falls back to false and the lift is gone.
    this.atonedCached = getFlag('atoned') === true;
    this.atonedUnsubscribe = onFlagChange('atoned', (_, value) => {
      this.atonedCached = value === true;
    });

    // Heart-bridge crossing overlay (US-HB2). The `heart_bridge_crossing` counter
    // advances 0→4 as Pip walks the bridge bands; each change re-pushes the
    // effective desaturation so colour returns to the world a quarter at a time.
    // Read on entry (a returning save mid-crossing restores the right lift) and
    // re-evaluated only on flag-change. resetAllFlags notifies undefined → cache
    // falls back to 0 and the grey is back. Inert outside heart-bridge because
    // updateEffectiveDesaturation gates the lift on this.area.id.
    const crossingValue = getFlag('heart_bridge_crossing');
    this.heartBridgeCrossingCached = typeof crossingValue === 'number' ? crossingValue : 0;
    this.heartBridgeCrossingUnsubscribe = onFlagChange('heart_bridge_crossing', (_, value) => {
      this.heartBridgeCrossingCached = typeof value === 'number' ? value : 0;
      this.updateEffectiveDesaturation();
    });

    // Warming subscribers (US-85). For each NPC in WARMING_NPC_IDS, watch the
    // `npc_warmed_<id>` flag: on flip-to-true, re-register the NPC's tier-1
    // light at brighter values (idempotent overwrite — Learning #63) AND
    // force-eval alpha-gated decorations so a nearby alpha-gated frame blooms
    // in on the same tick as the warming. Mirrors the has_ember_mark atomic
    // flip pattern above. On flip-to-undefined / false (resetAllFlags
    // notifies with undefined), restore baseline. NPCs not currently in
    // activeNpcs (e.g. wrong area) are skipped harmlessly — their light isn't
    // registered there anyway.
    for (const npcId of WARMING_NPC_IDS) {
      const flagName = `npc_warmed_${npcId}`;
      // Continue-from-save / area-transition: if already warmed, register at
      // brighter values immediately so a fresh scene resumes at the warmed
      // state without waiting for another flag flip.
      if (getFlag(flagName) === true) {
        const npc = this.activeNpcs.find((n) => n.id === npcId);
        if (npc) this.registerNpcLight(npc, true);
        // Already warmed on resume — the waiting-spark aura is moot (createNpc...
        // already skipped it, but stay defensive against ordering).
        this.removeNpcPresenceGlow(npcId);
      }
      const unsubscribe = onFlagChange(flagName, (_, value) => {
        const npc = this.activeNpcs.find((n) => n.id === npcId);
        if (npc) {
          this.registerNpcLight(npc, value === true);
          this.maybeUpdateAlphaGates(true);
          // Warming flips the faint waiting-spark aura off — the full warmed
          // light is the payoff. On reset-to-baseline (value false/undefined),
          // bring the aura back at the NPC's spawn cell so the soul reads as a
          // target again.
          if (value === true) {
            this.removeNpcPresenceGlow(npcId);
          } else {
            const off = (TILE_SIZE - NPC_SIZE) / 2;
            this.createNpcPresenceGlow(
              npc,
              npc.col * TILE_SIZE + off + NPC_SIZE / 2,
              npc.row * TILE_SIZE + off + NPC_SIZE / 2,
            );
          }
        }
        // Cumulative desaturation reduction (US-86) — warmingsCount changed,
        // recompute and push the new effective value to the pipeline. Recomputed
        // ONLY on flag-change events, never per-frame (Learning EP-01). Runs
        // unconditionally so an off-area warming flip (e.g. global flag set
        // while in Fog Marsh) still updates the pipeline state for next entry.
        this.updateEffectiveDesaturation();
      });
      this.warmingUnsubscribes.push(unsubscribe);
    }
    // Initial effective desaturation push — covers Continue-from-save where
    // the player resumes already-warmed flags without a fresh flip event.
    this.updateEffectiveDesaturation();

    // Provide the F3 debug HUD with a snapshot of lighting state. Captured as
    // a closure here so DebugOverlaySystem stays decoupled from LightingSystem.
    this.debugOverlay.setHudProvider(() => {
      const ls = this.lightingSystem;
      // US-99: warmed-NPC count + the absolute warmed values, so the operator
      // can confirm the brightening at a glance without inspecting the registry.
      let warmedCount = 0;
      for (const id of WARMING_NPC_IDS) {
        if (getFlag(`npc_warmed_${id}`) === true) warmedCount += 1;
      }
      return [
        `lighting: ${LIGHTING_CONFIG.enabled ? 'on' : 'off'}  (F4)`,
        `playerRadius: ${ls.getPlayerRadius()}px`,
        `desaturation: ${(this.desaturationPipeline?.getStrength() ?? LIGHTING_CONFIG.desaturationStrength).toFixed(2)}`,
        `hasEmber: ${ls.getHasEmber()}`,
        `lights: ${ls.getLightCount()}`,
        `warmed: ${warmedCount} @ R${LIGHTING_CONFIG.npcWarmedRadius}/I${LIGHTING_CONFIG.npcWarmedIntensity}`,
        // US-101: HUD readout for the warmth state — value + zone classification.
        `warmth: ${this.emberWarmthSystem.getCurrentWarmth().toFixed(2)}  zone: ${this.emberWarmthSystem.getZoneState()}`,
      ].join('\n');
    });

    // First-time-player opening cinematic (C2-a). On a TRUE New Game start —
    // no area-transition entryPoint and no Continue resumePosition — play this
    // area's intro story scene once, then mark `ashen_intro_played` so it never
    // repeats (a later transition back into this area passes an entryPoint and
    // is doubly guarded by the flag). Deferred one tick via delayedCall(0) so
    // create() fully returns and the scene is RUNNING before launchStoryScene
    // pauses it — pausing mid-create is unsafe in Phaser's scene lifecycle.
    const isFreshStart = !data?.entryPoint && !data?.resumePosition;
    if (
      isFreshStart &&
      this.area.introStoryScene &&
      getFlag('ashen_intro_played') !== true
    ) {
      const introId = this.area.introStoryScene;
      setFlag('ashen_intro_played', true);
      this.time.delayedCall(0, () => this.launchStoryScene(introId));
    }
  }

  // Idempotent — returns early when the overlay already exists. Created at
  // EMBER_DEPTH (5.5) so it draws above the player (Entities, depth 5) and
  // below thought bubbles (depth 8). Added to uiCam.ignore so the UI camera
  // does not double-render the world-space ember.
  private maybeCreateEmberOverlay(): void {
    if (this.emberOverlay) return;
    if (!this.player) return;
    this.ensureEmberGlowTexture();
    this.emberOverlay = this.add.image(
      this.player.x,
      this.player.y + EMBER_OFFSET_Y,
      EMBER_GLOW_KEY,
    );
    this.emberOverlay.setOrigin(0.5, 0.5);
    // ADD-blend so the glow lifts off Pip and the world rather than painting a
    // flat fill over them — the white-hot core reads as a real ember.
    this.emberOverlay.setBlendMode(Phaser.BlendModes.ADD);
    this.emberOverlay.setDepth(EMBER_DEPTH);
    this.cameras.getCamera('ui')?.ignore(this.emberOverlay);
  }

  // Pre-bake the warm ember-glow gradient once: white-hot core fading out
  // through gold to a transparent orange edge. Mirrors the lighting brush
  // (lighting.ts) but warm-tinted and softer so the ember reads as a glow.
  private ensureEmberGlowTexture(): void {
    if (this.textures.exists(EMBER_GLOW_KEY)) return;
    const canvas = this.textures.createCanvas(EMBER_GLOW_KEY, EMBER_GLOW_TEX_SIZE, EMBER_GLOW_TEX_SIZE);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const c = EMBER_GLOW_TEX_SIZE / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0.0, 'rgba(255,248,228,1)');   // white-hot core
    gradient.addColorStop(0.32, 'rgba(255,205,120,0.92)'); // warm gold
    gradient.addColorStop(0.68, 'rgba(240,150,55,0.38)');  // ember orange falloff
    gradient.addColorStop(1.0, 'rgba(240,150,55,0)');      // transparent edge
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, EMBER_GLOW_TEX_SIZE, EMBER_GLOW_TEX_SIZE);
    canvas.refresh();
  }

  private destroyEmberOverlay(): void {
    this.emberOverlay?.destroy();
    this.emberOverlay = null;
  }

  // Carried Word lantern (Issue #93). A soft warm halo (reusing the pre-baked
  // ember glow texture, ADD-blended) sits under a small lit-lantern sprite, both
  // ignored by the UI camera and parked in the ember depth band so they ride
  // above every entity. Positions/alpha are driven each frame in update().
  private maybeCreateWordLantern(): void {
    if (this.wordLantern) return;
    if (!this.player) return;
    this.ensureEmberGlowTexture();
    // Ground cast first (lowest depth) so the lamp visibly lights the floor at Pip's feet.
    this.wordLanternCast = this.add.image(this.player.x, this.player.y, EMBER_GLOW_KEY);
    this.wordLanternCast.setOrigin(0.5, 0.5);
    this.wordLanternCast.setBlendMode(Phaser.BlendModes.ADD);
    this.wordLanternCast.setDepth(WORD_LANTERN_CAST_DEPTH);
    this.wordLanternCast.setDisplaySize(WORD_LANTERN_CAST_W, WORD_LANTERN_CAST_H);
    this.cameras.getCamera('ui')?.ignore(this.wordLanternCast);
    this.wordLanternGlow = this.add.image(this.player.x, this.player.y, EMBER_GLOW_KEY);
    this.wordLanternGlow.setOrigin(0.5, 0.5);
    this.wordLanternGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.wordLanternGlow.setDepth(WORD_LANTERN_DEPTH - 0.01);
    this.wordLanternGlow.setDisplaySize(WORD_LANTERN_GLOW_DIAMETER, WORD_LANTERN_GLOW_DIAMETER);
    this.cameras.getCamera('ui')?.ignore(this.wordLanternGlow);
    this.wordLantern = this.add.image(this.player.x, this.player.y, WORD_LANTERN_KEY);
    this.wordLantern.setOrigin(0.5, 0.5);
    this.wordLantern.setDepth(WORD_LANTERN_DEPTH);
    this.wordLantern.setDisplaySize(WORD_LANTERN_DISPLAY_W, WORD_LANTERN_DISPLAY_H);
    this.cameras.getCamera('ui')?.ignore(this.wordLantern);
  }

  private destroyWordLantern(): void {
    this.wordLantern?.destroy();
    this.wordLantern = null;
    this.wordLanternGlow?.destroy();
    this.wordLanternGlow = null;
    this.wordLanternCast?.destroy();
    this.wordLanternCast = null;
  }

  // Pre-bake the NPC presence aura once: amber, softer + cooler than Pip's
  // white-hot ember so an un-warmed soul reads as a faint waiting spark, not a
  // second ember to confuse the player.
  private ensureNpcPresenceTexture(): void {
    if (this.textures.exists(NPC_PRESENCE_GLOW_KEY)) return;
    const canvas = this.textures.createCanvas(NPC_PRESENCE_GLOW_KEY, NPC_PRESENCE_TEX_SIZE, NPC_PRESENCE_TEX_SIZE);
    if (!canvas) return;
    const ctx = canvas.getContext();
    const c = NPC_PRESENCE_TEX_SIZE / 2;
    // Halo (transparent centre → amber ring → transparent edge): rendered by the
    // UI camera it sits ON TOP of the NPC sprite, so a filled core would wash out
    // the face. A ring lets the NPC read clearly while a warm aura surrounds it.
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    gradient.addColorStop(0.0, 'rgba(255,214,150,0)');    // transparent centre — NPC shows
    gradient.addColorStop(0.42, 'rgba(255,206,140,0.55)'); // warm ring peak
    gradient.addColorStop(0.62, 'rgba(245,175,95,0.42)');  // amber falloff
    gradient.addColorStop(1.0, 'rgba(235,150,70,0)');      // transparent edge
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, NPC_PRESENCE_TEX_SIZE, NPC_PRESENCE_TEX_SIZE);
    canvas.refresh();
  }

  // Create the faint waiting-spark aura behind an un-warmed NPC. No-op if the
  // NPC is already warmed (continue-from-save) or already has an aura.
  // Rendered by the UI camera (which has no desaturation pipeline, unlike the
  // main camera) so the warm aura survives the drained-world grey-out — the same
  // trick the objective banner uses. The main camera ignores it; the update loop
  // projects the NPC's world position to screen coords each frame. `cx/cy` are
  // world coords used only for the initial placement before the first projection.
  private createNpcPresenceGlow(npc: NpcDefinition, cx: number, cy: number): void {
    if (this.npcPresenceGlowById.has(npc.id)) return;
    if (getFlag(`npc_warmed_${npc.id}`) === true) return;
    this.ensureNpcPresenceTexture();
    const glow = this.add.image(cx, cy, NPC_PRESENCE_GLOW_KEY);
    glow.setOrigin(0.5, 0.5);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(NPC_PRESENCE_DEPTH);
    glow.setDisplaySize(NPC_PRESENCE_DIAMETER, NPC_PRESENCE_DIAMETER);
    glow.setAlpha(NPC_PRESENCE_BASE_ALPHA);
    // UI-camera object: main camera must NOT draw it (would double-render a
    // desaturated copy under the warm one). It is absent from the UI ignore list
    // built in setupCamera, so the UI camera renders it.
    this.cameras.main.ignore(glow);
    this.npcPresenceGlowById.set(npc.id, glow);
  }

  private removeNpcPresenceGlow(npcId: string): void {
    const glow = this.npcPresenceGlowById.get(npcId);
    if (glow) {
      glow.destroy();
      this.npcPresenceGlowById.delete(npcId);
    }
  }

  update(time: number, delta: number): void {
    // Suppress all interaction during area transition
    if (this.transitionInProgress) return;
    // Suppress during conditional NPC spawn fade (US-71) — same zone-level
    // mutual exclusion pattern as transitionInProgress.
    if (this.spawnInProgress) return;
    // Water shimmer runs every frame (including during dialogue, below) so the
    // sea never freezes while the player reads.
    this.waterShimmer.update(time);
    // Ambient motes drift every frame too (same rationale as the shimmer — the
    // world should never read as fully frozen).
    this.ambientMotes.update(time, delta);
    this.fogOverlay?.update(time, delta);
    // Smoke beacon drifts every frame too (distant goal, never frozen).
    this.smokeBeacon.update(time, delta);
    // Suppress during ember-share pulse (US-85). Movement, NPC interaction,
    // trigger-zone evaluation, and exit-zone checks all sit in the body below
    // this chain so a single early-return covers all four.
    if (this.sharingInProgress) return;

    if (this.dialogueSystem.isActive) {
      this.dialogueSystem.update();
      this.thoughtBubble.update(this.player.x, this.player.y);
      this.debugOverlay.update();
      // Surrender timer continues to accumulate during dialogue (player is
      // still by definition; spec: dialogue does not reset the timer). Setting
      // the flag is suppressed inside updateSurrender when dialogue is active
      // so the Keeper does not spawn mid-conversation.
      if (this.area.id === 'fog-marsh') this.updateSurrender(delta, false);
      return;
    }

    this.inputSystem.update();
    const inputVelocity = this.inputSystem.getVelocity();

    const inputSpeed = Math.sqrt(inputVelocity.x * inputVelocity.x + inputVelocity.y * inputVelocity.y);
    const hasInput = inputSpeed > 0;

    // Update animation state with raw velocity — 8-direction sprites support diagonal movement
    this.animationSystem.update(inputVelocity.x, inputVelocity.y);
    const currentSpeed = this.animationSystem.getCurrentSpeed();

    let moveVx = 0;
    let moveVy = 0;
    if (hasInput) {
      const dirX = inputVelocity.x / inputSpeed;
      const dirY = inputVelocity.y / inputSpeed;
      moveVx = dirX * currentSpeed;
      moveVy = dirY * currentSpeed;
    }

    const halfSize = PLAYER_SIZE / 2;
    const newPos = moveWithCollision(
      {
        x: this.player.x - halfSize,
        y: this.player.y - halfSize,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
      },
      { x: moveVx, y: moveVy },
      delta,
      {
        passability: this.passability,
        npcs: this.activeNpcs,
        npcLivePositions: this.npcBehavior.getLivePositions(),
      },
    );
    this.player.setPosition(newPos.x + halfSize, newPos.y + halfSize);
    // Y-sort the player each frame on her feet (collision-box bottom) so she
    // draws behind a tree canopy when above its trunk and in front when below
    // (#346). Pure arithmetic, no per-frame allocation (Learning EP-01).
    this.player.setDepth(this.ySortDepth(this.player.y + halfSize));

    this.npcBehavior.update(delta, { x: this.player.x, y: this.player.y });
    // Y-sort wandering NPCs the same way after their positions settle this
    // frame, so a tree between Pip and an NPC layers correctly for both.
    for (const sprite of this.npcSpritesById.values()) {
      sprite.setDepth(this.ySortDepth(sprite.y + NPC_SIZE / 2));
    }
    // Single post-update snapshot of NPC live positions, shared by the presence
    // auras and the lighting sync below. getLivePositions allocates a fresh Map
    // per call, so take it ONCE here. (The collision check above runs before
    // npcBehavior.update and legitimately needs the pre-move positions, so it
    // keeps its own call.)
    const npcLivePositions = this.npcBehavior.getLivePositions();
    this.npcInteraction.update(this.player.x, this.player.y);
    this.inscribedStone.update(this.player.x, this.player.y);
    this.signpostWayfinding.update(this.player.x, this.player.y);
    this.thoughtBubble.update(this.player.x, this.player.y);
    // US-101: warmth update fires every walk-frame. delta is in ms; convert
    // to seconds for the per-second drain/restore rates. Player position in
    // pixels — the system divides by TILE_SIZE for the zone-tile overlap.
    this.emberWarmthSystem.update(delta / 1000, this.player.x, this.player.y);
    // Plumb warmth into LightingSystem so getPlayerRadius lerps the lit area
    // each frame (post-Ember only; pre-Ember falls back to playerRadiusPre).
    this.lightingSystem.setPlayerWarmth(this.emberWarmthSystem.getCurrentWarmth());

    // Collision bounds for trigger/exit zone checks
    const boundsX = this.player.x - halfSize;
    const boundsY = this.player.y - halfSize;
    this.triggerZone.update(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.checkExitZones(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.debugOverlay.update();

    this.maybeAutosave();

    // Ember overlay tracks the player's centre minus a fixed Y offset; its
    // radius and alpha lerp by current warmth (US-101).
    // Loop-invariant EP-01: setPosition + setRadius + setAlpha mutations, no
    // allocations, no object literals — the overlay is reused frame-to-frame.
    if (this.emberOverlay) {
      const w = this.emberWarmthSystem.getCurrentWarmth();
      const wt = (Math.max(WARMTH_FLOOR, Math.min(WARMTH_MAX, w)) - WARMTH_FLOOR) / (WARMTH_MAX - WARMTH_FLOOR);
      // Atoned (heart-bridge crossed, US-HB1): the Fading no longer dims her, so
      // the ember rides a permanent brightness/radius lift and burns steadier
      // (shallower breathing pulse) — a carried, visible change the player sees
      // in every area after the bridge. Branchless scalars off the cached
      // boolean keep the loop allocation-free (EP-01).
      const atoned = this.atonedCached;
      const radiusLift = atoned ? 1.12 : 1;
      const brightLift = atoned ? 1.18 : 1;
      const pulseAmp = atoned ? 0.4 : 1;
      const radius = (LIGHTING_CONFIG.playerEmberRadiusFloor + (LIGHTING_CONFIG.playerEmberRadiusFull - LIGHTING_CONFIG.playerEmberRadiusFloor) * wt) * radiusLift;
      const alpha = (LIGHTING_CONFIG.playerEmberAlphaFloor + (LIGHTING_CONFIG.playerEmberAlphaFull - LIGHTING_CONFIG.playerEmberAlphaFloor) * wt) * brightLift;
      // Gentle breathing pulse so the ember feels alive (not a static dot):
      // slow size + alpha shimmer, deeper as warmth grows, calmer once atoned.
      const pulse = Math.sin(time * 0.0035);
      const sizePulse = 1 + 0.1 * pulseAmp * pulse;
      const alphaPulse = 1 + 0.12 * pulseAmp * pulse;
      // The soft gradient fades to 0 well before its texture edge, so render it
      // larger than the bare radius for the glow to read; alpha carries intensity.
      const diameter = radius * 2 * 1.9 * sizePulse;
      this.emberOverlay.setPosition(this.player.x, this.player.y + EMBER_OFFSET_Y);
      this.emberOverlay.setDisplaySize(diameter, diameter);
      this.emberOverlay.setAlpha(Math.min(1, alpha * alphaPulse));
    }

    // Carried Word lantern (Issue #93): the lamp bobs gently at Pip's side and
    // its halo flickers like a live flame, so a player who has received the Word
    // always sees they carry it. Loop-invariant EP-01: in-place setPosition /
    // setAlpha only — no allocation, the sprites are reused frame-to-frame.
    if (this.wordLantern) {
      const bob = Math.sin(time * 0.004);
      const lx = this.player.x + WORD_LANTERN_OFFSET_X;
      const ly = this.player.y + WORD_LANTERN_OFFSET_Y + bob * 1.5;
      this.wordLantern.setPosition(lx, ly);
      const flicker = 0.82 + 0.18 * Math.sin(time * 0.012);
      if (this.wordLanternGlow) {
        this.wordLanternGlow.setPosition(lx, ly + 1);
        this.wordLanternGlow.setAlpha(0.72 * flicker); // brighter than the old 0.55 — the flame reads as lit
      }
      if (this.wordLanternCast) {
        // warm pool on the ground at Pip's feet, beneath the lamp — grounds its lit-ness
        this.wordLanternCast.setPosition(lx, this.player.y + 10);
        this.wordLanternCast.setAlpha(0.3 * flicker);
      }
    }

    // NPC presence auras (C4-a): follow their (possibly wandering) NPCs and
    // breathe gently so un-warmed souls read as live points to approach. Phase
    // is varied per NPC (stable id hash) so they don't pulse in lockstep.
    // Loop-invariant EP-01: in-place glow mutation only; reuses the shared
    // npcLivePositions snapshot taken above (no per-frame allocation here).
    if (this.npcPresenceGlowById.size > 0) {
      // The glow lives on the UI camera (no zoom, scroll 0), so project each
      // NPC's world position to screen pixels and scale the aura by main-camera
      // zoom so it tracks the on-screen NPC sprite 1:1.
      const cam = this.cameras.main;
      const zoom = cam.zoom;
      const viewCx = cam.worldView.centerX;
      const viewCy = cam.worldView.centerY;
      const halfW = cam.width * 0.5;
      const halfH = cam.height * 0.5;
      for (const [id, glow] of this.npcPresenceGlowById) {
        const p = npcLivePositions.get(id);
        if (p) {
          glow.setPosition((p.x - viewCx) * zoom + halfW, (p.y - viewCy) * zoom + halfH);
        }
        const pulse = Math.sin(time * 0.0022 + npcPresencePhase(id));
        const d = NPC_PRESENCE_DIAMETER * zoom * (1 + 0.06 * pulse);
        glow.setDisplaySize(d, d);
        glow.setAlpha(NPC_PRESENCE_BASE_ALPHA * (1 + 0.18 * pulse));
      }
    }

    // Sync NPC light positions to live (post-wander) coordinates so wandering
    // NPCs carry their light. Reuses the shared npcLivePositions snapshot; this
    // call only iterates the lights array in-place (Learning EP-01).
    this.lightingSystem.syncPositions(npcLivePositions);

    // Lighting overlay — re-rendered each frame so the player's light moves
    // smoothly. hasEmberCached is updated by the onFlagChange subscriber so
    // this call reads only primitives (Learning EP-01).
    this.lightingSystem.update(this.player.x, this.player.y, this.hasEmberCached);

    // Push per-frame state to the desaturation pipeline (US-76). The pipeline
    // samples the lighting RT to gate desaturation per-pixel; camera transform
    // uniforms map screen UV → world UV in the shader. Zero allocations: the
    // method takes primitives and a texture handle.
    if (this.desaturationPipeline) {
      const lightingTex = this.lightingSystem.getMaskGlTexture();
      this.desaturationPipeline.setFrameState(
        lightingTex,
        this.area.mapCols * TILE_SIZE,
        this.area.mapRows * TILE_SIZE,
        this.cameras.main,
      );
    }

    // Movement-gated alpha gating for hidden-until-lit decorations (US-77).
    // No-op when there are none (early-return inside the method). Runs after
    // lighting.update so isLitAt sees this frame's player/ember state.
    this.maybeUpdateAlphaGates();

    // Surrender timer for Keeper rescue (US-80). hasInput derived from this
    // frame's input vector — non-zero magnitude resets the timer.
    if (this.area.id === 'fog-marsh') this.updateSurrender(delta, hasInput);
  }

  // Accumulate the stillness timer when ALL conditions hold: marsh trapped,
  // attempts >= min, within proximity, no input this frame. Set
  // marsh_surrendered when the timer crosses the duration threshold — that
  // flag is the new Keeper spawn condition (US-80, replaces the
  // escape_attempts >= 4 gate). Suppress the flag flip during dialogue so the
  // Keeper appears cleanly after the conversation closes (spec example:
  // "talk to Hermit, close dialogue without moving, then standing still —
  // Keeper appears once total quiescence + proximity is met").
  //
  // Loop-invariant EP-01: single number field mutation per frame, zero
  // allocations. Flag reads are property lookups on the in-memory flagStore
  // (no JSON parse).
  private updateSurrender(delta: number, hasInput: boolean): void {
    // One-shot — once surrendered, the flag stays until reset and we don't
    // need to keep evaluating.
    if (getFlag('marsh_surrendered') === true) {
      this.updateStillnessCue(0);
      return;
    }
    const trapped = getFlag('marsh_trapped') === true;
    const attempts = (getFlag('escape_attempts') as number | undefined) ?? 0;
    const dx = this.player.x - SURRENDER_TARGET_X;
    const dy = this.player.y - SURRENDER_TARGET_Y;
    const proxLimit = SURRENDER_PROXIMITY_TILES * TILE_SIZE;
    const inProximity = dx * dx + dy * dy <= proxLimit * proxLimit;
    const eligible = trapped && attempts >= SURRENDER_MIN_ATTEMPTS && inProximity;

    // Movement, leaving the spot, or not-yet-eligible all reset the moment —
    // surrender must be one continuous stillness. The gather ring follows the
    // (now zero) timer back to invisible.
    if (!eligible || hasInput) {
      this.surrenderTimerMs = 0;
      this.updateStillnessCue(0);
      return;
    }

    // Eligible AND still: tell her once to stop struggling (F5 — the trigger was
    // silent before), then accumulate. The hint is gated to the still branch so
    // it never collides with the escape-attempt monologue (which fires on input).
    if (!this.surrenderHintShown && !this.dialogueSystem.isActive) {
      this.showThought('I am so tired. Maybe I should stop. And be still.', SURRENDER_HINT_DURATION_MS);
      this.surrenderHintShown = true;
    }
    this.surrenderTimerMs += delta;
    this.updateStillnessCue(this.surrenderTimerMs / SURRENDER_DURATION_MS);
    if (this.surrenderTimerMs >= SURRENDER_DURATION_MS) {
      if (this.dialogueSystem.isActive) return;
      setFlag('marsh_surrendered', true);
      this.updateStillnessCue(0);
    }
  }

  // Soft pale ring that gathers around Pip as the stillness timer fills, giving a
  // first-time player visible proof that holding still is working (F5). `ratio`
  // is surrenderTimerMs / SURRENDER_DURATION_MS, clamped 0..1; 0 fades it out.
  // Lazily created (no-op until first needed). UI-camera object projected to
  // Pip's screen position so it survives the marsh desaturation.
  // Loop-invariant EP-01: lazy one-time texture/image creation, then in-place
  // setPosition/setDisplaySize/setAlpha only — no per-frame allocation.
  private updateStillnessCue(ratio: number): void {
    const r = ratio <= 0 ? 0 : ratio >= 1 ? 1 : ratio;
    if (r <= 0 && !this.stillnessCue) return; // never spawned, nothing to hide
    this.ensureStillnessCue();
    const cue = this.stillnessCue;
    if (!cue) return;
    if (r <= 0) {
      if (cue.visible) cue.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const sx = (this.player.x - cam.worldView.centerX) * cam.zoom + cam.width * 0.5;
    const sy = (this.player.y - cam.worldView.centerY) * cam.zoom + cam.height * 0.5;
    // Gather inward as it fills (1.5x → 1.0x) so it reads as "drawing together".
    const d = STILLNESS_CUE_DIAMETER * cam.zoom * (1.5 - 0.5 * r);
    if (!cue.visible) cue.setVisible(true);
    cue.setPosition(sx, sy);
    cue.setDisplaySize(d, d);
    cue.setAlpha(STILLNESS_CUE_MAX_ALPHA * r);
  }

  private ensureStillnessCue(): void {
    if (this.stillnessCue) return;
    if (!this.textures.exists(STILLNESS_CUE_KEY)) {
      const canvas = this.textures.createCanvas(STILLNESS_CUE_KEY, STILLNESS_CUE_TEX_SIZE, STILLNESS_CUE_TEX_SIZE);
      if (!canvas) return;
      const ctx = canvas.getContext();
      const c = STILLNESS_CUE_TEX_SIZE / 2;
      // Pale calm ring (transparent centre so Pip stays clear), warm-cream so it
      // reads as gentle grace gathering rather than the Ember's hot gold.
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      gradient.addColorStop(0.0, 'rgba(250,244,224,0)');
      gradient.addColorStop(0.55, 'rgba(248,238,206,0)');
      gradient.addColorStop(0.78, 'rgba(250,240,210,0.6)');
      gradient.addColorStop(1.0, 'rgba(245,232,196,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, STILLNESS_CUE_TEX_SIZE, STILLNESS_CUE_TEX_SIZE);
      canvas.refresh();
    }
    const cue = this.add.image(this.player.x, this.player.y, STILLNESS_CUE_KEY);
    cue.setOrigin(0.5, 0.5);
    cue.setBlendMode(Phaser.BlendModes.ADD);
    cue.setDepth(NPC_PRESENCE_DEPTH);
    cue.setVisible(false);
    // UI-camera object (survives desaturation) — main camera must ignore it.
    this.cameras.main.ignore(cue);
    this.stillnessCue = cue;
  }

  // Throttled walk-frame autosave. Returns before any localStorage IO when the
  // throttle or position-delta guard fails (Learning EP-01). Suppressed during
  // transitions and dialogue — those paths flush explicitly.
  private maybeAutosave(): void {
    if (this.transitionInProgress) return;
    if (this.dialogueSystem?.isActive) return;
    const now = performance.now();
    if (now - this.lastSaveTime < SAVE_THROTTLE_MS) return;
    const dx = this.player.x - this.lastSaveX;
    const dy = this.player.y - this.lastSaveY;
    if (Math.abs(dx) < SAVE_MIN_DELTA_PX && Math.abs(dy) < SAVE_MIN_DELTA_PX) return;
    writeSave({
      version: 1,
      areaId: this.area.id,
      position: { x: this.player.x, y: this.player.y },
    });
    this.lastSaveTime = now;
    this.lastSaveX = this.player.x;
    this.lastSaveY = this.player.y;
  }

  // Unconditional flush from a checkpoint event (dialogue close, StoryScene
  // resume). Suppressed during transitions so the destination flush in
  // transitionToArea is the sole writer mid-fade.
  private flushSave(): void {
    if (this.transitionInProgress) return;
    if (!this.area || !this.player) return;
    writeSave({
      version: 1,
      areaId: this.area.id,
      position: { x: this.player.x, y: this.player.y },
    });
    this.lastSaveTime = performance.now();
    this.lastSaveX = this.player.x;
    this.lastSaveY = this.player.y;
  }

  private renderTileMap(): void {
    this.tileLayer = [];
    this.waterTiles.length = 0;

    // Fallback: unknown tileset id — render flat-color tiles so the scene still
    // loads with a clear console error (US-48 error-path). Exit overlays are
    // rendered separately by renderExitOverlays and persist across the
    // fallback path.
    if (!hasTileset(this.area.tileset)) {
      console.error(
        `[GameScene] Unknown tileset id '${this.area.tileset}' on area '${this.area.id}'. ` +
          `Rendering flat-color fallback.`,
      );
      this.renderFallbackTiles();
      return;
    }

    const terrain = this.area.terrain;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tl: TerrainId = terrain[row][col];
        const tr: TerrainId = terrain[row][col + 1];
        const br: TerrainId = terrain[row + 1][col + 1];
        const bl: TerrainId = terrain[row + 1][col];
        // Per-cell tileset selection (US-98): pick the registered Wang
        // tileset whose (primary, secondary) pair matches this cell's
        // unique corner terrains. Falls back to area.tileset for cells
        // with 3+ distinct terrains or unregistered combinations.
        const cellTilesetId = pickWangTilesetForCell([tl, tr, br, bl], this.area.tileset);
        const cellTilesetDef = TILESETS[cellTilesetId];
        if (!cellTilesetDef) continue;
        const frame = resolveWangFrame(cellTilesetId, [tl, tr, br, bl], col, row);
        if (frame === null) continue;
        const sprite = this.add.sprite(col * TILE_SIZE, row * TILE_SIZE, cellTilesetDef.atlasKey, frame);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
        sprite.setDepth(0);
        this.tileLayer.push(sprite);
        // Tag watery cells (any corner is water) for the shimmer system.
        if (tl === 'water' || tr === 'water' || br === 'water' || bl === 'water') {
          this.waterTiles.push({ sprite, col, row });
        }
      }
    }
  }

  // Translucent hope-gold overlay marking each exit zone (US-92). Sits at
  // depth 0.5 between terrain (0) and decorations (2) so the visual cue "this
  // is the way to the next stage" survives without a dedicated exit atlas
  // frame. Color is palette-driven (STYLE_PALETTE.hopeGoldLight) — the one
  // terrain-adjacent visual permitted hope-gold per art-style.md § Palette.
  private renderExitOverlays(): void {
    this.exitOverlays = [];
    const colorHex = parseInt(STYLE_PALETTE.hopeGoldLight.replace('#', ''), 16);
    for (const exit of this.area.exits) {
      const w = exit.width * TILE_SIZE;
      const h = exit.height * TILE_SIZE;
      const x = exit.col * TILE_SIZE + w / 2;
      const y = exit.row * TILE_SIZE + h / 2;
      const rect = this.add.rectangle(x, y, w, h, colorHex, 0.25);
      rect.setDepth(0.5);
      this.exitOverlays.push(rect);
    }
  }

  private renderDecorations(): void {
    this.decorationSprites = [];
    this.conditionalDecorations = [];
    this.alphaGatedDecorations = [];
    this.lastAlphaGateCheckX = Number.NaN;
    this.lastAlphaGateCheckY = Number.NaN;
    if (!hasTileset(this.area.decorationsTileset)) return;
    const atlasKey = TILESETS[this.area.decorationsTileset].atlasKey;
    const texture = this.textures.get(atlasKey);
    // Out-of-bounds (col,row) outside (mapCols,mapRows) is not crashed-on:
    // Phaser accepts arbitrary world coords and the decoration renders off-grid
    // harmlessly. Authors see the misplaced decoration on visual inspection.
    for (const dec of this.area.decorations) {
      if (!texture.has(dec.spriteFrame)) {
        console.warn(
          `[GameScene] Decoration at (${dec.col},${dec.row}) references missing frame ` +
            `'${dec.spriteFrame}' on tileset '${this.area.decorationsTileset}'; skipping.`,
        );
        continue;
      }
      const sprite = this.add.sprite(
        dec.col * TILE_SIZE,
        dec.row * TILE_SIZE,
        atlasKey,
        dec.spriteFrame,
      );
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
      sprite.setDepth(2);
      this.decorationSprites.push(sprite);
      if (dec.condition) {
        sprite.setVisible(evaluateCondition(dec.condition));
        this.conditionalDecorations.push({ sprite, condition: dec.condition });
      }
      if (dec.alphaGatedByLight) {
        // Default to invisible — first updateAlphaGates pass after lighting
        // initialises will set the correct alpha. Hiding by default avoids a
        // one-frame flash of tier-2 reveals on scene create.
        sprite.setAlpha(0);
        const cx = (dec.col + 0.5) * TILE_SIZE;
        const cy = (dec.row + 0.5) * TILE_SIZE;
        this.alphaGatedDecorations.push({ sprite, cx, cy });
      }
    }
  }

  // Re-evaluate alpha gating when the player moved enough OR force=true (called
  // from the has_ember_mark subscriber so a flag flip immediately reveals tier-2
  // alpha-gated decorations regardless of player movement). Movement-gated to
  // keep per-frame cost bounded — cost is one squared-distance check + one
  // isLitAt query per gated decoration, only when triggered (Learning EP-01).
  private maybeUpdateAlphaGates(force = false): void {
    if (this.alphaGatedDecorations.length === 0) return;
    if (!force) {
      const dx = this.player.x - this.lastAlphaGateCheckX;
      const dy = this.player.y - this.lastAlphaGateCheckY;
      const threshold = LIGHTING_CONFIG.alphaGateRecheckPx;
      // First call: lastCheck is NaN → dx/dy NaN → both comparisons false → run.
      if (!Number.isNaN(this.lastAlphaGateCheckX) && dx * dx + dy * dy < threshold * threshold) {
        return;
      }
    }
    for (let i = 0; i < this.alphaGatedDecorations.length; i++) {
      const entry = this.alphaGatedDecorations[i];
      entry.sprite.setAlpha(this.lightingSystem.isLitAt(entry.cx, entry.cy) ? 1 : 0);
    }
    this.lastAlphaGateCheckX = this.player.x;
    this.lastAlphaGateCheckY = this.player.y;
  }

  // Re-evaluate conditional decoration visibility. Called from the flag-change
  // subscriber alongside rebuildObjectCollisionMap + updateConditionalObjects
  // — collision flip and visibility swap on the same frame.
  // Iterates only the conditional subset; unconditional decorations are never
  // re-evaluated (Learning EP-01).
  private updateConditionalDecorations(): void {
    for (const entry of this.conditionalDecorations) {
      entry.sprite.setVisible(evaluateCondition(entry.condition));
    }
  }

  private renderProps(): void {
    this.propSprites = [];
    if (!hasTileset(this.area.decorationsTileset)) return;
    const atlasKey = TILESETS[this.area.decorationsTileset].atlasKey;
    const texture = this.textures.get(atlasKey);
    for (const prop of this.area.props) {
      if (!texture.has(prop.spriteFrame)) {
        console.warn(
          `[GameScene] Prop '${prop.id}' references missing frame '${prop.spriteFrame}' ` +
            `on tileset '${this.area.decorationsTileset}'; skipping.`,
        );
        continue;
      }
      const sprite = this.add.sprite(
        prop.col * TILE_SIZE,
        prop.row * TILE_SIZE,
        atlasKey,
        prop.spriteFrame,
      );
      sprite.setOrigin(0, 0);
      sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
      sprite.setDepth(3);
      this.propSprites.push(sprite);
    }
  }

  private renderFallbackTiles(): void {
    const g = this.add.graphics();
    g.setDepth(0);
    const terrain = this.area.terrain;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        // Cell colour: wall tone when ALL 4 vertices are impassable terrain
        // (matches the cell-blocks-from-terrain rule in collision.ts) OR when
        // an impassable object sits on the cell; floor tone otherwise. Exit
        // zones get their hope-gold tint from renderExitOverlays at depth 0.5.
        const tl = TERRAINS[terrain[row][col]];
        const tr = TERRAINS[terrain[row][col + 1]];
        const br = TERRAINS[terrain[row + 1][col + 1]];
        const bl = TERRAINS[terrain[row + 1][col]];
        const allImpassableTerrain =
          tl && tr && br && bl &&
          !tl.passable && !tr.passable && !br.passable && !bl.passable;
        const blocked = allImpassableTerrain || this.passability.objectBlockMap.get(`${col},${row}`);
        const color = blocked ? this.area.visual.wallColor : this.area.visual.floorColor;
        g.fillStyle(color);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.tileLayer.push(g);
  }

  // Build the runtime cell-keyed object-collision map (US-94). Iterates
  // area.objects, evaluates each ObjectInstance.condition (absent → true),
  // and sets `objectBlockMap.set("col,row", true)` for every visible
  // impassable object. Per-frame collision is O(1) lookup against this Map
  // (Learning EP-01: never iterate area.objects in the collision hot path).
  // Y-sort depth (#346) for an entity or tall object, given the world-y of its
  // ground contact (player feet, NPC feet, tree trunk base). Maps y over the
  // map height into the entity band so a lower-on-screen thing draws on top.
  // Pure arithmetic — safe to call per frame for the player/NPCs.
  private ySortDepth(groundY: number): number {
    const worldH = this.area.mapRows * TILE_SIZE;
    const t = worldH > 0 ? Phaser.Math.Clamp(groundY / worldH, 0, 1) : 0;
    return ENTITY_DEPTH_BASE + t * ENTITY_DEPTH_SPAN;
  }

  private buildObjectCollisionMap(): void {
    const m = this.passability.objectBlockMap;
    m.clear();
    for (const inst of this.area.objects) {
      if (inst.condition && !evaluateCondition(inst.condition)) continue;
      const def = OBJECT_KINDS[inst.kind];
      if (!def) {
        console.warn(`[GameScene] ObjectInstance at (${inst.col},${inst.row}) references unknown kind '${inst.kind}'; skipping collision contribution.`);
        continue;
      }
      if (!def.passable) {
        // Base-only collision (#346): a kind with collisionFootprint blocks just
        // its declared sub-region (e.g. a tree's trunk-base cell) so the player
        // can walk around/under the rest of the footprint. Absent = legacy
        // single-anchor-cell behavior (every existing kind unchanged).
        const cf = def.collisionFootprint;
        if (cf) {
          for (let dy = 0; dy < cf.h; dy++) {
            for (let dx = 0; dx < cf.w; dx++) {
              m.set(`${inst.col + cf.dx + dx},${inst.row + cf.dy + dy}`, true);
            }
          }
        } else {
          m.set(`${inst.col},${inst.row}`, true);
        }
      }
    }
  }

  // Rebuild the collision map on conditional-flag change (US-94). Cheap —
  // ~hundreds of objects max. Called from the marsh-trapped subscriber and
  // from any flag subscriber that fires on a flag named in any object's
  // condition.
  private rebuildObjectCollisionMap(): void {
    this.buildObjectCollisionMap();
  }

  // Apply every conditionalTerrain block (US-98) — mutates `area.terrain`
  // in-place. The Wang resolver's per-cell tileset selection picks up the
  // new vertex values automatically; collision unifies via terrain
  // passability (e.g. water `passable: false` blocks the cell when all 4
  // vertices flip to water). Idempotent — safe to re-run on every flag
  // change.
  private applyConditionalTerrain(): void {
    const blocks = this.area.conditionalTerrain;
    if (!blocks || blocks.length === 0) return;
    for (const block of blocks) {
      const isOn = evaluateCondition(block.condition);
      for (const v of block.vertices) {
        const target = isOn ? v.whenTrue : v.whenFalse;
        if (this.area.terrain[v.row]?.[v.col] !== undefined) {
          this.area.terrain[v.row][v.col] = target;
        }
      }
    }
  }

  // Re-apply conditional terrain AND re-render the affected tile sprites on
  // flag change (US-98). Cheap: re-issuing renderTileMap rebuilds all
  // tileLayer sprites. For larger areas the sprite count is in the low
  // thousands — still O(rows × cols) but only on flag flips, never per-frame.
  // Subscriber unsubscribes are collected in `conditionalTerrainUnsubscribes`
  // and invoked in cleanupResize.
  private subscribeToConditionalTerrain(): void {
    const blocks = this.area.conditionalTerrain;
    if (!blocks || blocks.length === 0) return;
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    for (const block of blocks) {
      let match: RegExpExecArray | null;
      flagNameRe.lastIndex = 0;
      while ((match = flagNameRe.exec(block.condition)) !== null) {
        flagNames.add(match[1]);
      }
    }
    for (const name of flagNames) {
      const unsub = onFlagChange(name, () => {
        this.applyConditionalTerrain();
        this.redrawTerrainOnly();
      });
      this.conditionalTerrainUnsubscribes.push(unsub);
    }
  }

  // Re-issue terrain rendering after a conditional-terrain flip (US-98).
  // Destroys the existing tileLayer sprites and rebuilds them. Decorations,
  // objects, NPCs, etc. are untouched.
  private redrawTerrainOnly(): void {
    for (const obj of this.tileLayer) obj.destroy();
    this.renderTileMap();
    // Re-add the new tile sprites to uiCam.ignore so they don't double-render
    // on the UI camera.
    const uiCam = this.cameras.getCamera('ui');
    if (uiCam) {
      for (const obj of this.tileLayer) uiCam.ignore(obj);
    }
  }

  // Render every ObjectInstance as a Phaser image at depth 2.5 (US-94).
  // Conditional objects render at scene start with their initial visibility
  // set per evaluateCondition; subsequent updates flow through
  // updateConditionalObjects on flag-change events (Learning EP-01: no
  // per-frame visibility re-eval). Sprites are tracked as instance fields,
  // reset to [] at the top of this method, and uiCam-ignored downstream so
  // they don't double-render.
  private renderObjects(): void {
    this.objectSprites = [];
    this.conditionalObjects = [];
    for (const inst of this.area.objects) {
      const def = OBJECT_KINDS[inst.kind];
      if (!def) {
        console.warn(`[GameScene] ObjectInstance at (${inst.col},${inst.row}) references unknown kind '${inst.kind}'; skipping render.`);
        continue;
      }
      if (!this.textures.exists(def.atlasKey)) {
        console.warn(`[GameScene] Object kind '${inst.kind}' references missing atlas '${def.atlasKey}' (path '${def.assetPath}'); skipping render. Object still contributes to collision per registry passable flag.`);
        continue;
      }
      const sprite = this.add.image(
        inst.col * TILE_SIZE,
        inst.row * TILE_SIZE,
        def.atlasKey,
      );
      sprite.setOrigin(0, 0);
      // Multi-tile objects (US-98 footprint) render scaled to their cell
      // footprint, not forced to a single tile. Defaults to {1,1} so every
      // existing object is unchanged; a {2,2} boat or {2,3} pier now reads at
      // true scale instead of a 32px miniature (Jaco dock feedback, 2026-06-13).
      const fp = def.footprint ?? { w: 1, h: 1 };
      sprite.setDisplaySize(fp.w * TILE_SIZE, fp.h * TILE_SIZE);
      // Tall objects (#346, trees) Y-sort against the player/NPCs on their base
      // (bottom of the footprint = trunk base), so Pip passes behind from above
      // and in front from below. Everything else keeps the flat object depth.
      sprite.setDepth(
        def.tall ? this.ySortDepth((inst.row + fp.h) * TILE_SIZE) : 2.5,
      );
      this.objectSprites.push(sprite);
      if (inst.condition) {
        sprite.setVisible(evaluateCondition(inst.condition));
        this.conditionalObjects.push({ sprite, instance: inst });
      }
    }
  }

  // Re-evaluate conditional-object visibility on flag change (US-94).
  // Iterates only the conditional subset (Learning EP-01).
  private updateConditionalObjects(): void {
    for (const entry of this.conditionalObjects) {
      const cond = entry.instance.condition;
      if (!cond) continue;
      entry.sprite.setVisible(evaluateCondition(cond));
    }
  }

  // Subscribe to every flag named in any ObjectInstance.condition so the
  // collision map + visibility re-evaluate when a relevant flag changes
  // (US-94). De-duplicated so two objects sharing a flag register one
  // listener per flag, not two. Cleaned up via objectFlagUnsubscribes in
  // cleanupResize.
  private subscribeToConditionalObjects(): void {
    // Mirrors subscribeToConditionalSpawns flag-name extraction — same regex,
    // same dedup, different action.
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    for (const inst of this.area.objects) {
      if (!inst.condition) continue;
      let match: RegExpExecArray | null;
      flagNameRe.lastIndex = 0;
      while ((match = flagNameRe.exec(inst.condition)) !== null) {
        flagNames.add(match[1]);
      }
    }
    for (const name of flagNames) {
      const unsub = onFlagChange(name, () => {
        this.rebuildObjectCollisionMap();
        this.updateConditionalObjects();
      });
      this.objectFlagUnsubscribes.push(unsub);
    }
  }

  // C8 follow-up — pick the objective to show right now. Walk
  // area.conditionalObjective top-to-bottom and return the first entry whose
  // flag condition holds; otherwise fall back to the opening area.objective.
  // Returns undefined only when the area declares no objective at all.
  private resolveObjective(): string | undefined {
    for (const entry of this.area.conditionalObjective ?? []) {
      if (evaluateCondition(entry.condition)) return entry.text;
    }
    return this.area.objective;
  }

  // C8 follow-up — same flag-name-extraction shape as the object/decoration
  // subscribers, but the action re-resolves the active objective and re-sets the
  // banner. setObjective is idempotent for unchanged text (no rebuild / no
  // replayed beat), so a flip that doesn't change the winning entry is a no-op;
  // a flip that does change it plays the attention beat. No-op when the area has
  // no conditionalObjective.
  private subscribeToConditionalObjective(): void {
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    for (const entry of this.area.conditionalObjective ?? []) {
      let match: RegExpExecArray | null;
      flagNameRe.lastIndex = 0;
      while ((match = flagNameRe.exec(entry.condition)) !== null) {
        flagNames.add(match[1]);
      }
    }
    for (const name of flagNames) {
      const unsub = onFlagChange(name, () => {
        const next = this.resolveObjective();
        if (next) this.objectiveBanner.setObjective(next);
      });
      this.objectiveFlagUnsubscribes.push(unsub);
    }
  }

  // US-100 — same shape as subscribeToConditionalObjects but for decoration
  // visibility. Without this, conditional decorations only set visibility
  // once at renderDecorations(); a mid-area flag flip (e.g. has_ember_mark
  // flipping while still in Ashen Isle) would leave the decoration in its
  // initial state. Initial-render path is unchanged — this only adds the
  // re-eval-on-change leg.
  private subscribeToConditionalDecorations(): void {
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    for (const dec of this.area.decorations) {
      if (!dec.condition) continue;
      let match: RegExpExecArray | null;
      flagNameRe.lastIndex = 0;
      while ((match = flagNameRe.exec(dec.condition)) !== null) {
        flagNames.add(match[1]);
      }
    }
    for (const name of flagNames) {
      const unsub = onFlagChange(name, () => {
        this.updateConditionalDecorations();
      });
      this.decorationFlagUnsubscribes.push(unsub);
    }
  }

  private renderNpcs(): void {
    // Reset across scene.restart — instance fields persist between restarts so
    // stale Phaser sprite references (already destroyed by the previous scene's
    // shutdown) would otherwise survive. spawnNpcSprite's idempotency guard
    // (if (npcSpritesById.has(id)) return null) would then SKIP creating a
    // fresh sprite on re-entry, and NpcBehaviorSystem's constructor would read
    // the destroyed sprite from the map and crash on .play() at the next tick.
    this.npcEntities = [];
    this.npcSpritesById.clear();
    // Presence auras are GameObjects destroyed by the scene shutdown on restart;
    // clear the stale references so spawnNpcSprite recreates fresh ones (mirrors
    // npcSpritesById).
    this.npcPresenceGlowById.clear();
    for (const npc of this.activeNpcs) {
      this.spawnNpcSprite(npc);
    }
  }

  // Create the NPC sprite + push to npcEntities + register with the sprite map.
  // Used both at scene create (renderNpcs) and at runtime (evaluateConditionalSpawns).
  // Idempotent — calling for an NPC already in npcSpritesById is a no-op.
  private spawnNpcSprite(npc: NpcDefinition): Phaser.GameObjects.Sprite | null {
    if (this.npcSpritesById.has(npc.id)) return null;
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    const cx = npc.col * TILE_SIZE + offset + NPC_SIZE / 2;
    const cy = npc.row * TILE_SIZE + offset + NPC_SIZE / 2;
    if (hasNpcSprite(npc.sprite)) {
      const sprite = this.add.sprite(cx, cy, `npc-${npc.sprite}-idle-south-0`);
      sprite.setDepth(5);
      sprite.play(`npc-${npc.sprite}-idle-south`);
      this.npcEntities.push(sprite);
      this.npcSpritesById.set(npc.id, sprite);
      this.createNpcPresenceGlow(npc, cx, cy);
      return sprite;
    }
    console.error(`NPC '${npc.id}' references unknown sprite id '${npc.sprite}' — falling back to rectangle render.`);
    const rect = this.add.rectangle(cx - NPC_SIZE / 2, cy - NPC_SIZE / 2, NPC_SIZE, NPC_SIZE, npc.color);
    rect.setOrigin(0, 0);
    rect.setDepth(5);
    this.npcEntities.push(rect);
    this.createNpcPresenceGlow(npc, cx, cy);
    return null;
  }

  // Subscribe to every flag named in any NPC's spawnCondition. The regex
  // extracts flag names from clauses like "marsh_trapped == true" (matches:
  // marsh_trapped). De-duplicated so two NPCs sharing a flag register one
  // listener per flag, not two. Each listener calls evaluateConditionalSpawns
  // which is safely re-entrant (idempotency guard).
  private subscribeToConditionalSpawns(): void {
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    for (const npc of this.area.npcs) {
      if (!npc.spawnCondition) continue;
      let match: RegExpExecArray | null;
      flagNameRe.lastIndex = 0;
      while ((match = flagNameRe.exec(npc.spawnCondition)) !== null) {
        flagNames.add(match[1]);
      }
    }
    for (const name of flagNames) {
      this.spawnConditionUnsubscribes.push(
        onFlagChange(name, () => this.evaluateConditionalSpawns()),
      );
    }
  }

  // Walk every conditional NPC; spawn any whose condition is now true and that
  // is not yet in the scene. Idempotent — already-spawned NPCs are skipped via
  // npcSpritesById check inside spawnNpcSprite. The fade tween is 500ms; player
  // input is suspended for 1000ms total via spawnInProgress.
  private evaluateConditionalSpawns(): void {
    let anySpawned = false;
    for (const npc of this.area.npcs) {
      if (!npc.spawnCondition) continue;
      if (this.npcSpritesById.has(npc.id)) continue;
      if (!evaluateCondition(npc.spawnCondition)) continue;
      const sprite = this.spawnNpcSprite(npc);
      this.activeNpcs.push(npc);
      // Behavior runtime requires a Phaser.GameObjects.Sprite — skip when the
      // sprite id was unknown (rectangle fallback path). The rectangle still
      // shows so the player sees something; behavior just stays inert.
      if (sprite) {
        this.npcBehavior?.registerNpc(npc, sprite);
        // Register the runtime-spawned NPC's light alongside its sprite (US-75).
        // Keeper spawns post-Ember in the keeper-rescue arc so its tier-1 light
        // is rendered immediately on appearance.
        this.registerNpcLight(npc);
        // setupCamera built the UI-camera ignore list at scene create from
        // the initial entities; late-spawned sprites need an explicit ignore
        // here or the UI camera (no zoom, scroll 0,0) renders a screen-fixed
        // duplicate at the sprite's world coordinates. Observed as a small
        // Keeper at fixed screen position once the conditional spawn fired.
        this.cameras.getCamera('ui')?.ignore(sprite);
        sprite.setAlpha(0);
        this.tweens.add({
          targets: sprite,
          alpha: { from: 0, to: 1 },
          duration: KEEPER_FADE_DURATION_MS,
        });
      }
      anySpawned = true;
    }
    if (anySpawned) {
      this.spawnInProgress = true;
      this.time.delayedCall(KEEPER_INPUT_SUSPEND_MS, () => {
        this.spawnInProgress = false;
      });
    }
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(this.calculateZoom());
    this.applyCameraBounds();
    cam.startFollow(this.player);
    // Paint the area beyond the map a deliberate deep tone. For every full-screen map
    // this never shows (the tiles cover the frame); for a map smaller than the viewport
    // — the short Heart Bridge span (#108) — it renders as the dark gulf the bridge
    // crosses instead of the page background bleeding through as a dead void.
    cam.setBackgroundColor(VOID_DEEP_COLOR);

    // UI camera — no zoom/scroll, renders dialogue/joystick/thought bubbles at screen coords
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    uiCam.setScroll(0, 0);
    // Prevent UI camera from double-rendering world objects
    uiCam.ignore([
      ...this.tileLayer,
      ...this.exitOverlays,
      ...this.decorationSprites,
      ...this.objectSprites,
      ...this.propSprites,
      this.player,
      ...this.npcEntities,
    ]);

    this.scale.on('resize', this.handleResize, this);

    // Direct window resize listener — Phaser's ScaleManager only sets a dirty flag
    // on window.resize (it calls refresh() only on orientationchange). Chrome DevTools
    // rotation fires resize, not orientationchange, so Phaser may miss the update if
    // the DOM hasn't settled by the next step(). We force a refresh after one animation
    // frame so the parent container has its final dimensions.
    this.boundWindowResize = () => {
      requestAnimationFrame(() => {
        if (this.scene.isActive()) {
          this.scale.refresh();
        }
      });
    };
    window.addEventListener('resize', this.boundWindowResize);

    this.events.on('shutdown', this.cleanupResize, this);
    this.events.on('destroy', this.cleanupResize, this);
  }

  // Center the camera on any axis where the map is smaller than the viewport, so a
  // short or narrow map (the Heart Bridge span, #108) floats centered in frame —
  // the surrounding deep reads as the gulf the bridge crosses — instead of being
  // corner-pinned with a dead void beside it. On axes where the map exceeds the
  // viewport (every other area, both axes) the bounds equal the map and normal
  // player-follow applies, so this is a no-op for full-screen maps.
  private applyCameraBounds(): void {
    const cam = this.cameras.main;
    const zoom = cam.zoom;
    const mapWidth = this.area.mapCols * TILE_SIZE;
    const mapHeight = this.area.mapRows * TILE_SIZE;
    const viewW = this.scale.width / zoom;
    const viewH = this.scale.height / zoom;
    let bx = 0;
    let by = 0;
    let bw = mapWidth;
    let bh = mapHeight;
    if (mapWidth < viewW) {
      // Bounds width == view width pins scrollX to bx, centering the map horizontally.
      bx = (mapWidth - viewW) / 2;
      bw = viewW;
    }
    if (mapHeight < viewH) {
      by = (mapHeight - viewH) / 2;
      bh = viewH;
    }
    cam.setBounds(bx, by, bw, bh);
  }

  private calculateZoom(): number {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    const targetWorldSize = TARGET_VISIBLE_TILES * TILE_SIZE;
    // Snap to integer zoom — fractional zoom on a packed tile atlas (e.g. tiny-dungeon)
    // makes the GPU sample neighbouring frames at sub-pixel boundaries, which renders as
    // thin seams between tiles that disappear when the camera scroll changes by 1px.
    return Math.max(1, Math.floor(shortSide / targetWorldSize));
  }

  private handleResize(): void {
    const cam = this.cameras.main;
    // Zoom first — setBounds clamps scroll using displayWidth which depends on zoom
    cam.setZoom(this.calculateZoom());
    this.applyCameraBounds();
    // Snap camera to player after dimension/zoom change (prevents stale scroll on rotation)
    cam.centerOn(this.player.x, this.player.y);

    const uiCam = this.cameras.getCamera('ui');
    if (uiCam) {
      uiCam.setSize(this.scale.width, this.scale.height);
    }
  }

  private checkExitZones(px: number, py: number, pw: number, ph: number): void {
    for (const exit of this.area.exits) {
      const zoneX = exit.col * TILE_SIZE;
      const zoneY = exit.row * TILE_SIZE;
      const zoneW = exit.width * TILE_SIZE;
      const zoneH = exit.height * TILE_SIZE;

      const overlaps =
        px < zoneX + zoneW &&
        px + pw > zoneX &&
        py < zoneY + zoneH &&
        py + ph > zoneY;

      if (overlaps) {
        if (exit.condition && !evaluateCondition(exit.condition)) {
          continue;
        }
        this.transitionToArea(exit.destinationAreaId, exit.entryPoint);
        return;
      }
    }
  }

  private transitionToArea(areaId: string, entryPoint: { col: number; row: number }): void {
    const destination = getArea(areaId);
    if (!destination) {
      console.error(`Exit zone references non-existent area: ${areaId}`);
      return;
    }

    this.transitionInProgress = true;

    // Flush the destination payload BEFORE scene.restart so a tab-close mid-fade
    // resumes on the destination's entry tile, not on this area's exit-zone tile
    // (which would re-fire the transition on entry). Same pixel formula as
    // createPlayer to avoid a half-step offset.
    const destOffset = (TILE_SIZE - PLAYER_SIZE) / 2;
    const destX = entryPoint.col * TILE_SIZE + destOffset + PLAYER_SIZE / 2;
    const destY = entryPoint.row * TILE_SIZE + destOffset + PLAYER_SIZE / 2;
    writeSave({
      version: 1,
      areaId,
      position: { x: destX, y: destY },
    });

    this.cameras.main.fadeOut(FADE_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.restart({ areaId, entryPoint });
    });
  }

  private cleanupResize(): void {
    this.scale.off('resize', this.handleResize, this);
    if (this.boundWindowResize) {
      window.removeEventListener('resize', this.boundWindowResize);
      this.boundWindowResize = null;
    }
    // Clean up any in-progress fade tweens to prevent orphaned callbacks
    this.cameras?.main?.removeAllListeners('camerafadeoutcomplete');
    // Clean up player sprite
    this.player?.destroy();
    this.events.off('resume', this.flushSave, this);
    this.events.off('shutdown', this.cleanupResize, this);
    this.events.off('destroy', this.cleanupResize, this);
    if (this.marshTrappedUnsubscribe) {
      this.marshTrappedUnsubscribe();
      this.marshTrappedUnsubscribe = null;
    }
    if (this.escapeAttemptsUnsubscribe) {
      this.escapeAttemptsUnsubscribe();
      this.escapeAttemptsUnsubscribe = null;
    }
    for (const unsub of this.spawnConditionUnsubscribes) unsub();
    this.spawnConditionUnsubscribes = [];
    for (const unsub of this.objectFlagUnsubscribes) unsub();
    this.objectFlagUnsubscribes = [];
    for (const unsub of this.conditionalTerrainUnsubscribes) unsub();
    this.conditionalTerrainUnsubscribes = [];
    for (const unsub of this.decorationFlagUnsubscribes) unsub();
    this.decorationFlagUnsubscribes = [];
    for (const unsub of this.objectiveFlagUnsubscribes) unsub();
    this.objectiveFlagUnsubscribes = [];
    for (const sprite of this.objectSprites) sprite.destroy();
    this.objectSprites = [];
    this.conditionalObjects = [];
    for (const rect of this.exitOverlays) rect.destroy();
    this.exitOverlays = [];
    if (this.hasEmberMarkUnsubscribe) {
      this.hasEmberMarkUnsubscribe();
      this.hasEmberMarkUnsubscribe = null;
    }
    if (this.hasWordUnsubscribe) {
      this.hasWordUnsubscribe();
      this.hasWordUnsubscribe = null;
    }
    if (this.atonedUnsubscribe) {
      this.atonedUnsubscribe();
      this.atonedUnsubscribe = null;
    }
    if (this.heartBridgeCrossingUnsubscribe) {
      this.heartBridgeCrossingUnsubscribe();
      this.heartBridgeCrossingUnsubscribe = null;
    }
    for (const unsub of this.warmingUnsubscribes) unsub();
    this.warmingUnsubscribes = [];
    this.destroyEmberOverlay();
    this.destroyWordLantern();
    this.lightingSystem?.destroy();
    this.ambientMotes?.destroy();
    this.fogOverlay?.destroy();
    this.fogOverlay = null;
    this.smokeBeacon?.destroy();
    this.signpostWayfinding?.destroy();
  }

  // Register lights for every NPC, trigger, and decoration declared in the
  // area at scene create (US-75). NPC lights default to LIGHTING_CONFIG.npcRadius
  // / npcIntensity; lightOverride lets per-NPC tuning (Old Man dimmer for the
  // Fading metaphor). Triggers and decorations opt in via their `light` field —
  // omitting it is the existing behavior. Tier-2 lights are registered now but
  // render at intensity 0 until has_ember_mark === true (US-77).
  private registerInitialLights(): void {
    for (const npc of this.activeNpcs) {
      this.registerNpcLight(npc);
    }
    for (const trigger of this.area.triggers) {
      if (!trigger.light) continue;
      const cx = (trigger.col + trigger.width / 2) * TILE_SIZE;
      const cy = (trigger.row + trigger.height / 2) * TILE_SIZE;
      this.lightingSystem.registerLight({
        id: `trigger:${trigger.id}`,
        x: cx,
        y: cy,
        radius: trigger.light.radius ?? LIGHTING_CONFIG.poiRadius,
        intensity: trigger.light.intensity ?? LIGHTING_CONFIG.poiIntensity,
        tier: trigger.light.tier ?? 1,
      });
    }
    for (let i = 0; i < this.area.decorations.length; i++) {
      const dec = this.area.decorations[i];
      if (!dec.light) continue;
      const cx = (dec.col + 0.5) * TILE_SIZE;
      const cy = (dec.row + 0.5) * TILE_SIZE;
      this.lightingSystem.registerLight({
        id: `decoration:${dec.col},${dec.row}`,
        x: cx,
        y: cy,
        radius: dec.light.radius ?? LIGHTING_CONFIG.poiRadius,
        intensity: dec.light.intensity ?? LIGHTING_CONFIG.poiIntensity,
        tier: dec.light.tier ?? 1,
      });
    }
  }

  // Register the DesaturationPipeline on the WebGL renderer (idempotent across
  // scene.restart — addPostPipeline guards on duplicate keys) and attach it
  // to the main camera. Called from create() after camera setup so the
  // camera exists for setPostPipeline. The pipeline reads per-frame state
  // (camera scroll/zoom + lighting RT texture) via setFrameState in update.
  private attachDesaturationPipeline(): void {
    const renderer = this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if (!renderer.pipelines) return; // canvas renderer fallback — desaturation is a no-op
    const pipelineKey = 'DesaturationPipeline';
    const pipelines = renderer.pipelines;
    // PipelineManager has no `hasPostPipeline`; postPipelineClasses is the
    // internal map of registered classes. Re-registering would overwrite the
    // existing class — guarding via the internal map keeps us idempotent
    // across scene.restart without depending on a private API surface that
    // might shift across Phaser versions.
    const registered = (pipelines as unknown as { postPipelineClasses: Map<string, unknown> }).postPipelineClasses;
    if (!registered || !registered.has(pipelineKey)) {
      pipelines.addPostPipeline(pipelineKey, DesaturationPipeline);
    }
    this.cameras.main.setPostPipeline(pipelineKey);
    const instance = this.cameras.main.getPostPipeline(pipelineKey);
    if (Array.isArray(instance)) {
      this.desaturationPipeline = (instance[0] as DesaturationPipeline) ?? null;
    } else {
      this.desaturationPipeline = (instance as DesaturationPipeline) ?? null;
    }
  }

  // Pick the right dialogue script for an NPC interaction (US-81). Walks all
  // scripts whose id starts with `${npc.id}-` looking for a variant with a
  // currently-passing condition; falls back to the unconditional base script
  // `${npc.id}-intro`. The base is the fallback so existing single-script
  // NPCs continue to work unchanged. Variant scripts MUST declare a
  // `condition` (otherwise selecting between an unconditional base and an
  // unconditional variant is ambiguous and we deliberately ignore the
  // variant). Returns undefined when no script is found.
  private selectScriptForNpc(npc: NpcDefinition): DialogueScript | undefined {
    const baseId = `${npc.id}-intro`;
    const npcPrefix = `${npc.id}-`;
    for (const id of Object.keys(this.area.dialogues)) {
      if (id === baseId) continue;
      if (!id.startsWith(npcPrefix)) continue;
      const variant = this.area.dialogues[id];
      if (!variant.condition) continue;
      if (evaluateCondition(variant.condition)) return variant;
    }
    return this.area.dialogues[baseId];
  }

  // Register a tier-1 light at the NPC's spawn tile centre (US-75). Called from
  // registerInitialLights at scene create AND from evaluateConditionalSpawns
  // when a previously-gated NPC fades in. Position is updated per-frame in
  // GameScene.update via lightingSystem.syncPositions so wandering NPCs carry
  // their light.
  // Recompute the effective desaturation strength from the current count of
  // warmed NPCs and push it to the desat pipeline (US-86 cumulative warming).
  // base × (1 − reduction × count) clamped ≥ DESAT_FLOOR. Called only on
  // warming-flag-change events (no per-frame recomputation — Learning EP-01).
  private updateEffectiveDesaturation(): void {
    if (!this.desaturationPipeline) return;
    let warmingsCount = 0;
    for (const id of WARMING_NPC_IDS) {
      if (getFlag(`npc_warmed_${id}`) === true) warmingsCount += 1;
    }
    const base = LIGHTING_CONFIG.desaturationStrength;
    let effective = Math.max(DESAT_FLOOR, base * (1 - DESAT_REDUCTION_PER_WARMING * warmingsCount));
    // US-HB2 heart-bridge crossing: as Pip walks the span, colour returns to the
    // world one quarter per crossed band (heart_bridge_crossing 0→4). The lift
    // multiplies the strength down toward 0 — and is allowed to drop BELOW
    // DESAT_FLOOR (unlike warming) so the far end reads as full restoration, the
    // Fading taken away. Gated to the bridge so every other area is untouched and
    // the hook is inert outside it (Learning EP-01: set on flag-change only).
    if (this.area.id === 'heart-bridge') {
      const progress = Math.min(HEART_BRIDGE_CROSSING_BEATS, this.heartBridgeCrossingCached);
      const t = progress / HEART_BRIDGE_CROSSING_BEATS;
      effective = effective * (1 - t);
    }
    this.desaturationPipeline.setStrength(effective);
  }

  private registerNpcLight(npc: NpcDefinition, warmed = false): void {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    const cx = npc.col * TILE_SIZE + offset + NPC_SIZE / 2;
    const cy = npc.row * TILE_SIZE + offset + NPC_SIZE / 2;
    const override = npc.lightOverride;
    // US-99: warmed state ignores any per-NPC dimmer override so restoration
    // reads uniformly bright across every warmed NPC. Pre-warming uses the
    // override (lets Old Man sit dimmer than baseline before the ember).
    const radius = warmed ? LIGHTING_CONFIG.npcWarmedRadius : (override?.radius ?? LIGHTING_CONFIG.npcRadius);
    const intensity = warmed ? LIGHTING_CONFIG.npcWarmedIntensity : (override?.intensity ?? LIGHTING_CONFIG.npcIntensity);
    const light: RegisteredLight = {
      id: npc.id,
      x: cx,
      y: cy,
      radius,
      intensity,
      tier: override?.tier ?? 1,
    };
    this.lightingSystem.registerLight(light);
  }

  showThought(text: string, duration?: number): void {
    this.thoughtBubble.show({ text, duration });
  }

  launchStoryScene(definitionId: string): void {
    const definition = this.area.storyScenes[definitionId];
    if (!definition) {
      console.error(`Story scene definition not found: ${definitionId}`);
      return;
    }
    this.scene.pause('GameScene');
    this.scene.launch('StoryScene', { definition });
  }

  private registerAnimations(): void {
    // Animations are registered on the global anim manager, so they survive a
    // scene.restart. Guard with anims.exists to avoid "key already exists" warnings
    // on every area transition.
    // fox-pip — 16 animations: fox-pip-{idle,walk}-{8 directions}. idle: 4 frames, walk: 8 frames.
    for (const anim of ANIM_TYPES) {
      const frameCount = FRAME_COUNTS[anim];
      for (const dir of DIRECTIONS) {
        const key = `fox-pip-${anim}-${dir}`;
        if (this.anims.exists(key)) continue;
        const frames: { key: string }[] = [];
        for (let i = 0; i < frameCount; i++) {
          frames.push({ key: `fox-pip-${anim}-${dir}-${i}` });
        }
        this.anims.create({
          key,
          frames,
          frameRate: ANIM_FRAME_RATE,
          repeat: -1,
        });
      }
    }

    // Per-NPC animations: npc-{spriteId}-{idle,walk}-{8 directions}. Same guard.
    // Static poses are NOT registered as animations — they are plain textures applied via setTexture.
    for (const spriteId of getNpcSpriteIds()) {
      const def = NPC_SPRITES[spriteId];
      for (const anim of ANIM_TYPES) {
        const frameCount = anim === 'idle' ? def.idleFrameCount : def.walkFrameCount;
        for (const dir of DIRECTIONS) {
          const key = `npc-${spriteId}-${anim}-${dir}`;
          if (this.anims.exists(key)) continue;
          const frames: { key: string }[] = [];
          for (let i = 0; i < frameCount; i++) {
            frames.push({ key: `npc-${spriteId}-${anim}-${dir}-${i}` });
          }
          this.anims.create({
            key,
            frames,
            frameRate: ANIM_FRAME_RATE,
            repeat: -1,
          });
        }
      }
    }
  }

  private createPlayer(
    entryPoint?: { col: number; row: number },
    resumePosition?: { x: number; y: number },
  ): void {
    const offset = (TILE_SIZE - PLAYER_SIZE) / 2;
    // Precedence: transitions are deterministic; resume is opportunistic. When
    // both entryPoint and resumePosition are present, entryPoint wins so a
    // mid-transition resume lands cleanly on the destination's entry tile.
    let x: number;
    let y: number;
    if (entryPoint) {
      x = entryPoint.col * TILE_SIZE + offset + PLAYER_SIZE / 2;
      y = entryPoint.row * TILE_SIZE + offset + PLAYER_SIZE / 2;
    } else if (resumePosition) {
      x = resumePosition.x;
      y = resumePosition.y;
    } else {
      const spawn = this.area.playerSpawn;
      x = spawn.col * TILE_SIZE + offset + PLAYER_SIZE / 2;
      y = spawn.row * TILE_SIZE + offset + PLAYER_SIZE / 2;
    }

    this.player = this.add.sprite(x, y, 'fox-pip-idle-south-0');
    this.player.setDepth(5); // Entities layer — depth 5 per depth map
    // Native PNG resolution: 68×68px. Scale 1.0 renders at native size.
    // Collision bounding box uses PLAYER_SIZE (24px) in math directly — display size is independent.
    this.player.setScale(1);
    this.animationSystem = new AnimationSystem(this.player);

    // Seed autosave bookkeeping with the player's start position so the first
    // walk-frame autosave triggers only after a real position change exceeds
    // SAVE_MIN_DELTA_PX (matches the design direction "save writes are bounded,
    // not chatty" — no spurious save on a player who never moves).
    this.lastSaveTime = performance.now();
    this.lastSaveX = x;
    this.lastSaveY = y;
  }
}
