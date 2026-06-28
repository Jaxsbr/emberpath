# Lessons & Solutions — the ledger

This is emberpath's **consult-every-time** memory: the failures we keep repeating,
each captured once with a *test* so we stop repeating them. `ce-compound` appends
here at the end of every unit of work.

**Read the lessons that match your task BEFORE you start it** (the `applies_when`
line on each). The `emberpath-art-review` gate **fails any change that violates an
art lesson here** — so a lesson is a hard rule, not a suggestion.

## Guardrail lessons (the recurring failures)

| Lesson | Applies when | One-line rule |
|--------|--------------|---------------|
| [art/3-4-oblique-not-iso](art/3-4-oblique-not-iso.md) | Generating/placing ANY sprite, tile, building, prop | Top + **exactly one** front face. No pure-overhead, no iso. |
| [art/ground-shadow-canon](art/ground-shadow-canon.md) | Touching any shadow, or adding any entity/building | Buildings → **rectangle**; everything else → soft **ellipse** at the contact line. One light. |
| [art/cluster-not-scatter](art/cluster-not-scatter.md) | Writing any object-placement array | Clusters of 2–4 + dense undergrowth + deliberate clearings. Never a sprinkle. |
| [process/gif-for-motion](process/gif-for-motion.md) | Anything with movement/flow/animation | Demonstrate with a **GIF**, never a still. |
| [process/never-edit-off-unseen-annotation](process/never-edit-off-unseen-annotation.md) | Feedback points at a screenshot/annotation | If the image didn't actually attach, **STOP and ask** — never guess. |
| [content/reading-level-young-child](content/reading-level-young-child.md) | Writing/changing any player-facing text | Young-child reading level; allegory survives the simplification. |
| [content/sacred-words-not-loose](content/sacred-words-not-loose.md) | Writing ANY text (docs, comments, commits, chat) | "Bible"/"Scripture" only for the actual Scriptures — never as a metaphor for "the authoritative doc" (use canon/source of truth/guide). |
| [implementation/area-transition-uses-exit-entrypoint](implementation/area-transition-uses-exit-entrypoint.md) | Changing an area's walkable geometry, or adding a transition testbench scenario | Transitions spawn at the **source exit's `entryPoint`**, not the dest `playerSpawn` — audit every inbound exit when geometry moves; benches must walk the real exit→entry path. |
| [implementation/tall-building-collision-band-at-base](implementation/tall-building-collision-band-at-base.md) | Giving a tall building a `collisionFootprint`, or enabling walk-behind on a house | Band at the **front-wall BASE** (low), never mid-roof — leave the roof walkable so Pip tucks under and the fade fires. `collisionFootprint` = collision; `baseFootprint` = Y-sort/fade only. Prove with an MP4. |
| [implementation/authoring-tool-shares-render-math](implementation/authoring-tool-shares-render-math.md) | Building any "tune-it-in-browser, save-to-data" editor (shadows, collision, placement), or adding authored per-kind data that replaces a computed default | Editor preview and renderer call **one shared math fn** (no drift). Authored data overrides a heuristic default by strict precedence (`noShadow > authored > default`) so unauthored kinds are untouched → migrate one kind at a time, zero regression. One editor serves both families via `?target=`. Scale.RESIZE → canvas px == page px for precise Playwright capture. |
| [implementation/lossless-spritesheet-pack-with-ffmpeg-psnr](implementation/lossless-spritesheet-pack-with-ffmpeg-psnr.md) | Per-frame PNGs are killing load time; combining images must not change a pixel; wiring Phaser to a packed sheet | Pack with ffmpeg `tile`; **prove byte-identity** by cropping each cell back and asserting **PSNR=inf** (packer throws otherwise); address frames by a committed manifest **index**, not filename. Pixel-identical → self-merges, not a GATE-2 art change. |
| [implementation/instant-paint-html-loader-before-bundle](implementation/instant-paint-html-loader-before-bundle.md) | A black screen shows until the JS bundle parses; you want first-paint at zero asset cost | Loader is **inline HTML/CSS in index.html before the `<script>`** (paints on first byte); dismiss from a Phaser-free, node-testable bridge on first **POST_RENDER**. It's a **new visual → GATE-2** before merge. |
| [implementation/per-area-lazy-load-via-scene-restart](implementation/per-area-lazy-load-via-scene-restart.md) | Splitting an up-front "load every area" preload into per-area loading; any "create at neutral value, then ramp to real" pair whose create step can become async | Let `scene.restart()` re-run `preload()` (loader skips cached keys) — load only the boot area; transitions top up. Derive the asset set from the **same data the renderer reads** (over-include tilesets). **Trap:** lazy-loading makes `startMusic(k,0)` async, so the following `fadeMusic(k,target)` finds no voice → bed silent; **stash the pending ramp, apply it when the deferred start lands.** Test the deferred path against the **real** backend. |
| [process/benchmark-driven-with-baseline-and-failing-test](process/benchmark-driven-with-baseline-and-failing-test.md) | Any "make it faster/lighter/load better" task | Capture a headless **baseline first**, write a test that **FAILS on current**, re-bench **after each step**; foundational steps may not move the number until final wiring — trust the chain. Report measured numbers, not effort. |

## Where the full canon lives (the lessons point here, don't duplicate it)

- **Art canon** — [`docs/art-style.md`](../art-style.md): palette, texture, characters,
  environments, lighting, **perspective**, **clustering**, **ground-shadow canon**.
- **Scene-layout guide** — [`docs/art-topdown-guide.md`](../art-topdown-guide.md): the
  detailed 3/4-oblique placement guide (trees, paths, buildings, fences, water, …).
- **Technical/code learnings** — [`docs/plan/LEARNINGS.md`](../plan/LEARNINGS.md): the
  EP-## series (Phaser lifecycle, MCP budget, verification gaps). Kept as-is; new
  *code* learnings can go there or here.

## Adding a lesson

`ce-compound` (or by hand): one file under `art/`, `process/`, `content/`, or
`implementation/`. Keep it short — **the failure, the `applies_when` trigger, and the
test that catches it next time** — and add a row to the table above. A lesson without a
testable check is just a note; give it a check.
</content>
