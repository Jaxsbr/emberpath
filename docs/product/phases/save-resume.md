# Phase: save-resume

Status: draft

## Phase goal

Make the player's progress survive a closed tab. Today, every refresh sends the player back to Ashen Isle's `playerSpawn` regardless of where they were when the tab closed; only `triggers/flags.ts` persists, so a session that walked through the dock to Fog Marsh, talked to the Marsh Hermit, and stepped a third of the way back across the path is reduced on reload to "you are once again standing at the player-cottage gate." This phase adds the missing **world-walking layer** to localStorage — current `areaId` plus the player's tile/pixel position — and wires the Title screen to read it: a "Continue" entry resumes the saved area at the saved position; "New Game" wipes the save and starts fresh on the default area's `playerSpawn`. Mid-dialogue and mid-StoryScene resume are explicitly out of scope: if the tab closes during a conversation, the conversation closes on resume and the player wakes up on the path with whatever flags had committed. The phase ends when (a) closing the tab anywhere on the world layer of either area and reopening returns the player to the same area at the same position, (b) Title's "Continue" and "New Game" branch correctly based on save presence, (c) "Reset Progress" / a dev URL param clears both flags AND save atomically so a tester can wipe the world cheaply between QA runs.

## Design direction

**Invisible when it works, observable when it breaks.** Save IO is infrastructure — the player should not see "saving…" indicators or save-slot UI. The visible surface is exactly two Title labels (Continue, New Game) and the "Reset Progress" affordance that already exists. Concretely:

- **One implicit save slot.** No named slots, no save-game manager. Save = `localStorage['emberpath_save']`. There is exactly one resume point per browser, like a checkpoint.
- **Save writes are bounded, not chatty.** Position writes throttle to at most once every `SAVE_THROTTLE_MS` (proposal: 1000 ms). Area transitions and clean dialogue/story closes flush immediately so the resume point is current within one second of the last meaningful event. No write per frame, ever.
- **Continue is the default when a save exists.** If there's a save, "Continue" is the visually-primary label; "New Game" is the secondary label. If there's no save, only "New Game" is visible (no greyed-out Continue). The hierarchy matches what the player most likely wants on each session.
- **Reset is one click and atomic.** "Reset Progress" wipes flags AND save in the same call. After reset, "Continue" disappears on the same frame; the player can `?reset=1` from the URL to do the same without clicking, for tester convenience.
- **Failures degrade gracefully.** Private-mode Safari and iframe sandboxes can throw `QuotaExceededError` or block localStorage entirely. The game must still play through; resume just won't survive the session. Failures are logged once, not every frame.

The build-loop's `frontend-design` skill applies to the Title screen layout work in US-64 (Continue/New Game pairing visual hierarchy).

## Safety criteria

This phase introduces no API endpoints, no user text input fields, and no query interpolation. It does, however, **read JSON from localStorage**, which on disk is user-editable, so the load path must not crash on tampered or corrupted JSON. Auto-added safety criteria:

- [ ] `loadSave()` wraps `JSON.parse` in `try/catch` and returns `null` on parse failure rather than throwing [US-62]
- [ ] `loadSave()` validates the parsed payload's shape (areaId is a known string, position is `{x: number, y: number}` with finite numerics) and returns `null` if the shape doesn't match — corrupted save is treated as "no save" [US-62]
- [ ] On corrupted save detection, the corrupted entry is **removed** from localStorage so a subsequent reload doesn't re-trip the same warning every load [US-62]
- [ ] All localStorage reads/writes wrap in `try/catch`; private-mode Safari throwing on `setItem` does not crash the game [US-62]

## Stories

### US-62 — Save state module: schema, IO, validation, reset

As a player whose tab might close at any moment, I want the engine to have a single dedicated module that knows what "the world save" is, how to read and write it from localStorage, how to recognise a corrupt or missing save, and how to wipe it cleanly, so that every other system (Title screen, autosave on transition, reset button) calls one well-defined surface instead of duplicating localStorage logic.

