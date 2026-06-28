// Audio layer — public entry (F5, #200). Owns the single module-level AudioManager
// (one per page load, survives every scene restart), the asset manifest, and the
// browser-only mute persistence. Game code uses `getAudio()` and the small helpers
// here; it never constructs a manager or touches the backend directly.

import { AudioManager } from './audioManager';
import { WebAudioBackend } from './webAudioBackend';

export { AudioManager } from './audioManager';
export * from './audioModel';

// Key -> served URL (publicDir is `assets/`, so these resolve at site root).
export const AUDIO_MANIFEST: Record<string, string> = {
  // Soft storybook beds — one mood per map.
  'music-ashen-isle': 'sounds/music/ashen-isle.mp3',
  'music-fog-marsh': 'sounds/music/fog-marsh.mp3',
  'music-briar-wilds': 'sounds/music/briar-wilds.mp3',
  'music-heart-bridge': 'sounds/music/heart-bridge.mp3',
  // SFX.
  'sfx-footstep': 'sounds/sfx/footstep.mp3',
  'sfx-thought': 'sounds/sfx/thought.mp3',
  'sfx-scribble': 'sounds/sfx/scribble.mp3',
  'sfx-choice': 'sounds/sfx/choice.mp3',
  'sfx-first-meet': 'sounds/sfx/first-meet.mp3',
  'sfx-milestone': 'sounds/sfx/milestone.mp3',
  'sfx-complete': 'sounds/sfx/complete.mp3',
};

const MUTE_STORAGE_KEY = 'emberpath_audio_muted';

function loadMutePref(): boolean {
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMutePref(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore — a missing localStorage just means the pref doesn't persist */
  }
}

let manager: AudioManager | null = null;
let backend: WebAudioBackend | null = null;

/**
 * Build the audio singleton (idempotent). Call once at boot, before the first
 * scene. Kicks off asset decoding in the background; nothing blocks on it.
 */
export function initAudio(): AudioManager {
  if (manager) return manager;
  backend = new WebAudioBackend(AUDIO_MANIFEST);
  manager = new AudioManager(backend, { muted: loadMutePref() });
  // #214 P3: eager-decode only SFX; music beds lazy-load per area on setArea.
  void backend.preloadSfxOnly();
  return manager;
}

/** The live audio manager, or null if audio isn't initialised (e.g. SSR/tests). */
export function getAudio(): AudioManager | null {
  return manager;
}

/** Set + persist the mute pref and apply it to the live manager. Returns new state. */
export function setAudioMuted(muted: boolean): boolean {
  saveMutePref(muted);
  manager?.setMuted(muted);
  return muted;
}

/** Toggle + persist mute. Returns the new muted state. */
export function toggleAudioMuted(): boolean {
  const next = !(manager?.isMuted() ?? loadMutePref());
  return setAudioMuted(next);
}

/** Read the persisted mute pref (works before initAudio). */
export function isAudioMutedPref(): boolean {
  return manager?.isMuted() ?? loadMutePref();
}
