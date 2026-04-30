// Map editor renderer (US-97). Reads area.terrain (vertex grid) + area.objects
// (sparse list) under the tile-architecture model and draws them via the same
// Wang resolver the game uses (`@game/maps/wang.ts`). Adds:
//   • cell-paint mode (default click): sets all 4 vertices of a cell.
//   • vertex-paint mode (Shift-click): sets the nearest vertex.
//   • object placer mode (Alt-click): drops the active ObjectKindId.
//   • right-click on an object: removes it.
//   • detail panel: shows 4 vertex terrains + Wang mask + picked frame for
//     the cell + any object instance at that cell.
//
// Imports route through the `@game/...` path alias to avoid local
// redeclaration of `TerrainDefinition`, `ObjectKindDefinition`, and the
// resolver — same registries the game uses, single source of truth.

import type { AreaDefinition } from '@game/data/areas/types';
import { resolveWangFrame } from '@game/maps/wang';
import { TERRAINS, type TerrainId } from '@game/maps/terrain';
import { OBJECT_KINDS, type ObjectInstance } from '@game/maps/objects';
import { TILESETS } from '@game/maps/tilesets';
import { evaluateCondition } from '@game/systems/conditions';
import { showDetail } from './main';
import {
  getState,
  loadAreaIntoState,
  paintCell,
  paintVertex,
  placeObject,
  removeObject,
  objectAtCell,
  subscribe,
} from './editorState';

const CELL = 16; // pixels per tile in the editor
const LABEL_MARGIN = 24;
const TRIGGER_ALPHA = 0.35;
const PIXELLAB_ATLAS_GRID_COLS = 4;
const PIXELLAB_FRAME_SIZE = 16;
const KENNEY_ATLAS_GRID_COLS = 12;
const KENNEY_FRAME_SIZE = 16;
// Object PNGs are 32×32; rendered at CELL=16 in the editor (downscaled 2:1).
const OBJECT_DRAW_SIZE = CELL;

const TRIGGER_COLORS: Record<string, string> = {
  thought: '#4488ff',
  story: '#ff44ff',
  dialogue: '#44ff88',
  exit: '#ffaa44',
};

// ───── Atlas + object-image cache ─────

const tilesetAtlases: Record<string, HTMLImageElement> = {};
const objectImages: Record<string, HTMLImageElement> = {};
let lastRender: { container: HTMLElement; area: AreaDefinition } | null = null;

function loadTilesetAtlas(tilesetId: string): void {
  if (tilesetAtlases[tilesetId]) return;
  const img = new Image();
  img.onload = () => {
    if (lastRender) renderMap(lastRender.container, lastRender.area);
  };
  img.src = `/tilesets/${tilesetId}/tilemap.png`;
  tilesetAtlases[tilesetId] = img;
}

function loadObjectImage(kindId: string, assetPath: string): void {
  if (objectImages[kindId]) return;
  const img = new Image();
  img.onload = () => {
    if (lastRender) renderMap(lastRender.container, lastRender.area);
  };
  img.src = `/${assetPath}`;
  objectImages[kindId] = img;
}

// Pre-load every registered atlas + object on module init so the editor has
// them all by the time the first render runs.
for (const id of Object.keys(TILESETS)) loadTilesetAtlas(id);
for (const def of Object.values(OBJECT_KINDS)) loadObjectImage(def.id, def.assetPath);

// ───── Render ─────

interface Clickable {
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
}
let clickables: Clickable[] = [];

