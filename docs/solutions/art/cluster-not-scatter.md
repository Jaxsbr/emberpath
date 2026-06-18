---
title: Cluster, don't scatter — cohesion over even spacing
applies_when: Writing or changing any object-placement array (trees, rocks, props, foliage)
status: binding
failure_ids: [FB-1 (sense-of-place), Jaco #344, #482]
canon: docs/art-style.md (Clustering) · docs/art-topdown-guide.md
---

# Cluster, don't scatter

## The rule
Reference forests read as a **thicket with clearings**, never "one tree, gap, one tree"
on a lawn. The #1 complaint was loose, evenly-spaced single objects on bare ground.

- Plant trees in **groups of 2–4** (guide: up to 3–7), touching/overlapping canopies,
  **mixed types** within a group (oak + pine + a bush).
- Pack **undergrowth densely around and between** each group — bushes, shrubs,
  grass-tufts, rocks, stumps, flowers. The ground around a cluster is busy, not bare.
- **Negative space is deliberate:** keep ~40–60% of ground clear in clearings (they
  double as the lit path / play space). Don't fill every tile; don't sprinkle evenly.
- **Edges densest** (a treeline framing the map), thinning toward the walkable centre.
- Artificial things (paths, fences, planted rows) get **regular** spacing; nature gets
  **irregular** — that contrast is how the player reads wilderness vs. civilisation.

## Sense of place (Jaco #482)
A scene must feel **lived-in**, not a dev tutorial. A building implies context: a worn
path to the door, a tended patch, nearby wilderness/neighbours, varied ground. A fence
encloses *something* and connects to a building or other fences — never a lone segment
floating in open grass. The anti-example: "a nice house but a thin fence in the middle
of a uniform field."

## The test
- Does it read as a thicket-with-clearings, or "objects on a lawn"? (lawn = FAIL)
- Are objects in mixed clusters with packed undergrowth, or evenly spaced singles?
- Does every fence/path/prop have a **reason** to be where it is and connect to something?
- Uniform-field smell test: large areas of one repeating tile with evenly spaced lone
  objects = dev grid = FAIL.

Apply hardest to the **opening area** (first thing a cold player sees). Full guide:
`docs/art-topdown-guide.md`.
