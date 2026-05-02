/* eslint-disable no-console */
// PixelLab Wang tileset generation printer (US-95).
// Defines TILESET_PLAN — 5 ordered (lower, upper, transition) entries covering
// the Ashen Isle and Fog Marsh terrain pairs — and prints each one as an
// `mcp__pixellab__create_topdown_tileset` invocation block (personal account;
// the `mcp__pixellab-team__` server is maxed out — Learning EP-05). The script
// does NOT fire the calls (PixelLab MCP tool calls require an agent context;
// Node cannot fire them — same printer pattern as tools/generate-scene-art.ts
// from US-91).
//
// Run: `npx tsx tools/generate-tilesets.ts`
//
// Each block carries:
//   • the composed prompts (lower / upper / transition) — STYLE_VIBE_PROMPT
//     and the anti-pattern list ride every prompt via composeArtPrompt.
//   • the standardised PixelLab settings (high top-down, selective outline,
//     basic shading, medium detail, 16×16 tile size).
//   • the chain dependency — `chainFrom` names a prior plan id whose lower or
//     upper base tile the agent should pass as `lower_base_tile_id` /
//     `upper_base_tile_id` when submitting (the agent retrieves the tile id
//     via `mcp__pixellab-team__get_topdown_tileset` after the prior call
//     completes).
//   • the target output path under `<repo>/assets/tilesets/<id>/`.
//
// After every block, the agent submits, waits ~100s, retrieves via
// get_topdown_tileset, downloads the PNG to the printed path, writes the
// metadata JSON, then continues. Hope-gold is explicitly negative-prompted
// in the mood block of every entry — gold is reserved for narrative beats per
// docs/art-style.md § Palette.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STYLE_VIBE_PROMPT, composeArtPrompt } from '../src/art/styleGuide';

interface TilesetPlanEntry {
  id: string; // assets/tilesets/<id>/ directory + TILESETS registry key
  area: 'ashen-isle' | 'fog-marsh';
  lowerTerrain: string;
  upperTerrain: string;
  lowerSubject: string;
  upperSubject: string;
  transitionDescription: string;
  transitionSize: 0 | 0.25 | 0.5 | 1.0;
  // Optional chain dependency. The agent retrieves the named plan entry's
  // tile ids via get_topdown_tileset and supplies them as
  // lower_base_tile_id / upper_base_tile_id on submission.
  chainFromLowerOf?: string;
  chainFromUpperOf?: string;
}

const TILESET_PLAN: TilesetPlanEntry[] = [
  // Ashen Isle chain — sepia-first, hope-gold absent
  {
    id: 'ashen-isle-grass-sand',
    area: 'ashen-isle',
    lowerTerrain: 'grass',
    upperTerrain: 'sand',
    lowerSubject: 'weathered sepia grass with scattered single-pixel weeds',
    upperSubject: 'pale dry sand with faint stippled grain',
    transitionDescription: 'dry sepia weeds and stray pebbles',
    transitionSize: 0.25,
  },
  {
    id: 'ashen-isle-sand-path',
    area: 'ashen-isle',
    lowerTerrain: 'sand',
    upperTerrain: 'path',
    lowerSubject: 'pale dry sand with faint stippled grain',
    upperSubject: 'compacted sepia path of small flat stones',
    transitionDescription: 'compacted sepia stones',
    transitionSize: 0.25,
    chainFromUpperOf: 'ashen-isle-grass-sand', // sand base tile carries forward
  },
  // Fog Marsh chain — wet sepia mire, three uppers branching off marsh-floor
  {
    id: 'fog-marsh-floor-path',
    area: 'fog-marsh',
    lowerTerrain: 'marsh-floor',
    upperTerrain: 'path',
    lowerSubject: 'wet sepia mire with mottled umber pooling',
    upperSubject: 'raised wooden plank walkway with knotted grain',
    transitionDescription: 'raised wooden planks at edge',
    transitionSize: 0.5,
  },
  {
    id: 'fog-marsh-floor-water',
    area: 'fog-marsh',
    lowerTerrain: 'marsh-floor',
    upperTerrain: 'water',
    lowerSubject: 'wet sepia mire with mottled umber pooling',
    upperSubject: 'murky standing water in deep umber and slate',
    transitionDescription: 'murky reed shallows',
    transitionSize: 0.5,
    chainFromLowerOf: 'fog-marsh-floor-path',
  },
  {
    id: 'fog-marsh-floor-stone',
    area: 'fog-marsh',
    lowerTerrain: 'marsh-floor',
    upperTerrain: 'stone',
    lowerSubject: 'wet sepia mire with mottled umber pooling',
    upperSubject: 'weathered umber stone slabs with crumbling edges',
    transitionDescription: 'weathered umber rubble',
    transitionSize: 0.25,
    chainFromLowerOf: 'fog-marsh-floor-path',
  },
];

const PIXELLAB_SETTINGS = {
  view: 'high top-down' as const,
  outline: 'selective outline' as const,
  shading: 'basic shading' as const,
  detail: 'medium detail' as const,
  tile_size: { width: 16, height: 16 },
} as const;

