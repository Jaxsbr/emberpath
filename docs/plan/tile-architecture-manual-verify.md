# Tile-Architecture — Manual Verify

Operator-driven verification doc. Each section's checkboxes are filled in-engine; each item links to the done-when criterion in `docs/product/phases/tile-architecture.md`.

## § Architecture-only baseline (US-94)

After stage 1 (US-92 + US-93 + US-94) ships, both areas must render *visually identical to today* on the existing Kenney atlases — the new architecture is wired in degenerate-Wang mode and adds the object layer, but no PixelLab content has landed yet.

### Boot the dev server

```bash
cd /Users/jacobusbrink/Jaxs/projects/emberpath
npm run dev
# Open http://localhost:5173 (clear localStorage if reverting from a stage-2 save)
```

### Ashen Isle — desktop ~1280×720, zoom ~4×

- [ ] Title screen renders; Start fires GameScene on Ashen Isle.
- [ ] Floor cells render as the existing tan-grass Tiny Town frames (degenerate Wang `'0000'`).
- [ ] Wall cells render as the existing grey-block Tiny Town frames (degenerate Wang `'1111'`).
- [ ] Exit zone (north dock) shows a translucent hope-gold overlay at depth 0.5 (replaces the legacy EXIT atlas frame).
- [ ] Old Man / Wren / Driftwood NPCs spawn at their authored positions with idle animations.
- [ ] Walking into a wall cell stops movement (collision unification check).
- [ ] Walking onto a tree / fence / wall-front / door cell stops movement (object collision check).
- [ ] Walking onto a flower / sign cell does NOT stop movement (passable-object check).
- [ ] North-exit transition fires when player walks into the dock zone.
- [ ] No console errors related to `[wang]`, `[GameScene]`, `[tilesets]`, or `[atlasPreview]`.

### Ashen Isle — mobile DevTools 360×640, zoom ~1.1×

- [ ] Layout renders without horizontal scroll; player visible.
- [ ] Tile rendering matches desktop (no missing frames, no z-fighting).
- [ ] Object depth ordering: trees / walls / NPCs render above terrain, below thought bubbles.

### Fog Marsh — desktop

- [ ] Transition from Ashen Isle north-exit → Fog Marsh fires; player spawns on the entry tile.
- [ ] Marsh floor renders as Tiny Dungeon FLOOR frames; tomb walls render as Tiny Dungeon WALL frames.
- [ ] Marsh Hermit NPC spawns and is interactable.
- [ ] Threshold trigger at (col 14, row 5) flips `marsh_trapped` to `true` AND closes the south exit on the same tick.
- [ ] After the closure trigger fires, walking south to the closed cells (col 13-16, row 22) is BLOCKED — the new conditional `wall-tomb` object pathway is the only collision contributor (verifies `applyMarshTrappedState` removal didn't regress the closure).
- [ ] Press Reset Progress in the Title — closure restores (cells walkable again).

### Fog Marsh — mobile DevTools

- [ ] Same as desktop. Object depth ordering correct.
- [ ] Conditional-object visibility flips on `marsh_trapped` flag change without flicker.

### Save-state compatibility (US-92 cross-cutting)

- [ ] A pre-phase save loads post-phase without error; player resumes at the same world position (saved position is pixel coords, terrain/objects migration doesn't invalidate it).
- [ ] If the saved cell is impassable under the new model (object-blocked OR all-impassable terrain), TitleScene logs the warning and falls back to playerSpawn.

---

## § PixelLab tileset generation (US-95) — stage 2

To be filled when US-95 ships.

## § PixelLab object generation (US-96) — stage 2

To be filled when US-96 ships.

## § Editor smoke test (US-97)

To be filled when US-97 ships.

## § Final re-author smoke test (US-98)

To be filled when US-98 ships.

## § Cost reconciliation

To be filled when stage 2 generations are complete.
