import Phaser from 'phaser';
import { TILE_SIZE, PLAYER_SIZE, NPC_SIZE, TileType } from '../maps/constants';
import { TILESETS, resolveFrame, hasTileset } from '../maps/tilesets';
import { AreaDefinition, NpcDefinition, DialogueScript } from '../data/areas/types';
import { getArea, getDefaultAreaId } from '../data/areas/registry';
import { InputSystem } from '../systems/input';
import { moveWithCollision } from '../systems/movement';
import { NpcInteractionSystem } from '../systems/npcInteraction';
import { DialogueSystem } from '../systems/dialogue';
import { ThoughtBubbleSystem } from '../systems/thoughtBubble';
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
import { getFlag, setFlag, onFlagChange } from '../triggers/flags';
import { writeSave } from '../triggers/saveState';

const TARGET_VISIBLE_TILES = 10;
const FADE_DURATION = 400;
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
const EMBER_RADIUS = 6;
const EMBER_COLOR = 0xf2c878;
const EMBER_DEPTH = 5.5;
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

// Fox-pip sprite animation constants
// Idle: 4 frames per direction; Walk: 8 frames per direction (matches PixelLab output)
const ANIM_TYPES = ['idle', 'walk'] as const;
const FRAME_COUNTS: Record<typeof ANIM_TYPES[number], number> = { idle: 4, walk: 8 };
const ANIM_FRAME_RATE = 8;

export class GameScene extends Phaser.Scene {
  private area!: AreaDefinition;
  private inputSystem!: InputSystem;
  private npcInteraction!: NpcInteractionSystem;
  private dialogueSystem!: DialogueSystem;
  private thoughtBubble!: ThoughtBubbleSystem;
  private triggerZone!: TriggerZoneSystem;
  private debugOverlay!: DebugOverlaySystem;
  private animationSystem!: AnimationSystem;
  private player!: Phaser.GameObjects.Sprite;
  private tileLayer: Phaser.GameObjects.GameObject[] = [];
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
  private npcEntities: Phaser.GameObjects.GameObject[] = [];
  private npcSpritesById: Map<string, Phaser.GameObjects.Sprite> = new Map();
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
  private emberOverlay: Phaser.GameObjects.Arc | null = null;
  private hasEmberMarkUnsubscribe: (() => void) | null = null;
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
  private lightingSystem!: LightingSystem;
  private desaturationPipeline: DesaturationPipeline | null = null;

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
    // indices; resolveFrame() returns them as strings which Phaser accepts directly.
    // Nearest-neighbor filtering is applied globally via `pixelArt: true` in main.ts.
    for (const [id, def] of Object.entries(TILESETS)) {
      this.load.spritesheet(def.atlasKey, `tilesets/${id}/tilemap.png`, {
        frameWidth: TILESET_SOURCE_SIZE,
        frameHeight: TILESET_SOURCE_SIZE,
      });
    }

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

