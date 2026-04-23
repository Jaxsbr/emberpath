# Tileset Frame Analysis

Draft frame-index mapping for `src/maps/tilesets.ts`. Indices assume packed spritesheet layout (row-major, `index = row * columns + col`, zero-based).

> These are informed guesses from the atlas preview. Implementation must visually verify by rendering a debug grid and swapping indices that read wrong. When in doubt, prefer a conservative pick that obviously satisfies the role (grass with no path markings, solid stone with no doorway) over a pick that's aesthetically tempting but ambiguous.

## Tiny Town (12 columns × 11 rows = 132 frames)

Ashen Isle. Warm green-brown overworld.

### FLOOR (grass/ground, ≥3 variants)
- `0` — grass, plain
- `1` — grass with small detail (tuft or flower)
- `2` — grass with different detail
- `12` — backup: tall grass patch (if 1/2 read too busy)

### WALL (solid obstacle, ≥2 variants)
Row 10 contains stone-wall / fence tiles. Best-guess solid-stone frames:
- `120` — stone block
- `121` — stone block variant
- `122` — stone block variant (third option if needed)

Fallback candidates if row 10 reads more as "decorative fence" than wall:
- `72`, `84` — building wall rows (stone-textured)

### EXIT (dirt path / doorway, ≥1 frame)
- `15` — dirt path (row 1, col 3 — circular/patch dirt reads as "walkable stone")
- fallback: `14` if `15` is too directional

### Prop frame candidates (non-blocking decoration)
Ashen Isle ≥15 props needed. Candidates:
- Trees: `6` (pine), `7` (pine), `8` (autumn), `9` (dead), `10` (heavy)
- Flowers: `11` (pink), `26` (daisy/flower cluster)
- Stones: `13`, `25` (small stones)
- Bushes: `28`, `29` (shrubs)
- Signs: `27` (sign post)
- Fences (decorative, not collision): row 10 idx `128`, `129`, `130`, `131` if not used as WALL
- Barrels/crates: mid-atlas decor around `100`+ if inhabited look suits the scene

## Monochrome RPG — Monochrome variant (17 columns × 8 rows = 136 frames)

Fog Marsh. Dead grey dead-end allegory.

### FLOOR (grey grass/ground, ≥3 variants)
- `0` — grey grass
- `1` — grey grass variant
- `2` — grey grass variant
- `17` — darker variant backup (row 1 left)

### WALL (solid obstacle, ≥2 variants)
Stone walls in mid-atlas rows. Best-guess:
- `51` (row 3 col 0) — solid stone wall
- `52` — stone wall variant
- fallback: `34`, `35`

### EXIT (flagstone / stairs / doorway)
Row 2 contains stairs/doors.
- `39` — stairs or doorway tile (row 2 col 5)
- fallback: `40`, `56`

### Prop frame candidates
Fog Marsh ≥10 props needed. Candidates:
- Gravestones: `18`, `19` (row 1 left)
- Mushrooms: `20`, `21`
- Skulls / bones: `22`, `23`
- Dead shrubs: `3`, `4` (row 0 right)
- Dead trees: `5`, `6`
- Small stones: `24`
- Hearts (narrative?): avoid — they're HUD-flavored

## Open questions for implementation

1. **Verification strategy**: after wiring `tilesets.ts` and `GameScene.preload()`, render a small debug grid of every frame index in a scratch scene, or use `Phaser.Textures.addSpriteSheet` to inspect. Faster: temporarily render a labeled grid in-game behind the F3 overlay.

2. **EXIT frame orientation**: tiny-town path tiles may be directional (horizontal vs vertical). The exit zone is a single cell, so we need a non-directional tile (circular patch or end-cap). Prefer frame `15` for its "spot" feel.

3. **Error handling**: `tilesets.ts` should expose a `resolveFrame(tilesetId, tileType, col, row): number | null` with a fallback frame for unknown tile types — logs a descriptive warning and returns null so the render loop can draw a fallback (or skip).

4. **Prop depth**: all props at depth 3 per phase spec. No sorting by y within depth 3 — the spec accepts constant-depth props (player depth 5 > prop depth 3 covers the main "walk in front" behavior).