function hexToCSS(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

// The game's `area.tileset` names a single Wang tileset (e.g. 'ashen-isle-
// grass-sand'). PixelLab tilesets ship as 4×4 frame grids; Kenney degenerate
// tilesets are 12×11 atlases. Differentiate via the wang.secondaryTerrain —
// PixelLab tilesets register a non-null secondary; Kenney degenerate ones
// register null.
function atlasGridForTileset(tilesetId: string): { cols: number; frameSize: number } {
  const def = TILESETS[tilesetId];
  if (def && def.wang.secondaryTerrain !== null) {
    return { cols: PIXELLAB_ATLAS_GRID_COLS, frameSize: PIXELLAB_FRAME_SIZE };
  }
  return { cols: KENNEY_ATLAS_GRID_COLS, frameSize: KENNEY_FRAME_SIZE };
}

function drawTerrain(
  ctx: CanvasRenderingContext2D,
  area: AreaDefinition,
  terrain: TerrainId[][],
): void {
  const tilesetId = area.tileset;
  const atlasImg = tilesetAtlases[tilesetId];
  const atlasReady = atlasImg && atlasImg.complete && atlasImg.naturalWidth > 0;
  const grid = atlasGridForTileset(tilesetId);

  for (let row = 0; row < area.mapRows; row++) {
    for (let col = 0; col < area.mapCols; col++) {
      // Fall back to flat colour if terrain is undefined (working copy
      // shorter than mapRows/mapCols, defensive).
      const tl = terrain[row]?.[col];
      const tr = terrain[row]?.[col + 1];
      const br = terrain[row + 1]?.[col + 1];
      const bl = terrain[row + 1]?.[col];
      if (!tl || !tr || !br || !bl) continue;

      const dx = LABEL_MARGIN + col * CELL;
      const dy = LABEL_MARGIN + row * CELL;

      if (atlasReady) {
        const frame = resolveWangFrame(tilesetId, [tl, tr, br, bl], col, row);
        if (frame !== null) {
          const idx = Number.parseInt(frame, 10);
          if (Number.isFinite(idx) && idx >= 0) {
            const sx = (idx % grid.cols) * grid.frameSize;
            const sy = Math.floor(idx / grid.cols) * grid.frameSize;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(atlasImg, sx, sy, grid.frameSize, grid.frameSize, dx, dy, CELL, CELL);
            continue;
          }
        }
      }
      // Fallback flat colour by primary-vertex passability — same logic as
      // GameScene.renderFallbackTiles.
      const allImpassable =
        TERRAINS[tl] && TERRAINS[tr] && TERRAINS[br] && TERRAINS[bl] &&
        !TERRAINS[tl].passable && !TERRAINS[tr].passable && !TERRAINS[br].passable && !TERRAINS[bl].passable;
      ctx.fillStyle = allImpassable ? hexToCSS(area.visual.wallColor) : hexToCSS(area.visual.floorColor);
      ctx.fillRect(dx, dy, CELL, CELL);
    }
  }
}

function drawObjects(
  ctx: CanvasRenderingContext2D,
  objects: ObjectInstance[],
  showAlternate: boolean,
  showImpassableOutlines: boolean,
): void {
  for (const inst of objects) {
    const def = OBJECT_KINDS[inst.kind];
    if (!def) continue;
    // Conditional visibility: when a condition is set, default render is the
    // when-true state if showAlternate; otherwise default render is the
    // when-condition-evaluates-to-true state at game-start. The editor evaluates
    // through the same evaluateCondition parser to mirror the game.
    let visible = true;
    if (inst.condition) {
      const cur = evaluateCondition(inst.condition);
      visible = showAlternate ? !cur : cur;
    }
    const dx = LABEL_MARGIN + inst.col * CELL;
    const dy = LABEL_MARGIN + inst.row * CELL;
    const img = objectImages[inst.kind];
    const ready = img && img.complete && img.naturalWidth > 0;
    if (ready) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = visible ? 1 : 0.35;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, dx, dy, OBJECT_DRAW_SIZE, OBJECT_DRAW_SIZE);
      ctx.globalAlpha = 1;
    } else {
      // Fallback marker — small square coloured by passability.
      ctx.fillStyle = def.passable ? '#88aa44' : '#aa4444';
      ctx.globalAlpha = visible ? 0.8 : 0.3;
      ctx.fillRect(dx + 2, dy + 2, CELL - 4, CELL - 4);
      ctx.globalAlpha = 1;
    }
    // Impassable outline — toggleable via the "Show impassable outlines"
    // sidebar checkbox; off by default per US-97 spec.
    if (!def.passable && showImpassableOutlines) {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 1;
      ctx.strokeRect(dx + 0.5, dy + 0.5, CELL - 1, CELL - 1);
    }
  }
}

