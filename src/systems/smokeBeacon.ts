import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/constants';
import { evaluateCondition } from './conditions';
import { onFlagChange } from '../triggers/flags';

// C6 — distant smoke beacon (2026-06-14, Issue #46). The opening promise is
// "Far away, smoke goes up into the sky. Someone is out there." and the objective
// is "Find the smoke." — but until now no smoke was ever visible in the playable
// world (only the nearby NPC glow). A first-time player told to "find the smoke"
// had nothing to actually look for. This rises a thin smoke plume from the water
// off the north dock — the literal far target. Paired with the dock signpost
// (C7), the wayfinding cluster reads cleanly: SEE the smoke across the water
// (the goal) → READ the sign "Dock → Fog Marsh" (the route) → take the dock.
//
// Renders on the UI camera (same treatment as the NPC presence glow), NOT the
// main camera: a beacon must stay legible, and the main camera's desaturation
// pass crushes a distant warm glow to near-nothing (verified — even an
// exaggerated plume barely read). Keeping it un-desaturated also lands the
// allegory: a fire still burning warm across the cold grey sea is *another soul's
// light* — "someone is out there". The base world position is projected to screen
// pixels every frame (world→screen via main-camera zoom + worldView), exactly
// like the NPC auras, so it stays pinned to its spot on the water as the player
// moves; when the player is far the plume simply projects off-screen.
//
// Idiom otherwise matches the ambient motes (Learning EP-01): a fixed pool of
// puffs mutated in place each frame, deterministic per-index variation
// (Math.random is unavailable here), no per-frame allocation.

const PUFF_TEX_KEY = 'smoke-puff';
const PUFF_TEX_SIZE = 48;
const GLOW_TEX_KEY = 'smoke-base-glow';
const GLOW_TEX_SIZE = 48;

// Depth on the UI camera — above nothing in particular, but kept below the
// objective banner / signpost labels / dialogue so guidance text always wins.
const SMOKE_DEPTH = 80;

const PUFF_COUNT = 16;
const RISE_SPEED = 22;                  // world px/s the plume climbs
const RISE_HEIGHT = 4.6 * TILE_SIZE;    // world px of travel before a puff recycles
const DRIFT_VX = 12;                     // world px of eastward lean over a full rise
const SWAY_AMP = 9;                      // world px lateral sway amplitude (grows with height)
const SWAY_SPEED = 0.55;                 // rad/s sway frequency
const PUFF_SIZE_MIN = 12;                // world px at the base
const PUFF_SIZE_MAX = 38;                // world px near the top (smoke spreads as it rises)
// The objective literally says "Find the smoke" — the puffs ARE the thing the
// player is told to look for, so they must read clearly as smoke, not a faint
// haze. Kept opaque enough to register against both the dark water/sky band the
// column rises into and the warmer dock light near its base.
const PUFF_ALPHA_MAX = 0.9;

const BASE_GLOW_SIZE = 1.7 * TILE_SIZE;  // world px
const BASE_GLOW_ALPHA = 0.7;
const BASE_PULSE_SPEED = 1.3;            // rad/s gentle fire flicker

// Glow-only (plume disabled) landmark mode (C13, Issue #59). Some areas need a
// distant warm light to walk TOWARD — a goal the cold player can aim at — without
// a smoke column that reads as "a fire/someone is here". Briar Wilds is the case:
// the trial ends in a clearing where "the thorns open up" and there is light
// ahead, so a standalone warm glow at that clearing IS the wayfinding payoff.
// With no plume above it the glow must read as a beacon on its own, so it sits a
// bit larger. UI-camera like the smoke, so it survives desaturation and is fully
// independent of the (deferred) real Briar tileset.
const GLOW_ONLY_SIZE = 2.6 * TILE_SIZE;  // world px

