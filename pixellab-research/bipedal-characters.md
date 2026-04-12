# Bipedal Fox Characters — Phase 2 Reference

Created: 2026-04-12
Purpose: Proportion comparison for Emberpath bipedal fox protagonist. Two style variants
generated to evaluate head/body ratio before committing to Phase 2 animations.

## Characters

### Chibi (Fox Cub Chibi)
- **Character ID:** `227c83a4-96ee-41e1-b002-018f13eff385`
- **Proportion type:** Chibi — large head relative to body, compact limbs
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** south, east, north, west
- **Local images:** `bipedal-chibi/` (south.png, east.png, north.png, west.png)

### Cartoon (Fox Cub Cartoon)
- **Character ID:** `e1a87ce8-dd28-4700-a5b7-c8f2ac760d4b`
- **Proportion type:** Cartoon — more balanced head/body ratio, slightly taller silhouette
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** south, east, north, west
- **Local images:** `bipedal-cartoon/` (south.png, east.png, north.png, west.png)

### Realistic (Fox Cub Realistic)
- **Character ID:** `a38fa332-371d-4e11-92c3-8c5a3c82ee13`
- **Proportion type:** Realistic — natural anatomical proportions, taller and slimmer silhouette
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** south, east, north, west
- **Local images:** `bipedal-realistic/` (south.png, east.png, north.png, west.png)

### Child (Fox Cub Child)
- **Character ID:** `db38464e-a089-4c93-9b23-1136618e1c22`
- **Proportion type:** Custom child proportions — head 1.3, arms 0.8, legs 0.8, shoulders 0.7, hips 0.7
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** south, east, north, west
- **Local images:** `bipedal-child/` (south.png, east.png, north.png, west.png)

### Realistic Young (Fox Cub Realistic Young)
- **Character ID:** `1728d686-6ce7-4390-9c10-9cc2394a3251`
- **Proportion type:** Realistic male — natural anatomical proportions applied to a younger, smaller frame
- **Description:** Young orphan fox cub — scrawny build, wearing tattered rags. Conveys vulnerability and a survival backstory. Intended to evoke empathy and narrative weight for the protagonist role.
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** south, east, north, west
- **Local images:** `bipedal-realistic-young/` (south.png, east.png, north.png, west.png)

## Shared Settings (all characters)

```
body_type: humanoid
size: 48
view: low top-down
outline: single color black outline
shading: medium shading
detail: high detail
ai_freedom: 600
mode: standard
```

## Exact Prompts Used

### Chibi, Cartoon, Realistic — same description

```
description: "An anthropomorphic fox cub, bipedal, light golden-tan fur, darker
              brown-black ears and back markings, white-tipped fluffy tail, big kind
              expressive eyes, small and cute, wearing a simple traveler's cloak,
              adventurous spirit, warm golden tones"
```

| Variant  | proportions |
|----------|-------------|
| Chibi    | `{"type": "preset", "name": "chibi"}` |
| Cartoon  | `{"type": "preset", "name": "cartoon"}` |
| Realistic | `{"type": "preset", "name": "realistic_male"}` |

**Result notes:** Realistic picked red formal clothing and looked mature/wealthy. The "traveler's cloak" prompt was mostly ignored across all three.

### Realistic Young — adjusted description

```
description: "A young orphan fox cub, bipedal, small and scrawny, light golden-tan fur,
              darker brown-black ears and back markings, white-tipped fluffy tail, big
              innocent eyes, wearing tattered brown cloth rags, barefoot, humble and
              determined"
proportions: {"type": "preset", "name": "realistic_male"}
```

**Result notes:** Came out muscular, angry, and adult despite "young" and "scrawny" in prompt. The realistic_male preset overrides youth cues. "Orphan" and "scrawny" pushed it toward gritty/tough aesthetic.

### Child (Custom) — winning variant

```
description: "A tiny fox child, bipedal, very young and small, soft light golden-tan fur,
              big round innocent eyes, oversized ears, white-tipped fluffy tail, wearing a
              simple loose brown tunic that is too big, no shoes, shy and gentle, warm
              golden tones"
proportions: {"type": "custom", "head_size": 1.3, "arms_length": 0.8, "legs_length": 0.8,
              "shoulder_width": 0.7, "hip_width": 0.7}
```

**Result notes:** Best result. Custom proportions were key — preset "realistic_male" always reads adult. The larger head (1.3) + shorter limbs (0.8) + narrow frame (0.7) creates a childlike silhouette. Softer language ("tiny", "gentle", "shy") also helped vs. the "orphan/scrawny" attempt. Brown tunic rendered well.

## Iteration Notes

- **Presets vs custom proportions:** For non-adult characters, always use custom proportions. The named presets (chibi, cartoon, realistic_male) have strong built-in assumptions.
- **Clothing color:** PixelLab tends toward red/formal clothing on realistic presets. Explicitly specify "brown" or muted colors.
- **Youth cues that work:** "tiny", "very young", "big round eyes", "oversized ears", oversized clothing
- **Youth cues that don't work:** "orphan", "scrawny" (triggers tough/gritty), "young" alone (too weak)
- **Tail direction:** Inconsistent across east-facing views — most variants have tails pointing forward instead of trailing behind. This is a PixelLab limitation, not controllable via prompt. Fixable in Aseprite post-processing.

## Quadruped Research (earlier, for reference)

The original quadruped fox research is documented in `README.md` in this directory. Key findings:
- Quadruped templates: bear, cat, dog, horse, lion (no fox — dog was closest)
- 8 directions broken for quadrupeds (server-side KeyError)
- Template animations are take-it-or-leave-it — no individual body part control
- The pivot from quadruped to bipedal was driven by these limitations

---

## Phase 2 — Final Character

**Completed:** 2026-04-12

### Fox Cub Child 8dir (Final)

- **Character ID:** `6a4a3591-ac4c-4596-86dd-fbb96b4af49f`
- **Character name:** Fox Cub Child 8dir
- **Proportion type:** Child — head 1.3, arms 0.8, legs 0.8, shoulders 0.7, hips 0.7
- **Canvas:** 68×68px, character ~40px tall, ~30px wide
- **Directions:** 8 (south, east, north, west, south-east, north-east, north-west, south-west)
- **View:** low top-down
- **Outline:** single color black outline
- **Shading:** medium shading
- **Detail:** high detail
- **Local assets:** `fox-child-final/`

### Animations Generated

| Animation | Template ID | Frames | Directions | Local path |
|-----------|-------------|--------|------------|------------|
| Breathing Idle | `breathing-idle` | 4 frames | 8 | `fox-child-final/idle/{direction}/frame_NNN.png` |
| Walking | `walking-8-frames` | 8 frames | 8 | `fox-child-final/walk/{direction}/frame_NNN.png` |

### Asset Summary

- Static rotations: `fox-child-final/static/` — 8 PNG files (one per direction)
- Idle animation: `fox-child-final/idle/` — 32 PNG files (8 dirs × 4 frames)
- Walk animation: `fox-child-final/walk/` — 64 PNG files (8 dirs × 8 frames)
- Preview HTML: `fox-child-animations.html` — animated canvas preview with FPS and scale controls

### Animation ZIP

Extracted from PixelLab ZIP download. Internal animation UUIDs:
- `animating-48e5967d` → breathing-idle (4 frames)
- `animating-a4452e42` → walking-8-frames (8 frames)
