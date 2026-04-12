import Phaser from 'phaser';

type Direction = 'north' | 'east' | 'south' | 'west';
type AnimState = 'idle' | 'walk' | 'run';

/**
 * AnimationSystem — manages fox-pip sprite animation state.
 *
 * Tracks facing direction, animation state (idle/walk/run), and plays
 * the correct directional animation on the player sprite. Called from
 * GameScene.update() each frame with current velocity.
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
      // Determine facing direction from velocity (4-direction mapping)
      this.facingDirection = this.velocityToDirection(vx, vy);
      this.playAnim('walk', this.facingDirection);
    } else {
      // Stationary — play idle in last facing direction
      this.playAnim('idle', this.facingDirection);
    }
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
