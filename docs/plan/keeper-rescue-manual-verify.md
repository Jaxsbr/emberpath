# keeper-rescue — manual verification

Walk-throughs that exercise the runtime behavior the build-loop's source-read tick can't observe directly: 8-direction overlay tracking, story scene fade, save-resume mid-cycle, mobile vs desktop input. Run after merging to `main` or before signing off the phase locally.

Format mirrors `fog-marsh-dead-end-manual-verify.md`: each scenario is a numbered walkthrough; record observations inline (PASS / FAIL with notes). The 6-row variant baseline grid at the end exercises every Continue + surface combination.

---

## 1. Full-arc playthrough (US-70/71/72/73 + Phase 1 in reverse)

**Goal.** Confirm the entire rescue arc: New Game → trap → Keeper appears → rescue → exit re-opens → ember persists.

**Steps.**
1. From `localhost:5173`, click **Reset Progress** if visible to clear any prior save (the URL `?reset=1` flag also works).
2. Click **New Game** on the title screen. Pip should spawn on Ashen Isle.
3. Walk south to the dock, step into the south-east exit zone — fade to Fog Marsh, Pip lands at `(14, 12)` mid-marsh.
4. Walk north past the Marsh Hermit to row 5, col 14. The threshold trigger fires: thought "The fog rolls in behind me. The path is gone." `marsh_trapped: true`. **Confirm:** the south-exit cells (row 22 cols 13-16) flip to EDGE-style decorations on the same frame.
5. Walk south to the closed exit (row 21-22). Bumping against the wall fires the first thought "The fog has swallowed the way back." (`escape_attempts: 1`). Bump 3 more times to escalate through the bands — thoughts 2 and 3, then "I cannot do this alone." on the 4th bump (`escape_attempts: 4`).
6. **Confirm:** within one frame of `escape_attempts` reaching 4, the Keeper fades in at `(col 14, row 8)` over 500ms. Player input is suspended for ~1000ms. The Keeper renders the heron sprite (white, painterly) at depth 5.
7. Walk up to the Keeper. The interaction prompt appears (Space on desktop / "Tap to talk" on mobile).
8. Press Space / tap. The dialogue opens with the Keeper's portrait (linear filter — no nearest-neighbor mush). Two nodes: greeting → action.
9. Advance past both nodes. **Confirm:** when the action node displays, `has_ember_mark`, `keeper_met` flip true and `marsh_trapped` flips false **on the same frame the typewriter starts** (read browser DevTools → Application → Local Storage → `emberpath_flags`). The ember overlay appears above Pip mid-dialogue.
10. Close the dialogue. **Confirm:** the `ember-given` story scene launches (3 beats: warm gold → ember → dawn). Each beat is a tap to advance.
11. Story scene closes; control returns to Fog Marsh. **Confirm:** the south-exit decorations flip back to PATH and the cells are FLOOR (walkable).
12. Walk south through row 22 cols 13-16 — the `fog-to-ashen` exit fires. Fade to Ashen Isle.
13. **Confirm:** ember overlay is still visible above Pip in Ashen Isle (depth 5.5, warm gold disc above his head).

**PASS / FAIL:** _____

---

## 2. Save / resume parity (US-72 atomic flush + US-73 overlay re-render)

**Goal.** Force-close mid-rescue and confirm the world state restores correctly via Continue.

**Steps.**
1. Run scenario 1 up to step 10 (story scene closes).
2. Force-close the tab without further interaction.
3. Reopen `localhost:5173`. **Confirm:** the title screen shows **Continue** (not just New Game) — `hasSave()` is true.
4. Tap **Continue**. Pip resumes in Fog Marsh just south of the Keeper's spawn position.
5. **Confirm via DevTools:** `emberpath_flags` contains `has_ember_mark: true`, `keeper_met: true`, `marsh_trapped: false`, `escape_attempts: 4`.
6. **Confirm visually:** the ember overlay re-renders above Pip on the same frame as Continue.
7. **Confirm:** the south exit at row 22 cols 13-16 is walkable (FLOOR collision); decorations show PATH frames.
8. **Confirm:** the Keeper does NOT respawn. The `spawnCondition` third clause `keeper_met == false` is now false, so `evaluateConditionalSpawns` skips on every flag-change re-evaluation.
9. Walk south to exit — fade to Ashen Isle. Ember persists.

**PASS / FAIL:** _____

---

## 3. Reset parity (US-72 + US-73 reset cleanup)

**Goal.** Reset Progress wipes the rescue state atomically and the ember disappears on the same frame.

**Steps.**
1. Run scenario 1 to completion (post-rescue, ember overlay rendered on Ashen Isle).
2. Press the title-screen **Reset Progress** button (or run scenario 1 step 1 reset URL).
3. **Confirm:** `emberpath_flags` is empty (all five flags wiped: `has_ember_mark`, `keeper_met`, `marsh_trapped`, `escape_attempts`, `spoke_to_marsh_hermit`). World save is also cleared (`emberpath_save` is gone).
4. **Confirm visually:** the ember overlay is destroyed on the same frame as the reset (the `onFlagChange('has_ember_mark')` callback receives `undefined` and tears the overlay down).
5. Tap **New Game** — Pip spawns on Ashen Isle, no ember overlay.
6. Walk into Fog Marsh. **Confirm:** Marsh Hermit is interactable as before; Keeper is not present (spawnCondition fails — `marsh_trapped` is undefined).

**PASS / FAIL:** _____

---

## 4. Keeper one-shot guard

**Goal.** After the rescue, returning to Fog Marsh from Ashen Isle does NOT respawn the Keeper.

