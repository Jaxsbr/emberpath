# Phase: interaction

Status: shipped

## Design direction

Purely functional placeholders. Simple colored rectangles for dialogue boxes, plain text for all content, no rounded corners or styling. Architecture prioritizes clean separation so future art passes can animate and beautify each component independently without touching game logic.

## HUD layout

```
+--------------------------------------------------+
|                                                    |
|         [thought bubble - near player,             |
|          floating above, auto-dismiss]             |
|                                                    |
|     [interaction prompt - below player,            |
|      small text, "Space to talk"]                  |
|                                                    |
+--------------------------------------------------+
| [speaker name]                                     |
| +------------------------------------------------+ |
| | Dialogue text box — full width, ~120px tall    | |
| | [choice 1]  [choice 2]  [choice 3]            | |
| +------------------------------------------------+ |
+--------------------------------------------------+
```

- Dialogue box: bottom of screen, full width, depth 200
- Speaker name: above dialogue box, depth 200
- Choice buttons: inside dialogue box area, depth 200
- Thought bubble: near player, camera-relative, depth 150
- Interaction prompt: below player, camera-relative, depth 150
- Story scene: separate Phaser scene (no layout conflict)
- Dialogue box and thought bubbles never display simultaneously — triggers queue thoughts while dialogue is active

## Stories

### US-06 — NPC entities on the world map

As a player, I want to see characters in the world and interact with them by walking up and pressing action, so that I can engage with the story.

