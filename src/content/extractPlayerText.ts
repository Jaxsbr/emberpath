// Walk an area definition and collect every PLAYER-FACING string with a
// human-readable path for reporting. The extractor is deliberately conservative:
// it pulls only fields a player actually reads on screen, and it skips id-style
// `actionRef`s (dialogue/story triggers reference a script id, not literal text —
// only `type: 'thought'` actionRef is shown verbatim). F3 (#199).

import type { AreaDefinition } from '../data/areas/types';

export interface ExtractedString {
  path: string;
  text: string;
}

export function extractAreaPlayerText(area: AreaDefinition): ExtractedString[] {
  const out: ExtractedString[] = [];
  const push = (path: string, text: unknown) => {
    if (typeof text === 'string' && text.trim().length > 0) out.push({ path, text });
  };
  const a = area.id;

  push(`${a}.objective`, area.objective);
  (area.conditionalObjective ?? []).forEach((c, i) =>
    push(`${a}.conditionalObjective[${i}]`, c.text),
  );
  (area.signposts ?? []).forEach((s, i) => push(`${a}.signposts[${i}].label`, s.label));

  // Triggers: only 'thought' carries literal player text; others are id refs.
  area.triggers.forEach((t) => {
    if (t.type === 'thought') push(`${a}.trigger:${t.id}`, t.actionRef);
  });

  // Dialogues.
  Object.values(area.dialogues).forEach((script) => {
    script.nodes.forEach((n) => {
      push(`${a}.dlg:${script.id}/${n.id}`, n.text);
      if (n.endThought) push(`${a}.dlg:${script.id}/${n.id}.endThought`, n.endThought);
      (n.choices ?? []).forEach((ch, i) =>
        push(`${a}.dlg:${script.id}/${n.id}.choice[${i}]`, ch.text),
      );
    });
  });

  // Story scenes.
  Object.values(area.storyScenes).forEach((scene) => {
    scene.beats.forEach((b, i) => {
      push(`${a}.scene:${scene.id}/beat[${i}]`, b.text);
      if (b.imageLabel) push(`${a}.scene:${scene.id}/beat[${i}].label`, b.imageLabel);
    });
  });

  // Inscribed stones.
  (area.inscribedStones ?? []).forEach((s) => {
    push(`${a}.stone:${s.id}.preWord`, s.preWordThought);
    s.rememberedLines.forEach((l, i) => push(`${a}.stone:${s.id}.remembered[${i}]`, l));
  });

  // Drain / quiet zone voices.
  (area.drainZones ?? []).forEach((z) =>
    (z.doubts?.lines ?? []).forEach((l, i) => push(`${a}.drain:${z.id}.line[${i}]`, l)),
  );
  (area.quietZones ?? []).forEach((z) =>
    (z.narration?.lines ?? []).forEach((l, i) => push(`${a}.quiet:${z.id}.line[${i}]`, l)),
  );

  return out;
}
