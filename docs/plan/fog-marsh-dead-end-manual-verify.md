# Manual verification — fog-marsh-dead-end

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
flag store directly:

- `emberpath_flags` — flag store; entries this phase introduces are
  `marsh_trapped` (boolean) and `escape_attempts` (number).
- `emberpath_save` — world save (consumed by save-resume; this phase relies on
  it for resume parity but does not write to it directly).

---

## Threshold (US-66)

1. **New Game** on Title. Player spawns on Ashen Isle.
2. Walk to the dock and transition into Fog Marsh. (Ashen Isle's `exit-to-fog`
   has no `condition` — should fire unconditionally as today.)
3. Once on Fog Marsh, walk north up the dry path past the Marsh Hermit at
   `(col 24, row 10)` and continue north along the path.
4. As the player crosses `(col 14, row 5)` (or `row 6`, given the band is
   `height: 2`), the **threshold trigger** fires:
   - Thought bubble: **"The fog rolls in behind me. The path is gone."**
   - DevTools → `emberpath_flags` now contains `marsh_trapped: true`.
5. Walking back south across the same band does NOT re-fire (one-shot —
   `repeatable: false` + `_trigger_fired_marsh-deepens` flag set).
6. Force-close the tab. Reopen. Tap **Continue** on Title. The save-resume
   layer brings the player back to the position they were at; `marsh_trapped`
   stays `true` (existing localStorage persistence).

**Variant baseline (regression):** the older `fog-entry-thought` trigger at
`(13, 18)` still fires its original thought ("The air is thick here…") on
first entry. It does NOT set `marsh_trapped` as a side effect — only
`marsh-deepens` carries `setFlags`.

---

## Exit closure (US-67)

With `marsh_trapped: true` from the threshold:

1. Walk back south on the dry path. The exit cells at row 22 cols 13-16 used
   to transition to Ashen Isle.
2. Walk into row 22 cols 13-16: collision is **identical to any wall** — the
   player stops at row 21 col edges; no fade, no transition, no console error.
3. Confirm the editor still shows the conditional exit: `cd tools/editor && npm run dev`,
   load Fog Marsh, the `flowRenderer` view labels the south exit
   `[marsh_trapped == false]`.

**Fresh-game regression:** open a new incognito tab → go to the game URL →
do NOT cross the threshold; instead, walk south straight to the south exit on
Fog Marsh (e.g. via the `?reset=1` URL param, then transitioning normally
into Fog Marsh). The exit fires and transitions back to Ashen Isle as today.

**Class-baseline regression:** Ashen Isle's `exit-to-fog` exit (no `condition`)
still fires unconditionally — verifiable by walking to the dock from a fresh
game.

---

## Visual closure (US-68)

1. **Before** the threshold fires: walk south to row 22 cols 13-16 — the four
   cells render as **PATH plank frames** (PATH_A / PATH_B alternating).
2. **Cross** the threshold at `(14, 5)`.
3. Walk back south. The **same four cells** now render as **EDGE deep-water
   frames** (EDGE_A / EDGE_B / EDGE_C cycling). The swap fires on the same
   frame as the collision flip — no fade, no flicker.
4. Force-close the tab. Reopen. Tap **Continue**. The EDGE frames are still
   visible at row 22 cols 13-16; `marsh_trapped: true` persists; collision
   stays as wall.

**Variant baseline:** Ashen Isle has no conditional decorations — visually
identical to the pre-phase baseline at New Game spawn.

---

## Escape attempts (US-69)

With `marsh_trapped: true`:

1. Walk south to row 21 cols 13-16 (the band one tile north of the now-walled
   south exit).
2. Walk north out of the band (e.g. up to row 20). Walk back south into the
   band. **Each entry fires a thought**:
   - 1st + 2nd entries (`escape_attempts` 0 → 1 → 2 mid-fire): **"The fog has
     swallowed the way back."**
   - 3rd + 4th entries (`escape_attempts` 2 → 3 → 4 mid-fire): **"I tried
     this path. It's gone."**
   - 5th entry onwards (`escape_attempts >= 4`): **"I cannot do this alone."**
