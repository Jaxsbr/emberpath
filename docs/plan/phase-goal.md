## Phase goal

Add visual editing layers to the rig editor canvas: bone connection lines that make the skeleton hierarchy visible, direct-manipulation drag to reposition bones, and propagation highlighting that shows which bones will move before the artist acts. All three features operate exclusively in Edit mode and are confined to `tools/editor/` — no changes to game `src/rig/` modules.

### Stories in scope
- US-36 — Visual bone connections
- US-37 — Canvas drag interaction
- US-38 — Propagation highlighting

### Done-when (observable)

#### US-36 — Visual bone connections
- [ ] In Edit mode, lines are drawn on the canvas from each parent bone's position to each child bone's position for the current direction [US-36]
- [ ] Connection lines update when a bone is repositioned via the property panel [US-36]
- [ ] Connection lines update when the direction is changed [US-36]
- [ ] Lines render above the grid background but below bone sprites (depth between grid and lowest bone depth) [US-36]
- [ ] Lines are not shown in animation preview modes (Idle/Walk/Run) [US-36]
- [ ] Lines mirror correctly for W/SW/NW directions [US-36]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-36]

#### US-37 — Canvas drag interaction
- [ ] Clicking and dragging a bone sprite on the canvas changes its position [US-37]
- [ ] During drag, the property panel X/Y values update in real-time [US-37]
- [ ] Dragging a parent bone visually moves all descendant bones (tree-walk propagation) [US-37]
- [ ] Drag modifies only the dragged bone's parent-relative X/Y offset (other bones' profile values unchanged) [US-37]
- [ ] Drag is disabled (no-op) for mirrored directions (W/SW/NW) [US-37]
- [ ] Connection lines (from US-36) update in real-time during drag [US-37]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-37]

#### US-38 — Propagation highlighting
- [ ] When a bone is selected in Edit mode, all its descendant bones have a visible highlight indicator on the canvas [US-38]
- [ ] The descendant highlight is visually distinct from the selected bone's red bounding box (different color or style) [US-38]
- [ ] Selecting a leaf bone (no children) shows no descendant highlights [US-38]
- [ ] Selecting a different bone immediately updates which bones are highlighted [US-38]
- [ ] Descendant highlights are only shown in Edit mode [US-38]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-38]

#### Structural / cross-cutting
- [ ] AGENTS.md reflects new editor interaction features (bone connections, drag, propagation highlights) introduced in this phase [phase]
- [ ] No editor-specific logic leaks into game `src/rig/` modules — all changes are confined to `tools/editor/` [phase]

### Golden principles (phase-relevant)
- Responsive scaling: Phaser Scale.RESIZE mode — canvas adapts to container/viewport size. No fixed dimensions.
- Parameterized systems architecture: Rig editor receives rig definitions as immutable data; no hardcoded fox-specific logic.
- Frame-based delta-time: Phaser preview scene uses delta time for animation preview.
- Rig coordinate model: Parent-relative coordinates with depth-first tree-walk resolution. Editor must use `rig.applyProfiles()` for rendering — never set sprite positions directly.
- Depth map: All new visual elements must use the depth map in AGENTS.md. Ad-hoc depth values are prohibited.
- File ownership: All canvas interaction code belongs in `tools/editor/src/rigRenderer.ts` — do not add editor-specific logic to `src/rig/` modules.

### Design direction
High-contrast on dark canvas. Bone connections use semi-bright teal (#4ecdc4) at 60-70% alpha — visible but not overpowering. Descendant propagation highlights use amber outline or glow (#f7d794) — distinct from the red selection box (#e94560). Visual language: professional rigging-tool overlays against dark navy (#1a1a2e) background, not debug wireframes.
