# Phase: heart-bridge

Status: **PROPOSAL — awaiting Jaco's sign-off.** This phase is the atonement beat
(the cross), so its allegory/gospel staging is in Jaco's reserved domain. The
mechanics and area-build below are buildable elaborations of the vision already set
in `docs/master-prd.md`; the **Decisions needed** section lists the gospel/allegory
choices that must be Jaco's call before any content slice ships. Do not self-merge.

> **North Star (id=68).** This is the *emotional* completeness lever, not a content-
> volume one. master-prd success criterion #4: "The Heart Bridge scene is the
> emotional climax of the experience — not the longest, but the most *felt*." Every
> player-facing string reads at a **young-child level**; the story stays
> **allegorical** — the bridge is never named as the cross and the High King is never
> named as Jesus (explicit doctrine lives only in the credits/reveal, per
> `biblical-guidance.md` and master-prd).

## Phase goal

**Atonement — the Fading is taken away, once.** Pip has carried the Ember Mark
(grace, Fog Marsh), shared it (first witness, Ashen), walked the Briar trial where
*drain zones* pull her warmth down, and received **the Word** that steadies her light
in the dry places. The Word *holds* her through trial; it does not *end* the trial.
This phase ends it. Pip crosses the **Heart Bridge** — scarred stone where the High
King took the Fading into himself — and the last of the grey is drawn out of her into
the stone. A permanent state changes: **the drain places no longer take her light.**

This closes master-prd gospel-arc beat 6 (Atonement, "Beat 3" in the original
four-beat framing) and sets up beat 7 (`bearing-fruit`), where previously-warmed NPCs
show second-stage transformations on revisit *after the bridge*.

master-prd grounding (verbatim vision being elaborated):
- Line 81: "**The Heart Bridge — atonement (new area, Beat 3).** Pip walks across the
  scarred stone where the High King took the Fading into himself. *Mechanic: paced-
  walk-with-overlay; the Fading is drawn out of Pip into the bridge. Permanent state
  change — trials no longer drain. Intentionally low interactivity: this beat is
  received, not performed.*"
- Line 96 (allegory map): "Heart Bridge = the cross."
- Line 138–139 (design risk): "The cross beat is the most *received* moment... paced-
  walk-with-overlay. The player receives the atonement; they do not perform it. If
  interactivity is added later, the verb must be costly-feeling... never a skill check."
- Lines 171–172 (v1 success): "emotional climax... the most felt"; "At least one NPC
  visibly bears fruit on revisit after the bridge."

## Design direction

**Received, not performed.** The single hardest thing to get right here is *restraint*.
The temptation is to make crossing a *challenge* — a timing puzzle, a careful walk
along a narrow span, a thing the player *earns*. That would invert the gospel the beat
exists to carry. Crossing is not won. Pip walks; the High King has already done the
work; the Fading leaves her as she goes. The player's only verb is **forward**.

- **The bridge is a short, linear, one-direction span.** No branching, no backtrack
  needed, no fail state, no timer. A child who walks slowly experiences the beat exactly
  as a child who walks quickly — only the pacing differs. The span is *the* level: enter
  at one end, the scene plays as you cross, you arrive changed at the other.
