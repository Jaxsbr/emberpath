---
title: Ground-shadow canon — two shapes by object kind, one light
applies_when: Adding/changing any shadow, or adding any building, player, NPC, tree, or prop
status: binding
failure_ids: [FB-8, FB-21, FB-21r3]
canon: docs/art-style.md (Ground shadows — the canon)
---

# Ground-shadow canon

## The rule (3/4 oblique + overhead key light)
- **Buildings → RECTANGLE.** A clean rectangular front-floor band where the front wall
  meets the ground. Engine: the `bf` branch of the object-shadow loop in `GameScene.ts`.
- **Player / NPC / tree / prop → soft ELLIPSE** pooled **on the visible ground-contact
  line** (feet / trunk base — not the padded sprite-box bottom, not out in the yard).
  North half tucks under, small sliver pokes **south**, height ≈ 0.4× width,
  footprint-scaled. Engine: the `makeGroundShadow` helper. Pip/NPC pools are deliberately
  **small/tight** (scaled ~0.82×, alpha ~0.22 per #926).
- **Every entity has one.** A character/object with no ground shadow is a fail.
- **One light direction** for the whole scene — all ellipses share the same south sliver
  and softness.

## Why this lesson exists (it failed three times)
- **FB-8**: the cottage had no proper ground shadow.
- **FB-21 / FB-21r3**: the fix swung between oval and rectangle and back. Cited root
  causes: Pip/NPCs had **no** feet-shadow to match against; **three docs gave three
  conflicting light directions**; and pixels were edited off an annotation that never
  attached. The "ellipse for everything" version (PR #140) was rejected — buildings are
  rectangles. Re-adding an oval to a building is the **FB-21r3 regression**.

## The test
- Building shadow shape = rectangle? (oval on a building = FAIL, the FB-21r3 regression.)
- Entity shadow = soft ellipse **on the contact line** (feet/trunk), not a detached oval
  floating in open ground? Pip/NPC pools small, not oversized?
- Does **every** player/NPC/tree/prop carry a shadow?
- Do all shadows share **one** light direction?

If feedback references a shadow annotation/screenshot that didn't attach, do **not**
guess position or shape — see [never-edit-off-unseen-annotation](../process/never-edit-off-unseen-annotation.md).

Full canon: `docs/art-style.md` → "Ground shadows (the canon)".
