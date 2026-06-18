import { Scenario } from './types';

// Pip stands on the east branch just outside the Old Man's new 2× cottage
// (#153), at the front-approach tile west of his gate (34,28). Boots straight
// onto the widened east yard so the headless harness can frame the bigger
// cottage, its enclosed yard, and the clean door approach — the GATE-2 preview
// for the FB-6/FB-8 cottage upgrade. ashen_intro_played skips the opening
// cinematic for a deterministic capture.
export const atOldManCottage: Scenario = {
  id: 'at-old-man-cottage',
  description: "Pip on the east branch outside the Old Man's widened 2× cottage yard (#153 preview).",
  areaId: 'ashen-isle',
  position: { col: 31, row: 28 }, // east branch, a few tiles west of the gate (34,28)
  flags: {
    ashen_intro_played: true, // deterministic boot, skip the opening cinematic
  },
};
