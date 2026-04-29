# Emberpath — Master PRD

> This document is the persistent product vision. Phase-level specs live in `docs/product/phases/`. This PRD is NOT overwritten by spec-author or build-loop — it is the source of truth for the overall product.

## Vision

An allegorical journey game that shares the gospel with kids (and adults) through interactive storytelling. The player controls a character on a top-down world, explores locations, interacts with NPCs, and experiences story scenes that allegorically present the gospel message. Jesus is never named directly — imagery and allegory do the work. End credits reveal the real meaning and link to Christian resources.

Inspired by "Little Pilgrim's Progress" by Helen L. Taylor (an adaptation of Bunyan's Pilgrim's Progress for children), but with an original story, characters, and world to avoid copyright issues. The arc deliberately models Christian's *full* journey — not just conversion, but the spiritual high that follows, the trials that test faith, maturation through the Word, fruit-bearing, and glorification — so the player feels what the Christian life is, not only how it begins.

## Target Audience

- Primary: Kids aged 6-12
- Secondary: Adults who enjoy story-driven indie games
- Context: Something a parent, pastor, or children's ministry leader could share

## Core Mechanics

These are the always-on engine primitives. Journey-stage mechanics (ember sharing, ember warmth state, the Word, second-stage NPC transformations) are introduced phase-by-phase under Story Framework below.

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

**Pilgrim's journey — modeled in stages:**

The original POC framed the gospel as a four-beat arc (Fading → Fog Marsh → Heart Bridge → Citadel). That captures conversion well, but Christian's journey in Pilgrim's Progress — and the lived Christian life — continues *through* trial, maturation, fruit-bearing, and glorification. The full arc, with the mechanic introduced at each stage:

1. **The Fading — empty life, awareness of need (Ashen Isle).** Home is dying; an ancient tapestry shows what was lost. Pip becomes aware she cannot stay. *Mechanics: exploration, NPC dialogue, story-scene triggers.*
2. **The Fog Marsh — grace (Fog Marsh).** The player mechanically cannot escape alone. The Keeper appears and grants the Ember Mark. *Mechanics: dead-end trap, conditional NPC spawn, ember-mark grant.*
3. **Spiritual high — first witness (Ashen Isle, post-rescue).** Pip returns home with the Ember and shares warmth with NPCs. *Mechanic: ember sharing — extend warmth to NPCs by proximity action. NPCs respond differently — warmed, wary, refusing. Restoration is permanent and visible. Shared with people only, never inanimate objects (gospel alignment).*
4. **Trials and hardship (Briar Wilds, new area).** Pip leaves Ashen Isle north toward the bridge. *Mechanic: ember warmth state — drain zones, doubt voices, false-light decoys dim Pip's ember. Quiet places restore it. The ember dims but never extinguishes; the trial is endured by walking through, not won by skill.*
5. **Maturation through the Word (Briar Wilds + retroactive).** Pip receives a scripture-keeping artifact. *Mechanic: the Word — stabilises the ember in drain zones; inscribed stones across all areas become readable; new verb "remember." The artifact must feel received as gift, not picked up as a powerup.*
6. **The Heart Bridge — atonement (new area, Beat 3).** Pip walks across the scarred stone where the High King took the Fading into himself. *Mechanic: paced-walk-with-overlay; the Fading is drawn out of Pip into the bridge. Permanent state change — trials no longer drain. Intentionally low interactivity: this beat is received, not performed.*
7. **Bearing fruit (return-pass through Ashen Isle + Briar Wilds).** Previously-warmed NPCs now show second-stage transformations — a meal shared, a song, a planted seed. Wary NPCs become approachable because Pip has been through trial. *Mechanic: second-stage NPC state on revisit — same maps, deeper state, no new map work.*
8. **The Citadel — glorification (new area, Beat 4).** Final approach. *Mechanic: the King speaks Pip's name; light spreads back across the world via an animated wave. Closing beat.*

**Allegory mapping:**
- The Fading = sin / separation from God
- High King (golden stag) = Jesus Christ
- The Keeper (white heron) = the Holy Spirit
- Fog Marsh dead-end = inability to save oneself
- Ember Mark = salvation, the indwelling Spirit
- Ember sharing = witnessing
- Briar Wilds = trials, doubt, persecution
- Drain zones / doubt voices = spiritual attack
- Quiet places = prayer
- The Word (lantern / inscribed stone) = the Bible
- Heart Bridge = the cross
- Second-stage NPC transformations = fruits of the Spirit, sanctification
- The Citadel = the Kingdom, heaven
- The King speaking Pip's name = glorification, the new name (Revelation 2:17)
- Light spreading = the Great Commission, the Kingdom restored

## Technical Stack

- Phaser 3 + TypeScript + Vite
- Systems-based entity architecture (same pattern as toy-box-siege)
- Mobile-first responsive scaling (Phaser Scale Manager FIT mode)
- GitHub Pages deployment
- localStorage for progress

## Implementation Roadmap

The POC (Beats 1 & 2) is shipped — Pip's awareness of the Fading, the Fog Marsh dead-end, the Keeper rescue, and the Ember Mark grant are all in. The remaining roadmap takes Pip through the rest of the Christian's journey, ending in a polish phase.

