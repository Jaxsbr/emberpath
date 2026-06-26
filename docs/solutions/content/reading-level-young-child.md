---
title: Player-facing text reads at a young-child level
applies_when: Writing or changing any player-facing text (dialogue, thoughts, UI, scene beats, credits)
status: binding
failure_ids: [North Star id=68 #3, F3 #199]
canon: docs/master-prd.md · biblical-guidance (persona, private)
---

# Young-child reading level

## The rule
ALL player-facing text — dialogue, thoughts, UI, scene beats — reads at a **young-child
level**: short sentences, common concrete words, one idea at a time. Jaco's young
daughter is the bar. The **allegory must survive the simplification**, never be lost to it.

## Why this lesson exists
A North-Star playtest finding (id=68 #3): the reading level was too high across all
player text — his daughter couldn't understand the dialogue/thoughts. Clarity for a
first-time child reader is priority, not literary polish.

## The test
- Read each new/changed line aloud as a 6-year-old. Any word too advanced/abstract? Any
  sentence too long or carrying two ideas? → rewrite.
- Did the simplification keep the allegorical meaning intact?
- In-game story stays **allegorical and never names Jesus** (per master-prd); explicit
  doctrine lives only in the credits/reveal.

## The objective floor is now machine-enforced (F3 #199)
The aloud-read is the meaning test; it can't run on every future edit. So there is now an
**automatic regression guard** that locks the level a human pass already achieved:
- `src/content/readability.ts` — pure, node-safe Flesch–Kincaid scorer (sentence length +
  grade). `src/content/extractPlayerText.ts` — walks an `AreaDefinition` and pulls every
  player-facing string with a path label (skips id-style `actionRef`s; only `type:'thought'`
  triggers carry literal text).
- `test/readability.test.ts` — fails CI if any line runs **>16 words/sentence** or any prose
  line climbs **above grade 6** (short UI labels / proper-noun signposts are exempt from the
  grade check — Flesch–Kincaid is noise on 2–3 word fragments — but still bound by the length
  cap). Caps sit just above the measured reality so today's text passes and a genuine
  regression trips.
- **What the F3 pass actually found:** the whole game was *already* at early-reader level
  (median FK grade ≈0.5, longest real sentence 14 words) — a prior North-Star pass had done
  the rewrite. So F3's real deliverable became the **permanent guard** above + a **voice-
  coherence** fix, not a wholesale rewrite. Measure before you rewrite; a clean measurement
  can re-shape the task.

## Voice coherence — one steady voice per remembered passage (F3 #199)
A passage Pip "remembers" must not flip between first- and third-person self-reference. The
Briar inscribed stone read *"Pip remembers the words she was given / I am not alone… / Her
little ember holds steady"* — 3rd→1st→3rd, two narrators arguing over one voice. Fixed to one
first-person voice (*"I remember the words I was given / … / My little ember…"*). The guard
test asserts no inscribed-stone `rememberedLines` set mixes first- and third-person self words.
(A single 3rd-person *framing* line that then addresses her in 2nd person — the Ashen stone —
is fine; the defect is the I↔she flip, not any mention of her name.)
