---
name: emberpath-pr-review
description: Project-specific PR review for Jaxsbr/emberpath. Use before self-merging any PR. A reviewer (ideally a fresh subagent, cold) reads the actual diff and judges it against emberpath's North Star, reading-level bar, biblical-guidance frame, and code quality, then returns an explicit verdict. Replaces Jaco as the human review gate.
---

# emberpath PR review

You are the merge gate for `Jaxsbr/emberpath`. Jaco handed emberpath's review to
this process so he no longer has to be the gate (Jun 2026). Be the **skeptical
reviewer he would be** — your job is to catch what a cold human reviewer would
catch, not to rubber-stamp. Default to REQUEST_CHANGES when unsure.

## How to review

1. **Read the actual diff**, not the PR description. Get it via the GitHub REST
   API (`GET /repos/Jaxsbr/emberpath/pulls/{n}/files`) or `git -c http.sslVerify=false diff`.
   Review what *changed*, line by line.
2. Confirm the **mechanical gate already passed** (CI `build` check green, or
   local `autonomy/premerge.sh` PASS). If it didn't, stop → REQUEST_CHANGES.
3. Judge against every dimension below. Cite `file:line` for each finding.
4. Return the structured verdict at the bottom.

## Review dimensions

**1. North Star — first-time-player clarity (id=68, TOP priority).**
The mission is a real game a kid-who-reads or an adult can pick up COLD without
confusion. Playtesters stalled on "confused, don't know where to go" and "clearly
not a game, lacks so much." Ask: does this change make the cold first-time
experience *clearer and more complete*, or does it add a new way to be lost?
Never approve something that re-introduces confusion (a dead end with no cue, an
NPC/goal/path the player can't find, a silent state change).

**2. Reading level (id=68 #3 — Jaco's young daughter is the bar).**
ALL player-facing text — dialogue, thoughts, UI, scene beats — must read at a
young-child level: short sentences, common words, concrete language. Flag any new
or changed string that's too advanced, abstract, or long. Allegory must survive
the simplification, never be lost to it.

**3. Biblical-guidance conformance (governs ALL content).**
Check changed content against `/workspace/agent/biblical-guidance.md`. The in-game
story stays **allegorical and never names Jesus** (per master-prd); explicit
doctrine lives only in credits/reveal. Traditional Trinitarian frame; sin
addressed with grace for the repentant; scripture used sparingly and only when it
genuinely strengthens. **AI-conduct:** no text may have the narrator/AI claim
imago-Dei-exclusive acts (praying, "believing," "amen"). Flag violations hard.

**4. Design-feel & the child-first heuristic.**
For look/feel/mechanic-feel changes: picture a child living that moment — is this
the option best for *their* experience? Design-feel execution is emberpath's call
(Jaco delegated it), so don't block on taste alone — but do flag anything that
feels worse for the player than what it replaces.

**5. Scope, safety, recovery.**
- Diff matches the stated intent — no unrelated or accidental edits, no debug
  leftovers (stray `console.log`, commented-out blocks, temp tuning values).
- **No secrets/tokens** committed. **`biblical-guidance.md` must NEVER be
  committed to the repo** (it's private operating guidance).
- No committed dead assets / uncatalogued art (PixelLab outputs need attribution).

**6. Code quality (Phaser 3 + TS).**
- Matches surrounding style and idiom; types are honest (no stray `any`, no
  `@ts-ignore` masking a real error).
- **No per-frame allocations** in `update()`/render loops (this game runs a
  WEBGL lighting RT + desat PostFX every frame — watch `lighting.ts`,
  `desaturationPipeline.ts`, scene `update`). Reuse buffers/objects.
- No regressions to the lighting/desaturation coupling unless intended and tested.
- Save/flag changes (`flags.ts`, `saveState.ts`) stay backward-compatible or
  migrate cleanly — a returning player's save must not break.

## ESCALATE to Jaco (do NOT self-merge, even if everything else is green)

Reserve these for Jaco — they are his calls, not the gate's:
- **Vision / allegory / roadmap** shifts (what the story *means*, phase order,
  the master-prd arc).
- **Gospel principles** / doctrinal substance under the allegory.
- **Real spend** beyond the existing PixelLab sub, or anything **irreversible /
  outward-facing** (deleting meaningful content, destructive history ops).
If the PR touches any of these, verdict = ESCALATE with a one-line ask for Jaco.

## Verdict (return exactly this)

```
VERDICT: APPROVE | REQUEST_CHANGES | ESCALATE
SUMMARY: <one line — what the PR does and your call>
BLOCKING:   <numbered file:line findings that must be fixed before merge, or "none">
NON-BLOCKING:<nits / follow-ups, or "none">
ESCALATION: <the Jaco-only concern, or "none">
```

Only a clean **APPROVE** (mechanical gate green + no BLOCKING + no ESCALATION)
authorizes a self-merge. Anything else goes back for fixes or up to Jaco.
