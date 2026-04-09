import { AreaDefinition } from './types';
import { ashenIsle } from './ashen-isle';

const areas: Record<string, AreaDefinition> = {
  'ashen-isle': ashenIsle,
};

export function getArea(id: string): AreaDefinition | undefined {
  return areas[id];
}

export function getDefaultAreaId(): string {
  return 'ashen-isle';
}
