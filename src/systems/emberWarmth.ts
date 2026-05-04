// EmberWarmthSystem (US-101) — single-axis state for the Briar Wilds trial.
// Drains in `drainZones`, restores in `quietZones`, hard-clamped at
// WARMTH_FLOOR so the ember never extinguishes (the design promise to a 6-12
// audience: this is not a fail state). Persisted via the existing flag store
// — but the in-memory value updates each frame while the persisted value only
// updates on epsilon-bounded changes (Learning EP-01: no per-frame localStorage
// IO).
//
// Zone consumption (US-102 / US-103) — drain/quiet zones are passed in as
// constructor parameters (no global imports). Per-frame overlap check is O(1)
// per zone with zero allocations: the player position arrives as primitive
// numbers via update(dt, x, y) and rectangle overlap is plain arithmetic.

import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import {
  DrainZoneDefinition,
  QuietZoneDefinition,
} from '../data/areas/types';
import { getFlag, setFlag, incrementFlag, onFlagChange } from '../triggers/flags';

export const WARMTH_MAX = 1.0;
export const WARMTH_FLOOR = 0.3;
export const WARMTH_DRAIN_PER_SECOND = 0.08;
export const WARMTH_RESTORE_PER_SECOND = 0.20;
export const WARMTH_WRITE_EPSILON = 0.005;
// Quiet-zone tier-2 light defaults (US-103). Sized to clearly read as a
// warm pocket of grace once the Ember is carried — slightly larger than a
// per-NPC tier-1 baseline (40 px) so a small clearing reads as a destination,
// not a single-NPC bubble.
export const QUIET_ZONE_LIGHT_RADIUS = 72;
export const QUIET_ZONE_LIGHT_INTENSITY = 0.55;

const FLAG_NAME = 'ember_warmth';

export type WarmthZoneState = 'drain' | 'quiet' | 'neutral';

// Thought-bubble queue interface — minimal so the system depends on the
// behaviour, not the concrete ThoughtBubbleSystem class. GameScene wires the
// real one in; tests can pass a stub.
export interface ThoughtBubbleQueue {
  show(request: { text: string; duration?: number }): void;
}

// Lighting registry interface — same minimal-decoupling pattern as the
// thought-bubble queue. EmberWarmthSystem registers a tier-2 light at each
// quiet zone's centre (US-103) so the clearings bloom as warm pockets once
// the player carries the Ember (existing tier-2 mechanism in LightingSystem).
export interface LightRegistry {
  registerLight(light: {
    id: string;
    x: number;
    y: number;
    radius: number;
    intensity: number;
    tier: 1 | 2;
  }): void;
  unregisterLight(id: string): void;
}

let invalidWarnLogged = false;
const zoneWarnLogged: Set<string> = new Set();

export class EmberWarmthSystem {
  private currentWarmth: number = WARMTH_MAX;
  private lastPersistedWarmth: number = WARMTH_MAX;
  private currentZoneState: WarmthZoneState = 'neutral';
  // Per-zone occupancy — tracked so entry-transition events (outside → inside)
  // can fire doubt/narration exactly once per crossing. Zero per-frame
  // allocation: Map.set/get on existing keys (Learning EP-01).
  private wasInsideDrain: Map<string, boolean> = new Map();
  private wasInsideQuiet: Map<string, boolean> = new Map();
  private validDrainZones: DrainZoneDefinition[] = [];
  private validQuietZones: QuietZoneDefinition[] = [];
  private unsubscribers: Array<() => void> = [];
  // Registered tier-2 light ids (one per valid quiet zone). Stored so destroy
  // can unregister them — defense-in-depth alongside scene-shutdown lighting
  // cleanup, so a future scenario where the warmth system is rebuilt without
  // a full scene restart can't leak lights.
  private registeredLightIds: string[] = [];

