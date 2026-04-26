## Phase goal

Make the player's progress survive a closed tab. Today, every refresh sends the player back to Ashen Isle's `playerSpawn` regardless of where they were when the tab closed; only `triggers/flags.ts` persists, so a session that walked through the dock to Fog Marsh, talked to the Marsh Hermit, and stepped a third of the way back across the path is reduced on reload to "you are once again standing at the player-cottage gate." This phase adds the missing **world-walking layer** to localStorage — current `areaId` plus the player's tile/pixel position — and wires the Title screen to read it: a "Continue" entry resumes the saved area at the saved position; "New Game" wipes the save and starts fresh on the default area's `playerSpawn`. Mid-dialogue and mid-StoryScene resume are explicitly out of scope: if the tab closes during a conversation, the conversation closes on resume and the player wakes up on the path with whatever flags had committed. The phase ends when (a) closing the tab anywhere on the world layer of either area and reopening returns the player to the same area at the same position, (b) Title's "Continue" and "New Game" branch correctly based on save presence, (c) "Reset Progress" / a dev URL param clears both flags AND save atomically so a tester can wipe the world cheaply between QA runs.

### Design direction

**Invisible when it works, observable when it breaks.** Save IO is infrastructure — the player should not see "saving…" indicators or save-slot UI. The visible surface is exactly two Title labels (Continue, New Game) and the "Reset Progress" affordance that already exists. Concretely:

- **One implicit save slot.** No named slots, no save-game manager. Save = `localStorage['emberpath_save']`. There is exactly one resume point per browser, like a checkpoint.
- **Save writes are bounded, not chatty.** Position writes throttle to at most once every `SAVE_THROTTLE_MS` (proposal: 1000 ms). Area transitions and clean dialogue/story closes flush immediately so the resume point is current within one second of the last meaningful event. No write per frame, ever.
- **Continue is the default when a save exists.** If there's a save, "Continue" is the visually-primary label; "New Game" is the secondary label. If there's no save, only "New Game" is visible (no greyed-out Continue). The hierarchy matches what the player most likely wants on each session.
- **Reset is one click and atomic.** "Reset Progress" wipes flags AND save in the same call. After reset, "Continue" disappears on the same frame; the player can `?reset=1` from the URL to do the same without clicking, for tester convenience.
- **Failures degrade gracefully.** Private-mode Safari and iframe sandboxes can throw `QuotaExceededError` or block localStorage entirely. The game must still play through; resume just won't survive the session. Failures are logged once, not every frame.

The build-loop's `frontend-design` skill applies to the Title screen layout work in US-64 (Continue/New Game pairing visual hierarchy).

### Dependencies
- world-legibility

### Stories in scope
- US-62 — Save state module: schema, IO, validation, reset
- US-63 — Autosave on world walk + area transition + clean dialogue/story close
- US-64 — Title screen Continue / New Game
- US-65 — World-save reset: button + URL param + clear-on-fresh-tab regression check

### Done-when (observable)

#### Structural — save module (US-62)

