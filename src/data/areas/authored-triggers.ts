/// <reference types="vite/client" />
import type { TriggerDefinition } from './types';

// Editor P3 (#187, Decision A-a) — authored triggers live as per-area JSON
// sidecars under ./triggers/<areaId>.json, written by the Triggers editor tab.
// The registry spreads them onto the matching area's inline `triggers` at load.
//
// ZERO-REGRESSION CONTRACT: an area with no sidecar is left BYTE-IDENTICAL to
// today (mergeAuthoredTriggers returns the original array reference, and the
// registry skips the merge entirely). Areas migrate into the tool one at a time;
// nothing is touched until it's authored.

// Eagerly import every sidecar. Vite resolves this glob at build time in both the
// game and the standalone editor; vitest resolves it through the same pipeline.
// No sidecars → `{}` → no authored triggers anywhere.
const sidecars = import.meta.glob<TriggerDefinition[]>('./triggers/*.json', {
  eager: true,
  import: 'default',
});

const byArea: Record<string, TriggerDefinition[]> = {};
for (const [filePath, triggers] of Object.entries(sidecars)) {
  const areaId = filePath.replace(/^.*\/([^/]+)\.json$/, '$1');
  byArea[areaId] = Array.isArray(triggers) ? triggers : [];
}

export function getAuthoredTriggers(areaId: string): TriggerDefinition[] {
  return byArea[areaId] ?? [];
}

// Merge inline + authored triggers, enforcing globally-unique ids — the runtime
// keys one-shot bookkeeping on `_trigger_fired_<id>`, so a duplicate id would
// make two triggers share a fired-flag and silently swallow one. Throws in that
// case (dev-time, loud). When there are no authored triggers it returns the
// inline array UNCHANGED (same reference) — the zero-regression fast path.
export function mergeAuthoredTriggers(
  inline: TriggerDefinition[],
  authored: TriggerDefinition[],
): TriggerDefinition[] {
  if (authored.length === 0) return inline;
  const seen = new Set(inline.map((t) => t.id));
  for (const t of authored) {
    if (seen.has(t.id)) {
      throw new Error(
        `Duplicate trigger id "${t.id}": an authored sidecar trigger collides with an inline trigger.`,
      );
    }
    seen.add(t.id);
  }
  return [...inline, ...authored];
}
