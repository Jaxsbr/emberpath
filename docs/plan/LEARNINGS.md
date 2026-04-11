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

**Prevention point:** During implementation task scoping, the brief should call out: "Before submitting, check for (a) setup operations that run every loop iteration but only need to run once per invocation, (b) conditional branches where both outcomes produce the same result, and (c) comments that reference behavior no longer present in the code."

**Scope:** universal

---
