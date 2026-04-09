# Phase: mobile-ux

Status: draft

## Stories

### US-11 — Responsive canvas scaling

As a mobile player, I want the game canvas to fill my screen regardless of device orientation, so that I don't see letterboxing and the game area is maximized.

**Acceptance criteria:**
- Game canvas fills the available viewport in both portrait and landscape orientations with minimal letterboxing
- Orientation changes during gameplay are detected and the canvas re-sizes accordingly without scene restart
- HTML container and CSS follow LEARNINGS #62 (Phaser Scale Manager measures `offsetWidth` — explicit container with explicit CSS dimensions, no padding)
- Desktop experience is unchanged — canvas scales within the browser window as before
- Camera bounds update correctly after resize to match new viewport into the tile map world

**User guidance:** N/A — internal change, players see a better-fitting canvas automatically.

**Design rationale:** The fixed 800x600 FIT mode causes massive letterboxing on mobile (especially portrait). Switching to a dynamic scale mode that adapts canvas dimensions to the container eliminates letterboxing. The tile map world coordinates remain fixed (50x38 tiles at 32px = 1600x1216 world pixels) — only the camera viewport changes, showing more or fewer tiles depending on screen dimensions. The existing `#game-container` and CSS (`width: 100%; height: 100%`) are already close to correct per LEARNINGS #62 — the primary change is Phaser config, not HTML structure.

### US-12 — Dynamic UI positioning

As a player, I want all UI elements (dialogue box, story scenes, thought bubbles, interaction prompts) to position correctly on any canvas size, so that text is readable and elements don't overflow or get cut off after a resize.

**Acceptance criteria:**
- Dialogue box spans full canvas width and anchors to the bottom of the current canvas height
- Story scene panels (image area, text area, advance prompt) derive positions from canvas dimensions, not hardcoded pixel values
- Word wrap width for dialogue and story text adjusts to current canvas width
- If a resize occurs while UI is active (dialogue open, story scene playing), visible elements reposition without requiring close/reopen or scene restart

**User guidance:** N/A — internal change, UI elements automatically position correctly.

**Design rationale:** Six files contain hardcoded pixel values tied to the 800x600 canvas (dialogue.ts: BOX_Y=480, width=800; StoryScene.ts: center=400, height=600). Replacing these with `scale.width`/`scale.height`-relative calculations is the minimal refactoring needed to support responsive sizing. Font sizes remain unchanged — only positions and widths adapt.

### US-13 — Mobile dialogue browse-then-confirm

As a mobile player, I want to browse dialogue choices and confirm my selection before committing, so that I don't accidentally pick the wrong option by mis-tapping.

**Acceptance criteria:**
- On touch devices, dialogue choices render as full-width tappable areas with adequate touch target size
- Tapping a choice highlights it without committing — the player can review before confirming
- A Confirm button appears when a choice is highlighted, allowing the player to finalize
- Tapping a different choice switches the highlight without committing
- Desktop keyboard flow (arrow keys to browse, Enter to confirm) remains unchanged

**User guidance:**
- Discovery: Automatic on touch devices when dialogue choices appear during NPC conversation
- Manual section: N/A — no user manual exists; AGENTS.md Controls and Behavior rules sections document this
- Key steps: 1. During a dialogue with choices, tap a choice to highlight it. 2. Tap the "Confirm" button that appears to commit your selection.

**Design rationale:** Option A from mobile-ux.md — full-width buttons with confirmation bar. This is the standard mobile pattern for irreversible selections (common in mobile RPGs and visual novels). Adds a confirmation step on mobile without changing the desktop two-step flow (arrows browse, Enter commits).

**Interaction model:** Different from the current tap-to-instantly-select pattern. Mobile users tap a choice to highlight it (visual change — e.g., background fill or border), which reveals a "Confirm" button anchored below the choices. Tap Confirm to proceed, or tap a different choice to switch. This matches the browse-then-confirm pattern and prevents mis-taps on the 14px/22px-spaced text that the current implementation uses. Desktop users see no change — arrow keys still browse, Enter still confirms.

## Design direction

No changes to visual identity. Current dark aesthetic (`#1a1a2e` background, dark dialogue boxes `0x111122`, yellow highlights `#ffdd44`) is maintained. This phase changes layout mechanics and touch interaction only. Frontend-design plugin: not applicable.

## HUD layout — Dialogue choice area (US-13, mobile only)

Current layout (mobile, when choices present):
- Dialogue box: full-width at bottom, 120px tall, depth 200
- Speaker name: above box, 14px
- Dialogue text: inside box top, 16px
- Choices: stacked text lines at BOX_Y+62, 22px vertical spacing, 14px font — small tap targets, instant-select

New layout (mobile, when choices present):
- Choices render as full-width tappable rows (min 44px height each), stacked below dialogue text
- Dialogue box expands vertically to accommodate choice rows + Confirm button
- Selected choice: visually highlighted (background fill or border change)
- Confirm button: full-width row anchored at bottom of expanded dialogue box, labeled "Confirm", visually distinct from choice rows (heavier background or border)
- Desktop layout: unchanged — same text-line choices with arrow key browsing + Enter to confirm

