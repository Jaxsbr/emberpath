import { Scenario } from './types';

// Pip arrives in Briar Wilds carrying the Ember (not yet the Word — she receives
// it FROM Quill the owl here) at the western spawn — the cold first-time state
// for this area. Good for judging Briar's readability (#72/#59: does it read as a
// near-black void, or can a first-timer see where to go?) and the entry objective
// ("An owl waits by the thorns... Go and meet Quill"), which fires on
// has_ember_mark == true AND has_word == false.
export const enteringBriar: Scenario = {
  id: 'entering-briar',
  description: 'Pip enters Briar Wilds with the Ember (pre-Word), at the western spawn — go meet Quill.',
  areaId: 'briar-wilds',
  position: { col: 2, row: 15 }, // briar-wilds playerSpawn
  flags: {
    has_ember_mark: true,
    has_word: false, // the Word is granted by Quill inside Briar; fresh entry is pre-Word
    keeper_met: true, // the Keeper was met at the Fog Marsh climax, before Briar
    marsh_trapped: false,
    ember_warmth: 1, // warmth is a 0.0–1.0 scale; 1 = full
    ashen_intro_played: true, // deterministic boot, skip the opening cinematic
  },
};
