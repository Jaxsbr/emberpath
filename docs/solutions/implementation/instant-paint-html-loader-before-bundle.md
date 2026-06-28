---
title: Kill the dark-screen-on-land by painting a pure HTML/CSS loader in index.html (no JS, no assets), then dismiss it from a Phaser-free node-testable bridge on the first POST_RENDER — so the menu feels instant even while a 1.7MB bundle parses
applies_when: A Phaser/SPA shows a black screen until the JS bundle downloads + parses + first-renders; you want first-paint feedback at zero asset cost; or you need to unit-test DOM-dismissal logic under vitest's node (no-jsdom) env
status: binding
failure_ids: ["#214 F6 — landing on the game showed a dark screen for ~450ms (local) / seconds (3G) while the 1.7MB bundle parsed before Phaser's first render"]
canon: index.html (#boot-loader markup + inline CSS) · src/ui/bootLoader.ts · src/main.ts (POST_RENDER dismissal) · test/boot-loader.test.ts
---

# Instant-paint HTML loader, dismissed on first render

The browser paints `index.html` on the **first byte**, long before it has parsed the
bundle and Phaser has constructed a scene. So the cheapest possible loading feedback is
**markup that's already in the HTML** — no script, no asset, no font fetch.

## 1. The loader lives in index.html as inline HTML + CSS, before the <script>
A `#boot-loader` overlay with an animated ember pulse, the "emberpath" title and a
"kindling the world…" hint, painted on the page background (`#1a1a2e`, matching the game
so there's no flash). Pure CSS animation; a `@media (prefers-reduced-motion)` guard stills
it. Because it's static markup ahead of `<script type="module">`, it's on screen before a
single JS byte executes. Menu first-paint went **456ms → 28ms**.

## 2. Dismiss it from a Phaser-free bridge, on the first POST_RENDER
Don't entangle dismissal with scene code. A tiny module owns it:
```ts
// src/ui/bootLoader.ts — DOM-injectable, so it's node-testable
export function dismissBootLoader(doc, schedule) {
  const el = doc.getElementById(BOOT_LOADER_ID);
  if (!el) return false;
  el.classList.add(BOOT_LOADER_DONE_CLASS);      // CSS opacity fade
  schedule(() => el.remove(), BOOT_LOADER_FADE_MS);
  return true;
}
```
Wired once, outside the scene graph, on Phaser's first frame:
```ts
// src/main.ts — after new Phaser.Game(config)
game.events.once(Phaser.Core.Events.POST_RENDER, () =>
  dismissBootLoader(document, (fn, ms) => window.setTimeout(fn, ms)));
```
`POST_RENDER` (not scene `create`) means the loader stays until something is **actually on
the canvas**, so there's no gap between loader-gone and menu-shown. The CSS class does the
fade; JS only schedules the `remove()`.

## 3. Inject `document` + `schedule` so the logic tests under node
vitest here is `environment: 'node'` — no `document`. Passing the doc and the timer in
(rather than reaching for globals) makes `dismissBootLoader` a pure function over a minimal
`{getElementById}` stub. The failing-first test (`test/boot-loader.test.ts`) asserts BOTH
the contract in the HTML (the `#boot-loader` element exists **before** the `<script>`, the
done-class is defined) AND the behaviour (adds the class, schedules removal after the fade,
no-ops safely when the element is already gone). It fails on origin/main and goes green with
the feature. Same split as
[full-screen-flood...survive-scene-freeze](full-screen-flood-and-dom-overlay-survive-scene-freeze.md):
keep the testable truth in a layer the node env can load; the visual is covered by the MP4.

## 4. It's a NEW VISUAL element → GATE-2 before merge
Unlike the sprite-sheet half of #214 (pixel-identical, self-merges), the loader is
something a player sees that didn't exist — a visual change. It needs Jaco's MP4 approval
before merge. Record it on a **throttled** connection (CDP `Network.emulateNetworkConditions`,
Fast-3G) so the loader is on screen long enough to actually review, then transcode the
Playwright webm to MP4 (`autonomy/loading/record-loader.cjs`).

## Related
- [lossless-spritesheet-pack-with-ffmpeg-psnr](lossless-spritesheet-pack-with-ffmpeg-psnr.md) — the other half of #214 (the self-merging, pixel-identical half).
- [process/gif-for-motion](../process/gif-for-motion.md) — the loader→menu transition is motion → the GATE-2 artifact is an MP4.
- Issue #214 (F6 loading performance).
