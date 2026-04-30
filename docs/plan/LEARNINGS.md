# Compound Engineering — Project Learnings

> Project-specific learnings from using the semi-autonomous build system.
> Each entry records a failure, its class, what was done about it, and where prevention was added.
> Agents read both this file AND the plugin baseline (`${CLAUDE_PLUGIN_ROOT}/docs/LEARNINGS.md`).
>
> **Scope filtering:** Each entry has a `Scope` field — either `universal` (applies to all project types) or a domain tag (e.g., `phaser-game`). Entries without an explicit `Scope` field are `universal` by default.

---

### Learning EP-01 — Loop-invariant operations and dead guard conditions

**Failure class:** `edit-policy-drift`

**Description:** Across three consecutive phases (bone-chain, rig-editor, editor-ux), code drifted from clean practice in different but related ways: (1) misleading comments overstating what the runtime does (bone-chain: rotation propagation comment); (2) reusing a runtime component without overriding behavioral assumptions inappropriate for the new context (rig-editor: `WalkRunController` walk-to-run delay); (3) loop-invariant setup called inside a loop (editor-ux: `lineStyle()` per edge instead of once per redraw); (4) dead guard conditions that evaluate to the same outcome regardless of branch taken (editor-ux: `if (isDragging && dragBoneName)` guard with unconditional reset after).

**What was done:** All instances caught in PR review and resolved before merge. No behavioral defects shipped.

**Prevention point:** During implementation task scoping, the brief should call out: "Before submitting, check for (a) setup operations that run every loop iteration but only need to run once per invocation, (b) conditional branches where both outcomes produce the same result, (c) comments that reference behavior no longer present in the code, and (d) method or function names that imply a different return-type or contract than what the implementation provides."

**Scope:** universal

---

### Learning EP-02 — Phaser scene.restart hygiene: instance-field GameObject references

**Failure class:** `scene-lifecycle-leak`

**Description:** `scene.restart` does NOT reset class fields. Instance state (Maps, arrays, single refs) persists between runs, but Phaser destroys the referenced GameObjects (Sprites, Tweens, Timers, Particle Emitters) during shutdown. Stale references in fields then point to dead objects. Two failure modes have shipped: (1) npc-behavior PR #14 — `this.anims.create()` fired on every restart producing "key already exists" warnings (fixed with `anims.exists` guards); (2) keeper-rescue post-build-loop — `npcSpritesById` Map held a destroyed sprite from the previous Fog Marsh visit, US-71's new `if (npcSpritesById.has(id)) return null` idempotency guard in `spawnNpcSprite` then skipped fresh creation on re-entry, NpcBehaviorSystem's constructor pulled the destroyed sprite, `runtime.sprite.play()` crashed at the next tick.

**Pattern:** Any class field that holds a Phaser GameObject reference (or a Map/array of them) must be reset explicitly at the top of the corresponding `renderXxx` method. The reset is *especially* required when the field is also touched by a post-construction code path (idempotency guards, runtime spawn, conditional re-render) — those paths turn the implicit "Map.set overwrites" cleanup into a hard skip on stale entries.

**Prevention point:** During the investigate task for any phase that adds or modifies an instance field on a Scene class:
1. Enumerate every `private xxx: Phaser.GameObjects.* | Map<...> | (...)[]` field touched by the change.
2. For each, identify which `renderXxx` / `setupXxx` method is the canonical re-create path on `scene.restart`.
3. Confirm the field is reset (`= []`, `.clear()`, `= null`) at the top of that method, BEFORE any code reads or writes it.
4. If a new idempotency guard is added (`if (this.map.has(id)) return`), audit ALL callers — fresh-restart callers must run AFTER the reset, not before.

**Scope:** phaser-game

---

### Learning EP-03 — Visual stories require an in-engine smoke test before story-completion

**Failure class:** `visual-pick-without-verification`

**Description:** Three consecutive phases shipped visual changes that tsc + `npm run build` could not flag, with the operator catching defects only after running the dev server: (1) `tileset` — frame indices picked from atlas thumbnails were wrong (FENCE was a hammer, DOOR was a window, STONES was a wizard portrait), two reworks; (2) `world-legibility` — initial PROVISIONAL frame picks across both areas plus a post-review fix-up wave (~10 frame constants reassigned), and the PR auto-review independently flagged the same gap; (3) `scene-art-and-thoughts` — US-88 thought bubble shipped with serif glyphs corrupted at mobile zoom (~1.1x camera × NEAREST sampling destroys thin strokes) and the panel padding asymmetric (text origin (0.5, 1) anchored at panel bottom instead of centred), US-89 StoryScene shipped without an agent-side smoke test of the cross-fade or letterbox fit. All caught by operator running the dev server at desktop AND mobile viewports; cost was one rework cycle.

