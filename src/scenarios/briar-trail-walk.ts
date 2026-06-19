import { Scenario } from './types';

// Pip walks OUT of Briar toward the heart-bridge — she already received the Word
// from Quill (has_word == true), so the entry meeting is done and the serpentine
// corridor is clear to traverse end-to-end. This is the trail-readability bench
// (FB-17 pt3): boot at the western mouth and walk the worn organic path (briar-path
// terrain) the full length of the snake to judge the curving trail + the breadcrumb
// lanterns sitting on it + the forest-eyes peering from the dark tree clusters.
export const briarTrailWalk: Scenario = {
  id: 'briar-trail-walk',
  description: 'Pip walks the Briar serpentine trail from the west mouth (post-Word) — judge the organic worn path + eyes.',
  areaId: 'briar-wilds',
  position: { col: 2, row: 15 }, // briar-wilds west mouth / playerSpawn
  flags: {
    has_ember_mark: true,
    has_word: true, // post-Quill: the entry meeting is done, corridor is clear to walk
    keeper_met: true,
    marsh_trapped: false,
    ember_warmth: 1,
    ashen_intro_played: true,
  },
};
