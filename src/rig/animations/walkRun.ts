import { AnimationController, BoneState, RigContext, WalkRunParams } from '../types';
import { PLAYER_SPEED } from '../../maps/constants';

/**
 * Walk/run procedural animation controller.
 *
 * Sine-wave based: body bob, alternating leg gait, tail follow-through
 * with progressive phase delay, ear sway. Manages walk-to-run speed
 * transition and deceleration curve.
 *
 * This controller is the source of truth for current movement speed.
 * GameScene queries getCurrentSpeed() and applies it to movement.
 */
export class WalkRunController implements AnimationController {
  private params: WalkRunParams;
  private phase = 0; // animation phase accumulator (radians)
  private holdTimer = 0; // seconds of continuous movement
  private isRunning = false;
  private decelerationPhase = 0; // 0 = not decelerating, >0 = settling
  private wasMoving = false;
  private lastSpeed = 0; // speed at moment movement stopped (for deceleration)
  private settlePhase = 0; // animation phase captured at decel start

  constructor(params: WalkRunParams) {
    this.params = params;
  }

  /** Current movement speed in pixels/sec. GameScene should use this instead of PLAYER_SPEED. */
  getCurrentSpeed(): number {
    if (this.decelerationPhase > 0) {
      // During deceleration, smoothly reduce to 0
      const t = this.decelerationPhase / this.params.decelerationDuration;
      return this.lastSpeed * (1 - t);
    }
    if (!this.wasMoving) return 0;
    return this.isRunning ? PLAYER_SPEED * this.params.runMultiplier : PLAYER_SPEED;
  }

  update(delta: number, boneStates: Record<string, BoneState>, rig: RigContext): void {
    const deltaSec = delta / 1000;
    const isMoving = rig.velocity > 0;

    // --- Walk-to-run transition ---
    if (isMoving) {
      this.holdTimer += deltaSec;
      if (this.holdTimer >= this.params.walkToRunDelay) {
        this.isRunning = true;
      }
      this.decelerationPhase = 0;
      this.wasMoving = true;
    } else {
      // Stopped — reset hold timer and run state
      if (this.wasMoving && this.decelerationPhase === 0) {
        // Just stopped — capture speed before isRunning resets (order matters: line below clears isRunning)
        this.lastSpeed = this.isRunning ? PLAYER_SPEED * this.params.runMultiplier : PLAYER_SPEED;
        this.settlePhase = this.phase;
        this.decelerationPhase = 0.001; // start decel
      }
      this.holdTimer = 0;
      this.isRunning = false;
    }

    // --- Deceleration ---
    if (this.decelerationPhase > 0) {
      this.decelerationPhase += deltaSec;
      if (this.decelerationPhase >= this.params.decelerationDuration) {
        this.decelerationPhase = 0;
        this.wasMoving = false;
        this.phase = 0;
        return; // Fully stopped
      }
      // Settle animation: reduce amplitudes over deceleration duration
      const settle = 1 - (this.decelerationPhase / this.params.decelerationDuration);
      this.applyAnimation(boneStates, this.settlePhase, settle, false);
      return;
    }

    if (!isMoving) return;

    // --- Advance animation phase ---
    const cycleHz = this.isRunning ? this.params.runCycleHz : this.params.walkCycleHz;
    this.phase += deltaSec * cycleHz * Math.PI * 2;

    this.applyAnimation(boneStates, this.phase, 1, this.isRunning);
  }

  private applyAnimation(
    boneStates: Record<string, BoneState>,
    phase: number,
    amplitude: number,
    running: boolean,
  ): void {
    const p = this.params;
    const runScale = running ? 1.5 : 1;
    const amp = amplitude;

    // --- Body bob ---
    const bobHeight = p.walkBobHeight * runScale * amp;
    if (boneStates['body']) {
      boneStates['body'].offsetY = Math.sin(phase * 2) * bobHeight;
      if (running) {
        boneStates['body'].rotation = Math.sin(phase) * 0.05 * amp; // Forward lean
      }
    }

    // --- Head follows body bob (dampened) ---
    if (boneStates['head']) {
      boneStates['head'].offsetY = Math.sin(phase * 2) * bobHeight * 0.5;
    }

    // --- Leg gait (alternating pairs: front-left + back-right, front-right + back-left) ---
    const legSwing = p.walkLegSwing * runScale * amp;

    // Pair 1: front-left + back-right (phase 0)
    const pair1 = Math.sin(phase) * legSwing;
    if (boneStates['front-left-upper-leg']) {
      boneStates['front-left-upper-leg'].rotation = pair1;
    }
    if (boneStates['front-left-lower-leg']) {
      boneStates['front-left-lower-leg'].rotation = pair1 * 0.6;
    }
    if (boneStates['back-right-upper-leg']) {
      boneStates['back-right-upper-leg'].rotation = pair1;
    }
    if (boneStates['back-right-lower-leg']) {
      boneStates['back-right-lower-leg'].rotation = pair1 * 0.6;
    }

    // Pair 2: front-right + back-left (phase offset π)
    const pair2 = Math.sin(phase + Math.PI) * legSwing;
    if (boneStates['front-right-upper-leg']) {
      boneStates['front-right-upper-leg'].rotation = pair2;
    }
    if (boneStates['front-right-lower-leg']) {
      boneStates['front-right-lower-leg'].rotation = pair2 * 0.6;
    }
    if (boneStates['back-left-upper-leg']) {
      boneStates['back-left-upper-leg'].rotation = pair2;
    }
    if (boneStates['back-left-lower-leg']) {
      boneStates['back-left-lower-leg'].rotation = pair2 * 0.6;
    }

    // --- Tail follow-through (progressive phase delay) ---
    const tailSwing = p.walkTailSwing * runScale * amp;
    const tailRunDampen = running ? 0.6 : 1; // Less sway when running (streams behind)
    if (boneStates['tail-1']) {
      boneStates['tail-1'].rotation = Math.sin(phase - 0.3) * tailSwing * tailRunDampen;
    }
    if (boneStates['tail-2']) {
      boneStates['tail-2'].rotation = Math.sin(phase - 0.6) * tailSwing * 0.8 * tailRunDampen;
    }
    if (boneStates['tail-3']) {
      boneStates['tail-3'].rotation = Math.sin(phase - 0.9) * tailSwing * 0.6 * tailRunDampen;
    }

    // --- Ear sway ---
    const earSwing = p.walkEarSwing * amp;
    if (boneStates['left-ear']) {
      boneStates['left-ear'].rotation = Math.sin(phase * 1.5) * earSwing;
    }
    if (boneStates['right-ear']) {
      boneStates['right-ear'].rotation = Math.sin(phase * 1.5 + 0.4) * earSwing;
    }

    // --- Eye squint when running (flatten dots into lines) ---
    if (running) {
      const squint = 0.3; // scaleY multiplier — flat line look
      if (boneStates['left-eye']) {
        boneStates['left-eye'].scaleY = squint;
      }
      if (boneStates['right-eye']) {
        boneStates['right-eye'].scaleY = squint;
      }
    }
  }

  destroy(): void {
    // No timers or external references to clean up
  }
}
