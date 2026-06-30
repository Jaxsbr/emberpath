# Phase 4 — entertaining + shorter-feeling loads (perceived wait)

**Issue:** TBD (filed alongside this plan) · **Type:** feature · **Parent:** #214 (Phases 1–3 shipped)
**Status:** planned — awaiting GATE-1 direction approval

## Why
Phases 1–3 cut the *real* load hard (bytes −73%, Fast-3G time-to-playable −31%). Phase 4 is the
last item of the original #214 spec: **make the unavoidable waits entertaining and reduce the
*perceived* wait.** This is polish on an already-fast load, not a blocker — so it's scoped lean
and gated on Jaco's direction call.

## The wait we're dressing
Two moments still show the loader:
- **Cold boot** — the inline HTML boot loader (`index.html` + `src/ui/bootLoader.ts`) while the
  1.7 MB bundle parses + the first area streams.
- **Area transition** — the ember overlay (`src/ui/transitionLoader.ts`) while a *new* area's
  not-yet-cached assets stream (only when there's something to fetch).

Both are dark-radial-ember + a single hint line today. Phase 4 enriches them.

## Direction options (GATE-1 — Jaco picks)
- **A (recommended) — Kindling progress + story-whispers + idle prefetch.**
  1. **Progress feedback** drawn as the path/fire *kindling*: the loader gets a real
     progress bar styled as embers lighting along a path (`load.on('progress')` → fill).
     Progress is the single biggest perceived-wait reducer (a known wait feels shorter than
     an unknown one).
  2. **Story-whispers:** the static hint becomes a small rotating set of gentle, on-brand
     world lines (governed by `biblical-guidance.md`, kid-level) so the eye has something warm
     to rest on.
  3. **Idle prefetch:** when Pip lingers near an area exit, quietly warm the *next* area's
     assets in the background, so most transitions show **no loader at all**. Pure logic,
     non-visual.
  Mostly logic + text + CSS; **little/no new art** → the visual delta (progress bar + whisper
  rotation) is one GATE-2 MP4; the prefetch self-merges.
- **B — Richer animated load vignette.** Commission a small animated scene via PixelLab (Pip
  walking the path, drifting embers) for a more "alive" wait. Bigger art spend + GATE-2 art
  review + larger scope. Higher polish, slower to ship.
- **C — Minimal: progress + idle prefetch only.** Add the progress indicator and prefetch,
  skip the whisper-line flavor. Leanest; ships fastest; least "entertaining."
- **Other** — say the word.

## Build outline (for the recommended A)
1. **Progress signal** — subscribe to Phaser's `LoaderPlugin` `progress` event in `preload`;
   plumb 0→1 into both loaders via a shared, Phaser-free, node-testable setter
   (`setLoaderProgress(doc, frac)`), mirroring the existing bootLoader/transitionLoader split.
   Failing-first test asserts the fill width tracks the fraction and clamps.
2. **Whisper rotation** — a small vetted line pool (content, `biblical-guidance.md`); a tiny
   timer rotates them with a fade. Test: rotation advances + wraps; pool is non-empty.
3. **Idle prefetch** — in the overworld update, when Pip is within N tiles of an exit and has
   dwelt M ms, `computeAreaAssets(destArea)` → queue those keys on a low-priority loader pass
   (reuses Phase 3's per-area bundle; loader skips already-cached). Guard against double-queue;
   never block the main thread. Test: prefetch fires once per approach, queues exactly the
   destination bundle, no-ops if already cached.
4. **Verify** — testbench scenario through a throttled transition (CDP) showing progress fill +
   whisper rotation; MP4 for GATE-2. Re-bench perceived-wait (loader-visible duration on a
   pre-warmed vs cold transition) to show prefetch removing the loader on the warm path.

## Gates
- **GATE-1:** this Brief — direction approval before `/ce-work`.
- **GATE-2:** the progress bar + whisper rotation are a visual change → MP4 approval before merge.
- Self-merge gates as usual (build · 162+ tests · boot-smoke · cold PR-review).

## Out of scope
No change to game content/behaviour or to the per-area loading logic itself (that shipped in
Phase 3). Strictly the *presentation* of the wait + opportunistic prefetch.
