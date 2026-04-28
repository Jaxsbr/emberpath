// LIGHTING_CONFIG — single mutable object exposed for live tuning during dev.
// All distances in pixels unless noted. Author-facing — no user-input pathway
// writes here. Live-tunable via F4 (toggles enabled) and the F3 debug HUD
// (display only).
//
// Defaults chosen so the player sees ~3 tiles pre-Ember and ~6 tiles post-Ember
// (TILE_SIZE = 32). Changing these does not require code changes — implementers
// (US-75 onward) read from this object directly.
export const LIGHTING_CONFIG = {
  // Player light radius. Pre = before Ember Mark; Post = after.
  playerRadiusPre: 96,
  playerRadiusPost: 192,
  // Soft falloff distance — alpha fades from full clear to full dark over
  // `falloff` pixels beyond `radius`.
  playerFalloffPre: 32,
  playerFalloffPost: 48,
  // Per-POI defaults (Tier 1 — always rendered).
  poiRadius: 48,
  poiIntensity: 0.30,
  // Per-NPC defaults (Tier 1 — always rendered).
  npcRadius: 40,
  npcIntensity: 0.25,
  // Tier 2 lights — rendered at 0 intensity pre-Ember, full intensity post-Ember.
  tier2Radius: 56,
  tier2Intensity: 0.40,
  // Desaturation strength (US-76 reads this; US-74 only renders the dark overlay).
  // 0 = full color, 1 = full grey outside lit areas.
  desaturationStrength: 1.0,
  // Re-fog delay (ms) when the player exits a previously-lit region. 0 = instant
  // re-fog (the metaphor: no roguelike memory). Non-zero introduces a fade tail.
  refogDelayMs: 0,
  // Ember toggle transition (ms). 0 = instant radius/intensity change; non-zero
  // can ease the post-Ember reveal for theatrical effect (US-77).
  emberTransitionMs: 0,
  // Master switch. False = LightingSystem short-circuits in update() and renders
  // nothing; the world looks identical to the keeper-rescue baseline (Rule 4a
  // variant baseline check).
  enabled: true,
  // Fog wall flash on collision (US-79).
  fogFlashDurationMs: 250,
  fogFlashIntensity: 0.6,
  // Alpha-gating recheck threshold (US-77). Decoration alpha is re-evaluated
  // only when player has moved more than this many px since last evaluation.
  alphaGateRecheckPx: 8,
};
