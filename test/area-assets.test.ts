import { describe, it, expect } from 'vitest';
import {
  computeAreaAssets,
  selectPrefetchTargets,
  type PrefetchExit,
} from '../src/systems/areaAssets';
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

// #214 P4 — idle prefetch. selectPrefetchTargets is the pure decision: which
// neighbouring areas to warm given where Pip stands and which exits she can take.
// GameScene acts on the returned ids (queueAreaAssets + load.start). These lock the
// proximity gate, the condition gate, and the de-dup so prefetch never thrashes.

describe('selectPrefetchTargets', () => {
  const exit = (over: Partial<PrefetchExit> = {}): PrefetchExit => ({
    col: 10, row: 10, width: 2, height: 2, destinationAreaId: 'briar-wilds', ...over,
  });
  const base = {
    rangeTiles: 4,
    currentAreaId: 'ashen-isle',
    alreadyPrefetched: new Set<string>(),
    canUseExit: () => true,
  };

  it('warms a destination when Pip is within range of its exit', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 11, exits: [exit()],
    });
    expect(out).toEqual(['briar-wilds']);
  });

  it('does NOT warm an exit Pip is too far from', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 50, playerRow: 50, exits: [exit()],
    });
    expect(out).toEqual([]);
  });

  it('measures distance to the exit RECT, not its corner (clamped point)', () => {
    // directly below the rect, 3 tiles past its bottom edge (row 12) → within range 4
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 15, exits: [exit()],
    });
    expect(out).toEqual(['briar-wilds']);
  });

  it('skips an exit whose condition gate is closed', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 11,
      exits: [exit({ condition: 'has_ember_mark == true' })],
      canUseExit: (e) => !e.condition, // condition present → closed
    });
    expect(out).toEqual([]);
  });

  it('never warms the area Pip is already in', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 11,
      exits: [exit({ destinationAreaId: 'ashen-isle' })],
    });
    expect(out).toEqual([]);
  });

  it('skips destinations already prefetched this session', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 11, exits: [exit()],
      alreadyPrefetched: new Set(['briar-wilds']),
    });
    expect(out).toEqual([]);
  });

  it('de-dups when two in-range exits target the same area (first-seen, once)', () => {
    const out = selectPrefetchTargets({
      ...base, playerCol: 11, playerRow: 11,
      exits: [exit(), exit({ col: 9, row: 9 })],
    });
    expect(out).toEqual(['briar-wilds']);
  });
});
