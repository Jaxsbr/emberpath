/* eslint-disable no-console */
// Scene-art generation printer (US-91).
// Walks the SCENE_ASSETS manifest, composes each beat's prompt through the
// project's aesthetic codex (composeArtPrompt + STYLE_VIBE_PROMPT), and prints
// the exact `mcp__pixellab__create_object` invocation an agent should fire
// (PixelLab MCP tool calls require an agent context — Node cannot fire them).
//
// Run: `npx tsx tools/generate-scene-art.ts`
//
// Output is a sequence of "BEAT N/9" blocks, each containing:
//   • the composed prompt (style-guide + subject + mood, deterministic)
//   • the target output path (under <repo>/assets/scenes/<sceneId>/beat-<n>.png)
//   • the JSON arguments to pass to mcp__pixellab__create_object
//
// The agent then submits each invocation, waits for the job to land, and
// downloads the resulting PNG to the printed path.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SCENE_ASSETS } from '../src/art/sceneAssets';
import { STYLE_VIBE_PROMPT, composeArtPrompt } from '../src/art/styleGuide';

// Single source of truth for the planned generation count this phase.
// Equals Object.values(SCENE_ASSETS).flat().length when only static beats
// are present (current state per the cost-mapping table — 9 static beats).
const PLANNED_GENERATION_COUNT = 9;

interface InvocationBlock {
  index: number;
  total: number;
  sceneId: string;
  beatIndex: number;
  outputPath: string;
  composedPrompt: string;
  args: {
    description: string;
    directions: 1;
    n_frames: 1;
    size: 256;
    view: 'side';
  };
}

function buildBlocks(): InvocationBlock[] {
  const blocks: InvocationBlock[] = [];
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..');

  let counter = 0;
  for (const [sceneId, beats] of Object.entries(SCENE_ASSETS)) {
    beats.forEach((beat, beatIndex) => {
      if (beat.kind !== 'static') return; // only static beats this phase
      counter++;
      const composed = composeArtPrompt(beat.prompt, beat.mood);
      const outputPath = path.join(repoRoot, 'assets', beat.file);
      blocks.push({
        index: counter,
        total: PLANNED_GENERATION_COUNT,
        sceneId,
        beatIndex,
        outputPath,
        composedPrompt: composed,
        args: {
          description: composed,
          directions: 1,
          n_frames: 1,
          size: 256,
          view: 'side',
        },
      });
    });
  }
  return blocks;
}

function printBlock(block: InvocationBlock): void {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`BEAT ${block.index}/${block.total} — ${block.sceneId} beat ${block.beatIndex}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log('Output path:');
  console.log(`  ${block.outputPath}`);
  console.log('Composed prompt:');
  console.log(block.composedPrompt
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n'));
  console.log('Tool: mcp__pixellab__create_object');
  console.log('Args (JSON):');
  console.log(JSON.stringify(block.args, null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n'));
  console.log();
}

function main(): void {
  const blocks = buildBlocks();
  if (blocks.length !== PLANNED_GENERATION_COUNT) {
    console.error(
      `FATAL: expected ${PLANNED_GENERATION_COUNT} static beats but manifest has ${blocks.length}.`,
    );
    process.exit(1);
  }
  console.log(`PixelLab scene-art generation plan — ${blocks.length} static beats.`);
  console.log(`Style vibe: ${STYLE_VIBE_PROMPT}`);
  console.log();
  for (const block of blocks) printBlock(block);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Done. Submit each block above via the pixellab MCP, then save the resulting PNG to the printed Output path.`);
}

main();
