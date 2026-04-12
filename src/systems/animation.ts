import Phaser from 'phaser';
import { PLAYER_SPEED } from '../maps/constants';

type Direction =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

type AnimState = 'idle' | 'walk';

/**
 * AnimationSystem — manages fox-pip sprite animation state.
 *
 * Tracks facing direction, animation state (idle/walk), and plays the correct
 * 8-directional animation on the player sprite. Called from GameScene.update()
 * each frame with current velocity.
 *
 * Direction mapping uses octant boundaries (45-degree sectors):
 * atan2(vy, vx) determines the direction, then quantized to nearest 45°.
 */
export class AnimationSystem {
  private facingDirection: Direction = 'south';
  private currentState: AnimState = 'idle';
  private currentAnimKey: string = '';

  constructor(private sprite: Phaser.GameObjects.Sprite) {
    // Play initial idle-south animation
    this.playAnim('idle', 'south');
  }

  /**
   * Update animation state based on current velocity.
   * @param vx Horizontal velocity (negative = west, positive = east)
   * @param vy Vertical velocity (negative = north, positive = south)
   */
  update(vx: number, vy: number): void {
    const isMoving = vx !== 0 || vy !== 0;

    if (isMoving) {
      this.facingDirection = this.velocityToDirection(vx, vy);
      this.playAnim('walk', this.facingDirection);
    } else {
      this.playAnim('idle', this.facingDirection);
    }
  }

  /**
   * Get the current movement speed.
   * Always returns PLAYER_SPEED — no run acceleration in this sprite set.
   */
  getCurrentSpeed(): number {
    return PLAYER_SPEED;
  }

  /**
   * Map velocity to one of 8 directions using octant boundaries (45-degree sectors).
   * atan2 returns angle in [-π, π]; we normalize to [0, 2π] then quantize to 8 sectors.
   * Note: vy is positive-down in screen space (Phaser), so south = positive vy.
   */
  private velocityToDirection(vx: number, vy: number): Direction {
    // Quantize atan2 angle to nearest 45° sector (8 directions).
    // atan2(vy, vx): east=0, south=π/2, west=±π, north=-π/2
    // Directions ordered clockwise from east, matching normalized [0, 2π] sector indices.
    const angle = Math.atan2(vy, vx);
    const normalized = angle < 0 ? angle + 2 * Math.PI : angle;
    const DIRECTIONS: Direction[] = [
      'east',       //   0° sector
      'south-east', //  45°
      'south',      //  90°
      'south-west', // 135°
      'west',       // 180°
      'north-west', // 225°
      'north',      // 270°
      'north-east', // 315°
    ];
    const sectorIndex = Math.round(normalized / (Math.PI / 4)) % 8;
    return DIRECTIONS[sectorIndex];
  }

  private playAnim(state: AnimState, direction: Direction): void {
    const key = `fox-pip-${state}-${direction}`;
    if (key === this.currentAnimKey) return; // Already playing
    this.currentAnimKey = key;
    this.currentState = state;
    this.sprite.play(key);
  }

  /** Get the current animation state. */
  getState(): AnimState {
    return this.currentState;
  }
}