// Off-screen edge homing (C16, Issue #62). The opening objective is "Find the
// smoke" but the smoke beacon sits far north at the dock — from the spawn it
// projects OFF-SCREEN, so a cold first-time player told to find the smoke has
// nothing in view to walk toward (playtester complaint #1, "don't know where to
// go"). When the beacon's projected spot falls outside the viewport, the warm
// glow is clamped to the nearest screen edge as a homing light — always a warm
// point in the grey to walk toward — and the smoke plume is suppressed (its
// puffs would streak nonsensically off the edge). On-screen, nothing changes:
// the glow snaps back to the real world spot and the plume rises as before, so
// the cue resolves into the literal smoke column as the player nears the dock.
// Edge homing must be UNMISTAKABLE. A cold-judge playtest (session 25) found the
// first edge beacon too easy to miss: at spawn the player's OWN warm light pool
// dominates the eye, so a small faint corner glow read as "a tiny orange dot" and
// the child stayed lost for the critical first seconds. So the edge beacon is now
// large, bright, and carries a warm directional ARROW pointing off-screen toward
// the goal — "the light you want is that way, go." All UI-space (not zoom-scaled)
// so it reads at a constant, deliberate size regardless of camera zoom.
const EDGE_PAD = 40;                       // screen px inset from the viewport edge
const EDGE_GLOW_SIZE = 2.3 * TILE_SIZE;    // screen px (UI-space, not zoom-scaled)
const EDGE_GLOW_ALPHA = 0.95;              // brighter than the on-screen base glow
const EDGE_ARROW_SIZE = 1.1 * TILE_SIZE;   // screen px (chevron long axis)
const ARROW_TEX_KEY = 'smoke-edge-arrow';
const ARROW_TEX_SIZE = 32;

interface Puff {
  img: Phaser.GameObjects.Image;
  prog: number;    // 0 (base) .. 1 (top) — fraction of the rise completed
  speed: number;   // 0.7..1.0 per-puff rise multiplier
  xoff: number;    // small horizontal spawn jitter at the base (world px)
  phase: number;   // sway phase offset (0..2π)
}

export class SmokeBeaconSystem {
  private scene: Phaser.Scene;
  private baseX = 0;
  private baseY = 0;
  private puffs: Puff[] = [];
  private glow: Phaser.GameObjects.Image | null = null;
  // Directional chevron shown only while the beacon is off-screen — points from
  // the clamped edge toward the true (off-screen) goal so "go this way" is explicit.
  private arrow: Phaser.GameObjects.Image | null = null;
  private active = false;
  // When false the smoke plume is omitted and only the warm glow renders, as a
  // standalone "walk toward the light" landmark (glow-only mode, C13).
  private plume = true;
  // FB-20: once the beacon's goal is reached its objective is met, so it must
  // stop pointing at a target the player already found. `cleared` is the cached
  // result of the `clearedWhen` flag condition — re-evaluated only when a named
  // flag changes (allocation-free per frame), matching the objective banner's
  // subscribe-and-re-resolve idiom. When true, update() renders nothing.
  private clearedWhen: string | undefined;
  private cleared = false;
  private flagUnsubscribes: Array<() => void> = [];

  constructor(
    scene: Phaser.Scene,
    beacon: { col: number; row: number; plume?: boolean; clearedWhen?: string } | undefined,
  ) {
    this.scene = scene;
    if (!beacon) return;
    this.active = true;
    this.plume = beacon.plume !== false;
    this.clearedWhen = beacon.clearedWhen;
    this.baseX = beacon.col * TILE_SIZE + TILE_SIZE / 2;
    this.baseY = beacon.row * TILE_SIZE + TILE_SIZE / 2;
    this.ensureTextures();
    this.build();
    // Evaluate the clear condition on entry and subscribe to its flags so a
    // later flip (e.g. has_ember_mark granted in Fog Marsh, US-100) hides the
    // beacon without rebuilding the scene. Hide immediately if already met.
    this.subscribeCleared();
    this.cleared = this.clearedWhen ? evaluateCondition(this.clearedWhen) : false;
    if (this.cleared) this.applyCleared();
  }

