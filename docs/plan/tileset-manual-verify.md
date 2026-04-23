# Tileset phase — manual verification checklist

Each checkbox is a done-when criterion from `docs/product/phases/tileset.md` that requires running the game in a browser. Tick off as verified. Add notes in the "observer notes" section when a criterion has nuance (e.g., "dirt-path reads as doorway from 10ft away").

**How to run**: `npm run dev` from the repo root, then open the URL in a browser. Start the game, move around both areas. F3 toggles the debug overlay.

## Ashen Isle (`tiny-town`)

- [ ] On scene load, floor shows ≥3 visually distinct grass/ground variants across the visible map [US-49]
- [ ] Walls show ≥2 visually distinct stone/edge variants [US-49]
- [ ] ≥15 props visible across the map (bushes, stones, trees, fences) at expected positions [US-50]
- [ ] Exit tile renders as a dirt-path sprite; fox can walk into it and trigger area transition to Fog Marsh [US-51]
- [ ] Fox sprite renders in front of a prop when the fox's world y > prop's world y (walk behind-then-in-front of a tree to verify) [US-50]
- [ ] Exit tile communicates "walkable path toward map edge" rather than "glowing UI marker" — first-time-player reads-as [US-51]

## Fog Marsh (`monochrome-rpg`)

- [ ] Floor shows ≥3 visually distinct grey/dead variants across the visible map [US-49]
- [ ] Walls show ≥2 visually distinct monochrome variants [US-49]
- [ ] ≥10 props visible (gravestones, skulls, dead shrubs, bones) at expected positions [US-50]
- [ ] Exit tile renders as a flagstone/doorway sprite; area transition still fires on overlap [US-51]
- [ ] Exit tile communicates "doorway/stone threshold" rather than "glowing UI marker" — first-time-player reads-as [US-51]

## Both areas

- [ ] Tile art renders crisp (no smoothing/blur) — visible on close inspection of a single tile [US-48]
- [ ] No console errors or warnings during scene load or during normal play for 30 seconds [US-48]

## If something reads wrong

Frame indices for FLOOR/WALL/EXIT and prop `spriteFrame` values live in:
- `src/maps/tilesets.ts` — FLOOR/WALL/EXIT per tileset
- `src/data/areas/{ashen-isle,fog-marsh}.ts` — prop frame ids

All indices come from `docs/plan/tileset-frame-analysis.md` and are best-guess from atlas preview. If a tile reads wrong, edit the index in `tilesets.ts`; if a prop reads wrong, edit its `spriteFrame` in the area file. No architectural change needed — the registry + picker keep the change surgical.

## Observer notes

<!-- Add per-check notes here as manual verification progresses -->
