import { AreaDefinition } from './types';
import { ashenIsle } from './ashen-isle';
import { fogMarsh } from './fog-marsh';
import { briarWilds } from './briar-wilds';
import { heartBridge } from './heart-bridge';
import { getAuthoredTriggers, mergeAuthoredTriggers } from './authored-triggers';

// Spread any editor-authored triggers (#187) onto the area at load. The single
// seam where authored data meets the engine: an area with no sidecar is returned
// untouched (same object), so unauthored areas are byte-identical to before.
function withAuthoredTriggers(id: string, area: AreaDefinition): AreaDefinition {
  const authored = getAuthoredTriggers(id);
  if (authored.length === 0) return area;
  return { ...area, triggers: mergeAuthoredTriggers(area.triggers, authored) };
}

const areas: Record<string, AreaDefinition> = {
  'ashen-isle': withAuthoredTriggers('ashen-isle', ashenIsle),
  'fog-marsh': withAuthoredTriggers('fog-marsh', fogMarsh),
  'briar-wilds': withAuthoredTriggers('briar-wilds', briarWilds),
  'heart-bridge': withAuthoredTriggers('heart-bridge', heartBridge),
};

export function getArea(id: string): AreaDefinition | undefined {
  return areas[id];
}

export function getAllAreaIds(): string[] {
  return Object.keys(areas);
}

export function getDefaultAreaId(): string {
  return 'ashen-isle';
}
