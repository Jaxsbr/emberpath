# US-95 Tilesets — In-Flight Generation Tracking

**STATUS (last check): all 5 generations FAILED. Build loop paused.**

Working doc — updated as PixelLab generations land. Delete when US-95 wraps and tilesets are wired into TILESETS.

## Final outcome of first batch

| # | Final tileset id | Outcome | Note |
|---|---|---|---|
| 1 | `79aa8340-3112-42fb-89f3-7be9814d010d` | FAILED — Unknown error | Stripped prompt didn't help; 3 attempts (cff7362c, bf213f1d, 79aa8340) all failed within seconds. |
| 2 | `43bc42cb-1f25-4b65-a36e-c59d4cb80a2a` | FAILED — "Generation completed but no tiles were produced" | Reached 90% then errored. Chained from FAILED #1 predetermined sand id. |
| 3 | `7e699904-f0a5-4585-9a35-f8f7dee8220c` | FAILED — Unknown error | 3 attempts (ec818e0d, 09e1621b, 7e699904) all failed within seconds. |
| 4 | `4ab2e6db-f9d8-42c7-ab1a-0b76a5a2cc2d` | FAILED — "Generation completed but no tiles were produced" | Reached 90% then errored. Chained from FAILED #3 predetermined marsh-floor id. |
| 5 | `1f0e8c90-516d-4c83-8d90-e5c4d8fe9331` | FAILED — "Generation completed but no tiles were produced" | Reached 90% then errored. Chained from FAILED #3 predetermined marsh-floor id. |

**Generations spent: 9/10.** Only 1 left in the spec's per-tileset reroll budget.

## Failure-mode pattern

- Fresh (no `lower_base_tile_id`) Wang generations fail almost immediately with **"Unknown error"** — happens before image generation could plausibly run. API-level rejection.
- Chained generations make it to 90% completion then return **"Generation completed but no tiles were produced"** — the upstream succeeded for individual tiles but the post-processing into a tileset returned nothing.
- Both classes of failure are independent of prompt content (full vs stripped both fail), prompt length (long vs short both fail), and chain status (with vs without `lower_base_tile_id` both fail).
- The only successful PixelLab calls in this project's history are scene-art via `mcp__pixellab__create_object` (US-91 scene beats, generated successfully). `mcp__pixellab-team__create_topdown_tileset` may be degraded or have a regression.

## Decision required from operator

Build loop is paused on US-95 task 9. Options:

1. **Wait and retry later** — give the PixelLab service time to recover. Retry tomorrow with a single test call.
2. **Use the personal `mcp__pixellab__` server instead of `mcp__pixellab-team__`** — possibly different infrastructure / service health. Costs apply to personal account.
3. **Fall back to keeping Kenney degenerate Wang for stage 2** — declare the tile-architecture phase scope shipped at architecture-only, defer PixelLab content to a follow-up phase. The current code already supports this (degenerate-mode fallback works).
4. **Approve more reroll budget** — if confident the service will recover, authorise additional generations.

Recommended: option 1 (wait) or option 3 (defer content). Option 2 only if the operator wants to spend personal credit to confirm whether team server is the issue.

## Failure log for verify doc

Per US-95 done-when "if exceeded, paragraph note in verify doc explaining what changed in the prompt for the successful generation":

> US-95 first generation batch (2026-04-30): 9 PixelLab `create_topdown_tileset` calls spent, 0 successful tilesets produced. Fresh Wang generations failed with "Unknown error" within seconds (immediate API rejection). Chained generations using predetermined base tile ids reached 90% completion before failing with "Generation completed but no tiles were produced". Failure was independent of prompt length, prompt content, and chain status. Generations spanned ~6 minutes wall clock. The PixelLab team server (`mcp__pixellab-team__create_topdown_tileset`) appears to be in a degraded state during this window. Build loop paused; operator decides whether to retry later, switch servers, or defer PixelLab content to a follow-up phase.

## Current job IDs (all 5 in flight)

