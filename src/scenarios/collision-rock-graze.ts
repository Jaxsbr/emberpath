import { Scenario } from './types';

// FB-23 GATE-2 bench: a free-standing `rock` sits in open grass at (30,23) on
// Ashen Isle — open central ground between the two yards, clear of fences and
// paths. `rock` has NO footprint/collisionFootprint, so before FB-23 it blocked
// its WHOLE 32px tile — Pip stopped a full tile short of the little rock. With
// FB-23 the kind carries an authored 6-sub-cell collision shape
// (object-shapes.json) that hugs the rock body, so Pip can walk right up to the
// stone and tuck into the now-passable tile corners. Boot with `?debugCollision=1`
// to render the collision cells (the red set now matches the rock, not the tile)
// and drive Pip north into the rock to film the hug. Pip spawns two tiles south
// on clear grass.
export const collisionRockGraze: Scenario = {
  id: 'collision-rock-graze',
  description: 'Pip walks up to a free-standing rock — FB-23 collision now hugs the rock body, not the whole tile.',
  areaId: 'ashen-isle',
  position: { col: 30, row: 25 }, // open grass, 2 tiles south of the rock at (30,23)
  flags: {
    ashen_intro_played: true, // deterministic boot, skip the opening cinematic
  },
};
