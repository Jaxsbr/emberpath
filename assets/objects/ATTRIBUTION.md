# Object Attribution

PixelLab style-matched map objects (US-96). Generated 2026-04-30 via the personal `mcp__pixellab__create_map_object` server in style-matching mode — each object's `background_image` was a 32×32 area sample patch (frame '6' = mask '0000' / all-primary terrain) cropped from the corresponding US-95 PixelLab tileset:

- Ashen Isle objects use `/tmp/ashen-sample.png` (cropped from `assets/tilesets/ashen-isle-grass-sand/tilemap.png`)
- Fog Marsh objects use `/tmp/fog-marsh-sample.png` (cropped from `assets/tilesets/fog-marsh-floor-path/tilemap.png`)

The style-match constraint forces the object palette / outline weight / shading to read as belonging to the terrain — no isolation drift between AI pipelines.

## Common settings

- `view: "high top-down"`
- `outline: "selective outline"`
- `shading: "medium shading"`
- `detail: "medium detail"`
- `image_size: { width: 32, height: 32 }`
- `inpainting`: default oval 60% (PixelLab's auto-pick when `background_image` provided without explicit inpainting)

## Ashen Isle (10 kinds)

| kind | passable | description | object_id |
|---|---|---|---|
| wall-stone | false | weathered umber stone wall section, sepia, top-down storybook pixel art | `2258943d-81ba-403b-8703-0bd7202ef87c` |
| wall-front | false | weathered timber wall front of small storybook house, sepia, top-down | `941d0142-fe8c-49f8-b453-479e30d2fbfa` |
| wall-roof | false | sepia roof segment with shingles, top-down view | `82b1e54d-5542-49e4-b009-5686b38acf49` |
| door-wood | false | large wooden plank door filling most of the canvas, weathered umber sepia, top-down (reroll #2 — original prompt produced an empty result) | `a3dc8c20-648a-4e98-ba97-39e296154f1a` |
| fence-rail | false | horizontal wooden plank fence panel, sepia, top-down | `7b7d74b4-772c-4221-813e-549e7797ef66` |
| cliff-stone | false | weathered grey stone block, top-down storybook, sepia palette (reroll — original 500'd) | `a5885495-7ac7-4e84-9547-868f044d365d` |
| tree-pine | false | small pine tree with sepia-tinged needles, top-down storybook | `44e84c70-d1f2-40ee-b4b0-1382b9f1086c` |
| bush | true | small green-brown bush cluster, top-down storybook | `9b14b223-9261-4376-917f-f9e0baaaf31d` |
| flower | true | small pale flower clump, top-down, sepia, no hope-gold | `9ab77405-b995-4776-bfc4-ec4fa72bbe8b` |
| sign-wood | true | small wooden sign post, no text, top-down storybook | `37f166a9-fc66-4f58-842e-ebbaba8b633d` |

## Fog Marsh (8 kinds)

| kind | passable | description | object_id |
|---|---|---|---|
| wall-tomb | false | weathered umber stone tomb wall, top-down storybook | `c55b9bc2-8afe-4671-9b10-7d4b7d38e89a` |
| door-tomb | false | heavy stone slab door, weathered sepia, top-down (reroll — original 500'd) | `fbdf5a9c-9c11-49b1-a329-05821637f20e` |
| dead-tree | false | gnarled bare dead tree, sepia, top-down storybook | `23002717-4ee4-433a-b59f-3c0b6f95fe35` |
| gravestone | false | small upright stone marker, weathered, top-down (reroll — original 500'd) | `e166f4f2-9b33-45a3-a82e-c14bd57c4fe1` |
| marsh-stone | false | weathered marsh stone half-buried, top-down | `9d6418be-1db8-4002-bf05-22b05a218fef` |
| dry-reed | true | dry sepia marsh reeds clump, top-down | `33fb2c08-76ef-404b-a093-08d47bd65d0c` |
| mushroom | true | small marsh mushroom cluster, top-down | `47d4375a-fd93-4de3-ad95-d026c7ce91f9` |
| lantern-broken | true | small extinguished iron lantern, dim sepia, top-down (reroll — original 500'd) | `13ee3437-a890-4a8e-9ea1-5a6aa379f971` |

## Generation budget reconciliation

Spec budget: ≤ 1 reroll per object (≤ 36 generations max for 18 objects).

- First batch (18 fired, Tier 1 cap of 8 concurrent — 10 made it into queue, 8 hit rate-limit): **18 generations** (10 successful queue entries + 8 rate-limit retries).
- Second batch (8 rate-limit retries fired sequentially): **8 generations** (all queued OK).
- 5 of the first 18 generation jobs returned 500 from the download endpoint — re-fired with slightly tweaked descriptions.
- door-wood reroll produced a near-empty PNG (122 bytes); re-fired a second time with a stronger size cue.

**Total: 24 generations spent / 36 budget.** Within budget.
