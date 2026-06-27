import { Scenario } from './types';

// US-156 / #1302 GATE-2 bench: the smoke wayfinding loop pays off at Driftwood's
// own campfire. A flickering fire now burns on the north shore at (28,4) with its
// smoke plume rising from it, and Driftwood sits one tile east at (29,4). Pip
// spawns a few tiles south on clear shore so she walks UP to the fire — seeing the
// fire + smoke + Driftwood beside it — then talks to him. has_ember_mark is set so
// the post-Ember "Share warmth" choice is reachable, driving the fire-vs-Ember
// allegory (#1302): he is proud of the fire he made himself, wishes it were more,
// and — offered the warmer, truer Ember — sees it is better yet can't let his own
// fire go. ashen_intro_played skips the opening cinematic for a deterministic boot.
export const driftwoodCampfire: Scenario = {
  id: 'driftwood-campfire',
  description: "Pip walks up to Driftwood's campfire (the smoke's source) with the Ember — the fire-vs-Ember refusal.",
  areaId: 'ashen-isle',
  position: { col: 29, row: 9 }, // clear shore, a few tiles south of Driftwood (29,4) / fire (28,4)
  flags: {
    has_ember_mark: true, // post-Ember, so the "Share warmth" choice appears
    ashen_intro_played: true, // deterministic boot, skip the opening cinematic
  },
};