- [x] `src/triggers/saveState.ts` exists and exports `loadSave`, `writeSave`, `clearSave`, `hasSave`, `resetWorld` (verified: source read) [US-62]
- [x] `SaveState` type is `{ version: 1; areaId: string; position: { x: number; y: number } }` (verified: source read) [US-62]
- [x] `STORAGE_KEY` constant is `'emberpath_save'`, distinct from `triggers/flags.ts`'s `'emberpath_flags'` (verified: grep both files) [US-62]
- [x] `loadSave()` returns `null` on JSON parse failure AND calls `clearSave()` to scrub the corrupt entry (verified by setting `localStorage.emberpath_save = '{not json'` in DevTools, reloading, observing one warn + the entry removed) [US-62]
- [x] `loadSave()` validates `version === 1`, `areaId` is a known registry id (consults `getAllAreaIds()`), and `position.x/y` are finite numbers; failure returns `null` and clears (verified: source read of the validation branch + a temp tampered `areaId: 'nonexistent'` round-trip) [US-62]
- [x] `writeSave()` wraps `setItem` in `try/catch`; quota / unavailable failures log exactly once per session via a module-level `writeFailureLogged` flag and otherwise silently continue (verified: source read; manual quota test by repeatedly stuffing localStorage to > 5 MB then triggering an autosave) [US-62]
- [x] `clearSave()` is idempotent and wraps `removeItem` in `try/catch` (verified: source read + calling twice in a row) [US-62]
- [x] `hasSave()` returns true iff `loadSave()` is non-null (verified: source read of the relationship; correctness via DevTools toggling) [US-62]
- [x] `resetAllFlags()` in `triggers/flags.ts` calls `clearSave()` from `saveState.ts` so reset is atomic — wipes flags AND world save in one call (verified: source read; manual: set a flag, set a save, click Reset Progress, observe both gone) [US-62]
- [x] No call site outside `saveState.ts` and `flags.ts` reads or writes `'emberpath_save'` or `'emberpath_flags'` directly (verified: grep `localStorage` across `src/`) [US-62]
- [x] A `version: 2` save (manually written in DevTools) loads as `null` and is cleared — the version field is a real gate, not cosmetic (verified by tampered round-trip) [US-62]

#### Structural — autosave write (US-63)

