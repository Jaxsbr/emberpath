export const TILE_SIZE = 32;
// Collision sub-cell resolution (FB-23). Object collision is authored and tested
// at SUB_SIZE granularity (TILE_SIZE / COLLISION_SUBDIV) so a small prop can block
// only the part of its tile it actually covers, instead of the whole 32px cell.
// Terrain collision stays cell-grained; only the object layer is sub-divided.
// 4 → 8px sub-cells: fine enough to hug a rock, coarse enough that the sparse
// objectBlockMap stays small.
export const COLLISION_SUBDIV = 4;
export const SUB_SIZE = TILE_SIZE / COLLISION_SUBDIV;
export const PLAYER_SIZE = 24;
export const PLAYER_SPEED = 160;
export const NPC_SIZE = 24;
export const NPC_SPEED = PLAYER_SPEED * 0.4;
export const NPC_IDLE_MIN_MS = 800;
export const NPC_IDLE_MAX_MS = 2400;
