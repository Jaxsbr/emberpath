import { Scenario } from './types';
import { atOldManCottage } from './at-old-man-cottage';
import { authoredTriggerDemo } from './authored-trigger-demo';
import { behindOldManCottage } from './behind-old-man-cottage';
import { briarToBridgeTransition } from './briar-to-bridge-transition';
import { briarTrailWalk } from './briar-trail-walk';
import { collisionRockGraze } from './collision-rock-graze';
import { driftwoodCampfire } from './driftwood-campfire';
import { emberInMarsh } from './ember-in-marsh';
import { enteringBriar } from './entering-briar';
import { hasWordsAtBridge } from './has-words-at-bridge';
import { loaderPerceivedWait } from './loader-perceived-wait';
import { marshSurrender } from './marsh-surrender';
import { stagFinale } from './stag-finale';
import { trappedInMarsh } from './trapped-in-marsh';

// Test-bench scenario registry. Add a new scenario when a phase ships so the
// headless harness (and, later, a human panel) can boot straight into it via
// `?scenario=<id>`. Keep this the single place that lists them.
const scenarios: Record<string, Scenario> = {
  [atOldManCottage.id]: atOldManCottage,
  [authoredTriggerDemo.id]: authoredTriggerDemo,
  [behindOldManCottage.id]: behindOldManCottage,
  [briarToBridgeTransition.id]: briarToBridgeTransition,
  [briarTrailWalk.id]: briarTrailWalk,
  [collisionRockGraze.id]: collisionRockGraze,
  [driftwoodCampfire.id]: driftwoodCampfire,
  [emberInMarsh.id]: emberInMarsh,
  [enteringBriar.id]: enteringBriar,
  [hasWordsAtBridge.id]: hasWordsAtBridge,
  [loaderPerceivedWait.id]: loaderPerceivedWait,
  [marshSurrender.id]: marshSurrender,
  [stagFinale.id]: stagFinale,
  [trappedInMarsh.id]: trappedInMarsh,
};

export function getScenario(id: string): Scenario | undefined {
  return scenarios[id];
}

export function getAllScenarioIds(): string[] {
  return Object.keys(scenarios);
}
