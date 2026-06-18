---
title: Never edit off an annotation you can't actually see
applies_when: Feedback points at a screenshot/annotation/marked-up image
status: binding
failure_ids: [FB-21 root cause]
canon: docs/workflow/ways-of-working.md
---

# Never guess off an unseen annotation

## The rule
If feedback references a screenshot, annotation, or marked-up image — and the image did
**not** actually attach / is not actually visible to you — you are **BLOCKED**. Stop, ask
Jaco to resend it, and do **not** guess the position/shape/colour and edit pixels anyway.

## Why this lesson exists
A root cause of the FB-21 shadow failure (which failed **twice**): pixels were edited off
an annotated screenshot that never attached. Each round guessed a different position and
shape and swung to the opposite of the round before — pure thrash, no signal.

## The test
- Does the feedback point at an image? Can I actually see that image right now?
- If no → raise it as a blocker (see the escalation rule in ways-of-working): one line,
  "I can't see the annotation you referenced — please resend," and wait. Don't proceed
  on a guess.
