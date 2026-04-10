/** 8-direction compass for character facing. */
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** The 5 unique (non-mirrored) directions. W, SW, NW are derived by mirroring E, SE, NE. */
export type UniqueDirection = 'N' | 'NE' | 'E' | 'SE' | 'S';

/** Defines a single bone (body part) in the skeleton hierarchy. */
export interface BoneDefinition {
  /** Unique part name — must match a frame name in the texture atlas. */
  name: string;
  /** Child bones attached to this bone. */
  children?: BoneDefinition[];
}

/** Per-part configuration within a direction profile. */
export interface PartProfile {
  /** Offset from container origin (pixels). */
  x: number;
  y: number;
  /** Scale factors. */
  scaleX: number;
  scaleY: number;
  /** Rotation in radians. */
  rotation: number;
  /** Render order within the container (higher = in front). */
  depth: number;
  /** Whether this part is visible in this direction. */
  visible: boolean;
  /** Optional alpha override (0-1). Defaults to 1. */
  alpha?: number;
}

/** A direction profile maps each part name to its visual configuration for that facing direction. */
export interface DirectionProfile {
  parts: Record<string, PartProfile>;
}

/** Runtime state of a bone, exposed to animation controllers for manipulation. */
export interface BoneState {
  /** Current offset from profile baseline. Controllers accumulate deltas. */
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/** Interface that all animation controllers must implement. */
export interface AnimationController {
  /** Called every frame. Mutate boneStates to animate. */
  update(delta: number, boneStates: Record<string, BoneState>, rig: RigContext): void;
  /** Called when the controller is removed or the scene shuts down. */
  destroy?(): void;
}

/** Read-only rig context passed to animation controllers. */
export interface RigContext {
  /** Current facing direction. */
  direction: Direction;
  /** Current movement velocity magnitude (pixels/sec). */
  velocity: number;
}

/** Walk/run animation parameters — stored in the rig definition, read by the walkRun controller. */
export interface WalkRunParams {
  /** Vertical bob amplitude in pixels at walk speed. */
  walkBobHeight: number;
  /** Leg swing amplitude in radians at walk speed. */
  walkLegSwing: number;
  /** Tail sway amplitude in radians at walk speed. */
  walkTailSwing: number;
  /** Ear sway amplitude in radians at walk speed. */
  walkEarSwing: number;
  /** Speed multiplier for run vs walk. */
  runMultiplier: number;
  /** Seconds of continuous movement before walk transitions to run. */
  walkToRunDelay: number;
  /** Walk animation cycle frequency (cycles per second). */
  walkCycleHz: number;
  /** Run animation cycle frequency (cycles per second). */
  runCycleHz: number;
  /** Deceleration curve duration in seconds (how long the settle takes on stop). */
  decelerationDuration: number;
}

/** Idle animation parameters — stored in the rig definition, read by the idle controller. */
export interface IdleParams {
  /** Breathing scale oscillation amplitude. */
  breathingAmplitude: number;
  /** Breathing cycle period in seconds. */
  breathingPeriod: number;
  /** Idle tail sway amplitude in radians. */
  tailSwayAmplitude: number;
  /** Idle tail sway period in seconds. */
  tailSwayPeriod: number;
  /** Seconds of idle before head turn triggers. */
  headTurnDelay: number;
  /** Head turn rotation in radians. */
  headTurnAngle: number;
  /** Seconds of idle before sit animation triggers. */
  sitDelay: number;
  /** How much the body lowers in pixels when sitting. */
  sitLowerAmount: number;
  /** Minimum seconds between ear flicks. */
  earFlickMinInterval: number;
  /** Maximum seconds between ear flicks. */
  earFlickMaxInterval: number;
  /** Ear flick rotation spike in radians. */
  earFlickAmplitude: number;
}

/** Complete rig definition — pure data, no class instances. */
export interface RigDefinition {
  /** Display name for debugging. */
  name: string;
  /** Texture atlas key (as loaded in Phaser). */
  atlasKey: string;
  /** Root bone of the skeleton hierarchy. */
  skeleton: BoneDefinition;
  /** Direction profiles — only the 5 unique directions. Mirrored directions derived at runtime. */
  profiles: Record<UniqueDirection, DirectionProfile>;
  /** Walk/run animation parameters. */
  walkRunParams: WalkRunParams;
  /** Idle animation parameters. */
  idleParams: IdleParams;
  /** Collision bounding box size in pixels (square). */
  collisionSize: number;
}