**Pattern:** Any story whose done-when criteria touch tile rendering, sprite swaps, UI panels, scene compositions, animation, or any other on-screen visual output cannot be verified by `npm run build` alone. The compiler proves the code typechecks; it does not prove the pixels read correctly. Phaser-specific failure modes that bite: `pixelArt: true` NEAREST sampling chunks-up thin glyph strokes (serif fonts, anti-aliased details) when the source bitmap is small relative to the rendered size; main-camera zoom varies between mobile (~1.1x) and desktop (~4x), so design-pixel math that works at one ratio overshoots at the other; and visual layout bugs (origin anchors, padding asymmetry, depth-ordering) hide silently behind a green build.

**Prevention point:** The Story Completion Gate (and Phase Completion Gate as a backstop) must require an in-engine smoke test for any story that touches visuals. Concretely, when a story's done-when includes any of these surfaces — `add.image / add.text / add.graphics / add.rectangle / add.sprite`, tile rendering, decoration rendering, NPC sprites/portraits, scene compositions, animations — the agent MUST run `npm run dev` and verify the change in-browser at:
1. Desktop viewport (default ~1280×720, camera zoom ~4x).
2. Mobile viewport (DevTools 360×640 or 414×896, camera zoom ~1.1x).
3. The specific trigger or pathway the story changes (which scene, which trigger, which dialogue).

The smoke-test result must be recorded in the phase log entry as a yes/no with one-line observation per viewport before the story can be added to `completed_stories`. If the agent cannot run a browser (sandbox restriction), the gate hands off to the operator with explicit "needs operator smoke test" status — the story does not auto-complete.

**Scope:** phaser-game

---

### Learning EP-04 — Pattern-reuse criteria must be context-checked at spec time

**Failure class:** `spec-pattern-mismatch`

**Description:** US-88's done-when criterion specced "uses the same design-pixel + zoom-scale pattern as `systems/dialogue.ts`: a private `s(v)` helper that scales design pixels by camera zoom" — prescribing reuse of a pattern from a module rendering on a different camera. `dialogue.ts` targets the UI camera (zoom 1) where `s(v) = v * mainCam.zoom` translates design pixels to canvas pixels for a no-zoom renderer. `thoughtBubble.ts` targets the main camera at variable zoom (1.1x mobile, 4x desktop) — the same math overshoots screen size by `zoom×` and combined with serif fontFamily produces broken glyphs after NEAREST sampling. The criterion was written under the assumption that Module A's pattern would translate to Module B without checking that the rendering context matched.

**Pattern:** When a phase spec says "use pattern X from module Y" or "follow the same approach as module Z", the spec author is implicitly betting that Module Y/Z and the target module share the relevant context. In Phaser specifically, the rendering camera (UI cam at zoom 1 vs main cam at variable zoom) is a hidden axis that determines whether scaling math, font sizes, position offsets, and depth orderings translate. Rule of thumb: a pattern from a UI-camera module does NOT translate verbatim to a main-camera module, and vice versa. The same applies to depth bands (UI elements run at depth 100+ and ignore world-depth conventions; world objects run within a structured depth map).

**Prevention point:** Spec-author skill should check, when prescribing pattern reuse, that the target module shares the rendering context of the reference module. Concretely, for any criterion of the form "use the X pattern from module Y":
1. Identify which camera renders Module Y (search for `uiCam.ignore` or `cameras.main.ignore` flags).
2. Identify which camera will render the target module.
3. If the cameras differ, do not prescribe the pattern verbatim — either adapt the math (multiply/divide by zoom on the relevant axis) or specify a different pattern that fits the target's context.
4. When in doubt, drop the pattern-reuse instruction and let the implementer pick the right approach for the target's renderer.

The compounding form of this rule applies beyond Phaser: any cross-module pattern-reuse instruction in a spec should call out the shared context (rendering pipeline, transaction boundary, async vs sync execution model, etc.) that the reuse depends on, so the implementer can sanity-check the assumption.

**Scope:** phaser-game

---
