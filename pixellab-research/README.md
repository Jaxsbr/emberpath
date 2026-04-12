# Ember Fox — PixelLab Research

Reference: https://www.pixellab.ai/mcp

## MCP Setup

```bash
claude mcp add pixellab https://api.pixellab.ai/mcp -t http -H "Authorization: Bearer <token>"
```

## Budget

- **Free tier:** 40 generations
- **Used:** 2 (1 cat character, 1 dog character)
- **Remaining:** 38

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

## Decision

Dog template selected. Better captures the young, scrappy, slightly lanky fox character from the Midjourney concept art.
