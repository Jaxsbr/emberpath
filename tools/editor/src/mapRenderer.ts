import { TileType } from '@game/maps/constants';
import type { AreaDefinition } from '@game/data/areas/types';
import { showDetail } from './main';

const CELL = 16; // pixels per tile in the editor
const LABEL_MARGIN = 24; // space for axis labels
const TRIGGER_ALPHA = 0.35;

const TRIGGER_COLORS: Record<string, string> = {
  thought: '#4488ff',
  story: '#ff44ff',
  dialogue: '#44ff88',
  exit: '#ffaa44',
};

// Source-atlas grid info for the decoration sprite renderer below. Both
// Kenney atlases used by the game are 12×11 grids of 16×16 frames; the editor
// reads the same /tilesets/<id>/tilemap.png path the game does (publicDir is
// shared via vite.config.ts).
const ATLAS_GRID = {
  'tiny-town': { url: '/tilesets/tiny-town/tilemap.png', cols: 12, frameSize: 16 },
  'tiny-dungeon': { url: '/tilesets/tiny-dungeon/tilemap.png', cols: 12, frameSize: 16 },
} as const;
type AtlasId = keyof typeof ATLAS_GRID;

// Atlases are loaded once at module init and cached. While an atlas is still
// loading on the very first renderMap call, decorations using that atlas are
// silently skipped this pass; the onload handler re-runs the most recent
// renderMap call so the decoration layer paints in as soon as it can.
const atlases: Record<string, HTMLImageElement> = {};
let lastRender: { container: HTMLElement; area: AreaDefinition } | null = null;
const warnedTilesets = new Set<string>();

for (const [id, info] of Object.entries(ATLAS_GRID)) {
  const img = new Image();
  img.onload = () => {
    if (lastRender) renderMap(lastRender.container, lastRender.area);
  };
  img.src = info.url;
  atlases[id] = img;
}

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

