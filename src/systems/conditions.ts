import { getFlag } from '../triggers/flags';

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
  const match = clause.match(/^(\S+)\s*(==|>=|>|<=|<|!=)\s*(.+)$/);
  if (!match) return false;

  const [, flagName, operator, rawValue] = match;
  const flagValue = getFlag(flagName);

  let expected: string | number | boolean;
  if (rawValue === 'true') expected = true;
  else if (rawValue === 'false') expected = false;
  else if (!isNaN(Number(rawValue))) expected = Number(rawValue);
  else expected = rawValue;

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
