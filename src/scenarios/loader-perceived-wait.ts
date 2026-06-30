import { Scenario } from './types';

// #214 P4 — perceived-wait loader bench. Boots Pip on the Briar east band well WEST
// of the `briar-to-heart-bridge` exit (col 43) — far enough (col 34) that idle
// prefetch does NOT fire at spawn. Holding EAST walks her the length of the corridor;
// prefetch only kicks in within PREFETCH_RANGE_TILES of the exit, so under a throttled
// destination fetch she crosses before the warm-up finishes and the transition loader
// is on screen with the kindling progress fill + rotating whispers — the GATE-2 visual.
//
// (briar-to-bridge-transition boots at col 40, INSIDE prefetch range, so it shows the
// seamless no-loader prefetch path instead — the two scenarios bench the two halves.)
export const loaderPerceivedWait: Scenario = {
  id: 'loader-perceived-wait',
  description: 'Pip walks the full Briar D-band east into the Heart-Bridge exit — far enough that prefetch does not pre-warm, so the throttled transition shows the progress loader (#214 P4).',
  areaId: 'briar-wilds',
  position: { col: 34, row: 11 }, // Briar D corridor, ~9 tiles west of the bridge exit (col 43)
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
