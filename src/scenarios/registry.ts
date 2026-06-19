import { Scenario } from './types';
import { atOldManCottage } from './at-old-man-cottage';
import { briarTrailWalk } from './briar-trail-walk';
import { emberInMarsh } from './ember-in-marsh';
import { enteringBriar } from './entering-briar';
import { hasWordsAtBridge } from './has-words-at-bridge';
import { marshSurrender } from './marsh-surrender';
import { trappedInMarsh } from './trapped-in-marsh';

// Test-bench scenario registry. Add a new scenario when a phase ships so the
// headless harness (and, later, a human panel) can boot straight into it via
// `?scenario=<id>`. Keep this the single place that lists them.
const scenarios: Record<string, Scenario> = {
  [atOldManCottage.id]: atOldManCottage,
  [briarTrailWalk.id]: briarTrailWalk,
  [emberInMarsh.id]: emberInMarsh,
  [enteringBriar.id]: enteringBriar,
  [hasWordsAtBridge.id]: hasWordsAtBridge,
  [marshSurrender.id]: marshSurrender,
  [trappedInMarsh.id]: trappedInMarsh,
};

export function getScenario(id: string): Scenario | undefined {
  return scenarios[id];
}

export function getAllScenarioIds(): string[] {
  return Object.keys(scenarios);
}
