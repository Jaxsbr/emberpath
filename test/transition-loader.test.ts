import { describe, it, expect } from 'vitest';
import {
  TRANSITION_LOADER_ID,
  TRANSITION_LOADER_FILL_ID,
  TRANSITION_LOADER_HINT_ID,
  TRANSITION_LOADER_DONE_CLASS,
  TRANSITION_LOADER_FADE_MS,
  TRANSITION_WHISPERS,
  whisperAt,
  showTransitionLoader,
  hideTransitionLoader,
  setTransitionLoaderProgress,
  advanceTransitionWhisper,
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
    style: { width: string };
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
      style: { width: '' },
      _removed: false,
      classList: { add: (t: string) => { el.className = `${el.className} ${t}`.trim(); } },
      remove: () => {
        el._removed = true;
        if (el.id) els.delete(el.id);
      },
    };
    return el;
  };
  // Mirror the inner fill/hint nodes the real loader builds via innerHTML — the
  // node-env fake doesn't parse markup, so register them explicitly by id.
  const register = (id: string): FakeEl => {
    const el = make();
    el.id = id;
    els.set(id, el);
    return el;
  };
  const doc = {
    getElementById: (id: string) => els.get(id) ?? null,
    createElement: () => make(),
    head: { appendChild: (el: FakeEl) => { if (el.id) els.set(el.id, el); } },
    body: { appendChild: (el: FakeEl) => { if (el.id) els.set(el.id, el); } },
  };
  return { doc, els, register };
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

// #214 P4 — perceived wait. The loader gained a kindling progress fill + rotating
// world-whispers, driven from GameScene through these pure setters. A known wait
// feels shorter; the whispers give the eye somewhere warm to rest.

describe('whisperAt', () => {
  it('returns the pool line at an index and wraps (no Math.random, deterministic)', () => {
    const n = TRANSITION_WHISPERS.length;
    expect(n).toBeGreaterThan(0);
    expect(whisperAt(0)).toBe(TRANSITION_WHISPERS[0]);
    expect(whisperAt(n)).toBe(TRANSITION_WHISPERS[0]); // wraps forward
    expect(whisperAt(n + 1)).toBe(TRANSITION_WHISPERS[1]);
    expect(whisperAt(-1)).toBe(TRANSITION_WHISPERS[n - 1]); // wraps backward
  });
});

describe('setTransitionLoaderProgress', () => {
  it('sets the fill width as a percentage of the 0→1 fraction', () => {
    const { doc, register } = fakeDoc();
    const fill = register(TRANSITION_LOADER_FILL_ID);
    expect(setTransitionLoaderProgress(doc, 0.42)).toBe(true);
    expect(fill.style.width).toBe('42%');
  });

  it('clamps out-of-range fractions to 0–100%', () => {
    const { doc, register } = fakeDoc();
    const fill = register(TRANSITION_LOADER_FILL_ID);
    setTransitionLoaderProgress(doc, 1.8);
    expect(fill.style.width).toBe('100%');
    setTransitionLoaderProgress(doc, -0.3);
    expect(fill.style.width).toBe('0%');
  });

  it('is a safe no-op when the loader (and its fill) is not present', () => {
    const { doc } = fakeDoc();
    expect(setTransitionLoaderProgress(doc, 0.5)).toBe(false);
  });
});

describe('advanceTransitionWhisper', () => {
  it('rotates the hint text to the next pool line and returns it', () => {
    const { doc, register } = fakeDoc();
    const hint = register(TRANSITION_LOADER_HINT_ID);
    const first = advanceTransitionWhisper(doc);
    const second = advanceTransitionWhisper(doc);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(TRANSITION_WHISPERS).toContain(first!);
    expect(TRANSITION_WHISPERS).toContain(second!);
    expect(hint.textContent).toBe(second); // the element reflects the latest line
  });

  it('is a safe no-op when the loader (and its hint) is not present', () => {
    const { doc } = fakeDoc();
    expect(advanceTransitionWhisper(doc)).toBeNull();
  });
});
