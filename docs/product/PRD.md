# Emberpath — Product Requirements Document

> Product index. Vision and feature overview live here. Phase-level detail lives in `phases/`. See `docs/master-prd.md` for the full creative vision, story framework, and art pipeline.

## Vision

An allegorical journey game that shares the gospel with kids (and adults) through interactive storytelling. The player controls a character on a top-down world, explores locations, interacts with NPCs, and experiences story scenes that allegorically present the gospel message.

## Target Audience

- Primary: Kids aged 6-12
- Secondary: Adults who enjoy story-driven indie games
- Context: Something a parent, pastor, or children's ministry leader could share

## Core Mechanics

1. **Top-down exploration** — mobile-first touch controls (virtual joystick) + desktop fallback (WASD)
2. **NPC interaction** — walk up and talk, inline dialogue system with typewriter effect
3. **Story scenes** — full-screen illustrated cutscenes triggered by world interaction
4. **Area transitions** — walk to exits, fade between tile maps
5. **Progress system** — flag-based story progression in localStorage

## POC Scope

Beats 1 & 2 only:
- Area 1: Ashen Isle (exploration, NPC dialogue, story scene trigger)
- Area 2: Fog Marsh (dead-end mechanic, rescue story scene)
- Credits: "The Story Behind the Story" with resource links

## Technical Stack

Phaser 3 + TypeScript + Vite, systems-based entity architecture, mobile-first responsive scaling, GitHub Pages deployment, localStorage for progress.

## Implementation Phases

| Phase | Status | Stories | Spec |
|---|---|---|---|
| foundation | Shipped | US-01, US-02, US-03, US-04, US-05 | [phases/foundation.md](phases/foundation.md) |
| interaction | Shipped | US-06, US-07, US-08, US-09, US-10 | [phases/interaction.md](phases/interaction.md) |
| mobile-ux | Shipped | US-11, US-12, US-13 | [phases/mobile-ux.md](phases/mobile-ux.md) |
| area-system | Shipped | US-14, US-15, US-16, US-17, US-18 | [phases/area-system.md](phases/area-system.md) |
| story-visualizer | Shipped | US-19, US-20, US-21, US-22 | [phases/story-visualizer.md](phases/story-visualizer.md) |
| character-rig | Shipped | US-23, US-24, US-25, US-26, US-27 | [phases/character-rig.md](phases/character-rig.md) |
| rig-editor | Shipped | US-28, US-29, US-30, US-31 | [phases/rig-editor.md](phases/rig-editor.md) |
| bone-chain | Shipped | US-32, US-33, US-34, US-35 | [phases/bone-chain.md](phases/bone-chain.md) |
| editor-ux | Shipped | US-36, US-37, US-38 | [phases/editor-ux.md](phases/editor-ux.md) |
| rig-teardown | Shipped | US-39, US-40, US-41 | [phases/rig-teardown.md](phases/rig-teardown.md) |
| sprite-animation | Shipped | US-42, US-43, US-44, US-45 | [phases/sprite-animation.md](phases/sprite-animation.md) |
| sprite-refresh | Shipped | US-46, US-47 | [phases/sprite-refresh.md](phases/sprite-refresh.md) |
| tileset | Shipped | US-48, US-49, US-50, US-51 | [phases/tileset.md](phases/tileset.md) |
| npc-behavior | Shipped | US-52, US-53, US-54, US-55 | [phases/npc-behavior.md](phases/npc-behavior.md) |
| npc-portraits | Shipped | US-56, US-57 | [phases/npc-portraits.md](phases/npc-portraits.md) |
| world-legibility | Shipped | US-58, US-59, US-60, US-61 | [phases/world-legibility.md](phases/world-legibility.md) |
| save-resume | Shipped | US-62, US-63, US-64, US-65 | [phases/save-resume.md](phases/save-resume.md) |
| fog-marsh-dead-end | Shipped | US-66, US-67, US-68, US-69 | [phases/fog-marsh-dead-end.md](phases/fog-marsh-dead-end.md) |
| keeper-rescue | Shipped | US-70, US-71, US-72, US-73 | [phases/keeper-rescue.md](phases/keeper-rescue.md) |
| fog-and-light | Shipped | US-74, US-75, US-76, US-77, US-78, US-79, US-80, US-81 | [phases/fog-and-light.md](phases/fog-and-light.md) |
| homecoming-light | Shipped | US-82, US-83, US-84, US-85, US-86 | [phases/homecoming-light.md](phases/homecoming-light.md) |
| scene-art-and-thoughts | Shipped | US-87, US-88, US-89, US-90, US-91 | [phases/scene-art-and-thoughts.md](phases/scene-art-and-thoughts.md) |
| tile-architecture | Draft | US-92, US-93, US-94, US-95, US-96, US-97, US-98 | [phases/tile-architecture.md](phases/tile-architecture.md) |

## Next up

**`tile-architecture`** is the next phase — a foundation rebuild of the tile-rendering and collision model so every future area is built on a single coherent system: vertex-based Wang terrain (smooth blends between grass / sand / water / path), a sparse object layer that contributes to collision (trees, walls, gates, fences, lanterns), and PixelLab-generated content replacing the Kenney CC0 atlases for both Ashen Isle and Fog Marsh. The end state: one architecture, no `TileType` enum, no `area.map: TileType[][]`, terrain has a `passable` flag, objects have a `passable` flag, collision unifies both. The marsh-trap dead-end becomes a terrain-flip (path → water) the Wang resolver auto-blends. The phase exceeds the spec-author's 5-story rule by operator decision — splitting would reintroduce side-by-side state, and the visual baseline would degrade if shipped without the PixelLab content. Two stages with an in-engine review pause between them: stage 1 (US-92..US-94) ships the architecture with degenerate-Wang Kenney rendering visually identical to today; stage 2 (US-95..US-98) generates PixelLab Wang tilesets + style-matched objects, updates the editor, and re-authors both areas. One PR at the end of US-98. PixelLab budget: up to ~46 generations against ~1500 remaining on the Basic tier. See [phases/tile-architecture.md](phases/tile-architecture.md) for the full spec.

After `tile-architecture`, the journey-stage roadmap resumes with **`briar-wilds`** — the next named phase in the master roadmap. The full ladder continues `briar-wilds` → `the-word` → `heart-bridge` → `bearing-fruit` → `citadel` → `polish-and-vibe`. See [docs/master-prd.md](../master-prd.md#implementation-roadmap) for design risks and v1 success criteria.
