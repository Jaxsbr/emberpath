export const DIRECTIONS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

export type Direction = (typeof DIRECTIONS)[number];

const OCTANT_ORDER: Direction[] = [
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
  'north',
  'north-east',
];

export function vectorToDirection(vx: number, vy: number): Direction {
  // Zero vector has no direction — atan2(0, 0) returns 0, which would silently
  // map to 'east'. Return a neutral default so callers that hit exact colocation
  // (player centre == NPC centre, e.g. awareness/enterDialogue when hitboxes
  // overlap) get a defined result instead of a misleading facing.
  if (vx === 0 && vy === 0) return 'south';
  const angle = Math.atan2(vy, vx);
  const normalized = angle < 0 ? angle + 2 * Math.PI : angle;
  const sectorIndex = Math.round(normalized / (Math.PI / 4)) % 8;
  return OCTANT_ORDER[sectorIndex];
}

export const velocityToDirection = vectorToDirection;
