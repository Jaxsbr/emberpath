import { Scenario } from './types';

// Editor P3 / #187 U7 — the end-to-end proof for the Triggers authoring tool.
// Boots Pip one tile west of the EDITOR-AUTHORED trigger zone in
// `src/data/areas/triggers/ashen-isle.json` (the sidecar the Triggers tab writes,
// spread onto Ashen Isle by the registry). The authored trigger is gated on
// `demo_authored_trigger`, a flag set ONLY here — so in normal play the trigger
// is inert and Ashen Isle is byte-identical, but in this scenario Pip walks one
// step east, enters the zone, and the authored `thought` fires. That single MP4
// closes the loop: form → sidecar → registry merge → runtime, with no hand-edited
// TypeScript. (Decision C-a: a flag-driven demo, not a permanent player-facing
// beat — keeps the demo non-visual in real play so increment 2 self-merges.)
export const authoredTriggerDemo: Scenario = {
  id: 'authored-trigger-demo',
  description: 'Pip walks into an editor-authored Ashen Isle trigger; its thought fires.',
  areaId: 'ashen-isle',
  position: { col: 9, row: 20 }, // playerSpawn — one tile west of the authored zone
  flags: {
    demo_authored_trigger: true,
    ashen_intro_played: true,
  },
};
