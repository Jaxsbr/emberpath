---
title: For a finale that floods the screen and hands off to a DOM page — use camera.fadeOut (not a hand-placed rect), test the page as a Phaser-free model, and install the listener OUTSIDE the scene graph
applies_when: Building any full-viewport color flood / scene-ending bloom, an HTML/DOM overlay that must appear after the game freezes, or any DOM UI that needs unit tests under the node (no-jsdom) vitest env
status: binding
failure_ids: ["#197/#198 build — a hand-placed flood rect is fragile across the dual-camera setup; the 'Space to talk' prompt stranded over the dialogue box; vitest has no jsdom so DOM code can't be tested directly"]
canon: src/systems/stagFinale.ts · src/ui/endPageModel.ts · src/ui/endPage.ts · src/main.ts · src/systems/npcInteraction.ts (forceHidePrompt) · test/end-page.test.ts
---

# Screen flood via camera.fadeOut, DOM page as a node-testable model, listener outside the scene graph

The Heart Bridge finale (#197) had to: bloom a warm glow to full-screen, freeze the
game on the closing image, then fade in an HTML end-of-game page (#198). Three traps,
three rules.

## 1. Flood the viewport with `camera.fadeOut`, never a hand-placed rectangle
A full-screen rectangle sized to the camera is **fragile** under emberpath's dual-camera
setup (world camera + a separate `'ui'` camera): you have to size it to the right
viewport, place it at the right scroll position, and decide which camera renders it /
which `ignore()`s it — and any of those can drift and leave a gap or a double-draw.

Phaser's built-in fade is guaranteed full-viewport and camera-correct:
```ts
// src/systems/stagFinale.ts — the bloom's final flood
mainCam.fadeOut(FLOOD_FADE_MS, 255, 241, 207, (_cam, progress) => {
  if (progress >= 1) finish();   // dispatch the hand-off exactly once
});
```
Guard the camera for null, and latch the completion (`fired` flag) so the `onComplete`
hand-off (here: dispatching `emberpath:game-complete`) fires once, not every frame the
callback is invoked. Use a warm off-white (not pure `#ffffff`) so the bloom reads as
light, not a blank flash.

## 2. The "talk" prompt strands over the box — hide it when dialogue OPENS
GameScene `update()` **early-returns while a dialogue is active**, so
`npcInteraction.update()` (which normally shows/hides the "Space to talk" prompt) never
runs during dialogue. A prompt visible at the moment dialogue opens therefore freezes
on screen, stranded over the box for the whole conversation.

Fix: hide it imperatively at dialogue-open time, not via the per-frame path that's been
short-circuited.
```ts
// src/systems/npcInteraction.ts
forceHidePrompt(): void { this.prompt?.setVisible(false); }
// called the moment any dialogue starts (GameScene), alongside objectiveBanner.clear()
```
Rule: any UI driven by a per-frame `update()` that early-returns under some state must
also have an **imperative hide** invoked at the moment that state begins — the loop won't
do it for you once it's been gated off.

## 3. A DOM overlay that must survive the scene freeze installs OUTSIDE the scene graph
The finale freezes the scene. Anything wired *inside* a scene (its `create`, its event
emitters) is at risk when the scene halts. Install the page listener from `main.ts`,
outside Phaser entirely, listening on `window`:
```ts
// src/main.ts — after new Phaser.Game(config)
installEndGamePage();   // window.addEventListener('emberpath:game-complete', showEndPage)
```
Make it idempotent (guard a re-install) and a no-op outside the browser (so it imports
cleanly under the node test env). The finale and the page now communicate by a **DOM
CustomEvent**, not a scene reference — fully decoupled from the frozen scene.

## 4. vitest runs in the `node` env (no jsdom) — split CONTENT from DOM
emberpath's vitest is `environment: 'node'`; there is no `document`. You cannot unit-test
a DOM renderer directly. Split it:
- **`endPageModel.ts`** — a Phaser-free, DOM-free **content model** (the header, the
  gospel paragraphs, the link list with `href`/`pending`/`action`). Pure data → fully
  node-testable. This is where the test-first guards live: gospel names Jesus, the exact
  Jesus Film URL, **no invented links** (every `pending` link has `href: null`), a
  non-dead-end restart action.
- **`endPage.ts`** — a thin DOM renderer that consumes the model. Its correctness is
  covered by the Playwright e2e capture (the real overlay in a real browser), not unit
  tests.

Test-first means writing `test/end-page.test.ts` against the **model** before the DOM
exists. The model is the contract; the renderer is mechanism. This is the same split as
[authoring-tool-shares-render-math](authoring-tool-shares-render-math.md) — keep the
testable truth in a layer the test env can actually load.

## The check that catches it next time
The flood + freeze + fade-in chain is **motion** → verify with a recorded MP4, not a
still: a Playwright harness (`autonomy/record-end-page.cjs`) that walks Pip to the King,
plays the invitation, taps "Yes", waits for `#emberpath-end-page`, and asserts the
overlay DOM (header, gospel names Jesus, exact film href, restart present, learn-more
still pending) before capturing. Build passes regardless; only the recorded chain proves
the hand-off fires and the page actually appears over the frozen scene.

## Related
- [process/gif-for-motion](../process/gif-for-motion.md) — the flood/bloom/fade is motion, so the GATE-2 artifact is an MP4, never a still.
- [authoring-tool-shares-render-math](authoring-tool-shares-render-math.md) — same principle: put the testable truth in a layer the (node) test env can load.
- [content/reading-level-young-child](../content/reading-level-young-child.md) · [content/sacred-words-not-loose](../content/sacred-words-not-loose.md) — govern the end-page gospel text (the explicit reveal surface; in-game stays allegorical).
- Issues #197 (finale) · #198 (end page) · #1258 (King portrait) · PR #201.
