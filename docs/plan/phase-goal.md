# Phase: scene-art-and-thoughts

## Phase goal

Presentation-layer phase. Locks the project's visual identity into code (`src/art/styleGuide.ts`), replaces the placeholder rectangle in `StoryScene` with real pixel-art beats and cross-fade transitions, and fixes thought-bubble readability (multi-line wrap, sharp typography, rounded sepia panel matching the storybook palette). PixelLab is the chosen generator — 9 static beats across the three shipped story scenes (`ashen-isle-intro`, `ember-given`, `marsh-depths`) for ~9 generations, with the asset manifest's `BeatAsset.kind` field reserving an animated path as a future upgrade. Aesthetic direction sourced from `docs/art-style.md` (Joe Sutphin's *Little Pilgrim's Progress* — graphite storybook with hope-gold reserved for narrative beats).

### Stories in scope
- US-87 — Aesthetic codex as code
- US-88 — Thought bubble readability
- US-89 — Story scene image rendering + cross-fade
- US-90 — Scene asset manifest + StoryBeat asset hook
- US-91 — Generate static scene art for shipped beats

### Design direction

Locked by `docs/art-style.md` and `docs/art-style-palette.png`. Source of truth: Joe Sutphin's *Little Pilgrim's Progress* — graphite storybook illustration, sepia/grey default with hope-gold (`#F2C95B` / `#E89C2A`) reserved for narrative beats.

**One-line brief:** *Anthropomorphic pilgrims in a graphite-and-sepia storybook world, where gold light is the only thing brave enough to be in color.*

### Done-when (observable)

#### US-87 — Aesthetic codex
- [ ] `src/art/styleGuide.ts` exists and exports `STYLE_PALETTE`, `STYLE_VIBE_PROMPT`, `STYLE_BASE_PROMPT`, `composeArtPrompt` [US-87]
- [ ] Test or smoke check: `composeArtPrompt('test subject', 'gentle dawn')` returns a string containing `STYLE_VIBE_PROMPT` AND `'test subject'` AND `'gentle dawn'` [US-87]
- [ ] Every hex in `STYLE_PALETTE` matches `docs/art-style.md` byte-for-byte (string equality on each role) [US-87]
- [ ] `grep -r "from.*art/styleGuide" src tools` returns ≥ 2 distinct files [US-87]
- [ ] `src/art/styleGuide.ts` has no Phaser import (file inspection) [US-87]

#### US-88 — Thought bubble readability
- [ ] `systems/thoughtBubble.ts` defines a private `s(v)` helper and uses design-pixel constants (e.g., `FONT_SIZE_DESIGN`); the world-pixel `FONT_SIZE = 10` literal is removed [US-88]
- [ ] `homecoming-reflection` thought displays 3 lines in the bubble; bubble height ≥ 3 × line-height (manual + DOM/scene-children inspection) [US-88]
- [ ] At a 360 × 640 viewport, the `room-echo` thought wraps to ≥ 2 lines, no horizontal overflow past the panel edge (manual) [US-88]
- [ ] Panel uses `fillRoundedRect` with `STYLE_PALETTE.creamLight` fill at α 0.92 and a 1-design-pixel `STYLE_PALETTE.umberDark` stroke; the previous `Phaser.GameObjects.Rectangle` at `0x222244` is removed (file inspection) [US-88]
- [ ] Text color is `STYLE_PALETTE.umberDark` (or the verbatim hex `#3A2C20`); not `#ffffff` (file inspection) [US-88]
- [ ] Resize event re-flows panel + text — bubble bounding still wraps text after `scale.refresh()` (manual at multiple viewport sizes: 360×640, 768×1024, 1280×800) [US-88]
- [ ] UI camera ignores both `currentBg` and `currentText` (file inspection: `uiCam.ignore` calls retained) [US-88]
- [ ] `displayThought()` opens by resetting `currentBg`, `currentText`, `dismissTimer` to null; `scene.events.shutdown` handler clears in-flight bubble (file inspection + restart smoke test) [US-88]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Thought bubble visual + readability check" lists explicit checkboxes for `start-thought`, `room-echo`, `homecoming-reflection`, `marsh-deepens`, escape-attempt subscriber thoughts, and `ashen-isle-mark` [US-88]

