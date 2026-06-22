import { describe, it, expect, beforeEach } from 'vitest';
import {
  compileCondition,
  parseCondition,
  toTriggerDefinition,
  fromTriggerDefinition,
  emptyTriggerForm,
  CONDITION_OPS,
  type TriggerFormModel,
} from '../src/systems/triggerModel';
import { evaluateCondition, coerceFlagValue } from '../src/systems/conditions';
import { setFlag, resetAllFlags } from '../src/triggers/flags';

// Real condition strings lifted verbatim from src/data/areas/*.ts — the editor
// MUST round-trip every one without loss, or migrating an existing area into the
// tool would silently corrupt its logic.
const REAL_CONDITIONS = [
  'atoned == false',
  'atoned == true',
  'has_ember_mark == true AND atoned == false',
  'has_ember_mark == true AND npc_warmed_wren == true AND npc_warmed_old_man == false',
  'has_word == true AND remembered_briar-stone-1 == false',
  'marsh_trapped == true',
  'npc_warmed_wren == true AND npc_warmed_old_man == true AND homecoming_complete == false',
];

describe('triggerModel — condition compile/parse', () => {
  it('round-trips every real area condition string without loss', () => {
    for (const cond of REAL_CONDITIONS) {
      const { clauses, errors } = parseCondition(cond);
      expect(errors).toEqual([]);
      // Re-compiling yields a string that parses to the identical clause set.
      const recompiled = compileCondition(clauses);
      expect(recompiled).toBeDefined();
      expect(parseCondition(recompiled).clauses).toEqual(clauses);
    }
  });

  it('preserves clause count and order for multi-clause AND', () => {
    const { clauses } = parseCondition(
      'has_ember_mark == true AND npc_warmed_wren == true AND npc_warmed_old_man == false',
    );
    expect(clauses.map((c) => c.flag)).toEqual([
      'has_ember_mark',
      'npc_warmed_wren',
      'npc_warmed_old_man',
    ]);
  });

  it('compiles and parses back each operator identically', () => {
    for (const op of CONDITION_OPS) {
      const clause = { flag: 'score', op, value: '3' };
      const compiled = compileCondition([clause]);
      expect(parseCondition(compiled).clauses).toEqual([clause]);
    }
  });

  it('matches two-char operators before one-char (>= not >)', () => {
    const { clauses } = parseCondition('score >= 5');
    expect(clauses[0].op).toBe('>=');
    expect(clauses[0].value).toBe('5');
  });

  it('empty / whitespace condition compiles to undefined and parses to no clauses', () => {
    expect(compileCondition([])).toBeUndefined();
    expect(compileCondition([{ flag: '  ', op: '==', value: 'x' }])).toBeUndefined();
    expect(parseCondition(undefined).clauses).toEqual([]);
    expect(parseCondition('   ').clauses).toEqual([]);
  });

  it('reports an unparseable clause instead of throwing', () => {
    const { clauses, errors } = parseCondition('this has no operator');
    expect(clauses).toEqual([]);
    expect(errors.length).toBe(1);
  });
});

describe('triggerModel — compiled conditions evaluate as intended', () => {
  beforeEach(() => resetAllFlags());

  it('a compiled clause evaluates true exactly when the runtime says so', () => {
    const cond = compileCondition([{ flag: 'has_ember', op: '==', value: 'true' }])!;
    expect(evaluateCondition(cond)).toBe(false);
    setFlag('has_ember', true);
    expect(evaluateCondition(cond)).toBe(true);
  });

  it('a compiled numeric comparison evaluates against the flag store', () => {
    const cond = compileCondition([{ flag: 'attempts', op: '>=', value: '3' }])!;
    setFlag('attempts', 2);
    expect(evaluateCondition(cond)).toBe(false);
    setFlag('attempts', 3);
    expect(evaluateCondition(cond)).toBe(true);
  });

  it('a compiled multi-clause AND requires all clauses', () => {
    const cond = compileCondition([
      { flag: 'a', op: '==', value: 'true' },
      { flag: 'b', op: '==', value: 'true' },
    ])!;
    setFlag('a', true);
    expect(evaluateCondition(cond)).toBe(false);
    setFlag('b', true);
    expect(evaluateCondition(cond)).toBe(true);
  });
});

describe('triggerModel — effect form <-> TriggerDefinition', () => {
  it('builds a minimal definition, omitting empty optional fields', () => {
    const form = emptyTriggerForm('t1', 4, 5, 2, 3);
    form.type = 'thought';
    form.actionRef = 'You feel the cold.';
    const def = toTriggerDefinition(form);
    expect(def).toEqual({
      id: 't1',
      col: 4,
      row: 5,
      width: 2,
      height: 3,
      type: 'thought',
      actionRef: 'You feel the cold.',
      repeatable: false,
    });
    expect(def.condition).toBeUndefined();
    expect(def.setFlags).toBeUndefined();
    expect(def.incrementFlags).toBeUndefined();
  });

  it('coerces setFlags values with the runtime coercion (true -> boolean)', () => {
    const form = emptyTriggerForm('t2', 0, 0);
    form.setFlags = [
      { name: 'crossed', value: 'true' },
      { name: 'count', value: '2' },
      { name: 'note', value: 'hello' },
    ];
    const def = toTriggerDefinition(form);
    expect(def.setFlags).toEqual({ crossed: true, count: 2, note: 'hello' });
    expect(def.setFlags!.crossed).toBe(coerceFlagValue('true'));
  });

  it('full round-trips a rich definition (def -> form -> def)', () => {
    const original = {
      id: 'bridge-cross',
      col: 10,
      row: 12,
      width: 3,
      height: 1,
      type: 'thought' as const,
      actionRef: 'The grey lifts.',
      condition: 'has_ember == true AND attempts >= 1',
      setFlags: { ashen_crossed: true, mood: 'gold' },
      incrementFlags: ['crossings'],
      repeatable: false,
    };
    const { form, errors } = fromTriggerDefinition(original);
    expect(errors).toEqual([]);
    expect(toTriggerDefinition(form)).toEqual(original);
  });

  it('hydrates condition clauses and setFlag rows for the form', () => {
    const { form } = fromTriggerDefinition({
      id: 'x',
      col: 0,
      row: 0,
      width: 1,
      height: 1,
      type: 'dialogue',
      actionRef: 'wren-intro',
      condition: 'atoned == false',
      setFlags: { seen: true },
      repeatable: true,
    });
    expect(form.clauses).toEqual([{ flag: 'atoned', op: '==', value: 'false' }]);
    expect(form.setFlags).toEqual([{ name: 'seen', value: 'true' }]);
    expect(form.repeatable).toBe(true);
  });
});
