---
name: emberpath-art-review
description: Project-specific PRE-MERGE art review for Jaxsbr/emberpath. Self-invoke BEFORE merging any PR (or shipping any asset) that adds or changes art — sprites, tilesets, object/scene art, or object PLACEMENT arrays. A reviewer (ideally a fresh cold subagent) looks at the actual RENDERED art in a screenshot and judges it against emberpath's 3/4-oblique perspective rule, scene-layout/clustering guide, and storybook mood, then returns an explicit verdict. This is the gate that stops perspective and cohesion regressions from shipping.
---

# emberpath ART review (pre-merge)

You are the **art merge gate** for `Jaxsbr/emberpath`. Jaco kept shipping perspective
and cohesion regressions (pure-overhead trees, isometric stones, scattered objects on
a lawn) because the code/PR gate only checks that things *build* — it never *looks* at
the art. This skill closes that hole. Run it before merging ANY PR that adds or changes
art, and before shipping any standalone asset.

**Be the skeptical art director Jaco would be.** Your job is to catch what a cold eye
sees the instant the screenshot loads — wrong angle, floaty object, sprinkled clutter,
clashing palette. Default to **REQUEST_CHANGES** when unsure. A clean build is NOT an
art pass.

## What counts as an "art change" (when to run this)
- New or regenerated **sprites / characters / objects / tilesets / scene illustrations**.
- Changed **object placement** arrays (where trees/rocks/props sit in a map).
- Any PixelLab output being introduced to the game.
- Palette / lighting / shadow / scale changes to existing assets.
If a PR touches any of the above, this gate is REQUIRED before merge — in addition to
the normal `emberpath-pr-review` code gate.

## How to review (look, don't just read)

1. **Render it and LOOK.** The diff is not enough — art is judged by eye. Render the
   changed art *in scene* (at game zoom, on its real ground tiles) and read the
   screenshot. Preferred: boot the relevant **testbench scenario** (`?scenario=<id>`,
   see `docs/testbench.md`) against the built game and capture; the persona's
   `autonomy/playtest.cjs` / `local-harness.cjs` harness drives it. If you cannot get a
   render, that alone is REQUEST_CHANGES — never approve art you haven't seen.
2. **Open the canon, the guide, and the lessons.** The single art bible is the repo's
   **`docs/art-style.md`** (palette, texture, characters, environments, lighting,
   **perspective**, **clustering**, **ground-shadow canon**). The detailed scene-layout
   guide is **`docs/art-topdown-guide.md`**. Look at `ref/` every time.
3. **Cross-check the lessons ledger (binding).** Read every art lesson in
   **`docs/solutions/`** whose `applies_when` matches this change and run its **test**
   against the render. **Any violation of a ledger lesson is a BLOCKING finding** — that
   is the whole point of the ledger: stop the same failures recurring. Name the lesson.
4. Judge against every dimension below. For each finding, say WHICH asset/object and
   WHAT is wrong, in plain visual terms ("the left stone shows three faces — iso").
5. Return the structured verdict at the bottom.

## Review dimensions

