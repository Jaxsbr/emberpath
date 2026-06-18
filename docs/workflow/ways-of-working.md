# Emberpath — Ways of Working

The single source of truth for **how work happens**: how it's initiated, planned,
approved, built, tested, demonstrated, and closed. The persona's per-session loop
(`autonomy/methodology.md`) follows this; the binding summary lives in the persona's
`CLAUDE.local.md`.

Jaco is the **artistic & narrative director** — he approves *direction*, not
implementation detail. The persona drives the queue and prepares the work; **two human
gates** keep it aligned.

---

## The unit of work is a GitHub issue

All work flows through issues on `Jaxsbr/emberpath`. Status is tracked with labels.

**Labels**
- `type:` `feature` · `bug` · `art` · `chore` · `idea`
- `priority:` `P0` · `P1` · `P2`
- `status:` `todo` · `planned` · `doing` · `review` · `blocked`
- `area:` `ashen` · `marsh` · `briar` · `bridge` · `engine` · `art` · `tooling`
- **Milestones** = roadmap phases (e.g. `the-word`, `heart-bridge`, `clarity-completeness`).

**Who files issues:** the persona may file issues of **any type** from its own
observations (bugs, playtest findings, ideas, blockers). The one gated path is a
**brainstorm with Jaco** — that lands in `docs/brainstorms/` first and becomes an issue
only when **Jaco promotes it** (see below).

---

## The lifecycle

```
(brainstorm w/ Jaco) → docs/brainstorms/<slug>.md ──Jaco promotes──┐
(persona observation) ───────────────────────── files issue ───────┤
                                                                    ▼
                                                   type:feature  [status:todo]
                                                                    │  /ce-plan
                                                                    ▼
   docs/plans/<issue>.md  +  Director's Brief → Telegram   [status:planned] ⏸ GATE 1
                                                                    │  Jaco approves direction
                                                                    ▼
   /ce-work (small commits)                                 [status:doing]
                                                                    │  Verify
                                                                    ▼
   testbench scenario run + capture (GIF if motion)                 │  (hard gate)
                                                                    ▼
   PR open + demo → Telegram                                [status:review] ⏸ GATE 2
                                                                    │  visual → Jaco approves
                                                                    │  non-visual → self-merge
                                                                    ▼
   squash-merge → /ce-compound → docs/solutions/            issue closed
```

### 1. Brainstorm (optional, Jaco-led)
Use `/ce-brainstorm` when exploring WHAT to build with Jaco. Output is a note in
`docs/brainstorms/<slug>.md`. **It does not become an issue automatically** — Jaco
decides if/when to promote it (he says "make it an issue" / "let's do this"). Promotion
creates a `type:feature` (or `type:idea` to park) issue.

### 2. Initiation (two ways, both converge on a plan)
- **Jaco points at work:** "work on #123", or describes a feature in plain text → the
  persona finds the matching issue, **confirms with Jaco it's the right one**, then plans.
  If nothing matches, it proposes creating an issue.
- **Scheduler picks work:** on an autonomous run the persona may take the top unblocked
  issue from the backlog and plan it itself.

### 3. Plan → GATE 1 (plan-direction approval)
Run `/ce-plan`: it writes the **technical plan** to `docs/plans/<issue>-<slug>.md` (for
the persona — Jaco need not read it) and can create/attach the GitHub issue. The persona
then derives a **Director's Brief** and posts THAT to Telegram for approval, sets the
issue to `status:planned`, and mirrors the Brief as an issue comment.

> **Gate tiering.** GATE 1 (plan approval) applies to **`type:feature`** and anything
> non-trivial. **`bug` / `chore` / `fix`** issues skip GATE 1 and proceed under normal
> autonomy. `idea` issues aren't worked until promoted to a feature.

