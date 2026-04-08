import Phaser from 'phaser';
import { PLAYER_SPEED } from '../maps/constants';

export interface InputVector {
  x: number;
  y: number;
}

const JOYSTICK_RADIUS = 50;
const JOYSTICK_DEAD_ZONE = 10;
const JOYSTICK_BASE_COLOR = 0xffffff;
const JOYSTICK_HANDLE_COLOR = 0xcccccc;
const JOYSTICK_ALPHA = 0.4;

export class InputSystem {
  private cursors: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;
  private joystickBase: Phaser.GameObjects.Arc | null = null;
  private joystickHandle: Phaser.GameObjects.Arc | null = null;
  private joystickOrigin: { x: number; y: number } | null = null;
  private joystickVector: InputVector = { x: 0, y: 0 };
  private joystickActive = false;

  constructor(private scene: Phaser.Scene) {
    this.setupKeyboard();
    this.setupJoystick();
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  private setupJoystick(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.joystickActive) return;
      this.joystickActive = true;
      this.joystickOrigin = { x: pointer.x, y: pointer.y };

      this.joystickBase = this.scene.add.circle(pointer.x, pointer.y, JOYSTICK_RADIUS, JOYSTICK_BASE_COLOR, JOYSTICK_ALPHA)
        .setScrollFactor(0)
        .setDepth(100);
      this.joystickHandle = this.scene.add.circle(pointer.x, pointer.y, JOYSTICK_RADIUS * 0.4, JOYSTICK_HANDLE_COLOR, JOYSTICK_ALPHA + 0.2)
        .setScrollFactor(0)
        .setDepth(100);
    });

    this.scene.input.on('pointerup', () => {
      if (!this.joystickActive) return;
      this.resetJoystick();
    });
  }

  /** Call from scene update() to poll active pointer position for joystick tracking. */
  update(): void {
    if (!this.joystickActive || !this.joystickOrigin) return;

    const pointer = this.scene.input.activePointer;
    if (!pointer.isDown) {
      this.resetJoystick();
      return;
    }

    const dx = pointer.x - this.joystickOrigin.x;
    const dy = pointer.y - this.joystickOrigin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < JOYSTICK_DEAD_ZONE) {
      this.joystickVector = { x: 0, y: 0 };
      if (this.joystickHandle) {
        this.joystickHandle.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
      }
      return;
    }

    const clampedDist = Math.min(dist, JOYSTICK_RADIUS);
    const nx = dx / dist;
    const ny = dy / dist;
    this.joystickVector = { x: nx * (clampedDist / JOYSTICK_RADIUS), y: ny * (clampedDist / JOYSTICK_RADIUS) };

    if (this.joystickHandle) {
      this.joystickHandle.setPosition(
        this.joystickOrigin.x + nx * clampedDist,
        this.joystickOrigin.y + ny * clampedDist,
      );
    }
  }

  private resetJoystick(): void {
    this.joystickActive = false;
    this.joystickOrigin = null;
    this.joystickVector = { x: 0, y: 0 };
    this.joystickBase?.destroy();
    this.joystickHandle?.destroy();
    this.joystickBase = null;
    this.joystickHandle = null;
  }

  getVelocity(): InputVector {
    // Keyboard takes priority if any key is held
    if (this.cursors) {
      let kx = 0;
      let ky = 0;
      if (this.cursors.A.isDown) kx -= 1;
      if (this.cursors.D.isDown) kx += 1;
      if (this.cursors.W.isDown) ky -= 1;
      if (this.cursors.S.isDown) ky += 1;

      if (kx !== 0 || ky !== 0) {
        const len = Math.sqrt(kx * kx + ky * ky);
        return { x: (kx / len) * PLAYER_SPEED, y: (ky / len) * PLAYER_SPEED };
      }
    }

    // Fall back to joystick
    if (this.joystickVector.x !== 0 || this.joystickVector.y !== 0) {
      return {
        x: this.joystickVector.x * PLAYER_SPEED,
        y: this.joystickVector.y * PLAYER_SPEED,
      };
    }

    return { x: 0, y: 0 };
  }
}
