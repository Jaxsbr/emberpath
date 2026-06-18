# Emberpath — Art Style Guide

Extracted from `docs/ref/`. The dominant visual is **Joe Sutphin's *Little Pilgrim's Progress*** — graphite storybook illustration of small animal pilgrims — supported by a moody color rain piece, a golden-hour cover painting, and two soft fox concepts. The throughline is *fragile creature, vast world, gentle reverence, light as hope*.

## Pillars

1. **Hand-drawn, not "clean".** Lines look like graphite on cream paper — feathery, wandering, slightly imperfect.
2. **Sepia/grey is the default. Color is sacred.** Most frames live in warm monochrome; chroma arrives only for narrative beats (hope, danger, miracle).
3. **Small protagonist, big world.** Compose for fragility — high horizons, gnarled framing trees, distant Celestial-City silhouettes.
4. **Soft melancholy, never grimdark; gentle whimsy, never cute-coded.**

## Palette

See `art-style-palette.png` for swatches.

| Role | Hex | Use |
|---|---|---|
| Page cream (light) | `#F2EAD6` | Sky, paper, fog, bg fill |
| Page cream (mid) | `#E5D9BD` | Mid-paper |
| Sepia mid (light) | `#B89972` | Mid-tone fur, grass, stone |
| Sepia mid (dark) | `#8C7256` | Deeper fur/stone |
| Umber shadow (light) | `#5A4636` | Shadow body |
| Umber shadow (dark) | `#3A2C20` | Outlines, deep shadow |
| Ink near-black | `#1F1813` | Eyes, deepest crevices, silhouettes |
| **Hope-gold (light)** | `#F2C95B` | Celestial light, lanterns, raincoat |
| **Hope-gold (deep)** | `#E89C2A` | Glow core, ember |
| Mossy green | `#7A8A55` | Foliage accent |
| Slate blue | `#5A6B78` | Cool ambient, rain, night |
| Burnt sienna | `#A8543A` | Rare warmth, dawn, ember |

Rule: **a frame should read in sepia first, then color second**. If chroma is removed, the composition still has to work.

## Line & Texture

- **Outlines** in deep umber `#3A2C20`, never pure black. Vary line weight; let lines break and breathe.
- **Selective outlining** — exterior silhouettes lined, interior detail rendered with shading, not lines.
- **Dither for pencil hatching.** Use clustered/bayer dither in shadow ramps to mimic cross-hatching. Avoid smooth gradients; steppy ramps + dither is the texture.
- **Paper grain overlay** at low opacity over the final framebuffer — sells the storybook feel.

## Characters

- Small mammals + birds: rabbit, fox, owl, mouse, badger. Heroic-fragile posture: rounded shoulders, big head, oversized eyes with a single ink dot pupil + tiny highlight.
- Wardrobe: hooded cloaks, rough tunics, satchels, simple wooden staffs, modest tabards. **No shiny plate armor**, no glossy materials. Cloth dominates.
- Faces are kind and slightly weary. Eyes carry the story — get those right at small scale.
- **Suggested sprite size:** 48–64 px tall for heroes (≈3:2 head-to-body), 24–32 px tile world, 4 facing directions + idle/walk/talk/cast.

## Perspective — 3/4 oblique (top + exactly ONE front face)

emberpath is **3/4 oblique projection**: a ~45° downward camera that shows the **top
AND exactly one front face** of an object at once (the Pokémon/Stardew/Zelda look).
This is foundational — every asset and every placement obeys it. Two failure modes,
reject on sight:

- **Pure overhead / true top-down (zero sides) — WRONG.** A tree as a flat canopy
  "rosette", a stone as a flat blob. A correct object shows its top **plus** one near
  (front) face.
- **Isometric (two+ side faces / cube look) — WRONG.** A 3-sided rock; a house showing
  two walls. Multiple faces float against the 3/4 plane.
- **The test:** can I see the top and *exactly one* front face? Yes → correct. No front
  face, or more than one → reject and regenerate.
- **Buildings = a FRONT ELEVATION:** front-on, symmetric left-to-right, **one** flat
  front wall, gable roof as a **single front-facing slope, no diagonal ridge**. The
  recurring iso trap is the model rotating the building into a 3D dollhouse (a second
  side wall + a corner-to-corner ridge appear). Benchmark every building against
  `assets/objects/ashen-isle/cottage.png`.
- **Trees:** round canopy from above **with a small trunk stub** at the base (the stub
  *is* the front face — never omit it).
- One consistent light direction across all assets; no per-asset baked shadow implying a
  different camera.

Full reasoning, per-element rules, and PixelLab generation recipes (incl. the
conifer/pine trap and the building recipe) are in **`docs/art-topdown-guide.md`**.
The recurring-failure tests are enforced by the `emberpath-art-review` gate via
**`docs/solutions/`** — see [`art/3-4-oblique-not-iso`](solutions/art/3-4-oblique-not-iso.md).

