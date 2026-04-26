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

So frame `22` is row 1 col 10; frame `36` is row 3 col 0; frame `92` is
row 7 col 8.

## Frames used in Fog Marsh (US-60)

Verified visually against the labeled atlas (regenerate with
`/tmp/label_atlas.py`).

| Frame | Intent | Used in |
|---|---|---|
| `0`, `1`, `2` | Brown dirt floor — base WALL via `src/maps/tilesets.ts` `TILESETS['tiny-dungeon']` (the existing mapping; reads as "compacted dark earth" rather than a stone wall, but visually distinct from the tan dungeon-floor base) | All WALL cells |
| `4`, `5` | Stone block wall with mortar pattern — clearly wall-shaped | `FRAME.RUIN_A/B` — ruin perimeter (top + sides) |
| `16` | Stone block wall variant | `FRAME.RUIN_C` — ruin perimeter rotation |
| `22` | Wooden door — base EXIT via `TILESETS['tiny-dungeon']` AND ruin door decoration | Fog Marsh exit zone (south); ruin door at (24, 9) |
| `24` | Tan floor with bones / debris scatter — used as the visual cue at the Whispering Stones trigger | `FRAME.STONES` — at (13, 16) immediately west of the path |
| `33`, `34`, `35` | Dark navy / pool — closest substitute for "deep water" | `FRAME.EDGE_A/B/C` — left-edge marsh wall (cycled per cell) |
| `36`, `37` | Wooden plank floor (horizontal grain) — reads as a boardwalk laid down across the marsh | `FRAME.PATH_A/B` — dry path vline col 14 + hline row 10 |
| `48`, `49`, `50`, `51` | Tan dungeon floor — base FLOOR via `TILESETS['tiny-dungeon']` (acts as the "damp earth" base layer; dry path overlays it with wood planks) | All FLOOR cells across the area |
| `92`, `93` | Log pile / wooden bundle — substitute for "reed clump" (no native vegetation in atlas) | `FRAME.REED_A/B` — 10 scattered reed entries off the dry path |

### Substitution notes

Tiny Dungeon is a **dungeon** tileset — it does not include water, reeds,
cattails, marsh edges, mossy ground, or any wetland-specific frames. Every
"marsh" element in Fog Marsh is composed from the closest available substitute:

- **Wet ground** → frames `48`-`51` (the existing tan dungeon floor). The
  base layer reads as "compacted earth, slightly damp" rather than as
  visible water; the visual contrast comes from the dry-path overlay rather
  than the base.
- **Dry path** → frames `36`-`37` (wooden planks with horizontal grain).
  Reads as a boardwalk laid down across the marsh — clearly walkable,
  visually distinct from the tan base.
- **Marsh edge** → frames `33`-`35` (dark navy frames). The closest thing
  to "deep water" in the atlas; reads as "you can't go this way, the
  marsh is too deep."
- **Ruin walls** → frames `4`, `5`, `16` (proper stone-block walls with
  mortar pattern). Distinct from base WALL frames `0`-`2` (brown dirt) so
  the ruin reads as a built thing in contrast to the natural ground.
- **Reeds / cattails** → frames `92`, `93` (log piles). Probably look like
  small wooden bundles up close, but at decoration scale read as "small
  upright clumps growing in the marsh."
- **Whispering Stones** → frame `24` (tan floor with bones / debris
  scatter). Reads as old debris on the path side — a hint that something
  ancient happened here.

If a future tileset addition introduces real wetland frames, swap the
`FRAME` constants in `fog-marsh.ts` and update the rows above. The map
topology and trigger positions do not depend on the frame indices.

## Reserved for future use

Frames identified as useful for future area authoring but not yet referenced.

| Frame | Intended role |
|---|---|
| `3`, `6`, `15`, `27` | Brown floor variants — alternate base FLOOR shading |
| `7`, `8` | Stone wall with iron / torch detail — alternate ruin walls |
| `9`–`11`, `21`–`23` | Stone wall + dark openings — door / window variants |
| `12`–`14` | Brown floor with dirt details — alternate wet ground variants |
| `17`, `18`, `19`, `20` | Stone walls with chains / bars — dungeon ruin detailing |
| `25` | Tan floor with white spots — alternate `FRAME.STONES` |
| `26`, `28`, `29` | Stone block variants — additional ruin masonry |
| `30`, `31`, `32` | Stone block + treasure / gem details — interior decorations |
| `38`, `39` | More wooden plank variants — alternate `FRAME.PATH_*` |
| `40`–`47` | Stone block windows + arrow slits + door variants |
| `52`–`56` | More tan floor / sand variants |
| `57`–`59` | Brown wood door panel variants — alternate `FRAME.DOOR` |
| `60`–`63` | Sand / lighter floor variants |
| `64`–`71` | Stone walls + barrels |
| `72`–`74` | Small icons (frame, square, hatching) |
| `75`–`78` | Wood blocks / signs |
| `79`–`83` | Wooden barrels (large + small) |
| `84`–`91` | Dark wood blocks + railing |
| `94`–`95` | Pile / chest icons |
| `96`–`107` | Character / NPC frames + chests |
| `108`–`131` | More characters, weapons, potions, items, monsters — out of scope for area decoration |