3. Note: the band condition is evaluated BEFORE `incrementFlags` fires, so
   the boundary is "just-entered count": entry 1 sees `escape_attempts < 2`
   (true), increments to 1; entry 2 sees `escape_attempts < 2` (true at value
   1), increments to 2; entry 3 sees `escape_attempts >= 2 && < 4`,
   increments to 3; entry 4 sees the same band, increments to 4; entry 5 sees
   `escape_attempts >= 4`. So the despair thought fires on the 5th entry —
   matches the spec's "After 4 distinct entries, escape_attempts >= 4 AND the
   despair thought has fired at least once" (i.e. on the next entry after 4).
4. Standing still on the band does NOT infinite-fire — confirm by holding
   position; only one thought per entry (existing repeatable trigger
   semantics: exit and re-enter to re-fire).

**Tampered counter:** in DevTools, edit `emberpath_flags` to set
`escape_attempts: 99`. Reload. Walk into the band — only the despair thought
fires (mutual exclusion holds; `>= 4` is the only matching condition).

---

## Tampered flag (US-67 + US-68)

1. Open a fresh incognito tab. Visit the game URL.
2. **Before** Title boots, in DevTools → Application → Local Storage, set
   `emberpath_flags` to `{"marsh_trapped":true}`.
3. New Game on Title (or transition into Fog Marsh from Ashen Isle).
4. On Fog Marsh load: the south exit cells are already wall (collision
   blocks), and the EDGE decoration is rendered. The threshold trigger has
   NOT fired this session — but the trap state is restored from the flag.
5. No console errors.

---

## Reset Progress while trapped (save-resume integration)

1. With `marsh_trapped: true` in flags (from a real playthrough or DevTools
   tamper), open Title and click **Reset Progress**.
2. Confirm: `marsh_trapped` AND `escape_attempts` AND `_trigger_fired_*` all
   wiped from `emberpath_flags`. The save (`emberpath_save`) is wiped too
   (atomic reset per save-resume).
3. Continue label disappears on the same frame as the "Progress Reset!"
   confirmation.
4. New Game on Title → walk into Fog Marsh — the south exit is open, PATH
   decorations render, no console errors.

The same applies to `?reset=1` URL param.

---

## Full sequence (the trap closes)

This is the canonical 90-second playthrough that exercises every story:

1. **New Game** on Ashen Isle.
2. Walk to Old Man, full dialogue (sets `oldman_greeted` etc.).
3. Walk to dock; transition to Fog Marsh.
4. Walk to Marsh Hermit; full dialogue ending at the "only deeper" line
   (sets `spoke_to_marsh_hermit`).
5. Walk north past the hermit to row 5 — threshold fires.
6. Walk south. Bump the wall at row 22 cols 13-16 — collision blocks.
7. At row 21, walk north out and south back in ≥ 4 times. Read each
   escalation thought.
8. Force-close the tab. Reopen. Tap **Continue**. Confirm: same area, same
   approximate position, EDGE decorations on row 22, wall collision still
   blocking, `marsh_trapped: true` and `escape_attempts >= 4` both
   restored.
9. **No console errors** during the entire 90 seconds.

---

## Reads-as observer notes

After running through the sequence above, briefly write down (in this doc
inline, in a "Reviewer notes" subsection below) what each beat felt like:

- Watching the threshold fire and seeing the EDGE swap — does the south exit
  read as "no longer walkable; the marsh is too deep there now"?
- After 4+ bumps and the despair thought — does the player's situation read
  as "stuck, no way out, doesn't know what to do"?

If either reads as "I think it's a UI bug" or "I think the path is hidden,"
the design direction failed and the phase needs follow-up.

### Reviewer notes (Jaco)

_Add observer notes here after the 90-second playthrough._

---

## Deploy smoke (post-merge)

After the squash-merge to `main`:

1. Wait for the GitHub Pages deploy workflow to finish (green check on the
   merge commit).
2. Open `https://jaxsbr.github.io/emberpath/` in a fresh incognito tab.
3. Run through the full sequence above, with the additional check that the
   trap state survives a refresh on the deployed origin (different from
   `localhost:5173`) — confirms localStorage flag persistence works there too.
