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

## EP-05 — Verify which MCP server has remaining budget before firing async generations

**Phase:** tile-architecture (US-95)
**Date:** 2026-04-30

**Description:** Stage 2 of the tile-architecture phase needed 5 PixelLab Wang tilesets via `create_topdown_tileset`. Two PixelLab MCP servers are configured on this machine: `mcp__pixellab__` (personal account) and `mcp__pixellab-team__` (team account). I picked `mcp__pixellab-team__` without checking which had remaining budget. The team account was maxed out — every call (5 initial + 4 rerolls = 9 generations) returned errors: fresh Wang generations failed within seconds with "Unknown error" (immediate API rejection), chained generations reached 90% then returned "Generation completed but no tiles were produced". 9 generations spent, 0 successful tilesets, plus the round-trip latency of waiting ~3 minutes for each batch before realising the failure pattern was systemic. Operator caught the mistake, redirected to `mcp__pixellab__` (personal) — fresh generations on the personal server succeeded immediately.

**Pattern:** When two MCP servers expose the same tool (PixelLab personal vs team, AWS prod vs sandbox, OpenAI vs Anthropic, etc.), agents that pick "the most prominent name" or "the one I used last time" without checking budget / rate limits / health will burn budget on the wrong endpoint. The failure modes from a maxed-out / over-quota / degraded server look different from prompt errors — they tend to fail late in the pipeline ("90% then no result") or fail with generic "Unknown error" rather than a clean rate-limit response — so it's hard to diagnose without first ruling out budget. The cost is doubled by async generation: each call costs the budget unit AND ~100s of wall-clock time before the failure is observable.

**Prevention point:** Before firing the FIRST call against a multi-server MCP tool, check which server has remaining budget. Concretely:
1. Look for prior PixelLab calls in the project's commit history (`git log --grep=pixellab`) to see which server has been used and at what scale.
2. If multiple servers are available, prefer the personal server (`mcp__pixellab__`) for project work unless the project has explicit per-server allocation rules.
3. If a generation fails twice in a row with "Unknown error" (especially within seconds — too fast for image generation to have run), STOP and check budget before retrying. Don't burn 9/10 of the spec's reroll budget chasing a prompt cause for an account-quota failure.
4. Update the project's tooling docs / generator scripts to name the chosen server explicitly so future runs don't re-pick badly.

**Scope:** mcp, pixellab, multi-server

---

## EP-06 — Author-facing UX gaps are invisible to compile-only verify; require operator-walkthrough done-when criteria written in plain language

**Phase:** tile-architecture (US-97), with prior occurrences in foundation and mobile-ux
**Date:** 2026-05-03

**Description:** This is the third time across phases that the build loop shipped something that compiled cleanly but turned out to have real authoring blockers when an operator drove it for the first time. The pattern:

- `foundation` phase: virtual joystick on mobile didn't work because Phaser routes touch-emulated pointers through different objects than the build-loop verify ever sees. Compile passed; touch input was broken.
- `mobile-ux` phase: viewport zoom and orientation handling broke under DevTools mobile emulation in ways the build couldn't catch.
- `tile-architecture` phase: the editor compiled fine and the tests had nothing to fail on, but four real authoring blockers were sitting there waiting for the operator — no canvas zoom, terrain painting silently failed when the operator painted an unregistered terrain pair (single area-wide tileset), no UI to author triggers/NPCs/exits/transitions, and broader walkthrough gaps the operator could only find by actually using the tool.

Both prior retros explicitly punted on compounding because the issues "weren't classified build-loop failures" — they were caught after the fact during operator testing. With three occurrences across phases, the pattern is real and it costs operator time on every phase that ships an author-facing surface.

**Pattern:** The build loop's verify step (compile + tests) cannot catch ergonomics. Whether a tool is *pleasant to use* is invisible to TypeScript and to the test suite. Author-facing surfaces — editors, dev tools, content composers, generation pipelines, story-scene authoring UIs, asset preview tools — ship with their compile-side criteria met but their authoring blockers undiscovered. The blockers surface only when the operator (or another agent driving the tool) starts using it for real work, which by then is mid-content-authoring and expensive to interrupt.

A second pattern stacked on top: when spec-author DOES include a "verify the editor works" criterion, the wording is typically jargon-style abstract ("operator runs the surface for 10 minutes against a representative scenario", "exercise the cell-paint mode") and gets skipped because it reads like AI boilerplate that's been pasted in for completeness. The operator confirmed during the tile-architecture retro that this jargon framing is itself part of why the gate fails — abstract criteria are unreadable as a test script and get checked off without being run.

**Prevention point:** The earliest prevention point is spec-author at spec-write time. The fix lives in `/Users/jacobusbrink/Jaxs/projects/sabs/skills/spec-author/SKILL.md` under "Compounded done-when rules" → "Operator-walkthrough completion gate (compounded)". Concretely:

1. When a phase delivers an author-facing surface (any tool an operator drives directly), spec-author MUST add at least one operator-walkthrough done-when criterion.
2. The criterion text MUST be a plain-language step-by-step test guide — numbered concrete actions with described visible outcomes ("click the Vertex button → a green dot appears"). Abstract framings ("verify the rendering pipeline", "exercise cell-paint mode") explicitly fail the rule.
3. Steps end with: "If any step doesn't behave as described, record it in `docs/plan/<phase>-known-issues.md` (or equivalent). Phase cannot be marked complete until each gap is either fixed or explicitly deferred to a follow-up phase."

When a phase delivers an author-facing surface AND the spec doesn't include a plain-language operator-walkthrough criterion, the spec is incomplete — push back to spec-author before starting the phase. When the criterion exists but reads like jargon, rewrite it before locking the spec.

**Scope:** universal

---
