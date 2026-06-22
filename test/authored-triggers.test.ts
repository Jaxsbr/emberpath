import { describe, it, expect } from 'vitest';
import { getAuthoredTriggers, mergeAuthoredTriggers } from '../src/data/areas/authored-triggers';
import type { TriggerDefinition } from '../src/data/areas/types';

function trig(id: string): TriggerDefinition {
  return { id, col: 0, row: 0, width: 1, height: 1, type: 'thought', actionRef: 't', repeatable: false };
}

describe('authored-triggers — zero-regression merge', () => {
  it('returns the original array reference when there are no authored triggers', () => {
    const inline = [trig('a'), trig('b')];
    expect(mergeAuthoredTriggers(inline, [])).toBe(inline); // same reference == byte-identical
  });

  it('appends authored triggers in order after inline ones', () => {
    const inline = [trig('a')];
    const merged = mergeAuthoredTriggers(inline, [trig('b'), trig('c')]);
    expect(merged.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(merged).not.toBe(inline); // a new array, original untouched
    expect(inline.map((t) => t.id)).toEqual(['a']);
  });

  it('throws on a duplicate id between inline and authored', () => {
    expect(() => mergeAuthoredTriggers([trig('dup')], [trig('dup')])).toThrow(/Duplicate trigger id/);
  });

  it('throws on a duplicate id within the authored set', () => {
    expect(() => mergeAuthoredTriggers([], [trig('x'), trig('x')])).toThrow(/Duplicate trigger id/);
  });
});

describe('authored-triggers — loader', () => {
  it('returns an empty array for an area with no sidecar', () => {
    expect(getAuthoredTriggers('no-such-area')).toEqual([]);
  });
});
