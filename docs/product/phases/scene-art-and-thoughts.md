# Phase: scene-art-and-thoughts

Status: shipped

> Presentation-layer phase. Locks the project's visual identity into code (`src/art/styleGuide.ts`), replaces the placeholder rectangle in `StoryScene` with real pixel-art beats and cross-fade transitions, and fixes thought-bubble readability. PixelLab is the chosen generator; this phase wires the rendering pipeline and produces the static beats. Animated beats remain a future upgrade — the asset manifest carries `kind` so a beat can swap to `animated` without StoryScene rework.

## Design direction

Locked by `docs/art-style.md` and `docs/art-style-palette.png`. Source of truth: Joe Sutphin's *Little Pilgrim's Progress* — graphite storybook illustration, sepia/grey default with hope-gold (`#F2C95B` / `#E89C2A`) reserved for narrative beats.

**One-line brief:** *Anthropomorphic pilgrims in a graphite-and-sepia storybook world, where gold light is the only thing brave enough to be in color.*

Caveat captured for follow-up scope (NOT this phase): NPC sprites and props of interest may need bolder umber outlines (`#3A2C20`) to read against the cream/sepia world. Tracked as a future regen pass after this phase ships.

## Stories

### US-87 — Aesthetic codex as code [Shipped]

As an art-pipeline operator, I want the project's locked visual identity expressed as a TypeScript module rather than a markdown doc, so that every future generation script (PixelLab, Midjourney, regen passes) composes prompts from the same source and visual identity does not drift across tools.

**Acceptance criteria:**
- A new module `src/art/styleGuide.ts` exists and exports a typed `STYLE_PALETTE` (object literal mapping each role in `docs/art-style.md` to its hex), `STYLE_VIBE_PROMPT` (the one-line brief, verbatim), `STYLE_BASE_PROMPT` (multi-line composition rules covering palette, line, dither, lighting, anti-patterns), and `composeArtPrompt(subject: string, mood?: string): string` which concatenates `STYLE_BASE_PROMPT + subject + (mood ?? '')` in a deterministic order with a single trailing newline.
- `composeArtPrompt('test subject', 'gentle dawn')` returns a string that contains the literal `STYLE_VIBE_PROMPT`, the literal `'test subject'`, and the literal `'gentle dawn'` (test: assertion on substring matches).
- Every hex in `STYLE_PALETTE` matches the corresponding hex in `docs/art-style.md` byte-for-byte (test: per-role string equality, e.g., `STYLE_PALETTE.hopeGoldLight === '#F2C95B'`).
- The codex is consumed by at least one other module in this phase (`tools/generate-scene-art.ts`) — verifiable by `grep -r "from.*art/styleGuide"` returning ≥ 2 hits.
- The module has zero Phaser imports — `import` analysis (or build-time circular check) confirms `src/art/styleGuide.ts` does not transitively pull `phaser`, so it remains usable in Node-side tooling scripts.

**User guidance:**
- Discovery: N/A — internal art-pipeline contract, not exposed to end-users.
- Manual section: N/A — internal.
- Key steps: N/A — internal contract; consumed by future generation scripts.

**Design rationale:** Markdown documents drift; TypeScript modules don't. Once the codex is `import`-able, every generator that asks for an asset is forced to start from the same base prompt. This is the cheapest possible visual-identity lock.

### US-88 — Thought bubble readability [Shipped]

As a player reading Pip's thoughts, I want the on-screen text to be sharp, fully visible, and visually consistent with the storybook aesthetic, so that ambient narration feels like part of the world rather than a debug overlay.

