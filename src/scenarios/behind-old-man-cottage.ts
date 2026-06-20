import { Scenario } from './types';

// #119 verification — Pip can now WALK BEHIND the Old Man's cottage. Boots her
// on the left side of his homestead, level with the roof rows (row 22), one cell
// west of the body (col 35). Driving her east traverses the full width BEHIND
// the cottage along a roof row: with the tree-style FRONT-WALL-BASE band
// (collisionFootprint {dx:1,dy:5,w:6,h:2} on `cottage-large`, #119) the whole
// roof is walkable, so she passes through cells the cottage occludes and it
// fades to the FB-3 see-through alpha + white rim the whole traverse — the exact
// behaviour that was DORMANT before because the old full-body collision walled
// her out. ashen_intro_played skips the opening cinematic for a deterministic
// headless capture.
export const behindOldManCottage: Scenario = {
  id: 'behind-old-man-cottage',
  description: "Pip beside the Old Man's cottage, level with the roof rows — walk east to pass behind it (#119).",
  areaId: 'ashen-isle',
  position: { col: 35, row: 22 }, // west side of the body (cols 36-43), on a walkable roof row
  flags: {
    ashen_intro_played: true, // deterministic boot, skip the opening cinematic
  },
};
