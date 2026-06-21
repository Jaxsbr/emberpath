---
title: "feat: Unify all authoring tools into the standalone editor app"
type: feat
status: completed
issue: 182
created: 2026-06-21
depth: standard
---

# feat: Unify all authoring tools into the standalone editor app

## Summary

emberpath's authoring tools live in **two disconnected worlds**: a standalone Vite
app (`tools/editor`, port 5174) with Map / Dialogue / Flow tabs, and a set of
**in-game editors** reached only by hand-typed URL params on the main game
(`?editor=collision|object|shadow&kind=…`). The split means two apps on two ports,
no shared front door, invisible tools (you must know the param grammar and the kind
ids), and two inconsistent save models (lossy copy-paste "Export TypeScript" vs.
auto-write-to-JSON).

This plan executes **option B** (Jaco, 2026-06-21, issue #182): grow `tools/editor`
into the **single dedicated home for every tool** — add Collision and Shadow tabs,
host the existing in-game editor systems verbatim on a minimal editor-owned Phaser
scene, surface every target as a picker (no typed params), and unify the save model
so everything auto-writes its data file. Then **remove** the `?editor=` authoring
code from the shipped game.

**Hard constraint:** the editor must **never** be published to GitHub Pages. It stays
its own local-only Vite app. This plan also *improves* the publish boundary by moving
the editor systems out of the game's published bundle entirely.

---

## Problem Frame

- **Two front doors.** Map/Dialogue/Flow are in `tools/editor`; collision/object/shadow
  authoring is bolted onto the game runtime via `src/sandbox.ts` URL-param dispatch and
  `GameScene` conditional mounts.
- **Invisible, un-discoverable tools.** The in-game editors require knowing
  `?editor=shadow&target=character&kind=pip` — nothing lists the modes, targets, or kind
  ids. New tools are effectively undocumented tribal knowledge.
- **Inconsistent, partly-lossy save.** `tools/editor`'s output is "Export TypeScript →
  copy to clipboard → paste into source" (`exportTypeScript.ts`). The in-game editors
  auto-save to data files through dev-only Vite middleware. Two models, one of them manual.
- **Editor code ships in the public game.** `GameScene` unconditionally imports the three
  editor systems, so they're bundled into the published game (dead unless `?editor=` is
  set). They should not be in the public artifact at all.

### Why option B is the right fit (key finding)

`tools/editor` **already imports game code** through a path alias —
`@game/* → ../../src/*` (`tools/editor/tsconfig.json`, `tools/editor/vite.config.ts`) —
and already shares the terrain/object/area registries and Wang/tileset render math
rather than duplicating them. The three in-game editor systems
(`src/systems/collisionEditor.ts`, `objectShapeEditor.ts`, `shadowEditor.ts`) each take
a **generic `Phaser.Scene`** in their constructor (not `GameScene`), and depend only on:
the live scene (graphics/input/camera/sprites), the object/character registries, and the
shared shadow math (`src/maps/shadows.ts`). That means they can be hosted **verbatim** on
a stripped editor-owned Phaser scene — no rewrite, no render-math fork (honors the
`implementation/authoring-tool-shares-render-math` ledger lesson). The save endpoints are
standalone plugin modules in `vite-plugins/` and only need to be registered in the
editor's own Vite config.

---

## Scope Boundaries

**In scope**
- One unified nav in `tools/editor` listing every tool (extend the existing tab system).
- New **Collision** and **Shadow** tabs hosting the existing editor systems on an
  editor-owned minimal Phaser scene.
- Pickers for every target (area ids, object kinds, character/NPC ids) — no typed params.
- Register the dev save plugins in the editor's Vite config so all tabs auto-write.
- Auto-save for the Map (area) and Dialogue tabs (retire the copy-paste Export-TS as the
  primary path).
- Remove the `?editor=` authoring path + the three editor-system imports from the shipped
  game; keep `?scenario=` / `?sandbox=` (testbench, not an editor).
- Guarantee the editor stays out of the root build / Pages artifact.

