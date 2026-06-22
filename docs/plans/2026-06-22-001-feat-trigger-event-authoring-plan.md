---
title: "feat: Trigger/event authoring tab (editor P3)"
type: feat
status: active
created: 2026-06-22
epic: full-editor (P3 — the real story unlock) — epic #188
issue: 187
origin: autonomy/roadmap/p3-trigger-authoring.md
depth: deep
---

# feat: Trigger/event authoring tab — editor Phase 3

**Target repo:** `Jaxsbr/emberpath` (this repo). All paths repo-relative.

## Problem frame

Triggers — the logic that turns a placed object into a *story beat* (enter this zone →
if you carry the ember → fire this thought, set this flag, move the objective) — can only
be authored by hand-writing `TriggerDefinition` objects in a TypeScript area file
(`src/data/areas/*.ts`). That is the single biggest barrier between "an idea for a scene"
and "a playable scene," and it sits squarely in Jaco's stated weak spot (dialogue/triggers/
story-maps) and my load (see origin: `autonomy/roadmap/p3-trigger-authoring.md`, msg #1130).

P3 adds a **Triggers tab** to the existing local-only editor that lets a non-coder place a
trigger zone on the map, compose its condition and effect from the game's *existing*
vocabulary, preview it live, and save it as data — with the authored data driving the
**same runtime** the hand-written triggers drive (no fork).

## What the research established (so the plan is grounded, not guessed)

- **Trigger data is already pure JSON.** `TriggerDefinition` (`src/data/areas/types.ts:139`)
  is `{ id, col, row, width, height, type, actionRef, condition?, setFlags?, incrementFlags?,
  repeatable, light? }` — no functions/closures. It is authorable as data today; the only
  reason it lives in `.ts` is that area files are `.ts`.
- **The runtime already consumes a plain array.** `new TriggerZoneSystem(this.area.triggers, …)`
  (`src/scenes/GameScene.ts:754`). If `area.triggers` is `[...inline, ...authored]`, nothing
  in the engine changes.
- **Conditions are an AND-only string grammar** (`src/systems/conditions.ts`): clauses of
  `flag <op> value` joined by `AND`, ops `== != >= > <= <`. No OR, no parens, no NOT.
  "Proximity" is not a condition — it *is* the trigger's rectangular zone. "Item carried" /
  "dialogue completed" are just flags the condition reads.
- **Effects = the `type` dispatch + side-effects:** `dialogue` (looks up `area.dialogues[actionRef]`),
  `story` (`area.storyScenes[actionRef]` via `launchStoryScene`), `thought` (inline text),
  plus `setFlags` / `incrementFlags`, plus an optional `light: LightSpec` placed at the zone
  centre. **"Objective swap" needs NO new effect** — `conditionalObjective` is already
  evaluated in `GameScene` (`src/scenes/GameScene.ts:2256–2275`) and re-runs on flag change,
  so a trigger that sets a flag *already* moves the objective banner.
- **The editor tab pattern is proven.** `PhaserTab` base (`tools/editor/src/tabs/phaserTab.ts`)
  + tab registration in `tools/editor/src/main.ts`; the Map renderer *already draws trigger
  zones read-only* (`tools/editor/src/mapRenderer.ts`, `TRIGGER_COLORS`). Saves go through
  dev-only vite plugins that read-merge-write JSON (`vite-plugins/object-shape-save.ts` is the
  template). `@game/*` alias means the editor previews with the game's own code. The
  `test/pages-boundary.test.ts` guard keeps all of this out of the published build.

This is the lesson in `docs/solutions/implementation/authoring-tool-shares-render-math.md`
applied a **fourth** time (object shadow → character shadow → character collision → triggers):
one shared math/runtime, authored data overrides by precedence, one editor serves the family
via a param, RESIZE 1:1 capture. Read that lesson before building.

---

## The three GATE-1 direction decisions (the Director's Brief surfaces these)

### Decision A — How authored triggers are persisted (the data-model fork)

| Option | Shape | Trade-off |
|---|---|---|
| **A-a (recommended)** | **JSON sidecar per area**, `src/data/areas/triggers/<areaId>.json`, that the area module imports and spreads: `triggers: [...inlineTriggers, ...authoredTriggers]`. Read-merge-write save plugin, exactly like `object-shapes.json`. | Pure data, no codegen. **Zero-regression**: an area with no sidecar is byte-identical to today. Triggers migrate into the tool one area at a time. Matches the proven `object-shapes.json` pattern. Con: two homes for triggers during migration (inline + sidecar) until an area is fully migrated. |
| A-b | **Staged JSON + porter script** (the collision `U3` model): editor writes `staged/triggers/<areaId>.json`, a `.cjs` script ports into the `.ts`. | Keeps a single home (the `.ts`) but adds a manual port step every save — slower author loop, more ceremony. |
| A-c | **Direct `.ts` codegen** — the save plugin rewrites the area's `triggers: [...]` block. | Single home, no spread. But rewriting hand-formatted TS is brittle (comments, ordering, formatting churn) and risks clobbering inline authoring. Highest regression risk. |

**Recommended: A-a.** It's the pattern we've shipped three times, it's the only option with
a true zero-regression guarantee, and the runtime already takes a plain array so the spread
is a one-liner.

### Decision B — How a non-coder composes a condition + effect (the UX fork)

| Option | Shape | Trade-off |
|---|---|---|
| **B-a (recommended)** | **Structured form that compiles to the existing data.** Condition = rows of `[flag ▾][op ▾][value]` joined by AND, compiled to the exact `evaluateCondition` string on save (and parsed back from it on load). Effect = a typed panel: `type ▾` (dialogue/story/thought/set-flag/light) → an `actionRef` **autocomplete** drawn from the area's existing `dialogues`/`storyScenes` ids (or a text box for thought), plus `setFlags`/`incrementFlags` rows and an optional light sub-form. | No runtime change — it reads/writes the same string + fields the engine already parses. Keeps non-coders out of syntax. Validates refs at author time. Con: the form must faithfully round-trip the grammar (covered by unit tests). |
| B-b | **Raw string + raw JSON fields** the author types directly. | Trivial to build, but it *is* code again — defeats the non-coder goal. |
| B-c | **Visual node graph** (conditions/effects as wired nodes). | Powerful, but heavy to build and over-scoped for an AND-only grammar with ~5 effect types. A later enhancement, not P3. |

**Recommended: B-a.** It matches the grammar's real capability, removes syntax from the
author's hands, and changes nothing in the runtime.

### Decision C — Effect vocabulary scope for v1 (the scope fork)

The runtime supports today, and the tab will author in v1: **dialogue · story · thought ·
set/increment flag · light · (objective-swap for free via flags).** The origin spec also lists
**"light/tint change"** and **"spawn/redirect"** as desired effects — these are **not runtime
effects yet** (there is no "lift the world tint" trigger effect; no spawn/warp-as-effect).

| Option | Shape | Trade-off |
|---|---|---|
| **C-a (recommended)** | **v1 authors only the effects the runtime already has.** The Ashen-Crossing tint-lift acceptance demo is met with a **flag the existing tint/lighting reads** (or a Tier-2 light at the bridge), not a brand-new effect. New effects (world-tint, spawn/redirect) become their own follow-up issues — they are *game-systems* work, separable from the *authoring* work. | Ships the authoring tool fast on a stable runtime; no engine risk. Con: the literal "tint lifts grey→gold" beat may need a tiny runtime hook (a flag the world-tint already honors) — surfaced honestly, scoped as a small add or a follow-up. |
| C-b | **v1 also adds the missing runtime effects** (world-tint effect + spawn/redirect) so every spec effect is authorable now. | One-stop, but couples editor work to new engine features and multiplies risk/scope on the largest phase. |

**Recommended: C-a**, with a small in-scope check that the Ashen-Crossing demo is reachable
with existing primitives (flag → existing tint), and any genuinely-missing world-effect filed
as a follow-up rather than bolted onto P3.

> The Director's Brief carries A/B/C as the direction questions with these recommended
> defaults + an explicit "Other." No `/ce-work` until Jaco picks.

---

## Scope boundaries

**In scope (v1):** a Triggers editor tab; place/move/resize a trigger zone on the area grid;
edit `id`, `type`, `repeatable`; compose `condition` (clause builder) and effect/side-effects
(typed form with ref autocomplete); optional light sub-form; live overlay preview using the
game's own renderer; save via a new dev-only vite plugin into the chosen data home (Decision A);
load existing triggers back into the form (round-trip); validation (unique id, valid actionRef,
parseable condition); a testbench scenario proving an authored trigger fires end-to-end.

### Deferred to follow-up work
- New runtime **effects** that don't exist yet: world-tint-lift-as-effect, spawn/redirect/warp
  Pip-as-effect (file as separate `type:feature` issues if the Ashen demo proves they're wanted).
- **Exit/transition authoring** (`ExitDefinition`) — sibling of triggers, its own tab/phase.
- **OR/NOT/paren** condition grammar — only if authoring demand appears; a runtime parser change.
- **Dialogue/story *content* authoring** from inside the trigger tab (the Dialogue/Flow tabs own that;
  the trigger tab only *references* existing dialogue/story ids).
- Auto-save / retiring the inline-TS path entirely (that's P4 / #184).

**Outside the product's identity:** a general-purpose event-scripting engine. This authors
emberpath's specific allegory beats with its existing vocabulary, nothing more.

---

## Output structure (new files)

```
tools/editor/src/tabs/triggerTab.ts            # PhaserTab subclass (registration + target state)
tools/editor/src/systems/triggerEditor.ts      # the editor system: zone drag, form, preview, save
tools/editor/src/triggerForm.ts                # condition clause-builder + effect form (compile/parse)
vite-plugins/trigger-save.ts                   # dev-only read-merge-write save endpoint
src/data/areas/triggers/<areaId>.json          # authored-trigger sidecar(s)  [Decision A-a]
src/data/areas/authored-triggers.ts            # tiny loader: import sidecars, expose by areaId
test/triggerForm.test.ts                       # condition/effect compile↔parse round-trip
test/conditions.test.ts                        # (extend) compiled strings evaluate as intended
src/scenarios/authored-trigger-demo.ts         # testbench scenario for end-to-end verify
```

(Exact filenames may shift in implementation; per-unit `Files:` are authoritative.)

---

## Implementation units

### U1. Condition + effect model: compile ⇄ parse (pure, tested first)
**Goal:** A pure module that converts between the structured form model
(`{clauses:[{flag,op,value}], effect:{type,actionRef,setFlags,incrementFlags,light}}`) and the
exact on-disk `TriggerDefinition` (condition *string* + fields) the runtime already consumes.
**Requirements:** Decision B-a; the round-trip invariant is the whole tool's correctness floor.
**Dependencies:** none.
**Files:** `tools/editor/src/triggerForm.ts`, `test/triggerForm.test.ts`.
**Approach:** `compileCondition(clauses) → string` produces strings byte-compatible with
`src/systems/conditions.ts` (same ops, AND join, value coercion). `parseCondition(string) →
clauses` is its inverse and must accept every string the existing area files already use (audit
`ashen-isle.ts` / `fog-marsh.ts` conditions as fixtures). Effect compile/parse maps the typed
panel to `{type, actionRef, setFlags, incrementFlags, light}`. Reuse the game's grammar
constants — do **not** define a second operator list.
**Execution note:** test-first — write the round-trip table before the implementation.
**Patterns to follow:** `src/systems/conditions.ts` (the grammar source of truth).
**Test scenarios:**
- Each op compiles and parses back identically (`==`,`!=`,`>=`,`>`,`<=`,`<`).
- Multi-clause AND round-trips clause order and count.
- Value coercion: `true`/`false`/number/string author-input → correct typed string → back.
- Every condition string currently in `src/data/areas/*.ts` parses without loss (fixtures).
- Effect: dialogue/story/thought/set-flag/light each compile to the right `TriggerDefinition`
  fields and parse back.
- Invalid input (empty flag, unknown op, unparseable string) yields a typed error, not a throw.

### U2. Trigger sidecar data home + loader (Decision A-a) with zero-regression spread
**Goal:** Establish the authored-trigger JSON home and wire areas to spread it, such that an
area with no sidecar is byte-identical to today.
**Requirements:** Decision A-a; zero-regression migration.
**Dependencies:** none (parallel with U1).
**Files:** `src/data/areas/authored-triggers.ts`, `src/data/areas/triggers/.gitkeep`,
one area module edited to spread (e.g. `src/data/areas/ashen-isle.ts`), `test/authored-triggers.test.ts`.
**Approach:** `authored-triggers.ts` imports the sidecar JSONs (Vite glob or explicit map) and
exposes `getAuthoredTriggers(areaId): TriggerDefinition[]` (`[]` when none). The area module sets
`triggers: [...inlineTriggers, ...getAuthoredTriggers('ashen-isle')]`. Validate at load: unique
`id` across the merged array (throw in dev, the `_trigger_fired_<id>` keying depends on it).
**Patterns to follow:** `src/data/object-shapes.json` + how `object-shapes` is loaded and merged.
**Test scenarios:**
- No sidecar → merged `triggers` deep-equals the original inline array (zero regression).
- A sidecar with one trigger → appended once, in order.
- Duplicate id between inline and sidecar → throws a clear error in dev.
- The JSON shape validates against `TriggerDefinition` (type guard).

### U3. `trigger-save` vite plugin (dev-only, read-merge-write)
**Goal:** A `/__trigger/save` dev endpoint that persists one area's authored triggers to its
sidecar without disturbing other data.
**Requirements:** Decision A-a; save-to-data plumbing.
**Dependencies:** U2 (the file home/shape it writes).
**Files:** `vite-plugins/trigger-save.ts`, register in `tools/editor/vite.config.ts`,
`test/trigger-save.test.ts` (payload validation/sanitization unit).
**Approach:** Mirror `vite-plugins/object-shape-save.ts`: `apply:'serve'`; POST
`{ areaId, triggers: TriggerDefinition[] }`; sanitize `areaId` (`^[a-z0-9-]+$`, no traversal);
read-merge-write `src/data/areas/triggers/<areaId>.json` preserving a `_doc` note; return
`{ ok, path, count }`. Validate each trigger server-side (shape + unique id) before writing.
**Patterns to follow:** `vite-plugins/object-shape-save.ts`, `vite-plugins/collision-save.ts`.
**Test scenarios:**
- Valid payload writes the sidecar and returns `{ok:true,count}`.
- `areaId` with `../` or bad chars → 400, nothing written.
- Malformed trigger (missing `type`/coords) → 400, nothing written.
- Second save to the same area replaces its set, leaves other areas' sidecars untouched.

### U4. Triggers tab + zone authoring (place / move / resize on the grid)
**Goal:** Register a Triggers tab that boots the area in the editor's Phaser host and lets the
author create a zone, drag it, and resize it — at tile granularity — with the live trigger
overlay the map renderer already draws.
**Requirements:** in-scope zone authoring; "previewed live."
**Dependencies:** U2 (data to load).
**Files:** `tools/editor/src/tabs/triggerTab.ts`, `tools/editor/src/systems/triggerEditor.ts`,
register in `tools/editor/src/main.ts` (+ the tab button/view in the editor HTML/CSS).
**Approach:** `TriggerTab extends PhaserTab`; `mountSystem` returns a `TriggerEditorSystem` that
loads `getArea(areaId)`, draws existing triggers (reuse `TRIGGER_COLORS` semantics), supports
create-zone (click-drag a rect), select, move, and resize-handle — all snapped to `{col,row}`
tile coords (never sub-cell; matches runtime AABB). RESIZE 1:1 mapping for precise capture.
**Patterns to follow:** `tools/editor/src/tabs/collisionTab.ts` +
`tools/editor/src/systems/characterCollisionEditor.ts` (rect-drag + move/E/S handles already
solved there), `tools/editor/src/mapRenderer.ts` (trigger overlay draw).
**Test scenarios:** *(interaction-heavy; cover the pure bits + verify the rest via U7 capture)*
- Tile-snap math: a pixel drag resolves to the expected `{col,row,width,height}`.
- Loading an area with N triggers yields N selectable overlays.
- Resize never produces zero/negative width/height (clamped to ≥1 tile).

### U5. Condition + effect authoring panel (the form) wired to U1
**Goal:** A side panel on the Triggers tab to edit the selected trigger's `id`/`type`/
`repeatable`, build its condition via clause rows, and compose its effect via the typed form
with `actionRef` autocomplete — using U1 to compile/parse.
**Requirements:** Decision B-a; ref validation.
**Dependencies:** U1, U4.
**Files:** `tools/editor/src/triggerForm.ts` (UI binding; compile/parse core from U1 — keep the
pure core and the DOM binding cleanly separated), `tools/editor/src/systems/triggerEditor.ts` (wire-in).
**Approach:** Clause rows = `[flag ▾ (datalist of known flags)] [op ▾] [value]`, add/remove,
AND-joined preview of the compiled string shown read-only for transparency. Effect panel:
`type ▾` switches the sub-form; dialogue/story show an `actionRef` autocomplete sourced from
`Object.keys(area.dialogues)` / `area.storyScenes`; thought shows a text box; set-flag rows;
optional light sub-form (radius/intensity/tier with defaults pre-filled). Invalid ref →
inline warning, save disabled.
**Patterns to follow:** existing HUD-building in `characterCollisionEditor.ts` (`hudParent`).
**Test scenarios:** *(pure form logic in U1; here cover binding glue)*
- Selecting a trigger populates every field from its `TriggerDefinition` (round-trip via U1).
- Switching effect `type` swaps the sub-form and clears stale fields.
- An `actionRef` not present in the area's dialogues/storyScenes flags invalid + blocks save.
- Known-flags datalist is populated from flags referenced across the area's triggers/dialogues.

### U6. Save wiring + load round-trip (tab → plugin → sidecar → reload)
**Goal:** "Save" on the tab POSTs the area's authored triggers to `/__trigger/save`; reloading
the tab reads them back into identical form state.
**Requirements:** the full author loop; round-trip integrity.
**Dependencies:** U3, U5.
**Files:** `tools/editor/src/systems/triggerEditor.ts` (save/load), small fetch helper.
**Approach:** Save serializes the in-memory trigger set (compiled via U1) and POSTs. On tab
activate, load the sidecar (if any) merged with the area's inline triggers for display, but only
**authored** triggers are editable/saved (inline ones shown read-only/greyed to avoid the A-a
"two homes" confusion). Show a save toast with the returned path + count.
**Patterns to follow:** the fetch+toast in `objectShapeEditor`/`characterCollisionEditor` save paths.
**Test scenarios:**
- Author → save → reload → every field deep-equals what was authored (the core invariant).
- Inline triggers render but are not editable/savable (no accidental migration/clobber).
- Save failure (plugin 400) surfaces an error toast and does not lose in-progress edits.

### U7. End-to-end verification: testbench scenario + the Ashen-Crossing demo
**Goal:** Prove an *authored* trigger drives the live game identically to a hand-written one,
and that the Ashen-Crossing tint-lift acceptance beat is reachable with existing primitives
(Decision C-a).
**Requirements:** origin acceptance ("author a non-trivial trigger chain entirely in the editor;
it drives the live game identically; zero regression").
**Dependencies:** U6.
**Files:** `src/scenarios/authored-trigger-demo.ts`, register in `src/scenarios/registry.ts`,
`docs/testbench.md` (document the scenario), `docs/workflow/…` n/a.
**Approach:** Author (in the tool) a small chain — *enter bridge zone → if `has_ember == true`
→ set `ashen_crossed=true` + fire a thought* — save it to the sidecar, then a `?scenario=` boot
that sets `has_ember`, walks Pip into the zone, and asserts the thought fires + flag flips +
(if the world-tint already reads `ashen_crossed`) the tint lifts. If the tint does **not** yet
read a flag, record that gap as a follow-up issue (do not bolt the effect on here).
**Execution note:** capture is the hard gate — **MP4 for the motion** (Pip enters, beat fires),
still acceptable only for static form. Run headless before the PR.
**Test scenarios:**
- Boot scenario → authored trigger fires exactly once (one-shot via `_trigger_fired_<id>`).
- Same beat authored in-tool vs hand-written in TS produces identical runtime behavior.
- Re-enter after fire → does not re-fire (unless `repeatable`).
- An area with no sidecar shows zero behavioral change (regression guard, ties U2).

---

## System-wide impact
- **Runtime:** none required for v1 (objective-swap already reactive; tint-lift handled by an
  existing-flag read or deferred). The only `src/` change is the one-line `triggers` spread in
  migrated area modules (U2) + the sidecar loader — both guarded zero-regression.
- **Editor build only:** new tab/system/form/plugin live under `tools/editor/` + `vite-plugins/`,
  excluded from Pages by `test/pages-boundary.test.ts` (must stay green — `src/` must not import
  the editor).
- **Authors (Jaco, me):** the inline-TS trigger path keeps working throughout; the tool is
  additive until P4 retires the old path.

## Risks & mitigations
- **Condition round-trip drift** (form ⇄ string) → U1 is pure + test-first with every existing
  area condition as a fixture; the compiled string is shown read-only in the form for transparency.
- **"Two homes" confusion** (inline TS + sidecar) during migration → U6 renders inline triggers
  read-only/greyed; only authored ones are editable; uniqueness validated at load (U2).
- **Trigger id collisions** breaking the `_trigger_fired_<id>` one-shot key → dev-time unique-id
  throw (U2) + server-side validation (U3).
- **Acceptance demo needs a missing effect** (literal tint-lift) → Decision C-a: meet it with an
  existing-flag read or file a scoped follow-up; do not expand P3 into engine-effect work.
- **Pages-boundary regression** → the guard test is part of every unit's gate.

## Verification (definition of done for the phase)
Build clean (root + editor `tsc`/`vite`) · vitest green incl. new round-trip + zero-regression
tests · `test/pages-boundary.test.ts` green · the authored-trigger testbench scenario passes
headless with an **MP4** of the beat firing · cold `emberpath-pr-review` APPROVE per PR · this is
dev-tooling (no GATE-2 art gate) **except** any visible in-game beat the demo introduces, which
takes GATE-2 · `/ce-compound` updates `authoring-tool-shares-render-math.md` (fourth family) ·
ship report states **Reviewed ✅ + Compounded ✅** (the confidence gate, #1136).

## Open questions for GATE 1 (Jaco)
1. **Decision A** — persistence: sidecar-spread (A-a, recommended) / staged+porter (A-b) / TS codegen (A-c)?
2. **Decision B** — condition+effect UX: structured form (B-a, recommended) / raw fields (B-b) / node graph (B-c)?
3. **Decision C** — v1 effect scope: existing-effects-only + flag-driven tint (C-a, recommended) /
   also build new runtime effects now (C-b)?
