// Aesthetic codex — single source of truth for the project's visual identity.
// Mirrors docs/art-style.md (Joe Sutphin's Little Pilgrim's Progress storybook).
// Phaser-free so Node-side tooling (tools/generate-scene-art.ts) can import.

export const STYLE_PALETTE = {
  creamLight: '#F2EAD6',
  creamMid: '#E5D9BD',
  sepiaLight: '#B89972',
  sepiaDark: '#8C7256',
  umberLight: '#5A4636',
  umberDark: '#3A2C20',
  inkBlack: '#1F1813',
  hopeGoldLight: '#F2C95B',
  hopeGoldDeep: '#E89C2A',
  mossyGreen: '#7A8A55',
  slateBlue: '#5A6B78',
  burntSienna: '#A8543A',
} as const;

export type StylePaletteRole = keyof typeof STYLE_PALETTE;

export const STYLE_VIBE_PROMPT =
  'Anthropomorphic pilgrims in a graphite-and-sepia storybook world, where gold light is the only thing brave enough to be in color.';

export const STYLE_BASE_PROMPT = `${STYLE_VIBE_PROMPT}

Palette: page cream (${STYLE_PALETTE.creamLight} / ${STYLE_PALETTE.creamMid}), sepia mid (${STYLE_PALETTE.sepiaLight} / ${STYLE_PALETTE.sepiaDark}), umber shadow (${STYLE_PALETTE.umberLight} / ${STYLE_PALETTE.umberDark}), ink near-black (${STYLE_PALETTE.inkBlack}). Hope-gold (${STYLE_PALETTE.hopeGoldLight} / ${STYLE_PALETTE.hopeGoldDeep}) is reserved for narrative beats — celestial light, lanterns, ember glow. Mossy green (${STYLE_PALETTE.mossyGreen}), slate blue (${STYLE_PALETTE.slateBlue}), and burnt sienna (${STYLE_PALETTE.burntSienna}) appear as rare accents only.

Line: outlines in deep umber ${STYLE_PALETTE.umberDark}, never pure black; vary line weight; let lines break and breathe. Selective outlining — exterior silhouettes are lined, interior detail is rendered with shading rather than line.

Dither: clustered or Bayer dither in shadow ramps to mimic graphite cross-hatching. Steppy ramps plus dither, never smooth gradients. Low-opacity paper-grain overlay sells the storybook feel.

Lighting: one warm key (lantern, window, sunbeam) plus cool grey ambient. Chiaroscuro is the mood. Hope-gold blooms slightly into surrounding pixels. A frame must read in sepia first, then color second — composition holds when chroma is removed.

Avoid: pure-black outlines, neon saturation, hard cel-shaded blocks; chibi proportions or anime sparkle eyes; glossy or metallic armor; clean vector tiles with no texture; high-frequency 8-bit "crunch" — this is painted pixel, not NES pixel.`;

/**
 * Compose a generation-ready prompt by joining the project's base style prompt
 * with the per-asset subject and optional mood. Deterministic — order is
 * fixed and a single trailing newline is appended.
 */
export function composeArtPrompt(subject: string, mood?: string): string {
  const moodSegment = mood ? `\n\nMood: ${mood}` : '';
  return `${STYLE_BASE_PROMPT}\n\nSubject: ${subject}${moodSegment}\n`;
}