**Steps.**
1. Complete scenario 1 (ember overlay visible, Pip on Ashen Isle).
2. Walk back north to the dock and into the Fog Marsh exit. Fade to Fog Marsh.
3. **Confirm:** Keeper does NOT appear at `(14, 8)`. The spawnCondition `marsh_trapped == true AND escape_attempts >= 4 AND keeper_met == false` fails on the third clause.
4. **Confirm:** Marsh Hermit still spawns and is interactable.
5. **Confirm:** the south-exit cells are walkable (since `marsh_trapped: false`).

**PASS / FAIL:** _____

---

## 5. Class baseline (US-71 NPC behavior parity)

**Goal.** Keeper inherits the shared NPC behaviors uniformly with Marsh Hermit / Old Man.

**Steps.**
1. Run scenario 1 up to step 6 (Keeper has spawned; Pip mid-marsh).
2. Approach the Keeper from below (south).
3. **Confirm (a):** Keeper renders the `npc-heron-idle-south` animation at 8 fps.
4. **Confirm (b):** Keeper does NOT wander — he stays anchored at `(14, 8)` regardless of how long you wait.
5. **Confirm (c):** when Pip enters within 2 tiles (`awarenessRadius: 2`), the Keeper's static texture flips to face Pip's direction; the `lastStaticDir` guard means setTexture only fires on direction changes (no per-frame texture churn — verify by adding a console log temporarily during dev).
6. **Confirm (d):** the standard NPC interaction prompt raises (depth 150) when Pip is within 1.5 tile.
7. **Confirm (e):** pressing Space / tapping commits the dialogue: Keeper enters dialogue state, animation stops, static face-Pip texture is held.
8. **Confirm (f):** the portrait renders with `linear` filter — visually compare to the Old Man's portrait (also linear). Pixel-art look should NOT be applied (no nearest-neighbor mush).
9. **Confirm (g):** Pip's bounding box collides with the Keeper's bounds — try walking through the Keeper, Pip stops.

**PASS / FAIL:** _____

---

## 6. Tampered counter (US-71 idempotency + spawn condition robustness)

**Goal.** Manually setting flags via DevTools doesn't crash GameScene; the spawn pass is safely re-entrant.

**Steps.**
1. Reset Progress, walk into Fog Marsh.
2. Open DevTools console.
3. Run: `localStorage.setItem('emberpath_flags', JSON.stringify({ marsh_trapped: true, escape_attempts: 5 }))`. Refresh.
4. **Confirm:** Keeper appears on direct-load (the spawnCondition is true at scene create — first-pass filter passes). Marsh Hermit still also spawns.
5. Run: `localStorage.setItem('emberpath_flags', JSON.stringify({ marsh_trapped: true, escape_attempts: 5, keeper_met: true }))`. Refresh.
6. **Confirm:** Keeper does NOT appear (third clause `keeper_met == false` is false).
7. Test idempotency: in DevTools, while in Fog Marsh fresh after Reset, walk past the threshold (sets `marsh_trapped: true`), then in console run `setFlag('escape_attempts', 5)` directly. The flag-change subscriber fires → `evaluateConditionalSpawns` runs → Keeper spawns once. Repeating the setFlag call results in no re-spawn (idempotency guard via `npcSpritesById.has`).

**PASS / FAIL:** _____

---

## 7. Variant baseline grid (six surface × continue combinations)

Each row exercises one combination of device and entry. Each cell verifies: Keeper spawn fires correctly, dialogue + portrait render, story scene fires, ember overlay renders, south exit re-opens.

| # | Surface | Entry | Spawn | Dialogue + portrait | Story scene | Ember overlay | South exit re-opens |
|---|---|---|---|---|---|---|---|
| 1 | Desktop | New Game | _____ | _____ | _____ | _____ | _____ |
| 2 | Desktop | Continue mid-Fog-Marsh (post-trap, pre-rescue) | _____ | _____ | _____ | _____ | _____ |
| 3 | Desktop | Continue post-rescue (on Ashen Isle) | _____ | _____ | _____ | _____ | _____ |
| 4 | Mobile (touch) | New Game | _____ | _____ | _____ | _____ | _____ |
| 5 | Mobile (touch) | Continue mid-Fog-Marsh | _____ | _____ | _____ | _____ | _____ |
| 6 | Mobile (touch) | Continue post-rescue | _____ | _____ | _____ | _____ | _____ |

**Notes for mobile rows.** Use Chrome DevTools rotate-to-landscape OR a real device. Joystick must show during walk; tap-to-talk must work; portrait sizing (PORTRAIT_MOBILE_WIDTH_FRACTION 0.22 of canvasWidth) must not overflow the viewport.

---

## 8. Atlas frame-pick verification

**Not applicable.** US-73's ember overlay is a `Phaser.GameObjects.Arc` (a runtime-drawn circle, color `0xf2c878`), not an atlas frame. The heron sprite frames in `assets/npc/heron/` are PixelLab-generated PNGs, not atlas-indexed.

If a future revision swaps the overlay for an atlas frame, run `python3 tools/atlas-preview.py assets/tilesets/<id>/tilemap.png /tmp/preview.png && open /tmp/preview.png` and visually verify the chosen frame BEFORE commit.

**PASS** (N/A — no atlas frame used).

---

## 9. Deploy verification

After this branch lands on `main`, the GitHub Pages workflow deploys to `https://jaxsbr.github.io/emberpath/`. Run scenario 1 end-to-end on the deployed build before signing off the phase. **Confirm:** no console errors, all assets load, the full arc completes without regression.

**PASS / FAIL (post-merge):** _____

---

## Appendix — observer notes (Jaco)

Anything observed during the walkthrough that wasn't captured by the criteria — visual glitches, timing concerns, unexpected behaviors, ideas for next phase. Free-form.

_____
