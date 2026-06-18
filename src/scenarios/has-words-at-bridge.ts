import { Scenario } from './types';

// Pip stands at the start of the Heart Bridge with the Ember and the Word, Briar
// already complete. Good for verifying the bridge-crossing beat and the carried
// `has_word` lantern visual at the game's climax.
export const hasWordsAtBridge: Scenario = {
  id: 'has-words-at-bridge',
  description: 'Pip has the Ember and the Word, at the start of the Heart Bridge.',
  areaId: 'heart-bridge',
  position: { col: 1, row: 4 }, // heart-bridge playerSpawn (FB-19 deck mid-row)
  flags: {
    has_ember_mark: true,
    has_word: true,
    briar_wilds_complete: true,
    ember_warmth: 1, // warmth is a 0.0–1.0 scale; 1 = full
    ashen_intro_played: true,
  },
};
