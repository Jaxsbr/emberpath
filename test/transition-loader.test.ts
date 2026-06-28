import { describe, it, expect } from 'vitest';
import {
  TRANSITION_LOADER_ID,
  TRANSITION_LOADER_DONE_CLASS,
  TRANSITION_LOADER_FADE_MS,
  showTransitionLoader,
  hideTransitionLoader,
} from '../src/ui/transitionLoader';

// F6 — loading performance (#214), Phase 3: the area-transition loading indicator.
//
// FAILING-FIRST CONTRACT (Jaco #1324): on origin/main there is no transition loader
// — walking into an un-cached area sits on a black screen with no feedback. These
// tests lock the show/hide lifecycle against a minimal stub document so the logic is
// node-testable and can't silently regress. The visual itself goes through GATE-2.

function fakeDoc() {
  const els = new Map<string, FakeEl>();
  type FakeEl = {
    id: string;
    className: string;
    innerHTML: string;
    textContent: string;
    classList: { add(t: string): void };
    remove(): void;
    _removed: boolean;
  };
  const make = (): FakeEl => {
    const el: FakeEl = {
      id: '',
      className: '',
      innerHTML: '',
      textContent: '',
      _removed: false,
      classList: { add: (t: string) => { el.className = `${el.className} ${t}`.trim(); } },
      remove: () => {
        el._removed = true;
        if (el.id) els.delete(el.id);
      },
    };
    return el;
  };
  const doc = {
    getElementById: (id: string) => els.get(id) ?? null,
    createElement: () => make(),
    head: { appendChild: (el: FakeEl) => { if (el.id) els.set(el.id, el); } },
    body: { appendChild: (el: FakeEl) => { if (el.id) els.set(el.id, el); } },
  };
  return { doc, els };
}

describe('showTransitionLoader', () => {
  it('injects the loader element on first show', () => {
    const { doc, els } = fakeDoc();
    expect(showTransitionLoader(doc)).toBe(true);
    expect(els.has(TRANSITION_LOADER_ID)).toBe(true);
  });

  it('is idempotent — a second show does not duplicate the element', () => {
    const { doc, els } = fakeDoc();
    showTransitionLoader(doc);
    const after1 = els.size;
    showTransitionLoader(doc);
    expect(els.size).toBe(after1);
  });

  it('returns false when there is no body to mount into', () => {
    const { doc } = fakeDoc();
    const headless = { ...doc, body: null };
    expect(showTransitionLoader(headless)).toBe(false);
  });
});

describe('hideTransitionLoader', () => {
  it('fades, then removes the loader after the transition window', () => {
    const { doc, els } = fakeDoc();
    showTransitionLoader(doc);
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    const handled = hideTransitionLoader(doc, (fn, ms) => scheduled.push({ fn, ms }));

    expect(handled).toBe(true);
    expect(els.get(TRANSITION_LOADER_ID)!.className).toContain(TRANSITION_LOADER_DONE_CLASS);
    expect(els.has(TRANSITION_LOADER_ID)).toBe(true); // not yet removed
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe(TRANSITION_LOADER_FADE_MS);

    scheduled[0].fn();
    expect(els.has(TRANSITION_LOADER_ID)).toBe(false);
  });

  it('is a safe no-op when nothing was shown (fully cached transition)', () => {
    const { doc } = fakeDoc();
    let scheduledCount = 0;
    const handled = hideTransitionLoader(doc, () => { scheduledCount++; });
    expect(handled).toBe(false);
    expect(scheduledCount).toBe(0);
  });
});
