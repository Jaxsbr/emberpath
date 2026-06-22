import { getFlag } from '../triggers/flags';

// The operators the condition grammar understands, in MATCH-PRECEDENCE order
// (two-char before one-char so `>=` wins over `>`). The clause regex below and
// the trigger authoring model (systems/triggerModel.ts) both build off this, so
// the editor can never offer an operator the runtime can't evaluate.
export const CONDITION_OPS = ['==', '!=', '>=', '>', '<=', '<'] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];

const CLAUSE_RE = /^(\S+)\s*(==|>=|>|<=|<|!=)\s*(.+)$/;

// Coerce a raw condition/flag value string to its typed form, EXACTLY as the
// runtime comparison does — extracted so the trigger authoring tool writes
// values the engine reads back identically (one shared coercion, no drift).
export function coerceFlagValue(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (!isNaN(Number(raw))) return Number(raw);
  return raw;
}

/**
 * Evaluate a condition string against the flag store.
 * Conditions use: "flag == value AND flag2 >= value2"
 */
export function evaluateCondition(condition: string): boolean {
  const clauses = condition.split(/\s+AND\s+/);
  for (const clause of clauses) {
    if (!evaluateClause(clause.trim())) {
      return false;
    }
  }
  return true;
}

function evaluateClause(clause: string): boolean {
  const match = clause.match(CLAUSE_RE);
  if (!match) return false;

  const [, flagName, operator, rawValue] = match;
  const flagValue = getFlag(flagName);

  const expected = coerceFlagValue(rawValue);

  const actual = flagValue ?? (typeof expected === 'boolean' ? false : typeof expected === 'number' ? 0 : '');

  switch (operator) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>=': return Number(actual) >= Number(expected);
    case '>': return Number(actual) > Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case '<': return Number(actual) < Number(expected);
    default: return false;
  }
}
