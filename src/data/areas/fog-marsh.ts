import { TileType } from '../../maps/constants';
import { AreaDefinition } from './types';

const F = TileType.FLOOR;
const W = TileType.WALL;

// 30 cols × 24 rows — deliberately different from Ashen Isle (50×38)
// to validate dynamic camera zoom, collision bounds, and tile rendering
export const fogMarsh: AreaDefinition = {
  id: 'fog-marsh',
  name: 'Fog Marsh',
  mapCols: 30,
  mapRows: 24,
  tileset: 'monochrome-rpg',
  map: [
    //0                                          29
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 0
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 1
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 2
    [W,F,F,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,F,F,F,W], // 3
    [W,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,F,W], // 4
    [W,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,F,W], // 5
    [W,F,F,W,W,F,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,F,W,W,F,F,F,W], // 6
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 7
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 8
    [W,F,F,F,F,F,F,F,F,W,W,W,W,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 9
    [W,F,F,F,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 10
    [W,F,F,F,F,F,F,F,F,W,F,F,F,F,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 11
    [W,F,F,F,F,F,F,F,F,W,W,W,F,W,W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 12
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 13
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 14
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,W,W,W,F,F,F,F,F,F,F,F,W], // 15
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,W], // 16
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,F,F,F,W,F,F,F,F,F,F,F,F,W], // 17
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W,W,F,W,W,F,F,F,F,F,F,F,F,W], // 18
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 19
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 20
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 21
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W], // 22
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W], // 23
  ],
  npcs: [
    { id: 'marsh-hermit', name: 'Marsh Hermit', col: 18, row: 10, color: 0x5a7a6b },
  ],
  props: [
    // Gravestones, skulls, dead shrubs, mushrooms — dead-end allegory imagery.
    // Frames from docs/plan/tileset-frame-analysis.md (monochrome-rpg shortlist).
    { id: 'gravestone-n1', col: 4, row: 2, spriteFrame: '18' },
    { id: 'dead-shrub-n1', col: 14, row: 2, spriteFrame: '3' },
    { id: 'dead-tree-n1', col: 22, row: 2, spriteFrame: '5' },
    { id: 'mushroom-m1', col: 4, row: 8, spriteFrame: '20' },
    { id: 'gravestone-m1', col: 12, row: 8, spriteFrame: '19' },
    { id: 'skull-m1', col: 26, row: 8, spriteFrame: '22' },
    { id: 'dead-shrub-c1', col: 4, row: 14, spriteFrame: '4' },
    { id: 'mushroom-c1', col: 12, row: 14, spriteFrame: '21' },
    { id: 'dead-tree-c1', col: 24, row: 14, spriteFrame: '6' },
    { id: 'gravestone-s1', col: 8, row: 19, spriteFrame: '18' },
    { id: 'skull-s1', col: 14, row: 19, spriteFrame: '23' },
    { id: 'gravestone-s2', col: 22, row: 19, spriteFrame: '19' },
  ],
  triggers: [
    // Thought trigger — entering the foggy open area
    {
      id: 'fog-entry-thought',
      col: 5,
      row: 7,
      width: 3,
      height: 2,
      type: 'thought',
      actionRef: 'The air is thick here. Each breath tastes of damp earth and something older.',
      repeatable: false,
    },
    // Story trigger — the marsh vision, requires talking to hermit
    {
      id: 'marsh-vision',
      col: 22,
      row: 19,
      width: 3,
      height: 2,
      type: 'story',
      actionRef: 'marsh-depths',
      condition: 'spoke_to_marsh_hermit == true',
      repeatable: false,
    },
    // Dialogue trigger — zone-triggered dialogue (distinct from NPC interaction)
    {
      id: 'whispering-stones',
      col: 11,
      row: 13,
      width: 2,
      height: 2,
      type: 'dialogue',
      actionRef: 'whispering-stones',
      repeatable: true,
    },
  ],
  dialogues: {
    'marsh-hermit-intro': {
      id: 'marsh-hermit-intro',
      startNodeId: 'greeting',
      nodes: [
        {
          id: 'greeting',
          speaker: 'Marsh Hermit',
          text: 'Another soul wandering into the fog? Most turn back before reaching this far.',
          nextId: 'question',
        },
        {
          id: 'question',
          speaker: 'Marsh Hermit',
          text: 'The marsh tests those who enter. What do you seek here?',
          choices: [
            { text: 'A way through the fog.', nextId: 'way-through', setFlags: { spoke_to_marsh_hermit: true } },
            { text: 'I followed a path from the Ashen Isle.', nextId: 'from-ashen', setFlags: { spoke_to_marsh_hermit: true } },
          ],
        },
        {
          id: 'way-through',
          speaker: 'Marsh Hermit',
          text: 'Through? There is no through. Only deeper. But deeper is sometimes where the light hides.',
          nextId: 'advice',
        },
        {
          id: 'from-ashen',
          speaker: 'Marsh Hermit',
          text: 'The Ashen Isle... I remember it. Grey skies and old men with older stories.',
          nextId: 'advice',
        },
        {
          id: 'advice',
          speaker: 'Marsh Hermit',
          text: 'Listen to the stones if you can. They remember what the fog has forgotten.',
        },
      ],
    },
    'whispering-stones': {
      id: 'whispering-stones',
      startNodeId: 'whisper',
      nodes: [
        {
          id: 'whisper',
          speaker: 'Whispering Stones',
          text: 'The stones hum with a low vibration. Words form at the edge of hearing...',
          nextId: 'message',
        },
        {
          id: 'message',
          speaker: 'Whispering Stones',
          text: '"The ember does not die. It waits beneath the ash for one who will carry it."',
        },
      ],
    },
  },
  storyScenes: {
    'marsh-depths': {
      id: 'marsh-depths',
      beats: [
        {
          text: 'The fog parts for a moment. Below the murky water, something glows — faint and warm, like a coal refusing to die.',
          imageColor: 0x2a3a2a,
          imageLabel: 'Glowing depths',
        },
        {
          text: 'A voice, not heard but felt: "What was lost can be found. What was broken can be mended. But first, you must see."',
          imageColor: 0x3a4a3a,
          imageLabel: 'Voice in the fog',
        },
      ],
    },
  },
  playerSpawn: { col: 2, row: 12 },
  exits: [
    {
      id: 'fog-to-ashen',
      col: 1,
      row: 12,
      width: 1,
      height: 2,
      destinationAreaId: 'ashen-isle',
      entryPoint: { col: 48, row: 18 },
    },
  ],
  visual: { floorColor: 0x3a4a3a, wallColor: 0x1a2a1a },
};
