---
title: Don't use sacred words loosely — "Bible" is not a metaphor for "authoritative doc"
applies_when: Writing ANY text — docs, comments, commit messages, skills, chat, player text
status: binding
failure_ids: [PR #152 review — "the art bible"]
---

# Sacred words are not loose metaphors

## The rule
**Reserve "Bible" and "Scripture" for the actual Scriptures.** Never use them as a casual
metaphor for "the authoritative document" (e.g. "the art bible", "the style bible", "the
palette bible"). The Bible is sacred; using it loosely cheapens it — especially in a
gospel-centric project.

For a document's authority, use instead: **source of truth · canon · guide · reference ·
the spec**. (e.g. "the art **canon**" / "`docs/art-style.md` is the **source of truth**".)

## Legitimate uses (these are fine — they refer to the actual Bible)
- The in-game allegory mapping: "the Word = the Bible", "the Word is never *named* as the
  Bible" (master-prd / phase docs).
- `biblical-guidance` / "biblical guidance" — the doctrinal frame, genuinely scripture-based.
- Proper nouns / real resources: "YouVersion Bible App for Kids".

The line: referring to *the actual Bible* = fine; using "bible" to mean *"the important
file"* = not fine.

## Why this lesson exists
PR #152 shipped "the art bible" / "the storybook bible" as a metaphor for the style guide.
Jaco flagged it: "Bible is sacred, not to be used loosely." Changed to source of truth /
canon.

## The test
- Search the change for "bible" / "scripture" (case-insensitive). For each: does it refer
  to the *actual* Bible? Yes → keep. No (it means "authoritative doc") → replace with
  canon / source of truth / guide.