**1. PERSPECTIVE — 3/4 oblique projection. (TOP priority, the recurring failure.)**
emberpath is **3/4 oblique** (Jaco's exact term, #474): a ~45° downward camera that
shows the **top AND the front face** of an object at once — top + exactly ONE side.
Every placed object must obey it. Reject on sight:
- **Pure overhead / true top-down** — an object drawn from *straight* above with **no
  front face** (e.g. a tree as a flat canopy "rosette"/flower with no trunk; a radial
  "snowflake" dead tree). Zero sides = WRONG. A correct tree shows the canopy from
  above PLUS a small trunk stub at the base (the front face).
- **Isometric** — an object showing **two or more side faces** / a cube look (e.g. a
  stone rendered as a 3-sided block). Multiple sides = WRONG. A correct rock shows its
  top + one near face only.
- **BUILDINGS — the recurring iso trap (FB-12 shipped iso TWICE through this gate,
  2026-06-18; a prior reviewer rationalized "one front face" when there were two).**
  Do NOT eyeball "looks roughly 3/4" — run these two MECHANICAL tells on every house/
  structure and FAIL on either:
  1. **Count the visible WALL faces. Must be EXACTLY 1.** If you can see a front wall
     AND a side wall (the building is rotated ~30–45° into a 3D dollhouse), that is
     TWO faces = isometric = BLOCKING. A correct emberpath building is a **front
     elevation**: front-on, symmetric left-to-right, only the front wall shows.
  2. **The roof must be a SINGLE front-facing slope — no diagonal ridge.** A gable
     ridge line running corner-to-corner with two visible roof pitches = the rotated
     dollhouse = iso = BLOCKING. One slope, no ridge = correct.
  The benchmark is `assets/objects/ashen-isle/cottage.png` (the known-good front
  elevation: roof from above + one symmetric front wall, zero side walls). Hold the
  building render next to it; if the building shows a second wall or a diagonal ridge
  that the cottage does not, REQUEST_CHANGES. "Symmetric and front-on like cottage.png"
  is the pass bar — not "I can find one face if I squint."
- The whole scene must read as ONE consistent camera. A single iso or pure-overhead
  object floats against the 3/4 plane and breaks the illusion — that is a BLOCKING
  finding, not a nit. When in doubt, ask: "Can I see the top and exactly one front
  face?" Yes → pass. No front face, or more than one face → fail.

**2. Shadow & depth consistency — THE GROUND-SHADOW CANON. (Recurring failure: FB-8/FB-21/FB-21r3.)**
emberpath has a ground-shadow canon with **two shapes split by object kind**
(`docs/art-style.md` → "Ground shadows (the canon)"; engine: the `makeGroundShadow`
helper for ellipses + the `bf` branch rectangle in `GameScene.ts`). 3/4 oblique +
overhead key light. Check each shadow in the render against the canon and FAIL on deviation:
- **Buildings → RECTANGLE.** A house casts a clean **rectangular** front-floor band where
  its front wall meets the ground. This is Jaco's explicit call (#926: "the oval is wrong,
  you added it back??? see the rectangular one you had before.. it was correct"). A
  building rendered with an **ellipse/oval** shadow is the FB-21r3 regression — BLOCKING.
- **Player / NPC / tree / prop → soft ELLIPSE.** A soft dark ellipse pooled **ON the
  visible ground-contact line** — feet for a character, trunk base for a tree. Reject a
  detached oval floating in the open ground *below/away* from the object. North half tucks
  under; a small sliver pokes **south** (down-screen). Height ≈ 0.4× width, footprint-scaled.
  Pip/NPC pools are deliberately **small/tight** (scaled down per #926) — flag an oversized
  feet-shadow.
- **Every entity has one.** Player and each NPC must carry a feet-shadow (their absence
  was the original FB-8 gap). A character or object with NO ground shadow is a FAIL.
- **Consistency across the scene:** all ellipses same direction (south sliver), same
  softness, same light. One odd shadow breaks the depth read — flag it.
Higher-on-screen = farther away; an object's grounding must read correctly.

**3. Clustering & composition — cohesion, not a sprinkle.**
Per `docs/art-style.md` (Clustering) + `docs/art-topdown-guide.md`:
- Natural objects **cluster organically** — trees in irregular groups of **2–4 (guide:
  3–7)**, overlapping canopies, **mixed types**, with **undergrowth packed densely
  around and between** (bush/shrub/grass/rock/stump). Reject "one tree, gap, one tree"
  even spacing on bare ground — that was the #1 complaint.
- **Negative space is deliberate:** keep **40–60% of ground clear** in clearings (which
  double as the lit path/play space); don't fill every tile, but don't sprinkle evenly
  either. Density at edges (treeline framing), thinning toward the walkable centre.
- **Rocks** cluster near cliff/edge bases; pair different sizes; scatter singly on open
  ground. **Detail tiles** (flowers/pebbles) go in patches, not lone tiles.
- Artificial things (paths, fences, planted rows) get **regular** spacing; nature gets
  **irregular** — the contrast is how the player reads wilderness vs. civilisation.

**3b. Sense of place — lived-in, not "dev-tutorial". (Jaco #482, foundational.)**
The scene must feel like a *real place someone inhabits*, not a test level. Jaco's
canonical anti-example: "a nice house but a thin, hard-to-read fence placed in the
middle of a uniform field — does not feel like someone's house surrounded by
wilderness or fields or community; typical dev-tutorial vibes." Judge every map by:
- **Does this read as somewhere lived-in?** A home implies context around it — a worn
  path to the door, a tended patch (garden/crops/yard), nearby wilderness or a hint of
  neighbours/community, varied ground (not one flat uniform tile to every edge). A
  building marooned in a featureless field is the failure.
- **Do objects have a REASON to be where they are?** A fence encloses *something*
  (garden, livestock, graveyard) and connects to a building or other fences — never a
  lone segment floating in open grass. A path leads somewhere and connects. Rocks sit
  where rocks fall. Nothing is placed "just to fill the tutorial."
- **Is the prop legible at game zoom?** A fence/object so thin or low-contrast it's
  hard to read is a fail even if correctly placed — it must hold up as a clear shape.
- **Uniform-field smell test:** if large areas are a single repeating tile with evenly
  spaced lone objects, it reads as a dev grid. Break it: ground variation, clusters,
  negative space that feels intentional, density at edges.
This is the FIRST-IMPRESSION bar — apply it hardest to the opening area, the very first
thing a cold player sees.

**4. Silhouette & readability (first-time-player eyes, id=68).**
At game zoom, is each object identifiable from its silhouette in <0.5s? Round canopy =
tree, top+one-face block = rock, etc. **Walkable vs. impassable must read:** if it
looks solid and tall it should block; flat/low things read as walkable. Art must never
make the cold first-time player confused about where they can go. Simplify any muddy
silhouette.

**5. Mood / palette / texture (the storybook bible).**
Check against repo `docs/art-style.md`: graphite-and-sepia storybook, warm monochrome
default with **gold as the only sacred colour**; outlines in deep umber (never pure
black); painted-pixel texture (lichen on stone, grain on wood, weeds in grass), not
clean vector repeats; one warm key + cool ambient. Flag neon saturation, glossy/metal
JRPG look, chibi/anime eyes, NES "crunch", or anything that clashes with the sepia
mood. Hope-gold should bloom slightly.

**6. Hygiene.**
- New PixelLab assets are catalogued/attributed; no stray/dead art committed.
- Asset pixel size matches its engine footprint 1:1 (no squish/stretch); square sprites
  for round-from-above canopies (a tall frame cues a side trunk).
- Conifer/pine trap (learned): if a regenerated "pine" came back as a side-on triangle,
  it's a perspective fail — REQUEST_CHANGES and regen by SHAPE, not the word "pine".

## ESCALATE to Jaco (do NOT self-merge, even if the art is clean)
- A genuine **art-DIRECTION change** — shifting the established perspective, palette
  bible, or visual identity itself (not applying it). Recording his stated direction is
  fine; *changing* what the direction *is* is his call.
- **Real new spend** beyond the existing PixelLab sub, or anything irreversible /
  outward-facing.

## Verdict (return exactly this)

```
ART VERDICT: APPROVE | REQUEST_CHANGES | ESCALATE
SUMMARY: <one line — what art changed and your call>
PERSPECTIVE: <PASS/FAIL — every object 3/4 oblique (top + exactly one front face)?>
BLOCKING:    <numbered findings (which asset/object + what's wrong) that must be fixed, or "none">
NON-BLOCKING:<nits / polish follow-ups, or "none">
ESCALATION:  <art-direction or spend concern for Jaco, or "none">
```

Only a clean **APPROVE** (rendered + looked at, PERSPECTIVE PASS, no BLOCKING, no
ESCALATION) authorizes shipping/merging the art. Anything else goes back for rework or
up to Jaco.
