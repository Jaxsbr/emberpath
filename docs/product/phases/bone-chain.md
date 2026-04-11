# Phase: bone-chain — Parent-relative bone transforms

Status: draft

## Summary

Convert the rig system from flat absolute positioning (all parts offset from container center) to parent-relative transforms (each part positioned relative to its parent bone). This enables hierarchical movement — moving a parent bone automatically moves all descendants, matching how real skeletal animation systems work.

## Motivation

The current rig system positions all 46 fox parts as independent offsets from the container center. The `BoneDefinition` hierarchy (body > neck > head > snout, etc.) is used for display organization only — it has no effect on positioning. This means:

- Moving the neck in the editor does not move the head, snout, or ears
- Animation controllers must manually propagate offsets to every descendant (walkRun.ts lines 107-115 manually apply body bob to neck, head, shoulders separately)
- Adding new body parts requires updating every animation controller that touches ancestor bones
- The coordinate model diverges from designer expectations (spine/skeleton tools universally use parent-relative transforms)

## Current architecture (what changes)

```
Container (flat)
  ├── body    (x: 0, y: 0)      ← absolute from center
  ├── neck    (x: 0, y: -8)     ← absolute from center
  ├── head    (x: 0, y: -14)    ← absolute from center
  ├── snout   (x: 0, y: -12)    ← absolute from center
  └── ...46 sprites, all siblings
```

**After:**
```
Container
  └── body (x: 0, y: 0)
        ├── neck (x: 0, y: -8)      ← relative to body
        │     └── head (x: 0, y: -6) ← relative to neck
        │           └── snout (x: 0, y: 2) ← relative to head
        ├── tail-1 (x: -10, y: 2)   ← relative to body
        │     └── tail-2 ...
        └── ...
```

## Scope

### Stories

- US-32 — Parent-relative coordinate model in CharacterRig
- US-33 — Profile migration tooling (convert absolute to parent-relative coordinates)
- US-34 — Animation controller refactor (remove manual propagation)
- US-35 — Editor chain-aware editing (move parent = move children)

### US-32 — Parent-relative coordinate model

Change `CharacterRig` from a flat container of sprites to nested containers (or manual transform chain math). Each sprite's `x/y` in `PartProfile` becomes relative to its parent bone's position, not the container center.

Key decisions:
- **Nested Phaser Containers** vs **manual matrix math**: Nested containers are simpler but add overhead per bone. Manual math is more performant but harder to debug. For 46 parts, nested containers should be fine.
- **Rotation inheritance**: When a parent rotates, children orbit around the parent's origin. This is standard skeletal behavior. The `BoneState.rotation` delta from animation controllers would automatically propagate.
- **Scale inheritance**: Parent scale affects child size and position. This may need a flag per bone (some children should inherit scale, some shouldn't — e.g., eyes shouldn't shrink when body breathes).

### US-33 — Profile migration tooling

The existing fox.ts profiles use absolute coordinates. A migration tool (editor feature or script) must:
1. Read current absolute profiles
2. Walk the bone hierarchy
3. For each part, subtract the parent's absolute position to derive the relative offset
4. Output new profiles in parent-relative format

This must be verifiable: the fox should render identically before and after migration.

### US-34 — Animation controller refactor

With parent-relative transforms, animation controllers simplify dramatically:
- `walkRun.ts`: Body bob on `body` automatically moves neck, head, ears, shoulders. Remove ~30 lines of manual propagation.
- `idle.ts`: Sit-down on `body` automatically lowers everything. Head turn on `neck` automatically rotates head and snout. Remove ~20 lines of manual propagation.
- `BoneState` offsets become truly local — offsetY on `body` no longer needs to be duplicated on `neck`, `head`, etc.

### US-35 — Editor chain-aware editing

The rig editor's property panel should:
- Show parent-relative coordinates (matching the new data model)
- Moving a parent in the editor visually moves all children (automatic with nested containers)
- Optionally show world-space (absolute) coordinates as read-only reference
- Drag interaction (future) would naturally work with the hierarchy

## Dependencies

- **rig-editor** phase must be complete (this phase builds on the editor)

## Risks

- **Fox profile recalculation**: All 5 directions x 46 parts = 230 profile entries need conversion. Automated migration (US-33) mitigates this, but visual verification is essential.
- **Animation behavior change**: Parent-relative transforms compound differently. A body bob of 2px currently adds 2px to body, then animation manually adds 1.4px to neck, 1px to head. With parent-relative, body bob of 2px automatically moves neck by 2px (plus neck's own offset). Animation amplitudes will need retuning.
- **Performance**: Nested containers add Phaser overhead. Profile with 46 nested containers to verify frame budget stays under 16ms on mobile.

## Non-goals

- Inverse kinematics (IK) — out of scope for POC
- Runtime bone length constraints — out of scope
- Bone rotation limits / joint constraints — out of scope
- Physics-based secondary motion (jiggle, cloth) — out of scope
