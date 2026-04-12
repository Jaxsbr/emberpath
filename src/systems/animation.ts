import Phaser from 'phaser';
import { PLAYER_SPEED, RUN_MULTIPLIER, RUN_THRESHOLD_MS } from '../maps/constants';

type Direction = 'north' | 'east' | 'south' | 'west';
type AnimState = 'idle' | 'walk' | 'run';

/**
 * AnimationSystem — manages fox-pip sprite animation state.
 *
 * Tracks facing direction, animation state (idle/walk/run), walk-to-run
 * transition timer, and plays the correct directional animation on the
 * player sprite. Called from GameScene.update() each frame with current
 * velocity and delta time.
 */
export class AnimationSystem {
  private facingDirection: Direction = 'south';
  private currentState: AnimState = 'idle';
  private currentAnimKey: string = '';
  private moveElapsedMs: number = 0;

  constructor(private sprite: Phaser.GameObjects.Sprite) {
    // Play initial idle-south animation
    this.playAnim('idle', 'south');
  }

  /**
   * Update animation state based on current velocity.
   * @param vx Horizontal velocity (negative = west, positive = east)
   * @param vy Vertical velocity (negative = north, positive = south)
   * @param delta Frame delta time in milliseconds
   */
  update(vx: number, vy: number, delta: number): void {
    const isMoving = vx !== 0 || vy !== 0;

    if (isMoving) {
      // Determine facing direction from velocity (4-direction mapping)
      this.facingDirection = this.velocityToDirection(vx, vy);

      // Accumulate walk-to-run elapsed time
      this.moveElapsedMs += delta;

      if (this.moveElapsedMs >= RUN_THRESHOLD_MS) {
        this.playAnim('run', this.facingDirection);
      } else {
        this.playAnim('walk', this.facingDirection);
      }
    } else {
      // Stationary — reset walk-to-run timer and play idle
      this.moveElapsedMs = 0;
      this.playAnim('idle', this.facingDirection);
    }
  }

  /**
   * Get the current movement speed based on animation state.
   * Walk = PLAYER_SPEED, Run = PLAYER_SPEED × RUN_MULTIPLIER, Idle = 0.
   */
  getCurrentSpeed(): number {
    if (this.currentState === 'run') {
      return PLAYER_SPEED * RUN_MULTIPLIER;
    }
    return PLAYER_SPEED;
  }

  /**
   * Map velocity to a cardinal direction (N/E/S/W).
   * Uses dominant axis — if both axes have input, the larger magnitude wins.
   * On equal magnitude, current facing direction is maintained to prevent flip-flopping.
   */
  private velocityToDirection(vx: number, vy: number): Direction {
    const absX = Math.abs(vx);
    const absY = Math.abs(vy);

    if (absX > absY) {
      return vx > 0 ? 'east' : 'west';
    } else if (absY > absX) {
      return vy > 0 ? 'south' : 'north';
    }
    // Equal magnitude — maintain current facing direction
    return this.facingDirection;
  }

  private playAnim(state: AnimState, direction: Direction): void {
    const key = `fox-pip-${state}-${direction}`;
    if (key === this.currentAnimKey) return; // Already playing
    this.currentAnimKey = key;
    this.currentState = state;
    this.sprite.play(key);
  }

  /** Get the current facing direction. */
  getFacingDirection(): Direction {
    return this.facingDirection;
  }

  /** Get the current animation state. */
  getState(): AnimState {
    return this.currentState;
  }
}