**Acceptance criteria:**
- `systems/thoughtBubble.ts` uses the same design-pixel + zoom-scale pattern as `systems/dialogue.ts`: a private `s(v)` helper that scales design pixels by camera zoom, with constants in design pixels (e.g., `FONT_SIZE_DESIGN = 14`). The literal `fontSize: '${FONT_SIZE}px'` with a world-pixel value is removed.
- Multi-line thought text renders correctly. The shipped `homecoming-reflection` thought (3 lines via `\n`) displays all three lines in the bubble — verifiable by inspecting `currentText.text` after the trigger fires (must contain two `\n` characters and the bubble's measured height must be ≥ 3 × line-height).
- Long single-line thoughts wrap to a max of `THOUGHT_MAX_WIDTH_DESIGN` design pixels (proposed 220) via `wordWrap.width`. Verifiable on the `room-echo` thought displayed at a narrow viewport (e.g., 360 × 640 mobile) — text must wrap to ≥ 2 lines, no horizontal overflow past the panel edge.
- Panel uses `Phaser.GameObjects.Graphics.fillRoundedRect` with corner radius `THOUGHT_CORNER_RADIUS_DESIGN` (proposed 6) and a 1-design-pixel umber stroke (`#3A2C20`, `STYLE_PALETTE.umberDark` from US-87) over a Page-cream fill (`#F2EAD6`, `STYLE_PALETTE.creamLight`) at alpha 0.92. The previous flat `Phaser.GameObjects.Rectangle` at `0x222244` is removed.
- Text color is umber-dark (`#3A2C20`) not white — readable against cream backing per the storybook palette. Verifiable by inspecting `Phaser.GameObjects.Text.style.color`.
- Resize regenerates the panel + text at the new zoom in the same path that dialogue uses — bubble width, height, and text wrap re-flow on `scale.on('resize', …)`. Verifiable by triggering a thought, resizing the canvas, and confirming the panel still bounds the text.
- Camera ignore is preserved: the UI camera ignores both `currentBg` and `currentText` so they render only on the main camera (existing behavior, must not regress).
- Reset hygiene (Learning EP-02): `currentBg`, `currentText`, `dismissTimer` are reset to `null` at the top of `displayThought()`, AND a `scene.events.shutdown` handler clears any in-flight bubble. Verifiable by triggering a thought, calling `scene.restart`, and confirming no stale `Phaser.GameObjects.Text` lingers in `scene.children.list`.

**User guidance:**
- Discovery: Walks past any thought trigger in either area (e.g., spawn-adjacent `start-thought` on Ashen Isle).
- Manual section: New section in `docs/plan/scene-art-and-thoughts-manual-verify.md` — "Thought bubble visual + readability check" with explicit per-thought checkboxes for the multi-line `homecoming-reflection` and the wrapping `room-echo`.
- Key steps: (1) Walk Pip into a thought trigger. (2) Confirm text is sharp at desktop zoom. (3) Confirm multi-line text shows all lines. (4) Confirm long thoughts wrap rather than overflow. (5) Resize browser; confirm bubble re-flows.

**Design rationale:** The current bubble fails three orthogonal tests at once — sharpness (world-pixel text sampled at fractional zoom), bounding (single-line, no wrap), and tonality (cool blue against the warm sepia world). One fix sweep that adopts the dialogue system's existing zoom-scale pattern is the smallest change that addresses all three.

### US-89 — Story scene image rendering + cross-fade [Shipped]

As a player watching a story scene, I want each beat's narrative image to render as actual pixel art and cross-fade smoothly into the next beat's image, so that the story scene reads as an illustrated cutscene rather than a labeled placeholder.

**Acceptance criteria:**
- `StoryScene.preload()` iterates the `SCENE_ASSETS` registry from US-90 and loads each beat's PNG by key `scene-<sceneId>-<beatIndex>` from `assets/scenes/<sceneId>/beat-<n>.png`. Missing files log a warning naming `(sceneId, beatIndex, expected path)` and skip — they fall back to the existing rectangle + label.
- Beat display uses `Phaser.GameObjects.Image` (or `Sprite` when the manifest entry's `kind === 'animated'`) at design depth covering the upper `IMAGE_HEIGHT_RATIO` portion of the scene. Image is scaled to fit width while preserving aspect ratio (letterbox top/bottom with `STYLE_PALETTE.creamLight` if needed).
- Cross-fade between beats: on `advanceBeat()`, the outgoing image tweens `alpha: 1 → 0` over `BEAT_FADE_DURATION_MS = 400` while the incoming image starts at `alpha: 0` on top and tweens to `alpha: 1` over the same duration. The outgoing image is `destroy`-ed in the tween's `onComplete`. Verifiable by inspecting tween state mid-fade — both images must coexist for `BEAT_FADE_DURATION_MS - epsilon`.
- Cross-fade re-entrancy guard: a `crossFadeInProgress` instance flag is set true when the outgoing tween starts and cleared in its `onComplete`. `advanceBeat()` returns early when the flag is true (the second tap is a no-op). The typewriter early-completion path (existing two-tap pattern) is preserved; the new guard only applies after the typewriter is complete and the cross-fade tween is running. Verifiable by triggering rapid pointer-up advances within `BEAT_FADE_DURATION_MS` — exactly one tween chain runs and no stale `Phaser.GameObjects.Image` lingers in `scene.children.list`.
- StoryScene depth ordering is explicit, not creation-order-dependent: image layer = 0; fallback rectangle = 0 (mutually exclusive with the image layer — never both rendered for the same beat); panel graphics = 10; beat text = 11; advance hint = 12; image label (placeholder fallback) = 1. Documented inline in `StoryScene.ts` as a one-block comment matching the AGENTS.md depth-map convention. Verifiable by file inspection — every `add.image / add.text / add.graphics / add.rectangle` call in `StoryScene.ts` has an explicit `setDepth(...)` immediately after construction.
- Fallback path: when a beat has no manifest entry OR the loaded texture is missing on advance, the existing flat-color rectangle + `imageLabel` placeholder renders unchanged. Verifiable by deleting an asset PNG, walking the trigger, and confirming the label-only rendering still appears (regression-safe).
- Reset hygiene (Learning EP-02): `imageRect`, `imageLabel`, `panelGraphics`, `beatText`, `advanceHint`, plus new `currentBeatImage` and `previousBeatImage` and any `Phaser.Tweens.Tween` references are reset at the top of `create()` AND tweens are removed in `cleanupResize`. Verifiable by triggering a story scene, exiting via `scene.stop`, re-entering via a fresh trigger, and confirming no stale image objects render.
- Resize handling: on `scale.on('resize', …)` the current image re-positions and re-scales to the new `IMAGE_HEIGHT_RATIO` portion. Verifiable by entering a story scene, resizing the browser, and confirming the image re-fits without overflow.
- Per-scene render verification (Rule 4a variant baseline): every shipped story scene renders correctly with its assets. The manual-verify checklist must enumerate `ashen-isle-intro` (4 beats), `ember-given` (3 beats), and `marsh-depths` (2 beats) as separate checkboxes — silently relying on "it works for one scene" is rejected.
- Animation-ready interface (no behavior in this phase): `BeatAsset.kind === 'animated'` is a recognized type but is NOT exercised in this phase. A done-when criterion verifies that the codepath that would handle `animated` is gated behind a `kind === 'animated'` switch and currently throws a `console.warn('animated beats not yet exercised')` when encountered, rather than silently rendering a black frame.

**User guidance:**
- Discovery: Trigger any of the three shipped story scenes — Ashen Isle south interior (`ashen-isle-vision` after speaking to Old Man), Fog Marsh Keeper rescue (chained from `keeper-intro` dialogue), or Fog Marsh `marsh-vision` (after speaking to Marsh Hermit).
- Manual section: `docs/plan/scene-art-and-thoughts-manual-verify.md` — "Story scene art + transition check" with per-scene per-beat checkboxes.
- Key steps: (1) Trigger each story scene. (2) Confirm a real pixel-art image (not a flat rectangle) shows on each beat. (3) Confirm the image cross-fades when advancing. (4) Confirm the typewriter text still works as before.

**Design rationale:** Cross-fade rather than hard-cut because a hard cut on a static image looks like a slideshow; cross-fade reads as illustrated narration. Image-aspect preserved with letterbox over flat scale because squashing a 1:1 PixelLab output to a 16:9 viewport mangles the art — letterboxing in cream is a deliberate storybook gesture.

### US-90 — Scene asset manifest + StoryBeat asset hook [Shipped]

As an art-pipeline operator, I want a single typed registry mapping each story scene's beats to their image assets, so that the StoryScene loader, the generation tool, and the cost-mapping table all read from one source.

**Acceptance criteria:**
- A new module `src/art/sceneAssets.ts` exists and exports `SCENE_ASSETS: Record<string, BeatAsset[]>` keyed by `storySceneId`, ordered by beat index.
- `BeatAsset` is a discriminated union: `{ kind: 'static', file: string, prompt: string, mood?: string }` and `{ kind: 'animated', file: string, frames: number, fps: number, prompt: string, mood?: string }`. Every entry's `prompt` field is a non-empty string; `composeArtPrompt(prompt, mood)` from US-87 produces the generation-ready prompt.
- `SCENE_ASSETS` covers all three shipped scenes with entries for every beat: `ashen-isle-intro` (4 entries), `ember-given` (3 entries), `marsh-depths` (2 entries) — total 9 entries. Verifiable by `Object.keys(SCENE_ASSETS).length === 3` AND `Object.values(SCENE_ASSETS).flat().length === 9`.
- Optional `StoryBeat.assetRef?: string` field is added to `data/areas/types.ts`. When set, lookup uses the override key; when absent, lookup defaults to `<sceneId>:<index>`. Existing beats continue to work without explicit `assetRef`.
- The manifest's `file` path is consistent: every entry has `file` matching the pattern `scenes/<sceneId>/beat-<n>.png` (test: regex assertion on every entry).
- The cost table in this phase spec sums to ≤ 12 PixelLab generations (9 static + budget for re-rolls), and that budget number is the same number written in `tools/generate-scene-art.ts` as the scripted iteration count.

**Consumer adaptation:** `SCENE_ASSETS.file` is a consumer-neutral relative path matching `scenes/<sceneId>/beat-<n>.png`. Two consumers prepend their own root: `StoryScene.preload` calls `this.load.image('scene-...', \`scenes/${file}\`)` (Vite's `publicDir = 'assets'` resolves the URL); `tools/generate-scene-art.ts` resolves to `path.join(projectRoot, 'assets', file)` (Node-side absolute path for output writing). Done-when (consumer adaptation): both consumers reference `SCENE_ASSETS[*].file` without hardcoding an absolute path; a grep for `'/assets/scenes/'` literal returns zero hits in either consumer.

**User guidance:** N/A — internal art-pipeline contract.

**Design rationale:** A separate manifest decouples authoring (scene-level beats live in `data/areas/`) from asset lookup (image keys live in `art/sceneAssets.ts`). Same pattern the project already uses for `npcSprites.ts` and `tilesets.ts`.

### US-91 — Generate static scene art for shipped beats [Shipped]

As an art-pipeline operator, I want a runnable script that walks the manifest from US-90, composes each beat's prompt through US-87's codex, calls PixelLab via the MCP, and saves PNGs into `assets/scenes/<sceneId>/`, so that I can produce the 9 shipped beats deterministically and re-roll any single beat without reshooting the rest.

**Acceptance criteria:**
- A new tool `tools/generate-scene-art.ts` exists. It imports `SCENE_ASSETS` from US-90 and `composeArtPrompt` from US-87. For each entry it logs the composed prompt, the target output path, and a generation-call descriptor. The script is **invocation-printing**, not auto-firing — it prints the exact `mcp__pixellab__create_object` arguments to stdout for the operator to submit through their MCP-enabled session, since MCP tool calls require the agent context.
- Running `npx tsx tools/generate-scene-art.ts` exits 0 and prints exactly 9 invocation blocks (no animated beats this phase).
- The 9 beat assets are present at the expected paths and load successfully in `StoryScene.preload`. Verifiable by running `npm run dev` and confirming no `texture missing` warnings for any of the 9 keys.
- The cost table below in this spec is reconciled against the actual generation count after the phase ships: a `## Cost reconciliation` section in `docs/plan/scene-art-and-thoughts-manual-verify.md` records the actual generations spent (including re-rolls).
- Each generated asset visually matches the storybook codex per a sepia-first read test: turn off chroma in any image-viewer (or inspect a luminance-only screenshot) and confirm the silhouettes of the named subject (e.g., the heron Keeper, Pip standing, the smoke trail) are distinguishable against the background at 50% scale — Rule 31 from `docs/art-style.md` ("a frame should read in sepia first, then color second"). Verifiable as a manual checkbox per asset, accompanied by a one-sentence note in the manual-verify doc recording the named subject distinguishable in luminance-only view.
- Per-asset chroma audit (design-direction traceability): `ember-given` beat 0 (Keeper draws near) AND beat 1 (ember passes) are the only assets whose dominant non-sepia chroma is hope-gold (`#F2C95B` / `#E89C2A` family). The 4 `ashen-isle-intro` beats and 2 `marsh-depths` beats register as sepia-dominant when chroma-sampled — verifiable by sampling the histogram peak in any image tool and confirming gold is < 5% of pixels for sepia-classified beats. Manual checkbox per asset (9 entries).

**User guidance:**
- Discovery: Run `npx tsx tools/generate-scene-art.ts` from the project root.
- Manual section: `docs/plan/scene-art-and-thoughts-manual-verify.md` — "Asset generation walkthrough" with per-beat sepia-first read test checkboxes.
- Key steps: (1) Run the script, (2) Submit each printed MCP invocation, (3) Save the result PNGs to the named paths, (4) Run `npm run dev` and walk through each story scene to verify in-engine.

**Design rationale:** Invocation-printing avoids hard-coding MCP plumbing into a Node tool — the script prints prompts, the operator (or this agent) fires the MCP calls. Re-rolling a single beat is a single line edit in the manifest's `prompt` field.

## Cost mapping (PixelLab)

Source: `SCENE_ASSETS` from US-90.

| Scene | Beat | Subject | Mood | Kind | Generations |
|---|---|---|---|---|---|
| ashen-isle-intro | 0 | Ashen sky | grey, drifting ash | static | 1 |
| ashen-isle-intro | 1 | Cracked earth, faint warmth from below | parched, hopeful undertone | static | 1 |
| ashen-isle-intro | 2 | Distant smoke trail on horizon | quiet hint of presence | static | 1 |
| ashen-isle-intro | 3 | Pip standing, heart heavy | introspective, weight | static | 1 |
| ember-given | 0 | Heron Keeper steps through fog | warm gold catching feathers | static | 1 |
| ember-given | 1 | Spark passes from Keeper to Pip | hope-gold radiant moment | static | 1 |
| ember-given | 2 | Fog parts, dim path returns south | pale dawn, gentle relief | static | 1 |
| marsh-depths | 0 | Glow under murky water, coal-not-dying | faint warmth in green-grey | static | 1 |
| marsh-depths | 1 | Voice felt in the fog | unspoken presence | static | 1 |
| **Total this phase** | | | | | **9** |

**Future upgrade-path budget (NOT this phase):**
- `ember-given` beats 0–1 swap to `kind: 'animated'` with `frames: 4, fps: 8` (single-direction loops). Estimated +2 generations via PixelLab template `animate_object`.
- Total upgrade-ready budget: 11 generations.

PixelLab free tier was 40 with 14 used in research → 26 remaining. This phase spends 9 of those, leaving ~17. Comfortably within budget.

## Safety criteria

Safety criteria: **N/A** — this phase introduces no API endpoints, user-input fields, query interpolation, or LLM-generated output rendered to clients. The PixelLab MCP tool calls in US-91 are operator-mediated and accept only hardcoded constants (the `prompt` and `mood` fields stored in `src/art/sceneAssets.ts`); generated PNGs are written to disk and loaded as static textures, not embedded in any rendered HTML. The aesthetic codex (US-87) accepts only literal-string inputs from in-repo callers and does not transit user input.

## Done-when (observable)

### US-87 — Aesthetic codex
- [ ] `src/art/styleGuide.ts` exists and exports `STYLE_PALETTE`, `STYLE_VIBE_PROMPT`, `STYLE_BASE_PROMPT`, `composeArtPrompt` [US-87]
- [ ] Test or smoke check: `composeArtPrompt('test subject', 'gentle dawn')` returns a string containing `STYLE_VIBE_PROMPT` AND `'test subject'` AND `'gentle dawn'` [US-87]
- [ ] Every hex in `STYLE_PALETTE` matches `docs/art-style.md` byte-for-byte (string equality on each role) [US-87]
- [ ] `grep -r "from.*art/styleGuide" src tools` returns ≥ 2 distinct files [US-87]
- [ ] `src/art/styleGuide.ts` has no Phaser import (file inspection) [US-87]

### US-88 — Thought bubble readability [Shipped]
- [ ] `systems/thoughtBubble.ts` defines a private `s(v)` helper and uses design-pixel constants (e.g., `FONT_SIZE_DESIGN`); the world-pixel `FONT_SIZE = 10` literal is removed [US-88]
- [ ] `homecoming-reflection` thought displays 3 lines in the bubble; bubble height ≥ 3 × line-height (manual + DOM/scene-children inspection) [US-88]
- [ ] At a 360 × 640 viewport, the `room-echo` thought wraps to ≥ 2 lines, no horizontal overflow past the panel edge (manual) [US-88]
- [ ] Panel uses `fillRoundedRect` with `STYLE_PALETTE.creamLight` fill at α 0.92 and a 1-design-pixel `STYLE_PALETTE.umberDark` stroke; the previous `Phaser.GameObjects.Rectangle` at `0x222244` is removed (file inspection) [US-88]
- [ ] Text color is `STYLE_PALETTE.umberDark` (or the verbatim hex `#3A2C20`); not `#ffffff` (file inspection) [US-88]
- [ ] Resize event re-flows panel + text — bubble bounding still wraps text after `scale.refresh()` (manual at multiple viewport sizes: 360×640, 768×1024, 1280×800) [US-88]
- [ ] UI camera ignores both `currentBg` and `currentText` (file inspection: `uiCam.ignore` calls retained) [US-88]
- [ ] `displayThought()` opens by resetting `currentBg`, `currentText`, `dismissTimer` to null; `scene.events.shutdown` handler clears in-flight bubble (file inspection + restart smoke test) [US-88]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Thought bubble visual + readability check" lists explicit checkboxes for `start-thought`, `room-echo`, `homecoming-reflection`, `marsh-deepens`, escape-attempt subscriber thoughts, and `ashen-isle-mark` [US-88]

### US-89 — Story scene image rendering + cross-fade [Shipped]
- [ ] `StoryScene.preload()` iterates `SCENE_ASSETS` from US-90 and loads each entry by key `scene-<sceneId>-<beatIndex>` (file inspection) [US-89]
- [ ] Missing-file path: a deliberately-deleted asset logs a warning with `(sceneId, beatIndex, expected path)` and falls back to the existing flat-color rectangle + label without crashing (manual: rename one file, walk the trigger, confirm fallback renders) [US-89]
- [ ] Cross-fade: on `advanceBeat()`, outgoing and incoming image tweens both run with `BEAT_FADE_DURATION_MS = 400`; both images coexist mid-tween (file inspection + manual frame-by-frame check) [US-89]
- [ ] Outgoing image is `destroy`-ed in the tween's `onComplete` (file inspection) [US-89]
- [ ] Cross-fade re-entrancy guard: `crossFadeInProgress` flag set true when outgoing tween starts and cleared in `onComplete`; `advanceBeat()` returns early when true; rapid double-tap within `BEAT_FADE_DURATION_MS` produces exactly one tween chain — verifiable by file inspection + manual rapid-tap test confirming `scene.children.list` contains no stale image objects post-fade [US-89]
- [ ] StoryScene depth ordering: every `add.image / add.text / add.graphics / add.rectangle` call in `StoryScene.ts` has an explicit `setDepth(...)` (image=0, fallback rect=0 mutually exclusive, panel=10, beat text=11, advance hint=12, image label=1); documented inline as a one-block comment (file inspection + grep: every `add.*\(` followed within 3 lines by `setDepth`) [US-89]
- [ ] Image preserves aspect ratio with cream-letterbox fill when needed; no squash (manual: verify on 16:9 desktop and 9:19.5 mobile) [US-89]
- [ ] Reset hygiene: `imageRect`, `imageLabel`, `panelGraphics`, `beatText`, `advanceHint`, `currentBeatImage`, `previousBeatImage`, plus any image-tween refs are reset to null at the top of `create()`; tweens cleared in `cleanupResize` (file inspection + restart smoke test) [US-89]
- [ ] Resize handling: on `scale.on('resize', …)` the current image re-positions and re-scales with no overflow (manual at three viewport sizes) [US-89]
- [ ] **Per-scene variant baseline (Rule 4a):** manual checklist enumerates each shipped scene as a separate checkbox — `ashen-isle-intro` beats 0–3, `ember-given` beats 0–2, `marsh-depths` beats 0–1 — total 9 per-beat checkboxes [US-89]
- [ ] `kind === 'animated'` codepath logs `console.warn('animated beats not yet exercised')` and falls back to a static frame; never silently renders a black image (file inspection + targeted manifest entry test) [US-89]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Story scene art + transition check" lists per-scene per-beat checkboxes per the variant baseline above [US-89]

### US-90 — Scene asset manifest
- [ ] `src/art/sceneAssets.ts` exists and exports `SCENE_ASSETS` and `BeatAsset` types (file inspection) [US-90]
- [ ] `BeatAsset` is a discriminated union with both `kind: 'static'` and `kind: 'animated'` shapes; every entry's `prompt` is a non-empty string (file inspection + type-check via `npx tsc --noEmit`) [US-90]
- [ ] `Object.keys(SCENE_ASSETS).length === 3` AND `Object.values(SCENE_ASSETS).flat().length === 9` (smoke assertion or runtime log) [US-90]
- [ ] `data/areas/types.ts` adds optional `StoryBeat.assetRef?: string` field; existing beats compile without modification (file inspection + tsc) [US-90]
- [ ] Every entry's `file` matches the regex `^scenes/[a-z-]+/beat-[0-9]+\.png$` (smoke assertion) [US-90]
- [ ] The cost-table generation count (`9`) equals `Object.values(SCENE_ASSETS).flat().length` AND equals the iteration count printed by `tools/generate-scene-art.ts` from US-91 [US-90]
- [ ] Consumer adaptation: both `StoryScene.preload` and `tools/generate-scene-art.ts` reference `SCENE_ASSETS[*].file` without hardcoding an absolute path; `grep -nF "/assets/scenes/" src tools` returns zero hits in either consumer [US-90]

### US-91 — Generate static scene art
- [ ] `tools/generate-scene-art.ts` exists, imports from `art/sceneAssets.ts` and `art/styleGuide.ts`, and prints exactly 9 MCP-invocation blocks when run via `npx tsx` (manual run) [US-91]
- [ ] Each printed invocation includes the composed prompt (passing `STYLE_VIBE_PROMPT` substring assertion) and the target output path matching the manifest entry's `file` (manual run) [US-91]
- [ ] All 9 PNG assets exist on disk under `assets/scenes/<sceneId>/beat-<n>.png` (`ls assets/scenes/`) [US-91]
- [ ] `npm run dev` boots and walks through each shipped story scene with no `texture missing` warnings for the 9 keys (manual) [US-91]
- [ ] Sepia-first read test: each generated asset, when viewed with chroma removed at 50% scale, has distinguishable silhouettes of its named subject — manual checkbox per asset (9 total), each accompanied by a one-sentence note in the manual-verify doc recording what is distinguishable [US-91]
- [ ] Per-asset chroma audit: `ember-given` beats 0 and 1 are hope-gold-dominant (gold-family pixels >= 10% of the image); the other 7 assets are sepia-dominant (gold-family pixels < 5%); manual checkbox per asset using any image-histogram tool [US-91]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Asset generation walkthrough" exists with per-beat sepia-first read checkboxes AND a `## Cost reconciliation` section recording actual generations spent (re-rolls included) [US-91]

### Phase-level
- [ ] `AGENTS.md` reflects new modules introduced (`src/art/styleGuide.ts`, `src/art/sceneAssets.ts`, optional `StoryBeat.assetRef`), updated `StoryScene` ownership, and updated `ThoughtBubbleSystem` ownership [phase]
- [ ] `npx tsc --noEmit && npm run build` passes [phase]

## AGENTS.md sections affected
- File ownership table — `scenes/StoryScene.ts` (image layer + cross-fade); `systems/thoughtBubble.ts` (design-pixel + zoom-scale, multi-line, rounded panel); add rows for `art/styleGuide.ts`, `art/sceneAssets.ts`.
- Behavior rules — add bullet for "Story scene image rendering" (asset-keyed beat images with cross-fade transition + cream-letterbox aspect-preserve); add bullet for "Thought bubble rendering" upgrade (design-pixel scaling, multi-line wrap, rounded sepia panel).
- Depth map — no new layers; thoughts and story-scene rendering stay at their existing depths.
- Directory layout — add `src/art/`, `assets/scenes/<sceneId>/beat-<n>.png` paths, `tools/generate-scene-art.ts`.

## Golden principles (phase-relevant)

From `AGENTS.md`:
- Learning EP-01 (loop-invariant + dead-guard prevention): image swaps on beat advance, not per frame; thought bubble panel rebuilt only on resize, not every update tick.
- Learning EP-02 (`scene.restart` hygiene): all new GameObject refs (image layers, tweens, in-flight thought bubbles) reset at the top of their re-create method; tweens cleared in `cleanupResize`.
- "Visual reads-as test" (compounded done-when rule): every new visual element has at least one done-when criterion stating what it should communicate (sepia-first read for scene art; readable cream-on-umber for thoughts).
- "Variant baseline check" (Rule 4a): the StoryScene image layer affects all 3 shipped scenes — manual-verify enumerates each scene + beat as a separate checkbox.
- "No silent failures" — missing assets and unexercised animated kind log explicit warnings; fallback rendering still works.

## Manual verification

A new doc `docs/plan/scene-art-and-thoughts-manual-verify.md` will hold the structured checklist:
- Thought bubble visual + readability (US-88) — per-thought checkboxes
- Story scene art + transition (US-89) — per-scene per-beat checkboxes (9 entries)
- Asset generation walkthrough (US-91) — per-asset sepia-first read checkboxes (9 entries)
- Cost reconciliation table (US-91) — generations spent vs. budgeted
