import { describe, it, expect, beforeEach } from 'vitest';
import {
  musicKeyForArea,
  planMusicChange,
  FootstepThrottle,
  Cooldown,
  OnceGate,
  npcFootstepVolume,
  MUSIC_BY_AREA,
  MUSIC_VOLUME,
  FOOTSTEP_INTERVAL_MS,
  FOOTSTEP_VOLUME,
  THOUGHT_VOLUME,
  THOUGHT_COOLDOWN_MS,
  NPC_FOOTSTEP_RANGE_PX,
  NPC_FOOTSTEP_MAX_VOLUME,
} from '../src/audio/audioModel';
import { AudioManager, type AudioBackend } from '../src/audio/audioManager';
import { getAllAreaIds } from '../src/data/areas/registry';

// F5 (#200): the audio layer. vitest is node-env (no Web Audio / no HTMLAudio), so
// the engine is split — a pure, node-testable MODEL + manager (decisions: which
// track, mute gating, footstep cadence, crossfade plan) and a thin browser BACKEND
// (the only part that touches real audio, verified by Playwright). These tests pin
// every DECISION; the backend is dumb on purpose.

describe('music selection model', () => {
  it('maps every real area to a music track', () => {
    for (const id of getAllAreaIds()) {
      expect(musicKeyForArea(id), `area ${id} has no music`).toBeTruthy();
    }
  });

  it('returns null for an unknown area (no crash, just silence)', () => {
    expect(musicKeyForArea('does-not-exist')).toBeNull();
  });

  it('keys are distinct per area (each map its own mood)', () => {
    const keys = Object.values(MUSIC_BY_AREA);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('crossfade plan', () => {
  it('is a no-op when the same track is already playing (scene-restart safe)', () => {
    const plan = planMusicChange('music-ashen-isle', 'music-ashen-isle');
    expect(plan.noop).toBe(true);
    expect(plan.fadeIn).toBeNull();
    expect(plan.fadeOut).toBeNull();
  });

  it('fades the old out and the new in on a real area change', () => {
    const plan = planMusicChange('music-ashen-isle', 'music-heart-bridge');
    expect(plan.noop).toBe(false);
    expect(plan.fadeOut).toBe('music-ashen-isle');
    expect(plan.fadeIn).toBe('music-heart-bridge');
  });

  it('handles the first track (nothing playing yet)', () => {
    const plan = planMusicChange(null, 'music-ashen-isle');
    expect(plan.fadeOut).toBeNull();
    expect(plan.fadeIn).toBe('music-ashen-isle');
    expect(plan.noop).toBe(false);
  });

  it('fades out to silence when leaving to an area with no music', () => {
    const plan = planMusicChange('music-ashen-isle', null);
    expect(plan.fadeOut).toBe('music-ashen-isle');
    expect(plan.fadeIn).toBeNull();
    expect(plan.noop).toBe(false);
  });
});

describe('footstep cadence throttle', () => {
  let t: FootstepThrottle;
  beforeEach(() => {
    t = new FootstepThrottle();
  });

  it('never steps while standing still', () => {
    expect(t.step(0, false)).toBe(false);
    expect(t.step(10_000, false)).toBe(false);
  });

  it('steps once immediately on first move, then gates by interval', () => {
    expect(t.step(0, true)).toBe(true); // first step fires
    expect(t.step(50, true)).toBe(false); // too soon
    expect(t.step(FOOTSTEP_INTERVAL_MS, true)).toBe(true); // interval elapsed
    expect(t.step(FOOTSTEP_INTERVAL_MS + 50, true)).toBe(false);
  });

  it('resets cadence after a pause so the next move steps immediately', () => {
    expect(t.step(0, true)).toBe(true);
    t.step(100, false); // stopped
    t.reset();
    expect(t.step(120, true)).toBe(true);
  });
});

describe('once gate (first-time sounds)', () => {
  it('fires only the first time per id', () => {
    const g = new OnceGate();
    expect(g.fire('quill')).toBe(true);
    expect(g.fire('quill')).toBe(false);
    expect(g.fire('keeper')).toBe(true);
    expect(g.fire('keeper')).toBe(false);
  });
});

describe('NPC footstep proximity volume (FB-25)', () => {
  it('is loudest (but capped) right next to Pip', () => {
    expect(npcFootstepVolume(0)).toBe(NPC_FOOTSTEP_MAX_VOLUME);
  });

  it('never exceeds Pip\'s own footstep level at any distance', () => {
    for (let d = 0; d <= NPC_FOOTSTEP_RANGE_PX + 50; d += 5) {
      expect(npcFootstepVolume(d)).toBeLessThanOrEqual(FOOTSTEP_VOLUME);
    }
  });

  it('falls off with distance and is silent past hearing range', () => {
    const near = npcFootstepVolume(20);
    const far = npcFootstepVolume(150);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    expect(npcFootstepVolume(NPC_FOOTSTEP_RANGE_PX)).toBe(0);
    expect(npcFootstepVolume(NPC_FOOTSTEP_RANGE_PX + 100)).toBe(0);
  });
});

describe('thought-chime cooldown (FB-25 debounce)', () => {
  it('fires immediately the first time', () => {
    const c = new Cooldown(THOUGHT_COOLDOWN_MS);
    expect(c.request(0)).toBe(true);
  });

  it('suppresses a burst inside the window — exactly one chime', () => {
    const c = new Cooldown(THOUGHT_COOLDOWN_MS);
    expect(c.request(0)).toBe(true);
    expect(c.request(50)).toBe(false);
    expect(c.request(100)).toBe(false);
    expect(c.request(THOUGHT_COOLDOWN_MS - 1)).toBe(false);
  });

  it('a sustained burst keeps refreshing the window so it stays quiet', () => {
    const c = new Cooldown(1000);
    expect(c.request(0)).toBe(true);
    // requests every 500ms (< cooldown) keep pushing the window forward
    expect(c.request(500)).toBe(false);
    expect(c.request(1000)).toBe(false); // would have been ready, but 500 refreshed it
    expect(c.request(1500)).toBe(false);
  });

  it('recovers and fires again once requests stop for a full window', () => {
    const c = new Cooldown(1000);
    expect(c.request(0)).toBe(true);
    expect(c.request(2000)).toBe(true); // a clear gap → can play again
  });
});

// A fake backend records every call so the manager's decisions are asserted with
// zero audio. This is exactly what the WebAudio backend does in the browser.
class FakeBackend implements AudioBackend {
  calls: string[] = [];
  loaded = new Set<string>();
  ensureLoaded(key: string) {
    this.loaded.add(key);
  }
  startMusic(key: string, volume: number) {
    this.calls.push(`start:${key}@${volume}`);
  }
  fadeMusic(key: string, to: number, ms: number) {
    this.calls.push(`fade:${key}->${to}/${ms}`);
  }
  stopMusic(key: string) {
    this.calls.push(`stop:${key}`);
  }
  playOneShot(key: string, volume: number) {
    this.calls.push(`sfx:${key}@${volume}`);
  }
}

describe('AudioManager', () => {
  let backend: FakeBackend;
  let mgr: AudioManager;
  beforeEach(() => {
    backend = new FakeBackend();
    mgr = new AudioManager(backend, { muted: false });
  });

  it('starts an area track at volume 0 and fades it up to the faint default', () => {
    mgr.setArea('ashen-isle');
    expect(backend.calls).toContain('start:music-ashen-isle@0');
    expect(backend.calls.some((c) => c.startsWith(`fade:music-ashen-isle->${MUSIC_VOLUME}/`))).toBe(true);
  });

  it('does NOT restart music when re-entering the same area (scene restart)', () => {
    mgr.setArea('ashen-isle');
    backend.calls = [];
    mgr.setArea('ashen-isle');
    expect(backend.calls).toEqual([]); // silence — no churn
  });

  it('crossfades on a real transition: fade old down, new up', () => {
    mgr.setArea('ashen-isle');
    backend.calls = [];
    mgr.setArea('heart-bridge');
    expect(backend.calls.some((c) => c.startsWith('fade:music-ashen-isle->0/'))).toBe(true);
    expect(backend.calls).toContain('start:music-heart-bridge@0');
    expect(backend.calls.some((c) => c.startsWith(`fade:music-heart-bridge->${MUSIC_VOLUME}/`))).toBe(true);
  });

  it('plays SFX through the backend when not muted', () => {
    mgr.sfx('choice-select');
    expect(backend.calls.some((c) => c.startsWith('sfx:choice-select@'))).toBe(true);
  });

  it('mutes ALL sound: SFX suppressed and music faded to 0', () => {
    mgr.setArea('ashen-isle');
    backend.calls = [];
    mgr.setMuted(true);
    expect(mgr.isMuted()).toBe(true);
    expect(backend.calls.some((c) => c.startsWith('fade:music-ashen-isle->0/'))).toBe(true);
    backend.calls = [];
    mgr.sfx('choice-select');
    expect(backend.calls).toEqual([]); // no sfx while muted
  });

  it('unmuting restores the music bed to the faint default', () => {
    mgr.setArea('ashen-isle');
    mgr.setMuted(true);
    backend.calls = [];
    mgr.setMuted(false);
    expect(mgr.isMuted()).toBe(false);
    expect(backend.calls.some((c) => c.startsWith(`fade:music-ashen-isle->${MUSIC_VOLUME}/`))).toBe(true);
  });

  it('footsteps only while moving and only when not muted', () => {
    expect(mgr.footstep(0, false)).toBe(false);
    expect(mgr.footstep(0, true)).toBe(true);
    backend.calls = [];
    mgr.setMuted(true);
    expect(mgr.footstep(FOOTSTEP_INTERVAL_MS * 2, true)).toBe(false);
    expect(backend.calls.every((c) => !c.startsWith('sfx:footstep'))).toBe(true);
  });

  it('first-interaction sound fires once per npc', () => {
    expect(mgr.firstInteraction('quill')).toBe(true);
    expect(mgr.firstInteraction('quill')).toBe(false);
  });

  it('plays an NPC footstep through the footstep SFX, faded by distance', () => {
    expect(mgr.npcFootstep('wren', 0, 0)).toBe(true);
    const call = backend.calls.find((c) => c.startsWith('sfx:sfx-footstep@'));
    expect(call).toBeTruthy();
    const vol = Number(call!.split('@')[1]);
    expect(vol).toBeLessThanOrEqual(FOOTSTEP_VOLUME); // never louder than Pip
  });

  it('does not fire an NPC footstep when out of hearing range', () => {
    expect(mgr.npcFootstep('wren', NPC_FOOTSTEP_RANGE_PX + 50, 0)).toBe(false);
    expect(backend.calls.every((c) => !c.startsWith('sfx:sfx-footstep'))).toBe(true);
  });

  it('throttles each NPC on its own cadence', () => {
    expect(mgr.npcFootstep('wren', 0, 0)).toBe(true);
    expect(mgr.npcFootstep('wren', 0, 50)).toBe(false); // too soon for wren
    expect(mgr.npcFootstep('quill', 0, 50)).toBe(true); // quill's own clock
  });

  it('suppresses NPC footsteps while muted', () => {
    mgr.setMuted(true);
    expect(mgr.npcFootstep('wren', 0, 0)).toBe(false);
    expect(backend.calls.every((c) => !c.startsWith('sfx:sfx-footstep'))).toBe(true);
  });

  it('chimes a thought, then debounces a close-succession burst', () => {
    expect(mgr.thought(0)).toBe(true);
    expect(backend.calls.some((c) => c === `sfx:sfx-thought@${THOUGHT_VOLUME}`)).toBe(true);
    expect(mgr.thought(50)).toBe(false);
    expect(mgr.thought(THOUGHT_COOLDOWN_MS + 1)).toBe(false); // burst refreshed the window
  });

  it('does not chime a thought while muted', () => {
    mgr.setMuted(true);
    expect(mgr.thought(0)).toBe(false);
    expect(backend.calls.every((c) => !c.startsWith('sfx:sfx-thought'))).toBe(true);
  });
});
