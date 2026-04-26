# Tiny Town — frame vocabulary

Per-frame intent for the Kenney Tiny Town atlas, scoped to frames used by
`src/data/areas/ashen-isle.ts`. Use this as a lookup when authoring a new
Ashen-Isle-style area: the goal is to make composing a building, fence, or
path a vocabulary lookup, not a pixel-hunt through `tilemap.png`.

## Atlas grid

Tiny Town is a **12 cols × 11 rows** grid of **16×16** frames, packed with
no inter-tile spacing. The JSON manifest at
`assets/tilesets/tiny-town/tilemap.json` is the truth on dimensions.

Frame index is computed row-major:

```
frame = row * 12 + col   (zero-indexed from the top-left corner)
```

So frame `15` is row 1 col 3; frame `64` is row 5 col 4; frame `120` is
row 10 col 0.

## Frames used in Ashen Isle (US-59)

Verified visually against the labeled atlas (regenerate with
`/tmp/label_atlas.py`).

| Frame | Intent | Used in |
|---|---|---|
| `0`, `1`, `2` | Plain green grass — base FLOOR via `src/maps/tilesets.ts` `TILESETS['tiny-town']` | All FLOOR cells across the area |
| `6` | Pine tree | `FRAME.TREE` — scattered open-grass decorations |
| `15` | Dirt patch — base EXIT via `TILESETS['tiny-town']` | EXIT zone tiles below the dock decoration |
| `22` | Yellow mushroom — substitute for "flower cluster" (no true flower frames in atlas) | `FRAME.FLOWER` — scattered open-grass decorations |
| `30` | Green bush cluster | `FRAME.BUSH` — scattered open-grass decorations |
| `51` | Tan dirt path with grass border — clear "trodden" surface, distinct from plain grass | `FRAME.PATH` — main vertical, west branch, east branch, yard-interior path |
| `55` | Green cobblestone surface — distinct surface marking the exit zone | `FRAME.DOCK` — north dock at (23-26, 2) |
| `64` | Red roof segment with white pattern | `FRAME.ROOF` — both cottage roof rows |
| `72` | Brown wall middle (sandy) — pairs with red roof above | `FRAME.WALL_FRONT` — both cottage wall rows |
| `80` | Horizontal wooden plank — fence panel | `FRAME.FENCE` — both yard perimeters |
| `95` | Sign post | `FRAME.SIGN` — sign next to the dock at (26, 5) |
| `97` | Brown wall with brown wooden door — clear door | `FRAME.DOOR` — both cottage doors |
| `120`, `121`, `122` | Light grey stone block variants — also used as base WALL via `TILESETS['tiny-town']`. Cycled per cell as the cliff coast (substituting for water — Tiny Town has no water frames) | `FRAME.CLIFF_A/B/C` — north coast cliff bands |

### Substitution notes

Tiny Town does **not** include true water tiles. Ashen Isle's "north water
coast" reads-as cue is achieved by overlaying stone-block variants (frames
120-122) on WALL cells, which gives a rocky-shore feel rather than open
water. If a future tileset addition introduces water, swap the cliff frames
in `ashen-isle.ts`'s `FRAME.CLIFF_*` constants and update the corresponding
row in this table.

Tiny Town also does **not** include a clear dock or jetty frame. Frame `55`
(green cobblestone) is the closest distinctive surface tile — used here as
the dock decoration so the EXIT zone reads as "step onto this special
surface to leave."

The atlas has no dedicated flower frames; mushroom (frame `22`) is used as
the closest small-bright-decoration substitute.

## Reserved for future use

Frames identified as useful for future area authoring but not yet referenced.

| Frame | Intended role |
|---|---|
| `7`, `8`, `9`, `10`, `11` | Tree variants (pine, autumn) — additional scatter |
| `19`, `20`, `31` | Bush cluster variants — alternate `FRAME.BUSH` |
| `21`, `41`, `42` | Mushroom variants — alternate `FRAME.FLOWER` substitute |
| `23`, `33`–`35`, `40`, `45`–`47` | Small orange tree variants |
| `26` | Plain dark grass — alternate FLOOR variant |
| `36`–`39` | Dark dirt / orange ground variants — alternate path / dock |
| `52`–`54` | Tan path variants with grass border — alternate `FRAME.PATH` |
| `56`–`59`, `68`–`71`, `81`–`83`, `92`–`94` | Wooden post / beam variants — alternate fence pieces |
| `60`–`63`, `76`–`79` | Grey wall variants (with arch / window) — alternate `FRAME.WALL_FRONT` for grey buildings |
| `65`, `66`, `67` | Red roof variants — alternate `FRAME.ROOF` (top, middle, corner) |
| `73`, `74`, `75` | Brown wall variants (with arch / corner) — alternate wall sections |
| `84`–`91` | Wall-bottom + door-arch variants |
| `98`, `99`, `100`, `101`, `102`, `103` | Door / window variants — alternate `FRAME.DOOR` |
| `104`–`107` | Items (mug, ring, lamp, target) |
| `108`–`119` | Stone block tops + items (stairs, hammer, face, bomb, jar, cup) |
| `123`–`126` | Stone arches (gate-like) |
| `127`–`131` | Tools (hammer, pitchfork, key, bow, arrow) |
