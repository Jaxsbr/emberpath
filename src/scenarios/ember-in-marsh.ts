import { Scenario } from './types';

// Pip already carries the Ember and the Word, free to walk the Fog Marsh (not
// trapped, Keeper already met). Good for verifying ember glow + Word Lantern
// render together and how lit NPCs read in the marsh.
export const emberInMarsh: Scenario = {
  id: 'ember-in-marsh',
  description: 'Pip carries the Ember and the Word, standing free in the Fog Marsh.',
  areaId: 'fog-marsh',
  position: { col: 14, row: 12 }, // fog-marsh playerSpawn
  flags: {
    has_ember_mark: true,
    has_word: true,
    keeper_met: true,
    marsh_trapped: false,
    ember_warmth: 1, // warmth is a 0.0–1.0 scale; 1 = full
    ashen_intro_played: true, // skip the opening cinematic for a deterministic boot
  },
};
