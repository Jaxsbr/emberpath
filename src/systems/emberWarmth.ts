// EmberWarmthSystem (US-101) — single-axis state for the Briar Wilds trial.
// Drains in `drainZones`, restores in `quietZones`, hard-clamped at
// WARMTH_FLOOR so the ember never extinguishes (the design promise to a 6-12
// audience: this is not a fail state). Persisted via the existing flag store
// — but the in-memory value updates each frame while the persisted value only
// updates on epsilon-bounded changes (Learning EP-01: no per-frame localStorage
// IO).
//
// This first commit lands the foundation: constants, flag wiring,
// load-with-error-path, Reset Progress subscriber, getters for the F3 HUD.
// Drain/quiet zone overlap and visual binding land in subsequent tasks.

import Phaser from 'phaser';
import { getFlag, setFlag, onFlagChange } from '../triggers/flags';

export const WARMTH_MAX = 1.0;
export const WARMTH_FLOOR = 0.3;
export const WARMTH_DRAIN_PER_SECOND = 0.08;
export const WARMTH_RESTORE_PER_SECOND = 0.20;
export const WARMTH_WRITE_EPSILON = 0.005;

const FLAG_NAME = 'ember_warmth';

export type WarmthZoneState = 'drain' | 'quiet' | 'neutral';

let invalidWarnLogged = false;

export class EmberWarmthSystem {
  private currentWarmth: number = WARMTH_MAX;
  private lastPersistedWarmth: number = WARMTH_MAX;
  private currentZoneState: WarmthZoneState = 'neutral';
  private unsubscribers: Array<() => void> = [];

  constructor(private scene: Phaser.Scene) {
    // Reset hygiene (Learning EP-02): instance fields explicitly reset at top
    // of setup so a scene restart starts from a known state.
    this.currentWarmth = WARMTH_MAX;
    this.lastPersistedWarmth = WARMTH_MAX;
    this.currentZoneState = 'neutral';
    this.unsubscribers = [];

    // Load + validate. Mirrors saveState's scrub-on-corrupt pattern: any
    // non-number / non-finite / out-of-range value seeds back to MAX with a
    // once-per-session warn — no crash, no zero-radius / infinite-radius
    // overlay downstream.
    const raw = getFlag(FLAG_NAME);
    const validated = validateWarmthValue(raw);
    this.currentWarmth = validated;
    this.lastPersistedWarmth = validated;
    if (raw !== validated) {
      // Persist the corrected value so the next load is clean.
      setFlag(FLAG_NAME, validated);
      this.lastPersistedWarmth = validated;
    }

    // Reset Progress subscriber (Learning EP-02) — when the flag is wiped,
    // seed back to MAX in-memory; the next epsilon-crossing in update() will
    // re-persist it. Subscriber unsubscribe collected for shutdown cleanup.
    const unsub = onFlagChange(FLAG_NAME, (_name, value) => {
      if (value === undefined) {
        this.currentWarmth = WARMTH_MAX;
        this.lastPersistedWarmth = WARMTH_MAX;
        this.currentZoneState = 'neutral';
      }
    });
    this.unsubscribers.push(unsub);

    // Scene-level cleanup so a scene shutdown / restart releases all
    // subscriptions even if the owning scope forgets to call destroy().
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // No-op until drain/quiet zones are wired in subsequent tasks (US-102/103).
  // Foundation contract: signature stable so the GameScene update loop can
  // wire it up now without churn.
  update(_dt: number): void {
    // Future: read zone overlap, apply drain/restore at the configured rates,
    // clamp to [WARMTH_FLOOR, WARMTH_MAX], persist on epsilon-crossing.
  }

  getCurrentWarmth(): number {
    return this.currentWarmth;
  }

  getZoneState(): WarmthZoneState {
    return this.currentZoneState;
  }

  destroy(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
  }
}

function validateWarmthValue(raw: unknown): number {
  if (
    typeof raw !== 'number' ||
    !Number.isFinite(raw) ||
    raw < WARMTH_FLOOR ||
    raw > WARMTH_MAX
  ) {
    if (raw !== undefined && !invalidWarnLogged) {
      console.warn(
        `emberpath: ember_warmth invalid (${String(raw)}); seeding to WARMTH_MAX`,
      );
      invalidWarnLogged = true;
    }
    return WARMTH_MAX;
  }
  return raw;
}