export function renderMap(container: HTMLElement, area: AreaDefinition): void {
  lastRender = { container, area };
  container.innerHTML = '';
  clickables = [];

  const canvasW = area.mapCols * CELL + LABEL_MARGIN;
  const canvasH = area.mapRows * CELL + LABEL_MARGIN;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.cursor = 'crosshair';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;

  // Draw axis labels
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

  // Draw tile grid
  const floorColor = hexToCSS(area.visual.floorColor);
  const wallColor = hexToCSS(area.visual.wallColor);

  for (let row = 0; row < area.mapRows; row++) {
    for (let col = 0; col < area.mapCols; col++) {
      const tile = area.map[row]?.[col];
      ctx.fillStyle = tile === TileType.WALL ? wallColor : floorColor;
      ctx.fillRect(LABEL_MARGIN + col * CELL, LABEL_MARGIN + row * CELL, CELL, CELL);
    }
  }

  // Draw grid lines (subtle)
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

  // Draw decorations (between base tile grid and trigger zones — matches the
  // game's depth ordering: tiles at depth 0, decorations at depth 2, props at
  // depth 3, with triggers/exits as editor-only annotations on top).
  const atlasInfo = (ATLAS_GRID as Record<string, { url: string; cols: number; frameSize: number }>)[area.tileset];
  const atlasImg = atlases[area.tileset];
  if (!atlasInfo && area.decorations.length > 0 && !warnedTilesets.has(area.tileset)) {
    console.warn(
      `[editor mapRenderer] Tileset '${area.tileset}' has no entry in ATLAS_GRID; ` +
        `decorations on area '${area.id}' will not render in the editor (they will still render in the game). ` +
        `Add a row to ATLAS_GRID in tools/editor/src/mapRenderer.ts.`,
    );
    warnedTilesets.add(area.tileset);
  }
  if (atlasInfo && atlasImg && atlasImg.complete && atlasImg.naturalWidth > 0) {
    for (const dec of area.decorations) {
      const frameIdx = Number(dec.spriteFrame);
      if (!Number.isFinite(frameIdx)) continue;
      const srcX = (frameIdx % atlasInfo.cols) * atlasInfo.frameSize;
      const srcY = Math.floor(frameIdx / atlasInfo.cols) * atlasInfo.frameSize;
      const dx = LABEL_MARGIN + dec.col * CELL;
      const dy = LABEL_MARGIN + dec.row * CELL;
      // Disable image smoothing so pixel-art frames stay crisp at 1:1 scale.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(atlasImg, srcX, srcY, atlasInfo.frameSize, atlasInfo.frameSize, dx, dy, CELL, CELL);

      clickables.push({
        x: dx,
        y: dy,
        w: CELL,
        h: CELL,
        data: {
          type: 'decoration',
          col: dec.col,
          row: dec.row,
          spriteFrame: dec.spriteFrame,
        },
      });
    }
  }

  // Draw trigger zones
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

    // Label
    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(trigger.id, x + 2, y + 8);

    // Resolve actionRef to actual content
    let content: unknown = trigger.actionRef;
    if (trigger.type === 'dialogue') {
      const script = area.dialogues[trigger.actionRef];
      if (script) {
        content = script.nodes.map(n => ({
          id: n.id,
          speaker: n.speaker,
          text: n.text,
          nextId: n.nextId ?? null,
          choices: n.choices?.map(c => ({
            text: c.text,
            nextId: c.nextId,
            setFlags: c.setFlags ?? null,
          })) ?? null,
        }));
      }
    } else if (trigger.type === 'story') {
      const scene = area.storyScenes[trigger.actionRef];
      if (scene) {
        content = scene.beats.map(b => ({
          text: b.text,
          imageLabel: b.imageLabel ?? null,
        }));
      }
    }
    // For 'thought', actionRef IS the text — no resolution needed

    clickables.push({
      x, y, w, h,
      data: {
        type: 'trigger',
        id: trigger.id,
        col: trigger.col,
        row: trigger.row,
        width: trigger.width,
        height: trigger.height,
        triggerType: trigger.type,
        actionRef: trigger.actionRef,
        condition: trigger.condition ?? null,
        repeatable: trigger.repeatable,
        content,
      },
    });
  }

  // Draw exit zones
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

    // Label with destination
    ctx.font = '8px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(exit.destinationAreaId, x + 2, y + 8);

    clickables.push({
      x, y, w, h,
      data: {
        type: 'exit',
        id: exit.id,
        col: exit.col,
        row: exit.row,
        width: exit.width,
        height: exit.height,
        destinationAreaId: exit.destinationAreaId,
        entryPoint: exit.entryPoint,
        condition: exit.condition ?? null,
      },
    });
  }

  // Draw props (between exits and NPCs — matches game depth order Tiles < Props < Entities)
  for (const prop of area.props) {
    const cx = LABEL_MARGIN + prop.col * CELL + CELL / 2;
    const cy = LABEL_MARGIN + prop.row * CELL + CELL / 2;
    const radius = CELL / 4;

    ctx.fillStyle = '#c89b68';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    clickables.push({
      x: cx - radius,
      y: cy - radius,
      w: radius * 2,
      h: radius * 2,
      data: {
        type: 'prop',
        id: prop.id,
        col: prop.col,
        row: prop.row,
        spriteFrame: prop.spriteFrame,
      },
    });
  }

  // Draw player spawn
  const spawnX = LABEL_MARGIN + area.playerSpawn.col * CELL + CELL / 2;
  const spawnY = LABEL_MARGIN + area.playerSpawn.row * CELL + CELL / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  // Diamond shape for spawn
  ctx.moveTo(spawnX, spawnY - CELL / 2.5);
  ctx.lineTo(spawnX + CELL / 2.5, spawnY);
  ctx.lineTo(spawnX, spawnY + CELL / 2.5);
  ctx.lineTo(spawnX - CELL / 2.5, spawnY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw NPCs
  for (const npc of area.npcs) {
    const cx = LABEL_MARGIN + npc.col * CELL + CELL / 2;
    const cy = LABEL_MARGIN + npc.row * CELL + CELL / 2;
    const radius = CELL / 2.2;

    // Wander radius (dashed green) and awareness radius (dashed yellow) around the spawn tile.
    if (npc.wanderRadius > 0) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#44ff44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, npc.wanderRadius * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (npc.awarenessRadius > 0) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = '#ffff44';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, npc.awarenessRadius * CELL, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = hexToCSS(npc.color);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // NPC name label
    ctx.font = '9px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, cx, cy - radius - 3);

    clickables.push({
      x: cx - radius,
      y: cy - radius,
      w: radius * 2,
      h: radius * 2,
      data: {
        type: 'npc',
        id: npc.id,
        name: npc.name,
        col: npc.col,
        row: npc.row,
        color: '0x' + npc.color.toString(16).padStart(6, '0'),
      },
    });
  }

  // Click handler
  canvas.addEventListener('click', (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check clickables in reverse (topmost first)
    for (let i = clickables.length - 1; i >= 0; i--) {
      const c = clickables[i];
      if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
        showDetail(c.data);
        return;
      }
    }
    // Click empty space — deselect
    showDetail({ hint: 'Click a trigger, NPC, or exit to inspect.' });
  });
}
