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
