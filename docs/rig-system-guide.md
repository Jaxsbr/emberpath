# Rig System Implementor Guide

This guide covers everything needed to create new characters, author direction profiles, tune animations, and replace placeholder art in the EmberPath character rig system.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  RigDefinition   │────▶│  CharacterRig     │────▶│  Container(Sprites) │
│  (pure data)     │     │  (engine class)   │     │  (Phaser objects)   │
└─────────────────┘     └────────┬─────────┘     └────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ DirectionProfile│     │ AnimationController│     │ AnimationController│
│ → setDirection()│     │ (WalkRunController)│     │ (IdleController)   │
└───────────────┘     │ → update()        │     │ → update()        │
                      └──────────────────┘     └──────────────────┘
```

**Data flow:**
1. A `RigDefinition` (pure data object) describes a character: skeleton, direction profiles, animation parameters
2. `CharacterRig` reads the definition, creates a Phaser `Container` with child `Sprite` objects from a texture atlas
3. `setDirection(dir)` applies a `DirectionProfile` to position/scale/rotate/show/hide each sprite
4. `update(delta)` calls each registered `AnimationController`, which mutates `BoneState` records
5. After all controllers run, `CharacterRig` applies the accumulated bone states on top of the direction profile

**Key files:**
- `src/rig/types.ts` — All type definitions (`RigDefinition`, `DirectionProfile`, `BoneDefinition`, `AnimationController`, etc.)
- `src/rig/CharacterRig.ts` — Engine class that manages the container, sprites, direction profiles, and animation updates
- `src/rig/characters/fox.ts` — Fox (Pip) rig definition
- `src/rig/animations/walkRun.ts` — Walk/run procedural animation controller
- `src/rig/animations/idle.ts` — Idle animation controller (breathing, tail sway, head turn, sit, ear flick)

## Bone Hierarchy Model

Characters are defined as a tree of `BoneDefinition` nodes. Each bone corresponds to one sprite in the texture atlas.

```typescript
interface BoneDefinition {
  name: string;           // Must match a frame name in the atlas
  children?: BoneDefinition[];
}
```

The fox skeleton:
```
body
├── head
│   ├── snout
│   ├── left-ear
│   └── right-ear
├── tail-1
│   └── tail-2
│       └── tail-3
├── front-left-upper-leg
│   └── front-left-lower-leg
├── front-right-upper-leg
│   └── front-right-lower-leg
├── back-left-upper-leg
│   └── back-left-lower-leg
└── back-right-upper-leg
    └── back-right-lower-leg
```

The hierarchy is currently used for organization — sprites are positioned independently via direction profiles, not relative to parent bones. Future versions may add parent-relative transforms.

## Direction Profile Authoring

Use the **editor's Rig tab** (`cd tools/editor && npm run dev`, then click the "Rig" tab) for visual profile authoring. The rig tab embeds a Phaser scene with the character rig, provides a direction picker for all 8 directions, and lets you edit every part property with instant visual feedback. When done, use Save to download a JSON snapshot or Export TS to generate TypeScript code you can paste directly into a rig definition file.

A `DirectionProfile` maps each part name to a `PartProfile` that controls how it appears from that angle.

### PartProfile parameters

| Field | Type | Description | Example (fox body, E profile) |
|---|---|---|---|
| `x` | number | Horizontal offset from container center (px) | `0` |
| `y` | number | Vertical offset from container center (px) | `0` |
| `scaleX` | number | Horizontal scale (1.0 = normal) | `1.2` (elongated side view) |
| `scaleY` | number | Vertical scale (1.0 = normal) | `0.8` |
| `rotation` | number | Rotation in radians | `0` |
| `depth` | number | Local render order (higher = in front) | `5` |
| `visible` | boolean | Whether this part renders | `true` |
| `alpha` | number? | Opacity 0-1, defaults to 1 | `0.7` (far legs) |

### Unique vs mirrored directions

Only 5 profiles need to be authored: **S, N, E, SE, NE**. The remaining 3 (W, SW, NW) are derived at runtime by mirroring their counterparts:

| Direction | Source | Mirror |
|---|---|---|
| W | E | Flip X positions and scaleX |
| SW | SE | Flip X positions and scaleX |
| NW | NE | Flip X positions and scaleX |

### Profile layout examples

**S (front-facing):**
```
         [left-ear] [right-ear]
              [head]
             [snout]
              [body]           ← scaleY 0.85 (foreshortened)
        [FL-leg] [FR-leg]      ← back legs hidden
              [tail-1]         ← barely visible (alpha 0.4)
```

**E (side-facing):**
```
              [left-ear]
            [head]
           [snout]─────[body]────[tail-1]─[tail-2]─[tail-3]
                        │  │     ← body scaleX 1.2 (elongated)
                   [FL][FR][BL][BR] legs
                   far  near far near
                   α0.7     α0.7
