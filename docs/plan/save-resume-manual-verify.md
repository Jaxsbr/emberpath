# Manual verification — save-resume

Runtime + observer criteria from `docs/plan/phase-goal.md` that cannot be
satisfied by source-read alone. Each checkbox traces back to one done-when
criterion and is intended to be ticked by a human reviewer (Jaco) after
merge, in the order below.

## Setup

```bash
npm install
npm run dev      # game at http://localhost:5173
```

Use Chrome DevTools → Application → Local Storage to inspect / mutate the
two relevant keys directly:

- `emberpath_flags` — flag store (existing; pre-save-resume contract)
- `emberpath_save` — world save (new this phase)

The game tab is the only consumer of either key on the deployed origin.

---

## Reads-as observer tests

Show the page to a first-time observer (a fresh pair of eyes; ideally a
kid in the 6-12yo target audience, but any non-developer works). Answer
no questions; let them read the screen.

### "Continue" reads-as "the game remembers me" [US-64]

Setup: walk through one full session (boot, walk to Old Man, finish his
dialogue, cross to Fog Marsh, take a few steps on the path), then close
the tab. Reopen and show the Title screen.

Ask: **"What does Continue do?"**

- [ ] Observer answers along the lines of "it picks up where I left off"
      / "carries on" / "goes back to where I was". (Pass.)
- [ ] Observer does NOT answer "starts a new game" / "starts the game"
      / "I don't know". (Fail = re-evaluate Continue label clarity.)

### "Reset Progress" reads-as "I am wiped" [US-65]

After the observer taps Continue and plays for a minute, refresh to the
Title and ask them to tap "Reset Progress". Then refresh once more.

Ask: **"What state are we in now? Have we played before?"**

- [ ] Observer answers "fresh start" / "like never played" / "everything
      is gone". (Pass.)
- [ ] Observer does NOT answer "I think it kept some things" /
      "halfway done". (Fail = re-evaluate reset confirmation clarity.)

---

## Per-area resume — autosave correctness

### Ashen Isle resume [US-63, US-64]

- [ ] **Throttled walk**: From a fresh New Game, walk the player east
      from spawn for at least 3 seconds. Open DevTools → Application →
      Local Storage → `emberpath_save`; confirm the entry exists and
      `position` updates as the player walks (poll every second).
- [ ] **Transition flush**: Walk to Ashen Isle's dock (south end). Just
      before the fade starts, observe `emberpath_save`. Step onto the
      dock; immediately observe `emberpath_save` shows
      `areaId: 'fog-marsh'` AND a position consistent with Fog Marsh's
      entry tile (NOT Ashen Isle coords). The flush fires synchronously
      before scene.restart.
- [ ] **Dialogue close flush**: Walk to the Old Man, tap Space to start
      dialogue, advance through to the natural close. The save's
      `position` updates to the player's location at dialogue close
      (within ~SAVE_THROTTLE_MS / 2 of the moment Space committed the
      last advance).
