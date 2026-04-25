## Phase goal

Add character portraits to the dialogue UI so each NPC line reads as "this character is looking at me, and they are speaking now" rather than a name tag above a textbox. Portraits anchor above the dialogue box at its top-left, attached to the box like a speaker bust, and are sourced from the existing PixelLab portrait assets (Old Man and Marsh Hermit). Non-NPC dialogue (e.g. the Whispering Stones trigger) renders without a portrait — the field is optional, so narrative-only dialogues are unaffected. The phase ends when both NPCs visibly look out from above their dialogue box on every conversation, on desktop and on mobile, with the dialogue text width unchanged.

### Stories in scope
- US-56 — Portrait asset, registry, and data wiring
- US-57 — Portrait rendering above the dialogue box (mobile-aware)

### Done-when (observable)

#### Structural — assets & data
- [x] `assets/npc/marsh-hermit/portrait.png` exists (verified: file present, ≥ 1 byte) [US-56]
- [x] `assets/npc/old-man/portrait.png` exists [US-56]
- [x] `vite.config.ts` `publicDir: 'assets'` continues to serve the new portraits without additional config — sample URL `/npc/old-man/portrait.png` returns 200 in `npm run dev` (verified manually) [US-56]
- [x] AGENTS.md "Directory layout" tree is updated to include `assets/npc/<sprite-id>/portrait.png` next to the existing `idle/walk/static/` entries [US-56]
- [x] Portrait registry exists (in `src/systems/npcSprites.ts` or a sibling module) and exposes per-id `{ file, filter }` (or equivalent) for both `marsh-hermit` and `old-man` (verified: source read) [US-56]
- [x] Registry entry for `marsh-hermit` declares `filter: 'nearest'`; entry for `old-man` declares `filter: 'linear'` (verified: source read + matches the per-asset rationale in US-56 design rationale) [US-56]
- [x] Both registered portraits are square aspect (source 1024×1024). Registry documents this assumption inline (e.g. a comment on the registry interface stating "square aspect — non-square portraits are not supported in this phase; render math in DialogueSystem treats portraits as 1:1"). Future non-square portrait support is explicitly out-of-scope and noted as such. [US-56]
- [x] `DialogueScript` in `src/data/areas/types.ts` has optional `portraitId?: string` (verified: source read) [US-56]
- [x] `DialogueNode` in `src/data/areas/types.ts` has optional `portraitId?: string` (verified: source read) [US-56]
- [x] `src/data/areas/ashen-isle.ts` Old Man dialogue script has `portraitId: 'old-man'` at script level [US-56]
- [x] `src/data/areas/fog-marsh.ts` Marsh Hermit dialogue script has `portraitId: 'marsh-hermit'` at script level [US-56]
- [x] `src/data/areas/fog-marsh.ts` Whispering Stones script does NOT set `portraitId` (verifies optional case) [US-56]

#### Structural — preload & filter
- [x] `GameScene.preload()` iterates the portrait registry and loads each portrait under key `npc-portrait-<id>` (verified: source reads from registry, not hardcoded id list) [US-56]
- [x] After preload, for each portrait registry entry with `filter: 'linear'`, `texture.setFilter(Phaser.Textures.FilterMode.LINEAR)` is called on the loaded texture — verified by source read AND by a runtime check that `scene.textures.get('npc-portrait-old-man').source[0].scaleMode` corresponds to LINEAR [US-56]
- [x] Portraits with `filter: 'nearest'` do NOT have `setFilter` called explicitly (they inherit the global `pixelArt: true` default) — verified by source read [US-56]
- [x] **Phaser API contract:** Each portrait is created in `DialogueSystem` as `Phaser.GameObjects.Image` (NOT `Sprite`, NOT `Container`) since portraits do not animate. Verified by source read AND by a smoke check: opening the Old Man dialogue logs no console error, no `setTexture` call against a missing key, no Phaser warning about texture filter mismatch. [US-57]

