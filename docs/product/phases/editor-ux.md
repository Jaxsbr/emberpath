# Phase: editor-ux

Status: draft

## Stories

### US-36 — Visual bone connections

As a rig artist, I want to see lines connecting parent bones to their children on the editor canvas, so that the bone hierarchy is visible without relying solely on the sidebar tree.

**Acceptance criteria**:
- In Edit mode, lines are drawn from each parent bone's position to each of its children's positions
- Lines update in real-time when bones are repositioned (via property panel or drag)
- Lines update when the direction is changed
- Lines are visually distinct from bone sprites (different color, rendered behind sprites but above grid)
- Lines are only shown in Edit mode (not Idle/Walk/Run animation preview)
- Connection lines follow the same mirroring behavior as bones for W/SW/NW directions

**User guidance:**
- Discovery: Lines appear automatically in Edit mode — no toggle needed
- Manual section: N/A (dev tool, no user manual)
- Key steps: Open the rig editor, select Edit mode — bone connections are visible on canvas between parent and child bones

**Design rationale:** Always-visible connection lines (no toggle) because the hierarchy is foundational context for every editing action. Hiding them behind a toggle means the user must remember to enable them, recreating the "invisible hierarchy" problem.

### US-37 — Canvas drag interaction

As a rig artist, I want to click and drag bone sprites directly on the canvas to reposition them, so that I can pose the character with direct manipulation instead of typing numbers.

**Acceptance criteria**:
- Clicking and dragging a bone sprite on the canvas repositions it
- The property panel X/Y values update in real-time during drag
- Dragging a parent bone visually moves all its descendants (tree-walk propagation applies)
- Drag only modifies the dragged bone's local offset (parent-relative X/Y)
- Drag is disabled for mirrored directions (W/SW/NW) — matching property panel behavior
- The dragged bone is selected (if not already) when the drag starts
- Connection lines update during drag

**User guidance:**
- Discovery: Click and drag any bone sprite in Edit mode
- Manual section: N/A (dev tool, no user manual)
- Key steps: In Edit mode, click a bone sprite on the canvas and drag to reposition. Property panel X/Y values update live. Descendant bones follow if the dragged bone is a parent.

**Design rationale:** Direct manipulation is the expected interaction model for visual editing tools. Numeric-only input requires mental translation between coordinate values and visual positions, which is slow and error-prone for a 46-bone character.

### US-38 — Propagation highlighting

As a rig artist, I want to see which bones will be affected when I move a selected bone, so that I understand the propagation direction before editing.

**Acceptance criteria**:
- When a bone is selected, its descendants are visually highlighted on the canvas
- The highlight is visually distinct from the selection highlight (selected bone = existing red box, descendants = different indicator)
- Selecting a leaf bone (no children) shows no propagation highlight
- The highlight updates immediately when a different bone is selected
- The highlight is visible in Edit mode only

**User guidance:**
- Discovery: Select any bone — descendants highlight automatically
- Manual section: N/A (dev tool, no user manual)
- Key steps: Click a bone in the hierarchy panel or on canvas. All descendant bones that would move along with it are highlighted with a distinct amber indicator.

**Design rationale:** Without propagation feedback, the user must mentally trace the skeleton tree to understand which bones are affected by a move. Visual highlighting makes this instant and eliminates the "I moved the head, why didn't the neck move?" confusion that prompted this phase.

## Done-when (observable)

### US-36 — Visual bone connections
- [ ] In Edit mode, lines are drawn on the canvas from each parent bone's position to each child bone's position for the current direction [US-36]
- [ ] Connection lines update when a bone is repositioned via the property panel [US-36]
- [ ] Connection lines update when the direction is changed [US-36]
- [ ] Lines render above the grid background but below bone sprites (depth between grid and lowest bone depth) [US-36]
- [ ] Lines are not shown in animation preview modes (Idle/Walk/Run) [US-36]
- [ ] Lines mirror correctly for W/SW/NW directions [US-36]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-36]

### US-37 — Canvas drag interaction
- [ ] Clicking and dragging a bone sprite on the canvas changes its position [US-37]
- [ ] During drag, the property panel X/Y values update in real-time [US-37]
- [ ] Dragging a parent bone visually moves all descendant bones (tree-walk propagation) [US-37]
- [ ] Drag modifies only the dragged bone's parent-relative X/Y offset (other bones' profile values unchanged) [US-37]
- [ ] Drag is disabled (no-op) for mirrored directions (W/SW/NW) [US-37]
- [ ] Connection lines (from US-36) update in real-time during drag [US-37]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-37]

### US-38 — Propagation highlighting
- [ ] When a bone is selected in Edit mode, all its descendant bones have a visible highlight indicator on the canvas [US-38]
- [ ] The descendant highlight is visually distinct from the selected bone's red bounding box (different color or style) [US-38]
- [ ] Selecting a leaf bone (no children) shows no descendant highlights [US-38]
- [ ] Selecting a different bone immediately updates which bones are highlighted [US-38]
- [ ] Descendant highlights are only shown in Edit mode [US-38]
- [ ] `cd tools/editor && npx tsc --noEmit && npm run build` passes [US-38]

### Structural / cross-cutting
- [ ] AGENTS.md reflects new editor interaction features (bone connections, drag, propagation highlights) introduced in this phase [phase]
- [ ] No editor-specific logic leaks into game `src/rig/` modules — all changes are confined to `tools/editor/` [phase]

Safety criteria: N/A — this phase introduces no endpoints, user input fields, or query interpolation. All changes are to a local dev tool's canvas interaction.

## Design direction

High-contrast on dark canvas. Bone connections use a semi-bright teal line (#4ecdc4 or similar) at 60-70% alpha — visible but not overpowering. Descendant propagation highlights use an amber outline or glow (#f7d794) distinct from the red selection box (#e94560). The visual language communicates hierarchy clearly against the existing dark navy (#1a1a2e) background. Lines and highlights should feel like professional rigging-tool overlays, not debug wireframes.

## Golden principles (phase-relevant)
- Responsive scaling: Phaser Scale.RESIZE mode — canvas adapts to container/viewport size
- Parameterized systems architecture: Rig editor receives rig definitions as immutable data; no hardcoded fox-specific logic
- Frame-based delta-time: Phaser preview scene uses delta time for animation preview
- Rig coordinate model: Parent-relative coordinates with depth-first tree-walk resolution. Editor must use `rig.applyProfiles()` for rendering

## AGENTS.md sections affected
- File ownership: `tools/editor/src/rigRenderer.ts` entry may need update if new editor modules are introduced
- Behavior rules: Editor interaction model (bone connections, drag, propagation highlights) should be documented
