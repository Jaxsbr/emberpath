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
| tile-architecture | Shipped | US-92, US-93, US-94, US-95, US-96, US-97, US-98 | [phases/tile-architecture.md](phases/tile-architecture.md) |
| briar-wilds | Shipped | US-99, US-100, US-101, US-102, US-103 | [phases/briar-wilds.md](phases/briar-wilds.md) |

## Next up

**`briar-wilds`** is the next phase — Stage 4 of Pip's pilgrim journey, the **trials and hardship** beat. After homecoming-light's spiritual high, Pip leaves Ashen Isle eastward (a path the Ember has just opened) and walks into the Briar Wilds: thorny, twisted, mist-grey, oppressive but never cruel. The phase introduces one new state — **ember warmth** — which drains in *drain zones* (twisted false-hope patches that lure with sickly gold) and restores in *quiet places* (small clearings with a glowing sapling or quiet stone). The ember dims visibly but **never extinguishes** (hard floor at `WARMTH_FLOOR = 0.3`); doubt-voice thought bubbles fire while Pip is in drain zones; ambient narration on entering a quiet place. The trial is endured by walking through, not won by skill — there is no fail state, no respawn, no skill check. The phase also corrects a perception gap shipped in homecoming-light: warmed NPCs (Wren, Old Man) become *visibly* brighter (US-99 — `npcWarmedRadius` ≥ 1.5× baseline, `npcWarmedIntensity` ≥ 2× baseline) so Pip can look back from the trial road and see the bright pockets of grace already given. Closes with a soft forward-looking thought near the far edge of Briar Wilds turning Pip toward the Heart Bridge. Five stories (US-99 warmed-NPC polish; US-100 area + east-gated entry; US-101 warmth state; US-102 drain zones + doubt voices; US-103 quiet places + closing reflection). PixelLab budget: ~10–20 generations against the personal account (Learning EP-05). See [phases/briar-wilds.md](phases/briar-wilds.md) for the full spec.

After `briar-wilds`, the journey-stage roadmap continues with **`the-word`** — Stage 5, maturation through scripture. The full ladder continues `the-word` → `heart-bridge` → `bearing-fruit` → `citadel` → `polish-and-vibe`. See [docs/master-prd.md](../master-prd.md#implementation-roadmap) for design risks and v1 success criteria.
