# Lessons & Solutions — the ledger

This is emberpath's **consult-every-time** memory: the failures we keep repeating,
each captured once with a *test* so we stop repeating them. `ce-compound` appends
here at the end of every unit of work.

**Read the lessons that match your task BEFORE you start it** (the `applies_when`
line on each). The `emberpath-art-review` gate **fails any change that violates an
art lesson here** — so a lesson is a hard rule, not a suggestion.

## Guardrail lessons (the recurring failures)

| Lesson | Applies when | One-line rule |
|--------|--------------|---------------|
| [art/3-4-oblique-not-iso](art/3-4-oblique-not-iso.md) | Generating/placing ANY sprite, tile, building, prop | Top + **exactly one** front face. No pure-overhead, no iso. |
| [art/ground-shadow-canon](art/ground-shadow-canon.md) | Touching any shadow, or adding any entity/building | Buildings → **rectangle**; everything else → soft **ellipse** at the contact line. One light. |
| [art/cluster-not-scatter](art/cluster-not-scatter.md) | Writing any object-placement array | Clusters of 2–4 + dense undergrowth + deliberate clearings. Never a sprinkle. |
| [process/gif-for-motion](process/gif-for-motion.md) | Anything with movement/flow/animation | Demonstrate with a **GIF**, never a still. |
| [process/never-edit-off-unseen-annotation](process/never-edit-off-unseen-annotation.md) | Feedback points at a screenshot/annotation | If the image didn't actually attach, **STOP and ask** — never guess. |
| [content/reading-level-young-child](content/reading-level-young-child.md) | Writing/changing any player-facing text | Young-child reading level; allegory survives the simplification. |
| [content/sacred-words-not-loose](content/sacred-words-not-loose.md) | Writing ANY text (docs, comments, commits, chat) | "Bible"/"Scripture" only for the actual Scriptures — never as a metaphor for "the authoritative doc" (use canon/source of truth/guide). |
| [implementation/area-transition-uses-exit-entrypoint](implementation/area-transition-uses-exit-entrypoint.md) | Changing an area's walkable geometry, or adding a transition testbench scenario | Transitions spawn at the **source exit's `entryPoint`**, not the dest `playerSpawn` — audit every inbound exit when geometry moves; benches must walk the real exit→entry path. |

## Where the full canon lives (the lessons point here, don't duplicate it)

- **Art canon** — [`docs/art-style.md`](../art-style.md): palette, texture, characters,
  environments, lighting, **perspective**, **clustering**, **ground-shadow canon**.
- **Scene-layout guide** — [`docs/art-topdown-guide.md`](../art-topdown-guide.md): the
  detailed 3/4-oblique placement guide (trees, paths, buildings, fences, water, …).
- **Technical/code learnings** — [`docs/plan/LEARNINGS.md`](../plan/LEARNINGS.md): the
  EP-## series (Phaser lifecycle, MCP budget, verification gaps). Kept as-is; new
  *code* learnings can go there or here.

## Adding a lesson

`ce-compound` (or by hand): one file under `art/`, `process/`, `content/`, or
`implementation/`. Keep it short — **the failure, the `applies_when` trigger, and the
test that catches it next time** — and add a row to the table above. A lesson without a
testable check is just a note; give it a check.
</content>