#### Structural — DialogueSystem rendering
- [x] `DialogueSystem` declares `private portraitImage: Phaser.GameObjects.Image | null = null;` (or equivalent owned reference) [US-57]
- [x] `DialogueSystem.start()` resolves `node.portraitId ?? script.portraitId ?? null` and creates a `Phaser.GameObjects.Image` only when non-null [US-57]
- [x] `DialogueSystem.showNode()` re-resolves the portrait id. If it is unchanged from the previous node, NO `setTexture` call fires (loop-invariant — Learning EP-01). If it changed from the previous node, calls `setTexture('npc-portrait-<newId>')` on the existing image rather than destroying and recreating. If it changed from a value to `null`, the existing image is destroyed; if it changed from `null` to a value, a new image is created. Verified by source read of the four-branch guard. [US-57]
- [x] Portrait is created at depth 200 (Dialogue layer per the depth map — no new depth introduced) [US-57]
- [x] Portrait has `setScrollFactor(0)` and is ignored by the main camera via `ignoreOnMainCamera()` (verified: source read; visual check that no second copy of the portrait scrolls with the world camera) [US-57]
- [x] Portrait origin is set to `(0, 1)` (top-left x, bottom-aligned y) so that setting `y = boxY` puts the portrait flush with the box's top edge (verified: source read) [US-57]
- [x] Portrait render size on desktop is `s(PORTRAIT_DESIGN_SIZE)` where `PORTRAIT_DESIGN_SIZE` is a named module-level constant set to 96 (verified: source read; on a 1024-wide canvas at zoom 1 the rendered portrait is 96 css px) [US-57]
- [x] Portrait render size on mobile clamps to `min(s(PORTRAIT_DESIGN_SIZE), canvasWidth * PORTRAIT_MOBILE_WIDTH_FRACTION)` where `PORTRAIT_MOBILE_WIDTH_FRACTION` is a named module-level constant set to 0.22 (verified: source read; on a 375 px-wide canvas the rendered portrait is ≤ 83 px) [US-57]
- [x] Speaker name label x-position: when a portrait is active, `x = s(BOX_PADDING) + portraitRenderWidth + s(8)`; when inactive, `x = s(BOX_PADDING)` (verified: source read of both branches) [US-57]
- [x] `handleResize()` recomputes portrait position AND render size from current `canvasWidth` and `boxY`, alongside the existing speaker / hint / box repositioning (verified: source read) [US-57]
- [x] `redrawBox()` (called on mobile choice expansion) repositions the portrait to track the new `boxY` (verified: source read; manual check that opening choices on mobile does NOT leave the portrait stranded at the old box position) [US-57]
- [x] `DialogueSystem.close()` destroys the portrait image and sets `portraitImage = null` (verified: source read) [US-57]
- [x] `clearChoices()` does NOT touch the portrait (it persists across choice → next-node transitions within one dialogue script) [US-57]

#### Behavior — NPC-initiated dialogue (US-57)
- [x] Approaching the **Old Man** on Ashen Isle and starting dialogue causes the Old Man portrait to appear at the dialogue box's top-left, bottom-edge flush with box top, on the very first node of the script (verified manually) [US-57]
- [x] Approaching the **Marsh Hermit** on Fog Marsh and starting dialogue causes the Marsh Hermit portrait to appear in the same position (verified manually) [US-57]
- [x] Speaker name "Old Man" / "Marsh Hermit" renders to the right of the portrait, not overlapping it (verified manually + source reads the conditional x-offset) [US-57]
- [x] Across all nodes of a single dialogue script (greeting → choice → continue → close), the portrait stays in place; no flicker on node transitions (verified manually for both NPCs) [US-57]
- [x] Closing the dialogue removes the portrait from the screen (no orphan image left at depth 200) (verified manually + source reads `close()` cleanup) [US-57]
- [x] Re-opening the dialogue (walk away, walk back, Space again) renders the portrait again — no "first-time-only" bug (verified manually for both NPCs) [US-57]

#### Behavior — non-NPC dialogue regression (US-57)
- [x] Triggering the **Whispering Stones** dialogue on Fog Marsh (no `portraitId` set) renders dialogue with NO portrait, speaker name in its original top-left position (`x = s(BOX_PADDING)`), full original text width, and no console error (verified manually + source read of the null-portrait branch) [US-57]