**Acceptance criteria**:
- New module `src/triggers/saveState.ts` exports: `loadSave(): SaveState | null`, `writeSave(state: SaveState): void`, `clearSave(): void`, `hasSave(): boolean`. `SaveState` is the type `{ version: 1; areaId: string; position: { x: number; y: number } }`.
- `STORAGE_KEY = 'emberpath_save'` is a module-private constant (distinct from `flags.ts`'s `'emberpath_flags'`).
- `loadSave()` wraps the JSON parse in `try/catch`; on any parse error returns `null` AND calls `clearSave()` to remove the corrupted entry. The error path logs a single descriptive `console.warn` naming `STORAGE_KEY` (not silently swallowed, but only once per page load).
- `loadSave()` validates the parsed shape: `version === 1`, `areaId` is a non-empty string AND is a known area id (consults `getAllAreaIds()` from `data/areas/registry.ts`); `position.x` and `position.y` are finite numbers. If validation fails, returns `null` and calls `clearSave()`.
- `writeSave()` wraps `localStorage.setItem` in `try/catch`. On `QuotaExceededError` or other thrown failure, logs `console.warn('emberpath: save write failed', err)` exactly once per session (a module-level `writeFailureLogged` flag) and otherwise silently continues — the game must not crash.
- `clearSave()` wraps `localStorage.removeItem` in `try/catch` and is idempotent — clearing an absent key is a no-op.
- `hasSave()` returns `true` iff `loadSave()` returns a non-null value. Implementation may cache the result for the current page lifecycle since save shape only changes via this module.
- `resetAllFlags()` in `triggers/flags.ts` is updated to also call `clearSave()` so reset is atomic at the existing call site (TitleScene's "Reset Progress"). The function comment explicitly states "wipes flags AND world save together — the only legitimate reset path."
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Internal module — no player-facing surface in this story. Player effects land in US-63 (autosave) and US-64 (Continue).
- Manual section: N/A.
- Key steps: N/A.

**Design rationale:** A dedicated module over inlining localStorage IO into `GameScene` because the same payload is read by `TitleScene` (Continue button) and written by `GameScene` (autosave + transition flush) and cleared by `flags.resetAllFlags` — three call sites for one piece of state, exactly the case where a module pays off. Name `saveState.ts` over `save.ts` because the directory `triggers/` already implies session-state semantics; "save" alone is ambiguous between "saved game" and "save action." Versioning the payload with `version: 1` from the start because future phases (audio prefs, accessibility, mid-dialogue resume) will extend the shape, and `loadSave` rejecting unknown versions cheaply is the migration story for v2 → v1 readers.

**Consumer adaptation:** `loadSave` and `writeSave` are pure functions of localStorage; they don't know about Phaser. Two consumers: `TitleScene` (read-only, calls `hasSave()` and `loadSave()` to decide button labels and prefill the boot data) and `GameScene` (write, calls `writeSave()` on autosave + transition + dialogue/story close). Both consumers are explicit; there are no other read or write sites — verified by grep at PR review time.

**Processing model:** Saves are written synchronously (localStorage is sync). No queue, no debounced async batch — the throttle in US-63 lives in `GameScene`, not in this module. This module's contract is: any call to `writeSave(state)` results in the localStorage entry being either updated to that state OR (on quota/exception) unchanged with a single warn log, by the time the call returns.

---

### US-63 — Autosave on world walk + area transition + clean dialogue/story close

As a player who closed the tab without warning, I want the game to have already written my last position recently enough that I wake up where I left off, so that resuming feels continuous instead of "I lost the last several minutes."

**Acceptance criteria**:
- `GameScene` calls `writeSave({ version: 1, areaId: this.area.id, position: { x: this.player.x, y: this.player.y } })` at three trigger points:
  - **Throttled, during world-walk update**: at the end of `update()` when `transitionInProgress === false` AND `dialogueSystem.isActive === false` AND no StoryScene is active, IF at least `SAVE_THROTTLE_MS` (proposal: **1000**) ms have elapsed since the last write AND the player position changed by at least `SAVE_MIN_DELTA_PX` (proposal: **2**) since the last write. Both thresholds are named module-level constants in `GameScene.ts`.
  - **Immediate, on area transition**: inside `transitionToArea()`, after the destination area is determined but before `scene.restart`, write the save with the destination `areaId` and the destination's `entryPoint` resolved to its pixel position (i.e. the position the player is about to spawn at on the new area, not the position they're currently at on the old area). The next session resumes on the destination area, on the entry tile.
  - **Immediate, on dialogue close** AND **on StoryScene close**: write `{ areaId, position }` snapshotted at the moment the dialogue/story finishes — the player is now on the world layer again so this is a safe checkpoint.
- `AreaDefinition` may need an `id: string` field if it doesn't already have one (verified by reading `data/areas/types.ts`); if missing, add it and populate from the registry key in `data/areas/registry.ts`. The save's `areaId` must be the registry key, not a display name.
- The `update()` autosave call site is a single line `this.maybeAutosave()` placed at the end of the world-walk branch, NOT inside the dialogue or transition early-return branches. `maybeAutosave()` is a `private` method on `GameScene` that owns the throttle bookkeeping (last-write timestamp, last-write position).
- A frame in which `maybeAutosave()` is called but the throttle prevents a write does **zero** localStorage work — no read, no write, no JSON.stringify (verified by source read; the throttle guard returns before the stringify).
- During a transition (`transitionInProgress === true`), the throttle path is suppressed; only the `transitionToArea` flush writes. This avoids racing a stale `(oldArea.id, midScreen.position)` save against the destination flush.
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Ambient — no UI. Effects only visible on next page load via the Continue button (US-64).
- Manual section: N/A — invisible infrastructure.
- Key steps: Walk around. Close tab. Reopen. Continue. (US-64 owns the visible Continue affordance.)

**Design rationale:** A 1000 ms throttle is generous enough that a player walking continuously writes once per second (negligible cost) and tight enough that the average resume gap is half a second of walked distance — well under "I lost progress." A position-delta of 2 px filters out a player standing still on the joystick deadzone (which still writes velocity but no position) so the same save isn't rewritten every second of standing in front of the Old Man. Writing on transition to the destination area's entry pixel (rather than the current area's exit-zone pixel) means the resume always lands on a path/exit tile, never on a half-step into an exit zone that re-fires the transition (cheaper than re-entrancy debugging on the load side). Flushing on dialogue/story close gives the player "I just closed a meaningful UI; my position is safe" without trying to model mid-dialogue resume — that's deferred to a later phase. The two thresholds (`SAVE_THROTTLE_MS`, `SAVE_MIN_DELTA_PX`) are named constants so future tuning is a one-line edit.

**Consumer adaptation:** `GameScene` is the sole writer. `maybeAutosave()` and the explicit-flush paths are private methods; nothing else in the codebase calls `writeSave()`. Verified by grep at PR review.

**Processing model:** The throttle is purely time + delta gated. No queue, no async. On the frame the throttle fires, the call sequence is: read `this.area.id` → read `this.player.x/y` → build payload → call `writeSave()` (which calls `setItem` → returns) → store new last-write timestamp + position. On all other world-walk frames, the call returns immediately after the throttle guard.

---

### US-64 — Title screen Continue / New Game

As a returning player, I want the Title screen to offer me "Continue" (resuming where I left off) or "New Game" (a fresh start that wipes my save), so that I never lose progress to a misclick AND I'm never blocked from starting over.

**Acceptance criteria**:
- `TitleScene.create()` calls `hasSave()` once on entry. The result drives layout.
- **When `hasSave()` is true**: render two interactive labels — "Continue" (primary, large) at roughly current `Start` position; "New Game" (secondary, smaller, slightly lower). The existing "Reset Progress" link is kept in its current position (US-65 owns its behaviour).
  - Tapping/clicking "Continue" calls `loadSave()`, then `this.scene.start('GameScene', { areaId: save.areaId, entryPoint: undefined, resumePosition: save.position })`. (The `entryPoint` field stays for transition entry; a new optional `resumePosition` field on the GameScene boot data is the resume override.)
  - Tapping/clicking "New Game" calls `clearSave()` AND `resetAllFlags()` (atomic — uses the existing `resetAllFlags` updated in US-62), then `this.scene.start('GameScene')` with no boot data so default-area + default-spawn applies.
- **When `hasSave()` is false**: render exactly one primary label — "New Game" (or keep the existing "Start" copy — choose one and document the choice). No "Continue" button; no greyed-out "Continue" placeholder. Reset-progress link may be hidden or kept visible (author choice; document).
- `GameScene.create(data)` accepts the new optional `resumePosition?: { x: number; y: number }` field on its boot data. When present (and `entryPoint` absent), `createPlayer()` uses `resumePosition` directly as the player's pixel coords instead of tile-multiplying `playerSpawn` or `entryPoint`. When both `entryPoint` and `resumePosition` are present, `entryPoint` wins (transitions always override resume — verified inline with a comment).
- The fade-in branch in `GameScene.create()` (currently keyed on `data?.entryPoint`) extends to also fade in when `data?.resumePosition` is set, so a Continue load starts on a black-to-visible fade rather than a hard cut. New combined branch: `if (data?.entryPoint || data?.resumePosition)`.
- Pressing "Continue" when the save's `areaId` is unknown to the registry (e.g. an area was renamed between releases) falls back to: `clearSave()` (the corrupted shape branch from US-62 covers this), log a single warn, then start `GameScene` with no boot data so the player lands on the default area's `playerSpawn`. The Title button is responsive on first click — no second click needed.
- Continue from Fog Marsh: closing the tab while standing on Fog Marsh's dry path and reopening lands the player on Fog Marsh at the same pixel position; the camera follows; no double-fade; no console error; the area's NPCs and triggers behave as if entered normally.
- Continue from Ashen Isle: same, on Ashen Isle.
- New Game after Continue: starting a session, walking to Fog Marsh, closing tab, reopening, choosing "New Game" lands the player on Ashen Isle's `playerSpawn` (the registry default) AND `hasSave()` returns false on the next reload (the save was wiped at the New Game click).
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: Title screen — visible on first paint after the page loads. "Continue" appears as the primary affordance whenever a save exists; "New Game" is always available.
- Manual section: N/A — uses the same Title screen the player already knows.
- Key steps: (1) Open the page. (2) If you've played before, the top button says "Continue" — tap it to resume. (3) Tap "New Game" any time to start over (your save is wiped).

**Design rationale:** Continue-as-primary-when-present mirrors every console game published in the last 25 years; making "New Game" the smaller, secondary label is the cheap signal that "we know you most likely want to keep going." Hiding (rather than greying) the Continue label when no save exists removes a class of "why is this button disabled?" confusion for kids who haven't played yet. Using a new optional `resumePosition` field on the GameScene boot data instead of overloading `entryPoint` keeps the transition codepath untouched — `entryPoint` is "you arrived here by walking through an exit zone," `resumePosition` is "you arrived here by clicking Continue on the Title screen," and conflating them would mean every transition handler has to ask "is this a real transition or a resume?". Letting `entryPoint` win when both are set encodes the invariant "transitions are deterministic; resume is opportunistic."

**Consumer adaptation:** `TitleScene` is the only consumer of `loadSave` and `hasSave`. `GameScene.create` is parameterised on `resumePosition`; the field is consumer-added (Title) and consumer-consumed (GameScene), no third caller.

**Processing model:** Title boot is synchronous — `hasSave()` is one localStorage read. On Continue click: `loadSave` → `scene.start('GameScene', { areaId, resumePosition })`. On New Game click: `clearSave` + `resetAllFlags` → `scene.start('GameScene')` with empty boot data. No async, no loaders, no spinners; localStorage IO is single-digit ms.

---

### US-65 — World-save reset: button + URL param + clear-on-fresh-tab regression check

As a tester (and as a kid who pressed all the buttons), I want a fast, reliable way to wipe the world save without inspecting localStorage by hand, so that QA runs and "I want to start over" both work without dev-tools.

**Acceptance criteria**:
- The existing TitleScene "Reset Progress" affordance now wipes flags AND the world save together (via `resetAllFlags()` updated in US-62). On click, the temporary "Progress Reset!" confirmation is shown for 1.5 s as today, AND the Continue button (if it was visible) disappears on the same frame because `hasSave()` is now false. Implementation: TitleScene re-runs the layout logic (or destroys + recreates the Continue label) on reset confirmation.
- A URL query parameter `?reset=1` on the entry page (e.g. `https://localhost:5173/?reset=1`) triggers a one-shot reset on Title boot: `clearSave()` + `resetAllFlags()` are called once before any layout decision, the Title screen renders in the no-save state, and the URL is cleaned (history.replaceState to remove the query param) so a refresh doesn't re-trigger the reset. A single info log `'emberpath: ?reset=1 — flags + save wiped'` is emitted.
- A second URL query parameter `?clearSave=1` (without `?reset=1`) wipes ONLY the save, leaving flags intact — useful when a tester wants to test "Continue with a deleted save while my conversation flags persist." Same one-shot semantics; same URL cleanup; analogous info log.
- An exported function `resetWorld(): void` on `triggers/saveState.ts` is the single internal entry point that both URL handlers and the Title button call when wiping both. It calls `clearSave()` then `resetAllFlags()` in that order (save first, then flags — so a watcher seeing flag changes can assume save is already gone). `resetWorld` is also re-exported from `triggers/flags.ts` so existing imports of `resetAllFlags` need not change in their call site.
- The reset paths are exercised manually per the manual-verify checklist below; no automated test framework is added in this phase (consistent with the project's "no test framework configured" stance in AGENTS.md).
- `docs/plan/save-resume-manual-verify.md` exists with at least the following per-area + per-reset-mechanism checklist:
  - Ashen Isle: walk; close tab; reopen; Continue; verify same position. (autosave + Continue)
  - Fog Marsh: walk; close tab; reopen; Continue; verify same position.
  - Mid-area-transition close: cross dock to Fog Marsh; force-close while fade is in progress; reopen; Continue; verify lands on Fog Marsh's entry tile (the transition flush) NOT on Ashen Isle's exit-zone tile.
  - Mid-dialogue close: open Old Man dialogue; close tab mid-conversation; reopen; Continue; verify dialogue is closed; player is at the position recorded at the last walk-frame autosave (NOT mid-dialogue snapshot).
  - Reset button: with a save present, click Reset Progress; verify Continue disappears; verify next page load shows New-Game-only Title.
  - `?reset=1`: load page with the param; verify URL cleans to no query; verify Continue absent; verify a known flag (e.g. `oldman_greeted`) is now unset.
  - `?clearSave=1`: load page with the param after talking to the Old Man; verify Continue absent; verify `oldman_greeted` is still `true`.
  - Private mode (Safari iOS or Chrome incognito with localStorage blocked): play a normal session; verify the game runs without crashing; verify Continue stays absent across reloads (gracefully, no console errors, only the single warn from US-62).
  - Corrupted save: in DevTools → Application → Local Storage, set `emberpath_save` to `"not json"`. Reload Title. Verify Continue is absent (not crashed); verify the entry was removed; verify a single warn log fired.
- AGENTS.md "Controls" section gains a one-liner about `?reset=1` and `?clearSave=1` URL params (under a new "Dev / testing" subheading or appended to Controls — author choice; document).
- `npx tsc --noEmit && npm run build` passes.

**User guidance:**
- Discovery: "Reset Progress" link is on the Title screen, same as today. URL params are documented in AGENTS.md "Dev / testing" for testers and Jaco; not advertised to end-users.
- Manual section: New section in `docs/plan/save-resume-manual-verify.md` (new file, mirrors `world-legibility-manual-verify.md` shape).
- Key steps: (1) Click Reset Progress on Title to wipe everything. (2) Append `?reset=1` to the URL for the same effect without clicking. (3) Append `?clearSave=1` to wipe only resume position, keeping conversation flags.

**Design rationale:** A button + URL params is the smallest surface that covers both end-user (kid: "I want to restart") and tester (Jaco: "let me wipe between QA runs without DevTools") needs. URL params over a debug menu because the project has no debug menu and adding one for one phase is overkill; URL params over a query inside the game scene because tester intent is "clear before any state loads." `?clearSave=1` separately from `?reset=1` because flag state is independent — a tester might want "show me what New Game looks like for a player who's already heard the Marsh Hermit's intro" without re-walking. URL cleanup via `history.replaceState` so a refresh doesn't infinite-reset; consistent with how `?utm_*` params are typically handled.

**Consumer adaptation:** `resetWorld()` is the single internal reset path; both call sites (TitleScene button, URL param handler in TitleScene boot) call it. No third caller.

**Processing model:** URL parsing happens once in TitleScene's `init()` (or `create()` before layout) — it reads `window.location.search`, branches, calls `resetWorld()` or `clearSave()`, and `history.replaceState`. Synchronous; happens before `hasSave()` is consulted for layout, so the post-reset Title renders in the no-save state on the same frame.

---

## Done-when (observable)

### Structural — save module (US-62)

- [ ] `src/triggers/saveState.ts` exists and exports `loadSave`, `writeSave`, `clearSave`, `hasSave`, `resetWorld` (verified: source read) [US-62]
- [ ] `SaveState` type is `{ version: 1; areaId: string; position: { x: number; y: number } }` (verified: source read) [US-62]
- [ ] `STORAGE_KEY` constant is `'emberpath_save'`, distinct from `triggers/flags.ts`'s `'emberpath_flags'` (verified: grep both files) [US-62]
- [ ] `loadSave()` returns `null` on JSON parse failure AND calls `clearSave()` to scrub the corrupt entry (verified by setting `localStorage.emberpath_save = '{not json'` in DevTools, reloading, observing one warn + the entry removed) [US-62]
- [ ] `loadSave()` validates `version === 1`, `areaId` is a known registry id (consults `getAllAreaIds()`), and `position.x/y` are finite numbers; failure returns `null` and clears (verified: source read of the validation branch + a temp tampered `areaId: 'nonexistent'` round-trip) [US-62]
- [ ] `writeSave()` wraps `setItem` in `try/catch`; quota / unavailable failures log exactly once per session via a module-level `writeFailureLogged` flag and otherwise silently continue (verified: source read; manual quota test by repeatedly stuffing localStorage to > 5 MB then triggering an autosave) [US-62]
- [ ] `clearSave()` is idempotent and wraps `removeItem` in `try/catch` (verified: source read + calling twice in a row) [US-62]
- [ ] `hasSave()` returns true iff `loadSave()` is non-null (verified: source read of the relationship; correctness via DevTools toggling) [US-62]
- [ ] `resetAllFlags()` in `triggers/flags.ts` calls `clearSave()` from `saveState.ts` so reset is atomic — wipes flags AND world save in one call (verified: source read; manual: set a flag, set a save, click Reset Progress, observe both gone) [US-62]
- [ ] No call site outside `saveState.ts` and `flags.ts` reads or writes `'emberpath_save'` or `'emberpath_flags'` directly (verified: grep `localStorage` across `src/`) [US-62]
- [ ] A `version: 2` save (manually written in DevTools) loads as `null` and is cleared — the version field is a real gate, not cosmetic (verified by tampered round-trip) [US-62]

### Structural — autosave write (US-63)

- [ ] `GameScene` declares named module-level constants `SAVE_THROTTLE_MS = 1000` and `SAVE_MIN_DELTA_PX = 2` (verified: source read) [US-63]
- [ ] `GameScene` has a private method `maybeAutosave()` that owns the throttle bookkeeping (last-write timestamp, last-write x/y) and is called once per frame at the END of the world-walk branch in `update()` — NOT inside the dialogue early-return, NOT inside the transition early-return (verified: source read of the call site location) [US-63]
- [ ] `maybeAutosave()` returns early (zero localStorage work; no `JSON.stringify`) when (a) elapsed since last write < `SAVE_THROTTLE_MS`, OR (b) position delta from last write < `SAVE_MIN_DELTA_PX`. Verified: source read of both guards before the build-payload step. **(Loop-invariant audit, Learning EP-01.)** [US-63]
- [ ] `transitionToArea()` calls `writeSave({ areaId: destinationAreaId, position: <entryPoint resolved to pixels> })` BEFORE `scene.restart` (verified: source read of the call order; manual: trigger a transition, force-close mid-fade, reopen, Continue lands on the destination's entry tile) [US-63]
- [ ] `DialogueSystem.setOnEnd` consumer in `GameScene` flushes the save (verified: source read; manual: open Old Man dialogue, run through to its natural close, force-close tab, reopen, Continue lands at the position the player was in when dialogue closed) [US-63]
- [ ] StoryScene close path triggers a save flush back in `GameScene` (verified: source read of whichever resume-from-StoryScene hook GameScene already owns; manual: same pattern as dialogue close) [US-63]
- [ ] `AreaDefinition` has `id: string` (added if missing); `data/areas/registry.ts` keys agree with the per-area `id` value (verified: source read + a small grep that registry key === area.id for ashen-isle and fog-marsh) [US-63]
- [ ] During `transitionInProgress === true`, `maybeAutosave()` returns without writing (verified: source read of the guard) — only the explicit transition flush writes during a transition [US-63]
- [ ] No `writeSave` call inside `update()`'s tight loop on frames where the throttle did not fire (verified: source read; on-frame logging temporarily added during dev confirms zero writes on idle frames) [US-63]

### Structural — Title Continue / New Game (US-64)

- [ ] `TitleScene.create()` calls `hasSave()` exactly once on entry (verified: source read) [US-64]
- [ ] When `hasSave()` is true, two labels render: a primary "Continue" near the current Start position; a secondary "New Game" below it (smaller font or muted color) (verified: source read + visual screenshot) [US-64]
- [ ] When `hasSave()` is false, no "Continue" label is created — not even greyed out (verified: source read of the conditional branch; visual screenshot in fresh-tab incognito) [US-64]
- [ ] Tapping "Continue" calls `loadSave()` and starts `GameScene` with `{ areaId, resumePosition: save.position }`; the `entryPoint` field is undefined on this path (verified: source read) [US-64]
- [ ] Tapping "New Game" calls `clearSave()` + `resetAllFlags()` THEN starts `GameScene` with no boot data (verified: source read of the call order) [US-64]
- [ ] `GameScene.create` accepts an optional `resumePosition?: { x: number; y: number }` field on its boot data (verified: source read of the type annotation) [US-64]
- [ ] When `data.resumePosition` is set AND `data.entryPoint` is absent, `createPlayer()` uses `resumePosition` directly as the pixel position; when both are set, `entryPoint` wins and `resumePosition` is ignored (verified: source read of the precedence branch + an inline comment documenting the rule) [US-64]
- [ ] The fade-in branch covers both Continue loads AND transition loads — `if (data?.entryPoint || data?.resumePosition)` (verified: source read) [US-64]
- [ ] If `loadSave()` returns a save whose `areaId` is unknown to the registry, the Continue tap falls back to a fresh start (clears save, logs a single warn, starts GameScene with no boot data) — first click is responsive, no second click needed (verified by tampered `areaId` round-trip) [US-64]
- [ ] If `loadSave().position` resolves to coordinates outside the destination area's pixel bounds (`x < 0 || x > mapCols * TILE_SIZE || y < 0 || y > mapRows * TILE_SIZE`) OR onto a WALL tile, Continue falls back to the area's `playerSpawn`, clears the stale save entry, and logs a single warn. Verified by tampered round-trip with `position: { x: 99999, y: 99999 }` AND with `position` set to a known WALL-tile pixel coord on Ashen Isle. [US-64]
- [ ] Continue label font size is at least 1.5× the New Game label font size on desktop (verified: source read of the two `fontSize` strings; visual screenshot at 1280×720) — encodes the "Continue is the default when a save exists" design direction as a measurable target. [US-64]

### Structural — reset mechanism (US-65)

- [ ] TitleScene "Reset Progress" click wipes flags AND save together via `resetWorld()` from `saveState.ts` (verified: source read; manual: set a flag in DevTools, set a save, click reset, both gone) [US-65]
- [ ] On Reset confirmation, the "Continue" label is removed (or the layout re-runs in the no-save state) on the same frame so the player doesn't see a stale Continue button while the "Progress Reset!" confirmation is up (verified: source read + screenshot before/after) [US-65]
- [ ] `?reset=1` URL query param triggers a one-shot wipe in `TitleScene.init()` or `create()` BEFORE `hasSave()` is consulted; the Title renders in the no-save state on the same frame (verified: source read + manual via `http://localhost:5173/?reset=1`) [US-65]
- [ ] After `?reset=1`, `history.replaceState` removes the query param so a manual refresh does not re-trigger the wipe (verified: source read; manual: load the URL, observe the URL cleans, refresh, no second wipe log) [US-65]
- [ ] `?clearSave=1` URL query param wipes ONLY the save; flags remain intact (verified: manually set `oldman_greeted: true` flag, save a position, load `?clearSave=1`, observe Continue absent and the flag still present in DevTools) [US-65]
- [ ] `resetWorld()` exported from `saveState.ts` calls `clearSave()` THEN `resetAllFlags()` in that order (verified: source read of the sequence) [US-65]
- [ ] `resetWorld` re-exported from `triggers/flags.ts` for backward import compat at the call site — existing `resetAllFlags` consumers still work without import edits (verified: source read of the re-export AND that the existing `TitleScene` reset-progress import line did not need to change) [US-65]
- [ ] AGENTS.md "Controls" (or new "Dev / testing" subsection) documents `?reset=1` and `?clearSave=1` (verified: source read of AGENTS.md after build-loop reconciliation) [US-65]
- [ ] `docs/plan/save-resume-manual-verify.md` exists with the full checklist enumerated in US-65 acceptance criteria (verified: file present + grep for each named scenario) [US-65]

### Behavior — resume correctness (US-63 + US-64)

- [ ] **Ashen Isle resume**: walk the player from the cottage gate to a distinct, identifiable position (e.g. east of the path next to the Old Man's fence). Force-close the tab. Reopen. Tap Continue. Player appears within `SAVE_THROTTLE_MS / 2` worth of pixel distance (i.e. half a second of walked distance, ~32 px) of where they were when the tab closed. Camera follows. No double-fade. No console errors. (verified: manual-verify checklist) [US-63, US-64]
- [ ] **Fog Marsh resume**: same protocol on Fog Marsh's dry path. Player resumes on Fog Marsh, on the path, near the prior position. (verified: manual) [US-63, US-64]
- [ ] **Mid-transition resume**: walk to Ashen Isle's dock. Cross. While the fade-out + fade-in is in progress, force-close the tab. Reopen. Tap Continue. Player lands on Fog Marsh's entry tile (the destination flush from the transition write), NOT on Ashen Isle's exit-zone tile (which would re-fire the transition on entry). (verified: manual) [US-63]
- [ ] **Mid-dialogue resume**: open Old Man dialogue. Mid-conversation, force-close the tab. Reopen. Tap Continue. The dialogue is closed (we did not save dialogue state). The player is on the world layer at the position of the most recent walk-frame autosave (i.e. roughly where they were when they pressed Space, since dialogue freezes movement). Flags committed before the close are still set. (verified: manual) [US-63, US-64]
- [ ] **New Game wipes save**: with a save present from the resume tests above, return to Title (refresh page). Tap "New Game." Player lands on Ashen Isle's `playerSpawn`. Refresh page → "Continue" is absent (save was wiped at the New Game click). (verified: manual) [US-64]

### Class baseline — autosave parity across save trigger points

The save module joins the class of "world-state writers" that already includes `flags.ts`. Every shared behaviour is verified explicitly:

- [ ] Both modules use `try/catch` around `localStorage` reads AND writes (verified: source read of both modules) [US-62]
- [ ] Both modules log on failure exactly once per session (not on every call) — `flags.ts` may not currently log; if so, US-62 brings parity by adding a once-per-session warn for write failures (verified: source read) [US-62]
- [ ] Both modules' `reset` paths are idempotent (verified: calling `resetAllFlags()` twice in a row + `clearSave()` twice in a row neither throw nor produce duplicate logs) [US-62]

### Variant baseline — every save trigger point fires for every area

The autosave write path has three trigger points (throttled walk, transition flush, dialogue/story close) and the game has two areas. Per-area verification per trigger:

- [ ] **Ashen Isle, throttled walk**: walking continuously updates the save within ≤ 1 s of any position change (verified by polling DevTools localStorage during walk) [US-63]
- [ ] **Ashen Isle, transition flush**: stepping into the dock writes a save with `areaId: 'fog-marsh'` and the destination entry-pixel position BEFORE the scene restart (verified by checking DevTools localStorage during the fade-out) [US-63]
- [ ] **Ashen Isle, dialogue close flush**: closing Old Man dialogue writes a save with the post-dialogue player position (verified by polling DevTools localStorage on dialogue close) [US-63]
- [ ] **Fog Marsh, throttled walk**: same protocol on Fog Marsh [US-63]
- [ ] **Fog Marsh, transition flush**: stepping into the door writes a save with `areaId: 'ashen-isle'` and the Ashen Isle entry-pixel position [US-63]
- [ ] **Fog Marsh, dialogue close flush**: closing Marsh Hermit dialogue writes a save with the post-dialogue position [US-63]
- [ ] **Fog Marsh, StoryScene close flush** (Whispering Stones triggers a story scene): closing the StoryScene writes a save with the post-story player position (verified by polling DevTools localStorage on StoryScene close) [US-63]

### Variant baseline — every reset mechanism wipes both stores when intended

- [ ] **Reset Progress button**: wipes flags AND save together (verified manually) [US-65]
- [ ] **`?reset=1` URL param**: wipes flags AND save together; URL cleans (verified manually) [US-65]
- [ ] **`?clearSave=1` URL param**: wipes save ONLY; flags persist (verified manually) [US-65]
- [ ] **New Game button**: wipes flags AND save together (same call path as Reset; verified manually) [US-64, US-65]

### Behavior — reads-as

Each reads-as is paired with an objective mechanism proxy.

- [ ] **"Continue" reads-as "the game remembers me"**: a first-time observer (someone who played a session, closed the tab, and returned without prior knowledge of save/load) given the question "what does Continue do?" answers "it picks up where I left off" — NOT "it just starts the game" or "I don't know." (verified via the manual-verify observer note) [US-64]
- [ ] **Continue mechanism proxy**: tap → `loadSave()` returns the stored payload → `scene.start('GameScene', { areaId, resumePosition })` → `createPlayer()` uses `resumePosition`. Verified by source read of the call sequence. [US-64]
- [ ] **"Reset Progress" reads-as "I am wiped"**: a first-time observer who clicks Reset Progress and then refreshes can describe the state as "fresh start, like I never played" — NOT "I think it kept some things." (verified via observer note) [US-65]
- [ ] **Reset mechanism proxy**: click → `resetWorld()` → `clearSave()` + `resetAllFlags()` both fire → `hasSave()` returns false → Title re-layouts to no-save state. Verified by source read. [US-65]

### Error paths

- [ ] **Corrupt JSON in localStorage** (`emberpath_save = "not json"`): on Title boot, `hasSave()` returns false, the entry is removed from localStorage, exactly one `console.warn` fires, no crash (verified manually) [US-62]
- [ ] **Tampered shape** (`emberpath_save = '{"version":1,"areaId":"nonexistent","position":{"x":0,"y":0}}'`): on Title boot, `hasSave()` returns false, the entry is removed, exactly one warn fires (verified manually) [US-62]
- [ ] **Wrong version** (`emberpath_save = '{"version":2,...}'`): same handling — null-treated and cleared (verified manually) [US-62]
- [ ] **Continue with stale `areaId`** (e.g. saved on `'old-name'` after an area rename): tapping Continue triggers fallback to a fresh start; first click is responsive (verified manually) [US-64]
- [ ] **localStorage unavailable / blocked** (Safari private mode iframe sandbox): the game runs end-to-end without crash; Continue stays absent across reloads; exactly one warn fires per session for save-write failure (verified in iOS Safari private tab) [US-62]
- [ ] **Quota exceeded** (localStorage stuffed > 5 MB by a co-resident origin): same handling as private mode — game runs, single warn, Continue may stay absent (verified by manual quota stuffing) [US-62]
- [ ] **`?reset=1` and `?clearSave=1` together**: the wipe is total (both clear), URL cleans both params (verified manually) [US-65]

### Editor sync

- [ ] `tools/editor/` is unaffected by this phase (the editor reads area definitions, not save state). `cd tools/editor && npm run build` passes after `AreaDefinition.id` is added. (verified) [US-63]

### Aesthetic traceability

- [ ] **"Invisible when it works"** (design direction) traces to: zero new HUD elements; only Title labels change; in-game frame has zero per-frame localStorage work on idle frames (loop-invariant audit). [phase]
- [ ] **"Continue is the default when a save exists"** (design direction) traces to: Title layout branch on `hasSave()`; primary visual weight on Continue; New Game smaller. [US-64]
- [ ] **"Reset is one click and atomic"** (design direction) traces to: `resetWorld()` calls `clearSave` + `resetAllFlags` synchronously; Continue button removal is on the same frame as reset confirmation. [US-65]
- [ ] **"Failures degrade gracefully"** (design direction) traces to: every error-path criterion above; once-per-session warn flag in saveState. [US-62]

### Invariants

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

## Golden principles (phase-relevant)

- **Parameterized systems:** `saveState.ts` is engine-agnostic — it does not import Phaser, does not reach into `GameScene`, does not know area names beyond consulting the registry. Two consumers (TitleScene reads, GameScene writes); every other call site is a violation.
- **No silent breaking changes:** `version: 1` on the save payload from day one. A future `version: 2` change must update the load path's switch arm, not retroactively interpret v1 saves as a different shape. `resetAllFlags` keeps its exported name; the new `clearSave()` call inside it is additive.
- **From LEARNINGS EP-01 (loop invariants):** autosave must not call `JSON.stringify` or `setItem` per frame. The throttle + position-delta guard fires BEFORE any IO; idle frames cost zero. Mirror the props/decoration "create once" pattern, applied here as "write at most once per second + only when something changed."
- **From LEARNINGS #57 (depth-map authority):** no new visual layers; this phase touches no depths.
- **Zone-level mutual exclusion (LEARNINGS #56):** autosave is suppressed during dialogue, StoryScene, and transitions — same exclusion zones already in force for movement and triggers. The flush-on-close paths re-arm autosave the moment the exclusion lifts.
- **Invisible when it works:** UI surface is exactly two Title labels and one existing Reset link. No "saving..." indicator, no save slot manager, no toast. Failures log once and degrade silently — the game stays playable.

## Out of scope

- Mid-dialogue resume (saving + restoring active dialogue node, typewriter offset, choice-row state). Deferred.
- Mid-StoryScene resume (saving + restoring beat index, fade state). Deferred.
- Multiple save slots / named saves. One implicit slot per browser is the entire scope.
- Save migration (v1 → v2). Future phases that change the schema own their own migration paths; this phase only commits to the v1 schema.
- Cloud save / cross-device sync. localStorage only.
- "Last played" timestamps, screenshots, or any save metadata beyond `{ version, areaId, position }`.
- A debug menu UI. URL params are the testing surface.
- Confirmation dialog on "New Game" / "Reset Progress." This is a kid's game; clicking Continue or New Game must be one tap. The 1.5 s "Progress Reset!" toast is the only feedback for reset.
- In-game pause menu / return-to-Title affordance. Today, refreshing the tab is the only path back to Title from in-game. This is acceptable for the POC; a dedicated `pause-menu` phase will own the in-game surface (pause button → modal with Resume / Return to Title / Reset). The save infrastructure built here is what that phase will consume.

## AGENTS.md sections affected

When this phase ships, the Phase Reconciliation Gate will update:
- **Directory layout** — add `src/triggers/saveState.ts`; add `docs/plan/save-resume-manual-verify.md`.
- **File ownership** — new row for `triggers/saveState.ts`; updated rows for `triggers/flags.ts` (now clears save via `resetAllFlags`), `scenes/TitleScene.ts` (Continue/New Game; URL-param reset), `scenes/GameScene.ts` (`maybeAutosave`, transition flush, dialogue/story close flush, `resumePosition` boot field), `data/areas/types.ts` (`AreaDefinition.id`).
- **Behavior rules** — new "Save / resume" entry covering schema, throttle constants, three write triggers, atomic reset semantics, Continue precedence rule (`entryPoint` wins over `resumePosition`), URL-param reset behaviour.
- **Controls** — new "Dev / testing" subsection covering `?reset=1` and `?clearSave=1`.
- **Depth map** — no change.
- **Scaling tuning guide** — no change.
