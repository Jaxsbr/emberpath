import { AreaDefinition } from './types';
import { ashenIsle } from './ashen-isle';
import { fogMarsh } from './fog-marsh';

const areas: Record<string, AreaDefinition> = {
  'ashen-isle': ashenIsle,
  'fog-marsh': fogMarsh,
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
