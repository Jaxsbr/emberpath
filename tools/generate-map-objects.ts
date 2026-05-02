/* eslint-disable no-console */
// PixelLab map-object generation printer (US-96).
// Defines OBJECT_PLAN — 18 entries covering Ashen Isle and Fog Marsh kinds —
// and prints each as an `mcp__pixellab__create_map_object` invocation block
// (personal account; the team server is maxed out — Learning EP-05).
//
// Run: `npx tsx tools/generate-map-objects.ts`
//
// The script does NOT fire calls (PixelLab MCP requires agent context). Each
// block carries:
//   • the description (subject, style note inline)
//   • the area context — selects the 32×32 sample patch path used as the
//     `background_image` for style matching: `/tmp/ashen-sample.png` for
//     Ashen Isle kinds, `/tmp/fog-marsh-sample.png` for Fog Marsh.
//   • standardised PixelLab settings (high top-down, selective outline,
//     medium shading, medium detail, image_size 32×32).
//   • the target output path under `assets/objects/<area>/<id>.png`.
//
// Sample patches are produced once before this script runs:
//   sips --cropOffset 32 16 --cropToHeightWidth 16 16 \
//     assets/tilesets/ashen-isle-grass-sand/tilemap.png --out /tmp/a.png
//   sips --resampleHeightWidth 32 32 /tmp/a.png --out /tmp/ashen-sample.png
//   (and similarly for fog-marsh-floor-path → /tmp/fog-marsh-sample.png)
//
// After every block the agent submits via `mcp__pixellab__create_map_object`,
// polls `mcp__pixellab__get_map_object` until "ready", and downloads the PNG
// to the printed path.

import { fileURLToPath } from 'node:url';
import path from 'node:path';

interface ObjectPlanEntry {
  kindId: string;
  area: 'ashen-isle' | 'fog-marsh';
  description: string;
  passable: boolean;
}

const OBJECT_PLAN: ObjectPlanEntry[] = [
  // Ashen Isle (10)
  { kindId: 'wall-stone',  area: 'ashen-isle', description: 'weathered umber stone wall section, sepia, top-down storybook pixel art', passable: false },
  { kindId: 'wall-front',  area: 'ashen-isle', description: 'weathered timber wall front of small storybook house, sepia, top-down', passable: false },
  { kindId: 'wall-roof',   area: 'ashen-isle', description: 'sepia roof segment with shingles, top-down view', passable: false },
  { kindId: 'door-wood',   area: 'ashen-isle', description: 'large wooden plank door filling most of the canvas, weathered umber sepia, top-down view', passable: false },
  { kindId: 'fence-rail',  area: 'ashen-isle', description: 'horizontal wooden plank fence panel, sepia, top-down', passable: false },
  { kindId: 'cliff-stone', area: 'ashen-isle', description: 'weathered grey stone block, top-down storybook, sepia palette', passable: false },
  { kindId: 'tree-pine',   area: 'ashen-isle', description: 'small pine tree with sepia-tinged needles, top-down storybook', passable: false },
  { kindId: 'bush',        area: 'ashen-isle', description: 'small green-brown bush cluster, top-down storybook', passable: true },
  { kindId: 'flower',      area: 'ashen-isle', description: 'small pale flower clump, top-down, sepia, no hope-gold', passable: true },
  { kindId: 'sign-wood',   area: 'ashen-isle', description: 'small wooden sign post, no text, top-down storybook', passable: true },

  // Fog Marsh (8)
  { kindId: 'wall-tomb',      area: 'fog-marsh', description: 'weathered umber stone tomb wall, top-down storybook', passable: false },
  { kindId: 'door-tomb',      area: 'fog-marsh', description: 'heavy stone slab door, weathered sepia, top-down', passable: false },
  { kindId: 'dead-tree',      area: 'fog-marsh', description: 'gnarled bare dead tree, sepia, top-down storybook', passable: false },
  { kindId: 'gravestone',     area: 'fog-marsh', description: 'small upright stone marker, weathered, top-down', passable: false },
  { kindId: 'marsh-stone',    area: 'fog-marsh', description: 'weathered marsh stone half-buried, top-down', passable: false },
  { kindId: 'dry-reed',       area: 'fog-marsh', description: 'dry sepia marsh reeds clump, top-down', passable: true },
  { kindId: 'mushroom',       area: 'fog-marsh', description: 'small marsh mushroom cluster, top-down', passable: true },
  { kindId: 'lantern-broken', area: 'fog-marsh', description: 'small extinguished iron lantern, dim sepia, top-down', passable: true },
];

const PIXELLAB_SETTINGS = {
  view: 'high top-down' as const,
  outline: 'selective outline' as const,
  shading: 'medium shading' as const,
  detail: 'medium detail' as const,
  image_size: { width: 32, height: 32 },
};

const SAMPLE_PATHS = {
  'ashen-isle': '/tmp/ashen-sample.png',
  'fog-marsh': '/tmp/fog-marsh-sample.png',
} as const;

interface InvocationBlock {
  index: number;
  total: number;
  entry: ObjectPlanEntry;
  outputPath: string;
  args: {
    description: string;
    image_size: { width: number; height: number };
    view: string;
    outline: string;
    shading: string;
    detail: string;
    background_image: { type: 'path'; path: string };
  };
}

function buildBlocks(): InvocationBlock[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..');
  return OBJECT_PLAN.map((entry, i) => ({
    index: i + 1,
    total: OBJECT_PLAN.length,
    entry,
    outputPath: path.join(repoRoot, 'assets', 'objects', entry.area, `${entry.kindId}.png`),
    args: {
      description: entry.description,
      image_size: PIXELLAB_SETTINGS.image_size,
      view: PIXELLAB_SETTINGS.view,
      outline: PIXELLAB_SETTINGS.outline,
      shading: PIXELLAB_SETTINGS.shading,
      detail: PIXELLAB_SETTINGS.detail,
      background_image: { type: 'path', path: SAMPLE_PATHS[entry.area] },
    },
  }));
}

function indent(text: string, prefix = '  '): string {
  return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function printBlock(block: InvocationBlock): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`OBJECT ${block.index}/${block.total} — ${block.entry.kindId}`);
  console.log(`  area: ${block.entry.area}  passable: ${block.entry.passable}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Output path: ${block.outputPath}`);
  console.log(`Background sample: ${block.args.background_image.path}`);
  console.log('Tool: mcp__pixellab__create_map_object  (personal — Learning EP-05)');
  console.log('Args (JSON):');
  console.log(indent(JSON.stringify(block.args, null, 2)));
  console.log();
}

function main(): void {
  const blocks = buildBlocks();
  console.log(`PixelLab map-object generation plan — ${blocks.length} objects.`);
  console.log(`Tier 1 cap: 8 concurrent jobs (fire in batches if needed).`);
  console.log();
  for (const block of blocks) printBlock(block);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Done. For each block:');
  console.log('  1. Submit via mcp__pixellab__create_map_object.');
  console.log('  2. Poll mcp__pixellab__get_map_object until status is "ready".');
  console.log('  3. Download via the printed download URL to the printed path.');
}

main();
