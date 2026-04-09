export interface DialogueChoice {
  text: string;
  nextId: string;
  setFlags?: Record<string, string | number | boolean>;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  nextId?: string;
  choices?: DialogueChoice[];
}

export interface DialogueScript {
  id: string;
  startNodeId: string;
  nodes: DialogueNode[];
}

export const dialogues: Record<string, DialogueScript> = {
  'old-man-intro': {
    id: 'old-man-intro',
    startNodeId: 'greeting',
    nodes: [
      {
        id: 'greeting',
        speaker: 'Old Man',
        text: 'Ah, a traveler. These ashen lands have not seen a soul in ages.',
        nextId: 'ask-choice',
      },
      {
        id: 'ask-choice',
        speaker: 'Old Man',
        text: 'Tell me, what brings you to the Ashen Isle?',
        choices: [
          { text: 'I seek the path forward.', nextId: 'path-response' },
          { text: 'I woke up here. I remember nothing.', nextId: 'memory-response' },
          { text: 'Who are you?', nextId: 'identity-response' },
        ],
      },
      {
        id: 'path-response',
        speaker: 'Old Man',
        text: 'The path... yes. There is a way through the fog, but it demands more than courage.',
        nextId: 'path-choice',
      },
      {
        id: 'path-choice',
        speaker: 'Old Man',
        text: 'Will you listen to what I know of it?',
        choices: [
          { text: 'Yes, tell me everything.', nextId: 'path-detail', setFlags: { spoke_to_old_man: true } },
          { text: 'I will find my own way.', nextId: 'farewell-alone' },
        ],
      },
      {
        id: 'path-detail',
        speaker: 'Old Man',
        text: 'Beyond the fog lies a bridge of embers. Only those who carry a light within can cross it. Remember that.',
      },
      {
        id: 'farewell-alone',
        speaker: 'Old Man',
        text: 'Bold words. The fog cares nothing for bravery alone. But go, if you must.',
      },
      {
        id: 'memory-response',
        speaker: 'Old Man',
        text: 'You remember nothing? Then perhaps you were brought here for a reason. The Isle does not call to just anyone.',
        nextId: 'memory-advice',
      },
      {
        id: 'memory-advice',
        speaker: 'Old Man',
        text: 'Explore. Speak to the stones and the silence. The answers are here, if you look.',
      },
      {
        id: 'identity-response',
        speaker: 'Old Man',
        text: 'Who am I? Just a keeper of stories. I have watched the embers fade and the fog roll in, season after season.',
        nextId: 'identity-offer',
      },
      {
        id: 'identity-offer',
        speaker: 'Old Man',
        text: 'But enough about me. You have a journey ahead.',
      },
    ],
  },
};
