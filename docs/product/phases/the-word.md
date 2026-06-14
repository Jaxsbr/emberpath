# Phase: the-word

Status: approved — Jaco signed off the allegory/gospel decisions 2026-06-14 (see "Decisions (locked)" below). Build tracked as backlog B3; content-bearing slices stay open for Jaco's word-level approval.

> **North Star (id=68).** This phase is the next *completeness* lever: the foundation
> is now clear and playable (cold audit C19, 2026-06-14), so the roadmap can advance.
> `the-word` is the first phase past the opening arc. As with all content, every
> player-facing string must read at a **young-child level** and the in-game story
> stays **allegorical** — the Word is never named as the Bible and Jesus is never
> named (per `docs/master-prd.md`; explicit doctrine lives only in the credits/reveal).

## Phase goal

**Maturation through the Word.** Pip already carries the Ember Mark (grace received in
Fog Marsh) and has walked the Briar Wilds trial, where *drain zones* pull her warmth
down and *quiet places* restore it. This phase gives Pip **the Word** — a
scripture-keeping artifact (master-prd allegory: the Bible) — received as a **gift**,
not picked up as a power-up. The Word changes how the trial feels:

- **It steadies the ember in the dry places.** With the Word, Pip can *remember* at an
  **inscribed stone**: remembering lights the stone and opens a small steadied area
  where drain zones no longer pull her warmth down. Faith, kept by the Word, holds in
  the dry places (master-prd: "the Word — stabilises the ember in drain zones").