- **"Overlay" = the colour returning to Pip.** The whole game runs a desaturation PostFX
  (the Fading drains the world's colour). The bridge's overlay is the *strongest possible
  mechanical-truth*: as Pip crosses, the grey is drawn off her and the warmth seeps back
  — the world brightens around her, paced by how far she has walked. The player *sees*
  the Fading leave. No exposition does the work the picture does.
- **Low interactivity is the point, but the moment is not passive.** Pip walks (her input),
  the crossing is paced into a small number of beats (trigger bands along the span), and a
  short closing story scene seals it. This reuses shipped systems end-to-end — it is **not**
  a new cutscene/auto-walk engine (see grounding table). If a costly-feeling verb is ever
  added (master-prd's "set down the ember" idea), that is a *later, separate* decision —
  and note the allegory caution in Decision 2 below before reaching for it.
- **The change is permanent and carried, like the Ember and the Word.** A new flag
  (`atoned`) persists across areas and reload via the existing flag store. After the
  bridge, drain zones across every area stop taking Pip's light — the trial remains
  visible but it can no longer pull her down.

### Decisions needed (Jaco's call — gospel/allegory, ESCALATE)

These are the points in *his reserved domain*. I have a recommendation for each, but I
will not ship any content slice that turns on them until he confirms. Recommend handling
as tappable multiple-choice (the-word precedent), not a doc to read.

1. **Is the High King *present* on the bridge, or already-accomplished?**
   Does Pip *see* a figure (the golden stag) take the Fading into himself as she crosses,
   or does she walk a place where it has *already* happened and receive its benefit by
   walking it? Both are defensible allegory. *My recommendation:* the King is **present
   but wordless and still** — he is *there*, the Fading flows from Pip into the stone
   where he stands, but the moment is silent and received, not a conversation. (Keeps the
   substitution *visible* — master-prd: "the High King took the Fading into himself" — while
   preserving "received, not performed.") **Needs Jaco.**

2. **What is drawn out — and is anything *set down*?**
   *Doctrinal precision matters here.* The **Ember = salvation / the indwelling Spirit**
   (allegory map) — it is *kept*, never surrendered. The thing taken away must be the
   **Fading** (sin's lingering hold / the grey), **not** the Ember. master-prd line 139
   floats "setting down the ember on the stone" as a possible future costly-verb — but on
   the allegory as mapped, surrendering the Ember would read as giving up the Spirit, which
   is wrong. *My recommendation:* the Fading/the last grey is **drawn out of Pip into the
   bridge**; the Ember stays and *brightens*. No "set down the ember." **Needs Jaco** (it
   touches what the allegory means).

3. **How explicit is the *substitution* in-scene?**
   The bridge *is* the cross; the most-felt beat. How plainly is "he took it *so she
   wouldn't have to*" shown in-game vs. carried by the credits reveal? master-prd's rule:
   in-game stays allegorical, explicit doctrine lives in the credits. *My recommendation:*
   in-scene shows the **picture** (the Fading leaves Pip and goes into the scarred stone
   where the King is) with at most one or two young-child lines that *imply* the exchange
   without doctrinal vocabulary ("He took the grey. It is not yours to carry now."); the
   word *atonement*, the naming, and the gospel link stay in credits. **Needs Jaco** (the
   degree of explicitness is a gospel-framing call).

4. **"Trials no longer drain" — do drain zones go inert, or pull-but-hold?**
   After the bridge, does a drain zone *stop pulling entirely* (visually inert), or does it
   still *pull* but Pip's light *holds* (no net loss)? *Doctrinal note:* sanctification is
   not the end of trial — the believer still faces hardship, but it can no longer
   condemn/separate. So **pull-but-hold** reads truer than "trials vanish." *My
   recommendation:* the drain animation/thoughts still play, but warmth no longer drops
   while `atoned` — the trial is *there* and *powerless*. (This is partly a mechanic-feel
   call, which is mine, but the allegory reading is Jaco's — flagging.) **Confirm with Jaco.**

## Mechanic grounding (current code — buildable on shipped systems)

The crossing is assembled from systems already in the engine. The only genuinely new
surface is the per-distance overlay pacing (a small `GameScene` addition), not a new
cutscene framework. (Grep confirms the only existing "cinematic" is the New-Game opening
story scene; there is no scripted auto-walk path, and this phase does not add one.)

| Need | Existing system to extend |
|------|---------------------------|
| New area (the bridge span) | `AreaDefinition` + `ExitDefinition` (Briar → Heart Bridge), same as every area transition |
| Crossing paced into beats | `TriggerDefinition` (`type: 'story' | 'thought'`) bands placed along the span; one-shot via existing trigger bookkeeping |
| The Fading drawn out (the "overlay") | desat PostFX + `LightingSystem` — the colour-return is the existing desaturation lifted, paced by crossing progress |
| Closing seal scene | `StorySceneDefinition` + `DialogueScript.endStoryScene` / trigger `type: 'story'` (warm-gold palette idiom, as `ember-given` / `word-given`) |
| Permanent atonement state | flag store (`has_ember_mark` / `has_word` precedent), `onFlagChange` — new `atoned` flag |
| "Trials no longer drain" | `EmberWarmthSystem` (`src/systems/emberWarmth.ts`) — gate drain contribution on `atoned` (Decision 4 picks inert vs pull-but-hold) |
| Objective text across the beat | `AreaDefinition.objective` / `conditionalObjective` |
| Inner-voice line at the far end | `DialogueNode.endThought` / trigger `type: 'thought'` (Wren / the-word precedent) |

The bridge needs a **stone-span tileset + a scarred-stone visual** (Track A art, PixelLab,
top-down + clustered per directive #344). That is the one new asset job; the rest is data
+ a small overlay-pacing hook.

## Stories

### US-HB1 — `atoned` flag + the Heart Bridge area shell

Stand up the new area and the permanent state it grants, with no content text yet.

**Acceptance criteria:**
- New `heart-bridge` `AreaDefinition`: a short, linear, one-direction stone span; entry
  from Briar Wilds via a new `ExitDefinition` (gate the exit on `has_word == true` so the
  bridge comes *after* the Word — confirm the flag/availability against `briar-wilds.ts`
  at build). No drain zones, no quiet zones, no combat — the span itself is the level.
- New `atoned` flag, written `true` exactly once by the crossing's terminal beat
  (US-HB3) — no pickup path, no other writer. Persists across area transitions + reload
  via the existing flag store; cleared by Reset Progress.
- A small carried/visible change confirming the state (the Ember reads *brighter/steadier*
  while `atoned`), created on flag-flip via `onFlagChange` AND on scene `create` if already
  true (covers transitions + Continue). Per-frame follow uses `setPosition` only — **zero
  allocations** in the update path (Learning EP-01).
- Stone-span tileset wired through the `TILESETS` registry (Track A art; top-down +
  clustered per directive #344). Placeholder terrain acceptable for the mechanics slice;
  final art is its own art slice.

### US-HB2 — The crossing: paced-walk-with-overlay

As Pip walks the span, the Fading is drawn off her and the colour returns — paced by how
far she has crossed. This is the beat. **(Content/figure staging blocked on Decisions 1–3.)**

**Acceptance criteria:**
- The span is divided into a small number (≈3–4) of crossing beats via one-shot
  `TriggerDefinition` bands placed across its length. Each band advances the overlay state
  (more colour returns, the grey lifts further) and may queue a single short
  `thought`/`story` beat ⟨DRAFT, Jaco — Decision 3⟩.
- Overlay pacing is a small `GameScene` hook reading crossing progress (band index or
  player-x along the span) → desat-lift amount. **No per-frame allocation**; the lift is
  set on band-crossing events, not recomputed every frame.
- The Fading-leaving visual reads as *received*: the grey flows **off Pip and into the
  stone** (Decision 1/2 fixes whether the King is shown receiving it). No skill check, no
  timer, no fail; walking is the only verb.
- If Decision 1 places the King on the bridge: a still, wordless golden-stag figure at the
  far third of the span (reuse the existing King/stag asset if available; otherwise a Track A
  art slice). He does not initiate dialogue; the moment stays silent.
- Regression: areas without crossing bands are unaffected; the overlay hook is inert
  outside `heart-bridge`.

### US-HB3 — The seal: closing scene + `atoned` set

At the far end, a short story scene seals the atonement and sets the permanent state.

**Acceptance criteria:**
- A terminal trigger (`type: 'story'`, or `endStoryScene`) at the span's far end plays a
  2–3 beat closing scene, warm-gold palette family (`0xd9a657` → `0xf2c878`, the
  `ember-given` / `word-given` idiom), and sets `atoned: true` via `setFlags`.
- Beat text ⟨DRAFT, Jaco — Decision 3⟩: shows the exchange as a *picture* with at most one
  or two young-child lines that imply it without doctrinal vocabulary; never names the
  bridge as the cross or the King as Jesus.
- One-shot: crossing again after `atoned == true` does not re-trigger the scene (gate on
  the flag); the far exit (to Briar/return, or onward) is open.
- An `endThought` / `thought` beat at the exit lands the *received* note in Pip's own voice
  ⟨DRAFT, young-child level⟩.

### US-HB4 — Atonement steadies the ember everywhere (trials no longer drain)

The mechanical payoff: after the bridge, drain zones stop taking Pip's light. **(Inert vs
pull-but-hold blocked on Decision 4.)**

**Acceptance criteria:**
- `EmberWarmthSystem` gains an `atoned` check: while `atoned == true`, drain-zone
  contribution is suppressed game-wide (Decision 4 picks **inert** — drain stops entirely —
  vs **pull-but-hold** — the pull/thoughts still play but warmth no longer drops). Quiet-zone
  restore behaviour unchanged.
- This *compounds with and supersedes* the Word's local steadying (US-W4): the Word steadied
  Pip *near a remembered stone*; the atonement steadies her *everywhere, permanently*. A
  Briar drain corridor that needed a remembered stone to cross is now crossable anywhere.
  No regression to the pre-`atoned` state (an un-atoned save still drains exactly as today).
- **No per-frame allocation** added to `EmberWarmthSystem.update`.
- `conditionalObjective` rung reflects the change where relevant (e.g. Briar post-bridge:
  "The dry places cannot take your light now.") ⟨text DRAFT, young-child level⟩.

### US-HB5 — Reading-level sweep + cold playtest

- Reading-level sweep of every new string (crossing beats, seal scene, exit thought,
  objectives) to young-child level.
- Cold first-time-player playtest via the headless harness: confirm a cold player
  (kid-who-reads bar) reads the beat as "something heavy was taken off me; I didn't do it;
  the colour came back; the hard places don't pull at me anymore." Capture frames (the
  colour-return across the span is the screenshot that proves the beat).

## Done-when (phase-level)

- [ ] New Game → reach Briar with the Word → cross into Heart Bridge → walk the span →
      the grey is drawn off Pip and the colour returns → seal scene → `atoned: true`.
- [ ] A drain zone that drained before the bridge no longer takes Pip's light after it
      (per Decision 4); an un-atoned save still drains (regression).
- [ ] `atoned` persists across area transition + Continue; cleared by Reset Progress.
- [ ] Crossing has no fail state, no timer, no skill check — walking forward is the only
      verb; a slow walker gets the same beat as a fast one.
- [ ] All new player-facing text at young-child level; in-game stays allegorical (bridge
      never named as the cross, King never named as Jesus).
- [ ] `npx tsc --noEmit && npm run build` passes; cold headless playthrough completes with
      no console/page errors.
- [ ] **No per-frame allocations** added to `EmberWarmthSystem.update`, the overlay-pacing
      hook, or the carried-state update path.

## Out of scope

- Beat 7–8 (`bearing-fruit`, `citadel`) — future phases. *But:* this phase is the trigger
  for `bearing-fruit` (master-prd #5: "at least one NPC bears fruit on revisit **after the
  bridge**"); the `atoned` flag is the gate the next phase reads.
- A costly-feeling "set down the ember" verb (master-prd line 139) — explicitly deferred,
  and see Decision 2's allegory caution before it is ever added.
- Audio cues (separate later track).
- Final atonement/allegory wording — authored at young-child level by me, **approved by
  Jaco** (Decisions 1–4 gate the content slices).

## Dependencies

- `the-word` shipped (provides `has_word`, the trial-steadying the atonement completes,
  and the Briar → bridge approach already foreshadowed: Briar's `quiet-closing` beat
  points at "A long stone bridge... its stones are old and cracked, like something hurt
  them long ago" — this phase pays off that planted promise).
- `keeper-rescue` / `the-word` idioms reused (`spawnCondition`, `setFlags`,
  `endStoryScene`, story-scene chaining, flag store, `onFlagChange`).
- Briar Wilds shipped with `EmberWarmthSystem` drain/quiet zones (the trial this phase
  ends).
- **Jaco sign-off on Decisions 1–4** — REQUIRED before content slices (US-HB2 figure
  staging, US-HB3 seal text, US-HB4 inert-vs-hold) ship. The area shell + flag plumbing
  (US-HB1) and the overlay-pacing hook build now; the stone-span tileset + any King-on-
  bridge art are Track A slices (top-down + clustered, directive #344).
