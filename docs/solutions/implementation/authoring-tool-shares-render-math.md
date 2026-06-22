---
title: An in-game authoring tool MUST share the renderer's exact math — and override a heuristic default by strict precedence so migration is zero-regression
applies_when: Building any "place/size/tune it in the browser, save to data" editor (shadows, collision, placement, hitboxes), or adding authored per-kind data that replaces a computed default
status: binding
failure_ids: [FB-23 / #179 — square shadow under a round tree; shipped clean because the tool and renderer agreed and unauthored kinds kept the old default]
proven_again: [#185 / PR #189 — per-character (Pip/NPC) collision authoring; same four rules held on a third family with zero regression, #187 / PR #193 — trigger/event authoring via per-area JSON sidecars; fourth family, zero-regression registry merge proven end-to-end]
canon: src/maps/shadows.ts (resolveShadow — the one shared fn) · src/systems/shadowEditor.ts (?editor=shadow&target=…&kind=…) · src/systems/characterCollisionEditor.ts (the third family) · src/maps/characters.ts (characterBox — shared by player + getNpcBounds) · src/scenes/GameScene.ts (precedence) · src/data/object-shapes.json + character-shapes.json · vite-plugins/{object,character}-shape-save.ts
---

# An authoring tool shares the render math, overrides by precedence, and captures with Scale.RESIZE

## The situation
FB-23 needed per-kind ground shadows authored by eye (a square shadow under a round
tree is wrong). The win was shipping a browser editor where **what Jaco drags is
byte-identical to what ships**, with **zero regression** for every kind he hadn't
touched yet, and a precise GATE-2 MP4 of the tool driven by automation. Four design
rules made that hold — they generalize to any "tune-it-in-game, save-to-data" tool.

## The rules

### 1. ONE pure math function, shared by editor preview AND renderer
The editor's live preview and the in-game render call the **same** pure function
(`resolveShadow` in `src/maps/shadows.ts`) — not two copies that drift. If the tool
draws the shape with its own math and the game draws it with different math, "looks
right in the editor, wrong in game" is guaranteed. Put the geometry in one tested
module (`test/shadows.test.ts`) and have both sides import it.

### 2. Authored data overrides a heuristic default by STRICT precedence
Layer the resolution so an unauthored kind is untouched:

```
noShadow            // explicit opt-out — always wins
  > authored data   // def.shadow (objects) / getCharacterShadow(kind) (characters)
    > heuristic default   // the FB-21 feet-ellipse / building-rect fallback
```

A kind with no authored entry keeps its **exact current** behavior. That makes
migration **one kind at a time with zero regression** — you author oak today, pine
next week, and everything else looks identical until you get to it. No big-bang
data backfill, no "we authored 3 and broke the other 40."

### 3. One editor, two families via a `?target=` param — not two near-duplicate tools
`?editor=shadow&target=<object|character>&kind=<id>` serves objects AND
Pip/NPCs from a single `ShadowEditorSystem`. The families differ only in their
**reference point** and **save endpoint**, so parameterize those, don't fork the UI:

| family | reference point | save → data file |
|--------|-----------------|------------------|
| object | anchor cell top-left `(col*TILE, row*TILE)` | `/__object-shape/save` → `object-shapes.json` |
| character | sprite centre `(entity.x, entity.y)` — shadow tracks the walk | `/__character-shape/save` → `character-shapes.json` |

A save merges its field independently (a shadow save never wipes collision; both
plugins read-merge-write and preserve `_doc`/other kinds). Dev-only plugins
(`apply:'serve'`) — never in the prod build.

### 4. Capture the tool with Scale.RESIZE → canvas px == page px
The game uses `Phaser.Scale.RESIZE`, so the canvas is 1:1 with CSS pixels.
Playwright pointer coords then map **directly** to page coords — compute the exact
handle / shape-centre screen position from the editor's own mapping formula and drive
precise drags for a GATE-2 MP4. (Pattern: `autonomy/record-shadow-editor.cjs` —
`objMapping(fpW,fpH)` mirrors the editor's `cellPx`/`pxPerWorld`.) No fragile
"click roughly here" guessing.

## The check that catches it next time
Before merging any authoring-tool work, prove the **preview == render** invariant:
author a value in the editor, then boot the real game on that same kind and confirm
the shape is identical (same shared fn → it must be). And confirm an **unauthored**
kind is pixel-unchanged from before (precedence rule). For anything that moves
(a shadow tracking a walking sprite), the artifact is an **MP4**, never a still
([process/gif-for-motion](../process/gif-for-motion.md)).

## Proven again — character collision (#185 / PR #189)
The same four rules carried, unchanged, to a **third family**: per-character (Pip/NPC)
**collision** authoring (not shadow). The Collision tab gained a CHARACTER target — pick
Pip/Wren, drag a **centre-referenced body-rect** (move + E/S handles), Save →
`character-shapes.json.collision`. Each rule held:
1. **One shared math** — the authored rect resolves through `characterBox()`, the single
   fn that feeds **both** the player's body AND `getNpcBounds`. Editor preview and the two
   runtime call-sites all read it; no third copy to drift.
2. **Precedence / zero-regression** — a character with no authored `collision` falls back to
   the **byte-identical legacy feet-square**. Pip + Wren authored; every other NPC unchanged
   (test-covered in `test/collision.test.ts`).
3. **One editor, families via target** — the *interaction* differs (a single drag-rect vs
   object sub-cell paint) but it's the same Collision tab parameterised by target + save
   endpoint, not a forked tool. So "one editor, two families" now spans two **geometries**
   (paint-grid and centre-rect), not just two reference points.
4. **RESIZE capture** — same 1:1 canvas→page mapping drove the editor screenshot.
Lesson: when a new authored-data feature lands, reach for THIS pattern first — three
families in (object shadow, character shadow, character collision) it has held every time.

## Proven again — trigger/event authoring (#187 / PR #193)
The fourth family bent the pattern in one telling way and confirmed the rest. Triggers
are **whole entities authored into a list**, not a per-kind field tuned against a
heuristic default — so rules 1 and 4 take a different shape, while 2 and 3 hold verbatim:
1. **One shared math, now one shared MODEL** — there's no per-pixel render math to share,
   but the same drift risk exists in the **data shape + condition grammar**. So the editor
   form and the runtime read **one** module (`src/systems/triggerModel.ts`):
   `toTriggerDefinition`/`fromTriggerDefinition` and `compileCondition`/`parseCondition` are
   the single round-trip the tool writes and the runtime evaluates (`test/triggerModel.test.ts`
   pins the compiled clause against the runtime evaluator). The tab's top-down area view also
   reuses the canonical `area.mapCols`/`area.mapRows` (same source as `collisionEditor.ts`) —
   re-derived grid dims were a near-miss the cold review flagged.
2. **Precedence / zero-regression — strongest proof yet** — authored triggers live as
   sidecars (`src/data/areas/triggers/<areaId>.json`) and the registry's
   `withAuthoredTriggers` merges them onto the area's inline triggers. An area with **no
   sidecar** returns the **same array reference** (`mergeAuthoredTriggers` short-circuits, the
   registry skips the merge) — provably byte-identical, not just equal. The merge also
   **throws on a duplicate id** because the runtime keys one-shot bookkeeping on
   `_trigger_fired_<id>` — a precedence layer that's a *correctness* gate, not just a default.
3. **One editor, families via a param** — the Triggers tab is the same `PhaserTab` +
   system-owns-its-HUD idiom as the collision/shadow tabs; the area `<select>` remounts on
   switch exactly like CollisionTab's kind selector. A fourth tab, not a forked tool.
4. **Capture proves the full pipe, not just the preview** — because the payoff is at
   **runtime** (not an in-editor shape), the verification artifact is an MP4 of the *game*:
   a flag-gated demo trigger (`demo_authored_trigger`, set only by a test-bench scenario, so
   inert in real play) authored as a sidecar, then `?scenario=authored-trigger-demo` walks Pip
   into the zone and the authored `thought` fires — closing **form → sidecar → registry merge
   → runtime** with no hand-edited TypeScript (`autonomy/capture-authored-trigger.cjs` asserts
   the runtime `_trigger_fired_…` flag flips false→true).
Lesson sharpened: the four rules are really **one shared source of truth + override by
strict precedence + one parameterised tool + capture at the layer where the payoff lands.**
For render-shape families that layer is the editor preview; for a data/behaviour family
(triggers) it's the running game. Reach for this pattern first whenever "author it in the
browser, save to data" appears — four families in, it has held every time.

## Related
- [implementation/tall-building-collision-band-at-base](tall-building-collision-band-at-base.md) — sibling: per-kind data on `src/maps/objects.ts` consumed by the renderer; two fields/two jobs, never conflated (collision vs shadow).
- [art/ground-shadow-canon](../art/ground-shadow-canon.md) — WHAT a correct shadow looks like (buildings → rect, everything else → ellipse at the contact line); this lesson is HOW you author it without drift.
- [process/gif-for-motion](../process/gif-for-motion.md) — the moving-output → MP4 capture rule that gates a shadow change.
- FB-23 / Issue #179 · PR #180 · #185 / PR #189 · #187 / PR #192 (data core) + PR #193 (tab + demo).
