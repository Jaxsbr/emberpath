/* eslint-disable no-console */
// One-shot script — parses the 5 PixelLab tilemap.json files under
// assets/tilesets/<id>/ and prints a TypeScript snippet for each tileset's
// `cornerMaskTable`. The agent pastes the snippets into src/maps/tilesets.ts
// to wire the new PixelLab Wang tilesets into TILESETS.
//
// Convention: PixelLab corners are {NE, NW, SE, SW}; our internal Wang mask
// is bit3=TL=NW, bit2=TR=NE, bit1=BR=SE, bit0=BL=SW. '1' = upper / secondary.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLANS = [
  { id: 'ashen-isle-grass-sand', primary: 'grass', secondary: 'sand' },
  { id: 'ashen-isle-sand-path', primary: 'sand', secondary: 'path' },
  { id: 'fog-marsh-floor-path', primary: 'marsh-floor', secondary: 'path' },
  { id: 'fog-marsh-floor-water', primary: 'marsh-floor', secondary: 'water' },
  { id: 'fog-marsh-floor-stone', primary: 'marsh-floor', secondary: 'stone' },
];

interface Tile {
  id: string;
  corners: { NE: 'lower' | 'upper'; NW: 'lower' | 'upper'; SE: 'lower' | 'upper'; SW: 'lower' | 'upper' };
  bounding_box: { x: number; y: number; width: number; height: number };
}

function maskFor(corners: Tile['corners']): string {
  const bit = (v: string) => (v === 'upper' ? '1' : '0');
  return bit(corners.NW) + bit(corners.NE) + bit(corners.SE) + bit(corners.SW);
}

function frameIndex(b: Tile['bounding_box']): string {
  const cols = 4;
  const tileSize = 16;
  return String(Math.floor(b.y / tileSize) * cols + Math.floor(b.x / tileSize));
}

function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '..');

  for (const plan of PLANS) {
    const jsonPath = path.join(repoRoot, 'assets', 'tilesets', plan.id, 'tilemap.json');
    const meta = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const tiles: Tile[] = meta.tileset_data.tiles;
    const cornerMaskTable: Record<string, string[]> = {};
    for (const t of tiles) {
      const mask = maskFor(t.corners);
      const frame = frameIndex(t.bounding_box);
      if (!cornerMaskTable[mask]) cornerMaskTable[mask] = [];
      cornerMaskTable[mask].push(frame);
    }
    const fallback = cornerMaskTable['0000'] ?? Object.values(cornerMaskTable)[0];
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`'${plan.id}': {`);
    console.log(`  atlasKey: 'tileset-${plan.id}',`);
    console.log(`  wang: {`);
    console.log(`    primaryTerrain: '${plan.primary}',`);
    console.log(`    secondaryTerrain: '${plan.secondary}',`);
    console.log(`    cornerMaskTable: {`);
    const masks = Object.keys(cornerMaskTable).sort();
    for (const m of masks) {
      console.log(`      '${m}': [${cornerMaskTable[m].map((f) => `'${f}'`).join(', ')}],`);
    }
    console.log(`    },`);
    console.log(`    fallbackFrames: [${fallback.map((f: string) => `'${f}'`).join(', ')}],`);
    console.log(`  },`);
    console.log(`},`);
  }
}

main();
