# Tiny Dungeon — frame vocabulary

Per-frame intent for the Kenney Tiny Dungeon atlas, scoped to frames used by
`src/data/areas/fog-marsh.ts`. Use this as a lookup when authoring a new
Fog-Marsh-style area: the goal is to make composing a ruin, dry path, or
marsh edge a vocabulary lookup, not a pixel-hunt through `tilemap.png`.

## Atlas grid

Tiny Dungeon is a **12 cols × 11 rows** grid of **16×16** frames, packed with
no inter-tile spacing. The JSON manifest at
`assets/tilesets/tiny-dungeon/tilemap.json` is the truth on dimensions.

Frame index is computed row-major:

```
frame = row * 12 + col   (zero-indexed from the top-left corner)
```

So frame `22` is row 1 col 10; frame `36` is row 3 col 0; frame `108` is
row 9 col 0.

## Frames used in Fog Marsh (US-60)

| Frame | Intent | Used in |
|---|---|---|
| `0`, `1`, `2` | Brick wall variants — base WALL via `src/maps/tilesets.ts` `TILESETS['tiny-dungeon']` AND ruin brick decoration AND marsh-edge decoration | All WALL cells; ruin perimeter; left-edge marsh wall |
| `22` | Wooden door — base EXIT via `TILESETS['tiny-dungeon']` AND ruin door decoration | Fog Marsh exit zone (south); ruin door at (24, 9) |
| `36`, `37`, `38`, `39` | Wet/moss floor variants — base FLOOR via `TILESETS['tiny-dungeon']` (changed from the prior tan dungeon-floor frames `48`-`51` so the marsh interior reads as wet ground rather than dungeon floor) | All FLOOR cells across the area |
| `48`, `49` | Tan dungeon floor — relegated to the dry-path decoration overlay so the path reads as visually distinct against the wet base | `FRAME.PATH_A/B` — dry path vline col 14 + hline row 10 |
| `108`, `109` | Item / prop frames substituting for reeds / cattails — Tiny Dungeon has no native vegetation frames, so a small organic prop is used | `FRAME.REED_A/B` — 10 scattered reed entries off the dry path |
| `116` | Carved-stone / skull-like prop — visual cue beside the Whispering Stones trigger | `FRAME.STONES` — at (13, 16) immediately west of the path |

### Substitution notes

Tiny Dungeon is a **dungeon** tileset — it does not include water, reeds,
cattails, marsh edges, mossy ground, or any wetland-specific frames. Every
"marsh" element in Fog Marsh is composed from the closest available substitute:

- **Wet ground** → frames `36`-`39` (best-guess dark/damp variants from row 3).
  These were chosen because they read cleanly different from the existing
  tan dungeon floor (`48`-`51`), giving the contrast the path overlay needs.
- **Dry path** → frames `48`-`49` (the prior tan dungeon floor) overlaid as
  decoration. The "you're walking on path" cue comes from the contrast with
  the wet base, not the absolute frame appearance.
- **Marsh edge** → frame `0` (brick wall). Reads as solid even though the
  fictional substance is dense reeds / deep water.
- **Ruin walls** → frames `0`, `1`, `2` (the same brick variants as base
  WALL). Reuses the existing palette so the ruin reads as continuous with
  the dungeon-tileset aesthetic rather than an alien graft.
- **Reeds / cattails** → frames `108`, `109` (best-guess prop frames).
  Probably look like small skulls / candles up close, but at decoration scale
  read as "something growing here in the marsh." Any future tileset that
  adds true reed frames should swap these in `FRAME.REED_A/B`.
- **Whispering Stones** → frame `116` (best-guess carved-stone frame).

If a future tileset addition introduces real wetland frames, swap the
`FRAME` constants in `fog-marsh.ts` and update the rows above. The map
topology and trigger positions do not depend on the frame indices.

## Reserved for future use

Frames identified as useful for future area authoring but not yet referenced.

| Frame | Intended role |
|---|---|
| `3`, `4`, `5` | Brick wall corners — explicit corner detailing for ruins |
| `6`, `7`, `8` | Brick wall ends / pillars |
| `12`–`21` | Wall variants with windows / arrow slits — alternate ruin wall styles |
| `23`–`35` | Door / arch variants — alternate `FRAME.DOOR` (closed, half-open, broken) |
| `40`–`47` | Floor variants with details (cracks, moss, blood) — alternate wet/dry floor |
| `50`–`59` | More wet floor variants |
| `60`–`71` | Sandy / lighter floor variants — alternate dry path |
| `72`–`83` | Brick floor patterns — interior of ruin |
| `84`–`95` | Door arch variants — entrance detailing |
| `96`–`107` | Items (barrels, crates, urns) — alternate decoration |
| `110`–`119` | Props (skulls, candles, bones) — alternate `FRAME.REED_*` substitutes |
| `120`–`131` | Character / NPC frames — out of scope for area decoration |
