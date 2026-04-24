import Phaser from 'phaser';
import { PLAYER_SPEED } from '../maps/constants';
import { Direction, velocityToDirection } from './direction';

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
      this.facingDirection = velocityToDirection(vx, vy);
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
