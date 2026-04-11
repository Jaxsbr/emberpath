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
    const flipX = isMirrored ? -1 : 1;

    // Resolve world positions via tree walk (no bone state offsets)
    this.resolvePositions(this.definition.skeleton, profile, null, 0, 0, 0, 1, 1, flipX);

    // Container renders children in list order — sort by depth so profiles control layering
    this.container.sort('depth');
  }

  /**
   * Depth-first tree walk resolver — shared by setDirection() and update().
   * Resolves world positions from parent-relative profile data + optional bone state offsets.
   * Sprites remain flat siblings in the Container — no nested Containers.
   */
  private resolvePositions(
    bone: BoneDefinition,
    profile: DirectionProfile,
    boneStates: Record<string, BoneState> | null,
    parentWorldX: number,
    parentWorldY: number,
    parentWorldRot: number,
    parentWorldScaleX: number,
    parentWorldScaleY: number,
    flipX: number,
  ): void {
    const sprite = this.parts.get(bone.name);
    if (!sprite) return;

    const partProfile = profile.parts[bone.name];
    if (!partProfile) {
      sprite.setVisible(false);
      // Transparent-skip: this bone is absent from the profile for this direction.
      // Children still recurse using the grandparent's world position as their anchor —
      // the missing bone contributes nothing to the chain. This is intentional: a bone
      // omitted from a profile is treated as structurally absent for that direction,
      // not merely hidden. If a bone should anchor children while invisible, add it to
      // the profile with visible: false instead of omitting it entirely.
      if (bone.children) {
        for (const child of bone.children) {
          this.resolvePositions(child, profile, boneStates, parentWorldX, parentWorldY, parentWorldRot, parentWorldScaleX, parentWorldScaleY, flipX);
        }
      }
      return;
    }

    sprite.setVisible(partProfile.visible);
    sprite.setDepth(partProfile.depth);
    sprite.setAlpha(partProfile.alpha ?? 1);

    // Local offset = profile position + animation state offset
    const state = boneStates?.[bone.name];
    let localX = partProfile.x + (state?.offsetX ?? 0);
    let localY = partProfile.y + (state?.offsetY ?? 0);

    // Inherit rotation: rotate local offset around parent's pivot
    if (bone.inheritRotation && parentWorldRot !== 0) {
      const cos = Math.cos(parentWorldRot);
      const sin = Math.sin(parentWorldRot);
      const rx = localX * cos - localY * sin;
      const ry = localX * sin + localY * cos;
      localX = rx;
      localY = ry;
    }

    // Inherit scale: scale local offset by parent's world scale
    if (bone.inheritScale) {
      localX *= parentWorldScaleX;
      localY *= parentWorldScaleY;
    }

    // World position = parent world position + local offset (with mirroring)
    const worldX = parentWorldX + localX * flipX;
    const worldY = parentWorldY + localY;

    // World rotation and scale for this bone
    // inheritRotation: false (default) → bone rotates independently (matches flat behavior)
    // inheritRotation: true → bone accumulates parent's rotation
    const localRot = partProfile.rotation + (state?.rotation ?? 0);
    const worldRot = bone.inheritRotation ? parentWorldRot + localRot : localRot;
    const localScaleX = partProfile.scaleX * (state?.scaleX ?? 1);
    const localScaleY = partProfile.scaleY * (state?.scaleY ?? 1);
    const worldScaleX = bone.inheritScale ? parentWorldScaleX * localScaleX : localScaleX;
    const worldScaleY = bone.inheritScale ? parentWorldScaleY * localScaleY : localScaleY;

    // Apply to sprite
    sprite.setPosition(worldX, worldY);
    sprite.setScale(worldScaleX * flipX, worldScaleY);
    sprite.setRotation(worldRot * flipX);

    // Recurse into children with this bone's world state as parent
    if (bone.children) {
      for (const child of bone.children) {
        this.resolvePositions(child, profile, boneStates, worldX, worldY, worldRot, worldScaleX, worldScaleY, flipX);
      }
    }
  }

  /**
   * Apply external profiles (e.g., from the editor) using the tree-walk resolver.
   * This resolves parent-relative coordinates to world positions, so editing a
   * parent bone's offset visually updates all descendants.
   */
  applyProfiles(profiles: Record<UniqueDirection, DirectionProfile>, direction: Direction): void {
    this.currentDirection = direction;
    const mirrored = MIRRORED_DIRECTIONS.has(direction);
    const uniqueDir = (mirrored ? MIRROR_MAP[direction] : direction) as UniqueDirection;
    const profile = profiles[uniqueDir];
    const flipX = mirrored ? -1 : 1;
    this.resolvePositions(this.definition.skeleton, profile, null, 0, 0, 0, 1, 1, flipX);
    this.container.sort('depth');
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

    // Resolve world positions via tree walk (with bone state offsets)
    const isMirrored = MIRRORED_DIRECTIONS.has(this.currentDirection);
    const uniqueDir = (isMirrored ? MIRROR_MAP[this.currentDirection] : this.currentDirection) as UniqueDirection;
    const profile = this.definition.profiles[uniqueDir];
    const flipX = isMirrored ? -1 : 1;

    this.resolvePositions(this.definition.skeleton, profile, this.boneStates, 0, 0, 0, 1, 1, flipX);
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
