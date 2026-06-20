import { Scenario } from './types';

// FB-22 regression bench — the Briar → Heart Bridge TRANSITION itself. Boot Pip on
// the Briar east band (the D corridor, rows 10–12) a few tiles west of the
// `briar-to-heart-bridge` exit (col 43, rows 10–12), with the Word carried so the
// span is open (the exit is gated on has_word). Holding EAST walks her straight
// through the exit trigger and onto the bridge.
//
// Why this exists: `has-words-at-bridge` boots DIRECTLY onto the bridge at its
// playerSpawn (1,4), so it never exercises the exit's entryPoint — which is exactly
// where FB-22 lived (the Briar exit dropped Pip on the now-impassable top parapet
// stone at row 2 after the FB-19 span redesign). This scenario drives the real
// transition path so the stuck-on-stone bug can be reproduced and the fix verified.
export const briarToBridgeTransition: Scenario = {
  id: 'briar-to-bridge-transition',
  description: 'Pip walks east off the Briar D-band through the exit onto the Heart Bridge — verifies she lands walkable (FB-22).',
  areaId: 'briar-wilds',
  position: { col: 40, row: 11 }, // Briar D corridor, a few tiles west of the bridge exit (col 43)
  flags: {
    has_ember_mark: true,
    has_word: true, // opens the has_word-gated bridge exit
    briar_wilds_complete: true,
    keeper_met: true,
    marsh_trapped: false,
    ember_warmth: 1,
    ashen_intro_played: true,
  },
};
