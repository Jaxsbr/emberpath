// Audio layer — the BROWSER backend (F5, #200). The only file that touches real
// audio. Implements AudioBackend with the Web Audio API: gapless looping music
// beds (BufferSource.loop) each on their own GainNode for crossfades, and
// low-latency one-shot SFX. Lives at module level (never inside a Phaser scene) so
// the bed survives GameScene restarts on area transitions.
//
// Not unit-tested (vitest is node, no Web Audio) — its behaviour is verified by the
// headless Playwright audio scenario. The decisions it carries out are all tested
// on the model/manager side with a fake backend.

import type { AudioBackend } from './audioManager';

interface MusicVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  /** ctx time the current fade finishes — stopMusic waits for it so fades complete. */
  fadeEndsAt: number;
}

export class WebAudioBackend implements AudioBackend {
  private readonly ctx: AudioContext;
  private readonly master: GainNode;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly music = new Map<string, MusicVoice>();
  private readonly loading = new Map<string, Promise<void>>();
  // A fade requested for a bed whose voice doesn't exist yet (it's still
  // decoding). setArea issues startMusic(key, 0) then fadeMusic(key, target):
  // with lazy-loaded beds (#214 P3) the first call defers, so the second has no
  // voice to ramp. We stash the target here and apply it when the deferred
  // startMusic finally creates the voice — otherwise the bed would start at 0 and
  // stay silent until the area is revisited (cached). See startMusic / fadeMusic.
  private readonly pendingFades = new Map<string, { to: number; ms: number }>();

  constructor(private readonly manifest: Record<string, string>) {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor!();
    this.master = this.ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(this.ctx.destination);
    this.installUnlock();
  }

  // Browsers keep the context suspended until a user gesture. The title screen's
  // first click/keypress unlocks it; harmless to call repeatedly.
  private installUnlock(): void {
    const resume = () => {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    };
    for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
      window.addEventListener(ev, resume, { passive: true });
    }
  }

  /** Decode every manifest entry up front. Safe to await before the game shows. */
  async preloadAll(): Promise<void> {
    await Promise.all(Object.keys(this.manifest).map((k) => this.load(k)));
  }

  /**
   * #214 P3: decode only the short SFX up front. Music beds are ~2.7 MB total and
   * one-per-area, so they're left to lazy-load on demand — startMusic loads-then-
   * starts on a cache miss, so the active area's bed fetches when create() calls
   * setArea, and only that one. SFX are tiny and fire on the first interaction, so
   * they stay eager to avoid a first-step click being silent.
   */
  async preloadSfxOnly(): Promise<void> {
    const sfxKeys = Object.keys(this.manifest).filter((k) => k.startsWith('sfx-'));
    await Promise.all(sfxKeys.map((k) => this.load(k)));
  }

  private load(key: string): Promise<void> {
    if (this.buffers.has(key)) return Promise.resolve();
    const existing = this.loading.get(key);
    if (existing) return existing;
    const url = this.manifest[key];
    if (!url) return Promise.resolve();
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((a) => this.ctx.decodeAudioData(a))
      .then((buf) => {
        this.buffers.set(key, buf);
      })
      .catch((err) => {
        // A missing/undecodable file must never break the game — just stay silent.
        console.warn(`[audio] failed to load ${key} (${url}):`, err);
      })
      .finally(() => {
        this.loading.delete(key);
      });
    this.loading.set(key, p);
    return p;
  }

  ensureLoaded(key: string): void {
    if (!this.buffers.has(key)) void this.load(key);
  }

  startMusic(key: string, volume: number): void {
    if (this.music.has(key)) return; // already playing — don't stack voices
    const buf = this.buffers.get(key);
    if (!buf) {
      // Not decoded yet: load, then start (a transition early in boot).
      void this.load(key).then(() => {
        if (!this.music.has(key) && this.buffers.has(key)) this.startMusic(key, volume);
      });
      return;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    try {
      source.start();
    } catch {
      /* already started — ignore */
    }
    this.music.set(key, { source, gain, fadeEndsAt: this.ctx.currentTime });
    // Apply any fade that was requested while this bed was still loading, so a
    // lazy-loaded bed ramps to its intended volume instead of staying at `volume`.
    const pending = this.pendingFades.get(key);
    if (pending) {
      this.pendingFades.delete(key);
      this.fadeMusic(key, pending.to, pending.ms);
    }
  }

  fadeMusic(key: string, to: number, ms: number): void {
    const v = this.music.get(key);
    if (!v) {
      // The bed's voice isn't created yet (still decoding). Remember the target
      // so the deferred startMusic ramps to it once the buffer is ready.
      this.pendingFades.set(key, { to, ms });
      return;
    }
    const now = this.ctx.currentTime;
    const end = now + ms / 1000;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(to, end);
    v.fadeEndsAt = end;
  }

  stopMusic(key: string): void {
    const v = this.music.get(key);
    if (!v) return;
    this.music.delete(key);
    // Wait for any in-flight fade so a crossfade-out isn't cut short.
    const stopAt = Math.max(this.ctx.currentTime, v.fadeEndsAt);
    try {
      v.source.stop(stopAt);
    } catch {
      /* ignore */
    }
    v.source.onended = () => {
      try {
        v.source.disconnect();
        v.gain.disconnect();
      } catch {
        /* ignore */
      }
    };
  }

  playOneShot(key: string, volume: number): void {
    const buf = this.buffers.get(key);
    if (!buf) {
      this.ensureLoaded(key);
      return; // skip this instance rather than stutter; next one will play
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.onended = () => {
      try {
        source.disconnect();
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
    try {
      source.start();
    } catch {
      /* ignore */
    }
  }
}
