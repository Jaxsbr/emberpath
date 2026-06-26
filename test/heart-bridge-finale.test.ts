import { describe, it, expect } from 'vitest';
import { heartBridge } from '../src/data/areas/heart-bridge';
import { DialogueChoice, DialogueNode } from '../src/data/areas/types';

// F1 — Heart Bridge stag finale (issue #197). The bridge is the game's deliberate
// ending: the once-wordless King/stag now speaks a short warm invitation (he waited
// for Pip, cares for her, describes his home, invites her to come live there), Pip
// answers "Yes" (with a soft "Is it far?" that loops, never a real "no"), and that
// "Yes" emits the game-complete signal that fires the end-of-game page (F2, #198).
// These are structural assertions on the authored area data — they fail until the
// finale dialogue is wired, then prove the locked shape (Jaco #1254: b/b/b/a).

const stag = heartBridge.npcs.find(n => n.id === 'antlered-king')!;
const script = heartBridge.dialogues['antlered-king-intro'];

function nodeById(id: string): DialogueNode | undefined {
  return script?.nodes.find(n => n.id === id);
}
function allChoices(): DialogueChoice[] {
  return (script?.nodes ?? []).flatMap(n => n.choices ?? []);
}

describe('F1 — the stag becomes a talkable finale', () => {
  it('the King is no longer silent (he can be spoken to)', () => {
    expect(stag).toBeDefined();
    expect(stag.silent).not.toBe(true);
  });

  it('his invitation only opens once the bridge is crossed (atoned)', () => {
    expect(script).toBeDefined();
    expect(script.condition).toBe('atoned == true');
  });

  it('is a warm multi-line build before any choice is offered', () => {
    const start = nodeById(script.startNodeId)!;
    expect(start).toBeDefined();
    // The build is several spoken beats reached by nextId before the choice node.
    let n: DialogueNode | undefined = start;
    let buildBeats = 0;
    const seen = new Set<string>();
    while (n && !n.choices && n.nextId && !seen.has(n.id)) {
      seen.add(n.id);
      buildBeats++;
      n = nodeById(n.nextId);
    }
    expect(buildBeats).toBeGreaterThanOrEqual(3);
    expect(n?.choices, 'the build resolves into a choice node').toBeDefined();
  });
});

describe('F1 — the choice: Yes (with a soft "is it far?" loop), never a real no', () => {
  it('offers a "Yes, I\'ll come" choice that emits game_complete', () => {
    const yes = allChoices().find(c => c.setFlags?.game_complete === true);
    expect(yes, 'a choice sets game_complete: true').toBeDefined();
    expect(yes!.text.toLowerCase()).toContain('yes');
  });

  it('offers a soft "is it far?" choice that loops back, not an exit', () => {
    const choiceNode = script.nodes.find(n => n.choices && n.choices.length >= 2)!;
    const far = choiceNode.choices!.find(c => /far/i.test(c.text));
    expect(far, 'a soft "is it far?" choice exists').toBeDefined();
    // It must NOT end the game — no game_complete — and must route to a node that
    // leads back to the choice node (a reassuring loop, never a dead end).
    expect(far!.setFlags?.game_complete).not.toBe(true);
    const reassure = nodeById(far!.nextId);
    expect(reassure, 'the "is it far?" branch lands on a real node').toBeDefined();
    // Walk forward from the reassurance; it must return to the choice node.
    let n: DialogueNode | undefined = reassure;
    const seen = new Set<string>();
    let loopsBack = false;
    while (n && !seen.has(n.id)) {
      seen.add(n.id);
      if (n.choices && n.choices.length >= 2) { loopsBack = true; break; }
      n = n.nextId ? nodeById(n.nextId) : undefined;
    }
    expect(loopsBack, '"is it far?" loops back to the Yes choice').toBe(true);
  });

  it('has no real "no" — every terminal path leads to game_complete', () => {
    // No choice may refuse the invitation: there is no exit that ends the
    // dialogue without game_complete being set (the only way out is "Yes").
    const choices = allChoices();
    const refusal = choices.find(c =>
      /\bno\b|never|not now|stay|can'?t/i.test(c.text) && c.setFlags?.game_complete !== true,
    );
    expect(refusal, 'there is no refusing choice').toBeUndefined();
  });
});
