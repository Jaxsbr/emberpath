# Mobile UX Issues

Captured from PR #2 review (interaction phase). These need dedicated stories in a future phase.

## 1. Dialogue choice selection — no browse-then-confirm on mobile

**Problem:** Desktop has arrow keys to browse choices then Enter to confirm. Mobile has tap-to-instantly-select with small touch targets (14px font, 22px spacing). Easy to mis-tap, no way to review before committing.

**Proposed fix — Option A: Full-width buttons with confirmation bar**
- Render choices as full-width buttons (not small text lines)
- Tapping a choice highlights it and reveals a "Confirm" button at the bottom
- Tap confirm to proceed, or tap a different choice to switch
- Desktop keyboard flow (arrow + Enter) remains unchanged

## 2. Viewport scaling — letterboxing on mobile devices

**Problem:** The game uses a fixed 800x600 canvas with Phaser's `FIT` scale mode, which scales uniformly to the smallest screen dimension. On mobile phones:

- **Portrait (e.g. 412x914):** Game scales to fit 412px width, resulting in ~309px height — massive black bars top and bottom, game area is tiny
- **Landscape (e.g. 914x412):** Black bars on sides, game fills better but everything is still small
- Title screen and game world both suffer — text is small, touch targets are small

**Screenshots:** Chrome DevTools emulation on Samsung Galaxy A51 (412x914 portrait, 914x412 landscape).

**Proposed approach:**
- Detect mobile vs desktop (screen size, touch capability, or user agent)
- On mobile portrait: use a taller canvas ratio (e.g. 9:16 or 3:4) that fills the screen better
- Scale UI text and touch targets relative to actual screen DPI / device pixel ratio
- Dialogue box, thought bubbles, interaction prompts, and choice buttons should all use responsive sizing
- Consider forcing landscape orientation for gameplay, or designing a portrait-friendly layout

**Key constraint:** The tile map and game world are designed for a landscape viewport. Changing the canvas ratio affects camera bounds, tile rendering, and all UI positioning. This is a cross-cutting change that touches most systems.
