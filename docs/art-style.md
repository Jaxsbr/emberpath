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
