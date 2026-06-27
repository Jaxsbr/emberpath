---
title: Capture the real in-game flow, never a faked event dispatch
applies_when: Recording a sequence/transition clip for GATE 2 (a flow reached through gameplay)
status: binding
failure_ids: [FB-1294, FB-1296 — end-page clips rejected as "simulated / wrong sequence"]
canon: docs/workflow/ways-of-working.md (GATE 2) · extends gif-for-motion.md
---

# Capture the real flow, not a faked event

## The rule
When the thing under review is a **sequence or transition reached through gameplay**
(finale → end page, scene A → scene B, a trigger → its result), drive the **real
in-game trigger** headlessly. Do **not** shortcut by dispatching the completion event
(`window.dispatchEvent(new Event('emberpath:game-complete'))`) from whatever scene
happens to be loaded — that produces a clip that shows the **wrong order** and reads to
Jaco as "you're simulating this."

## Why this lesson exists
The end-page clip was rejected **twice in a row**. I'd fired the finale event from a
title/scenario boot, so the video showed a misleading **"New Game → End Page"** (and a
title flash mid-sequence) — the exact opposite of the real flow. Jaco: *"this is
entirely the wrong sequence, so I'm guessing you are simulating this?"* The real order
is **Heart Bridge → King's "Yes" → glory-bloom → End Page → (Return) → New Game**. A
faked dispatch can never prove order, because it bypasses the very ordering being judged.

## The test (before posting a sequence/transition clip)
- Is the claim about an **order/transition** (X leads to Y)? If yes → did I reach Y by
  the **actual trigger**, not by dispatching Y's event?
- Did I boot a scenario that seats the player **at the real trigger point** and then
  drive genuine input through it?
- Did I verify the captured order (a labelled `ffmpeg` frame-timeline montage) before
  sending?

A synthetic dispatch is acceptable **only** for an isolated *visual* (e.g. just the
leaf ambience on the end page), never for a sequence/transition claim.

## How
Use a scenario that puts the player a couple tiles from the trigger
(`?scenario=stag-finale` seats Pip near the King), then drive the real input — walk +
Space through the invitation + pick "Yes" — so the genuine event fires. Pattern:
`autonomy/record-end-sequence.cjs` (built on `record-stag-finale.cjs`). Then transcode
the webm → MP4 (`gif-for-motion.md`, Jaco #1016: MP4 renders inline on Telegram).