  constructor(
    private scene: Phaser.Scene,
    drainZones: DrainZoneDefinition[] | undefined,
    quietZones: QuietZoneDefinition[] | undefined,
    private thoughtBubble: ThoughtBubbleQueue | null,
    private worldCols: number,
    private worldRows: number,
    private lighting: LightRegistry | null = null,
  ) {
    // Reset hygiene (Learning EP-02): instance fields explicitly reset at top
    // of setup so a scene restart starts from a known state.
    this.currentWarmth = WARMTH_MAX;
    this.lastPersistedWarmth = WARMTH_MAX;
    this.currentZoneState = 'neutral';
    this.wasInsideDrain = new Map();
    this.wasInsideQuiet = new Map();
    this.validDrainZones = [];
    this.validQuietZones = [];
    this.unsubscribers = [];
    this.registeredLightIds = [];

    // Filter zones to those with valid in-bounds coordinates and positive
    // dimensions. Authoring errors (out-of-grid coords, zero/negative size)
    // skip with a once-per-zone-id warn — area still loads, other zones
    // still function (no crash on author error).
    this.validDrainZones = (drainZones ?? []).filter((z) =>
      this.isZoneValid(z, 'drain'),
    );
    this.validQuietZones = (quietZones ?? []).filter((z) =>
      this.isZoneValid(z, 'quiet'),
    );

    // US-103 — auto-register a tier-2 light at each quiet zone's centre. The
    // existing tier-2 mechanism in LightingSystem renders these at intensity 0
    // pre-Ember and at full intensity post-Ember, so the clearings only bloom
    // once the player carries the Ember (matching the design vocabulary: light
    // = grace, revealed by the Ember). Constants live in the system so a
    // future area-author override could supply per-zone radius/intensity
    // without touching emberWarmth.ts.
    if (this.lighting) {
      for (let i = 0; i < this.validQuietZones.length; i++) {
        const z = this.validQuietZones[i];
        const cx = (z.col + z.width / 2) * TILE_SIZE;
        const cy = (z.row + z.height / 2) * TILE_SIZE;
        const id = `quiet:${z.id}`;
        this.lighting.registerLight({
          id,
          x: cx,
          y: cy,
          radius: QUIET_ZONE_LIGHT_RADIUS,
          intensity: QUIET_ZONE_LIGHT_INTENSITY,
          tier: 2,
        });
        this.registeredLightIds.push(id);
      }
    }

    // Load + validate. Mirrors saveState's scrub-on-corrupt pattern: any
    // non-number / non-finite / out-of-range value seeds back to MAX with a
    // once-per-session warn — no crash, no zero-radius / infinite-radius
    // overlay downstream.
    const raw = getFlag(FLAG_NAME);
    const validated = validateWarmthValue(raw);
    this.currentWarmth = validated;
    this.lastPersistedWarmth = validated;
    if (raw !== validated) {
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

  // Per-frame update — applies drain/restore based on zone overlap and fires
  // entry-transition events. dt is in seconds. Player position in pixels.
  update(dt: number, playerX: number, playerY: number): void {
    // Drain + quiet overlap precedence: quiet wins (US-103 — grace stronger
    // than trial). Walk both zone lists; track current-frame inside states.
    let inDrain = false;
    let drainRate = 0;
    let inQuiet = false;
    let restoreRate = 0;

    for (let i = 0; i < this.validDrainZones.length; i++) {
      const z = this.validDrainZones[i];
      const inside = pointInZoneTiles(playerX, playerY, z.col, z.row, z.width, z.height);
      const wasInside = this.wasInsideDrain.get(z.id) === true;
      this.wasInsideDrain.set(z.id, inside);
      if (inside) {
        inDrain = true;
        drainRate = WARMTH_DRAIN_PER_SECOND * (z.drainMultiplier ?? 1);
        if (!wasInside) {
          // Entry transition — increment doubt counter and queue the next line.
          if (z.doubts && z.doubts.lines.length > 0) {
            const flagName = `doubt_count_${z.id}`;
            incrementFlag(flagName);
            const count = getFlag(flagName);
            const idx = typeof count === 'number' ? (count - 1) % z.doubts.lines.length : 0;
            this.thoughtBubble?.show({ text: z.doubts.lines[idx] });
          }
        }
      }
    }

    for (let i = 0; i < this.validQuietZones.length; i++) {
      const z = this.validQuietZones[i];
      const inside = pointInZoneTiles(playerX, playerY, z.col, z.row, z.width, z.height);
      const wasInside = this.wasInsideQuiet.get(z.id) === true;
      this.wasInsideQuiet.set(z.id, inside);
      if (inside) {
        inQuiet = true;
        restoreRate = WARMTH_RESTORE_PER_SECOND * (z.restoreMultiplier ?? 1);
        if (!wasInside) {
          // First-entry narration — one-shot per zone via quiet_seen_<id>.
          const flagName = `quiet_seen_${z.id}`;
          if (getFlag(flagName) !== true && z.narration && z.narration.lines.length > 0) {
            for (let li = 0; li < z.narration.lines.length; li++) {
              this.thoughtBubble?.show({ text: z.narration.lines[li] });
            }
            setFlag(flagName, true);
          }
        }
      }
    }

    // Apply rates — quiet wins.
    let next = this.currentWarmth;
    if (inQuiet) {
      next += restoreRate * dt;
      this.currentZoneState = 'quiet';
    } else if (inDrain) {
      next -= drainRate * dt;
      this.currentZoneState = 'drain';
    } else {
      this.currentZoneState = 'neutral';
    }
    if (next < WARMTH_FLOOR) next = WARMTH_FLOOR;
    if (next > WARMTH_MAX) next = WARMTH_MAX;
    this.currentWarmth = next;

    // Persist only on epsilon-crossing (Learning EP-01 — no per-frame IO).
    const diff = this.currentWarmth - this.lastPersistedWarmth;
    if (diff > WARMTH_WRITE_EPSILON || diff < -WARMTH_WRITE_EPSILON) {
      setFlag(FLAG_NAME, this.currentWarmth);
      this.lastPersistedWarmth = this.currentWarmth;
    }
  }

  getCurrentWarmth(): number {
    return this.currentWarmth;
  }

  getZoneState(): WarmthZoneState {
    return this.currentZoneState;
  }

  // Exposed for F3 debug overlay rendering of zone rectangles.
  getDrainZones(): readonly DrainZoneDefinition[] {
    return this.validDrainZones;
  }
  getQuietZones(): readonly QuietZoneDefinition[] {
    return this.validQuietZones;
  }

  destroy(): void {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    if (this.lighting) {
      for (let i = 0; i < this.registeredLightIds.length; i++) {
        this.lighting.unregisterLight(this.registeredLightIds[i]);
      }
    }
    this.registeredLightIds = [];
  }

  // Wire the thought-bubble queue post-construction (GameScene constructs the
  // warmth system before the bubble; this setter closes the gap without
  // requiring construction-order coupling).
  setThoughtBubble(bubble: ThoughtBubbleQueue | null): void {
    this.thoughtBubble = bubble;
  }

  private isZoneValid(
    z: DrainZoneDefinition | QuietZoneDefinition,
    kind: 'drain' | 'quiet',
  ): boolean {
    const ok =
      Number.isFinite(z.col) &&
      Number.isFinite(z.row) &&
      Number.isFinite(z.width) &&
      Number.isFinite(z.height) &&
      z.width > 0 &&
      z.height > 0 &&
      z.col >= 0 &&
      z.row >= 0 &&
      z.col + z.width <= this.worldCols &&
      z.row + z.height <= this.worldRows;
    if (!ok) {
      const key = `${kind}:${z.id}`;
      if (!zoneWarnLogged.has(key)) {
        console.warn(
          `emberpath: skipping invalid ${kind} zone '${z.id}' — out-of-bounds or non-positive dimensions`,
        );
        zoneWarnLogged.add(key);
      }
    }
    return ok;
  }
}

// Rectangle overlap in tile coordinates. Player position is in pixels; we
// divide by TILE_SIZE to get the tile-space coordinate. Zero allocation.
function pointInZoneTiles(
  px: number,
  py: number,
  col: number,
  row: number,
  width: number,
  height: number,
): boolean {
  const tx = px / TILE_SIZE;
  const ty = py / TILE_SIZE;
  return tx >= col && tx < col + width && ty >= row && ty < row + height;
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
