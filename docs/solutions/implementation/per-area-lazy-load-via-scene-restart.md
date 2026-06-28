---
title: Load assets per-area by letting Phaser's scene.restart() re-run preload() (the loader skips cached keys) instead of one up-front preload of every area — and beware that lazy-loading turns a synchronous start-then-fade into an async one, so any "start at 0, then ramp up" sequence silently stays at 0 unless you stash the pending ramp and apply it when the deferred start lands
applies_when: Splitting a monolithic up-front asset preload into on-demand per-area/per-level loading; deriving an area's asset set from data so it can't drift from what's drawn; or you have any "create a thing at a neutral value, then immediately ramp/animate it to its real value" pair where the create step can become asynchronous (lazy buffer decode, lazy texture load)
status: binding
failure_ids: ["#214 P3 — SFX-only audio preload left every area's music bed SILENT on first visit: setArea issued startMusic(key,0) then fadeMusic(key,target), but the lazy bed's buffer wasn't decoded so startMusic deferred and the fade had no voice to ramp; bed stuck at gain 0 until the area was revisited (cached). Caught by cold PR-review, not the build."]
canon: src/systems/areaAssets.ts · src/scenes/GameScene.ts (init/preload/queueAreaAssets) · src/audio/webAudioBackend.ts (pendingFades) · test/area-assets.test.ts · test/web-audio-backend.test.ts
---

# Per-area lazy loading via scene.restart() — and the deferred-start-then-fade trap

Loading **every** area's assets up front scales with the whole game, not with where the
player is. Phaser already gives you the mechanism to load per-area for free — and the
trap that bites is not in the loader, it's in the audio/animation code that assumed the
old eager world.

## 1. scene.restart() re-runs preload(); the loader skips cached keys
`scene.restart()` (which is how this game does an area transition — restart with a new
`areaId`) runs the full `init → preload → create` again. Phaser's `LoaderPlugin` **skips
any key already in the cache**. So you don't write an imperative second loader: make
`preload()` load only *the booting area's* bundle, and a transition automatically fetches
just the destination's not-yet-cached assets.
```ts
init(data) { this.bootAreaId = data?.areaId ?? getDefaultAreaId(); }
preload() {
  /* common assets: pip sheet, shared props */
  const area = getArea(this.bootAreaId);
  if (area) this.queueAreaAssets(area);   // tilesets, object kinds, npc sheets, portraits
}
```
`init` resolves which area; `preload` queues common + that area. First boot loads one
area; each transition tops up the next.

## 2. Derive the area's asset set from the SAME data the renderer reads
A hand-maintained per-area manifest drifts the moment someone adds an NPC. Compute it
(`computeAreaAssets(area)`) from the area definition itself: tilesets from the **Wang
terrain superset** (every tileset whose primary/secondary terrain appears in the area's
grid + conditional terrain) **plus** the area's own `tileset`/`decorationsTileset`;
object kinds from `area.objects[].kind`; NPC sheets from `area.npcs[].sprite`; portraits
from a **recursive deep-scan** of `portraitId` strings in `area.dialogues`/`storyScenes`.
Make tilesets a **deliberate superset** — under-loading shows a green fallback tile, so
err toward loading one extra atlas, never one too few. The test asserts **completeness**
(every placed entity's asset is in the bundle) and the **subset win** (at least one area
needs fewer NPC sheets than the full roster — proof it actually narrowed).

## 3. THE TRAP: lazy-loading makes "start then ramp" asynchronous
This is the bug that shipped past the build and was only caught by the cold review. Audio
`setArea` does, on every area change:
```ts
startMusic(bedKey, 0);                 // create the bed's voice at gain 0
fadeMusic(bedKey, MUSIC_VOLUME, 600);  // ...then ramp it up to volume
```
Eagerly preloaded, `startMusic` was **synchronous** — the voice existed by the time
`fadeMusic` ran. Lazy-load the bed and `startMusic` finds no decoded buffer, so it
**defers** (load-then-start). Now `fadeMusic` runs against a voice that doesn't exist yet,
finds nothing, and silently returns — the bed starts at 0 and **stays at 0** until the
area is revisited and the buffer is cached (making `startMusic` synchronous again, which
is why it "worked on the second visit" and hid in casual testing).

**The general shape:** any `createAtNeutral(); then animateToReal();` pair breaks the
moment `create` can become async. The fix is to make the deferred create **carry out the
intent that was expressed while it was still pending** — stash it, apply it on landing:
```ts
private readonly pendingFades = new Map<string, {to: number; ms: number}>();

fadeMusic(key, to, ms) {
  const v = this.music.get(key);
  if (!v) { this.pendingFades.set(key, {to, ms}); return; } // no voice yet → remember
  /* ...ramp v... */
}
startMusic(key, volume) {
  /* ...create + register the voice... */
  const pending = this.pendingFades.get(key);
  if (pending) { this.pendingFades.delete(key); this.fadeMusic(key, pending.to, pending.ms); }
}
```
Last-write-wins on the map handles a re-fade before landing; keying by bed means a
crossfade-out on the *other* bed never collides.

## 4. Test the deferred path against the REAL backend, not the fake
The manager-level `FakeBackend` only records that start+fade were *issued* — it can't
exercise the deferred-then-apply path, so it's blind to exactly this bug. The regression
test (`test/web-audio-backend.test.ts`) drives the **real `WebAudioBackend`** under a
minimal fake `AudioContext` (stub `window` + `fetch` in `beforeEach`), runs the precise
`setArea` sequence on an *uncached* bed (`startMusic(k,0)` → `fadeMusic(k,0.8,600)` →
flush microtasks), and asserts the voice's gain **ramps to 0.8, not 0**. Proven
failing-first (revert the `pendingFades` stash → the test fails).

## 5. What's a GATE-2 change here and what isn't
The lazy-loading logic is **non-visual** → self-merges on the gates. The **transition
loading indicator** (`src/ui/transitionLoader.ts`, the ember overlay during a slow
destination fetch) is a **new visual** → MP4 GATE-2 before merge, same as the boot loader
([instant-paint-html-loader-before-bundle](instant-paint-html-loader-before-bundle.md)).
Capture it on a connection throttled **only for the destination fetch** (boot at full
speed first, then CDP-throttle), so the loader lingers long enough to review without the
one-time JS bundle dominating the clip
([capture-the-real-flow-not-a-faked-event](../process/capture-the-real-flow-not-a-faked-event.md)).

## Related
- [instant-paint-html-loader-before-bundle](instant-paint-html-loader-before-bundle.md) — the boot loader; this is the per-transition sibling, same DOM-overlay + node-test split.
- [lossless-spritesheet-pack-with-ffmpeg-psnr](lossless-spritesheet-pack-with-ffmpeg-psnr.md) — #214 Phase 2; the per-frame→sheet pack this builds on.
- [benchmark-driven-with-baseline-and-failing-test](../process/benchmark-driven-with-baseline-and-failing-test.md) — how the −73% bytes / −31% Fast-3G numbers were measured.
- [audio-feel-movement-not-events](audio-feel-movement-not-events.md) — the audio model whose `setArea` start-then-fade this lesson protects.
- Issue #214 (loading performance), PR #217 (Phase 3).
