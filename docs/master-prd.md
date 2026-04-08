# Emberpath — Master PRD

> This document is the persistent product vision. Phase-level specs live in `docs/product/phases/`. This PRD is NOT overwritten by spec-author or build-loop — it is the source of truth for the overall product.

## Vision

An allegorical journey game that shares the gospel with kids (and adults) through interactive storytelling. The player controls a character on a top-down world, explores locations, interacts with NPCs, and experiences story scenes that allegorically present the gospel message. Jesus is never named directly — imagery and allegory do the work. End credits reveal the real meaning and link to Christian resources.

Inspired by "Little Pilgrim's Progress" by Helen L. Taylor (an adaptation of Bunyan's Pilgrim's Progress for children), but with an original story, characters, and world to avoid copyright issues.

## Target Audience

- Primary: Kids aged 6-12
- Secondary: Adults who enjoy story-driven indie games
- Context: Something a parent, pastor, or children's ministry leader could share

## Core Mechanics

### 1. Top-down Exploration
- Mobile-first touch controls (virtual joystick + tap interaction)
- Desktop fallback (WASD + Space)
- Tile-based world with collision
- Camera follows player

### 2. NPC Interaction
- Walk up to an NPC, tap/press action to talk
- Inline dialogue system (text box, portrait, typewriter effect, tap to advance)
- Some NPCs trigger full story scenes

### 3. Story Scenes
- Full-screen illustrated cutscenes
- Dialogue overlay with character portraits
- Triggered by world interaction or area events
- Can include subtle animation (from Flow-generated frames)

### 4. Area Transitions
- Walk to an exit to transition to next area
- Fade transition between areas
- Each area is a different tile map with its own NPCs and interactions

### 5. Progress System
- Flag-based story progression (localStorage)
- Tracks: which conversations happened, which areas visited, which story beats completed
- Resettable from title screen
- Current area and position saved

## Art Pipeline

AI-generated storybook art:
1. **Midjourney** — generate character poses, environment tiles, story illustrations in watercolor storybook style
2. **Google Flow** — animate character poses (walk cycles) and story illustrations (subtle ambient animation)
3. **Frame extraction** — ffmpeg to extract frames from Flow clips
4. **Sprite sheets** — compose frames into horizontal sprite sheets for Phaser

Style: watercolor storybook illustration, children's book art, soft painterly texture, warm muted palette.

## Audio Pipeline (future)

- Suno AI for background music and ambient sound
- Procedural sound effects as fallback (Web Audio API, same as toy-box-siege)

## Story Framework: The Ember Isles

> Creative direction — develops iteratively. See plan file for full details.

**World:** Chain of islands shrouded in "the Fading" (grey mist draining color/warmth/life). The High King's Citadel glows on the farthest island.

**Protagonist:** Pip, a fox kit from Ashen Isle (the outermost, most faded island).

**Gospel arc in four beats:**
1. The Fading (sin/separation) — home is dying, an ancient tapestry shows what was lost
2. The Fog Marsh (grace) — player mechanically cannot escape alone, rescued by The Keeper
3. The Heart Bridge (redemption) — a scarred stone where the High King took the Fading into himself
4. The Citadel (new life) — restoration, the King speaks Pip's name, light spreads back

**Allegory mapping:**
- The Fading = sin/separation from God
- High King (golden stag) = Jesus Christ
- The Keeper (white heron) = The Holy Spirit
- Fog Marsh dead-end = inability to save oneself
- Ember Mark = salvation
- Heart Bridge = the cross
- The Citadel = heaven/the Kingdom
- Light spreading = the Great Commission

## Technical Stack

- Phaser 3 + TypeScript + Vite
- Systems-based entity architecture (same pattern as toy-box-siege)
- Mobile-first responsive scaling (Phaser Scale Manager FIT mode)
- GitHub Pages deployment
- localStorage for progress

## POC Scope

Beats 1 & 2 only:
- Area 1: Ashen Isle (exploration, NPC dialogue, story scene trigger)
- Area 2: Fog Marsh (dead-end mechanic, rescue story scene)
- Credits: "The Story Behind the Story" with resource links

## Gospel Integration Principles

1. **Show, don't preach** — allegory works as game story first
2. **Mechanical truth** — the Fog Marsh dead-end makes grace felt, not told
3. **No villains** — Driftwood (worldly wisdom) is charming, not evil
4. **Action over explanation** — The Keeper rescues, explanations come later
5. **Free gift** — the ember mark is given, not earned
6. **Reveal at the end** — "The Story Behind the Story" in credits connects allegory to gospel
7. **Resource links** — Jesus Film Project, YouVersion Bible App for Kids, encouragement to talk to a trusted adult

## Success Criteria (POC)

1. Character walks on mobile with virtual joystick — feels responsive
2. Tapping an NPC triggers a dialogue sequence with typewriter text
3. At least one story scene displays a full-screen illustration with dialogue overlay
4. Area transition works (Ashen Isle → Fog Marsh)
5. Fog Marsh dead-end mechanic creates genuine "I can't escape" feeling before rescue
6. At least one AI-generated sprite sheet renders in-engine
7. Progress persists across browser refresh, reset works from title
8. Deployed and playable on GitHub Pages