// Hope-gold negative-prompt mood — appended to every entry's mood block via
// composeArtPrompt so STYLE_VIBE_PROMPT + the anti-pattern guidance both ride
// each call (Learning EP-03: prompt-borne anti-patterns are mechanically
// enforced, not hoped for).
const HOPE_GOLD_NEGATIVE = 'sepia-first palette; no hope-gold accents on terrain (#F2C95B / #E89C2A explicitly excluded); gold is reserved for narrative beats only';

interface InvocationBlock {
  index: number;
  total: number;
  entry: TilesetPlanEntry;
  outputPngPath: string;
  outputJsonPath: string;
  composedLowerDescription: string;
  composedUpperDescription: string;
  composedTransitionDescription: string;
  args: {
    lower_description: string;
    upper_description: string;
    transition_description: string;
    transition_size: number;
    view: string;
    outline: string;
    shading: string;
    detail: string;
    tile_size: { width: number; height: number };
    lower_base_tile_id?: string;
    upper_base_tile_id?: string;
  };
  chainNote: string | null;
}

function buildBlocks(): InvocationBlock[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..');
  const blocks: InvocationBlock[] = [];

  TILESET_PLAN.forEach((entry, i) => {
    const composedLower = composeArtPrompt(entry.lowerSubject, HOPE_GOLD_NEGATIVE);
    const composedUpper = composeArtPrompt(entry.upperSubject, HOPE_GOLD_NEGATIVE);
    const composedTransition = composeArtPrompt(entry.transitionDescription, HOPE_GOLD_NEGATIVE);
    const dir = path.join(repoRoot, 'assets', 'tilesets', entry.id);
    let chainNote: string | null = null;
    if (entry.chainFromLowerOf) {
      chainNote = `Pass the LOWER base tile id of '${entry.chainFromLowerOf}' (returned by mcp__pixellab-team__get_topdown_tileset) as 'lower_base_tile_id'.`;
    } else if (entry.chainFromUpperOf) {
      chainNote = `Pass the UPPER base tile id of '${entry.chainFromUpperOf}' (returned by mcp__pixellab-team__get_topdown_tileset) as 'lower_base_tile_id'.`;
    }
    blocks.push({
      index: i + 1,
      total: TILESET_PLAN.length,
      entry,
      outputPngPath: path.join(dir, 'tilemap.png'),
      outputJsonPath: path.join(dir, 'tilemap.json'),
      composedLowerDescription: composedLower,
      composedUpperDescription: composedUpper,
      composedTransitionDescription: composedTransition,
      args: {
        lower_description: composedLower,
        upper_description: composedUpper,
        transition_description: composedTransition,
        transition_size: entry.transitionSize,
        view: PIXELLAB_SETTINGS.view,
        outline: PIXELLAB_SETTINGS.outline,
        shading: PIXELLAB_SETTINGS.shading,
        detail: PIXELLAB_SETTINGS.detail,
        tile_size: PIXELLAB_SETTINGS.tile_size,
      },
      chainNote,
    });
  });

  return blocks;
}

function indent(text: string, prefix = '  '): string {
  return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function printBlock(block: InvocationBlock): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`TILESET ${block.index}/${block.total} — ${block.entry.id}`);
  console.log(`  area: ${block.entry.area}  ${block.entry.lowerTerrain} → ${block.entry.upperTerrain}  transition_size=${block.entry.transitionSize}`);
  console.log('───────────────────────────────────────────────────────────────');
  if (block.chainNote) {
    console.log('Chain dependency:');
    console.log(`  ${block.chainNote}`);
  }
  console.log('Output paths:');
  console.log(`  PNG:  ${block.outputPngPath}`);
  console.log(`  JSON: ${block.outputJsonPath}`);
  console.log('Composed lower_description:');
  console.log(indent(block.composedLowerDescription));
  console.log('Composed upper_description:');
  console.log(indent(block.composedUpperDescription));
  console.log('Composed transition_description:');
  console.log(indent(block.composedTransitionDescription));
  console.log('Tool: mcp__pixellab__create_topdown_tileset  (personal server — Learning EP-05)');
  console.log('Args (JSON):');
  console.log(indent(JSON.stringify(block.args, null, 2)));
  console.log();
}

function main(): void {
  const blocks = buildBlocks();
  console.log(`PixelLab Wang tileset generation plan — ${blocks.length} entries.`);
  console.log(`Style vibe: ${STYLE_VIBE_PROMPT.split('\n')[0]}…`);
  console.log(`Hope-gold negative prompt: ${HOPE_GOLD_NEGATIVE}`);
  console.log();
  for (const block of blocks) printBlock(block);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Done. For each block:');
  console.log('  1. Submit via mcp__pixellab__create_topdown_tileset (personal — NOT pixellab-team; Learning EP-05).');
  console.log('  2. Poll mcp__pixellab__get_topdown_tileset until status is "completed".');
  console.log('  3. Download the resulting tilemap.png + tilemap.json to the printed paths.');
  console.log('  4. Generate a labelled-atlas preview PNG via src/maps/atlasPreview.ts and inspect.');
  console.log('  5. Verify sepia-first read + hope-gold absence + Wang corner correctness.');
  console.log('  6. Wire the new tilesetId + atlas key into src/maps/tilesets.ts TILESETS registry.');
}

main();
