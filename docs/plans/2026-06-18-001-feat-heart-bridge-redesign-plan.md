---
title: "feat: Heart Bridge redesign + stag awareness/dialog + arc art (FB-19 / #154)"
type: feat
status: active
created: 2026-06-18
issue: 154
related: [102, 104]
area: bridge
depth: standard
gate: GATE-1 APPROVED (Jaco, 2026-06-18, msg #1052) — Option A, figure wordless
direction: "The bridge that blooms" (austere grey → blooms to garden as colour returns)
length: 3× the current span (≈78 cols) — Jaco: "so Pip walks and takes in the scene longer"
---

# feat: Heart Bridge redesign + stag awareness/dialog + arc art (FB-19 / #154)

> **GATE 1 — plan-direction approval required.** This is `type:feature` touching the
> blessed gospel arc. No `/ce-work` until Jaco approves the direction (see the
> Director's Brief mirrored to issue #154). The **stag's voice** (whether the figure
> speaks, and what it says) is a **staged gospel call reserved for Jaco** — it is NOT
> the persona's to decide. Design-feel, area geometry, and mechanic reuse are mine.

---

## Problem Frame

The Heart Bridge is gospel-arc **beat 6 — the atonement**. Stage 6 of Pip's pilgrim
journey: a one-direction span she walks *after* receiving the Word in Briar Wilds.
Crossing it, the last of the grey (the Fading) is drawn off her into the stone where a
wordless regal figure stands; her Ember stays and brightens. A permanent `atoned` flag
flips and the drain places no longer take her light.

What ships today (`src/data/areas/heart-bridge.ts`) is the **mechanics + climax slice**:
a 26×5 uniform-grey-stone corridor framed by impassable parapets, the paced
colour-return overlay (`heart_bridge_crossing` 0→4), a wordless `golden-stag` **placed
object** at the far third, and the four-beat closing seal scene. The art and figure are
explicitly placeholder — the bespoke bridge visual and the figure's behaviour were
deferred as their own slices.

Three gaps, raised as feedback FB-19 (#154) and the sibling tickets:
1. **The span reads as "a bridge floating in space."** Uniform grey stone, no context —
   it doesn't read as a *crossing over* anything. #154 asks to redesign it into a long
   bridge over water with lush gardens / statues / fountains.
2. **The stag is inert.** It's a static object — it doesn't acknowledge Pip. #104 asks
   the figure to read as a benevolent presence worth walking *toward*, and for reaching
   it to trigger a **reaction beat, not silence**. #102 asks for a **warm key-light** so
   it reads golden head-to-cloak rather than flat/menacing.
3. **No arc story art.** The bridge, the figure, and the seal all lean on palette
   placeholders rather than bespoke art.

This plan covers **how** to close those gaps. The **what** — specifically the tonal
identity of the redesign and how far the stag's voice goes — is the GATE-1 direction
decision in the Director's Brief.

---

## Scope Boundaries

**In scope**
- Redesign Heart Bridge geometry: longer span, surrounding **water** terrain, decorative
  gardens / statues / fountains (per the approved direction option).
- Convert the stag from a placed object to an **NPC** so it gains the existing
  **awareness mechanic** (turns to face Pip within range) — satisfies the #104
  "presence to walk toward / reaction, not silence" ask and the #102 warm-light ask.
- A **reaction beat** when Pip reaches the figure (wordless gesture by default; spoken
  lines ONLY if Jaco blesses them — see U4).
- **Arc art** for the new bridge surface, the figure's warm key-light, and the
  decorative props (PixelLab, opportunistic per North Star — not a quota to drain).
- A **testbench scenario** that boots the redesigned bridge for the GATE-2 MP4 capture.

**Reserved for Jaco (escalate, do NOT decide)**
- Whether the stag **speaks** at all, and the exact wording of any spoken gospel beat.
  Decision 1 blessed the figure as *wordless* ("present, not conversational"); giving it
  a voice is an allegory shift. The plan supports both a wordless and a spoken variant;
  the wordless variant is the default and ships without a new blessing.

### Deferred to Follow-Up Work
- "Trials no longer drain" (US-HB4) — gated on Decision 4, not this slice.
- The onward leg to the Citadel — waits on that area existing (later track).
- Reworking the closing seal scene's four beats — it's blessed (Decisions 2+3) and stays
  as-is; this plan frames the new art *around* it, it does not rewrite it.

---

## Requirements Traceability

| Source | Requirement | Addressed by |
|--------|-------------|--------------|
| #154 (1) | Redesign into a long bridge over water with gardens/statues/fountains | U1, U2 |
| #154 (2) | Stag awareness mechanic (turn toward Pip) + short dialog leading into story | U3, U4 |
| #154 (3) | Arc story art | U2 |
| #102 | Warm key-light so the stag reads golden head-to-cloak | U2, U3 |
| #104 | Figure reads as benevolent presence to walk toward; reaching it = reaction beat, not silence | U3, U4 |
| master-prd #4 | The climax is "the most felt, not the longest"; received-not-performed | U1 (no fail state), U4 (restraint) |

---

## Key Technical Findings (from research)

- **The awareness mechanic already exists.** `src/systems/npcBehavior.ts` has an `aware`
  state: when the player is within `awarenessRadius`, the NPC turns to face Pip
  (`runtime.facingDirection = vectorToDirection(...)`) and plays its idle-facing anim.
  No new mechanic needs writing — the stag must simply **become an NPC** to inherit it.
  This is the "mechanic reuse" the persona owns.
- **The stag is currently a placed object** (`golden-stag` in `src/maps/objects.ts`,
  3×3 footprint, `tall` Y-sort, single base-cell collision) placed at col 18 row 1 in
  `heart-bridge.ts`. To gain awareness + a reaction beat it needs to be an `NpcDefinition`
  with an 8-direction idle sprite and (optionally) a dialogue.
- **Water terrain exists** (`water` in `src/maps/terrain.ts`, impassable, rendered on the
  `fog-marsh-floor-water` Wang tileset) — the bridge can sit *over* real water with no new
  terrain engine work.
- **Decorative objects available today:** `flower`, `bush`, `tree-pine`, `tree-oak`.
  **Fountains and statues do not exist** — they are new PixelLab gens (Track A art,
  top-down + clustered per directive #344).
- **NPC light override** (`lightOverride` on `NpcDefinition`) is the lever for the #102
  warm key-light — set a warm radius/intensity so the figure reads golden.
- **The colour-return overlay** reads `heart_bridge_crossing` (0→4) and lifts the grey a
  quarter per crossing band. Any redesign must preserve the three bands (cols 6/12/18,
  row 1) + the far seal (col 22) or rescale them to the new geometry.

---

## High-Level Technical Design (directional — not implementation spec)

```
BEFORE                                  AFTER (option-dependent geometry)
26×5 grey corridor                      longer span (≈30–40 × 9–11)
[parapet ████████████]                  water ░░░░░░░░░░░░░░░  (impassable, over-water read)
[floor   ..S......seal.] → east         [garden 🌿⛲🗿 parapet ███████]
[parapet ████████████]                  [bridge deck  ..🦌....seal.] → east
                                        [garden 🌿⛲🗿 parapet ███████]
                                        water ░░░░░░░░░░░░░░░
stag = static object                    stag = NPC: faces Pip in range (aware state),
                                        warm key-light, reaction beat on arrival
colour-return 0→4 preserved             bands rescaled to new span length
```

*This illustrates the intended shape for review. The implementing agent treats it as
context, not code to reproduce. Exact dimensions follow the approved direction option.*

---

## Implementation Units

### U1. Redesign the bridge geometry — span over water + decorative beds

**Goal:** Replace the 26×5 grey corridor with a longer deck that visibly crosses **water**,
flanked by decorative garden/statue/fountain beds per the approved direction option.

**Requirements:** #154 (1); master-prd #4 (no fail state — keep the single "forward" verb).

**Dependencies:** none (geometry/terrain only; art lands in U2).

**Files:**
- `src/data/areas/heart-bridge.ts` (modify — map dimensions, terrain derivation, parapet
  + decorative object placement, rescale the colour-return bands + seal trigger to the new
  length, keep spawn at the near end and the east exit at the far end).

**Approach:**
- **APPROVED (Option A, Jaco #1052): "the bridge that blooms."** Start the deck austere
  grey stone; place the garden/fountain/statue/flower beds so they read sparse-and-grey at
  the near end and **fuller/warmer toward the far end**, so as the colour-return lifts the
  grey quarter by quarter the span visually *blooms* into a garden by the seal. Figure
  stays **wordless** (Decision 1 preserved — no spoken beat this slice).
- **TRIPLE the span length (≈78 cols, Jaco #1052)** so Pip walks and takes in the scene
  longer. The four colour-return ticks now spread across a much longer walk — pace the
  bands so the bloom is gradual, not abrupt.
- Widen the map so water reads on the flanks (e.g. outer rows = `water` terrain,
  impassable; the walkable deck is the inner corridor).
- Place decorative beds (flowers/bushes today; fountains/statues once U2 generates them)
  **clustered, not scattered** (directive #344) along the deck edges / approach.
- **Rescale the three colour-return bands and the seal trigger** proportionally to the new
  length so the grey still lifts to fully-restored exactly as Pip reaches the seal.
- Preserve: `playerSpawn` near end, east `exits` → ashen-isle home bookend, `atoned` flag,
  the `bridge-sealed` story scene wiring.

**Patterns to follow:** `src/data/areas/fog-marsh.ts` for water-terrain + Wang tileset use
and clustered object placement; the existing parapet loop in `heart-bridge.ts`.

**Test scenarios:**
- Area loads without console/page error on the new dimensions (boot smoke).
- The walkable corridor is continuous from spawn to the east exit (no impassable cell
  blocks the one forward path); flanking water cells are impassable.
- `heart_bridge_crossing` still reaches exactly 4 by the seal (band + seal triggers fire in
  order across the rescaled span) — colour fully restored at the far end.
- Covers #154(1). Re-crossing after a Reset still re-arms the bands (condition `atoned == false`).

**Verification:** Boot the testbench scenario (U5); the deck reads as a span *over water*
with planted beds, Pip walks spawn→seal uninterrupted, the grey lifts smoothly to whole.

---

### U2. Arc art — bridge surface, warm stag key-light, decorative props

**Goal:** Replace placeholder palette art with bespoke arc art: the bridge deck surface,
the figure's **warm golden key-light** (#102), and the new garden props (fountain, statue)
the redesign calls for.

**Requirements:** #154 (3); #102; directive #344 (top-down + clustered, read lessons first).

**Dependencies:** U1 (geometry defines what surfaces/props are needed). Art for the figure's
light pairs with U3.

**Files:**
- `src/maps/objects.ts` (modify — register any new decorative object kinds: `fountain`,
  `statue`, with footprint/passability/asset path).
- `public/assets/objects/heart-bridge/*` (new — generated sprites).
- Tileset registration for a bespoke deck surface **only if** the direction option calls
  for one (otherwise reuse the shipped stone Wang tileset).

**Approach:**
- **Read the art lessons FIRST** (`docs/solutions/`, `docs/art-style.md`,
  `docs/art-topdown-guide.md`, the ground-shadow canon) before generating anything — this
  is an enforced gate; `emberpath-art-review` fails any ledger violation.
- Generate via PixelLab (`mcp__pixellab__*`), **opportunistic** (North Star: art serves
  completeness/clarity, not token burn). Top-down perspective, clustered placement.
- Warm key-light on the figure via the NPC `lightOverride` (U3) — a warm radius/intensity
  so it reads golden head-to-cloak, not flat. The light is the cheap, high-impact #102 win
  even before a bespoke figure sprite.

**Patterns to follow:** existing `objects/heart-bridge/golden-stag.png` registration in
`objects.ts`; the `lightOverride` examples in `types.ts`; clustered placement in
`ashen-isle.ts` / `fog-marsh.ts`.

**Test scenarios:** `Test expectation: visual — verified via the GATE-2 MP4 capture (U5)
and the `emberpath-art-review` cold subagent`, not unit tests. Boot smoke must stay clean
(assets load, no 404 on the new sprite paths).

**Verification:** ART-review subagent renders the changed art in scene and clears it
against the 3/4-oblique + clustering + storybook-mood canon; GATE-2 MP4 shows the warm
figure + planted span.

---

### U3. Convert the stag to an NPC — awareness (turn-toward) + warm light

**Goal:** The figure acknowledges Pip: within range it **turns to face her** (existing
`aware` state) and reads as a warm, benevolent presence worth walking toward (#104, #102).

**Requirements:** #154 (2) — the awareness half; #104; #102.

**Dependencies:** U1 (final figure position on the new span); U2 (warm light + any new sprite).

**Files:**
- `src/data/areas/heart-bridge.ts` (modify — remove the `golden-stag` from the `figure`
  object array; add an `NpcDefinition` for the stag in `npcs`, with `awarenessRadius`,
  `wanderRadius: 0` (it stays put), and a warm `lightOverride`).
- `src/maps/objects.ts` (the `golden-stag` object kind may remain registered for the
  editor, but the area stops placing it as a static object).
- Possibly `src/systems/animation.ts` / sprite registration if the NPC needs idle-facing
  animations keyed `npc-<sprite>-idle-<direction>` (npcBehavior expects these).

**Approach:**
- Reuse the **existing** `aware` behaviour in `npcBehavior.ts` — no new mechanic. Set
  `wanderRadius: 0` so it never roams (a fixed sentinel that only rotates to face Pip).
- Pick an `awarenessRadius` wide enough that the figure turns toward Pip while she's still
  approaching (so the "walk toward a presence that sees you" beat lands, #104).
- Warm `lightOverride` (#102). If a bespoke 8-direction stag sprite isn't generated this
  slice, fall back to facing via the existing asset; the *turn-toward* + *warm light* are
  the felt wins and don't require the full sprite.

**Patterns to follow:** the `NpcDefinition` + `awarenessRadius` usage in `fog-marsh.ts` /
`ashen-isle.ts`; `npcBehavior.ts` `aware`-state facing.

**Test scenarios:**
- Stag NPC spawns at the figure position on area load; never wanders (`wanderRadius: 0`).
- When Pip enters `awarenessRadius`, the stag's `facingDirection` updates to point at her;
  when she leaves, it returns to idle. Covers #104 (acknowledges, not silent/inert).
- The figure's collision still lets Pip step past to reach the seal (the one-forward path
  is preserved — regression guard on U1).
- Warm light renders on the figure (visual — GATE-2). Covers #102.

**Verification:** Testbench (U5): walking Pip up the span, the figure pivots to track her;
it glows warm; she can still pass it to the seal.

---

### U4. The reaction beat at the crossing (wordless default; spoken = Jaco's blessing)

**Goal:** Reaching the figure triggers a **reaction beat, not silence** (#104) — a short
acknowledgement that leads into the climax, without pre-empting the blessed closing seal
scene.

**Requirements:** #154 (2) — the "short dialog that leads into the story" half; #104;
master-prd #4 (restraint).

**Dependencies:** U3 (the figure is an NPC). **GATED on the GATE-1 direction decision and,
for the spoken variant, on Jaco's blessing of the lines.**

**Files:**
- `src/data/areas/heart-bridge.ts` (modify — the reaction beat: either a wordless cue, or
  an NPC `dialogues` entry if the spoken variant is blessed).
- Possibly a new trigger or proximity hook for the wordless gesture.

**Approach (two variants — Jaco picks via the Brief):**
- **Wordless (default, no new blessing needed):** the figure's turn-toward (U3) *is* the
  acknowledgement; reaching it plays a brief non-verbal cue (e.g. a head-bow / light-swell)
  and then the existing colour-return + `bridge-sealed` scene carries the meaning. Honors
  Decision 1 ("present, not conversational") fully.
- **Spoken (only if Jaco blesses):** a couple of **young-child-level**, non-doctrinal lines
  as Pip arrives that lead *into* the seal scene without naming doctrine — e.g. a gentle
  "You came. You don't have to carry the last of it. Walk on." The exact lines are
  **Jaco's to bless** (staged gospel call). Governed by `biblical-guidance.md`: kid-level
  reading, allegory intact, Jesus never named in-game, AI-conduct rules.

**Test scenarios:**
- Wordless variant: arriving at the figure fires the cue exactly once per fresh crossing,
  then hands off to the `bridge-sealed` scene; no text box appears (Decision 1 preserved).
- Spoken variant (if blessed): the lines render at kid-level, fire once, and lead into —
  not duplicate — the closing seal scene. Covers #154(2), #104.
- Either variant: the beat never adds a fail state, timer, or branch (received-not-performed).

**Verification:** Testbench (U5): reaching the figure produces a felt acknowledgement that
flows into the seal climax; GATE-2 MP4 captures it for Jaco.

**Execution note:** Do not build the spoken variant until Jaco blesses the lines. Ship the
wordless variant by default; the spoken lines are an additive follow-up if approved.

---

### U5. Testbench scenario + GATE-2 capture

**Goal:** A repeatable headless boot of the redesigned bridge for verification and the
GATE-2 MP4 (the bridge is all-motion: colour-return, the figure turning, the seal — so the
share MUST be a video, not a still).

**Requirements:** ways-of-working verify gate; GATE 2.

**Dependencies:** U1–U4.

**Files:**
- `src/scenarios/<id>.ts` (new or extend `has-words-at-bridge.ts` — spawn Pip at the bridge
  near-end with `has_word: true`, `atoned: false` so a fresh crossing plays).
- `docs/testbench.md` (register the scenario id).

**Approach:** Mirror `has-words-at-bridge.ts`. The capture script records the full
spawn→figure→seal walk; transcode the Playwright webm → **MP4** (system ffmpeg) per the
locked motion-share rule.

**Test scenarios:** `Test expectation: none — this is a verification harness, exercised by
the capture run itself.` Boot smoke must pass on the scenario.

**Verification:** `?scenario=<id>` boots clean headless; the MP4 shows the redesigned span,
the figure tracking Pip + glowing warm, and the grey lifting to a whole, planted world.

---

## System-Wide Impact

- **Save/restore:** `atoned` + `heart_bridge_crossing` semantics are unchanged; rescaling
  the bands (U1) must keep a mid-crossing save restoring the correct grey lift on reload
  (the GameScene desat hook reads the counter on entry).
- **Editor:** the `golden-stag` object kind stays registered so the editor's map-overview
  is unaffected even though the area now spawns the figure as an NPC.
- **Home bookend (#105):** the east exit → ashen-isle home revisit must survive the
  redesign untouched.

## Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| Garden/fountain warmth **softens the atonement austerity** (via-dolorosa tone) | This is the core GATE-1 direction call — option (a) keeps austere→bloom progression; Jaco decides. |
| Giving the stag a **voice** over-reaches Decision 1 | Wordless is the default; spoken lines ship only on Jaco's explicit blessing (U4). |
| Rescaled colour-return bands desync from the new length | Explicit test: counter must hit exactly 4 at the seal (U1). |
| New PixelLab spend | Opportunistic within the existing sub; a big new spend escalates. |
| Stale-tree clobber on PR | `fetch origin main && reset --hard origin/main` before editing (untracked survive); cold PR-review backstop. |

## Verification Strategy

1. `bash autonomy/premerge.sh` → `tsc --noEmit && vite build` clean.
2. Boot smoke (New Game + move, no console/page error).
3. Testbench `?scenario=<id>` (U5) headless → **MP4** capture (motion).
4. `emberpath-pr-review` cold subagent (clean APPROVE).
5. `emberpath-art-review` cold subagent (ANY art/placement PR) — 3/4-oblique + clustering +
   ground-shadow canon + storybook mood.
6. **GATE 2:** MP4 to Jaco for visual approval BEFORE merge.

## Deferred Implementation Notes

- Exact span dimensions, band column positions, and `awarenessRadius` value — tuned during
  build against the feel, not pinned here.
- Whether a bespoke deck Wang tileset is generated or the shipped stone tileset is reused —
  decided in U2 against the approved direction.
- Final fountain/statue object footprints — set when the sprites are generated.
