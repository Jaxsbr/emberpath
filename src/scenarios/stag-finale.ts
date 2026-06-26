import { Scenario } from './types';

// F1 — the Heart Bridge stag finale (#197). Pip stands a couple of tiles short of
// the King at the far end of the bridge, already `atoned` (the bridge sealed) and
// with colour fully returned (heart_bridge_crossing: 4). Booting here lets the
// headless harness walk the last steps, open the King's invitation, and capture the
// glow crescendo + the "Yes" radiant burst without replaying the whole bridge.
export const stagFinale: Scenario = {
  id: 'stag-finale',
  description: 'Pip reaches the King at the end of the Heart Bridge — the game finale.',
  areaId: 'heart-bridge',
  position: { col: 72, row: 4 }, // two tiles west of the King (col 74), on the deck mid-row
  flags: {
    has_ember_mark: true,
    has_word: true,
    briar_wilds_complete: true,
    ember_warmth: 1,
    ashen_intro_played: true,
    atoned: true, // bridge already sealed → the King's invitation is unlocked
    heart_bridge_crossing: 4, // colour fully returned to the world for the closing image
  },
};
