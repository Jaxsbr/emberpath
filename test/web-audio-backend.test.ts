import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// #214 P3 regression guard — lazy-loaded music beds must still reach their target
// volume. With SFX-only preload, a bed's buffer isn't decoded on the FIRST visit to
// its area, so setArea's `startMusic(key, 0)` defers and the following
// `fadeMusic(key, target)` has no voice to ramp. The bug: the bed started at gain 0
// and stayed silent. The fix: the backend stashes the pending fade and applies it
// when the deferred startMusic creates the voice.
//
// WebAudioBackend normally isn't unit-tested (vitest is node, no Web Audio); this is
// the one targeted exception, driven by a minimal fake AudioContext, because the
// FakeBackend used elsewhere only records calls and can't exercise the deferred path.

class FakeParam {
  value = 0;
  ramps: number[] = [];
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void { this.value = v; }
  linearRampToValueAtTime(v: number): void { this.ramps.push(v); this.value = v; }
}
class FakeGain {
  gain = new FakeParam();
  connect<T>(n: T): T { return n; }
  disconnect(): void {}
}
class FakeSource {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  connect<T>(n: T): T { return n; }
  start(): void {}
  stop(): void {}
  disconnect(): void {}
}
class FakeCtx {
  currentTime = 0;
  state = 'running';
  destination = {};
  createGain(): FakeGain { return new FakeGain(); }
  createBufferSource(): FakeSource { return new FakeSource(); }
  decodeAudioData(): Promise<unknown> { return Promise.resolve({}); }
  resume(): Promise<void> { return Promise.resolve(); }
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('WebAudioBackend — lazy bed reaches target volume (#214 P3)', () => {
  beforeEach(() => {
    (globalThis as Record<string, unknown>).window = {
      AudioContext: FakeCtx,
      addEventListener: () => {},
    };
    (globalThis as Record<string, unknown>).fetch = () =>
      Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) });
  });
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).window;
    delete (globalThis as Record<string, unknown>).fetch;
  });

  it('a bed started from a cache miss then faded ramps to the target, not silence', async () => {
    const { WebAudioBackend } = await import('../src/audio/webAudioBackend');
    const backend = new WebAudioBackend({ 'music-x': 'x.mp3' });

    // The exact setArea sequence on a first (uncached) area visit:
    backend.startMusic('music-x', 0); // buffer not decoded yet -> defers
    backend.fadeMusic('music-x', 0.8, 600); // no voice yet -> pending fade

    await flush(); // let the fetch/decode/deferred-start chain settle

    const voice = (backend as unknown as { music: Map<string, { gain: FakeGain }> })
      .music.get('music-x');
    expect(voice).toBeDefined();
    expect(voice!.gain.gain.ramps).toContain(0.8); // ramped up, not stuck at 0
    expect(voice!.gain.gain.value).toBe(0.8);
  });

  it('a fade issued after the voice exists ramps immediately (cached revisit path)', async () => {
    const { WebAudioBackend } = await import('../src/audio/webAudioBackend');
    const backend = new WebAudioBackend({ 'music-x': 'x.mp3' });

    backend.startMusic('music-x', 0);
    await flush(); // bed now cached + voice created at 0
    backend.fadeMusic('music-x', 0.8, 600); // voice exists -> direct ramp

    const voice = (backend as unknown as { music: Map<string, { gain: FakeGain }> })
      .music.get('music-x');
    expect(voice!.gain.gain.ramps).toContain(0.8);
  });
});
