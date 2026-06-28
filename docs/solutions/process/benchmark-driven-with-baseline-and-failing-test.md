---
title: For a performance task, capture a headless baseline FIRST, write a test that FAILS on the current build, then re-benchmark after EACH change — foundational work may not move the number until the final wiring, so trust the chain, not one reading
applies_when: Any "make it faster / lighter / load better" task where you could otherwise hand-wave "it should be quicker"; you need proof for a skeptical reviewer; or a multi-step refactor where intermediate steps don't individually improve the metric
status: binding
failure_ids: ["#214 F6 — a loading-perf task with no number is just a promise; a ~12h silence with 'it's faster now' and no measurement read as nothing-happened"]
canon: autonomy/loading/bench.cjs · autonomy/loading/bench-throttled.cjs · autonomy/loading/results-p2.json · test/boot-loader.test.ts
---

# Benchmark-driven performance work: baseline, failing test, re-bench each step

A performance claim with no measured before/after is indistinguishable from "trust me."
When Jaco asked for a loading-perf improvement he explicitly wanted **before/after
benchmarks shared in chat** and, when an update slipped, "**prove it some how**." The
process that produces proof:

## 1. Build a headless benchmark harness and capture the baseline BEFORE touching code
`autonomy/loading/bench.cjs`: serve `dist/` from a tiny http server, drive headless
Chromium, and measure the things that matter — menu first-paint (FCP), bundle bytes, and
on a `?scenario=` boot the **asset request COUNT + bytes + time-to-playable** (last asset
after a 1.2s quiet window). A throttled twin (`bench-throttled.cjs`, CDP Fast-3G) shows the
real-network story. Run it on **origin/main first** and save the numbers — that baseline is
the thing every later claim is measured against.

## 2. Classify honestly — a metric that hides your new category lies
The request tally groups by URL (`classify()`). When the sprite sheets landed under a new
`/sheets/` path, the first run **undercounted** because that category wasn't in the
counted-set — it looked better than reality. Add every new asset class to both the
classifier and the included filter so the total is honest. A benchmark you can fool is
worse than none.

## 3. Write the test that FAILS on the current build, then make it green
Per the task spec: a test that **fails on the current implementation** first, then
implement to green. It encodes the contract (e.g. the `#boot-loader` exists before the
`<script>`), so the improvement can't silently regress later. Confirm it actually fails on
origin/main — a test that passes before you start proves nothing.

## 4. Re-benchmark after EACH change — and don't panic when a step doesn't move it
The task spec called this out: **foundational work may not improve the score** until the
final wiring connects it. Packing sheets doesn't help until `preload` loads them instead of
the per-frame files; the HTML loader doesn't change request count at all. Judge the **final
verified delta**, and keep the per-step readings to show *where* the win came from. The
#214 chain: 667→75 requests, 456→28ms first-paint, 31.5s→14.6s on 3G — each attributable to
a specific step.

## 5. Report the numbers, not the effort
"I packed the sheets and wired the loader" is effort. "667→75 requests, all frames
PSNR=inf, 0 console errors, runtime-verified" is proof. Lead with the measured table; the
narrative is secondary. Save the readings to a results file (`results-p2.json`) so the
claim is reproducible, not a screenshot of a feeling.

## Related
- [lossless-spritesheet-pack-with-ffmpeg-psnr](../implementation/lossless-spritesheet-pack-with-ffmpeg-psnr.md) · [instant-paint-html-loader-before-bundle](../implementation/instant-paint-html-loader-before-bundle.md) — the two changes this method validated.
- Issue #214 (F6 loading performance).
