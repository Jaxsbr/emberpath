# Phase: npc-portraits

Status: shipped

## Phase goal

Add character portraits to the dialogue UI so each NPC line reads as "this character is looking at me, and they are speaking now" rather than a name tag above a textbox. Portraits anchor above the dialogue box at its top-left, attached to the box like a speaker bust, and are sourced from the existing PixelLab portrait assets (Old Man and Marsh Hermit). Non-NPC dialogue (e.g. the Whispering Stones trigger) renders without a portrait — the field is optional, so narrative-only dialogues are unaffected. The phase ends when both NPCs visibly look out from above their dialogue box on every conversation, on desktop and on mobile, with the dialogue text width unchanged.

## Design direction

Diegetic, attached-to-box bust portraits — feels like the NPC peeked into the conversation at the upper-left corner, not a floating headshot. The portrait sits flush with the dialogue box's top edge, slightly inset from the left so the speaker name reads to its right. Aesthetic intent for both portraits:

- **Reads as a character looking at the player**, not a generic "NPC face here" placeholder. Frame is a centred bust, eye-line on the upper third, bordered to look like a bust frame on the box.
- **Pixel-art-faithful for the Marsh Hermit** (which is pixel-art) and **illustrated-faithful for the Old Man** (which is painterly). The renderer must not nearest-neighbor-downscale the painterly portrait into mush — texture filter is a per-portrait decision.
- **Anchored, not floating.** The portrait's bottom edge meets the dialogue box's top edge; they look like one composite UI element.

Build-loop applies the `frontend-design` skill (`/Users/jacobusbrink/Jaxs/projects/sabs/skills/frontend-design/SKILL.md`) to the layout work in US-57 — specifically the visual hierarchy of (portrait bust + speaker label + box + text) so the speaker label and continue hint don't compete with the portrait visually.

## Safety criteria

N/A — this phase introduces no API endpoints, no user text input fields, no query interpolation. Portrait id is consumed from data files authored by Jaco, not from user input. No auto-safety criteria apply.

## Stories

### US-56 — Portrait asset, registry, and data wiring [Shipped]

As a player, I want each NPC's dialogue to be backed by a portrait asset that the engine knows how to load, so that the dialogue UI in US-57 has a single, consistent place to look up "what does this speaker look like?" without speaker-name string matching.

