---
title: "feat: Finish editor tool migration — area collision into the editor app, Map/Dialogue auto-save, remove in-game ?editor= dispatch"
type: feat
status: active
issue: 184
epic: 188
created: 2026-06-22
depth: standard
---

# feat: Finish the editor tool migration (#184)

## Problem Frame

The standalone local-only editor app (`tools/editor/`, #182, never published) is meant
to be the **single home for every authoring tool**. Three jobs remain before that is
true, and all three are about removing the last in-game / copy-paste authoring paths:

1. **Area (per-tile) collision still runs in the game, not the editor.** The #119 paint
   tool (`src/systems/collisionEditor.ts`) only boots via `?editor=collision&area=<id>`,
   which starts `GameScene` in a suppressed-gameplay mode. It is the **only** authoring
   surface that has not moved into the editor app. It also saves to a *gitignored staged
   file* (`staged/collision/<areaId>.json`) that a human then ports into the area
   definition via `autonomy/apply-staged-collision.cjs` — a copy-paste-grade hand-off.

2. **Map and Dialogue editing still export by copy-paste.** The Map tab serializes
   terrain+objects to a textarea (`serializeTerrainAndObjects` → "Export TypeScript"
   modal) that a human pastes back into the area source by hand. Dialogue has no save at
   all. Every other authoring tool in the app (object shape, character shape, shadow,
   trigger) already auto-saves through a dev-only Vite plugin. Map/Dialogue are the
   stragglers.

3. **The in-game `?editor=` dispatch is dead weight once #1 lands.** `?editor=object`,
   `?editor=shadow`, and `?editor=collision` all boot `GameScene` into an editor mode.
   Object and shadow already run inside the editor app (the Collision/Shadow tabs mount
   the same systems in `EditorHostScene`), so their in-game boot is redundant; only area
   collision still needs it. Once area collision moves into the app, the entire
   `?editor=` branch in `TitleScene`/`GameScene` can be deleted, shrinking the shipped
   bundle and removing editor code from the player build.

**The migration the editor app was built for is ~80% done; this issue closes it out.**

---

## Scope

**In scope (full #184):**
- A new **Map-collision tab** (or a target on the existing Collision tab) that ports the
  per-tile paint editor into the editor app over the reused top-down area render.
- Real auto-save for area collision, Map (terrain+objects), and Dialogue via dev-only
  Vite plugins — replacing the staged-file hand-off and both copy-paste modals.
- Deleting the in-game `?editor=` dispatch and the now-unreachable in-game editor code
  paths once the above lands.
- Nice-to-have: pin `tools/editor` Phaser (`^3.90.0`) to the root version (`^3.80.1`).

**The central sequencing decision (GATE 1 — for Jaco):** piece **2 (Map/Dialogue/area
auto-save) rewrites hand-authored TypeScript source in place**, which is materially
riskier than every save plugin shipped so far (those all write *JSON* data files). The
area sources (`src/data/areas/*.ts`) are not flat data — they use tile-map derivation
(`deriveTerrainFromTileMap`), builder helpers, and a per-area `FRAME` vocabulary. A naïve
"serialize the grid and overwrite the file" auto-save would **flatten and destroy that
hand-authoring**. So this plan is structured so the safe migration (pieces 1 + 3) can
ship first and the risky TS-rewriting auto-save (piece 2) is isolated. See **Key
Technical Decisions → D1**.

### Deferred to Follow-Up Work
- If Jaco chooses the safe-first path at GATE 1: **piece 2 (Map/Dialogue auto-save)**
  becomes its own issue with a dedicated design pass on *how* to write back to the area
  TS without losing builder-authored structure (target a serializable sub-region, write
  a sibling `.generated.ts`, or convert the area to a data+builder split first) plus
  on-disk backups before any overwrite. Units U4–U5 below carry that work and are
  marked **(deferred pending GATE 1)**.

### Out of scope
- Re-architecting how areas are authored (tile-map vs. flat literal). The auto-save
  design must *preserve* the current authoring model, not replace it.
- Any player-facing or visual change. This is dev-tooling only; nothing here alters the
  shipped game except the bundle shrinking when dead editor code is removed.

---

## Key Technical Decisions

### D1. Split the safe migration from the risky TS-rewrite — ship pieces 1 + 3 first
Pieces 1 (area collision into the app) and 3 (remove `?editor=` dispatch) are a clean,
low-risk coupled bundle: piece 1 removes the *last* reason the in-game dispatch exists,
so piece 3 becomes a pure deletion right after. Piece 2 (auto-saving area/Map/Dialogue
edits back into `.ts` source) is the only part that mutates hand-authored TypeScript and
needs its own careful design. **Recommended:** land U1–U3 (+ U6) now; defer U4–U5 to a
follow-up issue. Jaco decides the actual cut at GATE 1.

### D2. Reuse the TriggerTab render, don't rebuild it
The Triggers tab (`src/systems/triggerEditor.ts`, PR #193) already renders a fitted
top-down area view — terrain + object markers — inside `EditorHostScene`. The Map-collision
tab mounts the **same** area render and overlays the paint grid, rather than re-deriving a
second area renderer. This is the established "one parameterised tool, one shared render"
pattern from `docs/solutions/implementation/authoring-tool-shares-render-math.md`.

### D3. Area collision keeps writing the *same data target*, just auto-merged
The ported paint editor records the same explicit blocked-cell set the #119 tool does.
Rather than the gitignored staged file + manual `apply-staged-collision.cjs` port, the new
save writes the cell set into committed area-collision data the same read-merge-write way
the object/character/trigger plugins do — provided that target is JSON-shaped. If area
collision can only live inside the `.ts` area definition, this save is part of piece 2's
TS-rewrite design and moves to U4 (deferred). Resolve this at the top of U1.

### D4. Auto-save plugins are dev-only and back up before overwrite
Every new endpoint follows the existing plugin contract: `apply: 'serve'` (vanishes from
any build), kebab-slug sanitised ids, 1 MB body cap, read-merge-write preserving sibling
data. **Additionally**, any plugin that overwrites a hand-authored `.ts` file writes a
timestamped backup beside it first (new requirement, not in the JSON plugins) because a TS
overwrite is not as trivially recoverable as a JSON data merge.

---

## Implementation Units

### U1. Port the area (per-tile) collision paint editor into the editor app
**Goal:** Area collision is authored inside `tools/editor/` over the reused top-down area
render — no `?editor=collision` in-game boot needed.
**Dependencies:** none.
**Files:**
- `src/systems/mapCollisionEditor.ts` (new — the editor-app system; adapts the paint/seed/
  redraw logic from `src/systems/collisionEditor.ts` onto `EditorHostScene` + a `hudParent`
  HUD, mirroring how `triggerEditor.ts` was adapted)
- `tools/editor/src/tabs/mapCollisionTab.ts` (new — `PhaserTab` subclass; area `<select>`
  remounts on switch, same idiom as `triggerTab.ts`/`collisionTab.ts`)
- `tools/editor/index.html`, `tools/editor/src/main.ts` (wire the new tab + view into the
  tab bar and `getPhaserTab`/`ViewName`)
- `src/systems/collisionEditor.ts` (left untouched until U3 deletes it; no edit here)
- `test/mapCollisionEditor.test.ts` (new)
**Approach:** First resolve D3 — confirm whether area-collision data has a JSON home or
only lives in the `.ts` area def. If JSON: this unit includes a `/__map-collision/save`
plugin (read-merge-write, like `collision-save.ts` but writing committed data not staged).
If `.ts`-only: this unit ships **paint + render + reuse** and keeps the existing staged-file
save for now, with the committed auto-save folded into U4. Reuse the canonical
`area.mapCols`/`area.mapRows` for grid dims (the cold-review near-miss from #187 — never
re-derive from terrain). Seed the paint layer from `cellBlocks(...)` exactly as #119 does so
the start state IS current real collision.
**Patterns to follow:** `triggerEditor.ts` (area render in `EditorHostScene`), `collisionTab.ts`
(tab + remount), `collision-save.ts`/`object-shape-save.ts` (dev plugin contract).
**Test scenarios:**
- Seeding: a freshly-mounted area shows exactly the cells `cellBlocks` blocks today (parity
  with the live predicate).
- Paint stroke: first cell sets stroke direction (clicking a blocked cell erases; clicking a
  clear cell paints) and a drag is consistently add-only or remove-only.
- Grid dims come from `area.mapCols`/`area.mapRows`, not `terrain.length` derivation.
- Remount on area switch loads the new area's seeded set and discards the previous overlay.
- If JSON save lands here: save POSTs the sorted blocked set, the plugin read-merge-writes
  only that area's entry, and other areas' data is preserved.

### U2. Remove the staged-file path once area collision auto-saves to committed data
**Goal:** No more gitignored staged hand-off for area collision — saving writes the real
committed target.
**Dependencies:** U1 (only if D3 resolved to "JSON home exists"; otherwise this unit moves
under U4 and is deferred).
**Files:**
- `vite-plugins/collision-save.ts` (repoint from `staged/collision/` to the committed
  target, or retire in favour of the U1 plugin)
- `tools/editor/vite.config.ts` (register/adjust the plugin)
- `autonomy/apply-staged-collision.cjs` (mark obsolete / remove from the loop — it lives in
  the agent workspace, note only)
- `.gitignore` (drop the `staged/` collision note if nothing else uses it)
**Approach:** Straight follow-through on U1's save decision. If area collision is `.ts`-only,
this unit is empty and its intent merges into U4.
**Test scenarios:** Save writes the committed file (not `staged/`); a second save read-merges
without duplicating; round-trip (save → reload area → same blocked set).
**Test expectation:** behavioural — covered by the save round-trip scenario.

### U3. Delete the in-game `?editor=` dispatch and now-dead editor code
**Goal:** The player build contains no editor code; `?editor=...` does nothing (falls
through to Title).
**Dependencies:** U1 (area collision must run in the app before its in-game boot is removed).
**Files:**
- `src/scenes/TitleScene.ts` (delete `applyEditor()` and its call site; remove
  `editorMode`/`editorAreaId`/`editorKind` URL helpers if unused elsewhere)
- `src/scenes/GameScene.ts` (delete `editorActive`/`objectEditorActive`/`shadowEditorActive`
  branches, the editor-system construction at ~891, and the `update()` gameplay-suppression
  guards at ~661)
- `src/systems/collisionEditor.ts` (delete — its logic now lives in `mapCollisionEditor.ts`)
- Remove `objectShapeEditor`/`shadowEditor`/`characterCollisionEditor` in-game *entry points*
  only if they are no longer imported by GameScene (the systems themselves stay — the editor
  app imports them via `@game`; verify with a grep before deleting any import)
- `test/` (remove/adjust any test that boots an in-game editor mode)
**Approach:** Pure deletion. The risk is deleting a system the editor app still imports — so
**grep every system for `@game/systems/<name>` usage in `tools/editor/` before removing it**;
remove only the GameScene/TitleScene *dispatch and construction*, never a system the app mounts.
**Test scenarios:**
- `npm run build` (tsc --noEmit) stays clean after deletions (no dangling imports).
- Booting the game with `?editor=collision&area=ashen-isle` lands on the normal Title (no
  editor), i.e. the dispatch is gone.
- The editor app still builds and the Collision/Shadow/Trigger/Map-collision tabs still mount
  (the shared systems survived).
- Boot smoke (New Game + move) passes — no regression from removing the suppression guards.

### U4. (deferred pending GATE 1) Map + area auto-save into the area source, safely
**Goal:** The Map tab's terrain+object edits (and, if `.ts`-only, area collision) auto-save
back into `src/data/areas/<id>.ts` without destroying builder-authored structure.
**Dependencies:** U1.
**Files:**
- `vite-plugins/area-save.ts` (new — `/__area/save`, dev-only, **backs up the target `.ts`
  to a timestamped sibling before writing**)
- `tools/editor/src/main.ts` (replace the "Export TypeScript" copy modal with a Save call;
  keep export as a fallback)
- `tools/editor/src/exportTypeScript.ts` (the serializer the plugin reuses; may need a
  "write into the existing file's terrain/objects region" mode rather than whole-file emit)
- `test/areaSave.test.ts` (new)
**Approach:** **This is the risky unit and the reason for the GATE-1 split.** Design decision
to resolve *before* coding: how to write terrain/objects back without flattening the
hand-authored tile-map + builder structure. Candidate approaches (pick in the follow-up
issue's own plan/brief): (a) serialize only into a clearly-delimited generated region between
marker comments; (b) emit a sibling `<area>.generated.ts` the hand-authored file imports;
(c) convert the area to an explicit data+builder split first. Whichever wins, the plugin
always writes a timestamped backup first (D4).
**Execution note:** characterization-first — write a test that captures the *current*
`ashen-isle.ts` round-trip (parse → serialize → parse) before changing any write path, so a
regression that drops decorations/FRAME usage fails loudly.
**Test scenarios:**
- A backup file is written before any overwrite; a forced write error leaves the original
  intact.
- Saving terrain edits preserves every non-terrain section of the file (decorations, stones,
  builder helpers, `FRAME`) byte-for-byte.
- Round-trip: load area → save with no edits → file is semantically unchanged (ideally
  byte-identical within the generated region).
- Path-traversal: a crafted areaId is rejected (kebab-slug sanitised).

### U5. (deferred pending GATE 1) Dialogue auto-save
**Goal:** Dialogue edits in the editor app save to source instead of having no save path.
**Dependencies:** U4 (shares the backup-before-overwrite TS-write machinery).
**Files:**
- `vite-plugins/dialogue-save.ts` (new — `/__dialogue/save`, dev-only, backup-first)
- `tools/editor/src/dialogueRenderer.ts` (add Save; wire endpoint)
- `test/dialogueSave.test.ts` (new)
**Approach:** Same backup-first TS-write contract as U4; scope to wherever dialogue data
lives (confirm whether it is per-area `.ts` or a JSON data file — if JSON, this is as safe as
the existing plugins and could move *out* of the deferred bundle).
**Test scenarios:** save preserves sibling content; backup written first; round-trip
unchanged; invalid payload rejected.

### U6. Pin tools/editor Phaser to the root version
**Goal:** The editor app and the game build against the same Phaser so the editor can never
diverge from in-game render behaviour.
**Dependencies:** none (independent; can land with U1–U3).
**Files:** `tools/editor/package.json` (`^3.90.0` → match root `^3.80.1`),
`tools/editor/package-lock.json` (regenerate).
**Approach:** Bump, reinstall, rebuild the editor app, confirm all tabs still mount.
**Test scenarios:** `Test expectation: none — dependency pin`; verification is the editor
build staying clean and tabs mounting (manual/boot check).

---

## Sequencing

```
U1 (area collision into app) ──┬──> U3 (remove in-game dispatch)   [safe bundle, ship now]
                               └──> U2 (committed save, if JSON)
U6 (Phaser pin) ── independent, ride along with the safe bundle

U4 (area/Map TS auto-save) ──> U5 (dialogue save)   [risky bundle, deferred pending GATE 1]
```

---

## System-Wide Impact

- **Player build shrinks** (U3): editor systems + dispatch leave the shipped bundle. Net
  positive, no behavioural change for players.
- **Authoring workflow** (U1–U2, U4–U5): all authoring converges in one local app; the
  staged-file + copy-paste hand-offs disappear. Affects only the developer (Jaco / the agent).
- **Risk concentration** (U4–U5): the only units that mutate hand-authored `.ts`. Isolated by
  design and gated on a backup-first contract + characterization test.

---

## Verification

- `npm run build` (tsc --noEmit + vite) clean at every unit boundary; `tools/editor` build
  clean; `npx vitest run` green.
- **Testbench scenario (hard gate):** capture the ported Map-collision tab authoring a cell
  set and the game reflecting it; for U3, capture that `?editor=collision` now lands on Title
  and a normal New-Game session is unaffected. Non-visual dev-tool change → MP4 is proof for
  Jaco, not a GATE-2 art gate (no art/animation/placement changes here).
- Cold `emberpath-pr-review` subagent APPROVE before self-merge (non-visual → self-merges on
  clean gates per the current operating model).

---

## Origin
- Issue: `Jaxsbr/emberpath#184` (epic #188 — unify editor tools).
- Builds directly on #182 (editor app), #187/PR #193 (Trigger tab + reused area render).
- Pattern ledger: `docs/solutions/implementation/authoring-tool-shares-render-math.md`.
