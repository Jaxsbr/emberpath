# briar-wilds — Manual Verify

Run after every code change in this phase. Fresh-tab verification: `?reset=1` (and the Reset Progress button) baselines world state.

If any step doesn't behave as described, record it in `docs/plan/briar-wilds-known-issues.md`. Phase cannot be marked complete until each gap is either fixed or explicitly deferred.

## Atlas frame-pick verification

This phase introduces a NEW PixelLab Wang tileset (`briar-wilds-floor-thorn`) and 3 new object kinds (`bramble-cluster`, `briar-dead-tree`, `twisted-root`). The atlas-frame-pick rule (Learning EP-03 — `visual-pick-without-verification`) applies. Verify each surface visually before relying on it in the build loop:

- [ ] Render a labeled-atlas preview for the briar-wilds tileset (via `tools/atlas-preview.py` OR `maps/atlasPreview.ts` browser path). Confirm each Wang mask `'0000'`..`'1111'` resolves to a frame that reads as expected (lower terrain = grey-green briar floor; upper = warm-sienna thorn / bramble; transitions blend cleanly without seams).
- [ ] Eyeball each object asset at game zoom: `bramble-cluster` reads as dense thorn pile, `briar-dead-tree` reads as a dry top-down tree, `twisted-root` reads as low ground-decoration roots.

Note (2026-05-04): the upper-tier thorn frames came back warmer-red than the spec's "no red" negative prompt intended; operator approved as-is on the basis that it reads as warm-sienna at 4× game zoom and fits the briar-wilds uneasy/oppressive vibe.

---

## § US-99 — Warmed-NPC visible brightening

Pre-conditions: play through to the Ember (Keeper rescue) AND warm Wren AND/OR Old Man via the Share-warmth dialogue choice.

### Wren

- [ ] Walk near Wren before warming (open a `?reset=1` session, then advance only as far as dialogue but choose "Not yet"). Note the NPC light radius — it reaches roughly 1 tile around her.
- [ ] Warm Wren. After the pulse lands, walk away and back. The light bubble is now clearly larger than baseline (≥1 tile wider) and the local area shows perceptibly more original colour than the surrounding desaturated world.

### Old Man

- [ ] Same observation, post-Wren: walk past Old Man before sharing — note baseline. Share warmth, return — bubble is visibly enlarged, colour blooms.

### Driftwood (negative)

- [ ] Refuse to share with Driftwood (`?reset=1`, advance, pick the polite-decline path that sets `npc_refused_driftwood`). Walk past Driftwood — NO brightening; he stays at his pre-warming light state.

### Persistence

- [ ] Warm Wren, then walk into Fog Marsh and return to Ashen Isle. Wren's bright bubble persists.
- [ ] Reset Progress (Title screen). Continue → Wren's bubble is back to baseline (small, dim).

### F3 readout

- [ ] With at least one warmed NPC active, hit F3. The HUD line `warmed: <count> @ R288/I1` reflects the absolute warmed values (LIGHTING_CONFIG.npcWarmedRadius / npcWarmedIntensity).

---

## § US-100 — Briar Wilds area + east-gated entry

### Pre-Ember (brambles block)

- [ ] `?reset=1` → walk to the east edge of Ashen Isle (around col 47-49, row 17-19). Six bramble-cluster objects render in a compact patch, blocking the exit cells.
- [ ] Walking onto the brambled cells is blocked by collision (the `bramble-cluster` kind is impassable).
- [ ] Even if you somehow reach (49, 18), no transition fires — the exit's `condition: 'has_ember_mark == true'` suppresses it.

### Post-Ember (path opens)

- [ ] Receive the Ember (Keeper rescue in Fog Marsh). Return to Ashen Isle.
- [ ] Approach the east edge — the bramble objects vanish on the same frame the `has_ember_mark` flag flipped (general conditional-decoration / conditional-object subscriber).
- [ ] Walk onto (49, 18). The first-time-arrival thought trigger fires: *"The brambles have parted. A road east."* The flag `east_path_seen` flips true.
- [ ] The fade transition fires; you land on Briar Wilds at (1, 13).
- [ ] Re-entering the same tile does not re-fire the thought (one-shot via `east_path_seen`).

### Briar Wilds layout

- [ ] Briar Wilds renders 32×26 with the briar-wilds-floor-thorn Wang tileset. Bramble-cluster + briar-dead-tree scatter frames the edges; passable twisted-roots underfoot inside drain zones.
- [ ] No NPCs are present (intentional — the trial is endured alone).
- [ ] Walk west to (0, 12-14): the return exit fires; you arrive on Ashen Isle near (48, 18).

### Closing reflection

- [ ] Walk to the far east clearing (cols 27-30, rows 11-14). The closing-reflection narration fires as 3 sequential thought bubbles ending on a forward-look toward the Heart Bridge.
- [ ] On the same approach, the co-located trigger flips `briar_wilds_complete = true`.
- [ ] Re-entering the clearing later: no narration repeats (`quiet_seen_quiet-closing` is set; the trigger is `repeatable: false`).

### Reset Progress

- [ ] Reset Progress wipes `east_path_seen`, `briar_wilds_complete`, all `doubt_count_*`, all `quiet_seen_*`, and `ember_warmth`. Verifiable via DevTools: `localStorage.getItem('emberpath_flags')` returns null after Reset.

### Smoke (desktop + mobile)

- [ ] Repeat the full path (Ashen Isle pre-Ember → Keeper rescue → return → cross brambles → walk briar-wilds → closing reflection → return west) at desktop ~1280×720 viewport.
- [ ] Repeat at mobile DevTools 360×640 viewport. Touch-joystick controls; pinch-zoom does NOT distort. (Learning EP-03)

