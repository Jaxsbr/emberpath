export type TriggerType = 'dialogue' | 'story' | 'thought';

export interface TriggerDefinition {
  id: string;
  col: number;
  row: number;
  width: number; // in tiles
  height: number; // in tiles
  type: TriggerType;
  actionRef: string; // ID referencing target content
  condition?: string; // e.g. "spoke_to_old_man == true AND bridge_crossed >= 3"
  repeatable: boolean;
}

export const triggers: TriggerDefinition[] = [
  // Thought trigger: entering the open area near the start
  {
    id: 'start-thought',
    col: 8,
    row: 8,
    width: 3,
    height: 2,
    type: 'thought',
    actionRef: 'Where am I? Everything feels... grey.',
    repeatable: false,
  },
  // Story trigger: near the southeast corner, only after talking to old man
  {
    id: 'ashen-isle-vision',
    col: 33,
    row: 32,
    width: 3,
    height: 2,
    type: 'story',
    actionRef: 'ashen-isle-intro',
    condition: 'spoke_to_old_man == true',
    repeatable: false,
  },
  // Repeatable thought trigger: entering a room
  {
    id: 'room-echo',
    col: 4,
    row: 25,
    width: 2,
    height: 2,
    type: 'thought',
    actionRef: 'The walls hum faintly, as if remembering something.',
    repeatable: true,
  },
];