- [x] `GameScene` declares named module-level constants `SAVE_THROTTLE_MS = 1000` and `SAVE_MIN_DELTA_PX = 2` (verified: source read) [US-63]
- [x] `GameScene` has a private method `maybeAutosave()` that owns the throttle bookkeeping (last-write timestamp, last-write x/y) and is called once per frame at the END of the world-walk branch in `update()` — NOT inside the dialogue early-return, NOT inside the transition early-return (verified: source read of the call site location) [US-63]
- [x] `maybeAutosave()` returns early (zero localStorage work; no `JSON.stringify`) when (a) elapsed since last write < `SAVE_THROTTLE_MS`, OR (b) position delta from last write < `SAVE_MIN_DELTA_PX`. Verified: source read of both guards before the build-payload step. **(Loop-invariant audit, Learning EP-01.)** [US-63]
- [x] `transitionToArea()` calls `writeSave({ areaId: destinationAreaId, position: <entryPoint resolved to pixels> })` BEFORE `scene.restart` (verified: source read of the call order; manual: trigger a transition, force-close mid-fade, reopen, Continue lands on the destination's entry tile) [US-63]
- [x] `DialogueSystem.setOnEnd` consumer in `GameScene` flushes the save (verified: source read; manual: open Old Man dialogue, run through to its natural close, force-close tab, reopen, Continue lands at the position the player was in when dialogue closed) [US-63]
- [x] StoryScene close path triggers a save flush back in `GameScene` (verified: source read of whichever resume-from-StoryScene hook GameScene already owns; manual: same pattern as dialogue close) [US-63]
- [x] `AreaDefinition` has `id: string` (added if missing); `data/areas/registry.ts` keys agree with the per-area `id` value (verified: source read + a small grep that registry key === area.id for ashen-isle and fog-marsh) [US-63]
- [x] During `transitionInProgress === true`, `maybeAutosave()` returns without writing (verified: source read of the guard) — only the explicit transition flush writes during a transition [US-63]
- [x] No `writeSave` call inside `update()`'s tight loop on frames where the throttle did not fire (verified: source read; on-frame logging temporarily added during dev confirms zero writes on idle frames) [US-63]

#### Structural — Title Continue / New Game (US-64)

- [x] `TitleScene.create()` calls `hasSave()` exactly once on entry (verified: source read) [US-64]
- [x] When `hasSave()` is true, two labels render: a primary "Continue" near the current Start position; a secondary "New Game" below it (smaller font or muted color) (verified: source read + visual screenshot) [US-64]
- [x] When `hasSave()` is false, no "Continue" label is created — not even greyed out (verified: source read of the conditional branch; visual screenshot in fresh-tab incognito) [US-64]
- [x] Tapping "Continue" calls `loadSave()` and starts `GameScene` with `{ areaId, resumePosition: save.position }`; the `entryPoint` field is undefined on this path (verified: source read) [US-64]
- [x] Tapping "New Game" calls `clearSave()` + `resetAllFlags()` THEN starts `GameScene` with no boot data (verified: source read of the call order) [US-64]
- [x] `GameScene.create` accepts an optional `resumePosition?: { x: number; y: number }` field on its boot data (verified: source read of the type annotation) [US-64]
- [x] When `data.resumePosition` is set AND `data.entryPoint` is absent, `createPlayer()` uses `resumePosition` directly as the pixel position; when both are set, `entryPoint` wins and `resumePosition` is ignored (verified: source read of the precedence branch + an inline comment documenting the rule) [US-64]
- [x] The fade-in branch covers both Continue loads AND transition loads — `if (data?.entryPoint || data?.resumePosition)` (verified: source read) [US-64]
- [x] If `loadSave()` returns a save whose `areaId` is unknown to the registry, the Continue tap falls back to a fresh start (clears save, logs a single warn, starts GameScene with no boot data) — first click is responsive, no second click needed (verified by tampered `areaId` round-trip) [US-64]
- [x] If `loadSave().position` resolves to coordinates outside the destination area's pixel bounds (`x < 0 || x > mapCols * TILE_SIZE || y < 0 || y > mapRows * TILE_SIZE`) OR onto a WALL tile, Continue falls back to the area's `playerSpawn`, clears the stale save entry, and logs a single warn. Verified by tampered round-trip with `position: { x: 99999, y: 99999 }` AND with `position` set to a known WALL-tile pixel coord on Ashen Isle. [US-64]
- [x] Continue label font size is at least 1.5× the New Game label font size on desktop (verified: source read of the two `fontSize` strings; visual screenshot at 1280×720) — encodes the "Continue is the default when a save exists" design direction as a measurable target. [US-64]

#### Structural — reset mechanism (US-65)

- [ ] TitleScene "Reset Progress" click wipes flags AND save together via `resetWorld()` from `saveState.ts` (verified: source read; manual: set a flag in DevTools, set a save, click reset, both gone) [US-65]
- [ ] On Reset confirmation, the "Continue" label is removed (or the layout re-runs in the no-save state) on the same frame so the player doesn't see a stale Continue button while the "Progress Reset!" confirmation is up (verified: source read + screenshot before/after) [US-65]
- [ ] `?reset=1` URL query param triggers a one-shot wipe in `TitleScene.init()` or `create()` BEFORE `hasSave()` is consulted; the Title renders in the no-save state on the same frame (verified: source read + manual via `http://localhost:5173/?reset=1`) [US-65]
- [ ] After `?reset=1`, `history.replaceState` removes the query param so a manual refresh does not re-trigger the wipe (verified: source read; manual: load the URL, observe the URL cleans, refresh, no second wipe log) [US-65]
- [ ] `?clearSave=1` URL query param wipes ONLY the save; flags remain intact (verified: manually set `oldman_greeted: true` flag, save a position, load `?clearSave=1`, observe Continue absent and the flag still present in DevTools) [US-65]
- [ ] `resetWorld()` exported from `saveState.ts` calls `clearSave()` THEN `resetAllFlags()` in that order (verified: source read of the sequence) [US-65]
- [ ] `resetWorld` re-exported from `triggers/flags.ts` for backward import compat at the call site — existing `resetAllFlags` consumers still work without import edits (verified: source read of the re-export AND that the existing `TitleScene` reset-progress import line did not need to change) [US-65]
- [ ] AGENTS.md "Controls" (or new "Dev / testing" subsection) documents `?reset=1` and `?clearSave=1` (verified: source read of AGENTS.md after build-loop reconciliation) [US-65]
- [ ] `docs/plan/save-resume-manual-verify.md` exists with the full checklist enumerated in US-65 acceptance criteria (verified: file present + grep for each named scenario) [US-65]

#### Behavior — resume correctness (US-63 + US-64)

- [ ] **Ashen Isle resume**: walk the player from the cottage gate to a distinct, identifiable position (e.g. east of the path next to the Old Man's fence). Force-close the tab. Reopen. Tap Continue. Player appears within `SAVE_THROTTLE_MS / 2` worth of pixel distance (i.e. half a second of walked distance, ~32 px) of where they were when the tab closed. Camera follows. No double-fade. No console errors. (verified: manual-verify checklist) [US-63, US-64]
- [ ] **Fog Marsh resume**: same protocol on Fog Marsh's dry path. Player resumes on Fog Marsh, on the path, near the prior position. (verified: manual) [US-63, US-64]
- [x] **Mid-transition resume**: walk to Ashen Isle's dock. Cross. While the fade-out + fade-in is in progress, force-close the tab. Reopen. Tap Continue. Player lands on Fog Marsh's entry tile (the destination flush from the transition write), NOT on Ashen Isle's exit-zone tile (which would re-fire the transition on entry). (verified: manual) [US-63]
- [ ] **Mid-dialogue resume**: open Old Man dialogue. Mid-conversation, force-close the tab. Reopen. Tap Continue. The dialogue is closed (we did not save dialogue state). The player is on the world layer at the position of the most recent walk-frame autosave (i.e. roughly where they were when they pressed Space, since dialogue freezes movement). Flags committed before the close are still set. (verified: manual) [US-63, US-64]
- [x] **New Game wipes save**: with a save present from the resume tests above, return to Title (refresh page). Tap "New Game." Player lands on Ashen Isle's `playerSpawn`. Refresh page → "Continue" is absent (save was wiped at the New Game click). (verified: manual) [US-64]

#### Class baseline — autosave parity across save trigger points

The save module joins the class of "world-state writers" that already includes `flags.ts`. Every shared behaviour is verified explicitly:

- [x] Both modules use `try/catch` around `localStorage` reads AND writes (verified: source read of both modules) [US-62]
- [x] Both modules log on failure exactly once per session (not on every call) — `flags.ts` may not currently log; if so, US-62 brings parity by adding a once-per-session warn for write failures (verified: source read) [US-62]
- [x] Both modules' `reset` paths are idempotent (verified: calling `resetAllFlags()` twice in a row + `clearSave()` twice in a row neither throw nor produce duplicate logs) [US-62]

#### Variant baseline — every save trigger point fires for every area

The autosave write path has three trigger points (throttled walk, transition flush, dialogue/story close) and the game has two areas. Per-area verification per trigger:

- [x] **Ashen Isle, throttled walk**: walking continuously updates the save within ≤ 1 s of any position change (verified by polling DevTools localStorage during walk) [US-63]
- [x] **Ashen Isle, transition flush**: stepping into the dock writes a save with `areaId: 'fog-marsh'` and the destination entry-pixel position BEFORE the scene restart (verified by checking DevTools localStorage during the fade-out) [US-63]
- [x] **Ashen Isle, dialogue close flush**: closing Old Man dialogue writes a save with the post-dialogue player position (verified by polling DevTools localStorage on dialogue close) [US-63]
- [x] **Fog Marsh, throttled walk**: same protocol on Fog Marsh [US-63]
- [x] **Fog Marsh, transition flush**: stepping into the door writes a save with `areaId: 'ashen-isle'` and the Ashen Isle entry-pixel position [US-63]
- [x] **Fog Marsh, dialogue close flush**: closing Marsh Hermit dialogue writes a save with the post-dialogue position [US-63]
- [x] **Fog Marsh, StoryScene close flush** (Whispering Stones triggers a story scene): closing the StoryScene writes a save with the post-story player position (verified by polling DevTools localStorage on StoryScene close) [US-63]

#### Variant baseline — every reset mechanism wipes both stores when intended

- [ ] **Reset Progress button**: wipes flags AND save together (verified manually) [US-65]
- [ ] **`?reset=1` URL param**: wipes flags AND save together; URL cleans (verified manually) [US-65]
- [ ] **`?clearSave=1` URL param**: wipes save ONLY; flags persist (verified manually) [US-65]
- [ ] **New Game button**: wipes flags AND save together (same call path as Reset; verified manually) [US-64, US-65]

#### Behavior — reads-as

Each reads-as is paired with an objective mechanism proxy.

- [x] **"Continue" reads-as "the game remembers me"**: a first-time observer (someone who played a session, closed the tab, and returned without prior knowledge of save/load) given the question "what does Continue do?" answers "it picks up where I left off" — NOT "it just starts the game" or "I don't know." (verified via the manual-verify observer note) [US-64]
- [x] **Continue mechanism proxy**: tap → `loadSave()` returns the stored payload → `scene.start('GameScene', { areaId, resumePosition })` → `createPlayer()` uses `resumePosition`. Verified by source read of the call sequence. [US-64]
- [ ] **"Reset Progress" reads-as "I am wiped"**: a first-time observer who clicks Reset Progress and then refreshes can describe the state as "fresh start, like I never played" — NOT "I think it kept some things." (verified via observer note) [US-65]
- [ ] **Reset mechanism proxy**: click → `resetWorld()` → `clearSave()` + `resetAllFlags()` both fire → `hasSave()` returns false → Title re-layouts to no-save state. Verified by source read. [US-65]

#### Error paths

- [x] **Corrupt JSON in localStorage** (`emberpath_save = "not json"`): on Title boot, `hasSave()` returns false, the entry is removed from localStorage, exactly one `console.warn` fires, no crash (verified manually) [US-62]
- [x] **Tampered shape** (`emberpath_save = '{"version":1,"areaId":"nonexistent","position":{"x":0,"y":0}}'`): on Title boot, `hasSave()` returns false, the entry is removed, exactly one warn fires (verified manually) [US-62]
- [x] **Wrong version** (`emberpath_save = '{"version":2,...}'`): same handling — null-treated and cleared (verified manually) [US-62]
- [x] **Continue with stale `areaId`** (e.g. saved on `'old-name'` after an area rename): tapping Continue triggers fallback to a fresh start; first click is responsive (verified manually) [US-64]
- [x] **localStorage unavailable / blocked** (Safari private mode iframe sandbox): the game runs end-to-end without crash; Continue stays absent across reloads; exactly one warn fires per session for save-write failure (verified in iOS Safari private tab) [US-62]
- [x] **Quota exceeded** (localStorage stuffed > 5 MB by a co-resident origin): same handling as private mode — game runs, single warn, Continue may stay absent (verified by manual quota stuffing) [US-62]
- [ ] **`?reset=1` and `?clearSave=1` together**: the wipe is total (both clear), URL cleans both params (verified manually) [US-65]

#### Editor sync

- [x] `tools/editor/` is unaffected by this phase (the editor reads area definitions, not save state). `cd tools/editor && npm run build` passes after `AreaDefinition.id` is added. (verified) [US-63]

#### Aesthetic traceability

- [ ] **"Invisible when it works"** (design direction) traces to: zero new HUD elements; only Title labels change; in-game frame has zero per-frame localStorage work on idle frames (loop-invariant audit). [phase]
- [x] **"Continue is the default when a save exists"** (design direction) traces to: Title layout branch on `hasSave()`; primary visual weight on Continue; New Game smaller. [US-64]
- [ ] **"Reset is one click and atomic"** (design direction) traces to: `resetWorld()` calls `clearSave` + `resetAllFlags` synchronously; Continue button removal is on the same frame as reset confirmation. [US-65]
- [x] **"Failures degrade gracefully"** (design direction) traces to: every error-path criterion above; once-per-session warn flag in saveState. [US-62]

#### Invariants

- [ ] `npx tsc --noEmit && npm run build` passes [phase]
- [ ] `cd tools/editor && npm run build` passes [phase]
- [ ] No console errors during 90 seconds of play covering: New Game on Ashen Isle, walk path to Old Man, full dialogue, walk to dock, transition to Fog Marsh, walk to Marsh Hermit, full dialogue, Whispering Stones story scene, return to Ashen Isle, force-close tab, reopen, Continue, walk again [phase]
- [ ] AGENTS.md "Directory layout" tree updated to include `src/triggers/saveState.ts` [phase]
- [ ] AGENTS.md "File ownership" rows updated for: `triggers/saveState.ts` (new — schema + IO + reset surface), `triggers/flags.ts` (now also clears save via `resetAllFlags`), `scenes/TitleScene.ts` (Continue/New Game branching, URL-param reset handling), `scenes/GameScene.ts` (`maybeAutosave`, transition flush, dialogue/story close flush, `resumePosition` boot field), `data/areas/types.ts` (added `AreaDefinition.id`) [phase]
- [ ] AGENTS.md "Behavior rules" gains a "Save / resume" entry covering: throttle constants, three trigger points, atomic reset semantics, Continue precedence rule (`entryPoint` wins over `resumePosition`), URL-param reset behaviour [phase]
- [ ] AGENTS.md "Controls" gains a "Dev / testing" subsection (or appendix) covering `?reset=1` and `?clearSave=1` [phase]
- [ ] **Loop-invariant audit (Learning EP-01):** confirmed no per-frame `JSON.stringify`, no per-frame `localStorage.setItem`, no `setTexture`-style identical re-writes; the throttle returns before any IO when not eligible [phase]
- [ ] **Deploy verification (Learning #65):** GitHub Pages deploy workflow succeeds for the squash-merge commit on `main` (green check) [phase]
- [ ] **Deploy smoke (Learning #65, post-deploy):** open the deployed `https://jaxsbr.github.io/emberpath/` URL, play a short session that walks at least 100 px, refresh, verify Continue is present AND tapping it resumes at the prior position — confirms localStorage works on the deployed origin (different from `localhost:5173`) [phase]

### Golden principles (phase-relevant)

- **Parameterized systems:** `saveState.ts` is engine-agnostic — it does not import Phaser, does not reach into `GameScene`, does not know area names beyond consulting the registry. Two consumers (TitleScene reads, GameScene writes); every other call site is a violation.
- **No silent breaking changes:** `version: 1` on the save payload from day one. A future `version: 2` change must update the load path's switch arm, not retroactively interpret v1 saves as a different shape. `resetAllFlags` keeps its exported name; the new `clearSave()` call inside it is additive.
- **From LEARNINGS EP-01 (loop invariants):** autosave must not call `JSON.stringify` or `setItem` per frame. The throttle + position-delta guard fires BEFORE any IO; idle frames cost zero. Mirror the props/decoration "create once" pattern, applied here as "write at most once per second + only when something changed."
- **From LEARNINGS #57 (depth-map authority):** no new visual layers; this phase touches no depths.
- **Zone-level mutual exclusion (LEARNINGS #56):** autosave is suppressed during dialogue, StoryScene, and transitions — same exclusion zones already in force for movement and triggers. The flush-on-close paths re-arm autosave the moment the exclusion lifts.
- **Invisible when it works:** UI surface is exactly two Title labels and one existing Reset link. No "saving..." indicator, no save slot manager, no toast. Failures log once and degrade silently — the game stays playable.

### Reference

Full spec, story bodies, design rationale, and AGENTS.md sections affected: `docs/product/phases/save-resume.md`.
