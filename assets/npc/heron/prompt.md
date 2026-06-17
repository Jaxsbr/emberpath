# Heron — The Keeper

White heron NPC representing The Keeper (Holy Spirit allegory). Rescues Pip in the Fog Marsh dead-end. Generated via PixelLab personal account.

## Sprite (PixelLab Pro, character `1f22c26d-019d-462a-b46e-292d5b9ce1c4`, 8 directions, 84×84 canvas, ~50px tall)

tall slender anthropomorphic white heron sage, bipedal humanoid heron with pure white plumage and soft cream feathers, long elegant S-curved neck, sharp yellow-orange dagger-like beak, calm watchful golden eyes, pale grey wing accents on folded wings at sides, muted earth-tone hooded cloak draped over shoulders hinting at sacred keeper role, dignified upright posture, gentle reverent demeanor, slender bird legs with two-toed feet, watercolor storybook palette

Animations: `idle` (breathing-idle, 4 frames), `walk` (walking-4-frames, 4 frames), `fireball` (6 frames — reads as "summoning light/blessing").

## Portrait (PixelLab Standard, character `03feead1-ae2e-4e6a-b33a-39a7179e5f0a`, 4 directions, 136×136 canvas — experimental, south rotation used as portrait.png)

head and shoulders close-up portrait of an elderly anthropomorphic white heron sage, humanoid heron NOT a real bird, with pure white plumage on the head, long elegant neck, sharp yellow-orange dagger beak, calm watchful golden eyes, soft cream feathers with pale grey accents, simple muted earth-tone hooded cloak draped at the shoulders, dignified gentle reverent expression, centered symmetrical composition, dialog box character portrait, watercolor storybook style, simple solid dark background

## Portrait REGEN (FB-15, 2026-06-17) — pixflux painterly head-and-shoulders

The earlier Standard-character portrait rendered full-body in a long pale robe, mismatching
the in-world sprite (white heron in a SHORT brown earth-tone shoulder-cloak + bird legs). A
`create_character` regen attempt produced an owl-ish brown humanoid (parked, worse). FIX: a
true head-and-shoulders painterly portrait via the pixflux REST illustration path — at that
framing the long-robe-vs-bird-legs conflict disappears and only the shared brown shoulder-cloak
shows. Matches the old-man portrait's gold-standard painterly head-and-shoulders style. Prompt:

`head and shoulders close-up portrait of an elderly anthropomorphic white heron sage, humanoid heron NOT a real bird, pure white plumage on the head, long elegant S-curved neck, sharp yellow-orange dagger beak, calm watchful golden eyes, soft cream feathers with pale grey accents, simple muted earth-tone brown shoulder-cloak draped at the shoulders, dignified gentle reverent expression, centered symmetrical composition, dialog box character portrait, painterly watercolor storybook style, fine detail, simple solid dark background`

Endpoint: `POST https://api.pixellab.ai/v1/generate-image-pixflux`, image_size 256×256, 1 generation.
