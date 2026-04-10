import Phaser from 'phaser';
import {
  RigDefinition,
  Direction,
  UniqueDirection,
  DirectionProfile,
  PartProfile,
  BoneDefinition,
  BoneState,
  AnimationController,
  RigContext,
} from './types';

/** Maps mirrored directions to their source unique direction. */
const MIRROR_MAP: Record<string, UniqueDirection> = {
  W: 'E',
  SW: 'SE',
  NW: 'NE',
};

/** Directions that are mirrored (flipped on X). */
const MIRRORED_DIRECTIONS = new Set<Direction>(['W', 'SW', 'NW']);

/**
 * 2D skeletal rig — creates a Phaser Container with Sprite children
 * from a texture atlas, driven by direction profiles and animation controllers.
 */
export class CharacterRig {
  readonly container: Phaser.GameObjects.Container;
  private parts: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private definition: RigDefinition;
  private controllers: AnimationController[] = [];
  private currentDirection: Direction = 'S';
  private boneStates: Record<string, BoneState> = {};
  private velocity = 0;

  constructor(scene: Phaser.Scene, definition: RigDefinition, x: number, y: number) {
    this.definition = definition;
    this.container = scene.add.container(x, y);

    // Walk the bone tree and create sprites
    this.createSprites(scene, definition.skeleton);

    // Initialize bone states
    for (const [name] of this.parts) {
      this.boneStates[name] = { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 };
    }

    // Apply initial direction
    this.setDirection('S');
  }

  /** Recursively create sprites from the bone hierarchy. */
  private createSprites(scene: Phaser.Scene, bone: BoneDefinition): void {
    const sprite = scene.add.sprite(0, 0, this.definition.atlasKey, bone.name);
    sprite.setOrigin(0.5, 0.5);
    this.parts.set(bone.name, sprite);
    this.container.add(sprite);

    if (bone.children) {
      for (const child of bone.children) {
        this.createSprites(scene, child);
      }
    }
  }

  /** Collect all part names from the bone tree (depth-first). */
  private static collectPartNames(bone: BoneDefinition): string[] {
    const names = [bone.name];
    if (bone.children) {
      for (const child of bone.children) {
        names.push(...CharacterRig.collectPartNames(child));
      }
    }
    return names;
  }

  /** Set the facing direction. Updates all part positions, scales, rotations, depth, and visibility. */
  setDirection(dir: Direction): void {
    this.currentDirection = dir;
    const isMirrored = MIRRORED_DIRECTIONS.has(dir);
    const uniqueDir = (isMirrored ? MIRROR_MAP[dir] : dir) as UniqueDirection;
    const profile: DirectionProfile = this.definition.profiles[uniqueDir];

    for (const [name, sprite] of this.parts) {
      const partProfile: PartProfile | undefined = profile.parts[name];
      if (!partProfile) {
        sprite.setVisible(false);
        continue;
      }

      sprite.setVisible(partProfile.visible);
      // Mirror: flip X position and scaleX
      const flipX = isMirrored ? -1 : 1;
      sprite.setPosition(partProfile.x * flipX, partProfile.y);
      sprite.setScale(partProfile.scaleX * flipX, partProfile.scaleY);
      sprite.setRotation(partProfile.rotation * flipX);
      sprite.setDepth(partProfile.depth);
      sprite.setAlpha(partProfile.alpha ?? 1);
    }
  }

  /** Set the current movement velocity magnitude (used by animation controllers). */
  setVelocity(v: number): void {
    this.velocity = v;
  }

  /** Register an animation controller. */
  addAnimationController(controller: AnimationController): void {
    this.controllers.push(controller);
  }

  /** Remove an animation controller. */
  removeAnimationController(controller: AnimationController): void {
    const idx = this.controllers.indexOf(controller);
    if (idx !== -1) {
      this.controllers.splice(idx, 1);
      controller.destroy?.();
    }
  }

  /** Called every frame from the scene's update(). */
  update(delta: number): void {
    // Reset bone states to baseline
    for (const name of this.parts.keys()) {
      const state = this.boneStates[name];
      state.offsetX = 0;
      state.offsetY = 0;
      state.scaleX = 1;
      state.scaleY = 1;
      state.rotation = 0;
    }

    // Let controllers accumulate animation deltas
    const context: RigContext = {
      direction: this.currentDirection,
      velocity: this.velocity,
    };
    for (const controller of this.controllers) {
      controller.update(delta, this.boneStates, context);
    }

    // Apply bone states on top of the current direction profile
    const isMirrored = MIRRORED_DIRECTIONS.has(this.currentDirection);
    const uniqueDir = (isMirrored ? MIRROR_MAP[this.currentDirection] : this.currentDirection) as UniqueDirection;
    const profile = this.definition.profiles[uniqueDir];
    const flipX = isMirrored ? -1 : 1;

    for (const [name, sprite] of this.parts) {
      const partProfile = profile.parts[name];
      if (!partProfile || !partProfile.visible) continue;

      const state = this.boneStates[name];
      sprite.setPosition(
        (partProfile.x + state.offsetX) * flipX,
        partProfile.y + state.offsetY,
      );
      sprite.setScale(
        partProfile.scaleX * state.scaleX * flipX,
        partProfile.scaleY * state.scaleY,
      );
      sprite.setRotation((partProfile.rotation + state.rotation) * flipX);
    }
  }

  /** Get the current direction. */
  getDirection(): Direction {
    return this.currentDirection;
  }

  /** Get the rig definition. */
  getDefinition(): RigDefinition {
    return this.definition;
  }

  /** Clean up all controllers. Call on scene shutdown/destroy. */
  destroy(): void {
    for (const controller of this.controllers) {
      controller.destroy?.();
    }
    this.controllers.length = 0;
    this.container.destroy();
  }
}