- **Inscribed stones become readable.** Before the Word the stones are just cold,
  carved rock Pip cannot read; after the Word their few words come clear — a
  breadcrumb of remembered truth across the areas (master-prd: "inscribed stones
  across all areas become readable").
- **New verb: *remember*.** The first verb that draws on something *outside* Pip —
  she does not make the light, she remembers the words and the light steadies.

This closes master-prd gospel-arc beat 5 (Maturation through the Word) and sets up
beat 6 (`bearing-fruit`).

## Design direction

**The Word is given, never grabbed.** This mirrors the Ember Mark in `keeper-rescue`
(grace given, not earned). The artifact arrives in a story scene through a *giver*, so
the moment reads as *receiving*, never as walking over a glowing pickup.

- **One giver, one story scene, one new flag (`has_word`).** Reuses the proven
  `keeper-rescue` idiom exactly: a conditional-spawn NPC + a one-shot dialogue whose
  terminal node sets `has_word: true` via `DialogueNode.setFlags`, chained to a
  `word-given` story scene via `DialogueScript.endStoryScene`. No new engine path for
  the hand-off — it is the keeper hand-off again, with a different gift.
- **Remembering is small and calm.** No combat, no timer pressure, no fail state. Walk
  to a stone, tap to *remember*; the stone lights and a steadied circle opens. A child
  who reads slowly is never punished — the ember is floor-clamped (it cannot go out),
  exactly as in the Briar trial today.
- **The Word is carried, like the Ember.** `has_word` persists across areas and reloads
  via the existing flag store (same as `has_ember_mark`), and a small carried visual
  marks that Pip now holds it.
- **Retroactive, gently.** Inscribed stones can be seeded in earlier areas too, but the
  *mechanic* is introduced and taught in Briar Wilds (where drain zones already live),
  so the lesson lands where the trial is. Earlier-area stones are wayfinding/flavour
  reveals, not required.

### Decisions (locked by Jaco — 2026-06-14, tappable MC sign-off)

These were the gospel/allegory parts in Jaco's reserved domain. He signed off all
three (he asked for tappable options, not a PR to read):

1. **Who gives the Word → a NEW teacher NPC** (an elder/steward who keeps the Word),
   *not* the Keeper/heron. Reuses the keeper-spawn hand-off idiom, but introduces one
   new character. **Implication: needs a new top-down teacher-NPC sprite (PixelLab,
   Track A) — show Jaco before it ships.**
2. **What the inscribed stones say → emberpath drafts, Jaco approves/edits.** The
   remembered lines + the gift-scene beats are scripture-*allegory* content; I author
   them at young-child level (allegorical, Bible/Jesus never named in-game) and **every
   line needs Jaco's approval before it merges.** Content-bearing slices therefore do
   NOT self-merge — they stay open for his word-level approval.
3. **How "remember" frames faith → CONFIRMED.** The Word is *received and kept* (a gift
   Pip holds onto, never earned, never a grind/power-up). Remembering steadies her light
   because she holds words she was given.

## Mechanic grounding (current code — this is buildable today)

| Need | Existing system to extend |
|------|---------------------------|
| Drain in dry places, floor-clamped | `EmberWarmthSystem` (`src/systems/emberWarmth.ts`) — `validDrainZones`, `WARMTH_DRAIN_PER_SECOND`, `WARMTH_FLOOR` |
| Gift hand-off (spawn → dialogue → flag → story scene) | `keeper-rescue` idiom: `NpcDefinition.spawnCondition`, `DialogueNode.setFlags`, `DialogueScript.endStoryScene`, `StorySceneDefinition` |
| Carried-across-areas state | flag store (`has_ember_mark` precedent), `onFlagChange` |
| "Place worth investigating" light | `TriggerDefinition.light` (tier-2 reveal pattern) / `lightBeacon` |
| Restored/steadied patch | `QuietZoneDefinition` (restore warmth, first-entry narration) |
| Inner-voice line on an exit | `DialogueNode.endThought` (Wren grace-beat precedent) |
| Objective text that changes with state | `AreaDefinition.conditionalObjective` |

Note "Whispering Stones" already exist as a concept in Fog Marsh, and the Marsh Hermit
already says *"Listen to the stones if you can. They remember things the fog made
everyone forget."* — the *remember* verb is foreshadowed in shipped content, so this
phase pays off a promise already planted.

## Stories

### US-W1 — `has_word` flag + carried visual

Introduce the `has_word` flag (parallel to `has_ember_mark`) and a small carried mark
showing Pip holds the Word.

**Acceptance criteria:**
- `has_word` written `true` only by US-W2's terminal dialogue node (no pickup path).
- A small carried visual (e.g. a faint warm glyph near the ember overlay) renders when
  `getFlag('has_word') === true`; created on flag-flip via `onFlagChange` AND on scene
  `create` if already true (covers area transitions + Continue). Removed on Reset.
- Per-frame follow uses `setPosition` only — **zero allocations** in the update path
  (Learning EP-01; this game runs a WebGL lighting RT + desat PostFX every frame).
- Persists across area transitions and page reload via the existing flag store (no new
  persistence layer).

### US-W2 — The Word is given (spawn → dialogue → story scene)

The giver (⟨Decision 1⟩) appears once Pip is eligible, hands over the Word in one
short dialogue, and a `word-given` story scene plays. **Reuses the keeper hand-off
end-to-end** — no new engine mechanism.

**Acceptance criteria:**
- Giver NPC entry with `spawnCondition` gating eligibility — proposed
  `has_ember_mark == true AND briar_wilds_complete == true AND has_word == false`
  (so the Word comes *after* the Briar trial, once, never re-triggering). Confirm the
  completion flag name against `briar-wilds.ts` (`briar-wilds-complete` quiet zone) at
  build time.
- One-shot dialogue (`${giver}-word` script): greeting + an action node whose
  `setFlags: { has_word: true }` and whose script `endStoryScene: 'word-given'`.
- `word-given` story scene: 2–3 warm beats showing *receiving* (the giver holds out the
  Word; Pip takes it; the words begin to glow). imageColor warm-gold family
  (`0xd9a657` → `0xf2c878`), same palette idiom as `ember-given`. Beat text ⟨DRAFT,
  Jaco to approve⟩, young-child level.
- Giver one-shot: does not respawn after `has_word == true` (gate in `spawnCondition`).
- All existing scripts/scenes without these fields are unaffected (regression).

### US-W3 — Inscribed stones: readable after the Word, *remember* verb

A new lightweight **inscribed-stone** interaction. Before the Word: a faint "I cannot
read this yet" inner-thought. After the Word: tap to *remember* → the stone's few words
appear, the stone lights permanently, and (US-W4) a steadied area opens around it.

**Acceptance criteria:**
- Inscribed stones authored as data (proposed: reuse `TriggerDefinition` with a small
  `remember` affordance, or a dedicated `inscribedStones?: InscribedStoneDefinition[]`
  field on `AreaDefinition` if the trigger shape doesn't fit cleanly — author's choice
  at build, documented in code; lean toward the smallest additive type).
- Pre-Word interaction: a one-shot inner-thought ("Cold words. I can't read them yet.")
  — no light, no steadied area. Uses the thought-bubble system already in use by drain
  zones.
- Post-Word interaction (`has_word == true`): tapping the stone shows its remembered
  line(s) ⟨DRAFT, Jaco⟩, sets `remembered_<stoneId>: true`, and lights the stone
  (steady warm light via the `TriggerDefinition.light` / beacon idiom — survives the
  desat pipeline on the UI camera).
- Remembering is idempotent and persists (`remembered_<id>` flag); a re-tap re-shows the
  words without re-firing side-effects.
- All stone text young-child level; allegorical; no named scripture in-game.

### US-W4 — The Word steadies the ember in drain zones

A remembered stone opens a small **steadied** area where drain zones no longer pull
warmth down — the mechanical payoff of "the Word stabilises the ember in drain zones."

**Acceptance criteria:**
- `EmberWarmthSystem` gains a steadied check: while the player is within a remembered
  stone's steadied radius (and `has_word == true`), drain contribution is suppressed
  (drainRate → 0) for that frame. Quiet-zone restore behaviour is unchanged.
- Steadied radius is data-driven (per stone) and defaults sensibly; chosen so a Briar
  drain corridor becomes *crossable* once its stone is remembered (verify against
  `briar-wilds.ts` `drain-1`/`drain-2` placement at build).
- Floor-clamp and existing drain/quiet/neutral state machine otherwise untouched
  (regression: an un-remembered drain zone still drains exactly as today).
- No per-frame allocation added to `EmberWarmthSystem.update` (it runs every frame).
- A `conditionalObjective` rung teaches the verb the first time (e.g. pre-Word in Briar:
  "The dry places pull at your light. Remember, when you can." → post-Word: "Remember at
  the stones. Their words steady your light.") ⟨text DRAFT, young-child level⟩.

### US-W5 — Retroactive stones (optional, low-cost) + reading-level + cold playtest

- Seed 1–2 inscribed stones in earlier areas (Ashen Isle / Fog Marsh — the Whispering
  Stones already foreshadow this) as readable-after-Word flavour/wayfinding reveals.
  Optional; not required for the phase to be complete.
- Reading-level sweep of every new string (giver dialogue, story-scene beats, stone
  lines, objectives) to young-child level.
- Cold first-time-player playtest via the headless harness: confirm a cold player
  (kid-who-reads bar) understands "I got the Word → I can read the stones → remembering
  steadies my light → I can cross the dry place." Capture frames for the report.

## Done-when (phase-level)

- [ ] New Game → reach Briar Wilds with the Ember Mark → become eligible → giver appears
      → receive the Word (dialogue + `word-given` scene) → `has_word: true`, carried mark
      shows.
- [ ] An inscribed stone reads as unreadable pre-Word and readable (with words + light)
      post-Word; `remembered_<id>` persists across reload.
- [ ] A remembered stone makes its drain corridor crossable (warmth holds steady inside
      the steadied radius); an un-remembered drain zone still drains (regression).
- [ ] `has_word` and `remembered_<id>` persist across area transition + Continue; cleared
      by Reset Progress.
- [ ] All new player-facing text at young-child level; in-game stays allegorical (no
      named scripture, Jesus never named).
- [ ] `npx tsc --noEmit && npm run build` passes; cold headless playthrough completes with
      no console/page errors.
- [ ] **No per-frame allocations** added to `EmberWarmthSystem.update` or the carried-mark
      / steadied-radius update paths.

## Out of scope

- Beats 6–7 of the arc (`bearing-fruit`, `citadel`) — future phases.
- Combat / fail states / timers on remembering.
- A bespoke Briar ground tileset (deferred Track-A Wang job; tracked separately).
- New giver art **if** Decision 1 picks the Keeper (heron assets already exist); a new
  teacher NPC would add an art story.
- Audio cues (audio pipeline is a separate, later track).
- Final scripture/allegory wording — authored/approved by Jaco (Decisions 1–3).

## Dependencies

- `keeper-rescue` shipped (provides `spawnCondition`, `DialogueNode.setFlags`,
  `DialogueScript.endStoryScene`, story-scene chaining — all reused here).
- Briar Wilds shipped with `EmberWarmthSystem` drain/quiet zones (the trial this phase
  matures).
- **Jaco sign-off on Decisions 1–3** — ✅ DONE 2026-06-14. Mechanics (US-W1, US-W3
  plumbing, US-W4 engine, US-W5 harness) build now; the teacher-NPC sprite (US-W2) is a
  new-art story (Track A, show Jaco first); all authored text stays open for his approval.