#### Behavior — mobile responsiveness (US-57)
- [x] On a viewport resized to 375×667 (iPhone-class portrait) via DevTools device emulation, the Old Man portrait renders at ≤ `375 * 0.22 = 82.5` css px wide AND its right edge does NOT cross the dialogue box's horizontal midpoint (verified manually with DevTools + screenshot) [US-57]
- [x] On the same 375×667 viewport, the speaker name label renders fully visible to the right of the portrait, not clipped by the canvas edge (verified manually) [US-57]
- [x] On a viewport resized to 1280×720 (desktop) the portrait renders at exactly 96 css px wide (zoom 1) (verified manually) [US-57]
- [x] Rotating the simulated device from portrait to landscape mid-dialogue causes the portrait to reposition + resize without leaving artefacts (verified manually) [US-57]
- [x] Triggering a mobile choice expansion (a node with `choices`) causes the dialogue box to grow upward AND the portrait to move up with it (portrait's bottom edge stays flush with the new `boxY`) (verified manually on a touch-emulated viewport) [US-57]
- [x] After the box collapses back to `BOX_HEIGHT` on the next non-choice node, the portrait moves back down with it (verified manually) [US-57]

#### Variant baseline (per-NPC)
- [x] **Marsh Hermit**: portrait appears on dialogue start (US-57); portrait is pixel-art-faithful (no soft bilinear smoothing on the source pixels — `nearest` filter inherited from global) (US-56); portrait stays anchored across all nodes; portrait disappears on close [US-56]
- [x] **Old Man**: portrait appears on dialogue start (US-57); portrait downscales smoothly (no nearest-neighbor mush — `linear` filter applied) (US-56); portrait stays anchored across all nodes; portrait disappears on close [US-56]

#### Variant baseline (per-surface)
- [x] **Desktop, no choices** (linear node → continue): portrait + speaker label + dialogue text all render correctly, continue hint visible (verified manually for Old Man's greeting) [US-57]
- [x] **Desktop, with choices** (node has `choices`): portrait + speaker label + choice rows all render; arrow-key choice navigation still works (verified manually) [US-57]
- [x] **Mobile, no choices**: portrait + speaker label + dialogue text + tap-to-continue all render and behave (verified on touch-emulated viewport) [US-57]
- [x] **Mobile, with choices** (browse-then-confirm pattern): portrait stays anchored to (now-taller) box top; choice rows + Confirm button still work; portrait does not overlap any choice row (verified on touch-emulated viewport) [US-57]
- [x] **No-portrait fallback** (Whispering Stones): every existing visual element renders unchanged from the pre-phase baseline (verified by side-by-side screenshot or manual inspection) [US-57]

#### Behavior — reads-as
- [x] **Old Man portrait reads-as:** A first-time observer can describe the dialogue opening as "the Old Man is looking at me / the Old Man's face is up there with his line" — NOT "there's a small picture in the corner" or "I couldn't tell whose face that is". Verified via the manual-verify doc with a short observer note. [US-57]
- [x] **Old Man portrait mechanism proxy:** On `start()`, the call sequence is: resolve portrait id → create `Image` at depth 200 → `setOrigin(0, 1)` → set position `(s(BOX_PADDING), boxY)` → set display size to clamped width/height. Verified by source read of call order. [US-57]
- [x] **Marsh Hermit portrait reads-as:** Same observer test, same phrasing target. [US-57]
- [x] **Marsh Hermit portrait mechanism proxy:** Same call-order assertion. [US-57]
- [x] **Anchored, not floating, reads-as:** A first-time observer can describe the portrait + box as "one piece" — not "a face floating above a box". Verified via observer note for at least one NPC. [US-57]
- [x] **Anchored mechanism proxy:** Visual gap between portrait bottom edge and box top edge is 0 px in design pixels (origin `(0, 1)` + `y = boxY`) — verified by source read of origin + position. [US-57]

#### Class baseline (dialogue UI element shared behaviour)
- [x] Portrait has `setScrollFactor(0)` (matches `boxGraphics`, `speakerText`, `dialogueText`, choice rows) — verified by source read [US-57]
- [x] Portrait has `setDepth(DEPTH)` where `DEPTH = 200` (matches every other dialogue UI element) — verified by source read [US-57]
- [x] Portrait is ignored by the main camera via `ignoreOnMainCamera()` (matches every other dialogue UI element) — verified by source read [US-57]
- [x] Portrait is destroyed in `close()` and the reference is nulled (matches `boxGraphics`, `speakerText`, `dialogueText`, `continueHint`) — verified by source read [US-57]
- [x] Portrait is repositioned on `handleResize()` (matches every other dialogue UI element with a position) — verified by source read [US-57]

#### Aesthetic traceability
- [x] **"Reads as a character looking at the player"** (design direction) traces to: portrait reads-as criteria above (Old Man + Marsh Hermit observer notes). [US-57]
- [x] **"Pixel-art-faithful for Marsh Hermit / illustrated-faithful for Old Man"** traces to: per-portrait `filter` registry value AND the runtime `setFilter(LINEAR)` call for `old-man` only AND the per-NPC variant baseline visual checks above. [US-56]
- [x] **"Anchored, not floating"** (design direction) traces to: anchored mechanism proxy + anchored reads-as observer note above. [US-57]

#### Editor sync
- [x] `tools/editor/src/dialogueRenderer.ts` is reviewed — either accommodates the new optional `portraitId` field on `DialogueScript` / `DialogueNode` (e.g. shows a small "[portrait: <id>]" annotation on the node label) OR the change is deliberately deferred with a one-line comment in the editor source noting the deferred work [US-56]
- [x] `cd tools/editor && npm run build` succeeds with the new types [US-56]

#### Error paths
- [x] If `portraitId` resolves to an id that is NOT in the portrait registry (typo in dialogue data), `DialogueSystem` logs a descriptive console error naming the offending id and falls back to "no portrait rendered" — dialogue itself proceeds without crashing (verified by deliberately mistyping `portraitId: 'old-mna'` in a temporary dev edit and observing the console + visible fallback) [US-57]
- [x] If `portraitId` resolves to a registered id but the texture key `npc-portrait-<id>` is missing at render time (e.g. preload race), `DialogueSystem` logs a descriptive console error and falls back to "no portrait rendered" — same recovery path (verified by source read of the guard before `Image` creation) [US-57]
- [x] **Idempotency:** Calling `start()` while already active is already a no-op (existing behaviour) — verify the portrait is not double-created on the same script (source read of the `if (this.active) return;` guard at the top of `start()` is sufficient if it precedes portrait creation) [US-57]
- [x] **Cleanup on area transition:** Walking through an exit zone while a dialogue is open (if such a path exists) cleans up the portrait via the existing `scene.events.shutdown` path that `DialogueSystem` already wires — verified by source read of `cleanupResize` / `destroy` flow [US-57]

#### Invariants (phase-level)
- [ ] `npx tsc --noEmit && npm run build` passes for the main game [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors or warnings during 60 seconds of play covering: open Old Man dialogue, walk through every node + a choice branch, close; open Marsh Hermit dialogue, same; trigger Whispering Stones, complete it; transition between Ashen Isle and Fog Marsh [phase]
- [ ] AGENTS.md "File ownership" row for `systems/dialogue.ts` is updated to mention portrait rendering, portrait id resolution from script/node, mobile clamp, anchored origin, lifecycle on start/showNode/close [phase]
- [ ] AGENTS.md "File ownership" row for `systems/npcSprites.ts` is updated to mention the portrait registry (per-id file + filter mode) [phase]
- [ ] AGENTS.md "Behavior rules" "Dialogue" entry is amended to describe: optional `portraitId` on DialogueScript / DialogueNode, portrait anchored above box top-left flush with box top, mobile clamp to 22% of canvas width, speaker label conditional offset [phase]
- [ ] AGENTS.md "Directory layout" tree adds `portrait.png` under each `assets/npc/<sprite-id>/` entry [phase]
- [ ] AGENTS.md "Scaling tuning guide" is amended with `PORTRAIT_DESIGN_SIZE` and `PORTRAIT_MOBILE_WIDTH_FRACTION` named constants in `systems/dialogue.ts` (so the guide stays the single source of truth for dialogue tuning knobs) [phase]
- [ ] **Deploy verification (Learning #65):** the GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check); any post-merge fixes go through a new PR, not direct-to-main [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** before submitting, check for (a) portrait creation called per-frame in `update()` instead of once per dialogue (must NOT happen — creation is in `start()` / `showNode()` only); (b) `setTexture` called every frame with the same key (only fires on portrait-id change, similar to the awareness `lastStaticDir` guard); (c) comments referencing the pre-portrait dialogue layout after the swap; (d) function names that imply a different contract than the implementation [phase]

### Golden principles (phase-relevant)
- **Depth map authority:** Portrait renders at depth 200 (Dialogue) — already in the depth map. No new depths introduced.
- **Parameterized systems:** Portrait registry is consumed by id; no global imports inside `DialogueSystem`. Per-asset filter mode lives on the registry, not in system code. `PORTRAIT_DESIGN_SIZE` and `PORTRAIT_MOBILE_WIDTH_FRACTION` live as named constants at the top of `dialogue.ts` for tuning, mirroring the existing `BOX_HEIGHT` / `MOBILE_CHOICE_HEIGHT` pattern.
- **Zone-level mutual exclusion (LEARNINGS #56):** Portrait is purely additive within the dialogue UI surface. Existing mutual-exclusion rules (movement, interaction, triggers all suppressed during dialogue) are unchanged.
- **No silent breaking changes:** `portraitId` is optional everywhere — existing dialogues that don't set it (e.g. Whispering Stones) render unchanged. Speaker name x-offset is conditional, so the no-portrait branch keeps the original visual.
- **From LEARNINGS EP-01:** loop-invariant audit applies — portrait creation is once-per-dialogue, not per-frame; `setTexture` only fires on portrait-id change, not every node transition; no per-frame work added to `update()`.
- **From LEARNINGS #57 (depth-map authority):** the portrait render order within depth 200 must be deterministic relative to the box graphics — portrait must render ABOVE the box graphics (so its bottom edge sits visibly on the box, not under it). `DialogueSystem.createBox()` creates `boxGraphics` first; the portrait is created later in the lifecycle, so the default Phaser display-list ordering naturally places the portrait on top — but document this explicitly in `dialogue.ts` so a future refactor doesn't accidentally invert it.
- **Quality checks (from AGENTS.md):** no-silent-pass, no-bare-except, error-path-coverage, agents-consistency.