## Done-when (observable)

**US-11 — Responsive canvas scaling**
- [ ] Phaser config in `src/main.ts` does not use fixed `width: 800, height: 600` with `FIT` mode — canvas dimensions adapt to container/viewport size [US-11]
- [ ] `index.html` CSS and `#game-container` setup follows LEARNINGS #62: explicit container with explicit CSS dimensions, no padding on body or container that would mislead Phaser's `offsetWidth` measurement [US-11]
- [ ] Browser `resize` event (including device orientation change) triggers canvas re-layout — Scale Manager recalculates dimensions, no scene restart required [US-11]
- [ ] Camera bounds update after resize to correctly constrain the viewport within the tile map world (1600x1216 world pixels) [US-11]
- [ ] Resize event listener is cleaned up on game destroy to prevent memory leaks (async cleanup) [US-11]
- [ ] Desktop browser: canvas scales within window without regression from current behavior [US-11]

**US-12 — Dynamic UI positioning**
- [ ] `src/systems/dialogue.ts` contains no hardcoded `800` or `600` pixel values — all position and size calculations (box position, box width, word wrap, choice positioning) derive from `this.scene.scale.width` / `this.scene.scale.height` [US-12]
- [ ] `src/scenes/StoryScene.ts` contains no hardcoded `400` (half-width), `800` (full width), or `600` (full height) — center X, panel widths, and panel heights derive from scene scale dimensions [US-12]
- [ ] Dialogue box anchors to bottom of current canvas height (Y = `scale.height - BOX_HEIGHT`) and spans full `scale.width` [US-12]
- [ ] Word wrap width for dialogue text and story scene text adjusts to current `scale.width` minus padding [US-12]
- [ ] If dialogue is active during a resize event, the dialogue box, text, speaker name, and any visible choices reposition to the new canvas dimensions without requiring close/reopen [US-12]
- [ ] If StoryScene is active during a resize event, image panel, text panel, and advance prompt reposition to new canvas dimensions without requiring scene restart [US-12]
- [ ] Resize handler repositions existing UI elements — does not destroy and re-create them. No duplicate game objects on rapid successive resize events [US-12]

**US-13 — Mobile dialogue browse-then-confirm**
- [ ] On touch-capable devices, dialogue choices render as full-width tappable areas with minimum 44px touch target height per choice [US-13]
- [ ] Tapping a mobile choice highlights it (visually distinct from unselected choices — background fill or border change) without advancing the dialogue [US-13]
- [ ] A "Confirm" button appears when a choice is highlighted, anchored below the choices inside the dialogue box, labeled with action text ("Confirm" or equivalent — not icon-only) [US-13]
- [ ] Tapping Confirm commits the selected choice and advances to the next dialogue node [US-13]
- [ ] Tapping a different choice switches the highlight to the new choice without committing [US-13]
- [ ] Desktop keyboard flow unchanged: arrow keys browse choices, Enter confirms selection — no Confirm button displayed on non-touch devices [US-13]
- [ ] The `choiceJustSelected` guard flag (LEARNINGS #69) continues to prevent input bleed-through after mobile choice confirmation [US-13]
- [ ] Confirm button uses `scrollFactor(0)` and depth 200 per the depth map, and is destroyed when dialogue closes [US-13]
- [ ] Expanded dialogue box (text + 4 choices at 44px + Confirm button) does not overflow the canvas bottom edge on a 412x914 portrait viewport — layout capacity verified at maximum choice count [US-13]

**Structural**
- [ ] `npx tsc --noEmit && npm run build` passes with zero errors [phase]
- [ ] AGENTS.md reflects responsive scaling behavior, dynamic UI positioning, and mobile browse-then-confirm pattern in Controls and Behavior rules sections [phase]

## Auto-added safety criteria

Safety criteria: N/A — this phase introduces no API endpoints, user input fields, or query interpolation. All changes are client-side Phaser rendering and input handling.

## AGENTS.md sections affected

- **Controls** — add mobile dialogue choice confirmation pattern (tap to highlight, tap Confirm to commit)
- **Behavior rules** — update dialogue behavior to describe mobile browse-then-confirm; add responsive scaling behavior (canvas adapts to viewport, re-layouts on resize)
- **File ownership** — no new files expected (modifications to existing systems); update if new utility module is created
- **Depth map** — Confirm button at depth 200 (same as dialogue layer, no new entry needed)

## User documentation

No user manual exists for this POC. The AGENTS.md Controls and Behavior rules sections serve as the primary documentation. The done-when criterion for AGENTS.md reconciliation covers documentation updates for this phase.

## Golden principles (phase-relevant)
- Zone-level mutual exclusion (LEARNINGS #56) — resize handling must respect active dialogue/story scene state; resize during dialogue re-layouts UI without disrupting dialogue flow
- Input priority — keyboard takes priority over joystick; desktop keyboard dialogue flow (arrows + Enter) must not regress
- Depth map compliance — Confirm button at depth 200 (dialogue layer); no ad-hoc depth values
- Systems-based architecture — responsive layout logic lives in the systems that own the UI, not inlined in scenes
- Camera follows player with bounds = tile map pixel dimensions — bounds must update on resize
