# Pre-flight — read before you start

A short, binding checklist run at the **Prepare** step of every unit of work, before
touching code or generating art. Its job is to stop repeating known failures by making
the relevant lessons a *required read*, not an optional one.

## Always
- [ ] Read the GitHub issue; restate the task in one line + its definition of done.
- [ ] Skim `docs/solutions/README.md` (the Lessons Index) and open every lesson whose
      `applies_when` matches this task. These are **binding rules**, not tips.

## If the task touches ART, assets, or placement
- [ ] Read [`docs/solutions/art/3-4-oblique-not-iso`](../solutions/art/3-4-oblique-not-iso.md),
      [`ground-shadow-canon`](../solutions/art/ground-shadow-canon.md),
      [`cluster-not-scatter`](../solutions/art/cluster-not-scatter.md).
- [ ] Read the relevant parts of **`docs/art-style.md`** (perspective, clustering,
      ground-shadow canon, palette) and **`docs/art-topdown-guide.md`** (the placement
      guide). Look at `ref/`.
- [ ] Know the **test** you'll run on the result *before* you generate it (e.g. "top +
      exactly one front face"; "building shadow = rectangle"). If you can't state the
      test, you're not ready to generate.

## If the task has MOTION / flow / animation
- [ ] Plan to capture a **GIF** for the preview, not a still
      ([`process/gif-for-motion`](../solutions/process/gif-for-motion.md)).

## If the task changes player-facing TEXT
- [ ] Hold it to the young-child reading level
      ([`content/reading-level-young-child`](../solutions/content/reading-level-young-child.md));
      keep the allegory; never name Jesus in-game.

## If feedback points at a screenshot/annotation
- [ ] Confirm you can actually SEE it. If it didn't attach, STOP and ask — never guess
      ([`process/never-edit-off-unseen-annotation`](../solutions/process/never-edit-off-unseen-annotation.md)).

> The `emberpath-art-review` gate independently re-checks the art lessons at merge time
> and **fails** any violation. Pre-flight is how you avoid getting sent back there.
