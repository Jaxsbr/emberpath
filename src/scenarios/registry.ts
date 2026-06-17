import { Scenario } from './types';
import { emberInMarsh } from './ember-in-marsh';
import { hasWordsAtBridge } from './has-words-at-bridge';
import { trappedInMarsh } from './trapped-in-marsh';

// Test-bench scenario registry. Add a new scenario when a phase ships so the
// headless harness (and, later, a human panel) can boot straight into it via
// `?scenario=<id>`. Keep this the single place that lists them.
const scenarios: Record<string, Scenario> = {
  [emberInMarsh.id]: emberInMarsh,
  [hasWordsAtBridge.id]: hasWordsAtBridge,
  [trappedInMarsh.id]: trappedInMarsh,
};

export function getScenario(id: string): Scenario | undefined {
  return scenarios[id];
}

export function getAllScenarioIds(): string[] {
  return Object.keys(scenarios);
}
