import { AnimationController, BoneState, RigContext, IdleParams } from '../types';

/**
 * Idle animation controller — breathing, tail sway, head turn, sit, ear flick.
 *
 * Progressive idle stages:
 * 1. Immediate (velocity 0): breathing + tail sway + ear flick
 * 2. After headTurnDelay: random head turn
 * 3. After sitDelay: sit-down pose
 *
 * Any movement input resets all timers and returns to standing.
 */
export class IdleController implements AnimationController {
  private params: IdleParams;
  private idleTime = 0;
  private breathingPhase = 0;
  private tailPhase = 0;
  private isIdle = false;

  // Head turn state
  private headTurnActive = false;
  private headTurnDirection = 1; // 1 = right, -1 = left
  private headTurnProgress = 0; // 0-1-0 (turn out, hold, return)

  // Sit state
  private isSitting = false;
  private sitProgress = 0; // 0 to 1

  // Ear flick state
  private leftEarFlickTimer = 0;
  private rightEarFlickTimer = 0;
  private leftEarFlickProgress = 0; // 0 = no flick, >0 = flicking
  private rightEarFlickProgress = 0;
  private leftEarNextFlick: number;
  private rightEarNextFlick: number;

  constructor(params: IdleParams) {
    this.params = params;
    this.leftEarNextFlick = this.randomFlickInterval();
    this.rightEarNextFlick = this.randomFlickInterval();
  }

  private randomFlickInterval(): number {
    const { earFlickMinInterval, earFlickMaxInterval } = this.params;
    return earFlickMinInterval + Math.random() * (earFlickMaxInterval - earFlickMinInterval);
  }

  update(delta: number, boneStates: Record<string, BoneState>, rig: RigContext): void {
    const deltaSec = delta / 1000;
    const isMoving = rig.velocity > 0;

    if (isMoving) {
      // Reset all idle state
      this.idleTime = 0;
      this.isIdle = false;
      this.headTurnActive = false;
      this.headTurnProgress = 0;
      this.sitProgress = 0;
      this.isSitting = false;
      this.leftEarFlickTimer = 0;
      this.rightEarFlickTimer = 0;
      this.leftEarFlickProgress = 0;
      this.rightEarFlickProgress = 0;
      return;
    }

    this.isIdle = true;
    this.idleTime += deltaSec;

    // --- Breathing (immediate) ---
    this.breathingPhase += deltaSec / this.params.breathingPeriod * Math.PI * 2;
    const breathScale = 1 + Math.sin(this.breathingPhase) * this.params.breathingAmplitude;
    if (boneStates['body']) {
      boneStates['body'].scaleX = breathScale;
      boneStates['body'].scaleY = breathScale;
    }
    // Shoulders follow breathing (subtle expand/contract)
    if (boneStates['shoulders']) {
      boneStates['shoulders'].scaleX = breathScale;
    }

    // --- Tail sway (immediate, distinct from walk tail) ---
    this.tailPhase += deltaSec / this.params.tailSwayPeriod * Math.PI * 2;
    const tailSway = Math.sin(this.tailPhase) * this.params.tailSwayAmplitude;
    if (boneStates['tail-1']) {
      boneStates['tail-1'].rotation = tailSway;
    }
    if (boneStates['tail-2']) {
      boneStates['tail-2'].rotation = tailSway * 1.2; // Slightly more at the tip
    }
    if (boneStates['tail-3']) {
      boneStates['tail-3'].rotation = tailSway * 1.4;
    }

    // --- Ear flick (random, independent per ear) ---
    this.updateEarFlick(deltaSec, boneStates, 'left-ear', 'left');
    this.updateEarFlick(deltaSec, boneStates, 'right-ear', 'right');

    // --- Head turn (after delay) ---
    if (this.idleTime >= this.params.headTurnDelay) {
      if (!this.headTurnActive) {
        // Start a head turn
        this.headTurnActive = true;
        this.headTurnDirection = Math.random() > 0.5 ? 1 : -1;
        this.headTurnProgress = 0;
      }
      // Animate head turn: 0→0.5 = turn out, 0.5→1.0 = return
      this.headTurnProgress += deltaSec * 0.5; // ~2 second full cycle
      if (this.headTurnProgress >= 1) {
        this.headTurnActive = false;
        this.headTurnProgress = 0;
      }
      const turnAmount = this.headTurnProgress < 0.5
        ? this.headTurnProgress * 2 // 0 to 1 (turning)
        : (1 - this.headTurnProgress) * 2; // 1 to 0 (returning)
      // Neck drives the turn — tree walk propagates to head and snout
      if (boneStates['neck']) {
        boneStates['neck'].rotation = turnAmount * this.params.headTurnAngle * this.headTurnDirection;
      }
    }

    // --- Sit-down (after longer delay) ---
    if (this.idleTime >= this.params.sitDelay) {
      if (!this.isSitting) {
        this.isSitting = true;
        this.sitProgress = 0;
      }
      // Smooth sit transition over ~1 second
      if (this.sitProgress < 1) {
        this.sitProgress = Math.min(1, this.sitProgress + deltaSec);
      }
      const sitEase = easeInOutQuad(this.sitProgress);

      // Body lowers — tree walk propagates to all descendants
      if (boneStates['body']) {
        boneStates['body'].offsetY += this.params.sitLowerAmount * sitEase;
      }
      // Hips drop extra (rear lowers more in a sit)
      if (boneStates['hips']) {
        boneStates['hips'].offsetY += this.params.sitLowerAmount * 1.2 * sitEase;
      }

      // Front legs tuck (with foot subtree following)
      this.applySitLeg(boneStates, 'front-left', -0.3, -0.5, -4, sitEase);
      this.applySitLeg(boneStates, 'front-right', 0.3, 0.5, -4, sitEase);

      // Tail curls around
      if (boneStates['tail-1']) {
        boneStates['tail-1'].rotation += 0.2 * sitEase;
        boneStates['tail-1'].offsetY += 2 * sitEase;
      }
      if (boneStates['tail-2']) {
        boneStates['tail-2'].rotation += 0.4 * sitEase;
        boneStates['tail-2'].offsetY += 3 * sitEase;
      }
      if (boneStates['tail-3']) {
        boneStates['tail-3'].rotation += 0.6 * sitEase;
        boneStates['tail-3'].offsetY += 4 * sitEase;
      }

      // Happy squint — eyes flatten into curved lines when sitting
      const eyeSquint = 1 - 0.6 * sitEase; // 1.0 → 0.4 (dot → line)
      if (boneStates['left-eye']) {
        boneStates['left-eye'].scaleY *= eyeSquint;
      }
      if (boneStates['right-eye']) {
        boneStates['right-eye'].scaleY *= eyeSquint;
      }
    }
  }