```

## Animation Controller API

Animation controllers implement the `AnimationController` interface:

```typescript
interface AnimationController {
  update(delta: number, boneStates: Record<string, BoneState>, rig: RigContext): void;
  destroy?(): void;
}
```

### BoneState (what you mutate)

Each frame, all bone states start at baseline `{ offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1, rotation: 0 }`. Multiple controllers can accumulate deltas — they compose additively.

| Field | What it does | Example usage |
|---|---|---|
| `offsetX` | Shifts sprite position horizontally | Unused currently |
| `offsetY` | Shifts sprite position vertically | Body bob during walk |
| `scaleX` | Multiplies sprite horizontal scale | Breathing (1.02) |
| `scaleY` | Multiplies sprite vertical scale | Breathing (1.02) |
| `rotation` | Adds to sprite rotation (radians) | Leg swing, tail sway |

### RigContext (what you read)

```typescript
interface RigContext {
  direction: Direction;  // Current facing (N, NE, E, SE, S, SW, W, NW)
  velocity: number;      // Movement speed in pixels/sec (0 = idle)
}
```

### Sine-wave animation model

Both built-in controllers use sine-wave animation. The pattern:

```typescript
const phase += deltaSec * frequencyHz * Math.PI * 2;
boneStates['body'].offsetY = Math.sin(phase) * amplitude;
```

### Walk/run parameters

| Parameter | Controls | Default | Sensible range |
|---|---|---|---|
| `walkBobHeight` | Body vertical oscillation (px) | `1.5` | 0.5 – 3.0 |
| `walkLegSwing` | Leg rotation amplitude (rad) | `0.3` | 0.1 – 0.5 |
| `walkTailSwing` | Tail rotation amplitude (rad) | `0.15` | 0.05 – 0.3 |
| `walkEarSwing` | Ear rotation amplitude (rad) | `0.08` | 0.02 – 0.15 |
| `runMultiplier` | Run speed / walk speed | `1.8` | 1.3 – 2.5 |
| `walkToRunDelay` | Seconds before walk→run | `0.8` | 0.3 – 2.0 |
| `walkCycleHz` | Walk animation frequency (Hz) | `3` | 2 – 5 |
| `runCycleHz` | Run animation frequency (Hz) | `5` | 3 – 8 |
| `decelerationDuration` | Settle time on stop (sec) | `0.2` | 0.1 – 0.5 |

### Idle parameters

| Parameter | Controls | Default | Sensible range |
|---|---|---|---|
| `breathingAmplitude` | Scale oscillation amount | `0.02` | 0.01 – 0.05 |
| `breathingPeriod` | Breathing cycle (sec) | `2.5` | 2.0 – 4.0 |
| `tailSwayAmplitude` | Idle tail rotation (rad) | `0.08` | 0.03 – 0.15 |
| `tailSwayPeriod` | Tail sway cycle (sec) | `3` | 2.0 – 5.0 |
| `headTurnDelay` | Seconds idle before head turn | `3` | 2 – 5 |
| `headTurnAngle` | Head rotation (rad) | `0.25` | 0.1 – 0.4 |
| `sitDelay` | Seconds idle before sitting | `6` | 4 – 10 |
| `sitLowerAmount` | How far body lowers (px) | `4` | 2 – 8 |
| `earFlickMinInterval` | Min seconds between flicks | `2` | 1 – 3 |
| `earFlickMaxInterval` | Max seconds between flicks | `5` | 3 – 8 |
| `earFlickAmplitude` | Flick rotation spike (rad) | `0.15` | 0.05 – 0.3 |

## Art Replacement Workflow

The rig system is designed for art-swap: replace PNGs, keep the same rig definition.

### Step 1: Atlas file locations

```
assets/characters/fox.png   ← Spritesheet image (all parts packed)
assets/characters/fox.json  ← Phaser JSON Hash atlas (frame coordinates)
```

### Step 2: Naming convention

Each body part PNG frame must be named to match the bone names in the rig definition. For the fox:

```
body, head, snout, left-ear, right-ear,
tail-1, tail-2, tail-3,
front-left-upper-leg, front-left-lower-leg,
front-right-upper-leg, front-right-lower-leg,
back-left-upper-leg, back-left-lower-leg,
back-right-upper-leg, back-right-lower-leg
```

### Step 3: Recommended dimensions

Current placeholder sizes (in pixels):

| Part | Width | Height | Notes |
|---|---|---|---|
| body | 48 | 36 | Largest part |
| head | 32 | 30 | |
| snout | 14 | 10 | Small detail |
| ears | 12 | 18 | Pointed triangles |
| tail segments | 22→16 | 16→14 | Decreasing toward tip |
| upper legs | 10-12 | 16 | |
| lower legs | 8-10 | 14 | |

Total atlas: 256×64 px. You can make parts larger for higher detail — adjust the atlas dimensions accordingly.

### Step 4: Generate the atlas JSON

Use the included generator script:

```bash
node tools/generate-fox-atlas.mjs
```

This outputs `assets/characters/fox.png` and `assets/characters/fox.json`. To replace with custom art:

1. Create individual part PNGs with transparent backgrounds
2. Use a texture packer (TexturePacker, free-tex-packer, or similar) to pack them into a single PNG + JSON Hash atlas
3. Or manually edit the JSON to point to the correct regions in your packed PNG
4. Ensure frame names match bone names exactly

### Step 5: Verify in-game

1. Run `npm run dev`
2. The fox should render with the new art
3. Check all 8 directions (WASD keys) — parts should position correctly
4. Check walk, run, and idle animations — parts should move naturally
5. If a part is missing: check the frame name in the JSON matches the bone name in `src/rig/characters/fox.ts`

## Creating a New Character

This walkthrough creates "the Keeper" — a white heron NPC.

### 1. Define the RigDefinition

Create `src/rig/characters/heron.ts`:

```typescript
import { RigDefinition, UniqueDirection, DirectionProfile } from '../types';

