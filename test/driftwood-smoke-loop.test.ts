import { describe, it, expect } from 'vitest';
import { ashenIsle } from '../src/data/areas/ashen-isle';

// US-156 / #1302 — the smoke wayfinding loop pays off at Driftwood's own campfire,
// and his refusal is the fire-vs-Ember allegory Jaco set: proud of the fire he made
// himself (his works / the world), wishing it were more, and — offered the warmer,
// truer Ember — able to see it is better yet unable to let his own fire go.

const intro = ashenIsle.dialogues['driftwood-intro'];
const refused = ashenIsle.dialogues['driftwood-refused'];
const node = (script: typeof intro, id: string) => script.nodes.find((n) => n.id === id)!;
const driftwood = ashenIsle.npcs.find((n) => n.id === 'driftwood')!;

describe('Driftwood is seated by his campfire (the smoke source)', () => {
  it('places a persistent campfire on the shore at the smoke-beacon tile', () => {
    expect(ashenIsle.campfire).toEqual({ col: 28, row: 4 });
    // The plume rises from the same tile so far-smoke resolves into the up-close fire.
    expect(ashenIsle.smokeBeacon?.col).toBe(28);
    expect(ashenIsle.smokeBeacon?.row).toBe(4);
    // The plume still clears once "find the smoke" is met (the fire itself does not).
    expect(ashenIsle.smokeBeacon?.clearedWhen).toBe('has_ember_mark == true');
  });

  it('moves Driftwood right beside the fire, lit by it (no dim override), pinned in place', () => {
    expect(driftwood.col).toBe(29);
    expect(driftwood.row).toBe(4);
    // He's lit warm by the real fire now — the old gloomy lightOverride is gone.
    expect(driftwood.lightOverride).toBeUndefined();
    // wanderRadius 0 keeps him by his fire and off the fire tile.
    expect(driftwood.wanderRadius).toBe(0);
  });
});

describe('driftwood-intro closes the smoke loop and runs the fire-vs-Ember allegory', () => {
  it('greets by naming the smoke as his own fire (closes the wayfinding loop)', () => {
    const text = node(intro, 'greeting').text.toLowerCase();
    expect(text).toContain('fire');
    expect(text).toContain('smoke');
  });

  it('brags about the fire but wishes it were more', () => {
    const text = node(intro, 'middle').text.toLowerCase();
    expect(text).toContain('fire');
    expect(text).toMatch(/wish|more|bigger/);
  });

  it('keeps the post-Ember Share-warmth choice gated and flag-setting, no pulse', () => {
    const offer = node(intro, 'offer');
    const share = offer.choices?.find((c) => c.text === 'Share warmth')!;
    expect(share).toBeTruthy();
    expect(share.condition).toBe('has_ember_mark == true AND npc_refused_driftwood == false');
    expect(share.setFlags).toEqual({ npc_refused_driftwood: true });
    expect(share.nextId).toBe('decline');
    // A second, always-available small-talk branch remains.
    expect(offer.choices?.some((c) => c.nextId === 'small_talk')).toBe(true);
  });

  it('on decline: sees the Ember is warmer/more real, then cannot let his fire go', () => {
    const decline = node(intro, 'decline').text.toLowerCase();
    // Recognises the Ember as the better, truer light.
    expect(decline).toMatch(/warmer|more real|truer/);
    expect(node(intro, 'decline').nextId).toBe('cling');
    const cling = node(intro, 'cling').text.toLowerCase();
    expect(cling).toContain('fire');
    expect(cling).toMatch(/can not let|cannot let|not yet|let it go/);
  });

  it('parts with the door left open — no villain', () => {
    const parting = node(intro, 'parting').text.toLowerCase();
    expect(parting).toMatch(/maybe|one day|follow/);
  });

  it('never produces an ember pulse on the refusal path', () => {
    expect(JSON.stringify(intro)).not.toContain('firePulseTarget');
  });
});

describe('driftwood-refused echoes the clinging + open door', () => {
  it('still gated to the refused state', () => {
    expect(refused.condition).toBe('npc_refused_driftwood == true');
  });
  it('keeps the fire as his and leaves the door open', () => {
    const all = refused.nodes.map((n) => n.text).join(' ').toLowerCase();
    expect(all).toContain('fire');
    expect(all).toMatch(/maybe|one day|follow/);
    // No Share-warmth choice once refused.
    expect(JSON.stringify(refused)).not.toContain('Share warmth');
  });
});

describe('reading level stays young-child (short, common words)', () => {
  it('keeps Driftwood lines to short words', () => {
    const lines = [...intro.nodes, ...refused.nodes].map((n) => n.text);
    for (const line of lines) {
      const words = line.replace(/[^A-Za-z\s]/g, '').split(/\s+/).filter(Boolean);
      for (const w of words) {
        expect(w.length, `"${w}" in "${line}" is too long for the reading level`).toBeLessThanOrEqual(9);
      }
    }
  });
});
