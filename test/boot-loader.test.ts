import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  BOOT_LOADER_ID,
  BOOT_LOADER_DONE_CLASS,
  BOOT_LOADER_FADE_MS,
  dismissBootLoader,
} from '../src/ui/bootLoader';

// F6 — loading performance (#214), Phase 1: instant menu feedback.
//
// FAILING-FIRST CONTRACT (Jaco #1324): on origin/main there is NO #boot-loader in
// index.html and no dismissal module, so every assertion below fails. The fix is to
// (a) ship a pure HTML/CSS loader that paints on the first byte, and (b) crossfade
// it out on the first rendered frame. These tests lock both halves so the dark-screen
// regression can't come back.

describe('boot loader markup (index.html)', () => {
  const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

  it('ships a pre-boot loader element that paints before the JS bundle', () => {
    expect(html).toContain(`id="${BOOT_LOADER_ID}"`);
  });

  it('is pure HTML/CSS — no script and no asset request inside the loader path', () => {
    // The loader must cost nothing to appear: it lives in the inline <style> and the
    // static body, not behind a fetch. Guard that it's defined before main.ts loads.
    const loaderIdx = html.indexOf(`id="${BOOT_LOADER_ID}"`);
    const scriptIdx = html.indexOf('<script');
    expect(loaderIdx).toBeGreaterThan(-1);
    expect(loaderIdx).toBeLessThan(scriptIdx);
  });

  it('declares the fade-out class the dismissal hook toggles', () => {
    expect(html).toContain(BOOT_LOADER_DONE_CLASS);
  });
});

describe('dismissBootLoader', () => {
  function fakeDoc(present: boolean) {
    const added: string[] = [];
    let removed = false;
    const el = present
      ? { classList: { add: (t: string) => added.push(t) }, remove: () => { removed = true; } }
      : null;
    return {
      doc: { getElementById: (id: string) => (id === BOOT_LOADER_ID ? el : null) },
      state: () => ({ added, removed }),
    };
  }

  it('fades the loader, then removes it after the transition window', () => {
    const { doc, state } = fakeDoc(true);
    const scheduled: Array<{ fn: () => void; ms: number }> = [];
    const handled = dismissBootLoader(doc, (fn, ms) => scheduled.push({ fn, ms }));

    expect(handled).toBe(true);
    expect(state().added).toContain(BOOT_LOADER_DONE_CLASS);
    // Fade scheduled, not yet removed.
    expect(state().removed).toBe(false);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].ms).toBe(BOOT_LOADER_FADE_MS);

    scheduled[0].fn();
    expect(state().removed).toBe(true);
  });

  it('is a safe no-op when the loader is already gone', () => {
    const { doc } = fakeDoc(false);
    let scheduledCount = 0;
    const handled = dismissBootLoader(doc, () => { scheduledCount++; });
    expect(handled).toBe(false);
    expect(scheduledCount).toBe(0);
  });
});