| # | plan_id | active_tileset_id | parent_tileset_id_if_failed | status_at_last_check | lower_base_id | upper_base_id |
|---|---|---|---|---|---|---|
| 1 | ashen-isle-grass-sand | `79aa8340-3112-42fb-89f3-7be9814d010d` (3rd attempt — stripped prompt) | cff7362c, bf213f1d (BOTH FAILED with full prompt) | processing ~100s | 3aed75ee-29fa-450d-8466-452e7d7c5c8e (grass) | 139de020-27c7-4bde-8096-a2d6c431967c (sand) |
| 2 | ashen-isle-sand-path | `43bc42cb-1f25-4b65-a36e-c59d4cb80a2a` | — | 90% @ 45s ETA | b6f464bc-... (sand, chained from FAILED #1 cff7362c — see note below) | 6412cf21-6392-46af-a96f-6e90a6830ae9 (path) |
| 3 | fog-marsh-floor-path | `7e699904-f0a5-4585-9a35-f8f7dee8220c` (3rd attempt — stripped prompt) | ec818e0d, 09e1621b (BOTH FAILED with full prompt) | processing ~100s | 173c3739-1f7c-46a8-94b9-1d286d5857df (marsh-floor) | 4b554828-8c84-497a-82f7-2766e9c8dcd7 (path) |
| 4 | fog-marsh-floor-water | `4ab2e6db-f9d8-42c7-ab1a-0b76a5a2cc2d` | — | 90% @ 44s ETA | 36858717-... (marsh-floor, chained from FAILED #3 ec818e0d) | b61afb36-4db1-4e5d-a6c5-53c180692455 (water) |
| 5 | fog-marsh-floor-stone | `1f0e8c90-516d-4c83-8d90-e5c4d8fe9331` | — | 90% @ 44s ETA | 36858717-... (marsh-floor, chained from FAILED #3 ec818e0d) | 474659e0-7cae-4f5d-a121-3a550f2246c8 (stone) |

## Generation budget: 9/10 used

Per US-95 done-when "≤ 1 reroll per tileset (10 generations max)". Already exceeded for #1 (3 attempts) and #3 (3 attempts). Required note for verify doc per the spec criterion: "if exceeded, paragraph note in verify doc explaining what changed in the prompt for the successful generation". The change from full to stripped prompt is the variable; the generation log will record this.

## Failed-prompt root cause hypothesis

The first two attempts on #1 and #3 used long prompts containing the full `STYLE_BASE_PROMPT` (palette + line + dither + lighting + avoid sections) plus subject + mood. Both attempts on each tileset failed with "Unknown error" within seconds of being fired — too fast for image content to be involved; the API was rejecting the request itself. The 3rd attempts use a stripped one-line subject + style note ("top-down storybook pixel art, sepia palette only"). If those succeed, the cause is either (a) prompt length over some PixelLab limit, or (b) one of the structured sections in `STYLE_BASE_PROMPT` triggering a content filter (palette / line / avoid). Update on landing.

## Concern: chained tilesets reference failed parents

#2, #4, and #5 fired before #1 and #3 failure was known. They reference the *predetermined* base tile IDs from the failed parents (`b6f464bc...` for sand chained from #1; `36858717...` for marsh-floor chained from #3). PixelLab docs say predetermined base tiles can be used immediately — but those tiles came from a failed generation.

Two outcomes possible:
- **A:** PixelLab's predetermined-tile system is independent of the parent generation outcome — the chained calls produce valid tilesets regardless. Then #2/#4/#5 land successfully and the rerolls #1/#3 land successfully too. **Best case: 5 successful tilesets, 2 generations spent on rerolls (7/10 budget).**
- **B:** The chained calls fail because their reference tile is invalid post-failure. Then we need to re-fire #2/#4/#5 chained from the *new* parent IDs (the rerolls). **Worst case: 2 + 3 more rerolls = 5 rerolls, exceeds the 1-reroll budget for some tiles.** Verify-doc note required per the spec.

## Next actions on wakeup

1. Poll get_topdown_tileset for all 5 active IDs.
2. For each completed tileset, download tilemap.png + tilemap.json to `assets/tilesets/<plan_id>/`.
3. For any remaining failures, decide whether to re-fire (within budget) or escalate to operator.
4. After all 5 PNGs are saved: wire into `src/maps/tilesets.ts` TILESETS registry, register the 16-mask `cornerMaskTable` per tileset, set proper `secondaryTerrain`.
5. Generate atlas previews via atlasPreview.ts; visual verify (sepia-first, hope-gold absence, Wang corner correctness).
6. Update `assets/tilesets/ATTRIBUTION.md` with PixelLab section.
