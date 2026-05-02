# US-96 Objects — In-Flight Generation Tracking

PixelLab Tier 1 = max 8 concurrent jobs. First batch of 18 hit the limit; 10 succeeded into the queue, 8 failed with rate-limit error and need re-fire.

## Active jobs (10 in queue)

| kind | area | object_id |
|---|---|---|
| wall-stone | ashen-isle | `2258943d-81ba-403b-8703-0bd7202ef87c` |
| wall-front | ashen-isle | `941d0142-fe8c-49f8-b453-479e30d2fbfa` |
| wall-roof | ashen-isle | `82b1e54d-5542-49e4-b009-5686b38acf49` |
| door-wood | ashen-isle | `ccbf6207-fc6c-4636-8620-522d9a424413` |
| cliff-stone | ashen-isle | `8fc860ad-4972-4726-9a6b-62030adebd3f` |
| bush | ashen-isle | `9b14b223-9261-4376-917f-f9e0baaaf31d` |
| flower | ashen-isle | `9ab77405-b995-4776-bfc4-ec4fa72bbe8b` |
| wall-tomb | fog-marsh | `c55b9bc2-8afe-4671-9b10-7d4b7d38e89a` |
| marsh-stone | fog-marsh | `9d6418be-1db8-4002-bf05-22b05a218fef` |
| dead-tree | fog-marsh | `23002717-4ee4-433a-b59f-3c0b6f95fe35` |

## To fire (8 remaining — rate-limited)

| kind | area | description |
|---|---|---|
| tree-pine | ashen-isle | small pine tree with sepia-tinged needles, top-down storybook |
| fence-rail | ashen-isle | horizontal wooden plank fence panel, sepia, top-down |
| sign-wood | ashen-isle | small wooden sign post, no text, top-down storybook |
| dry-reed | fog-marsh | dry sepia marsh reeds clump, top-down |
| mushroom | fog-marsh | small marsh mushroom cluster, top-down |
| door-tomb | fog-marsh | heavy stone tomb door with iron strap, top-down |
| gravestone | fog-marsh | small umber gravestone, weathered, top-down |
| lantern-broken | fog-marsh | broken extinguished iron lantern, unlit, top-down storybook |

## Sample backgrounds

- Ashen Isle: `/tmp/ashen-sample.png` (32×32, frame '6' from ashen-isle-grass-sand atlas)
- Fog Marsh: `/tmp/fog-marsh-sample.png` (32×32, frame '6' from fog-marsh-floor-path atlas)

## Settings (all calls)

- `view: "high top-down"`
- `outline: "selective outline"`
- `shading: "medium shading"`
- `detail: "medium detail"`
- `image_size: { width: 32, height: 32 }`
- `background_image: { base64: ... }` (style-matching mode)
