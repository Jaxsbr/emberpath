---
title: The best loading UI is the one that never shows — warm the next area's bundle DURING gameplay (idle prefetch via a throttled mid-scene this.load.start()), and for the unavoidable cold case make the wait FEEL short with a known-progress fill + rotating world-whispers
applies_when: You have a per-area (or per-route) lazy loader and want most transitions to show NO loader at all; or you're adding a progress bar / waiting text and want it to actually reduce perceived wait; or you need to run Phaser's loader mid-scene without disturbing a real transition
status: binding
failure_ids: ["#214 F6 Phase 4 — per-area lazy load (Phase 3) removed the up-front stall but every FIRST visit to an area still paused on the transition loader while its bundle streamed"]
canon: src/systems/areaAssets.ts (selectPrefetchTargets, queueAreaAssets) · src/scenes/GameScene.ts (maybePrefetchNearbyAreas, onTransitionProgress, whisper timer) · src/ui/transitionLoader.ts (setTransitionLoaderProgress, advanceTransitionWhisper, TRANSITION_WHISPERS) · test/area-assets.test.ts · test/transition-loader.test.ts
---

# Prefetch erases the wait; a known-progress loader shortens the wait that's left

Phase 3 made each area load only its own assets — but that just **relocated** the stall:
the up-front freeze became a per-transition freeze on every first visit. Phase 4's win is
two-layered, and the order matters: **first make the loader unnecessary, then make the
unavoidable case feel short.**

## 1. Idle prefetch — warm the next area while Pip is still walking (the real fix)
Pip almost always lingers near an exit before taking it. That idle time is free bandwidth.
When she's within `PREFETCH_RANGE_TILES` (4) of a *usable* exit, quietly queue the
destination's bundle in the background so the real transition finds everything cached and
shows **no loader at all**.

- **Reuse the exact per-area queue fn.** Prefetch calls the same `queueAreaAssets(area)`
  the transition preload uses — one code path derives "what an area needs", so a prefetch
  can never warm a *different* set than the transition loads. (Caveat: it warms **graphics
  only** — music streams via a separate WebAudio fetch, so a bed can still stream on entry.)
- **The decision is a pure function.** `selectPrefetchTargets({playerCol,row, exits,
  rangeTiles, currentAreaId, alreadyPrefetched, canUseExit})` returns the destination ids
  to warm: in-range (distance to the exit **rect**, clamped — not its corner), condition
  gate open (`canUseExit` wraps `evaluateCondition`), never the current area, de-duped, and
  minus everything already warmed this session. Pure → 7 node tests pin every gate; zero
  Phaser in the test.
- **Run Phaser's loader mid-scene, carefully.** In `update()`:
  ```ts
  maybePrefetchNearbyAreas(time) {
    if (time - this.lastPrefetchCheck < PREFETCH_CHECK_INTERVAL_MS) return; // throttle: 400ms
    this.lastPrefetchCheck = time;
    if (this.load.isLoading()) return;                    // never fight a real transition
    for (const destId of selectPrefetchTargets({...})) {
      this.prefetchedAreaIds.add(destId);                 // add BEFORE the queue → no retry storm
      const dest = getArea(destId); if (dest) queueAreaAssets(dest);
    }
    if (this.load.list.size > 0 && !this.load.isLoading()) this.load.start();
  }
  ```
  Three guards make it safe: **throttled** (one cheap timestamp compare per frame — no
  per-frame allocation; the object literal + closure only build on the 400ms path);
  **`isLoading()`-gated** both before queueing and before `start()` so it never disturbs an
  in-flight transition; and **`add()`-before-queue** so a bad/failed id can't loop — a
  failed prefetch simply self-heals at real transition time.

**Measured (identical 40 KB/s throttle):** walking up to an exit (prefetch warms it) =
**0ms** loader visible. Cold approach with no warm-up = **1917ms**. The common case now has
no wait.

## 2. For the cold case, make the wait FELT-shorter, not just decorated
When prefetch can't win (a fast dash, a gated exit that just opened), the transition loader
still shows — so it earns its keep two ways, both driven from `GameScene.preload`:

- **Known progress beats a spinner.** Attach to Phaser's loader `progress` event and pipe
  `0→1` into `setTransitionLoaderProgress(document, frac)` → an ember-gradient fill that
  *kindles* across a track. A wait with a visible end feels shorter than an indefinite one.
- **Rotating world-whispers give the eye somewhere warm to rest.** A `setInterval`
  (`TRANSITION_WHISPER_ROTATE_MS`) cycles `advanceTransitionWhisper` through 5 on-brand,
  kid-level lines ("the next way is kindling…", "a little light, then a little more…") —
  allegory intact, the source never named. `whisperAt(i)` indexes with a wrapping modulo
  and a module cursor (deterministic, **no `Math.random`** — the codebase bans it).

**Teardown is non-negotiable.** BOTH the `progress` listener and the whisper `setInterval`
are removed in the loader's `complete` handler, using the same bound reference — otherwise
every `scene.restart()` transition leaks a timer and stacks duplicate progress writes.

## 3. Same node-testable split as the boot loader
The DOM-coupled setters (`setTransitionLoaderProgress`, `advanceTransitionWhisper`) inject
`document`, so vitest's node env tests them against a `{getElementById}` stub — with the
one gotcha that the fake doc **doesn't parse `innerHTML`**, so the inner fill/hint nodes
must be registered by id explicitly in the test. 14 new tests (7 prefetch geometry/gate/
dedup, 4 progress clamp, 3 whisper rotation) fail on origin/main, green with the feature.

## 4. Prefetch self-merges; the loader visuals are GATE-2
The prefetch half changes no pixels — pure background warming — so it's a self-merge on the
cold gates. The progress fill + whispers are **new things a player sees** → GATE-2 MP4
before merge, captured at a *heavier* 16 KB/s throttle so the loader lingers long enough to
actually review the bar climbing and 3 whispers rotating (40 KB/s was too fast to see the
rotation). Same throttle-to-review trick as the boot loader.

## Related
- [instant-paint-html-loader-before-bundle](instant-paint-html-loader-before-bundle.md) — the boot-time loader; same node-testable DOM-injection split and throttle-to-review capture.
- [per-area-lazy-load-via-scene-restart](per-area-lazy-load-via-scene-restart.md) — Phase 3; prefetch reuses its `queueAreaAssets`, and this is the wait it left behind.
- [process/benchmark-driven-with-baseline-and-failing-test](../process/benchmark-driven-with-baseline-and-failing-test.md) — the 0ms-vs-1917ms number came from a headless bench under a fixed throttle.
- [process/gif-for-motion](../process/gif-for-motion.md) — the bar/whispers are motion → GATE-2 artifact is an MP4.
- Issue #214 (F6 loading performance), #218 (Phase 4), PR #219.