## Clustering & composition — thicket with clearings, not a sprinkle

Reference scenes read as a **thicket with clearings**, never "one tree, gap, one tree"
on a lawn. Cohesion is the whole point.

- Plant trees in **groups of 2–4** (up to 3–7), touching/overlapping canopies, **mixed
  types**; pack **undergrowth densely around and between** (bush/shrub/grass/rock/stump).
- **Negative space is deliberate** — keep ~40–60% of ground clear in clearings (which
  double as the lit path / play space); don't fill every tile, don't sprinkle evenly.
- **Edges densest** (a treeline framing the map), thinning toward the walkable centre.
- Artificial things (paths, fences, planted rows) get **regular** spacing; nature gets
  **irregular** — the contrast reads as wilderness vs. civilisation.
- **Sense of place (Jaco #482):** a scene must feel lived-in, not a dev tutorial. A
  building implies context (a worn path to the door, a tended patch, nearby wilderness);
  a fence encloses *something* and connects — never a lone segment in open grass.

See [`solutions/art/cluster-not-scatter`](solutions/art/cluster-not-scatter.md) and
`docs/art-topdown-guide.md`.

## Environments

Recurring motifs from the spreads, all worth tilesetting:

- Thatched cottages, half-timbered walls, crooked chimneys, slate paths
- Gnarled overgrown trees forming archways and frames
- Wattle fences, marshy reeds, stepping stones, stiles
- Ruined castles, locked doors, wicked-prince courtyards
- Hilltop chapels / arbors with light shafts (the "Celestial City" vista)
- Rain, mist, distant glow, godrays through bare branches

Tile rendering: textured, not flat. Stone needs lichen, wood needs grain, grass needs scattered single-pixel weeds. Avoid clean repeats — break with foliage props.

## Lighting

- **One warm key** (lantern, window, sunbeam) + **cool grey ambient**. Chiaroscuro is the mood.
- Hope-gold is *radiant* — let it bloom slightly into surrounding pixels.
- Fog/rain particles always welcome; they unify the palette and add the watercolor-wash feel from the cat-in-rain piece.
- Vignette ~10–15% on edges to push the page-of-a-book read.

### Ground shadows (the canon)

emberpath is **3/4 oblique** with an **overhead key light**. Ground shadows obey
**two shapes** under the one light, split by object kind (Jaco's explicit art call,
#926):

- **Natural / movable objects — soft ellipse.** Player, NPCs, trees, props all get
  a soft dark ellipse (never a cast-away oval floating below the object), pooled
  **ON the visible ground-contact line** — a character's feet, a tree's trunk base.
  North half tucks under the sprite; a small sliver pokes **south** (down-screen).
  Height ≈ 0.4× width, footprint-scaled. Player + NPCs carry one at their feet that
  tracks them as they move. Pip/NPC pools are kept tight (small), per #926. This is
  the `makeGroundShadow` helper in `GameScene.ts`.
- **Buildings — rectangular front-floor band.** A house casts a clean **rectangular**
  shadow on the floor where its front wall meets the ground (top-down "shadow from
  above" straight down), footprint-relative (`baseFootprint`). This is the deliberate
  EXCEPTION to the ellipse — Jaco confirmed the rectangle is correct for buildings
  (#926: "the oval is wrong, you added it back??? see the rectangular one you had
  before.. it was correct"). Do **not** swap a building back to an ellipse.

Change each canon at its source in `GameScene.ts` (the building rectangle in the
object-shadow `bf` branch, the ellipse in `makeGroundShadow`), not per-object.

## Animation

- Slight weight, slow easing. Breathing idle, cloak/ear sway, blink every 3–5s.
- No squash-and-stretch slapstick. Movement is gentle and grounded.
- Particle vocabulary: rain streaks, dust motes, drifting embers, leaves, lantern flicker. Always sparse.

## What to avoid

- Pure-black outlines, neon saturation, hard cel-shaded blocks
- Anime big-sparkle eyes, chibi proportions
- Glossy/metallic JRPG armor, sci-fi UI chrome
- Clean vector-style tiles with no texture
- High-frequency 8-bit "crunch" — this is **painted pixel**, not NES pixel

## One-line brief

> *Anthropomorphic pilgrims in a graphite-and-sepia storybook world, where gold light is the only thing brave enough to be in color.*

## Reference anchors

- `ref/01_book_cover.jpg` — chroma palette + cover-mood composition
- `ref/02_spread_01.png` — environment isometry, village layout
- `ref/14_youtube_thumb.jpg` — character pairing, scale, line treatment
- `ref/00_banner_rain_cat.jpg` — color-as-narrative, watercolor wash, hope-gold accent
- `ref/10_lpp_cover_painting_full.jpg` — golden-hour distant-city silhouette
- `ref/05_spread_04.png`, `ref/08_spread_07.png` — atmospheric rain + cave/giant scenes