| Phase | Stage | New mechanic | New area |
|---|---|---|---|
| `homecoming-light` | Spiritual high, first witness | Ember sharing with NPCs | — |
| `briar-wilds` | Trials and hardship | Ember warmth state, drain zones, doubt voices, quiet places | Briar Wilds |
| `the-word` | Maturation through scripture | Scripture artifact, *remember* verb, inscribed stones readable | — (extends Briar Wilds + retroactive) |
| `heart-bridge` | Atonement (Beat 3) | Atonement state change — trials no longer drain | Heart Bridge |
| `bearing-fruit` | Fruits of the Spirit | Second-stage NPC transformations on revisit | — (Ashen Isle + Briar Wilds revisit) |
| `citadel` | Glorification (Beat 4) | The King speaks Pip's name, light spreads | Citadel |
| `polish-and-vibe` | Per-NPC unique encounter passes, audio, "Story Behind the Story" credits, transition pacing | — | — |

Each phase introduces exactly one new verb or one new state that compounds with what came before. New areas are mechanic containers, not aesthetic indulgence — each earns its keep with a new mechanic. `bearing-fruit` deliberately reuses existing maps with new state, which gives a perceived-content boost without new map-design work.

Phase ordering is the recommended path; individual phases are sized for a single build-loop run. Compression options exist (e.g. fold `the-word` into `briar-wilds`, or `bearing-fruit` into `citadel`) but are not preferred — they erode the time the journey needs to feel earned.

## Design Risks

Named risks across the remaining roadmap, with the design intent for each.

### Ember dimming for a 6–12 audience
The trials phase is the first mechanic in the game where the player can lose something. Risk: a dimming ember reads as a skill-check fail and frustrates a young player. Intent: the ember dims but **never extinguishes** — drain zones produce *narrative* friction (Pip's thoughts get heavier, the screen desaturates further), not a fail state. The trial is endured by walking through, not won by twitch reflex.

### Scripture must feel received, not earned
The Word artifact risks reading as a videogame powerup ("pick up the lantern, gain a buff"). Intent: the artifact arrives via a discovery moment that *feels* like receiving — probably a return visit from the Keeper, or a second NPC functioning as a teacher. Budget an extra story for the framing scene; do not treat the artifact as a pickup.

### Heart Bridge low interactivity is intentional
The cross beat is the most *received* moment in the game. Some designers will reach for interactivity here ("the player must do something to cross"). Intent: this beat is paced-walk-with-overlay. The player receives the atonement; they do not perform it. If interactivity is added later, the verb must be costly-feeling (e.g. setting down the ember on the stone) — never a skill check.

### Length commitment
Six phases beyond `keeper-rescue` is a meaningful build commitment. The roadmap is not a contract — phases can be paused, reshuffled, or cut. The hard rule: if a phase is cut, the journey stage it represents must still be readable in the remaining content (e.g. cutting `bearing-fruit` is acceptable only if `citadel` shows fruit some other way).

## Gospel Integration Principles

1. **Show, don't preach** — allegory works as game story first
2. **Mechanical truth** — the Fog Marsh dead-end makes grace *felt*, not told; the same principle drives every later phase (trials are walked through, scripture stabilises, the bridge is received)
3. **No villains** — Driftwood (worldly wisdom) is charming, not evil; doubt voices in Briar Wilds are uneasy, not malicious
4. **Action over explanation** — The Keeper rescues, explanations come later
5. **Free gift** — the Ember Mark is given, not earned; the Word is received, not won
6. **Reveal at the end** — "The Story Behind the Story" in credits connects allegory to gospel
7. **Resource links** — Jesus Film Project, YouVersion Bible App for Kids, encouragement to talk to a trusted adult
8. **Restoration targets persons, not objects** — Pip never shares the Ember with inanimate things. Decorative changes (paths blooming, hearths lighting) follow as *consequences* of restoring a person nearby. God's restoration is for persons.

## Success Criteria

### POC (Beats 1 & 2 — shipped)
1. Character walks on mobile with virtual joystick — feels responsive
2. Tapping an NPC triggers a dialogue sequence with typewriter text
3. At least one story scene displays a full-screen illustration with dialogue overlay
4. Area transition works (Ashen Isle → Fog Marsh)
5. Fog Marsh dead-end mechanic creates genuine "I can't escape" feeling before rescue
6. At least one AI-generated sprite sheet renders in-engine
7. Progress persists across browser refresh, reset works from title
8. Deployed and playable on GitHub Pages

### v1 (full journey)
1. Pip's Ember Mark has at least one mechanical consequence beyond a visible disc — the player *uses* it
2. The trials arc creates genuine "this is hard" tension without producing a fail state
3. The Word artifact is received in a moment that reads as gift, not pickup
4. The Heart Bridge scene is the emotional climax of the experience — not the longest, but the most felt
5. At least one NPC visibly bears fruit on revisit after the bridge
6. The Citadel ending names Pip and the world's color visibly returns
7. A child playing for the first time can complete the journey in 15–30 minutes without external guidance
8. "The Story Behind the Story" credits connect the allegory to the gospel and link to Christian resources