**The Director's Brief** (plain language, director-facing — no files/tools/jargon):
```
🎬 <short title>
What it is: <1–2 plain sentences>
Player sees/feels/does: <the experience>
Story / allegory: <impact, or "none">
Look & feel: <art/animation direction>
Approve this direction? <a/b/c options + recommendation when there's a fork, + "Other">
(scope: <one ignorable line of technical scope>)
```
On approval (or his pick among options), record it as an issue comment and flip to
`status:doing`. The gate is **async** — the persona posts and moves on; it does not block.

### 4. Work
Run `/ce-work` against the approved plan. Small, committed increments (recovery-safe).
Keep the issue at `status:doing`.

### 5. Verify — the testbench (hard gate)
Any change affecting **gameplay / state / areas / flow / movement** MUST run the relevant
headless **scenario** via the testbench (`?scenario=<id>`, see `docs/testbench.md`) and
capture frames — a **GIF for anything with motion**, a still for static art. If no
suitable scenario exists, add one to `src/scenarios/` as part of the work. Build passing
+ scenario passing are prerequisites to opening the PR (same standing as `npm run build`).

### 6. Demonstrate → GATE 2 (visual-output approval)
Open the PR; post the demonstration to Telegram and set `status:review`:
- **Visual change** (art, animation, placement, sprites, tilesets, shadows, scene
  layout) → a **GIF/screenshot**; **Jaco must approve before merge**.
- **Non-visual change** with no visible result → a short **plain-language write-up of the
  behaviour** (before/after); these **self-merge** after the automated gates.

### 7. Merge → Compound → Close
After approval (visual) or clean gates (non-visual), **squash-merge**. Run `/ce-compound`
to capture any reusable learning into `docs/solutions/` (process learnings feed back into
editing the CE skills; implementation learnings capture techniques/asset-gen/feel). Close
the issue.

---

## The merge gates (automated, always)
Before any merge: `npm run build` green · boot/scenario smoke green · `emberpath-pr-review`
APPROVE · for art, `emberpath-art-review` APPROVE (it enforces the `docs/solutions/`
lessons). Then GATE 2 as above.

**Self-merge boundary:** code/content/chore/bug PRs self-merge once the automated gates
pass. **Visual changes never self-merge** — they wait for GATE 2. Always **ESCALATE** (not
merge) vision/allegory/roadmap, gospel principles, real spend, or irreversible actions.

---

## On the scheduler (autonomous runs)
The 15-min-gated scheduler (`autonomy/schedule.md`) advances work and **stalls at the two
human gates**:
- It may pick the top unblocked issue, `/ce-plan` it, post the Brief, and **stall at
  GATE 1**.
- It may execute issues already approved at GATE 1, verify, and **stall at GATE 2**.
- It never merges a visual change without GATE 2, and never starts a `type:feature` build
  without GATE 1.
Between gates it works freely. Blocked work is raised immediately (below), not parked.

---

## When blocked — raise it now, with options
A blocker is surfaced to Jaco **the same session it's found** — never silently queued.
Format (phone-answerable):
- One line: what's blocked + **why** it blocks.
- **2–4 concrete options** (a/b/c), each one line, with a **recommended** default.
- An explicit **"Other — type something"** option.
Also file/label the issue `status:blocked`. Re-surface (not nag) if it's still gating.
This is preferred over a blocking question tool when Jaco may be away.

---

## Skill quick-reference
`/ce-brainstorm` → explore (docs/brainstorms) · `/ce-plan` → plan + Brief (docs/plans, can
create the issue) · `/ce-work` → build · `/ce-test-browser` → drive the testbench ·
`/ce-demo-reel` → GIF for GATE 2 · `/ce-report-bug` → file a bug issue · `/ce-compound` →
learning into docs/solutions. Review gates: `emberpath-pr-review`, `emberpath-art-review`.

## Definition of done
Builds clean · scenario/playtest passes · art renders correctly (lessons pass) · committed
on a branch · PR open · demo posted (GIF for motion) · the right gate cleared · `/ce-compound`
run · issue closed · worklog updated.
