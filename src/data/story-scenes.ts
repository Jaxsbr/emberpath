export interface StoryBeat {
  text: string;
  imageKey?: string;
  imageColor?: number; // placeholder color for the image area
  imageLabel?: string; // placeholder label for the image area
}

export interface StorySceneDefinition {
  id: string;
  beats: StoryBeat[];
}

export const storyScenes: Record<string, StorySceneDefinition> = {
  'ashen-isle-intro': {
    id: 'ashen-isle-intro',
    beats: [
      {
        text: 'You open your eyes to a grey sky. Ash drifts like snow, settling on everything.',
        imageColor: 0x3a3a4a,
        imageLabel: 'Ashen sky',
      },
      {
        text: 'The ground beneath you is cracked and dry. A faint warmth rises from below, as though the earth itself remembers fire.',
        imageColor: 0x5a4030,
        imageLabel: 'Cracked earth',
      },
      {
        text: 'In the distance, a thin trail of smoke curls upward. Someone — or something — is out there.',
        imageColor: 0x2a2a3a,
        imageLabel: 'Distant smoke',
      },
      {
        text: 'You stand. Your legs feel heavy, but your heart feels heavier. You cannot remember how you got here.',
        imageColor: 0x444455,
        imageLabel: 'Standing figure',
      },
    ],
  },
};
