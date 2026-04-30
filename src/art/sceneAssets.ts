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
};
