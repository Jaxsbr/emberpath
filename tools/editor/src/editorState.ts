// Editor state — mutable working copy of the active area's terrain + objects
// (US-97). The editor never auto-writes to disk; the operator clicks "Export
// TypeScript" to serialize the working copy back into a code block they paste
// into `data/areas/<id>.ts`.

import type { AreaDefinition } from '@game/data/areas/types';
import type { TerrainId } from '@game/maps/terrain';
import type { ObjectKindId, ObjectInstance } from '@game/maps/objects';

export type EditorMode = 'cell' | 'vertex' | 'object' | 'inspect';

export interface EditorState {
  mode: EditorMode;
  activeTerrain: TerrainId;
  activeObjectKind: ObjectKindId;
  // Show conditional decorations + objects in their alternate (when-true)
  // state instead of the default. Mirrors what the player sees mid-flag-flip.
  showConditionalAlternate: boolean;
  // Render a thin red outline on every impassable object so authors see
  // collision contributors at a glance. Off by default (US-97 spec).
  showImpassableOutlines: boolean;
  // Working copies — cloned from the loaded AreaDefinition on area switch.
  // Edits target these copies, not the source AreaDefinition.
  terrain: TerrainId[][];
  objects: ObjectInstance[];
}

let state: EditorState = {
  mode: 'cell',
  activeTerrain: 'grass',
  activeObjectKind: 'tree-pine',
  showConditionalAlternate: false,
  showImpassableOutlines: false,
  terrain: [],
  objects: [],
};

const subscribers = new Set<() => void>();

export function getState(): EditorState {
  return state;
}

export function subscribe(fn: () => void): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify(): void {
  for (const fn of subscribers) fn();
}

// Reset the working copy from the just-loaded area. Deep-clones terrain so
// edits don't leak back into the imported AreaDefinition; clones objects
// shallowly (each entry is a value type with primitive fields).
export function loadAreaIntoState(area: AreaDefinition): void {
  state.terrain = area.terrain.map((row) => row.slice());
  state.objects = area.objects.map((o) => ({ ...o }));
  notify();
}

export function setMode(mode: EditorMode): void {
  state.mode = mode;
  notify();
}

export function setActiveTerrain(t: TerrainId): void {
  state.activeTerrain = t;
  notify();
}

export function setActiveObjectKind(k: ObjectKindId): void {
  state.activeObjectKind = k;
  notify();
}

export function setShowConditionalAlternate(v: boolean): void {
  state.showConditionalAlternate = v;
  notify();
}

export function setShowImpassableOutlines(v: boolean): void {
  state.showImpassableOutlines = v;
  notify();
}

// ───── Terrain edits ─────

// Cell-paint: set all 4 vertices of a cell to the active terrain.
export function paintCell(col: number, row: number): void {
  const t = state.activeTerrain;
  const grid = state.terrain;
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (row < 0 || row + 1 >= rows || col < 0 || col + 1 >= cols) return;
  grid[row][col] = t;
  grid[row][col + 1] = t;
  grid[row + 1][col] = t;
  grid[row + 1][col + 1] = t;
  notify();
}

// Vertex-paint: set a single vertex to the active terrain.
export function paintVertex(vCol: number, vRow: number): void {
  const grid = state.terrain;
  if (vRow < 0 || vRow >= grid.length || vCol < 0 || vCol >= grid[0].length) return;
  grid[vRow][vCol] = state.activeTerrain;
  notify();
}

// ───── Object edits ─────

export function placeObject(col: number, row: number): void {
  // Replace any existing object at the cell with the active kind.
  state.objects = state.objects.filter((o) => !(o.col === col && o.row === row));
  state.objects.push({ kind: state.activeObjectKind, col, row });
  notify();
}

export function removeObject(col: number, row: number): void {
  const before = state.objects.length;
  state.objects = state.objects.filter((o) => !(o.col === col && o.row === row));
  if (state.objects.length !== before) notify();
}

export function objectAtCell(col: number, row: number): ObjectInstance | undefined {
  return state.objects.find((o) => o.col === col && o.row === row);
}
