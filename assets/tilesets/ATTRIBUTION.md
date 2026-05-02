# Tileset Attribution

## PixelLab tilesets (US-95)

Generated 2026-04-30 via the personal `mcp__pixellab__create_topdown_tileset` server. Each is a 4×4 grid (64×64 PNG) of 16 unique Wang tiles produced by the `tileset15` algorithm, prompt-composed through `composeArtPrompt(subject, mood)` with `STYLE_VIBE_PROMPT` riding every call. Hope-gold (`#F2C95B` / `#E89C2A`) is explicitly named in the mood block as excluded — gold reserved for narrative beats per `docs/art-style.md` § Palette.

### Ashen Isle chain

| Pair | Tileset id | Lower | Upper | Transition | Size |
|---|---|---|---|---|---|
| grass→sand | `2d11fd17-da93-4e4d-9094-f3e0b7aa3de3` (reroll — original `ad38f433-0670-487b-8d76-3901582b78ce` rendered grass too brown; reroll allows mossy green #7A8A55 as the dominant grass hue while keeping sand stable via `upper_base_tile_id` chained from the original sand) | muted mossy-green grass with sepia undertones | pale dry sand with faint stippled grain | dry sepia weeds and stray pebbles where mossy grass meets sand | 0.25 |
| sand→path | `dd2ef281-17f7-49aa-be44-fa211016ef25` | pale dry sand with faint stippled grain (chained from grass→sand) | compacted sepia path of small flat stones | compacted sepia stones | 0.25 |

### Fog Marsh chain

| Pair | Tileset id | Lower | Upper | Transition | Size |
|---|---|---|---|---|---|
| marsh-floor→path | `0a444b6d-7077-4a3a-882b-fbe02a455c37` | wet sepia mire with mottled umber pooling | raised wooden plank walkway with knotted grain | raised wooden planks at edge | 0.5 |
| marsh-floor→water | `bd2d04ef-a6b6-4007-b6c5-b6120c9c4e36` | wet sepia mire (chained from floor→path) | murky standing water in deep umber and slate-blue | murky reed shallows | 0.5 |
| marsh-floor→stone | `fa67b851-8eb8-48c7-a681-8bf81c22d2f3` | wet sepia mire (chained from floor→path) | weathered umber stone slabs with crumbling edges | weathered umber rubble | 0.25 |

### Generation budget reconciliation

Spec budget: ≤ 1 reroll per tileset (10 generations max). Personal server cost: **6 generations, 1 reroll** (grass→sand operator-driven reroll for grass colour).

(See `docs/plan/LEARNINGS.md` § EP-05 for the prior-batch retro: a first attempt fired against the maxed-out `mcp__pixellab-team__` server burned 9 generations on that account before the operator caught the wrong-server mistake. The personal-server batch above is the successful retry.)

### Common PixelLab settings

All five calls used:

- `view: "high top-down"`
- `outline: "selective outline"`
- `shading: "basic shading"`
- `detail: "medium detail"`
- `tile_size: { width: 16, height: 16 }`

### Wang corner mask layout

The PixelLab `tileset15` algorithm produces a fixed 4×4 frame layout per tileset — the mask→frame mapping is identical across all five generated tilesets. See `src/maps/tilesets.ts` `pixellabCornerMaskTable()` for the canonical mapping; `tools/wire-tilesets.ts` is the parser that derived it from each `tilemap.json`.

---

## Kenney CC0 tilesets (legacy — pending US-98 removal)

The Tiny Town and Tiny Dungeon atlases originally carried Ashen Isle and Fog Marsh through the area-system / interaction / fog-marsh-dead-end / sprite-animation / tileset / world-legibility / fog-and-light / keeper-rescue / homecoming-light / scene-art-and-thoughts phases. They are kept on disk and registered in `src/maps/tilesets.ts` as degenerate Wang tilesets so `tools/editor/src/mapRenderer.ts` keeps rendering until US-97 rewrites it. US-98's re-author removes both directories along with their `TILESETS` entries.

### Tiny Town

- Source: Kenney.nl (CC0)
- Used in: Ashen Isle (decorations + props remain on this atlas through stage 2A)
- License: `tiny-town/License.txt`

### Tiny Dungeon

- Source: Kenney.nl (CC0)
- Used in: Fog Marsh (decorations + props remain on this atlas through stage 2A)
- License: `tiny-dungeon/License.txt`
