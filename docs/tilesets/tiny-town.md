# Tiny Town — frame vocabulary

Per-frame intent for the Kenney Tiny Town atlas, scoped to frames used by
`src/data/areas/ashen-isle.ts`. Use this as a lookup when authoring a new
Ashen-Isle-style area: the goal is to make composing a building, fence, or
path a vocabulary lookup, not a pixel-hunt through `tilemap.png`.

## Atlas grid

Tiny Town is a **12 cols × 11 rows** grid of **16×16** frames, packed with
no inter-tile spacing (despite what `Tilesheet.txt` says — the actual PNG
is zero-spaced; the JSON manifest at `assets/tilesets/tiny-town/tilemap.json`
is the truth).

Frame index is computed row-major:

```
frame = row * 12 + col   (zero-indexed from the top-left corner)
```

So frame `15` is row 1 col 3; frame `60` is row 5 col 0; frame `128` is
row 10 col 8.

## Frames used in Ashen Isle (US-59)

| Frame | Intent | Used in |
|---|---|---|
| `0`, `1`, `2` | Plain grass floor variants — base FLOOR via `src/maps/tilesets.ts` `TILESETS['tiny-town']` | All FLOOR cells across the area |
| `6` | Pine tree (decoration) | `FRAME.TREE` — scattered open-grass decorations |
| `15` | Dirt patch — base EXIT via `TILESETS['tiny-town']` | EXIT zone tiles below the dock decoration |
| `16` | Small dirt patch — used as the dry-path overlay | `FRAME.PATH` — main vertical path, west branch, east branch, yard-interior path |
| `17` | Wooden boardwalk substitute — there is no true dock frame in the atlas | `FRAME.DOCK` — north dock at (23-26, 2) |
| `26` | Flower cluster (decoration) | `FRAME.FLOWER` — scattered open-grass decorations |
| `27` | Sign post (decoration) | `FRAME.SIGN` — sign next to the dock at (26, 5) |
| `28` | Bush (decoration) | `FRAME.BUSH` — scattered open-grass decorations |
| `60` | Red roof segment — PROVISIONAL pick for "building roof" | `FRAME.ROOF` — both cottage roof rows |
| `72` | Wall-front with window — PROVISIONAL pick for "building wall" | `FRAME.WALL_FRONT` — both cottage wall rows |
| `96` | Door front — PROVISIONAL pick for "building door" | `FRAME.DOOR` — both cottage doors |
| `120`, `121`, `122` | Stone block variants — also used as base WALL via `TILESETS['tiny-town']`. Cycled per cell as the cliff coast (substituting for water — Tiny Town has no water frames) | `FRAME.CLIFF_A/B/C` — north coast cliff bands |
| `128` | Wooden fence — best-guess pick from row 10 fence frames per `docs/plan/tileset-frame-analysis.md` | `FRAME.FENCE` — both yard perimeters |

### Substitution notes

Tiny Town does **not** include true water tiles. Ashen Isle's "north water
coast" reads-as cue is achieved by overlaying stone-block variants (frames
120-122) on WALL cells, which gives a rocky-shore feel rather than open
water. If a future tileset addition introduces water, swap the cliff frames
in `ashen-isle.ts`'s `FRAME.CLIFF_*` constants and update the corresponding
row in this table.

Tiny Town also does **not** include a clear dock or jetty frame. Frame `17`
is a small dirt-patch variant that reads as a flat surface stepping out
from the cliff; it's the cleanest available substitute for a dock.

Frames marked **PROVISIONAL** in `ashen-isle.ts` (`ROOF`, `WALL_FRONT`,
`DOOR`, `PATH`, `DOCK`, and the cliff variants) are best-guess picks from
visual atlas inspection. They can be swapped without touching topology by
editing only the `FRAME` constants and updating the rows above.

## Reserved for future use

Frames identified as useful for future area authoring but not yet referenced.
Each row notes the intended role so the next author doesn't need to
re-derive it.

| Frame | Intended role |
|---|---|
| `7`, `8`, `9`, `10` | Tree variants (pine, autumn) — additional scatter |
| `11` | Pink flower variant — alternate `FRAME.FLOWER` |
| `12`, `13`, `14` | Grass with patches / mushrooms / stones — alt floor decorations |
| `25` | Small stones — alternate ground decoration |
| `29` | Bush variant — alternate `FRAME.BUSH` |
| `36`–`47` | Roof variants — alternate `FRAME.ROOF` (different colors / shapes) |
| `48`–`59` | Roof bottoms / chimneys |
| `61`–`71` | Wall-top variants |
| `73`–`83` | Wall-front variants with different windows |
| `84`–`95` | Wall-bottom / foundation variants |
| `97`–`107` | Door / window variants — alternate `FRAME.DOOR` |
| `108`–`119` | Building details (stairs, signs, lamps) |
| `123`–`131` | Fence / gate / wall corner variants — alternate `FRAME.FENCE` |