  // Subscribe to every flag named in `clearedWhen` (same flag-name extraction the
  // GameScene objective/decoration subscribers use). On any change, re-evaluate
  // the condition; when it newly holds, hide the beacon for good.
  private subscribeCleared(): void {
    if (!this.clearedWhen) return;
    const flagNameRe = /\b([a-z_][a-z0-9_]*)\s*(?:==|!=|>=|>|<=|<)/gi;
    const flagNames = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = flagNameRe.exec(this.clearedWhen)) !== null) {
      flagNames.add(match[1]);
    }
    for (const name of flagNames) {
      this.flagUnsubscribes.push(
        onFlagChange(name, () => {
          if (this.cleared || !this.clearedWhen) return;
          if (evaluateCondition(this.clearedWhen)) {
            this.cleared = true;
            this.applyCleared();
          }
        }),
      );
    }
  }

  // Park every visual hidden once the goal is reached. update() early-returns
  // while cleared, so nothing is touched again.
  private applyCleared(): void {
    this.glow?.setVisible(false);
    this.arrow?.setVisible(false);
    for (const p of this.puffs) p.img.setVisible(false);
  }

  // Deterministic pseudo-random in [0,1) from an integer seed (same trick the
  // motes / NPC auras use — Math.random isn't deterministic/available here).
  private rand(seed: number): number {
    const s = Math.sin(seed * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  private ensureTextures(): void {
    if (this.plume && !this.scene.textures.exists(PUFF_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(PUFF_TEX_KEY, PUFF_TEX_SIZE, PUFF_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = PUFF_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        // Soft pale smoke.
        g.addColorStop(0.0, 'rgba(226,228,234,0.95)');
        g.addColorStop(0.55, 'rgba(198,200,208,0.5)');
        g.addColorStop(1.0, 'rgba(178,180,190,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, PUFF_TEX_SIZE, PUFF_TEX_SIZE);
        canvas.refresh();
      }
    }
    if (!this.scene.textures.exists(GLOW_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(GLOW_TEX_KEY, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        const c = GLOW_TEX_SIZE / 2;
        const g = ctx.createRadialGradient(c, c, 0, c, c, c);
        // Warm ember core — the unseen someone's fire.
        g.addColorStop(0.0, 'rgba(255,198,122,1)');
        g.addColorStop(0.5, 'rgba(255,150,70,0.55)');
        g.addColorStop(1.0, 'rgba(220,110,50,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
        canvas.refresh();
      }
    }
    // Warm chevron for the off-screen edge homing arrow. Drawn pointing +x (right)
    // at rotation 0; the update loop rotates it to the live goal direction.
    if (!this.scene.textures.exists(ARROW_TEX_KEY)) {
      const canvas = this.scene.textures.createCanvas(ARROW_TEX_KEY, ARROW_TEX_SIZE, ARROW_TEX_SIZE);
      if (canvas) {
        const ctx = canvas.getContext();
        ctx.fillStyle = 'rgba(255,196,116,1)';
        ctx.beginPath();
        ctx.moveTo(ARROW_TEX_SIZE - 3, ARROW_TEX_SIZE / 2); // apex (right)
        ctx.lineTo(7, 5);
        ctx.lineTo(7, ARROW_TEX_SIZE - 5);
        ctx.closePath();
        ctx.fill();
        canvas.refresh();
      }
    }
  }

  private build(): void {
    // Warm fire glow at the base. ADD-blended so it reads as light, not paint.
    this.glow = this.scene.add.image(this.baseX, this.baseY, GLOW_TEX_KEY);
    this.glow.setOrigin(0.5, 0.5);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setDepth(SMOKE_DEPTH);
    this.glow.setAlpha(BASE_GLOW_ALPHA);
    // UI-camera object: the main camera must NOT draw it (would render a
    // desaturated copy underneath). Absent from the UI ignore list, so the UI
    // camera renders it — same rule the NPC presence glow follows.
    this.scene.cameras.main.ignore(this.glow);

    // Edge homing arrow — created in both plume and glow-only modes (every beacon
    // can fall off-screen). Hidden until the beacon projects outside the viewport.
    this.arrow = this.scene.add.image(this.baseX, this.baseY, ARROW_TEX_KEY);
    this.arrow.setOrigin(0.5, 0.5);
    this.arrow.setBlendMode(Phaser.BlendModes.ADD);
    this.arrow.setDepth(SMOKE_DEPTH + 1); // above its glow
    this.arrow.setAlpha(0);
    this.arrow.setVisible(false);
    this.scene.cameras.main.ignore(this.arrow);

    // Glow-only landmark: no smoke column, so the rising-puff pool is skipped.
    if (!this.plume) return;

    // Pool of rising puffs, staggered along the rise so the column is continuous.
    for (let i = 0; i < PUFF_COUNT; i++) {
      const img = this.scene.add.image(this.baseX, this.baseY, PUFF_TEX_KEY);
      img.setOrigin(0.5, 0.5);
      img.setDepth(SMOKE_DEPTH);
      this.scene.cameras.main.ignore(img);
      this.puffs.push({
        img,
        prog: i / PUFF_COUNT, // even spacing up the column at start
        speed: 0.7 + this.rand(i * 5 + 3) * 0.3,
        xoff: (this.rand(i * 2 + 1) - 0.5) * (TILE_SIZE * 0.5),
        phase: this.rand(i * 7 + 4) * Math.PI * 2,
      });
    }
  }

  // Advance the plume and project it from its fixed world spot to screen pixels.
  // Each puff climbs, spreads, leans, and fades; on reaching the top it recycles
  // to the base with a fresh jitter. No allocation in the loop.
  update(timeMs: number, deltaMs: number): void {
    if (!this.active || this.cleared) return;
    const cam = this.scene.cameras.main;
    if (!cam) return;
    const zoom = cam.zoom;
    const viewCx = cam.worldView.centerX;
    const viewCy = cam.worldView.centerY;
    const halfW = cam.width * 0.5;
    const halfH = cam.height * 0.5;
    // Base position in screen pixels.
    const baseSX = (this.baseX - viewCx) * zoom + halfW;
    const baseSY = (this.baseY - viewCy) * zoom + halfH;

    // Off-screen edge homing: if the beacon's spot projects outside the viewport,
    // the glow rides the nearest edge (clamped, padded) and the plume is hidden.
    const w = cam.width;
    const h = cam.height;
    const offscreen = baseSX < 0 || baseSX > w || baseSY < 0 || baseSY > h;
    const edgeSX = Math.min(Math.max(baseSX, EDGE_PAD), w - EDGE_PAD);
    const edgeSY = Math.min(Math.max(baseSY, EDGE_PAD), h - EDGE_PAD);

    const t = timeMs * 0.001;
    const dt = deltaMs * 0.001;
    const step = (RISE_SPEED / RISE_HEIGHT) * dt;

    for (const p of this.puffs) {
      p.prog += step * p.speed;
      if (p.prog >= 1) {
        p.prog -= 1;
        p.xoff = (this.rand((t * 1000) | (p.phase * 97)) - 0.5) * (TILE_SIZE * 0.5);
      }
      const prog = p.prog;
      const sway = Math.sin(t * SWAY_SPEED + p.phase) * SWAY_AMP * prog;
      // World-space offsets from the base, scaled to screen by zoom.
      const sx = baseSX + (p.xoff + DRIFT_VX * prog + sway) * zoom;
      const sy = baseSY - prog * RISE_HEIGHT * zoom;
      // Quick fade-in off the base, then thin out toward the top.
      const alpha = PUFF_ALPHA_MAX * Math.min(1, prog * 6) * (1 - prog);
      const size = (PUFF_SIZE_MIN + (PUFF_SIZE_MAX - PUFF_SIZE_MIN) * prog) * zoom;
      p.img.setPosition(sx, sy);
      p.img.setDisplaySize(size, size);
      // Suppress the plume entirely while the beacon is off-screen — only the
      // edge-clamped homing glow should show in that case.
      p.img.setAlpha(offscreen ? 0 : alpha);
    }

    if (this.glow) {
      if (offscreen) {
        // Edge homing light: large + bright, parked at the clamped edge so it wins
        // the eye against the player's own glow pool.
        const flick = 0.85 + 0.15 * Math.sin(t * BASE_PULSE_SPEED);
        this.glow.setPosition(edgeSX, edgeSY);
        this.glow.setDisplaySize(EDGE_GLOW_SIZE, EDGE_GLOW_SIZE);
        this.glow.setAlpha(EDGE_GLOW_ALPHA * flick);
      } else {
        const glowSize = (this.plume ? BASE_GLOW_SIZE : GLOW_ONLY_SIZE) * zoom;
        this.glow.setPosition(baseSX, baseSY);
        this.glow.setDisplaySize(glowSize, glowSize);
        this.glow.setAlpha(BASE_GLOW_ALPHA * (0.78 + 0.22 * Math.sin(t * BASE_PULSE_SPEED)));
      }
    }

    if (this.arrow) {
      if (offscreen) {
        // Point the chevron from the clamped edge toward the true (off-screen)
        // beacon spot. The texture's apex is drawn pointing +x; the +π term is the
        // empirically-verified offset (cold-judge session 25, arrow-crop) that
        // makes the apex face the goal rather than back into the screen.
        const ang = Math.atan2(baseSY - halfH, baseSX - halfW) + Math.PI;
        this.arrow.setPosition(edgeSX, edgeSY);
        this.arrow.setRotation(ang);
        this.arrow.setDisplaySize(EDGE_ARROW_SIZE, EDGE_ARROW_SIZE);
        this.arrow.setAlpha(EDGE_GLOW_ALPHA * (0.9 + 0.1 * Math.sin(t * BASE_PULSE_SPEED)));
        this.arrow.setVisible(true);
      } else if (this.arrow.visible) {
        this.arrow.setVisible(false);
      }
    }
  }

  destroy(): void {
    for (const unsub of this.flagUnsubscribes) unsub();
    this.flagUnsubscribes = [];
    for (const p of this.puffs) p.img.destroy();
    this.puffs = [];
    this.glow?.destroy();
    this.glow = null;
    this.arrow?.destroy();
    this.arrow = null;
    this.active = false;
  }
}