  private updateEarFlick(
    deltaSec: number,
    boneStates: Record<string, BoneState>,
    earName: string,
    side: 'left' | 'right',
  ): void {
    const isLeft = side === 'left';
    const timer = isLeft ? this.leftEarFlickTimer : this.rightEarFlickTimer;
    const progress = isLeft ? this.leftEarFlickProgress : this.rightEarFlickProgress;
    const nextFlick = isLeft ? this.leftEarNextFlick : this.rightEarNextFlick;

    if (progress > 0) {
      // Currently flicking
      const newProgress = progress + deltaSec * 6; // ~0.17s flick duration
      if (newProgress >= 1) {
        // Flick complete
        if (isLeft) { this.leftEarFlickProgress = 0; this.leftEarFlickTimer = 0; this.leftEarNextFlick = this.randomFlickInterval(); }
        else { this.rightEarFlickProgress = 0; this.rightEarFlickTimer = 0; this.rightEarNextFlick = this.randomFlickInterval(); }
      } else {
        if (isLeft) this.leftEarFlickProgress = newProgress;
        else this.rightEarFlickProgress = newProgress;
        // Spike shape: quick up, slow return
        const spike = newProgress < 0.3
          ? newProgress / 0.3 // 0 to 1
          : (1 - newProgress) / 0.7; // 1 to 0
        if (boneStates[earName]) {
          boneStates[earName].rotation += spike * this.params.earFlickAmplitude * (isLeft ? -1 : 1);
        }
      }
    } else {
      // Waiting for next flick
      const newTimer = timer + deltaSec;
      if (newTimer >= nextFlick) {
        // Start flick
        if (isLeft) { this.leftEarFlickProgress = 0.001; }
        else { this.rightEarFlickProgress = 0.001; }
      } else {
        if (isLeft) this.leftEarFlickTimer = newTimer;
        else this.rightEarFlickTimer = newTimer;
      }
    }
  }

  /** Apply sit tuck to a leg and its foot subtree (ankle/paw/toes). */
  private applySitLeg(
    boneStates: Record<string, BoneState>,
    prefix: string,
    upperRot: number, lowerRot: number, lowerOffY: number,
    sitEase: number,
  ): void {
    if (boneStates[`${prefix}-upper-leg`]) {
      boneStates[`${prefix}-upper-leg`].rotation += upperRot * sitEase;
    }
    if (boneStates[`${prefix}-lower-leg`]) {
      boneStates[`${prefix}-lower-leg`].rotation += lowerRot * sitEase;
      boneStates[`${prefix}-lower-leg`].offsetY += lowerOffY * sitEase;
    }
    // Foot subtree follows lower-leg
    const footParts = [`${prefix}-ankle`, `${prefix}-paw`,
      `${prefix}-toe-1`, `${prefix}-toe-2`, `${prefix}-toe-3`, `${prefix}-toe-4`];
    for (const name of footParts) {
      if (boneStates[name]) {
        boneStates[name].rotation += lowerRot * sitEase;
        boneStates[name].offsetY += lowerOffY * sitEase;
      }
    }
  }

  destroy(): void {
    // Reset all internal state — no external references to clean up
    this.idleTime = 0;
    this.isIdle = false;
    this.headTurnActive = false;
    this.isSitting = false;
    this.leftEarFlickProgress = 0;
    this.rightEarFlickProgress = 0;
  }
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