### Deferred to Follow-Up Work
- A read-only "preview in real game context" inside the editor (the systems already render
  the sprite/scene; full-area preview is a later nicety).
- Migrating the Flow tab's data (it's a read-only graph today; no save model to unify).
- Any redesign of the editors' interaction model — this plan **relocates and unifies
  access**, it does not change how each tool is operated.

### Non-goals
- No change to the game's runtime behavior or player-facing surface.
- No new art/asset generation (dev-tooling only → GATE 1 applies; no GATE 2 unless a
  tool's own visual output needs review).

---

## Key Technical Decisions

1. **Reuse the editor systems verbatim on an editor-owned Phaser scene (not a Canvas-2D
   rewrite).** The systems already accept a generic `Phaser.Scene`. The editor app gains a
   `phaser` dependency for these tabs and boots a minimal headless-style scene (texture
   preload + the system mounted, gameplay suppressed). This avoids a parallel render
   implementation and the "right in the tool, wrong in game" drift the ledger warns about.
   *Rejected:* porting collision/shadow drawing to the existing Canvas-2D `mapRenderer`
   style — doubles the render code and forks the shadow math.

2. **The `@game/*` alias is the reuse seam.** Everything the new tabs need
   (`OBJECT_KINDS`, `getCharacterKindIds`, `getAllAreaIds`, `resolveShadow`,
   `defaultEntityShadow`, the editor systems themselves) is imported through the existing
   alias. No new shared package; no code duplication.

3. **Save model = auto-write via dev Vite plugins, everywhere.** Register the existing
   `vite-plugins/object-shape-save.ts`, `character-shape-save.ts`, and `collision-save.ts`
   in `tools/editor/vite.config.ts`. Add area + dialogue save endpoints (reusing the
   `exportTypeScript` serializer for areas) so the Map and Dialogue tabs auto-write too.
   **Risk to verify:** the plugins write to repo-relative paths (`src/data/*.json`,
   `staged/collision/*.json`) — confirm those resolve to the **repo root**, not
   `tools/editor/`, when Vite runs from the editor root; pin the write base if not.

4. **Publish boundary, two layers.** (a) The editor stays a separate Vite app — never
   imported by the root `index.html`, never added to the root build, so it never lands in
   the Pages `dist/`. (b) Removing the editor-system imports from `GameScene` takes the
   authoring code **out** of the published game bundle as a bonus. Add a guard/test so a
   future import of an editor system from game `src/` is caught.

5. **Targets are pickers, not params.** Each tab populates its selector from the canonical
   registry at load: areas → `getAllAreaIds()`; object kinds → `Object.keys(OBJECT_KINDS)`;
   characters → `getCharacterKindIds()`. The URL-param grammar is retired.

---

## High-Level Technical Design

```
tools/editor (the one home, local-only :5174)
├─ index.html / src/main.ts ── tab bar: Map · Dialogue · Flow · Collision · Shadow
│
├─ Canvas-2D tabs (today)            ├─ Phaser-hosted tabs (new)
│   Map (mapRenderer.ts)             │   EditorScene (minimal Phaser.Scene)
│   Dialogue (dialogueRenderer.ts)   │     ├─ CollisionEditorSystem   (verbatim from @game)
│   Flow (flowRenderer.ts)           │     ├─ ObjectShapeEditorSystem (verbatim from @game)
│                                    │     └─ ShadowEditorSystem      (verbatim from @game)
│
└─ vite.config.ts ── registers dev save plugins (apply:'serve'):
      /__object-shape/save   → src/data/object-shapes.json
      /__character-shape/save→ src/data/character-shapes.json
      /__collision/save      → staged/collision/<area>.json
      /__area/save (new)     → src/data/areas/<id>.ts  (via exportTypeScript serializer)
      /__dialogue/save (new) → dialogue data file

game (published; Pages)
└─ GameScene.ts ── editor-system imports + ?editor= dispatch REMOVED
   sandbox.ts ──── keeps ?scenario= / ?sandbox= (testbench), drops ?editor=
```

*Directional guidance for review, not implementation spec.*

---

## Implementation Units

### U1. Editor-owned Phaser scene host

**Goal:** Give `tools/editor` a minimal Phaser scene that can mount any of the three
editor systems, load the textures they need, and suppress gameplay — the substrate the
Collision and Shadow tabs render on.

**Dependencies:** none.

**Files:**
- `tools/editor/src/editorScene.ts` (new) — minimal `Phaser.Scene`: preload required
  atlases/textures, expose a mount point for an editor system, suppress update loop.
- `tools/editor/src/phaserHost.ts` (new) — boots the Phaser game into a container `div`,
  tears it down on tab switch.
- `tools/editor/package.json` — add `phaser` dependency (same version as root).
- `tools/editor/src/main.ts` — wire a container element for the Phaser canvas.

**Approach:** Mirror how the game boots Phaser but with no gameplay scenes — only
`EditorScene`. Reuse texture/atlas loading helpers from `@game` where they exist; load
only what the active tool needs (object atlas for object/shadow-object; character atlas
for shadow-character). Tear down and recreate the Phaser game on tab enter/leave to keep
input/camera state clean.

**Patterns to follow:** the game's Phaser boot in `src/main.ts` / scene preload; the
existing tab-switch orchestration in `tools/editor/src/main.ts`.

**Test scenarios:**
- Mounting `EditorScene` with no system creates a canvas and does not throw.
- Switching away tears down the Phaser game (no leaked canvas / RAF loop).
- Required textures for a given tool are present before the system mounts (no missing-frame
  render).

**Verification:** A blank Collision/Shadow tab shows a working Phaser canvas with camera
pan, and leaving the tab disposes it.

---

### U2. Collision tab (host ObjectShapeEditorSystem + CollisionEditorSystem)

**Goal:** A Collision tab that lets you pick an **area** (per-area passability) or an
**object kind** (sub-cell object collision) and edit it with the existing systems, on the
U1 scene.

**Dependencies:** U1.

**Files:**
- `tools/editor/src/tabs/collisionTab.ts` (new) — selector (area vs object kind) +
  mounts `CollisionEditorSystem` or `ObjectShapeEditorSystem` from `@game/systems/*`.
- `tools/editor/src/main.ts` — register the tab in the nav.
- Reuses (no edit): `src/systems/collisionEditor.ts`, `src/systems/objectShapeEditor.ts`.

**Approach:** Populate the object picker from `Object.keys(OBJECT_KINDS)` and the area
picker from `getAllAreaIds()` (both via `@game`). On selection, instantiate the matching
system with the U1 scene + the selected target (compute `AreaPassability` for the area
case the same way the game seeds it). No param parsing.

**Patterns to follow:** how `GameScene.create()` constructs each system today (constructor
args), replicated against the editor scene.

**Test scenarios:**
- Selecting an object kind mounts `ObjectShapeEditorSystem` and renders that kind's sprite.
- Selecting an area mounts `CollisionEditorSystem` with the area's grid dimensions.
- Switching target re-mounts cleanly (previous system disposed).
- An unknown/empty selection is a no-op, not a crash.

**Verification:** Edit a rock's sub-cell collision and an area's passability entirely from
the tab — no URL params.

---

### U3. Shadow tab (host ShadowEditorSystem, object + character)

**Goal:** A Shadow tab with a target toggle (object | character) and a kind picker, hosting
`ShadowEditorSystem` for both families.

**Dependencies:** U1.

**Files:**
- `tools/editor/src/tabs/shadowTab.ts` (new) — target toggle + kind picker + mounts
  `ShadowEditorSystem` from `@game/systems/shadowEditor`.
- `tools/editor/src/main.ts` — register the tab.
- Reuses (no edit): `src/systems/shadowEditor.ts`, `src/maps/shadows.ts`,
  `src/maps/characters.ts`.

**Approach:** Object kinds from `Object.keys(OBJECT_KINDS)`; character kinds from
`getCharacterKindIds()`. Instantiate `new ShadowEditorSystem(scene, target, kind)` exactly
as `GameScene` does, swapping target/kind on selection. The live preview uses the shared
`resolveShadow` path, so it matches the game (ledger lesson preserved).

**Test scenarios:**
- Object target: picking a kind renders its sprite + draggable shadow handles.
- Character target: `pip` and each NPC kind render with the character reference point.
- Toggling target swaps the kind list and re-mounts the system.

**Verification:** Author an object shadow and a character (pip) shadow from the tab; preview
matches what `resolveShadow` produces in game.

---

### U4. Register dev save plugins in the editor's Vite config

**Goal:** All auto-writing tabs persist through the editor's own dev server, writing to the
correct repo paths.

**Dependencies:** U2, U3 (the tabs that POST to these endpoints).

**Files:**
- `tools/editor/vite.config.ts` — import and register `objectShapeSave`,
  `characterShapeSave`, `collisionSave` from `../../vite-plugins/*` (apply:'serve').
- `vite-plugins/object-shape-save.ts`, `character-shape-save.ts`, `collision-save.ts` —
  only if path resolution needs to be made root-relative (see Decision 3 risk).

**Approach:** Reuse the existing plugin modules as-is if their write paths resolve to repo
root from the editor's working dir; otherwise parameterize the write base so both the root
server and the editor server write to the same files. Verify the read-merge-write behavior
(preserving other kinds + `_doc`) still holds when driven from the editor.

**Test scenarios:**
- POST to `/__object-shape/save` from the Collision tab writes `src/data/object-shapes.json`
  at repo root and preserves untouched kinds.
- POST to `/__character-shape/save` from the Shadow tab writes `src/data/character-shapes.json`.
- POST to `/__collision/save` writes `staged/collision/<area>.json` at repo root.
- A save from the editor server lands in the same file a save from the root game server would.

**Verification:** Edits made in the editor app appear in the committed data files and load
in the real game.

---

### U5. Auto-save for Map (area) and Dialogue tabs; retire copy-paste as primary path

**Goal:** Bring the two legacy copy-paste tabs onto the unified auto-write model.

**Dependencies:** U4.

**Files:**
- `vite-plugins/area-save.ts` (new) — `/__area/save` writes `src/data/areas/<id>.ts` using
  the `exportTypeScript` serializer server-side (or accept serialized text from the client).
- `vite-plugins/dialogue-save.ts` (new) — `/__dialogue/save` writes the dialogue data file.
- `tools/editor/vite.config.ts` — register the two new plugins.
- `tools/editor/src/main.ts` / `mapRenderer.ts` / `dialogueRenderer.ts` — replace the
  Export-TS modal trigger with an auto-save call; keep "Export TypeScript" available as a
  manual fallback (non-primary).
- `tools/editor/src/exportTypeScript.ts` — reused as the area serializer.

**Approach:** Keep the serializer as the single source of the TS shape; the endpoint just
writes the serialized output to the area module file. Dialogue similarly. Manual export
stays as an escape hatch but is no longer the only way to persist.

**Test scenarios:**
- Editing terrain/objects then saving writes a valid `src/data/areas/<id>.ts` that compiles.
- Saving an area preserves areas not being edited.
- Dialogue edit saves to the dialogue data file and reloads in the editor.
- The manual "Export TypeScript" fallback still produces identical output to the serializer.

**Verification:** A map edit round-trips to the area module and `npm run build` (typecheck)
passes; a dialogue edit round-trips.

---

### U6. Unified nav + landing

**Goal:** One recognizable front door listing every tool, so nothing is reached by URL.

**Dependencies:** U2, U3, U5.

**Files:**
- `tools/editor/src/main.ts` — extend the tab bar to Map · Dialogue · Flow · Collision ·
  Shadow with a short description per tool; default landing names the tools.
- `tools/editor/src/style.ts` — nav styling for the added tabs.
- `tools/editor/index.html` — any static nav scaffold.

**Approach:** Extend the existing tab orchestration (don't invent a new router). Each tab's
selector is self-describing (lists targets), so the whole tool surface is discoverable from
the UI.

**Test scenarios:**
- All five tabs are present and switch without leaking the Phaser host (ties to U1 teardown).
- Each tab's target picker is populated from the live registries.

**Verification:** From a cold `npm run dev` in `tools/editor`, every tool is reachable by
clicking — zero URL params anywhere.

---

### U7. Remove `?editor=` authoring from the shipped game; lock the Pages boundary

**Goal:** Take editor code out of the published game and prevent regressions that would put
it (or the editor app) on Pages.

**Dependencies:** U2, U3 (the in-game path must be fully replaced before removal).

**Files:**
- `src/scenes/GameScene.ts` — remove the three editor-system imports and the
  `?editor=`-conditional mounts (`editorActive` / `objectEditorActive` / `shadowEditorActive`).
- `src/sandbox.ts` — drop `editor` / `target` / `kind` param handling; keep
  `scenario` / `sandbox`.
- `src/scenes/TitleScene.ts` — drop `applyEditor()`; keep `applyScenario()`.
- `tools/editor/README.md` (new or updated) — "local-only dev tool; never deploy."
- A lightweight guard test (see below).

**Approach:** Confirm no remaining game-runtime references to the editor systems, then
remove. The systems stay in `src/systems/` (the editor app imports them via `@game`), they
just stop being pulled into the game bundle. Add a guard test asserting the game entry graph
(from `index.html` / `src/main.ts`) does not import any `*EditorSystem`, so a future
accidental import is caught.

**Test scenarios:**
- Booting the game with `?editor=shadow&...` no longer enters an editor (param is inert).
- `?scenario=` / `?sandbox=` testbench still works unchanged.
- Guard: the game's production entry module graph contains no `*EditorSystem` import.
- The root `npm run build` output (`dist/`) contains no `tools/editor` assets.

**Verification:** `npm run build` succeeds; the published bundle no longer includes editor
systems; the editor app still mounts all tools (because it imports them via `@game`).

---

## System-Wide Impact

- **Game bundle shrinks** and `?editor=` is no longer reachable on the live site — a small
  security/cleanliness win.
- **One dev workflow:** `cd tools/editor && npm run dev` for *all* authoring; the root dev
  server is for *playing/testing* the game.
- **Save consistency:** every tool auto-writes to the same committed data files the game
  reads, through the same dev-plugin mechanism.
- **No player-facing change** → GATE 1 (this plan + Director's Brief) is the gate; no GATE 2
  unless a tool's own visual output later needs review.

---

## Risks & Mitigations

- **Save-path resolution from the editor root** (Decision 3 / U4): plugins may write
  relative to `tools/editor/` instead of repo root. *Mitigation:* verify first; pin the
  write base in the plugins if needed; U4 tests assert the file lands at repo root.
- **Texture/atlas loading in the editor scene** (U1): the editor must load exactly the
  assets a tool needs. *Mitigation:* reuse game preload helpers; load per active tool;
  U1 test asserts frames present before mount.
- **Phaser version drift** between root and editor: *Mitigation:* pin `phaser` in the
  editor to the root version.
- **Removing the in-game path prematurely** (U7): *Mitigation:* U7 depends on U2/U3 being
  done and verified, so the replacement exists before removal.

---

## Verification Strategy

- Per-unit tests above (auto-write round-trips, mount/teardown, registry-driven pickers,
  Pages-boundary guard).
- `npm run build` (typecheck + build) green for the **game** after U7.
- `tools/editor` builds and runs; all five tools operable with zero URL params.
- Manual round-trip: author an object collision, an object shadow, a character shadow, an
  area edit, and a dialogue edit from the editor → confirm each lands in its data file and
  loads in the real game.
- Self-merge gates (mechanical build, boot smoke, cold PR-review) apply as usual; no GATE 2
  needed (dev-tooling, no player-facing visual change).
