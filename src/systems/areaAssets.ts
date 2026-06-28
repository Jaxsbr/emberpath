// #214 P3 — per-area asset manifest.
//
// emberpath used to load EVERY area's assets up front in GameScene.preload: all
// tilesets, all object kinds, all 7 NPC sprite sheets and all 7 painterly
// portraits — even though only one area is on screen. On a fresh boot that meant
// ~3.3 MB of portraits and ~2.7 MB of music for areas the player may never reach.
//
// This module computes the asset set a SINGLE area actually needs, derived from
// the same data the renderer reads, so the manifest can't silently drift from
// what gets drawn:
//   - tilesets: every registered Wang tileset that blends a terrain present in the
//     area (base grid OR a conditionalTerrain swap), plus the area's own default
//     and decorations atlas. This is a SUPERSET of what pickWangTilesetForCell can
//     return — deliberately, so an off-by-one in corner logic can never under-load
//     a tileset and leave a green fallback tile. The extra cost is at most a few
//     ~4 KB tileset PNGs.
//   - object kinds: exactly the kinds placed in area.objects.
//   - NPC sprite sheets: the sprites of the area's placed NPCs.
//   - portraits: every portraitId referenced anywhere in the area's dialogue or
//     story-scene data (deep-scanned, so it's robust to the dialogue tree shape).
//
// Phaser re-runs preload() on scene.restart(), and its loader skips already-cached
// keys, so loading per area + transitioning between areas needs no extra plumbing:
// each restart fetches only the destination area's not-yet-loaded assets.

import type { AreaDefinition } from '../data/areas/types';
import { TILESETS } from '../maps/tilesets';
import { OBJECT_KINDS } from '../maps/objects';
import { hasNpcSprite, hasNpcPortrait } from './npcSprites';

export interface AreaAssetBundle {
  /** Tileset ids whose atlas PNGs the area's terrain + decorations can reference. */
  tilesetIds: string[];
  /** Object-kind ids placed in the area. */
  objectKinds: string[];
  /** NPC sprite-sheet ids for the area's placed NPCs. */
  npcSpriteIds: string[];
  /** Portrait ids referenced by the area's dialogue / story scenes. */
  npcPortraitIds: string[];
}

// Every terrain id the area can show: base grid plus both sides of every
// conditionalTerrain swap (a flag flip can reveal e.g. marsh water).
function collectTerrainIds(area: AreaDefinition): Set<string> {
  const ids = new Set<string>();
  for (const row of area.terrain) {
    for (const t of row) ids.add(t);
  }
  for (const block of area.conditionalTerrain ?? []) {
    for (const v of block.vertices) {
      ids.add(v.whenTrue);
      ids.add(v.whenFalse);
    }
  }
  return ids;
}

// Deep-scan an arbitrary data tree for `portraitId` string values. Portraits are
// referenced from dialogue lines (and story scenes), not a flat NPC field, so a
// recursive walk is the drift-proof way to find them all.
function collectPortraitIds(area: AreaDefinition): string[] {
  const out = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'portraitId' && typeof value === 'string') {
        out.add(value);
      } else {
        visit(value);
      }
    }
  };
  visit(area.dialogues);
  visit(area.storyScenes);
  return [...out].filter(hasNpcPortrait);
}

export function computeAreaAssets(area: AreaDefinition): AreaAssetBundle {
  const terrains = collectTerrainIds(area);

  const tilesetIds = new Set<string>();
  if (TILESETS[area.tileset]) tilesetIds.add(area.tileset);
  if (area.decorationsTileset && TILESETS[area.decorationsTileset]) {
    tilesetIds.add(area.decorationsTileset);
  }
  for (const [id, def] of Object.entries(TILESETS)) {
    const blendsAPresentTerrain =
      terrains.has(def.wang.primaryTerrain) ||
      (def.wang.secondaryTerrain !== null && terrains.has(def.wang.secondaryTerrain));
    if (blendsAPresentTerrain) tilesetIds.add(id);
  }

  const objectKinds = new Set<string>();
  for (const inst of area.objects ?? []) {
    if (inst.kind && OBJECT_KINDS[inst.kind]) objectKinds.add(inst.kind);
  }

  const npcSpriteIds = new Set<string>();
  for (const npc of area.npcs ?? []) {
    if (hasNpcSprite(npc.sprite)) npcSpriteIds.add(npc.sprite);
  }

  return {
    tilesetIds: [...tilesetIds],
    objectKinds: [...objectKinds],
    npcSpriteIds: [...npcSpriteIds],
    npcPortraitIds: collectPortraitIds(area),
  };
}