function drawVertexDots(
  ctx: CanvasRenderingContext2D,
  area: AreaDefinition,
  terrain: TerrainId[][],
): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= area.mapRows; r++) {
    for (let c = 0; c <= area.mapCols; c++) {
      if (!terrain[r]?.[c]) continue;
      const x = LABEL_MARGIN + c * CELL;
      const y = LABEL_MARGIN + r * CELL;
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

// ───── Main render entry ─────

let stateUnsubscribe: (() => void) | null = null;

export function renderMap(container: HTMLElement, area: AreaDefinition): void {
  // Fresh load: clone the area's terrain + objects into editor state and wire
  // a state subscriber so any in-state mutation re-renders. The subscription
  // is reset per renderMap call to avoid stacking.
  const isNewArea = !lastRender || lastRender.area !== area;
  lastRender = { container, area };
  if (isNewArea) {
    loadAreaIntoState(area);
    stateUnsubscribe?.();
    stateUnsubscribe = subscribe(() => renderMap(container, area));
  }
  const editor = getState();

  container.innerHTML = '';
  clickables = [];

  const canvasW = area.mapCols * CELL + LABEL_MARGIN;
  const canvasH = area.mapRows * CELL + LABEL_MARGIN;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  // Mode-driven cursor.
  canvas.style.cursor =
    editor.mode === 'cell' ? 'crosshair'
    : editor.mode === 'vertex' ? 'cell'
    : editor.mode === 'object' ? 'copy'
    : 'pointer';
  // Disable native context menu so right-click can remove objects.
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // Axis labels
  ctx.font = '9px monospace';
  ctx.fillStyle = '#667788';
  ctx.textAlign = 'center';
  for (let col = 0; col < area.mapCols; col += 5) {
    ctx.fillText(String(col), LABEL_MARGIN + col * CELL + CELL / 2, 10);
  }
  ctx.textAlign = 'right';
  for (let row = 0; row < area.mapRows; row += 5) {
    ctx.fillText(String(row), LABEL_MARGIN - 4, LABEL_MARGIN + row * CELL + CELL / 2 + 3);
  }

  // Terrain + grid lines
  drawTerrain(ctx, area, editor.terrain);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 0.5;
  for (let col = 0; col <= area.mapCols; col++) {
    ctx.beginPath();
    ctx.moveTo(LABEL_MARGIN + col * CELL, LABEL_MARGIN);
    ctx.lineTo(LABEL_MARGIN + col * CELL, LABEL_MARGIN + area.mapRows * CELL);
    ctx.stroke();
  }
  for (let row = 0; row <= area.mapRows; row++) {
    ctx.beginPath();
    ctx.moveTo(LABEL_MARGIN, LABEL_MARGIN + row * CELL);
    ctx.lineTo(LABEL_MARGIN + area.mapCols * CELL, LABEL_MARGIN + row * CELL);
    ctx.stroke();
  }

  // Objects (above terrain, before triggers/exits)
  drawObjects(ctx, editor.objects, editor.showConditionalAlternate, editor.showImpassableOutlines);

  // Vertex dots in vertex-paint mode
  if (editor.mode === 'vertex') drawVertexDots(ctx, area, editor.terrain);

  // Triggers
  for (const trigger of area.triggers) {
    const color = TRIGGER_COLORS[trigger.type] || '#ffffff';
    const x = LABEL_MARGIN + trigger.col * CELL;
    const y = LABEL_MARGIN + trigger.row * CELL;
    const w = trigger.width * CELL;
    const h = trigger.height * CELL;
    ctx.fillStyle = color;
    ctx.globalAlpha = TRIGGER_ALPHA;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(trigger.id, x + 2, y + 8);
  }

  // Exits
  for (const exit of area.exits) {
    const color = TRIGGER_COLORS.exit;
    const x = LABEL_MARGIN + exit.col * CELL;
    const y = LABEL_MARGIN + exit.row * CELL;
    const w = exit.width * CELL;
    const h = exit.height * CELL;
    ctx.fillStyle = color;
    ctx.globalAlpha = TRIGGER_ALPHA;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(exit.destinationAreaId, x + 2, y + 8);
  }

  // Player spawn
  const spawnX = LABEL_MARGIN + area.playerSpawn.col * CELL + CELL / 2;
  const spawnY = LABEL_MARGIN + area.playerSpawn.row * CELL + CELL / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(spawnX, spawnY - CELL / 2.5);
  ctx.lineTo(spawnX + CELL / 2.5, spawnY);
  ctx.lineTo(spawnX, spawnY + CELL / 2.5);
  ctx.lineTo(spawnX - CELL / 2.5, spawnY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // NPCs
  for (const npc of area.npcs) {
    const cx = LABEL_MARGIN + npc.col * CELL + CELL / 2;
    const cy = LABEL_MARGIN + npc.row * CELL + CELL / 2;
    const radius = CELL / 2.2;
    ctx.fillStyle = hexToCSS(npc.color);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = '9px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, cx, cy - radius - 3);
  }

  // ───── Mouse handlers ─────

  function pointerToGrid(e: MouseEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function gridCell(e: MouseEvent): { col: number; row: number } | null {
    const { x, y } = pointerToGrid(e);
    if (x < LABEL_MARGIN || y < LABEL_MARGIN) return null;
    const col = Math.floor((x - LABEL_MARGIN) / CELL);
    const row = Math.floor((y - LABEL_MARGIN) / CELL);
    if (col < 0 || col >= area.mapCols || row < 0 || row >= area.mapRows) return null;
    return { col, row };
  }

  function nearestVertex(e: MouseEvent): { col: number; row: number } | null {
    const { x, y } = pointerToGrid(e);
    if (x < LABEL_MARGIN - CELL / 2 || y < LABEL_MARGIN - CELL / 2) return null;
    const col = Math.round((x - LABEL_MARGIN) / CELL);
    const row = Math.round((y - LABEL_MARGIN) / CELL);
    if (col < 0 || col > area.mapCols || row < 0 || row > area.mapRows) return null;
    return { col, row };
  }

  function showCellDetail(col: number, row: number): void {
    const t = editor.terrain;
    const corners = {
      TL: t[row]?.[col],
      TR: t[row]?.[col + 1],
      BR: t[row + 1]?.[col + 1],
      BL: t[row + 1]?.[col],
    };
    const obj = objectAtCell(col, row);
    const objKind = obj ? OBJECT_KINDS[obj.kind] : undefined;
    const tilesetDef = TILESETS[area.tileset];
    const frame = corners.TL && corners.TR && corners.BR && corners.BL
      ? resolveWangFrame(area.tileset, [corners.TL, corners.TR, corners.BR, corners.BL], col, row)
      : null;
    // Derive the 4-bit Wang mask using the resolver's convention: bit3=TL,
    // bit2=TR, bit1=BR, bit0=BL — '1' = secondary terrain (or any non-primary
    // for degenerate tilesets where secondaryTerrain is null).
    let mask: string | null = null;
    if (corners.TL && corners.TR && corners.BR && corners.BL && tilesetDef) {
      const w = tilesetDef.wang;
      const isSecondary = (terrain: TerrainId): boolean => {
        if (w.secondaryTerrain && w.primaryTerrain !== w.secondaryTerrain) {
          return terrain === w.secondaryTerrain;
        }
        return terrain !== w.primaryTerrain;
      };
      mask =
        (isSecondary(corners.TL) ? '1' : '0') +
        (isSecondary(corners.TR) ? '1' : '0') +
        (isSecondary(corners.BR) ? '1' : '0') +
        (isSecondary(corners.BL) ? '1' : '0');
    }
    showDetail({
      type: 'cell',
      col, row,
      vertices: corners,
      wangMask: mask,
      pickedFrame: frame,
      tileset: area.tileset,
      object: obj
        ? { kind: obj.kind, passable: objKind?.passable ?? null, condition: obj.condition ?? null }
        : null,
    });
  }

  let dragging = false;
  canvas.addEventListener('mousedown', (e) => {
    // Right-click → remove object at the cell, regardless of mode.
    if (e.button === 2) {
      const cell = gridCell(e);
      if (!cell) return;
      removeObject(cell.col, cell.row);
      return;
    }
    if (e.button !== 0) return;
    // Modifier-driven mode override per spec: Shift = vertex paint,
    // Alt = object placer. Otherwise use the current sidebar mode.
    const effectiveMode: typeof editor.mode =
      e.shiftKey ? 'vertex'
      : e.altKey ? 'object'
      : editor.mode;

    if (effectiveMode === 'cell') {
      const cell = gridCell(e);
      if (!cell) return;
      paintCell(cell.col, cell.row);
      dragging = true;
    } else if (effectiveMode === 'vertex') {
      const v = nearestVertex(e);
      if (!v) return;
      paintVertex(v.col, v.row);
    } else if (effectiveMode === 'object') {
      const cell = gridCell(e);
      if (!cell) return;
      placeObject(cell.col, cell.row);
    } else {
      // inspect mode → just show detail
      const cell = gridCell(e);
      if (cell) showCellDetail(cell.col, cell.row);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    if (e.buttons !== 1) { dragging = false; return; }
    if (e.shiftKey || e.altKey) return; // drag only paints cells
    const cell = gridCell(e);
    if (!cell) return;
    paintCell(cell.col, cell.row);
  });

  canvas.addEventListener('mouseup', () => { dragging = false; });
  canvas.addEventListener('mouseleave', () => { dragging = false; });

  // Click for inspection always shows the cell detail (on top of any paint).
  canvas.addEventListener('click', (e) => {
    if (e.shiftKey || e.altKey) return;
    if (editor.mode !== 'inspect') return;
    const cell = gridCell(e);
    if (cell) showCellDetail(cell.col, cell.row);
  });

  // suppress unused-clickables warning — retained for future feature reuse
  void clickables;
}
