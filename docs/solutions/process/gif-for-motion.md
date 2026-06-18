---
title: Demonstrate motion with a GIF, never a still
applies_when: Verifying or presenting anything with movement, flow, or animation
status: binding
failure_ids: [recurring — screenshots sent for animations]
canon: docs/workflow/ways-of-working.md (GATE 2) · ce-demo-reel
---

# GIF for motion, still only for static

## The rule
Anything with **movement or flow** — sprite animations, water shimmer, particle/ember
effects, a creature popping up, a transition/cutscene, a multi-step interaction, a
path-walk — is demonstrated and approved with an **animated GIF**, never a single
screenshot. A still cannot show whether motion reads right, and Jaco can't approve an
animation he can't see move.

Static art (a sprite at rest, a placed scene, a building) → a **still** is fine.

## Why this lesson exists
Animations and flow-bearing changes were repeatedly presented as stills, so Jaco
couldn't actually judge the thing that mattered (the motion) and approvals stalled or
shipped wrong. This is the verification half of EP-03 (visual changes need to be *seen*,
not just built).

## The test (before opening the PR / posting for GATE 2)
- Does the change have motion/flow? If yes → did I capture a **GIF** of it?
- Does the GIF show the *full* beat (the animation cycle, the transition start-to-end,
  the interaction from trigger to result)?
- For a behavioural change with **no** visible motion (e.g. a save fix), a plain-language
  **write-up of the before/after behaviour** stands in for the GIF — say so explicitly.

Capture via the testbench (`?scenario=<id>`) + the playtest harness; produce the GIF
with `ce-demo-reel`. See `docs/workflow/ways-of-working.md` GATE 2.