---

## § US-101 — Ember warmth state

### Foundation

- [ ] Open F3 in any area; the HUD line `warmth: 1.00  zone: neutral` is visible. Walk inside Ashen Isle / Fog Marsh — warmth holds at 1.00; zone stays `neutral`.

### Drain / quiet behaviour (briar-wilds)

- [ ] Step into a drain zone (drain-1 at cols 8-11, rows 8-10 — F3 shows the burnt-sienna rectangle). Within 1-2 seconds, F3 reads `warmth: 0.9X  zone: drain`. The player ember overlay shrinks; the lit area dims.
- [ ] Step out — `zone: neutral`, warmth holds steady (no drift, no auto-restore outside zones).
- [ ] Step into a quiet zone (quiet-grove at cols 14-16, rows 5-7 — gold rectangle). Warmth restores at the faster rate. F3 reads `zone: quiet`.

### Hard floor

- [ ] Stand inside drain-2 (cols 18-21, rows 16-18) for ≥30s. Warmth bottoms out at 0.30 (WARMTH_FLOOR) and HOLDS — no further dimming, no fail state, no respawn. The ember overlay stays clearly visible.

### Continue-from-save

- [ ] Stand in drain-1 long enough to drop warmth to ~0.5. Refresh the browser (Cmd+R / F5). On Title, click Continue. The scene resumes at the same area; F3 shows `warmth: 0.5X` (or close — small drift due to epsilon-bounded persistence).
- [ ] The player ember overlay opens at the dimmed visual state on the first frame of resume — no flash to full radius.

### Reset Progress restore

- [ ] With dimmed warmth, hit Title → Reset Progress. Re-enter briar-wilds. Warmth = 1.00 from frame 1.

### Variant baseline (cross-area persistence)

- [ ] Drain warmth in briar-wilds to ~0.5. Walk west to Ashen Isle. F3 still reads ~0.5. Walk into Fog Marsh; same. Return to briar-wilds; same. Warmth carries across area transitions.

---

## § US-102 — Drain zones + doubt voices

- [ ] Enter drain-1 the FIRST time. A doubt-voice thought bubble appears (one of: *"This path is too long..."*, *"Did the Ember really change anything?"*, *"You should have stayed at the village..."*).
- [ ] Step OUT of drain-1, then back IN. A DIFFERENT doubt line shows (escalation via `doubt_count_drain-1` modulo 3).
- [ ] After the third re-entry, the cycle wraps to the first line.
- [ ] Repeat for drain-2 — its doubt set is independent (different `doubt_count_drain-2` flag).
- [ ] Drain zones do NOT block movement — Pip walks freely across.
- [ ] F3 overlay: drain rectangles render in burnt-sienna; their per-zone label shows id + doubt line count.

### Reads-as

- [ ] The drain zones read as *false-hope traps* — the warmer twisted-root decorations underfoot, against the cool grey-green floor, signal "something feels off here." The doubt lines feel like the player's own weariness, not a personalised enemy.

---

## § US-103 — Quiet places + closing reflection

- [ ] Enter quiet-grove the FIRST time. A one-shot narration line plays: *"Pip's ember steadies."* (or *"The bramble parts here."*).
- [ ] Step out and back in — NO narration repeats (the `quiet_seen_quiet-grove` flag is set).
- [ ] Drop warmth in drain-1, then walk into quiet-grove. Warmth restores at the faster rate (RESTORE 0.20/s vs DRAIN 0.08/s).
- [ ] Stand at the boundary where a drain and quiet zone overlap (if you can find one in the layout). Quiet wins — warmth restores while you stand inside both.
- [ ] Tier-2 lights: pre-Ember, walk into quiet-grove. The clearing has NO bright bubble (tier-2 lights render at 0 intensity pre-Ember).
- [ ] Post-Ember: same approach — the clearing now glows visibly (tier-2 light at QUIET_ZONE_LIGHT_RADIUS=72 / INTENSITY=0.55).
- [ ] Walk to quiet-closing (cols 27-30, rows 11-14). Three sequential narration bubbles play, ending on the Heart Bridge forward-look. `briar_wilds_complete` flips true.

### F3 overlay

- [ ] Quiet rectangles render in hope-gold; per-zone label shows id + narration line count.

### Reads-as

- [ ] Quiet places read as *rest* — warm gold decoration, wider breathing-room composition, contrasting with the drain zones' cool ground.

---

## Reset-Progress-clears-everything (compounded check)

- [ ] After a full playthrough through briar-wilds, hit Reset Progress. Open DevTools → `localStorage.getItem('emberpath_flags')` returns null. `localStorage.getItem('emberpath_save')` returns null (atomic reset).
- [ ] On a fresh `?reset=1` session: Wren bright bubble gone; brambles back; east exit gated; first-time east-path thought re-fires; quiet-grove narration replays on first entry; doubt-line counters back at 0; ember_warmth back to MAX; `briar_wilds_complete` cleared.

---

## Phase log entries (per Learning EP-05)

- [ ] PixelLab generations recorded: 4 calls fired against `mcp__pixellab__` (personal). Team server (`mcp__pixellab-team__`) NOT used.
- [ ] Atlas frame-pick verification: per-mask + per-object yes/no recorded above.

---

## Out-of-scope guard (compounded "do not ship" check)

- [ ] No scripture artifact / *remember* verb (deferred to `the-word`).
- [ ] No explicit decoy-as-object class — false-hope read folded into drain-zone decoration.
- [ ] Zero NPCs in briar-wilds.
- [ ] No audio.
- [ ] No fail state / respawn / skill check at any drain configuration.
