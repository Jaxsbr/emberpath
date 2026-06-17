import { Scenario } from './types';

// Pip is trapped in the Fog Marsh before the Keeper rescue — no ember yet. Good
// for verifying the "can't escape" pocket, the surrender beat, and the Keeper
// spawn condition (marsh_trapped == true AND marsh_surrendered == true).
export const trappedInMarsh: Scenario = {
  id: 'trapped-in-marsh',
  description: 'Pip is trapped in the Fog Marsh, before the Keeper rescue.',
  areaId: 'fog-marsh',
  position: { col: 14, row: 12 }, // fog-marsh playerSpawn
  flags: {
    marsh_trapped: true,
    has_ember_mark: false,
    keeper_met: false,
    ashen_intro_played: true,
  },
};
