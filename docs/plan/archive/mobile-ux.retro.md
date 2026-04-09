## Phase retrospective — mobile-ux

**Metrics:** 10 tasks, 4 investigate, 5 implement, 1 gate, 0 fail, 0 rework. Rework rate: 0%. Investigate ratio: 40%. Health: healthy.

**Build-log failure classes:**
- None — all 10 tasks passed on first attempt.

**Review-sourced failure classes:**
- None — 0 critical, 1 concern (unused `MOBILE_CONFIRM_HIGHLIGHT_BG` constant — dead code, resolved by removal). No failure class warranted.

**Compounding fixes proposed:**
- None — no failure classes identified in build log or review.

**Notes:**
- Zero rework continues the trend from foundation and interaction phases. The investigate-first pattern (40% ratio) and systems-based architecture are performing well.
- Post-review operator testing surfaced two issues outside the build loop's scope: (1) camera zoom was insufficient — the Scale.RESIZE mode gave a 1:1 pixel mapping without zoom, showing the entire 50-tile map on mobile screens with unreadable text. Fixed with dual-camera architecture (zoomed main camera + unzoomed UI camera) and a `s()` design-pixel scaling helper. (2) Orientation change didn't trigger layout recalculation — Phaser's ScaleManager only sets `dirty = true` on `window.resize` (calls `refresh()` only on `orientationchange`). Fixed with a direct `window.addEventListener('resize', ...)` that forces `scale.refresh()` after one `requestAnimationFrame`.
- These operator-testing fixes were applied directly to the PR branch after build-loop completion. They represent genuine mobile viewport concerns that the compile-only verify command (`tsc --noEmit && vite build`) cannot catch — consistent with the `platform-testing-gap` class first seen in the foundation retro.
- The `platform-testing-gap` class now has two occurrences across phases (foundation: touch input routing; mobile-ux: viewport zoom + orientation). However, both were caught during operator testing, not as build-loop failures — the build loop itself had no failures to classify. The pattern is noted for awareness but does not trigger compounding under the twice-seen rule (which requires classified failure entries, not post-hoc operator fixes).
