## Phase goal

Mobile UX phase — make the game properly responsive and touch-friendly. Three concerns: (1) responsive canvas scaling that adapts to any device/orientation without letterboxing, (2) dynamic UI positioning so dialogue, story scenes, and thought bubbles work at any canvas size, (3) a mobile browse-then-confirm pattern for dialogue choices to prevent mis-taps.

### Dependencies
- interaction

### Stories in scope
- US-11 — Responsive canvas scaling
- US-12 — Dynamic UI positioning
- US-13 — Mobile dialogue browse-then-confirm

### Done-when (observable)

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

### Golden principles (phase-relevant)
- Zone-level mutual exclusion (LEARNINGS #56) — resize handling must respect active dialogue/story scene state; resize during dialogue re-layouts UI without disrupting dialogue flow
- Input priority — keyboard takes priority over joystick; desktop keyboard dialogue flow (arrows + Enter) must not regress
- Depth map compliance — Confirm button at depth 200 (dialogue layer); no ad-hoc depth values
- Systems-based architecture — responsive layout logic lives in the systems that own the UI, not inlined in scenes
- Camera follows player with bounds = tile map pixel dimensions — bounds must update on resize
