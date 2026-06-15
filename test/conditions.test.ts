import { describe, it, expect, vi, beforeEach } from 'vitest';

// Isolate the pure evaluator from the real flag store (which drags in
// localStorage + saveState + the area registry + Phaser). We back getFlag with
// a per-test in-memory map so these stay fast unit tests of the parser/coercion
// logic alone.
const store = new Map<string, string | number | boolean>();

vi.mock('../src/triggers/flags', () => ({
  getFlag: (name: string) => store.get(name),
}));

import { evaluateCondition } from '../src/systems/conditions';

function setFlags(flags: Record<string, string | number | boolean>) {
  store.clear();
  for (const [k, v] of Object.entries(flags)) store.set(k, v);
}

beforeEach(() => store.clear());

describe('evaluateCondition — equality & coercion', () => {
  it('matches a boolean-true flag against the literal "true"', () => {
    setFlags({ has_word: true });
    expect(evaluateCondition('has_word == true')).toBe(true);
  });

  it('treats an unset boolean flag as false', () => {
    expect(evaluateCondition('has_word == false')).toBe(true);
    expect(evaluateCondition('has_word == true')).toBe(false);
  });

  it('coerces numeric string literals to numbers for ==', () => {
    setFlags({ embers: 3 });
    expect(evaluateCondition('embers == 3')).toBe(true);
    expect(evaluateCondition('embers == 2')).toBe(false);
  });

  it('treats an unset numeric flag as 0', () => {
    expect(evaluateCondition('embers == 0')).toBe(true);
    expect(evaluateCondition('embers >= 1')).toBe(false);
  });

  it('compares string flags as strings when the literal is non-numeric', () => {
    setFlags({ area: 'ashen' });
    expect(evaluateCondition('area == ashen')).toBe(true);
    expect(evaluateCondition('area == briar')).toBe(false);
  });

  it('treats an unset string flag as empty string', () => {
    expect(evaluateCondition('area == ')).toBe(false); // malformed: no value captured
  });
});

describe('evaluateCondition — inequality operators', () => {
  beforeEach(() => setFlags({ embers: 3 }));

  it('!= is true when values differ', () => {
    expect(evaluateCondition('embers != 2')).toBe(true);
    expect(evaluateCondition('embers != 3')).toBe(false);
  });

  it('>= and > behave at the boundary', () => {
    expect(evaluateCondition('embers >= 3')).toBe(true);
    expect(evaluateCondition('embers > 3')).toBe(false);
    expect(evaluateCondition('embers > 2')).toBe(true);
  });

  it('<= and < behave at the boundary', () => {
    expect(evaluateCondition('embers <= 3')).toBe(true);
    expect(evaluateCondition('embers < 3')).toBe(false);
    expect(evaluateCondition('embers < 4')).toBe(true);
  });
});

describe('evaluateCondition — AND composition', () => {
  it('requires every clause to pass', () => {
    setFlags({ has_word: true, embers: 5 });
    expect(evaluateCondition('has_word == true AND embers >= 3')).toBe(true);
    expect(evaluateCondition('has_word == true AND embers >= 9')).toBe(false);
  });

  it('short-circuits to false on the first failing clause', () => {
    setFlags({ has_word: false, embers: 5 });
    expect(evaluateCondition('has_word == true AND embers >= 3')).toBe(false);
  });

  it('tolerates irregular spacing around AND', () => {
    setFlags({ a: true, b: true });
    expect(evaluateCondition('a == true   AND   b == true')).toBe(true);
  });
});

describe('evaluateCondition — malformed input', () => {
  it('fails the whole condition when a clause has no recognizable operator', () => {
    setFlags({ has_word: true });
    expect(evaluateCondition('has_word')).toBe(false);
    expect(evaluateCondition('just some text')).toBe(false);
  });

  it('fails if any clause in an AND chain is malformed', () => {
    setFlags({ has_word: true });
    expect(evaluateCondition('has_word == true AND garbage')).toBe(false);
  });
});
