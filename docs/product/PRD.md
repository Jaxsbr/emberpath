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
| fog-marsh-dead-end | Draft | US-66, US-67, US-68, US-69 | [phases/fog-marsh-dead-end.md](phases/fog-marsh-dead-end.md) |
| keeper-rescue | Planned | US-70, US-71, US-72, US-73 | [phases/keeper-rescue.md](phases/keeper-rescue.md) |

## Next up

**`fog-marsh-dead-end`** is the next phase. Today the Marsh Hermit's line "Through? There is no through. Only deeper" is flavour text — the player can freely walk south back to Ashen Isle. This phase makes the line true: a one-shot threshold trigger north of the hermit sets `marsh_trapped: true` (US-66), the south exit becomes inert via the existing `ExitDefinition.condition` plus a new collision flip on the exit cells (US-67), the exit's PATH decorations swap to EDGE deep-water frames via a new `DecorationDefinition.condition` field (US-68), and bumping the closed exit fires escalating thought bubbles ("the path is gone" → "I cannot do this alone") gated on a new `escape_attempts` flag counter (US-69). The Keeper does NOT appear here — Phase 1 ends at the felt-bottom of beat 2 with the rescue scaffolding in place. See [phases/fog-marsh-dead-end.md](phases/fog-marsh-dead-end.md) for the full spec.

**After `fog-marsh-dead-end` ships, `keeper-rescue` is captured and ready** — see [phases/keeper-rescue.md](phases/keeper-rescue.md). It introduces the Keeper NPC (PixelLab sprite + linear-filter portrait, US-70), spawns him on `marsh_trapped == true && escape_attempts >= 4` with a 0.5s alpha fade-in (US-71), grants the Ember Mark via a one-shot dialogue + `ember-given` story scene (US-72), and re-opens the south path while attaching a depth-5.5 ember overlay to Pip's sprite (US-73). The phase reuses Phase 1's conditional decorations and flag-change mechanism in reverse — minimal new mechanism, mostly content + asset work. Re-run `/sabs:spec-author` to refine done-when criteria after Phase 1 ships, in case the actual implementation introduces drift.

After `keeper-rescue`, the planned ordering is `wayfinding` → `audio-pass-1`.