#### US-89 — Story scene image rendering + cross-fade
- [ ] `StoryScene.preload()` iterates `SCENE_ASSETS` from US-90 and loads each entry by key `scene-<sceneId>-<beatIndex>` (file inspection) [US-89]
- [ ] Missing-file path: a deliberately-deleted asset logs a warning with `(sceneId, beatIndex, expected path)` and falls back to the existing flat-color rectangle + label without crashing (manual: rename one file, walk the trigger, confirm fallback renders) [US-89]
- [ ] Cross-fade: on `advanceBeat()`, outgoing and incoming image tweens both run with `BEAT_FADE_DURATION_MS = 400`; both images coexist mid-tween (file inspection + manual frame-by-frame check) [US-89]
- [ ] Outgoing image is `destroy`-ed in the tween's `onComplete` (file inspection) [US-89]
- [ ] Cross-fade re-entrancy guard: `crossFadeInProgress` flag set true when outgoing tween starts and cleared in `onComplete`; `advanceBeat()` returns early when true; rapid double-tap within `BEAT_FADE_DURATION_MS` produces exactly one tween chain — verifiable by file inspection + manual rapid-tap test confirming `scene.children.list` contains no stale image objects post-fade [US-89]
- [ ] StoryScene depth ordering: every `add.image / add.text / add.graphics / add.rectangle` call in `StoryScene.ts` has an explicit `setDepth(...)` (image=0, fallback rect=0 mutually exclusive, panel=10, beat text=11, advance hint=12, image label=1); documented inline as a one-block comment (file inspection + grep: every `add.*\(` followed within 3 lines by `setDepth`) [US-89]
- [ ] Image preserves aspect ratio with cream-letterbox fill when needed; no squash (manual: verify on 16:9 desktop and 9:19.5 mobile) [US-89]
- [ ] Reset hygiene: `imageRect`, `imageLabel`, `panelGraphics`, `beatText`, `advanceHint`, `currentBeatImage`, `previousBeatImage`, plus any image-tween refs are reset to null at the top of `create()`; tweens cleared in `cleanupResize` (file inspection + restart smoke test) [US-89]
- [ ] Resize handling: on `scale.on('resize', …)` the current image re-positions and re-scales with no overflow (manual at three viewport sizes) [US-89]
- [ ] Per-scene variant baseline (Rule 4a): manual checklist enumerates each shipped scene as a separate checkbox — `ashen-isle-intro` beats 0–3, `ember-given` beats 0–2, `marsh-depths` beats 0–1 — total 9 per-beat checkboxes [US-89]
- [ ] `kind === 'animated'` codepath logs `console.warn('animated beats not yet exercised')` and falls back to a static frame; never silently renders a black image (file inspection + targeted manifest entry test) [US-89]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Story scene art + transition check" lists per-scene per-beat checkboxes per the variant baseline above [US-89]

#### US-90 — Scene asset manifest
- [ ] `src/art/sceneAssets.ts` exists and exports `SCENE_ASSETS` and `BeatAsset` types (file inspection) [US-90]
- [ ] `BeatAsset` is a discriminated union with both `kind: 'static'` and `kind: 'animated'` shapes; every entry's `prompt` is a non-empty string (file inspection + type-check via `npx tsc --noEmit`) [US-90]
- [ ] `Object.keys(SCENE_ASSETS).length === 3` AND `Object.values(SCENE_ASSETS).flat().length === 9` (smoke assertion or runtime log) [US-90]
- [ ] `data/areas/types.ts` adds optional `StoryBeat.assetRef?: string` field; existing beats compile without modification (file inspection + tsc) [US-90]
- [ ] Every entry's `file` matches the regex `^scenes/[a-z-]+/beat-[0-9]+\.png$` (smoke assertion) [US-90]
- [ ] The cost-table generation count (`9`) equals `Object.values(SCENE_ASSETS).flat().length` AND equals the iteration count printed by `tools/generate-scene-art.ts` from US-91 [US-90]
- [ ] Consumer adaptation: both `StoryScene.preload` and `tools/generate-scene-art.ts` reference `SCENE_ASSETS[*].file` without hardcoding an absolute path; `grep -nF "/assets/scenes/" src tools` returns zero hits in either consumer [US-90]

