# Ember Fox — PixelLab Research

Reference: https://www.pixellab.ai/mcp

## MCP Setup

```bash
claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer <token>"
```

## Budget

- **Free tier:** 40 generations
- **Used:** 14 (2 characters + 12 template animations)
- **Remaining:** 26

## Character Generation

Two variants generated using `mcp__pixellab__create_character`:

```
description: "A young fragile-looking fox with light golden-tan fur, darker brown-black ears
              and back markings, white-tipped fluffy tail, big kind goofy eyes, small and cute,
              adventurous spirit, warm golden tones"
body_type: quadruped
size: 48
view: side
n_directions: 4
outline: single color black outline
shading: medium shading
detail: high detail
ai_freedom: 600
```

- **cat/** — `template: cat`
- **dog/** — `template: dog` (selected)

## Known Issues

- **Quadruped + 8 directions fails.** Server-side `KeyError: 'bone_scaling'` when requesting 8 directional views with any quadruped template. 4 directions works fine. Bug is on PixelLab's end.

## Available Quadruped Templates

Only 5 options: `bear`, `cat`, `dog`, `horse`, `lion`. No fox template exists — `dog` was the closest fit.

## Generation Modes

- **standard** — template-based skeleton, costs 1 generation, supports 4 or 8 directions (8 broken for quadrupeds)
- **pro** — AI reference-based, higher quality, costs 20-40 generations, always 8 directions

## Animation Costs

- **Template animation:** 1 generation per direction (cheap)
- **Custom animation:** 20-40 generations per direction (expensive, avoid on free tier)

## Available Template Animations — Dog

| ID | Description |
|----|-------------|
| `idle` | Standing idle loop |
| `bark` | Barking |
| `walk-4-frames` | Walk cycle, 4 frames |
| `walk-6-frames` | Walk cycle, 6 frames |
| `walk-8-frames` | Walk cycle, 8 frames |
| `fast-walk` | Faster walk cycle |
| `running-4-frames` | Run cycle, 4 frames |
| `running-6-frames` | Run cycle, 6 frames |
| `running-8-frames` | Run cycle, 8 frames |
| `sneaking` | Sneaking/stealth movement |

## Available Template Animations — Cat

| ID | Description |
|----|-------------|
| `idle` | Standing idle loop |
| `angry` | Angry pose/animation |
| `drinking` | Drinking |
| `eating` | Eating |
| `jump` | Jump |
| `licking` | Licking/grooming |
| `running-4-frames` | Run cycle, 4 frames |
| `running-6-frames` | Run cycle, 6 frames |
| `running-8-frames` | Run cycle, 8 frames |
| `seated-on-belly-idle` | Seated on belly idle |
| `sitting` | Sitting |
| `sitting-on-belly` | Lying on belly |
| `slow-run` | Slow run |
| `standing` | Standing |
| `standing-from-belly` | Getting up from belly |
| `walk-4-frames` | Walk cycle, 4 frames |
| `walk-6-frames` | Walk cycle, 6 frames |
| `walk-8-frames` | Walk cycle, 8 frames |

Note: Cat template has more animation variety (19 vs 10), but dog was selected for better visual fit.

## Generated Animations

Three template animations generated for the dog character (8 frames each, 4 directions):

| Animation | Folder | Cost |
|-----------|--------|------|
| Idle | `dog-animations/animation-b456e6de/` | 4 gens |
| Walk | `dog-animations/walking-87ced120/` | 4 gens |
| Run | `dog-animations/running-387f57ef/` | 4 gens |

View in `animations.html` — has FPS and scale controls.

## Quality Issues

- **South/north walk & run:** Tail sits low and static. East/west versions have the tail raised and animated properly. This is a skeleton/template limitation — no way to adjust individual body part positioning via MCP.
- **Idle east/west:** Fox is standing. A sitting idle would look more natural but the dog template has no sitting animation. Only the cat template has `sitting`, `sitting-on-belly`, `seated-on-belly-idle`.

### Why these can't be fixed via MCP (free tier)

Template animations are take-it-or-leave-it — the skeleton dictates posture and there's no parameter to adjust individual aspects like tail height.

Custom animations (`action_description` instead of `template_animation_id`) offer creative control but cost 20-40 gens per direction. Even fixing 2 directions for 1 animation could cost 40-80 gens — well over the remaining budget of 26.

| Fix attempt | Cost | Feasible on free tier? |
|-------------|------|----------------------|
| Custom idle "sitting" — 1 direction | 20-40 gens | Barely (best case) |
| Custom idle "sitting" — all 4 | 80-160 gens | No |
| Custom walk with raised tail — south+north | 40-80 gens | No |

**Conclusion:** Free tier is sufficient for evaluating the tool and generating base sprites, but not for iterating on quality. Creative control requires paid tier (~2000 gens).

## Alternative Approaches — Tested

1. **Midjourney frame fixing — NOT VIABLE.** Reusing the same prompt and settings does not produce visually consistent frames. Each generation varies too much to assemble into a coherent sprite sheet. Midjourney is good for concept art (used for the original fox inspiration) but not for frame-by-frame animation work.

2. **Aseprite manual editing — WORKS BUT PAINFUL.** Manually editing individual frames at pixel level is tedious even with PixelLab output as a base. Not scalable across multiple animations and directions.

3. **PixelLab paid tier — BEST STARTING POINT, NOT FINAL OUTPUT.** $12/mo unlocks ~2000 generations and custom animations with creative control. PixelLab's advantage is consistency across frames and directions — but output still has quality issues. Frame-to-frame position shifts (1-2px on x/y axis) cause visual jitter in-game. Manual correction is still required.

## Realistic Pipeline Assessment

PixelLab generates a starting point, not production-ready sprites. Even with paid tier and custom animations, expect to manually fix:
- Frame-to-frame position shifts (1-2px jitter between animation frames)
- Template skeleton limitations (tail position, posture)
- South/north direction quality vs east/west

**Likely pipeline:** PixelLab (base generation) → custom tooling (automated alignment/jitter fixing) → Aseprite (final manual polish)

Custom tooling to explore: automated sprite alignment (anchor point normalization, bounding box stabilization across frames) to reduce the manual Aseprite work.

## Decision

Dog template selected. Better captures the young, scrappy, slightly lanky fox character from the Midjourney concept art.