**Acceptance criteria:**
- NPCs are defined in data (position, name, visual placeholder color)
- NPCs render on the tile map at the entities depth layer
- NPCs have collision (player can't walk through them)
- Walking near an NPC shows an interaction prompt
- Space (desktop) or tap (mobile) while near an NPC starts interaction
- Prompt disappears when player moves away
- At least one test NPC is placed on the Ashen Isle map

**User guidance:** N/A — internal system, visible through test NPC placement

**Design rationale:** NPCs are data-driven objects rendered in GameScene. Interaction uses proximity detection + action input rather than click-on-sprite, because the virtual joystick already occupies touch input — a separate "interact" zone near the NPC avoids input conflicts.

### US-07 — Dialogue engine with branching choices

As a player, I want to have conversations with NPCs featuring typewriter text and dialogue choices, so that I can influence conversations and feel engaged with the story.

**Acceptance criteria:**
- Dialogue displays in a text box overlay at the bottom of the screen
- Text appears with typewriter effect (character by character)
- Tapping/pressing advances to next line or completes typewriter if mid-animation
- Speaker name displayed above dialogue text
- Player choice mode: 2-4 options displayed, selectable by tap/click or keyboard
- Choices branch to different dialogue nodes
- Dialogue scripts are data-driven (typed node graphs in data files)
- Dialogue ends cleanly, returning control to the game
- Player movement and other interactions are disabled during dialogue
- Zone-level mutual exclusion: NPC interaction and trigger evaluation suppressed while dialogue is active

**User guidance:** N/A — internal system, experienced through NPC interaction

**Design rationale:** Bottom-screen text box is the standard for top-down RPGs and works on mobile. Typewriter effect + tap-to-advance is the simplest effective dialogue UX. Branching uses a node graph in data — each node has text + optional choices that point to other node IDs. Zone-level suppression (not handler guards) prevents input conflicts per LEARNINGS #56.

### US-08 — Story scene mode

As a player, I want to experience full-screen story scenes with images and text, so that key narrative moments feel impactful and cinematic.

**Acceptance criteria:**
- Story scene overlays or replaces the game view (separate Phaser scene)
- Displays a placeholder image area + text panel
- Text advances on tap/Space, image area can change per beat
- Scene fades in and out
- Story scenes are data-driven (scene definitions reference image keys + text sequences)
- At least one test story scene can be triggered
- Scene returns control to GameScene on completion with player position preserved
- GameScene update loop is fully paused while story scene is active

**User guidance:** N/A — internal system, experienced through triggers/NPC interaction

**Design rationale:** Separate Phaser scene (not a GameScene overlay) for story mode, because full-screen scenes need their own lifecycle — camera, input, and rendering are completely different from the game world. Data-driven scene definitions enable content authoring without code changes. GameScene pauses entirely during story scenes per LEARNINGS #56.

### US-09 — Thought bubble system

As a player, I want to see my character's internal thoughts appear as floating text when I enter certain areas, so that I feel immersed and get subtle guidance.

**Acceptance criteria:**
- Thought text appears as a small floating bubble near the player
- Bubble has a simple background rectangle for readability
- Bubble auto-dismisses after a configurable duration
- Thoughts don't block player movement or input
- Multiple thoughts queue sequentially (not overlapping)
- Thoughts queue if dialogue is active, display after dialogue closes
- Thought content is data-driven
- At least one test thought triggers when entering a specific map zone

**User guidance:** N/A — internal system, experienced through world exploration

**Design rationale:** Thoughts are lightweight UI overlays on the game world, not full dialogue scenes. They use the UI depth layer (150) and are positioned relative to the player with scrollFactor(0). Auto-dismiss keeps them non-intrusive. Queue prevents overlap when walking through multiple trigger zones quickly. Dialogue takes priority per the HUD layout mutual exclusion rule.

### US-10 — World trigger system with conditional flags

As a game designer, I want to define trigger zones on the map with conditions, so that dialogue, thoughts, and story scenes fire at the right narrative moments.

**Acceptance criteria:**
- Trigger zones are defined in data (position, size, type, condition, action reference)
- Triggers fire when the player enters the zone
- Triggers can invoke: dialogue (US-07), story scene (US-08), or thought (US-09)
- Conditions support flag checks (e.g., "bridge_crossed >= 3 AND spoke_to_old_man == true")
- Flags can be set by dialogue choices, trigger actions, or NPC interactions
- Flags persist to localStorage
- One-shot triggers (fire once) and repeatable triggers (fire every entry) supported
- Repeatable triggers require exit-then-re-enter (not continuous fire while standing inside)
- At least one conditional trigger is configured as a test
- Flags can be reset from title screen

**User guidance:** N/A — internal system, data authoring for content creators

**Design rationale:** Flag-based conditions rather than a scripting language — keeps the trigger system simple and data-driven. localStorage persistence reuses the browser storage approach from the master PRD. The flag store is a standalone module so the full progress system (save position, current area) can wrap it later without refactoring.

## Done-when (observable)

**US-06 — NPC entities**
- [ ] `src/data/npcs.ts` exports an array of NPC definitions each with `id`, `name`, `col`, `row`, and `color` fields [US-06]
- [ ] NPC rectangles render on the tile map at depth 5 (entities layer per depth map) [US-06]
- [ ] Player cannot walk through NPC bounding boxes — collision system rejects movement into NPC bounds [US-06]
- [ ] Interaction prompt text ("Space to talk" / "Tap to talk") appears when player center is within 1.5 tiles of an NPC center [US-06]
- [ ] Space key (desktop) or tap (mobile) while in range and prompt visible invokes the NPC's interaction callback [US-06]
- [ ] Interaction prompt disappears when the player moves out of the 1.5-tile range [US-06]
- [ ] At least one test NPC is placed on the Ashen Isle map and responds to interaction by launching dialogue [US-06]

**US-07 — Dialogue engine**
- [ ] Dialogue text box renders at bottom of screen at depth 200 (UI layer) with `scrollFactor(0)` [US-07]
- [ ] Text appears character-by-character (typewriter effect) at a configurable characters-per-second rate [US-07]
- [ ] Tap/Space while typewriter is running completes the current line instantly [US-07]
- [ ] Tap/Space after line is complete advances to the next dialogue node [US-07]
- [ ] Speaker name is displayed above the dialogue text area [US-07]
- [ ] When a dialogue node has `choices`, 2-4 option buttons render and are selectable by tap/click or arrow keys + Enter [US-07]
- [ ] Selecting a choice navigates to the referenced `nextId` node in the dialogue graph [US-07]
- [ ] Dialogue scripts are defined in `src/data/dialogues.ts` as typed node graphs — not hardcoded in scene or system code [US-07]
- [ ] Reaching an end node (no `nextId`, no `choices`) closes the dialogue and returns input control to GameScene [US-07]
- [ ] Player movement is disabled while dialogue is active [US-07]
- [ ] NPC interaction zones and world trigger evaluation are suppressed while dialogue is active — no new interactions can fire until dialogue closes (LEARNINGS #56 — zone-level mutual exclusion) [US-07]
- [ ] After dialogue ends and the player walks away then returns to NPC range, the interaction prompt reappears and the NPC is re-interactable (LEARNINGS #49 — user journey completeness) [US-07]
- [ ] A test branching dialogue with at least 2 choice points and 3 leaf paths is playable via the test NPC [US-07]

**US-08 — Story scene mode**
- [ ] `StoryScene` is a separate Phaser scene registered in the game config (`main.ts` scene array) [US-08]
- [ ] Story scene displays a placeholder rectangle for the image area (upper portion) and a text panel (lower portion) [US-08]
- [ ] Each story beat specifies a `text` string and an optional `imageKey` — the image area changes color/label per beat as a placeholder [US-08]
- [ ] Tap/Space advances to the next beat [US-08]
- [ ] Scene fades in on launch (`cameras.main.fadeIn`) and fades out on completion (`cameras.main.fadeOut`) [US-08]
- [ ] Story scene definitions are data-driven in `src/data/story-scenes.ts` (array of beats per scene ID) [US-08]
- [ ] At least one test story scene with 3+ beats is triggerable and plays through to completion [US-08]
- [ ] On completion, `StoryScene` stops itself and resumes `GameScene` with player position preserved [US-08]
- [ ] While `StoryScene` is active, `GameScene` update loop is paused — no player movement, no trigger evaluation, no NPC interaction (LEARNINGS #56 — zone-level mutual exclusion) [US-08]

**US-09 — Thought bubble system**
- [ ] Thought text renders as a floating text element near the player at depth 150 with `scrollFactor(0)` [US-09]
- [ ] Thought bubble has a simple background rectangle behind the text for readability [US-09]
- [ ] Thought auto-dismisses after a configurable duration (default 3000ms) [US-09]
- [ ] Player movement and input are not blocked while a thought is displayed [US-09]
- [ ] When multiple thoughts are queued, they display sequentially — the next thought appears after the current one dismisses [US-09]
- [ ] Thought content and trigger associations are defined in data files, not hardcoded [US-09]
- [ ] If dialogue (US-07) is active, incoming thoughts queue until dialogue closes [US-09]
- [ ] At least one test thought triggers when the player enters a defined map area [US-09]

**US-10 — World trigger system**
- [ ] Trigger zones are defined in `src/data/triggers.ts` with `id`, position (`col`, `row`), `size` (width/height in tiles), `type` (dialogue | story | thought), `actionRef` (ID referencing the target content), `condition` (optional), and `repeatable` (boolean) [US-10]
- [ ] Trigger fires when player bounding box overlaps the zone bounds [US-10]
- [ ] Triggers invoke the correct system based on type: dialogue engine (US-07), story scene (US-08), or thought bubble (US-09) [US-10]
- [ ] Conditions support flag comparisons: `flag == value`, `flag >= value`, `flag == true`, combined with AND logic [US-10]
- [ ] `src/triggers/flags.ts` exports `getFlag`, `setFlag`, `incrementFlag` functions operating on an in-memory store [US-10]
- [ ] Flags persist to localStorage under a namespaced key and survive page refresh [US-10]
- [ ] One-shot triggers (default) track their fired state via a flag and do not re-fire on subsequent zone entries; repeatable triggers fire on every zone entry after the player exits and re-enters (not continuously while standing inside) [US-10]
- [ ] Dialogue choice actions and NPC interaction events can set flags (e.g., a dialogue choice sets `spoke_to_old_man = true`) [US-10]
- [ ] At least one conditional trigger is configured as a test: zone only fires after a specific flag is set via prior interaction [US-10]
- [ ] Flag reset is available from TitleScene (clears all flags from localStorage) [US-10]

**Structural**
- [ ] `npx tsc --noEmit && npm run build` passes with zero errors [phase]
- [ ] AGENTS.md reflects new modules (`entities/`, `dialogue/`, `triggers/`, `data/`), file ownership, and updated depth map entries introduced in this phase [phase]

## Golden principles (phase-relevant)
- Systems-based entity architecture — new capabilities are systems/modules, not inlined in scene code
- Depth map compliance — new visual layers must use defined depths (entities=5, UI=100+); new entries: thoughts=150, dialogue=200
- Scene flow — TitleScene -> GameScene; StoryScene is a parallel scene launched/stopped by GameScene
- Input priority — keyboard takes priority over joystick; dialogue/story scenes capture all input while active
- Zone-level mutual exclusion — overlapping interactive layers disable underlying zones, not just guard handlers (LEARNINGS #56)

## AGENTS.md sections affected
- File ownership map (new modules: entities/, dialogue/, triggers/, data/)
- Directory layout (new directories under src/)
- Depth map (new depth entries: thoughts=150, dialogue=200)
- Behavior rules (dialogue input capture, trigger zone evaluation, flag persistence, zone mutual exclusion)
- Scene flow (StoryScene addition)