    // Apply trap state BEFORE the tile/decoration render passes consume area.map,
    // so a Continue-resume on Fog Marsh with marsh_trapped already true rebuilds
    // the wall cells before the player can walk on them. Subscribe to flag changes
    // so the in-session threshold trigger flips collision on the same frame.
    this.applyMarshTrappedState();
    if (this.area.id === 'fog-marsh') {
      this.marshTrappedUnsubscribe = onFlagChange('marsh_trapped', () => {
        this.applyMarshTrappedState();
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
        const line =
          n === 1 ? 'The path is gone.' :
          n === 2 ? 'There must be a way back.' :
          n === 3 ? 'I cannot find it.' :
          'I cannot do this.';
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
    this.renderDecorations();
    this.renderProps();
    this.registerAnimations();
    this.renderNpcs();
    this.npcBehavior = new NpcBehaviorSystem(this, this.activeNpcs, this.area.map, this.npcSpritesById);
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
      }
      const unsubscribe = onFlagChange(flagName, (_, value) => {
        const npc = this.activeNpcs.find((n) => n.id === npcId);
        if (npc) {
          this.registerNpcLight(npc, value === true);
          this.maybeUpdateAlphaGates(true);
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
      return [
        `lighting: ${LIGHTING_CONFIG.enabled ? 'on' : 'off'}  (F4)`,
        `playerRadius: ${ls.getPlayerRadius()}px`,
        `desaturation: ${(this.desaturationPipeline?.getStrength() ?? LIGHTING_CONFIG.desaturationStrength).toFixed(2)}`,
        `hasEmber: ${ls.getHasEmber()}`,
        `lights: ${ls.getLightCount()}`,
      ].join('\n');
    });
  }

  // Idempotent — returns early when the overlay already exists. Created at
  // EMBER_DEPTH (5.5) so it draws above the player (Entities, depth 5) and
  // below thought bubbles (depth 8). Added to uiCam.ignore so the UI camera
  // does not double-render the world-space ember.
  private maybeCreateEmberOverlay(): void {
    if (this.emberOverlay) return;
    if (!this.player) return;
    this.emberOverlay = this.add.circle(
      this.player.x,
      this.player.y + EMBER_OFFSET_Y,
      EMBER_RADIUS,
      EMBER_COLOR,
    );
    this.emberOverlay.setDepth(EMBER_DEPTH);
    this.cameras.getCamera('ui')?.ignore(this.emberOverlay);
  }

  private destroyEmberOverlay(): void {
    this.emberOverlay?.destroy();
    this.emberOverlay = null;
  }

  update(_time: number, delta: number): void {
    // Suppress all interaction during area transition
    if (this.transitionInProgress) return;
    // Suppress during conditional NPC spawn fade (US-71) — same zone-level
    // mutual exclusion pattern as transitionInProgress.
    if (this.spawnInProgress) return;
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
        map: this.area.map,
        npcs: this.activeNpcs,
        npcLivePositions: this.npcBehavior.getLivePositions(),
      },
    );
    this.player.setPosition(newPos.x + halfSize, newPos.y + halfSize);

    this.npcBehavior.update(delta, { x: this.player.x, y: this.player.y });
    this.npcInteraction.update(this.player.x, this.player.y);
    this.thoughtBubble.update(this.player.x, this.player.y);

    // Collision bounds for trigger/exit zone checks
    const boundsX = this.player.x - halfSize;
    const boundsY = this.player.y - halfSize;
    this.triggerZone.update(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.checkExitZones(boundsX, boundsY, PLAYER_SIZE, PLAYER_SIZE);
    this.debugOverlay.update();

    this.maybeAutosave();

    // Ember overlay tracks the player's centre minus a fixed Y offset.
    // Loop-invariant EP-01: single setPosition call, no allocations, no
    // object literals — the overlay is reused frame-to-frame, only its
    // position vector changes.
    if (this.emberOverlay) {
      this.emberOverlay.setPosition(this.player.x, this.player.y + EMBER_OFFSET_Y);
    }

    // Sync NPC light positions to live (post-wander) coordinates so wandering
    // NPCs carry their light. The live-positions Map is already allocated each
    // frame by npcBehavior.getLivePositions for collision/interaction; this
    // call only iterates the lights array in-place (Learning EP-01).
    this.lightingSystem.syncPositions(this.npcBehavior.getLivePositions());

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
    if (getFlag('marsh_surrendered') === true) return;
    if (getFlag('marsh_trapped') !== true) {
      this.surrenderTimerMs = 0;
      return;
    }
    const attempts = (getFlag('escape_attempts') as number | undefined) ?? 0;
    if (attempts < SURRENDER_MIN_ATTEMPTS) {
      this.surrenderTimerMs = 0;
      return;
    }
    const dx = this.player.x - SURRENDER_TARGET_X;
    const dy = this.player.y - SURRENDER_TARGET_Y;
    const proxLimit = SURRENDER_PROXIMITY_TILES * TILE_SIZE;
    if (dx * dx + dy * dy > proxLimit * proxLimit) {
      this.surrenderTimerMs = 0;
      return;
    }
    if (hasInput) {
      this.surrenderTimerMs = 0;
      return;
    }
    this.surrenderTimerMs += delta;
    if (this.surrenderTimerMs >= SURRENDER_DURATION_MS) {
      if (this.dialogueSystem.isActive) return;
      setFlag('marsh_surrendered', true);
    }
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

    const exitTiles = new Set<string>();
    for (const exit of this.area.exits) {
      for (let r = exit.row; r < exit.row + exit.height; r++) {
        for (let c = exit.col; c < exit.col + exit.width; c++) {
          exitTiles.add(`${c},${r}`);
        }
      }
    }

    // Fallback: unknown tileset id — render flat-color tiles so the scene still
    // loads with a clear console error (US-48 error-path).
    if (!hasTileset(this.area.tileset)) {
      console.error(
        `[GameScene] Unknown tileset id '${this.area.tileset}' on area '${this.area.id}'. ` +
          `Rendering flat-color fallback.`,
      );
      this.renderFallbackTiles(exitTiles);
      return;
    }

    const atlasKey = TILESETS[this.area.tileset].atlasKey;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tile = this.area.map[row][col];
        const kind = exitTiles.has(`${col},${row}`)
          ? TileType.EXIT
          : tile === TileType.WALL
          ? TileType.WALL
          : TileType.FLOOR;
        const frame = resolveFrame(this.area.tileset, kind, col, row);
        if (frame === null) continue;
        const sprite = this.add.sprite(col * TILE_SIZE, row * TILE_SIZE, atlasKey, frame);
        sprite.setOrigin(0, 0);
        sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
        sprite.setDepth(0);
        this.tileLayer.push(sprite);
      }
    }
  }

  private renderDecorations(): void {
    this.decorationSprites = [];
    this.conditionalDecorations = [];
    this.alphaGatedDecorations = [];
    this.lastAlphaGateCheckX = Number.NaN;
    this.lastAlphaGateCheckY = Number.NaN;
    if (!hasTileset(this.area.tileset)) return;
    const atlasKey = TILESETS[this.area.tileset].atlasKey;
    const texture = this.textures.get(atlasKey);
    // Out-of-bounds (col,row) outside (mapCols,mapRows) is not crashed-on:
    // Phaser accepts arbitrary world coords and the decoration renders off-grid
    // harmlessly. Authors see the misplaced decoration on visual inspection.
    for (const dec of this.area.decorations) {
      if (!texture.has(dec.spriteFrame)) {
        console.warn(
          `[GameScene] Decoration at (${dec.col},${dec.row}) references missing frame ` +
            `'${dec.spriteFrame}' on tileset '${this.area.tileset}'; skipping.`,
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
  // subscriber (one shared mechanism with the collision flip in
  // applyMarshTrappedState — US-67/US-68 'one shared mechanism, not two').
  // Iterates only the conditional subset; unconditional decorations are never
  // re-evaluated (Learning EP-01).
  private updateConditionalDecorations(): void {
    for (const entry of this.conditionalDecorations) {
      entry.sprite.setVisible(evaluateCondition(entry.condition));
    }
  }

  private renderProps(): void {
    this.propSprites = [];
    if (!hasTileset(this.area.tileset)) return;
    const atlasKey = TILESETS[this.area.tileset].atlasKey;
    const texture = this.textures.get(atlasKey);
    for (const prop of this.area.props) {
      if (!texture.has(prop.spriteFrame)) {
        console.warn(
          `[GameScene] Prop '${prop.id}' references missing frame '${prop.spriteFrame}' ` +
            `on tileset '${this.area.tileset}'; skipping.`,
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

  private renderFallbackTiles(exitTiles: Set<string>): void {
    const g = this.add.graphics();
    g.setDepth(0);
    const FALLBACK_EXIT = 0xc89b3c;
    for (let row = 0; row < this.area.mapRows; row++) {
      for (let col = 0; col < this.area.mapCols; col++) {
        const tile = this.area.map[row][col];
        const color = exitTiles.has(`${col},${row}`)
          ? FALLBACK_EXIT
          : tile === TileType.WALL
          ? this.area.visual.wallColor
          : this.area.visual.floorColor;
        g.fillStyle(color);
        g.fillRect(col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
    this.tileLayer.push(g);
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
      return sprite;
    }
    console.error(`NPC '${npc.id}' references unknown sprite id '${npc.sprite}' — falling back to rectangle render.`);
    const rect = this.add.rectangle(cx - NPC_SIZE / 2, cy - NPC_SIZE / 2, NPC_SIZE, NPC_SIZE, npc.color);
    rect.setOrigin(0, 0);
    rect.setDepth(5);
    this.npcEntities.push(rect);
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
    const mapWidth = this.area.mapCols * TILE_SIZE;
    const mapHeight = this.area.mapRows * TILE_SIZE;
    const cam = this.cameras.main;
    cam.setZoom(this.calculateZoom());
    cam.setBounds(0, 0, mapWidth, mapHeight);
    cam.startFollow(this.player);

    // UI camera — no zoom/scroll, renders dialogue/joystick/thought bubbles at screen coords
    const uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    uiCam.setScroll(0, 0);
    // Prevent UI camera from double-rendering world objects
    uiCam.ignore([...this.tileLayer, ...this.decorationSprites, ...this.propSprites, this.player, ...this.npcEntities]);

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

  private calculateZoom(): number {
    const shortSide = Math.min(this.scale.width, this.scale.height);
    const targetWorldSize = TARGET_VISIBLE_TILES * TILE_SIZE;
    // Snap to integer zoom — fractional zoom on a packed tile atlas (e.g. tiny-dungeon)
    // makes the GPU sample neighbouring frames at sub-pixel boundaries, which renders as
    // thin seams between tiles that disappear when the camera scroll changes by 1px.
    return Math.max(1, Math.floor(shortSide / targetWorldSize));
  }

  private handleResize(): void {
    const mapWidth = this.area.mapCols * TILE_SIZE;
    const mapHeight = this.area.mapRows * TILE_SIZE;
    const cam = this.cameras.main;
    // Zoom first — setBounds clamps scroll using displayWidth which depends on zoom
    cam.setZoom(this.calculateZoom());
    cam.setBounds(0, 0, mapWidth, mapHeight);
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
    if (this.hasEmberMarkUnsubscribe) {
      this.hasEmberMarkUnsubscribe();
      this.hasEmberMarkUnsubscribe = null;
    }
    for (const unsub of this.warmingUnsubscribes) unsub();
    this.warmingUnsubscribes = [];
    this.destroyEmberOverlay();
    this.lightingSystem?.destroy();
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
    const effective = Math.max(DESAT_FLOOR, base * (1 - DESAT_REDUCTION_PER_WARMING * warmingsCount));
    this.desaturationPipeline.setStrength(effective);
  }

  private registerNpcLight(npc: NpcDefinition, warmed = false): void {
    const offset = (TILE_SIZE - NPC_SIZE) / 2;
    const cx = npc.col * TILE_SIZE + offset + NPC_SIZE / 2;
    const cy = npc.row * TILE_SIZE + offset + NPC_SIZE / 2;
    const override = npc.lightOverride;
    const baseRadius = override?.radius ?? LIGHTING_CONFIG.npcRadius;
    const baseIntensity = override?.intensity ?? LIGHTING_CONFIG.npcIntensity;
    const light: RegisteredLight = {
      id: npc.id,
      x: cx,
      y: cy,
      radius: warmed ? baseRadius + LIGHTING_CONFIG.warmedRadiusBonus : baseRadius,
      intensity: warmed
        ? Math.min(1, baseIntensity + LIGHTING_CONFIG.warmedIntensityBonus)
        : baseIntensity,
      tier: override?.tier ?? 1,
    };
    this.lightingSystem.registerLight(light);
  }

  // Reflect the marsh_trapped flag on Fog Marsh: when true, the south-exit
  // cells (row 22 cols 13-16) flip from FLOOR to WALL so collision treats them
  // like any other wall; when false, they restore to FLOOR. Idempotent — runs
  // on scene create AND on every flag-change notification (US-67). Scoped to
  // fog-marsh so other areas' maps are never mutated.
  private applyMarshTrappedState(): void {
    if (this.area.id !== 'fog-marsh') return;
    const trapped = getFlag('marsh_trapped') === true;
    const tile = trapped ? TileType.WALL : TileType.FLOOR;
    const map = this.area.map;
    if (map.length <= 22) return;
    for (let c = 13; c <= 16; c++) {
      map[22][c] = tile;
    }
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