const skeleton = {
  name: 'body',
  children: [
    {
      name: 'neck',
      children: [{ name: 'head', children: [{ name: 'beak' }] }],
    },
    { name: 'left-wing' },
    { name: 'right-wing' },
    { name: 'left-leg', children: [{ name: 'left-foot' }] },
    { name: 'right-leg', children: [{ name: 'right-foot' }] },
    { name: 'tail-plume' },
  ],
};

// Define 5 direction profiles (S, N, E, SE, NE)
const profileS: DirectionProfile = {
  parts: {
    'body': { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, depth: 5, visible: true },
    'neck': { x: 0, y: -15, scaleX: 1, scaleY: 1, rotation: 0, depth: 8, visible: true },
    'head': { x: 0, y: -30, scaleX: 1, scaleY: 1, rotation: 0, depth: 10, visible: true },
    'beak': { x: 0, y: -25, scaleX: 1, scaleY: 1, rotation: 0, depth: 11, visible: true },
    'left-wing':  { x: -12, y: 0, scaleX: 1, scaleY: 1, rotation: -0.1, depth: 3, visible: true },
    'right-wing': { x: 12, y: 0, scaleX: 1, scaleY: 1, rotation: 0.1, depth: 3, visible: true },
    'left-leg':   { x: -4, y: 16, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'left-foot':  { x: -4, y: 28, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'right-leg':  { x: 4, y: 16, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'right-foot': { x: 4, y: 28, scaleX: 1, scaleY: 1, rotation: 0, depth: 6, visible: true },
    'tail-plume': { x: 0, y: 10, scaleX: 1, scaleY: 1, rotation: 0, depth: 1, visible: false },
  },
};

// ... repeat for N, E, SE, NE profiles

export const heronRigDefinition: RigDefinition = {
  name: 'heron',
  atlasKey: 'heron-atlas',
  skeleton,
  profiles: { S: profileS, N: profileN, E: profileE, SE: profileSE, NE: profileNE },
  walkRunParams: {
    walkBobHeight: 2.0,    // Herons bob more
    walkLegSwing: 0.4,     // Long leg strides
    walkTailSwing: 0.05,   // Minimal tail
    walkEarSwing: 0,       // No ears
    runMultiplier: 1.5,
    walkToRunDelay: 1.0,
    walkCycleHz: 2,        // Slower, more deliberate
    runCycleHz: 4,
    decelerationDuration: 0.3,
  },
  idleParams: {
    breathingAmplitude: 0.015,
    breathingPeriod: 3.0,
    tailSwayAmplitude: 0.03,
    tailSwayPeriod: 4.0,
    headTurnDelay: 2,       // Herons look around more
    headTurnAngle: 0.35,    // Wider turns
    sitDelay: 8,
    sitLowerAmount: 3,
    earFlickMinInterval: 10, // No ear flick (no ears)
    earFlickMaxInterval: 20,
    earFlickAmplitude: 0,
  },
  collisionSize: 24,
};
```

### 2. Create a placeholder atlas

Duplicate and modify `tools/generate-fox-atlas.mjs`, changing:
- Part names to match the heron skeleton
- Colors to white/grey/black palette
- Shapes to match heron anatomy (long neck, pointed beak, wings)

Run the script to generate `assets/characters/heron.png` and `assets/characters/heron.json`.

### 3. Register with GameScene

To use the heron as the player character (for testing):

```typescript
import { heronRigDefinition } from '../rig/characters/heron';

// In preload():
this.load.atlas(heronRigDefinition.atlasKey, 'characters/heron.png', 'characters/heron.json');

// In createPlayer():
this.player = new CharacterRig(this, heronRigDefinition, x, y);
```

For NPC usage, create the rig in `renderNpcs()` instead.

### 4. Verify

1. Run `npm run dev`
2. Check all 8 directions render correctly
3. Tune direction profile positions until the silhouette reads correctly
4. Adjust animation parameters until movement feels natural
5. Run `npx tsc --noEmit && npm run build` to verify no type errors
