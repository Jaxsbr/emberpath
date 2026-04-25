# Manual verification — world-legibility

Runtime + observer criteria from `docs/plan/phase-goal.md` that cannot be
satisfied by source-read alone. Each checkbox traces back to one done-when
criterion and is intended to be ticked by a human reviewer (Jaco) after
merge, in the order below.

## Setup

```bash
npm install
npm run dev      # game at http://localhost:5173
cd tools/editor && npm run dev   # editor at http://localhost:5174 (optional)
```

Run both side-by-side if you want to cross-check that the editor's
decoration rendering matches what the game shows.

---

## Reads-as observer tests

For each test, the observer should be someone who has not previously seen
the redesigned area (a fresh pair of eyes; ideally a kid in the 6-12yo
target audience, but any first-time viewer works). Show them the area
without context and ask the listed questions.

### Ashen Isle reads-as a coastal village [US-59]

Boot the game; let the title fade into Ashen Isle. Hand the player the
keyboard / phone and say nothing. After 30 seconds of free exploration,
ask: **"Where are you, and what are the things around you?"**

The observer should be able to identify at least **4 of 5** of the
following without prompting:

- [ ] "I'm in / next to a village" *(or 'town' / 'settlement' / similar)*
- [ ] "That's a path" *(pointing at the dirt path)*
- [ ] "That's a house" *(pointing at one of the two cottages)*
- [ ] "That's the water / the edge of the island" *(pointing at the cliff
      coast on the north edge — accept 'the edge' / 'the cliff' / 'the
      sea' as equivalent intent even though the cliff is a stone-tile
      substitution; the goal is "the boundary of the island")*
- [ ] "That's the way out — the dock / gate" *(pointing at the boardwalk
      at the top)*

### Fog Marsh reads-as a wet marsh with a ruin [US-60]

After the Ashen Isle test, walk the player onto the dock and into Fog
Marsh. Same protocol: 30 seconds of exploration, then ask the same
question.

The observer should be able to identify at least **4 of 5**:

- [ ] "I'm in a marsh / wetland / swamp" *(any wet-environment word)*
- [ ] "The dry strip is the path" *(pointing at the dry-path overlay)*
- [ ] "That broken-walls thing is a ruin / shrine / tomb" *(pointing at
      the ruin in the NE corner)*
- [ ] "The edges are too thick / wet to cross" *(pointing at the marsh-edge
      decoration on the left side)*
- [ ] "The door at the end is the way through" *(pointing at the wooden
      door on the south edge — the EXIT zone back to Ashen Isle)*

### Diegetic exit reads-as a thing you walk through [US-59, US-60]

Same observer, without seeing the player walk through anything:

- [ ] Point at the **dock** on Ashen Isle and say "that's the way out".
- [ ] Point at the **door** on Fog Marsh's south edge and say "that's
      the way out".

---

## Per-area runtime verification

### Ashen Isle [US-59]

- [ ] Title screen → press Start → fade-in shows the Ashen Isle layout
      with the player on the path adjacent to the player's gate; the
      cottage and fence are visible in the initial viewport at zoom 1.
- [ ] Walk north onto the cottage row — collision blocks at the wall
      cells; the door cell at (10, 15) is walkable (you can stand in
      the doorway).
- [ ] Walk north along the main path → reach the dock → the EXIT zone
      fires and the screen fades to Fog Marsh.
- [ ] Walk east via the east path branch → enter the Old Man's yard
      via the gate → walk up to the Old Man on the yard-interior path
      tile → press Space (desktop) or tap (mobile) to talk → dialogue
      opens with the Old Man portrait and the original dialogue tree.
- [ ] Choose the "I seek the path forward" → "Yes, tell me everything"
      branch → confirm the `spoke_to_old_man` flag was set (e.g. the
      ashen-isle-vision story trigger fires when you walk south through
      the trigger zone at (24, 33)).
- [ ] Walk into the room-echo trigger at (3, 32) — repeatable thought
      bubble fires.
- [ ] Walk into the start-thought trigger at (11, 20) — one-shot thought
      bubble fires (only on first walk-through).

### Fog Marsh [US-60]

- [ ] Arrive in Fog Marsh via the Ashen Isle dock — you land on the
      south end of the dry path at (14, 21); the ruin is visible in
      the upper-right of the initial viewport at zoom 1.
- [ ] Walk north along the dry path — fog-entry-thought fires at (13-15, 18).
- [ ] Walk into Whispering Stones at (13, 16) — dialogue trigger fires;
      no portrait shown (verifies the no-portrait fallback).
- [ ] Continue north → reach the corner → walk east along the path
      to the Marsh Hermit at (24, 10) → press Space / tap to talk →
      Marsh Hermit portrait appears in dialogue.
- [ ] Choose either dialogue branch → confirm `spoke_to_marsh_hermit`
      flag was set (walk back south past (14, 14) and the marsh-vision
      story trigger fires).
- [ ] Walk south via the dry path to the EXIT zone at (13-16, 22) —
      transition fires and you arrive back on Ashen Isle.

### Round-trip [US-59, US-60]

- [ ] Ashen Isle → Fog Marsh → Ashen Isle → Fog Marsh → Ashen Isle
      (three full transitions). After each, confirm:
  - [ ] No console errors or warnings (open DevTools console).
  - [ ] No orphan sprites (no decorations or NPCs visible from a
        previous area).
  - [ ] Flags persist (e.g. once `spoke_to_old_man` is true, the
        ashen-isle-vision trigger continues to fire on every visit).
- [ ] After exiting Fog Marsh, the player lands at (24, 4) on Ashen
      Isle — just south of the dock on the main path, NOT in some
      arbitrary east-edge tile from the pre-redesign entryPoint.

---

## 60-second smoke run [phase]

A single coherent play session covering the full POC happy path. Open
DevTools console first; **no errors or warnings should appear**.

- [ ] Spawn on Ashen Isle.
- [ ] Walk path to the Old Man's cottage.
- [ ] Full dialogue with Old Man (every node, every choice branch
      across multiple plays).
- [ ] Walk to the dock.
- [ ] Transition to Fog Marsh.
- [ ] Walk path to the Marsh Hermit.
- [ ] Full dialogue with Marsh Hermit.
- [ ] Walk into Whispering Stones.
- [ ] Return to Ashen Isle via Fog Marsh's south door.

Console should be empty. Any warning about a missing decoration frame
indicates a frame index in the `FRAME` constant of `ashen-isle.ts` or
`fog-marsh.ts` is wrong; cross-reference with `docs/tilesets/<atlas>.md`
and swap.

---

## Frame-pick visual sanity (US-61 follow-up)

The `FRAME` constants in both area files contain entries marked
`PROVISIONAL`. After running the manual verification above, capture any
that read clearly wrong (e.g. the door frame turns out to be a window;
the path frame turns out to be water). For each:

- [ ] Note the area file (`ashen-isle.ts` / `fog-marsh.ts`).
- [ ] Note the `FRAME` key (`ROOF`, `WALL_FRONT`, `DOOR`, etc.).
- [ ] Note the new frame index after consulting the atlas image
      (`assets/tilesets/<id>/tilemap.png`).
- [ ] Update the area file AND the corresponding `docs/tilesets/<id>.md`
      table row in the same commit.

This is iterative refinement — none of these block the phase from
shipping; the topology is what counts.
