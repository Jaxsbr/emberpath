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
  // Warmed-NPC absolutes (US-99 — replaces the additive bonus from US-85).
  // When `npc_warmed_<id>` flips true, the target NPC's tier-1 light is
  // re-registered at these absolute values (any per-NPC `lightOverride` is
  // ignored — restoration is supposed to read uniformly bright). Floor per
  // spec: npcWarmedRadius ≥ 1.5 × npcRadius (60), npcWarmedIntensity ≥ 2 ×
  // npcIntensity (0.50). Committed values sit well above those floors so the
  // warmed bubble survives the global desaturation pipeline at a glance —
  // operator-calibrated against the in-engine smoke (briar-wilds US-99).
  npcWarmedRadius: 288,
  npcWarmedIntensity: 1.0,
  // Player ember overlay visual binding to warmth state (US-101). The 6 px
  // base Arc gets `setRadius(lerp(floor, full, warmth))` and `setAlpha(lerp(...))`
  // each frame. Floor values committed clearly visible (the ember NEVER
  // disappears — kid-safe design promise).
  playerEmberRadiusFloor: 4,
  playerEmberRadiusFull: 12,
  playerEmberAlphaFloor: 0.55,
  playerEmberAlphaFull: 1.0,
  // Lighting overlay player-light radius binding to warmth state (US-101).
  // Replaces the fixed playerRadiusPost when warmth state is active.
  // Floor > 0 so the world is never pitch black at WARMTH_FLOOR.
  playerLightRadiusFloor: 80,
  playerLightRadiusFull: 192,
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
