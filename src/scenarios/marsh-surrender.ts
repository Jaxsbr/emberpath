import { Scenario } from './types';

// Pip stands one tile north of the closed south exit (col 14, row 21 — the
// southern end of the dry path, on the escape-attempt trigger band), already
// trapped and having tried the exit (escape_attempts: 3 ≥ SURRENDER_MIN_ATTEMPTS).
// This is the exact pre-condition for the F5 stillness "gather ring": the
// headless harness can boot here, hold still, and watch the cue fill and the
// surrender flag flip — without first walking 10 tiles and bumping the wall.
// Verifies issue #34's F5 (does the surrender cue read as intentional grace to a
// first-time player). ashen_intro_played skips the opening cinematic.
export const marshSurrender: Scenario = {
  id: 'marsh-surrender',
  description: 'Pip trapped at the closed Fog Marsh exit, attempts spent — ready for the surrender cue (#34 F5).',
  areaId: 'fog-marsh',
  position: { col: 14, row: 21 }, // south end of the dry path, 1 tile N of the exit (row 22)
  flags: {
    marsh_trapped: true,
    escape_attempts: 3,
    marsh_surrendered: false,
    keeper_met: false,
    has_ember_mark: false,
    ashen_intro_played: true,
  },
};
