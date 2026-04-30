# Manual verify — scene-art-and-thoughts

Per-story manual checklists for US-88 (thought bubble), US-89 (StoryScene image rendering + cross-fade), and US-91 (asset generation walkthrough). Run `npm run dev`, walk the listed triggers, and tick each box.

## Thought bubble visual + readability check (US-88)

Pre-conditions: spawn into Ashen Isle (`?reset=1` if needed). Fox-pip walks at default speed.

Each thought trigger renders the cream/umber rounded panel, italic Phaser-default font, multi-line wrap when needed, symmetric padding above and below text. Verify at desktop viewport (~1280×720) AND mobile viewport (DevTools 360×640).

- [ ] `start-thought` — fires on Ashen Isle spawn at the player's first walk frame. Single short line ("Where am I? Everything feels... grey." or similar). Bubble reads cleanly at desktop, glyphs are sharp at mobile.
- [ ] `room-echo` (Fog Marsh interior threshold trigger, near area centre) — long single-line thought wraps to ≥ 2 lines at mobile (360×640) without horizontal overflow past the panel edge.
- [ ] `homecoming-reflection` (Ashen Isle village centre, fires after both Wren and Old Man are warmed) — three-line thought ("There is more light to share, beyond this island..." plus the two preceding lines) shows ALL three lines; bubble height ≥ 3 × line-height.
- [ ] `marsh-deepens` (Fog Marsh trigger near the south band) — fires; renders as expected.
- [ ] Escape-attempt subscriber thoughts (Fog Marsh interior trip-line band, repeated walks east into the closed exit) — each band fires its own thought; bubble re-renders cleanly across firings.
- [ ] `ashen-isle-mark` (Ashen Isle, post-Ember-mark trigger near home) — bubble renders the post-Ember reflection cleanly.

Cross-cutting checks:
- [ ] Walk during a thought — bubble follows the player at all times, world-space anchor stable.
- [ ] Trigger a dialogue with a queued thought — thought defers until dialogue close, then fires.
- [ ] Resize browser between desktop and mobile aspect ratios while a thought is on-screen — panel re-sizes to text bounds without overflow.
- [ ] Trigger a thought, then `scene.restart` (e.g. walk through an exit to another area) — no stale text/bg objects linger; new area's first thought renders cleanly.

## Story scene art + transition check (US-89)

Pre-conditions: `?reset=1` and walk the natural flow — Old Man dialogue → `ashen-isle-vision` → keeper-rescue chain → `ember-given` → walk to Marsh Hermit → `marsh-vision` (`marsh-depths`).

Each beat shows a real PixelLab pixel-art image (NOT the placeholder rectangle), cross-fade smoothly transitions between beats, typewriter still works, two-tap pattern still works (first tap completes typewriter, second tap advances).

**ashen-isle-intro** (4 beats):
- [ ] Beat 0 — Ashen sky over coastline. Drifting ash, sepia-dominant.
- [ ] Beat 1 — Cracked grey-brown earth, faint hope-gold glow rising from cracks.
- [ ] Beat 2 — Distant smoke trail on horizon over an ashen plain.
- [ ] Beat 3 — Small fox pilgrim in hooded cloak, head bowed on cracked stone.

**ember-given** (3 beats):
- [ ] Beat 0 — Heron Keeper steps through silver-grey fog. Hope-gold catches the long feathers.
- [ ] Beat 1 — Hope-gold spark passes from the heron Keeper's open palm to the small fox pilgrim. Radiant moment, gold blooms into surrounding fog.
- [ ] Beat 2 — Pale dawn parts the fog, dim path returns southward through reeds.

**marsh-depths** (2 beats):
- [ ] Beat 0 — Faint warm hope-gold glow under murky green-grey marsh water.
- [ ] Beat 1 — Heavy drifting fog over still marsh water, bare reeds on the bank, sun glow.

Cross-cutting checks:
- [ ] Cross-fade between beats — outgoing image visibly fades while incoming image fades in over ~400ms; no hard cut.
- [ ] Rapid double-tap during cross-fade — exactly one transition runs (re-entrancy guard); no stale image lingers in `scene.children.list`.
- [ ] Aspect-ratio preserved with cream letterbox — verify on desktop 16:9 AND mobile 9:19.5; image never squashes to fit.
- [ ] Resize browser mid-scene — image re-positions and re-scales to the new slot without overflow.
- [ ] Missing-asset fallback — temporarily rename one PNG (e.g. `mv ember-given/beat-1.png ember-given/beat-1.png.bak`), reload, walk the trigger; the placeholder rect+label renders for that beat without crashing; restore the file before continuing.
- [ ] Animated-kind warn — n/a this phase (no `kind: 'animated'` entries in `SCENE_ASSETS`); the codepath logs `console.warn('animated beats not yet exercised')` if encountered.

## Asset generation walkthrough (US-91)

Per-asset sepia-first read test: open each PNG in a viewer that lets you remove chroma (e.g. macOS Preview → Adjust Color → drop saturation to 0), or sample its histogram. Confirm:

- [ ] `ashen-isle-intro/beat-0.png` — sepia-first; named subject (ashen coastline silhouette) distinguishable in luminance-only view at 50% scale. Note: ___
- [ ] `ashen-isle-intro/beat-1.png` — sepia-first, faint hope-gold accent only inside cracks. Note: ___
- [ ] `ashen-isle-intro/beat-2.png` — sepia-first; distant smoke trail readable. Note: ___
- [ ] `ashen-isle-intro/beat-3.png` — sepia-first; fox pilgrim silhouette readable. Note: ___
- [ ] `ember-given/beat-0.png` — hope-gold dominant (gold-family pixels ≥ 10%); Keeper feathers catch gold. Note: ___
- [ ] `ember-given/beat-1.png` — hope-gold dominant; spark glow readable. Note: ___
- [ ] `ember-given/beat-2.png` — sepia-first; dim southward path readable. Note: ___
- [ ] `marsh-depths/beat-0.png` — sepia-first; coal glow under water readable. Note: ___
- [ ] `marsh-depths/beat-1.png` — sepia-first; sun-glow accent only at the sun disc. Note: ___

## Cost reconciliation (US-91)

| Item | Budgeted | Actual |
|---|---|---|
| Static beats generated (`mcp__pixellab__create_object`) | 9 | 9 |
| Animated beats generated | 0 | 0 |
| Re-rolls / variants | budget 3 | 0 |
| Total PixelLab generations | ≤ 12 | 9 |

The 9th generation hit the per-account 8/8 concurrent-job rate limit on first fire and was retried automatically once the first batch returned. No re-rolls were needed — operator visual review accepted all 9 first-pass outputs.

## Variant baseline (Rule 4a)

The StoryScene image-layer change affects all three shipped scenes; per-scene per-beat coverage above (9 separate checkboxes) is the variant baseline. The thought-bubble change is tested across multiple per-area triggers covering both areas.

## Class baseline

Both `art/styleGuide.ts` and `art/sceneAssets.ts` are NEW modules (no class baseline of prior art-pipeline modules); `tools/generate-scene-art.ts` is the first scene-art generation script (no prior tool to baseline against). No class baseline regression risk.