- [ ] **Resume**: Walk the player to a distinct, identifiable position
      (e.g. east of the Old Man's fence). Force-close the tab via the
      tab's X button. Reopen; tap Continue. Player resumes within ~32 px
      of the prior position. No double-fade, no console errors, camera
      follows the player.

### Fog Marsh resume [US-63, US-64]

- [ ] **Throttled walk**: From Fog Marsh's entry tile, walk along the
      dry path. `emberpath_save.areaId === 'fog-marsh'`; position
      updates with each second of walking.
- [ ] **Transition flush**: Step onto Fog Marsh's exit door. Observe
      `emberpath_save` immediately shows `areaId: 'ashen-isle'` and the
      Ashen Isle entry-pixel position.
- [ ] **Dialogue close flush**: Talk to the Marsh Hermit; advance to
      the dialogue's natural close. Save updates to the post-dialogue
      position.
- [ ] **StoryScene close flush**: Walk onto the Whispering Stones
      trigger; advance through the StoryScene to its close. Back on the
      Fog Marsh world layer, `emberpath_save.position` matches the
      player's position at the StoryScene close.
- [ ] **Resume**: Walk to a distinct position on Fog Marsh's dry path;
      force-close the tab; reopen and Continue. Player resumes on Fog
      Marsh near the prior position.

---

## Mid-edge cases

- [ ] **Mid-transition close [US-63]**: Walk to Ashen Isle's dock.
      Step onto the dock; while the fade-out is in progress (the screen
      is darkening), force-close the tab. Reopen and Continue. Player
      lands on **Fog Marsh's entry tile**, NOT on Ashen Isle's exit-zone
      tile (which would re-fire the transition on entry).
- [ ] **Mid-dialogue close [US-63, US-64]**: Walk to the Old Man; tap
      Space to open the dialogue. Mid-conversation, force-close the
      tab. Reopen and Continue. The dialogue is closed (we did not save
      mid-dialogue state). The player is on the world layer at the
      position of the most recent walk-frame autosave (i.e. roughly
      where they were when they pressed Space).
- [ ] **New Game wipes save [US-64, US-65]**: With a save present,
      return to the Title (refresh page). Tap "New Game". Player lands
      on Ashen Isle's `playerSpawn`. Refresh page → Title shows only
      "New Game" (no Continue). Confirm `emberpath_save` is absent in
      Local Storage.

---

## Reset mechanism

- [ ] **Reset Progress button [US-62, US-65]**: With a save and at
      least one set flag (e.g. talk to the Old Man so `oldman_greeted`
      is true). Tap "Reset Progress". The "Progress Reset!" toast
      shows for 1.5s; on the same frame the Continue label disappears
      (replaced by a single primary "New Game"). Both `emberpath_flags`
      and `emberpath_save` are absent in Local Storage.
- [ ] **`?reset=1` URL param [US-65]**: Visit
      `http://localhost:5173/?reset=1`. The Title renders in the
      no-save state on first paint. The URL bar updates to drop
      `?reset=1`. A single `console.info` line names the wipe. Refresh
      → no second wipe log fires (URL is already clean). Both
      Local Storage keys are absent.
- [ ] **`?clearSave=1` URL param [US-65]**: Set up a save AND a flag
      (talk to the Old Man, then walk a bit). Visit
      `http://localhost:5173/?clearSave=1`. Title renders no-save state.
      Local Storage: `emberpath_save` absent; `emberpath_flags` STILL
      contains `oldman_greeted: true`. Single info log.
- [ ] **Both params together [US-65]**: Visit
      `http://localhost:5173/?reset=1&clearSave=1`. Both wipes fire;
      both info lines log; URL cleans both params; Local Storage
      empty.

---

## Error paths

DevTools → Application → Local Storage → `emberpath_save`:

- [ ] **Corrupt JSON [US-62]**: Set `emberpath_save` to `not json`.
      Reload Title. Continue is absent (no crash). One `console.warn`
      naming the parse error fires. The corrupted entry is removed
      from Local Storage.
- [ ] **Tampered shape [US-62]**: Set `emberpath_save` to
      `{"version":1,"areaId":"nonexistent","position":{"x":0,"y":0}}`.
      Reload. Continue is absent. One warn fires. Entry removed.
- [ ] **Wrong version [US-62]**: Set `emberpath_save` to
      `{"version":2,"areaId":"ashen-isle","position":{"x":50,"y":50}}`.
      Reload. Continue is absent. One warn fires. Entry removed.
- [ ] **Continue with stale `areaId` [US-64]**: Same as Tampered shape;
      verify the first tap on Continue (after the validation in the
      Continue handler) starts a fresh GameScene cleanly — no second
      tap needed.
- [ ] **Out-of-bounds position [US-64]**: Set `emberpath_save` to
      `{"version":1,"areaId":"ashen-isle","position":{"x":99999,"y":99999}}`.
      Reload. Validation in TitleScene.handleContinue clears the save
      and starts a fresh GameScene; warn names the bounds failure.
- [ ] **WALL-tile position [US-64]**: Find a known WALL tile on Ashen
      Isle (any cell in `ashen-isle.ts` map where the value is `WALL`,
      e.g. one of the perimeter walls). Compute its pixel coords
      (`col * TILE_SIZE`, `row * TILE_SIZE`). Set `emberpath_save` to
      that position. Reload. Continue → fresh start; warn names the
      WALL-tile failure.
- [ ] **Private mode [US-62]**: In iOS Safari private tab (or an
      iframe with localStorage blocked), play a normal session. Game
      runs end-to-end without crash. Continue stays absent across
      reloads. Exactly one warn fires per session for save-write
      failure (subsequent writes are silenced by the
      `writeFailureLogged` flag).
- [ ] **Quota exceeded [US-62]**: In a regular tab, fill Local Storage
      to >5MB (e.g. paste a long string into another key several
      times). Trigger an autosave (walk a few steps). One warn fires;
      the game continues to play.

---

## Deploy smoke (Learning #65)

After the squash-merge to `main` and the GitHub Pages deploy completes:

- [ ] Open `https://jaxsbr.github.io/emberpath/`. Tap "New Game". Walk
      at least 100 px (any direction). Refresh the page. Continue is
      present at the top of the Title. Tap Continue. Player resumes at
      the prior position. — confirms localStorage works on the deployed
      origin (different from `localhost:5173`).