#### US-91 — Generate static scene art
- [ ] `tools/generate-scene-art.ts` exists, imports from `art/sceneAssets.ts` and `art/styleGuide.ts`, and prints exactly 9 MCP-invocation blocks when run via `npx tsx` (manual run) [US-91]
- [ ] Each printed invocation includes the composed prompt (passing `STYLE_VIBE_PROMPT` substring assertion) and the target output path matching the manifest entry's `file` (manual run) [US-91]
- [ ] All 9 PNG assets exist on disk under `assets/scenes/<sceneId>/beat-<n>.png` (`ls assets/scenes/`) [US-91]
- [ ] `npm run dev` boots and walks through each shipped story scene with no `texture missing` warnings for the 9 keys (manual) [US-91]
- [ ] Sepia-first read test: each generated asset, when viewed with chroma removed at 50% scale, has distinguishable silhouettes of its named subject — manual checkbox per asset (9 total), each accompanied by a one-sentence note in the manual-verify doc recording what is distinguishable [US-91]
- [ ] Per-asset chroma audit: `ember-given` beats 0 and 1 are hope-gold-dominant (gold-family pixels >= 10% of the image); the other 7 assets are sepia-dominant (gold-family pixels < 5%); manual checkbox per asset using any image-histogram tool [US-91]
- [ ] User documentation: `docs/plan/scene-art-and-thoughts-manual-verify.md` § "Asset generation walkthrough" exists with per-beat sepia-first read checkboxes AND a `## Cost reconciliation` section recording actual generations spent (re-rolls included) [US-91]

#### Phase-level
- [ ] `AGENTS.md` reflects new modules introduced (`src/art/styleGuide.ts`, `src/art/sceneAssets.ts`, optional `StoryBeat.assetRef`), updated `StoryScene` ownership, and updated `ThoughtBubbleSystem` ownership [phase]
- [ ] `npx tsc --noEmit && npm run build` passes [phase]

### Golden principles (phase-relevant)

- **Learning EP-01 (loop-invariant + dead-guard prevention):** image swaps on beat advance, not per frame; thought bubble panel rebuilt only on resize, not every update tick; per-frame `update()` allocates zero JS objects in any new code path.
- **Learning EP-02 (`scene.restart` hygiene):** all new GameObject refs (image layers, tweens, in-flight thought bubbles, `currentBeatImage`, `previousBeatImage`, `panelGraphics`, `currentBg`, `currentText`) reset at the top of their re-create method; tweens cleared in `cleanupResize` and on `scene.events.shutdown`.
- **Visual reads-as test:** every new visual element has at least one done-when criterion stating what it should communicate — sepia-first read for scene art (named-subject silhouette distinguishable in luminance-only view); cream-on-umber readable thought bubbles.
- **Variant baseline check (Rule 4a):** the StoryScene image layer affects all 3 shipped scenes — manual-verify enumerates each scene + beat as a separate checkbox; thought bubble fix tested across multiple per-area thought triggers, not "tested with one, assumed for all".
- **No silent failures:** missing assets log a warning naming `(sceneId, beatIndex, expected path)` and fall back to the placeholder rect+label; the `kind === 'animated'` codepath logs `console.warn('animated beats not yet exercised')` rather than rendering a black frame.
- **Show, don't preach (Gospel principle #1, project-level):** the storybook art carries the hope-gold lighting of the narrative beats — color is mechanical, not editorial.
- **Mechanical truth (Gospel principle #2, project-level):** hope-gold reserved for narrative beats means the player sees the gospel-significant moments through composition, not labels.
- **Free gift / no power-projection:** cross-fade rather than hard-cut keeps the storybook tone — the story scene reads as illustrated narration, not as game-feedback animation.
