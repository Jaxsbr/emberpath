// Audio layer — the MANAGER (F5, #200). Holds the live audio state (which bed is
// playing, muted or not, footstep cadence, first-time gates) and turns model
// decisions into backend calls. It is deliberately framework-free and synchronous
// so it is fully node-testable with a fake backend; the only thing that actually
// makes sound is the injected AudioBackend (WebAudio in the browser).
//
// CRITICAL: this is a MODULE-LEVEL SINGLETON living OUTSIDE the Phaser scene graph.
// Area transitions restart the whole GameScene (which would destroy any scene-owned
// sound), so the music bed must outlive the scene — exactly like src/triggers/flags.ts,
// the other cross-restart singleton. Scenes call into getAudio(); they never own it.

import {
  MUSIC_VOLUME,
  SFX_VOLUME,
  FOOTSTEP_VOLUME,
  THOUGHT_VOLUME,
  THOUGHT_COOLDOWN_MS,
  CROSSFADE_MS,
  FootstepThrottle,
  Cooldown,
  OnceGate,
  musicKeyForArea,
  planMusicChange,
  npcFootstepVolume,
} from './audioModel';

// The browser implements this with Web Audio; tests implement it with a recorder.
// Nothing here knows or cares which.
export interface AudioBackend {
  /** Make sure a key's buffer/element is ready (idempotent). */
  ensureLoaded(key: string): void;
  /** Begin looping a music track at the given volume (0..1). */
  startMusic(key: string, volume: number): void;
  /** Ramp a music track's volume to `to` over `ms`. */
  fadeMusic(key: string, to: number, ms: number): void;
  /** Stop and release a music track. */
  stopMusic(key: string): void;
  /** Fire a one-shot SFX at the given volume. */
  playOneShot(key: string, volume: number): void;
}

export interface AudioManagerOptions {
  muted?: boolean;
}

export class AudioManager {
  private currentMusicKey: string | null = null;
  private muted: boolean;
  private readonly footsteps = new FootstepThrottle();
  // One cadence throttle per NPC, lazily created — each NPC strides on its own clock.
  private readonly npcFootsteps = new Map<string, FootstepThrottle>();
  private readonly thoughtChime = new Cooldown(THOUGHT_COOLDOWN_MS);
  private readonly firstInteractions = new OnceGate();
  private readonly milestones = new OnceGate();

  constructor(
    private readonly backend: AudioBackend,
    opts: AudioManagerOptions = {},
  ) {
    this.muted = opts.muted ?? false;
  }

  // ---- Music -------------------------------------------------------------

  /** Tell the manager which area is now active; crossfades the bed if it changed. */
  setArea(areaId: string): void {
    const next = musicKeyForArea(areaId);
    const plan = planMusicChange(this.currentMusicKey, next);
    if (plan.noop) return;

    if (plan.fadeOut) {
      this.backend.fadeMusic(plan.fadeOut, 0, CROSSFADE_MS);
      this.backend.stopMusic(plan.fadeOut);
    }
    if (plan.fadeIn) {
      this.backend.ensureLoaded(plan.fadeIn);
      this.backend.startMusic(plan.fadeIn, 0);
      this.backend.fadeMusic(plan.fadeIn, this.muted ? 0 : MUSIC_VOLUME, CROSSFADE_MS);
    }
    this.currentMusicKey = next;
  }

  // ---- Mute --------------------------------------------------------------

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    if (this.currentMusicKey) {
      this.backend.fadeMusic(this.currentMusicKey, muted ? 0 : MUSIC_VOLUME, 250);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  // ---- SFX ---------------------------------------------------------------

  /** Fire a one-shot SFX (no-op while muted). */
  sfx(key: string, volume: number = SFX_VOLUME): void {
    if (this.muted) return;
    this.backend.playOneShot(key, volume);
  }

  /**
   * Footstep tick — call every frame with (now, isMoving). Returns true if a step
   * actually fired (handy for tests / NPC reuse). Gated by cadence AND mute.
   */
  footstep(nowMs: number, isMoving: boolean): boolean {
    if (!this.footsteps.step(nowMs, isMoving)) return false;
    if (this.muted) return false;
    this.backend.playOneShot('sfx-footstep', FOOTSTEP_VOLUME);
    return true;
  }

  resetFootstepCadence(): void {
    this.footsteps.reset();
    this.npcFootsteps.clear();
  }

  /**
   * NPC footstep tick (FB-25) — call each frame for every NPC that is actually
   * walking, with its distance (px) from Pip. Each NPC has its own cadence throttle;
   * the volume scales down with distance and is hard-capped UNDER Pip's own footstep,
   * so a nearby walker is heard faintly and a far one not at all. No-op while muted,
   * off-cadence, or out of hearing range. Returns true if a step actually fired.
   */
  npcFootstep(npcId: string, distancePx: number, nowMs: number): boolean {
    let throttle = this.npcFootsteps.get(npcId);
    if (!throttle) {
      throttle = new FootstepThrottle();
      this.npcFootsteps.set(npcId, throttle);
    }
    if (!throttle.step(nowMs, true)) return false;
    if (this.muted) return false;
    const volume = npcFootstepVolume(distancePx);
    if (volume <= 0) return false;
    this.backend.playOneShot('sfx-footstep', volume);
    return true;
  }

  /**
   * Thought chime (FB-25) — call when a thought bubble appears. A leading-edge
   * cooldown debounces bursts: a flurry of thoughts in close succession plays at
   * most one soft chime. No-op while muted. Returns true if it actually chimed.
   */
  thought(nowMs: number): boolean {
    if (!this.thoughtChime.request(nowMs)) return false;
    if (this.muted) return false;
    this.backend.playOneShot('sfx-thought', THOUGHT_VOLUME);
    return true;
  }

  /** First-time interaction sound for an NPC; fires (and returns true) only once per id. */
  firstInteraction(npcId: string): boolean {
    if (!this.firstInteractions.fire(npcId)) return false;
    this.sfx('sfx-first-meet');
    return true;
  }

  /** A milestone chime that should sound only the first time its event fires. */
  milestone(id: string, sfxKey: string = 'sfx-milestone'): boolean {
    if (!this.milestones.fire(id)) return false;
    this.sfx(sfxKey);
    return true;
  }
}
