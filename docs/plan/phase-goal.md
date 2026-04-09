## Phase goal

Interaction phase — build the core interaction systems: NPC entities on the world map, a dialogue engine with branching choices and typewriter effect, full-screen story scenes, floating thought bubbles, and a world trigger system with conditional flags. All using functional placeholders (colored rectangles, plain text). Architecture prioritizes clean separation so future art passes can animate and beautify each component independently without touching game logic.

### Dependencies
- foundation

### Stories in scope
- US-06 — NPC entities on the world map
- US-07 — Dialogue engine with branching choices
- US-08 — Story scene mode
- US-09 — Thought bubble system
- US-10 — World trigger system with conditional flags

### Done-when (observable)

**US-06 — NPC entities**
- [x] `src/data/npcs.ts` exports an array of NPC definitions each with `id`, `name`, `col`, `row`, and `color` fields [US-06]
- [x] NPC rectangles render on the tile map at depth 5 (entities layer per depth map) [US-06]
- [x] Player cannot walk through NPC bounding boxes — collision system rejects movement into NPC bounds [US-06]
- [x] Interaction prompt text ("Space to talk" / "Tap to talk") appears when player center is within 1.5 tiles of an NPC center [US-06]
- [x] Space key (desktop) or tap (mobile) while in range and prompt visible invokes the NPC's interaction callback [US-06]
- [x] Interaction prompt disappears when the player moves out of the 1.5-tile range [US-06]
- [x] At least one test NPC is placed on the Ashen Isle map and responds to interaction by launching dialogue [US-06]

**US-07 — Dialogue engine**
- [x] Dialogue text box renders at bottom of screen at depth 200 (UI layer) with `scrollFactor(0)` [US-07]
- [x] Text appears character-by-character (typewriter effect) at a configurable characters-per-second rate [US-07]
- [x] Tap/Space while typewriter is running completes the current line instantly [US-07]
- [x] Tap/Space after line is complete advances to the next dialogue node [US-07]
- [x] Speaker name is displayed above the dialogue text area [US-07]
- [x] When a dialogue node has `choices`, 2-4 option buttons render and are selectable by tap/click or arrow keys + Enter [US-07]
- [x] Selecting a choice navigates to the referenced `nextId` node in the dialogue graph [US-07]
- [x] Dialogue scripts are defined in `src/data/dialogues.ts` as typed node graphs — not hardcoded in scene or system code [US-07]
- [x] Reaching an end node (no `nextId`, no `choices`) closes the dialogue and returns input control to GameScene [US-07]
- [x] Player movement is disabled while dialogue is active [US-07]
- [x] NPC interaction zones and world trigger evaluation are suppressed while dialogue is active — no new interactions can fire until dialogue closes (LEARNINGS #56 — zone-level mutual exclusion) [US-07]
- [x] After dialogue ends and the player walks away then returns to NPC range, the interaction prompt reappears and the NPC is re-interactable (LEARNINGS #49 — user journey completeness) [US-07]
- [x] A test branching dialogue with at least 2 choice points and 3 leaf paths is playable via the test NPC [US-07]

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

### Golden principles (phase-relevant)
- Systems-based entity architecture — new capabilities are systems/modules, not inlined in scene code
- Depth map compliance — new visual layers must use defined depths (entities=5, UI=100+); new entries: thoughts=150, dialogue=200
- Scene flow — TitleScene -> GameScene; StoryScene is a parallel scene launched/stopped by GameScene
- Input priority — keyboard takes priority over joystick; dialogue/story scenes capture all input while active
- Zone-level mutual exclusion — overlapping interactive layers disable underlying zones, not just guard handlers (LEARNINGS #56)
