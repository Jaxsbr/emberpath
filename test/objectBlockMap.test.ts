import { describe, it, expect } from 'vitest';
import { fillObjectBlockMap, ObjectInstance } from '../src/maps/objects';
import { COLLISION_SUBDIV } from '../src/maps/constants';

// fillObjectBlockMap is the single shared object-footprint collision math used
// by BOTH GameScene.buildObjectCollisionMap and the editor's area-collision tab.
// These tests pin its behaviour (the contract the old inline GameScene loop had)
// so the extraction is provably zero-regression and the editor seeds identically.

const allTrue = () => true;

// Every sub-cell of cell (col,row) as absolute "scol,srow" keys.
function cellSubKeys(col: number, row: number): string[] {
  const keys: string[] = [];
  const baseSCol = col * COLLISION_SUBDIV;
  const baseSRow = row * COLLISION_SUBDIV;
  for (let sy = 0; sy < COLLISION_SUBDIV; sy++) {
    for (let sx = 0; sx < COLLISION_SUBDIV; sx++) {
      keys.push(`${baseSCol + sx},${baseSRow + sy}`);
    }
  }
  return keys;
}

function build(objects: ObjectInstance[], evaluate = allTrue): Map<string, boolean> {
  const m = new Map<string, boolean>();
  fillObjectBlockMap(m, objects, evaluate);
  return m;
}

describe('fillObjectBlockMap (shared object collision math)', () => {
  it('a passable kind contributes nothing', () => {
    const m = build([{ kind: 'bush', col: 2, row: 2 }]);
    expect(m.size).toBe(0);
  });

  it('a plain impassable kind blocks every sub-cell of its anchor cell', () => {
    const m = build([{ kind: 'wall-stone', col: 3, row: 4 }]);
    const expected = cellSubKeys(3, 4);
    expect(m.size).toBe(expected.length);
    for (const k of expected) expect(m.get(k)).toBe(true);
  });

  it('collisionFootprint blocks the declared cell sub-region, not the anchor', () => {
    // tree-pine: collisionFootprint { dx:1, dy:3, w:1, h:1 } → blocks cell (col+1,row+3)
    const m = build([{ kind: 'tree-pine', col: 5, row: 0 }]);
    const expected = cellSubKeys(6, 3);
    expect(m.size).toBe(expected.length);
    for (const k of expected) expect(m.get(k)).toBe(true);
    // The anchor cell itself is walkable (canopy-from-above; only the trunk blocks).
    expect(m.get(`${5 * COLLISION_SUBDIV},${0 * COLLISION_SUBDIV}`)).toBeUndefined();
  });

  it('skips a conditional object when evaluate() returns false', () => {
    const obj: ObjectInstance = { kind: 'wall-stone', col: 1, row: 1, condition: 'flag:gone' };
    expect(build([obj], () => false).size).toBe(0);
    expect(build([obj], () => true).size).toBe(cellSubKeys(1, 1).length);
  });

  it('unconditional objects are unaffected by evaluate', () => {
    const m = build([{ kind: 'wall-stone', col: 0, row: 0 }], () => false);
    expect(m.size).toBe(cellSubKeys(0, 0).length);
  });

  it('does not clear pre-existing entries (caller owns clearing)', () => {
    const m = new Map<string, boolean>([['99,99', true]]);
    fillObjectBlockMap(m, [{ kind: 'wall-stone', col: 0, row: 0 }], allTrue);
    expect(m.get('99,99')).toBe(true);
  });
});
