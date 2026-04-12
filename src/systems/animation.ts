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
    // atan2 with vy, vx gives angle from east; adjust to get angle from north clockwise
    const angle = Math.atan2(vy, vx); // [-π, π], east=0, south=π/2
    // Normalize to [0, 2π]: add 2π if negative
    const normalized = angle < 0 ? angle + 2 * Math.PI : angle;
    // Shift by -π/2 so north (up, vy<0) is 0: north is atan2(-1,0)=-π/2 → normalized=3π/2
    // Alternative: use the direction index approach directly
    // Each sector is π/4 (45°). East is 0°, sectors go clockwise.
    // Map: east(0°)=E, 45°=SE, 90°=S, 135°=SW, 180°=W, 225°=NW, 270°=N, 315°=NE
    // atan2(vy,vx): east=0, south=π/2, west=π, north=-π/2
    const DIRECTIONS: Direction[] = [
      'east',       //   0° (atan2≈0)
      'south-east', //  45° (atan2≈π/4)
      'south',      //  90° (atan2≈π/2)
      'south-west', // 135° (atan2≈3π/4)
      'west',       // 180° (atan2≈±π)
      'north-west', // 225° (atan2≈-3π/4 → normalized 5π/4)
      'north',      // 270° (atan2≈-π/2 → normalized 3π/2)
      'north-east', // 315° (atan2≈-π/4 → normalized 7π/4)
    ];
    // Divide circle into 8 equal sectors of π/4 each, with east at center of sector 0
    // Each sector center is at k*π/4 for k=0..7; sector k spans [(k-0.5)*π/4, (k+0.5)*π/4]
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
