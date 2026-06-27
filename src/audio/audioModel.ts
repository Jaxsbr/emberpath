// Audio layer — the PURE model (F5, #200). No Web Audio, no HTMLAudio, no Phaser:
// just the decisions. Which track plays for which map, how a crossfade is planned,
// the footstep cadence, the once-only gates. This runs under the node (no-jsdom)
// vitest env so every audio DECISION is pinned by a test; the browser backend
// (src/audio/webAudioBackend.ts) is the dumb half that actually makes sound.
//
// Direction LOCKED by Jaco (#1254): soft storybook bed per map, faint by default,
// fade on transition, a persisted mute toggle. See docs/solutions/... and #200.

/** Faint-by-default music bed level (0..1). Subtle under the storybook, never loud. */
export const MUSIC_VOLUME = 0.32;
/** Default one-shot SFX level. */
export const SFX_VOLUME = 0.5;
/** Footsteps sit well under everything — a soft scuff, not a stomp. */
export const FOOTSTEP_VOLUME = 0.16;
/** Typewriter scribble is the faintest thing in the mix. */
export const SCRIBBLE_VOLUME = 0.12;
/** Minimum ms between footstep ticks while moving. */
export const FOOTSTEP_INTERVAL_MS = 300;
/** Crossfade length on a map transition (ms). Matches the camera fade feel. */
export const CROSSFADE_MS = 1100;
/** Soft thought chime — a faint twinkle, sits just over the footstep, under SFX. */
export const THOUGHT_VOLUME = 0.22;
/** Quiet gap a thought chime needs before it can sound again — debounces bursts. */
export const THOUGHT_COOLDOWN_MS = 900;
/** Past this distance (px) from Pip an NPC's footsteps are inaudible (~6 tiles). */
export const NPC_FOOTSTEP_RANGE_PX = 200;
/** NPC footsteps top out BELOW Pip's own — hers must never be overpowered (FB-25). */
export const NPC_FOOTSTEP_MAX_VOLUME = FOOTSTEP_VOLUME * 0.8;

/**
 * Volume for an NPC footstep heard `distancePx` away from Pip. Quadratic falloff so
 * it fades quickly with distance, zero past the hearing range, and ALWAYS capped
 * under Pip's own footstep level (Jaco FB-25: "never louder than pip's walking sfx").
 */
export function npcFootstepVolume(distancePx: number): number {
  if (distancePx >= NPC_FOOTSTEP_RANGE_PX) return 0;
  if (distancePx <= 0) return NPC_FOOTSTEP_MAX_VOLUME;
  const t = 1 - distancePx / NPC_FOOTSTEP_RANGE_PX; // 1 near → 0 at the range edge
  return NPC_FOOTSTEP_MAX_VOLUME * t * t;
}

/** One soft bed per map — each its own mood (Jaco #1254 music=a). */
export const MUSIC_BY_AREA: Record<string, string> = {
  'ashen-isle': 'music-ashen-isle',
  'fog-marsh': 'music-fog-marsh',
  'briar-wilds': 'music-briar-wilds',
  'heart-bridge': 'music-heart-bridge',
};

/** The music track key for an area, or null if the area has no bed (just silence). */
export function musicKeyForArea(areaId: string): string | null {
  return MUSIC_BY_AREA[areaId] ?? null;
}

export interface CrossfadePlan {
  /** Track to fade out (null if nothing was playing or it's a no-op). */
  fadeOut: string | null;
  /** Track to fade in (null when moving to a silent area). */
  fadeIn: string | null;
  /** True when the requested track is already the one playing — do nothing. */
  noop: boolean;
}

// The crossfade planner is deliberately tiny and pure. The single most important
// property: re-requesting the track that is already playing is a NO-OP. Area
// transitions restart the whole Phaser scene (GameScene.transitionToArea), so the
// manager is told the area again on every restart — without this, the bed would
// stutter/restart every reload. It must not.
export function planMusicChange(
  currentKey: string | null,
  nextKey: string | null,
): CrossfadePlan {
  if (currentKey === nextKey) {
    return { fadeOut: null, fadeIn: null, noop: true };
  }
  return { fadeOut: currentKey, fadeIn: nextKey, noop: false };
}

// Footstep cadence. Fires once on the first moving frame, then gates by interval.
// Standing still never fires, and a real pause (reset) lets the next stride land
// immediately rather than waiting out a stale interval.
export class FootstepThrottle {
  private last = Number.NEGATIVE_INFINITY;
  constructor(private readonly intervalMs: number = FOOTSTEP_INTERVAL_MS) {}

  step(nowMs: number, isMoving: boolean): boolean {
    if (!isMoving) return false;
    if (nowMs - this.last >= this.intervalMs) {
      this.last = nowMs;
      return true;
    }
    return false;
  }

  reset(): void {
    this.last = Number.NEGATIVE_INFINITY;
  }
}

// A leading-edge "can play again" gate (FB-25 thought chime). The first request
// fires immediately and arms the cooldown; any request inside the window is
// suppressed AND pushes the window forward (refresh), so a burst of thoughts in
// close succession yields exactly ONE chime and never machine-guns. It recovers on
// its own once requests stop for `cooldownMs` — no permanent starvation.
export class Cooldown {
  private readyAt = Number.NEGATIVE_INFINITY;
  constructor(private readonly cooldownMs: number) {}

  request(nowMs: number): boolean {
    if (nowMs >= this.readyAt) {
      this.readyAt = nowMs + this.cooldownMs;
      return true;
    }
    // Inside the window: suppress, and refresh so a rapid burst stays quiet.
    this.readyAt = nowMs + this.cooldownMs;
    return false;
  }

  reset(): void {
    this.readyAt = Number.NEGATIVE_INFINITY;
  }
}

// A set-backed "fire once per id" gate — first-time NPC interaction sounds, and any
// milestone that should chime only the first time its flag flips.
export class OnceGate {
  private readonly seen = new Set<string>();

  fire(id: string): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }
}
