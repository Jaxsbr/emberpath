// FB-23 (shadows) — character kind registry for shadow authoring (Pip + every
// NPC). Static OBJECTS get their authored shadow from object-shapes.json keyed by
// ObjectKindId; CHARACTERS are a separate family (they move + animate, so their
// shadow is centred on the live sprite centre, not a grid cell) and get theirs
// from character-shapes.json keyed by the character kind id below.
//
// A "character kind" = the player (`pip`) or an NPC SPRITE id (the same id NPCs
// reference via `npc.sprite`, e.g. `wren`). Shadows are per sprite kind, not per
// NPC instance — every wren shares one authored shadow. The renderer
// (GameScene) reads getCharacterShadow(kind); when null it keeps the FB-21
// feet-ellipse default so an unauthored character never regresses.

import type { ShadowShape } from './shadows';
import { getNpcSpriteIds } from '../systems/npcSprites';
import characterShapesRaw from '../data/character-shapes.json';

export const PLAYER_CHARACTER_ID = 'pip';

// The texture key showing each kind's idle-south frame — what the editor renders
// under the draggable shadow shape.
export function characterTextureKey(kind: string): string {
  return kind === PLAYER_CHARACTER_ID
    ? 'fox-pip-idle-south-0'
    : `npc-${kind}-idle-south-0`;
}

// Every authorable character kind: the player plus all NPC sprite ids. Drives the
// editor's kind dropdown.
export function getCharacterKindIds(): string[] {
  return [PLAYER_CHARACTER_ID, ...getNpcSpriteIds()];
}

export function isCharacterKind(kind: string): boolean {
  return kind === PLAYER_CHARACTER_ID || getNpcSpriteIds().includes(kind);
}

interface CharacterShapeEntry {
  shadow?: ShadowShape;
}

// Authored shapes, committed game data (written by the character shadow editor's
// save endpoint). The `_doc` key documents the format and is ignored here.
const AUTHORED = characterShapesRaw as unknown as Record<string, CharacterShapeEntry>;

// Authored shadow for a character kind, or null when none — the caller then uses
// its own FB-21 default so migration is one-kind-at-a-time with no regression.
export function getCharacterShadow(kind: string): ShadowShape | null {
  const entry = AUTHORED[kind];
  return entry && entry.shadow ? entry.shadow : null;
}
