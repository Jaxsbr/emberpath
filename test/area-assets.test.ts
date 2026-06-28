import { describe, it, expect } from 'vitest';
import { computeAreaAssets } from '../src/systems/areaAssets';
import { getArea, getAllAreaIds } from '../src/data/areas/registry';
import { getNpcSpriteIds } from '../src/systems/npcSprites';
import { TILESETS } from '../src/maps/tilesets';
import { OBJECT_KINDS } from '../src/maps/objects';

// F6 — loading performance (#214), Phase 3: per-area lazy loading.
//
// FAILING-FIRST CONTRACT (Jaco #1324): on origin/main there is no areaAssets module
// — GameScene.preload loads EVERY area's tilesets, NPC sheets and portraits up front.
// These tests lock the per-area manifest's two non-negotiable properties:
//   (1) COMPLETENESS — the bundle must contain everything the area can draw, or a
//       transition would render a green-fallback tile / a missing NPC. This is the
//       safety property; it must never regress.
//   (2) SUBSET — at least one area must need strictly fewer NPC sheets than the full
//       roster, otherwise "per-area" bought us nothing. This is the point of P3.

describe('computeAreaAssets — completeness (never under-load)', () => {
  for (const areaId of getAllAreaIds()) {
    const area = getArea(areaId)!;
    const bundle = computeAreaAssets(area);

    it(`${areaId}: includes every placed NPC's sprite sheet`, () => {
      for (const npc of area.npcs ?? []) {
        expect(bundle.npcSpriteIds).toContain(npc.sprite);
      }
    });

    it(`${areaId}: includes the area's base + decorations tileset`, () => {
      expect(bundle.tilesetIds).toContain(area.tileset);
      if (area.decorationsTileset && TILESETS[area.decorationsTileset]) {
        expect(bundle.tilesetIds).toContain(area.decorationsTileset);
      }
    });

    it(`${areaId}: includes every placed object kind`, () => {
      for (const inst of area.objects ?? []) {
        if (inst.kind && OBJECT_KINDS[inst.kind]) {
          expect(bundle.objectKinds).toContain(inst.kind);
        }
      }
    });

    it(`${areaId}: every referenced id resolves in its registry`, () => {
      for (const id of bundle.tilesetIds) expect(TILESETS[id]).toBeDefined();
      for (const k of bundle.objectKinds) expect(OBJECT_KINDS[k]).toBeDefined();
    });
  }
});

describe('computeAreaAssets — subset (the win)', () => {
  it('at least one area needs fewer NPC sheets than the full roster', () => {
    const full = getNpcSpriteIds().length;
    const anySmaller = getAllAreaIds().some(
      (id) => computeAreaAssets(getArea(id)!).npcSpriteIds.length < full,
    );
    expect(anySmaller).toBe(true);
  });

  it('no single area pulls in the entire NPC roster on the default boot area', () => {
    const bundle = computeAreaAssets(getArea('ashen-isle')!);
    expect(bundle.npcSpriteIds.length).toBeLessThan(getNpcSpriteIds().length);
  });
});
