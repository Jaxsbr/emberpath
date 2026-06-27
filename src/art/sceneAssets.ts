// Scene-level asset manifest (US-90). One source of truth mapping every story
// scene's beats to their PixelLab-generated PNGs and the prompts that produced
// them. Consumed by StoryScene.preload (in-engine texture loading) and by
// tools/generate-scene-art.ts (Node-side generation script).

export interface BeatAssetStatic {
  kind: 'static';
  // Consumer-neutral relative path matching `scenes/<sceneId>/beat-<n>.png`.
  // StoryScene.preload prepends nothing (Vite resolves via publicDir = 'assets').
  // tools/generate-scene-art.ts joins this against `<projectRoot>/assets/`.
  file: string;
  prompt: string;
  mood?: string;
}

export interface BeatAssetAnimated {
  kind: 'animated';
  file: string;
  frames: number;
  fps: number;
  prompt: string;
  mood?: string;
}

export type BeatAsset = BeatAssetStatic | BeatAssetAnimated;

export const SCENE_ASSETS: Record<string, BeatAsset[]> = {
  'ashen-isle-intro': [
    {
      kind: 'static',
      file: 'scenes/ashen-isle-intro/beat-0.png',
      prompt:
        'Ashen sky over a parched coastline at dusk, drifting flakes of ash, distant horizon, low silhouette of bare hills, no characters',
      mood: 'grey, drifting ash',
    },
    {
      kind: 'static',
      file: 'scenes/ashen-isle-intro/beat-1.png',
      prompt:
        'Close view of cracked grey-brown earth, faint warm hope-gold glow rising from deep within the cracks, no characters',
      mood: 'parched, hopeful undertone',
    },
    {
      kind: 'static',
      file: 'scenes/ashen-isle-intro/beat-2.png',
      prompt:
        'Wide horizon over an ashen plain, a single thin smoke trail rises in the far distance hinting at an unseen presence, no characters',
      mood: 'quiet hint of presence',
    },
    {
      kind: 'static',
      file: 'scenes/ashen-isle-intro/beat-3.png',
      prompt:
        'A small fox pilgrim wearing a rough hooded cloak, standing alone on an ashen plateau, viewed from the side, head bowed, oversized kind eyes',
      mood: 'introspective, weight',
    },
  ],
  'ember-given': [
    {
      kind: 'static',
      file: 'scenes/ember-given/beat-0.png',
      prompt:
        'A tall heron keeper in a tattered cloak steps through silver-grey marsh fog, warm hope-gold light catches the long feathers of its wing, side view',
      mood: 'warm gold catching feathers',
    },
    {
      kind: 'static',
      file: 'scenes/ember-given/beat-1.png',
      prompt:
        'A radiant spark of hope-gold light passes from the open palm of a heron keeper to a small fox pilgrim, side view, the gold blooms slightly into the surrounding fog',
      mood: 'hope-gold radiant moment',
    },
    {
      kind: 'static',
      file: 'scenes/ember-given/beat-2.png',
      prompt:
        'A pale dawn parts the marsh fog, a dim winding path returns southward through reeds and stepping stones, no characters',
      mood: 'pale dawn, gentle relief',
    },
  ],
  'marsh-depths': [
    {
      kind: 'static',
      file: 'scenes/marsh-depths/beat-0.png',
      prompt:
        'A faint warm hope-gold glow seen below the surface of murky green-grey marsh water, a coal that will not die, viewed from above, no characters',
      mood: 'faint warmth in green-grey',
    },
    {
      kind: 'static',
      file: 'scenes/marsh-depths/beat-1.png',
      prompt:
        'Heavy drifting fog over still marsh water, bare reeds on the bank, an unspoken presence felt rather than seen, no characters',
      mood: 'unspoken presence',
    },
  ],
  // word-given (Briar reveal, #155) — Jaco-supplied storybook illustrations,
  // generated externally (Nano Banana) from the codex-structured prompts in
  // autonomy/feedback/FB-18/nano-banana-prompts.md, then downscaled to 1200px JPG.
  // Painted full-screen art compresses far better as JPG than PNG, so these two
  // scenes use .jpg; the pixel-art scenes above stay .png. StoryScene letterboxes
  // any aspect ratio (fitImageToSlot = contain), so the 16:9 frames fit cleanly.
  'word-given': [
    {
      kind: 'static',
      file: 'scenes/word-given/beat-0.jpg',
      prompt:
        'Quill the old bird sage opens a great glowing book; warm hope-gold light spills from its pages toward the small fox pilgrim Pip, like a book made of morning. Grey briar thicket, gold the only saturated colour.',
      mood: 'the words are opened',
    },
    {
      kind: 'static',
      file: 'scenes/word-given/beat-1.jpg',
      prompt:
        'Quill the old bird sage spreads his great wings and extends a wingtip of warm hope-gold light toward the small fox pilgrim Pip, whose open paws rise to receive it. A freely given gift, sepia briar falling into shadow.',
      mood: 'a gift, not a prize',
    },
    {
      kind: 'static',
      file: 'scenes/word-given/beat-2.jpg',
      prompt:
        'The small fox pilgrim Pip, carrying a soft inner gold glow, looks up at a weathered carved standing stone in the briar; faint hope-gold catches the old carved marks so they seem alive with meaning. Grey thicket, gold the only colour.',
      mood: 'the stones can be read',
    },
    {
      kind: 'static',
      file: 'scenes/word-given/beat-3.jpg',
      prompt:
        'The small hooded fox pilgrim Pip walks onward into a dark tangled briar of grey thorns, small but unafraid, a warm hope-gold light glowing softly within against the cold thicket. Side view, receding path — not alone.',
      mood: 'into the thorns',
    },
  ],
  // bridge-sealed (Heart-Bridge crossing reveal, FB-19) — same provenance/pipeline
  // as word-given above.
  'bridge-sealed': [
    {
      kind: 'static',
      file: 'scenes/bridge-sealed/beat-0.jpg',
      prompt:
        'The small fox pilgrim Pip walks across an old stone bridge; the last of a cold grey mist lifts off her shoulders and flows down into the bridge stone. Warm gold dawn glows beyond the far end; only the dawn and her faint inner ember carry gold.',
      mood: 'the grey lifts away',
    },
    {
      kind: 'static',
      file: 'scenes/bridge-sealed/beat-1.jpg',
      prompt:
        'A tall, regal antlered cloaked King stands silent in heavy grey mist on the old stone bridge and draws the cold mist into himself, bearing it willingly. Strong chiaroscuro, his form in warm umber shadow with a soft gold rim-light. No fear, only mercy.',
      mood: 'he takes the grey',
    },
    {
      kind: 'static',
      file: 'scenes/bridge-sealed/beat-2.jpg',
      prompt:
        'The small fox pilgrim Pip stands on the stone bridge, her own little hope-gold light glowing warmer and brighter now that the grey is gone; the tall antlered King stands near, watching gently. Calm, lit, the cold lifted away.',
      mood: 'her light stays',
    },
    {
      kind: 'static',
      file: 'scenes/bridge-sealed/beat-3.jpg',
      prompt:
        'A wide warm view down the old stone bridge — the small fox pilgrim Pip tiny in the frame, the tall antlered King ahead of her, and beyond the far end a distant city of warm golden light. The feeling is "I only walked; he carried it across."',
      mood: 'i only walked',
    },
  ],
};