**Acceptance criteria**:
- `assets/npc/marsh-hermit/portrait.png` exists (copied from `/Users/jacobusbrink/Jaxs/assets/emberpath/npc/marsh-hermit/portrait.png`, 1024×1024 source). Same for `assets/npc/old-man/portrait.png`.
- A portrait registry exists — either as new fields on the existing `NPC_SPRITES` map in `src/systems/npcSprites.ts` (e.g. `portrait: { file: 'portrait.png', filter: 'linear' | 'nearest' }`) or as a sibling `NPC_PORTRAITS` map in the same module. The registry is the **single source of truth** for portrait file names, source dimensions (used for crisp scaling), and texture filter mode per portrait.
- `marsh-hermit` portrait registry entry: `filter: 'nearest'` (it's pixel-art). `old-man` portrait registry entry: `filter: 'linear'` (it's painterly — nearest-neighbor 1024→~96 downscale would shred the brushwork).
- `DialogueScript` (in `src/data/areas/types.ts`) gains an optional `portraitId?: string` field. `DialogueNode` gains an optional `portraitId?: string` field that, when present, overrides the script-level value for that node only. Absent on both = no portrait for that line.
- `src/data/areas/ashen-isle.ts` Old Man dialogue script sets `portraitId: 'old-man'` at the script level. `src/data/areas/fog-marsh.ts` Marsh Hermit dialogue script sets `portraitId: 'marsh-hermit'` at the script level. The Whispering Stones script in fog-marsh sets **no** `portraitId` (verifies the optional case).
- `GameScene.preload()` iterates the portrait registry and loads each portrait under a deterministic texture key like `npc-portrait-<id>` (e.g. `npc-portrait-old-man`). Adding a third NPC portrait must require **only** a registry entry — no edit to `GameScene.preload`.
- After load, for each registered portrait whose registry entry says `filter: 'linear'`, `GameScene.create()` (or a small helper called from preload's `complete` callback) calls `texture.setFilter(Phaser.Textures.FilterMode.LINEAR)` on that texture so the global `pixelArt: true` setting (which forces `NEAREST`) is overridden per-portrait. `nearest` portraits inherit the global default and need no per-texture override.
- Both `npx tsc --noEmit` and `npm run build` succeed with the new fields and registry entries.

**User guidance:**
- Discovery: Ambient — no new control. Walking up to either NPC and starting dialogue activates the new visual (rendered in US-57).
- Manual section: N/A — no new player action.
- Key steps: N/A.

**Design rationale:** A registry + optional script/node field decouples the **what does this character look like** decision (data) from the **how does the dialogue UI render it** decision (system code). Speaker-name-string matching was rejected because dialogue speakers are display strings (e.g. "Old Man" with a space and capital) that drift independently from sprite ids ("old-man") — relying on string equality would break silently the first time a dialogue rephrased a speaker label. Per-portrait texture filter is a per-asset choice (pixel-art vs painterly) and lives on the registry so US-57 doesn't have to special-case asset ids.

**Consumer adaptation:** The portrait registry is consumed by both `GameScene.preload` (load + per-texture filter) and `DialogueSystem` (look up by id at render time). Each consumer accesses the registry by id; there are no hardcoded portrait ids inside `GameScene` or `DialogueSystem`. Adding a third NPC portrait to a third area must require zero edits to `GameScene` or `DialogueSystem` — only a registry entry, the asset file, and a `portraitId` on the area's dialogue script.

---

### US-57 — Portrait rendering above the dialogue box (mobile-aware) [Shipped]

As a player, I want the speaking NPC's portrait to appear above the dialogue box's top-left corner during conversation, so that I'm visibly being addressed by *that character* rather than reading text in a vacuum — and on mobile the portrait must scale down so it doesn't crowd narrow screens.

**Acceptance criteria**:
- On `DialogueSystem.start(script)` and on every `showNode(node)` transition, the system resolves the active portrait id: `node.portraitId ?? script.portraitId ?? null`. If the result is null, no portrait is rendered (current behaviour preserved for the Whispering Stones script).
- When a portrait id is resolved, `DialogueSystem` creates a `Phaser.GameObjects.Image` keyed by `npc-portrait-<id>` at depth 200 (Dialogue layer per the depth map — no new depth introduced).
- The portrait is anchored to the dialogue box's **top-left**, with its **bottom edge flush with the box's top edge** (so the portrait visually "sits on" the box). Concrete coordinates in design pixels: `x = BOX_PADDING`, bottom edge at `boxY` (so origin is `(0, 1)` and y is set to `boxY`, x is `s(BOX_PADDING)`).
- Portrait render size on desktop: `PORTRAIT_DESIGN_SIZE` (proposal: **96** design pixels, square). Portrait render size on mobile: `min(s(PORTRAIT_DESIGN_SIZE), canvasWidth * 0.22)` so on a 375 px-wide phone the portrait is ~83 px instead of overflowing. Square aspect maintained — both source images are 1024×1024.
- Speaker name label (`speakerText`) repositions to sit **to the right of the portrait**, vertically centred against the portrait's lower band (where the speaker line currently sits above the box). Concrete: `x = s(BOX_PADDING) + portraitRenderWidth + s(8)`, `y = boxY - s(20)` (unchanged y). When no portrait is active, speaker label keeps its current position (`x = s(BOX_PADDING)`).
- On `showNode(node)` transition, if the resolved portrait id changes from the previous node, the existing portrait `Image` has its texture swapped via `setTexture('npc-portrait-<newId>')` rather than being destroyed and recreated (avoids a one-frame flicker; allows multi-speaker scripts later).
- On `DialogueSystem.close()`, the portrait `Image` is destroyed alongside the other dialogue UI elements.
- The portrait is `setScrollFactor(0)`, `setDepth(DEPTH)`, and ignored by the main camera via `ignoreOnMainCamera()` — same lifecycle hooks as every other dialogue UI element. The main game camera must not render the portrait (otherwise it would render twice at zoom).
- On `handleResize()` (Phaser 'resize' event from rotation / browser resize), the portrait reposition + resize logic runs alongside the existing `redrawBox` + speaker / hint reposition logic. Portrait render size and position recompute from current `canvasWidth` and `boxY`.
- On mobile choice expansion (when `currentBoxHeight` grows from `BOX_HEIGHT` to `CHOICE_TEXT_OFFSET_TOP + choiceAreaHeight + BOX_PADDING`), the portrait stays anchored to the **new** `boxY` (which moves up because `boxY = scale.height - s(currentBoxHeight)`). The portrait visually rides up with the expanded box.
- No regression to the existing dialogue text, choice rows (desktop arrow + mobile tap-then-confirm), continue hint, or typewriter timing.

**User guidance:**
- Discovery: Walk up to either NPC, press Space (desktop) or tap (mobile). The dialogue box opens with the NPC's portrait sitting on its top-left corner.
- Manual section: N/A — extends an existing interaction; no new control.
- Key steps: N/A — same Space/tap action that already starts dialogue.

**Design rationale:** Anchoring the portrait above the box (not inside it) preserves full text width — Emberpath's whole purpose is reading allegorical passages, so squeezing text width by 30% to fit an in-box portrait would cost the most-important surface in the game. Top-**left** anchor (not centre) matches the existing `BOX_PADDING`-based left-alignment used for speaker name and dialogue text — reading flow is left-to-right, so the speaker's face naturally precedes their words. Mobile clamp via `canvasWidth * 0.22` rather than a fixed-pixel-on-mobile rule keeps the design responsive across phone widths (iPhone SE 320 px → 70 px portrait, iPhone Pro Max 430 px → 95 px portrait) without per-device branching. `setTexture` swap on node-portrait-id change rather than destroy-and-recreate is the cheaper path AND avoids a flicker when a future multi-speaker script alternates portraits node-to-node.

**Consumer adaptation:** `PORTRAIT_DESIGN_SIZE` and `PORTRAIT_MOBILE_WIDTH_FRACTION` are named constants at the top of `src/systems/dialogue.ts` (proposed: 96 and 0.22), not literals scattered through render code. Future tuning is a one-line constant edit, not a code search.

**Processing model:** `DialogueSystem` owns the portrait `Image` lifecycle — `start()` and `showNode()` create or `setTexture` it; `close()` destroys it; `handleResize()` repositions it. The portrait registry in `src/systems/npcSprites.ts` is consulted **read-only** for the texture key derivation and (at preload time only) for the filter mode — `DialogueSystem` does not mutate registry state. `GameScene` does not track the portrait — it is purely a `DialogueSystem` concern, mirroring how `boxGraphics`, `speakerText`, and `dialogueText` are owned today.

---

## Done-when (observable)

### Structural — assets & data

- [ ] `assets/npc/marsh-hermit/portrait.png` exists (verified: file present, ≥ 1 byte) [US-56]
- [ ] `assets/npc/old-man/portrait.png` exists [US-56]
- [ ] `vite.config.ts` `publicDir: 'assets'` continues to serve the new portraits without additional config — sample URL `/npc/old-man/portrait.png` returns 200 in `npm run dev` (verified manually) [US-56]
- [ ] AGENTS.md "Directory layout" tree is updated to include `assets/npc/<sprite-id>/portrait.png` next to the existing `idle/walk/static/` entries [US-56]
- [ ] Portrait registry exists (in `src/systems/npcSprites.ts` or a sibling module) and exposes per-id `{ file, filter }` (or equivalent) for both `marsh-hermit` and `old-man` (verified: source read) [US-56]
- [ ] Registry entry for `marsh-hermit` declares `filter: 'nearest'`; entry for `old-man` declares `filter: 'linear'` (verified: source read + matches the per-asset rationale in US-56 design rationale) [US-56]
- [ ] Both registered portraits are square aspect (source 1024×1024). Registry documents this assumption inline (e.g. a comment on the registry interface stating "square aspect — non-square portraits are not supported in this phase; render math in DialogueSystem treats portraits as 1:1"). Future non-square portrait support is explicitly out-of-scope and noted as such. [US-56]
- [ ] `DialogueScript` in `src/data/areas/types.ts` has optional `portraitId?: string` (verified: source read) [US-56]
- [ ] `DialogueNode` in `src/data/areas/types.ts` has optional `portraitId?: string` (verified: source read) [US-56]
- [ ] `src/data/areas/ashen-isle.ts` Old Man dialogue script has `portraitId: 'old-man'` at script level [US-56]
- [ ] `src/data/areas/fog-marsh.ts` Marsh Hermit dialogue script has `portraitId: 'marsh-hermit'` at script level [US-56]
- [ ] `src/data/areas/fog-marsh.ts` Whispering Stones script does NOT set `portraitId` (verifies optional case) [US-56]

### Structural — preload & filter

- [ ] `GameScene.preload()` iterates the portrait registry and loads each portrait under key `npc-portrait-<id>` (verified: source reads from registry, not hardcoded id list) [US-56]
- [ ] After preload, for each portrait registry entry with `filter: 'linear'`, `texture.setFilter(Phaser.Textures.FilterMode.LINEAR)` is called on the loaded texture — verified by source read AND by a runtime check that `scene.textures.get('npc-portrait-old-man').source[0].scaleMode` corresponds to LINEAR [US-56]
- [ ] Portraits with `filter: 'nearest'` do NOT have `setFilter` called explicitly (they inherit the global `pixelArt: true` default) — verified by source read [US-56]
- [ ] **Phaser API contract:** Each portrait is created in `DialogueSystem` as `Phaser.GameObjects.Image` (NOT `Sprite`, NOT `Container`) since portraits do not animate. Verified by source read AND by a smoke check: opening the Old Man dialogue logs no console error, no `setTexture` call against a missing key, no Phaser warning about texture filter mismatch. [US-57]

### Structural — DialogueSystem rendering

- [ ] `DialogueSystem` declares `private portraitImage: Phaser.GameObjects.Image | null = null;` (or equivalent owned reference) [US-57]
- [ ] `DialogueSystem.start()` resolves `node.portraitId ?? script.portraitId ?? null` and creates a `Phaser.GameObjects.Image` only when non-null [US-57]
- [ ] `DialogueSystem.showNode()` re-resolves the portrait id. If it is unchanged from the previous node, NO `setTexture` call fires (loop-invariant — Learning EP-01). If it changed from the previous node, calls `setTexture('npc-portrait-<newId>')` on the existing image rather than destroying and recreating. If it changed from a value to `null`, the existing image is destroyed; if it changed from `null` to a value, a new image is created. Verified by source read of the four-branch guard. [US-57]
- [ ] Portrait is created at depth 200 (Dialogue layer per the depth map — no new depth introduced) [US-57]
- [ ] Portrait has `setScrollFactor(0)` and is ignored by the main camera via `ignoreOnMainCamera()` (verified: source read; visual check that no second copy of the portrait scrolls with the world camera) [US-57]
- [ ] Portrait origin is set to `(0, 1)` (top-left x, bottom-aligned y) so that setting `y = boxY` puts the portrait flush with the box's top edge (verified: source read) [US-57]
- [ ] Portrait render size on desktop is `s(PORTRAIT_DESIGN_SIZE)` where `PORTRAIT_DESIGN_SIZE` is a named module-level constant set to 96 (verified: source read; on a 1024-wide canvas at zoom 1 the rendered portrait is 96 css px) [US-57]
- [ ] Portrait render size on mobile clamps to `min(s(PORTRAIT_DESIGN_SIZE), canvasWidth * PORTRAIT_MOBILE_WIDTH_FRACTION)` where `PORTRAIT_MOBILE_WIDTH_FRACTION` is a named module-level constant set to 0.22 (verified: source read; on a 375 px-wide canvas the rendered portrait is ≤ 83 px) [US-57]
- [ ] Speaker name label x-position: when a portrait is active, `x = s(BOX_PADDING) + portraitRenderWidth + s(8)`; when inactive, `x = s(BOX_PADDING)` (verified: source read of both branches) [US-57]
- [ ] `handleResize()` recomputes portrait position AND render size from current `canvasWidth` and `boxY`, alongside the existing speaker / hint / box repositioning (verified: source read) [US-57]
- [ ] `redrawBox()` (called on mobile choice expansion) repositions the portrait to track the new `boxY` (verified: source read; manual check that opening choices on mobile does NOT leave the portrait stranded at the old box position) [US-57]
- [ ] `DialogueSystem.close()` destroys the portrait image and sets `portraitImage = null` (verified: source read) [US-57]
- [ ] `clearChoices()` does NOT touch the portrait (it persists across choice → next-node transitions within one dialogue script) [US-57]

### Behavior — NPC-initiated dialogue (US-57)

- [ ] Approaching the **Old Man** on Ashen Isle and starting dialogue causes the Old Man portrait to appear at the dialogue box's top-left, bottom-edge flush with box top, on the very first node of the script (verified manually) [US-57]
- [ ] Approaching the **Marsh Hermit** on Fog Marsh and starting dialogue causes the Marsh Hermit portrait to appear in the same position (verified manually) [US-57]
- [ ] Speaker name "Old Man" / "Marsh Hermit" renders to the right of the portrait, not overlapping it (verified manually + source reads the conditional x-offset) [US-57]
- [ ] Across all nodes of a single dialogue script (greeting → choice → continue → close), the portrait stays in place; no flicker on node transitions (verified manually for both NPCs) [US-57]
- [ ] Closing the dialogue removes the portrait from the screen (no orphan image left at depth 200) (verified manually + source reads `close()` cleanup) [US-57]
- [ ] Re-opening the dialogue (walk away, walk back, Space again) renders the portrait again — no "first-time-only" bug (verified manually for both NPCs) [US-57]

### Behavior — non-NPC dialogue regression (US-57)

- [ ] Triggering the **Whispering Stones** dialogue on Fog Marsh (no `portraitId` set) renders dialogue with NO portrait, speaker name in its original top-left position (`x = s(BOX_PADDING)`), full original text width, and no console error (verified manually + source read of the null-portrait branch) [US-57]

### Behavior — mobile responsiveness (US-57)

- [ ] On a viewport resized to 375×667 (iPhone-class portrait) via DevTools device emulation, the Old Man portrait renders at ≤ `375 * 0.22 = 82.5` css px wide AND its right edge does NOT cross the dialogue box's horizontal midpoint (verified manually with DevTools + screenshot) [US-57]
- [ ] On the same 375×667 viewport, the speaker name label renders fully visible to the right of the portrait, not clipped by the canvas edge (verified manually) [US-57]
- [ ] On a viewport resized to 1280×720 (desktop) the portrait renders at exactly 96 css px wide (zoom 1) (verified manually) [US-57]
- [ ] Rotating the simulated device from portrait to landscape mid-dialogue causes the portrait to reposition + resize without leaving artefacts (verified manually) [US-57]
- [ ] Triggering a mobile choice expansion (a node with `choices`) causes the dialogue box to grow upward AND the portrait to move up with it (portrait's bottom edge stays flush with the new `boxY`) (verified manually on a touch-emulated viewport) [US-57]
- [ ] After the box collapses back to `BOX_HEIGHT` on the next non-choice node, the portrait moves back down with it (verified manually) [US-57]

### Variant baseline (per-NPC verification — required by spec rule 4a)

Every behaviour criterion below must be verified for **both** NPCs separately. The build-loop's manual-verification doc lists each NPC as a separate checkbox, not "both NPCs work".

- [ ] **Marsh Hermit**: portrait appears on dialogue start (US-57); portrait is pixel-art-faithful (no soft bilinear smoothing on the source pixels — `nearest` filter inherited from global) (US-56); portrait stays anchored across all nodes; portrait disappears on close [US-56, US-57]
- [ ] **Old Man**: portrait appears on dialogue start (US-57); portrait downscales smoothly (no nearest-neighbor mush — `linear` filter applied) (US-56); portrait stays anchored across all nodes; portrait disappears on close [US-56, US-57]

### Variant baseline (per-surface verification — required by spec rule 4a inverse)

The portrait + speaker label is a new mutation of dialogue-box state. Existing dialogue surfaces that must continue to render correctly with the new code:

- [ ] **Desktop, no choices** (linear node → continue): portrait + speaker label + dialogue text all render correctly, continue hint visible (verified manually for Old Man's greeting) [US-57]
- [ ] **Desktop, with choices** (node has `choices`): portrait + speaker label + choice rows all render; arrow-key choice navigation still works (verified manually) [US-57]
- [ ] **Mobile, no choices**: portrait + speaker label + dialogue text + tap-to-continue all render and behave (verified on touch-emulated viewport) [US-57]
- [ ] **Mobile, with choices** (browse-then-confirm pattern): portrait stays anchored to (now-taller) box top; choice rows + Confirm button still work; portrait does not overlap any choice row (verified on touch-emulated viewport) [US-57]
- [ ] **No-portrait fallback** (Whispering Stones): every existing visual element renders unchanged from the pre-phase baseline (verified by side-by-side screenshot or manual inspection) [US-57]

### Behavior — reads-as (required by Visual "reads as" compounded rule)

Each reads-as is paired with an objective mechanism proxy.

- [ ] **Old Man portrait reads-as:** A first-time observer can describe the dialogue opening as "the Old Man is looking at me / the Old Man's face is up there with his line" — NOT "there's a small picture in the corner" or "I couldn't tell whose face that is". Verified via the manual-verify doc with a short observer note. [US-57]
- [ ] **Old Man portrait mechanism proxy:** On `start()`, the call sequence is: resolve portrait id → create `Image` at depth 200 → `setOrigin(0, 1)` → set position `(s(BOX_PADDING), boxY)` → set display size to clamped width/height. Verified by source read of call order. [US-57]
- [ ] **Marsh Hermit portrait reads-as:** Same observer test, same phrasing target. [US-57]
- [ ] **Marsh Hermit portrait mechanism proxy:** Same call-order assertion. [US-57]
- [ ] **Anchored, not floating, reads-as:** A first-time observer can describe the portrait + box as "one piece" — not "a face floating above a box". Verified via observer note for at least one NPC. [US-57]
- [ ] **Anchored mechanism proxy:** Visual gap between portrait bottom edge and box top edge is 0 px in design pixels (origin `(0, 1)` + `y = boxY`) — verified by source read of origin + position. [US-57]

### Class baseline (dialogue UI element shared behaviour — required by spec rule 4)

The portrait `Image` joins the existing dialogue-UI element class. Each shared behaviour is verified explicitly:

- [ ] Portrait has `setScrollFactor(0)` (matches `boxGraphics`, `speakerText`, `dialogueText`, choice rows) — verified by source read [US-57]
- [ ] Portrait has `setDepth(DEPTH)` where `DEPTH = 200` (matches every other dialogue UI element) — verified by source read [US-57]
- [ ] Portrait is ignored by the main camera via `ignoreOnMainCamera()` (matches every other dialogue UI element) — verified by source read [US-57]
- [ ] Portrait is destroyed in `close()` and the reference is nulled (matches `boxGraphics`, `speakerText`, `dialogueText`, `continueHint`) — verified by source read [US-57]
- [ ] Portrait is repositioned on `handleResize()` (matches every other dialogue UI element with a position) — verified by source read [US-57]

### Aesthetic traceability (Design direction → done-when)

Per the spec rule that every aesthetic claim must trace to at least one done-when criterion:

- [ ] **"Reads as a character looking at the player"** (design direction) traces to: portrait reads-as criteria above (Old Man + Marsh Hermit observer notes). [US-57]
- [ ] **"Pixel-art-faithful for Marsh Hermit / illustrated-faithful for Old Man"** traces to: per-portrait `filter` registry value AND the runtime `setFilter(LINEAR)` call for `old-man` only AND the per-NPC variant baseline visual checks above. [US-56, US-57]
- [ ] **"Anchored, not floating"** (design direction) traces to: anchored mechanism proxy + anchored reads-as observer note above. [US-57]

### Editor sync

- [ ] `tools/editor/src/dialogueRenderer.ts` is reviewed — either accommodates the new optional `portraitId` field on `DialogueScript` / `DialogueNode` (e.g. shows a small "[portrait: <id>]" annotation on the node label) OR the change is deliberately deferred with a one-line comment in the editor source noting the deferred work [US-56]
- [ ] `cd tools/editor && npm run build` succeeds with the new types [US-56]

### Error paths

- [ ] If `portraitId` resolves to an id that is NOT in the portrait registry (typo in dialogue data), `DialogueSystem` logs a descriptive console error naming the offending id and falls back to "no portrait rendered" — dialogue itself proceeds without crashing (verified by deliberately mistyping `portraitId: 'old-mna'` in a temporary dev edit and observing the console + visible fallback) [US-57]
- [ ] If `portraitId` resolves to a registered id but the texture key `npc-portrait-<id>` is missing at render time (e.g. preload race), `DialogueSystem` logs a descriptive console error and falls back to "no portrait rendered" — same recovery path (verified by source read of the guard before `Image` creation) [US-57]
- [ ] **Idempotency:** Calling `start()` while already active is already a no-op (existing behaviour) — verify the portrait is not double-created on the same script (source read of the `if (this.active) return;` guard at the top of `start()` is sufficient if it precedes portrait creation) [US-57]
- [ ] **Cleanup on area transition:** Walking through an exit zone while a dialogue is open (if such a path exists) cleans up the portrait via the existing `scene.events.shutdown` path that `DialogueSystem` already wires — verified by source read of `cleanupResize` / `destroy` flow [US-57]

### Invariants

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

## Golden principles (phase-relevant)

- **Depth map authority:** Portrait renders at depth 200 (Dialogue) — already in the depth map. No new depths introduced.
- **Parameterized systems:** Portrait registry is consumed by id; no global imports inside `DialogueSystem`. Per-asset filter mode lives on the registry, not in system code. `PORTRAIT_DESIGN_SIZE` and `PORTRAIT_MOBILE_WIDTH_FRACTION` live as named constants at the top of `dialogue.ts` for tuning, mirroring the existing `BOX_HEIGHT` / `MOBILE_CHOICE_HEIGHT` pattern.
- **Zone-level mutual exclusion (LEARNINGS #56):** Portrait is purely additive within the dialogue UI surface. Existing mutual-exclusion rules (movement, interaction, triggers all suppressed during dialogue) are unchanged.
- **No silent breaking changes:** `portraitId` is optional everywhere — existing dialogues that don't set it (e.g. Whispering Stones) render unchanged. Speaker name x-offset is conditional, so the no-portrait branch keeps the original visual.
- **From LEARNINGS EP-01:** loop-invariant audit applies — portrait creation is once-per-dialogue, not per-frame; `setTexture` only fires on portrait-id change, not every node transition; no per-frame work added to `update()`.
- **From LEARNINGS #57 (depth-map authority):** the portrait render order within depth 200 must be deterministic relative to the box graphics — portrait must render ABOVE the box graphics (so its bottom edge sits visibly on the box, not under it). `DialogueSystem.createBox()` creates `boxGraphics` first; the portrait is created later in the lifecycle, so the default Phaser display-list ordering naturally places the portrait on top — but document this explicitly in `dialogue.ts` so a future refactor doesn't accidentally invert it.

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `portrait.png` under each `assets/npc/<sprite-id>/` subtree.
- **File ownership** — updated row for `systems/dialogue.ts` (portrait rendering, id resolution, mobile clamp, lifecycle); updated row for `systems/npcSprites.ts` (portrait registry); updated row for `data/areas/types.ts` (`DialogueScript.portraitId`, `DialogueNode.portraitId` optional fields); updated row for `scenes/GameScene.ts` (portrait preload from registry, per-portrait LINEAR filter override).
- **Behavior rules — Dialogue** — amended to describe optional portrait id resolution (`node.portraitId ?? script.portraitId ?? null`), anchor at box top-left, mobile-width clamp, speaker label conditional offset.
- **Scaling tuning guide** — add `PORTRAIT_DESIGN_SIZE`, `PORTRAIT_MOBILE_WIDTH_FRACTION` to the dialogue tuning knobs section.
- **Depth map** — no change (portrait reuses depth 200).
- **Controls** — no change.
