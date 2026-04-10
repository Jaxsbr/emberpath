import { getArea, getAllAreaIds, getDefaultAreaId } from '@game/data/areas/registry';
import type { AreaDefinition } from '@game/data/areas/types';
import { showDetail } from './main';

const BOX_W = 260;
const BOX_MIN_H = 120;
const BOX_GAP_X = 200;
const BOX_GAP_Y = 80;
const TRIGGER_COLORS: Record<string, string> = {
  thought: '#4488ff',
  story: '#ff44ff',
  dialogue: '#44ff88',
  exit: '#ffaa44',
};
const DEFAULT_BORDER = '#e94560';
const NORMAL_BORDER = '#4a5a7a';
const FLAG_DEP_COLOR = '#ffaa44';

interface AreaBox {
  area: AreaDefinition;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Collect all flags set by dialogue choices across all areas
interface FlagSource {
  areaId: string;
  dialogueId: string;
  choiceText: string;
  flagName: string;
  flagValue: string | number | boolean;
}

// Collect all conditions referencing flags
interface FlagConsumer {
  areaId: string;
  elementType: 'trigger' | 'exit';
  elementId: string;
  condition: string;
  referencedFlags: string[];
}

function extractFlagSources(area: AreaDefinition): FlagSource[] {
  const sources: FlagSource[] = [];
  for (const [dialogueId, script] of Object.entries(area.dialogues)) {
    for (const node of script.nodes) {
      if (node.choices) {
        for (const choice of node.choices) {
          if (choice.setFlags) {
            for (const [flag, val] of Object.entries(choice.setFlags)) {
              sources.push({ areaId: area.id, dialogueId, choiceText: choice.text, flagName: flag, flagValue: val });
            }
          }
        }
      }
    }
  }
  return sources;
}

function extractFlagConsumers(area: AreaDefinition): FlagConsumer[] {
  const consumers: FlagConsumer[] = [];
  for (const trigger of area.triggers) {
    if (trigger.condition) {
      const flags = extractFlagNames(trigger.condition);
      if (flags.length > 0) {
        consumers.push({ areaId: area.id, elementType: 'trigger', elementId: trigger.id, condition: trigger.condition, referencedFlags: flags });
      }
    }
  }
  for (const exit of area.exits) {
    if (exit.condition) {
      const flags = extractFlagNames(exit.condition);
      if (flags.length > 0) {
        consumers.push({ areaId: area.id, elementType: 'exit', elementId: exit.id, condition: exit.condition, referencedFlags: flags });
      }
    }
  }
  return consumers;
}

function extractFlagNames(condition: string): string[] {
  // Conditions like "spoke_to_old_man == true AND visited_marsh == true"
  const matches = condition.match(/(\w+)\s*[=!<>]/g);
  if (!matches) return [];
  return matches.map(m => m.replace(/\s*[=!<>].*/, '').trim());
}

export function renderFlow(container: HTMLElement, onNavigate: (areaId: string) => void): void {
  container.innerHTML = '';

  const areaIds = getAllAreaIds();
  const defaultAreaId = getDefaultAreaId();
  const areas: AreaDefinition[] = [];
  for (const id of areaIds) {
    const area = getArea(id);
    if (area) areas.push(area);
  }

  if (areas.length === 0) {
    container.textContent = 'No areas registered.';
    return;
  }

  // Layout: simple row for now (works for 2-5 areas)
  const boxes: AreaBox[] = [];
  for (let i = 0; i < areas.length; i++) {
    const area = areas[i];
    const triggerCount = area.triggers.length;
    const h = Math.max(BOX_MIN_H, 60 + triggerCount * 18);
    boxes.push({
      area,
      x: i * (BOX_W + BOX_GAP_X),
      y: 60,
      w: BOX_W,
      h,
    });
  }

  // Compute total canvas size
  const padX = 80;
  const padY = 80;
  const totalW = boxes.length * (BOX_W + BOX_GAP_X) - BOX_GAP_X + padX * 2;
  const maxH = Math.max(...boxes.map(b => b.h));
  const totalH = maxH + 200 + padY * 2; // extra space for arrows and flag deps

  // Container
  const canvas = document.createElement('div');
  canvas.style.cssText = `position:relative;width:${totalW}px;height:${totalH}px;`;

  // SVG for arrows and dependency lines
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(totalW));
  svg.setAttribute('height', String(totalH));
  svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

  // Build position map
  const posMap = new Map<string, AreaBox>();
  for (const box of boxes) {
    posMap.set(box.area.id, box);
  }

  // Draw exit arrows
  for (const box of boxes) {
    for (const exit of box.area.exits) {
      const destBox = posMap.get(exit.destinationAreaId);
      if (!destBox) continue;

      const fromX = box.x + padX + box.w;
      const fromY = box.y + padY + box.h / 2;
      const toX = destBox.x + padX;
      const toY = destBox.y + padY + destBox.h / 2;

      // Handle bidirectional — offset vertically
      const goingRight = toX > fromX;
      const offsetY = goingRight ? -8 : 8;

      const midX = (fromX + toX) / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${fromX} ${fromY + offsetY} C ${midX} ${fromY + offsetY}, ${midX} ${toY + offsetY}, ${toX} ${toY + offsetY}`);
      path.setAttribute('stroke', TRIGGER_COLORS.exit);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#arrowhead)');
      svg.appendChild(path);

      // Exit ID label on the arrow
      const labelX = midX;
      const labelY = (fromY + toY) / 2 + offsetY - 10;
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(labelX));
      label.setAttribute('y', String(labelY));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', TRIGGER_COLORS.exit);
      label.setAttribute('font-size', '10');
      label.setAttribute('font-family', 'monospace');
      label.textContent = exit.id;
      svg.appendChild(label);

      // Condition text (if any)
      if (exit.condition) {
        const condLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        condLabel.setAttribute('x', String(labelX));
        condLabel.setAttribute('y', String(labelY + 14));
        condLabel.setAttribute('text-anchor', 'middle');
        condLabel.setAttribute('fill', '#8899aa');
        condLabel.setAttribute('font-size', '9');
        condLabel.setAttribute('font-family', 'monospace');
        condLabel.textContent = `[${exit.condition}]`;
        svg.appendChild(condLabel);
      }
    }
  }

  // Draw flag dependency lines
  const allSources: FlagSource[] = [];
  const allConsumers: FlagConsumer[] = [];
  for (const area of areas) {
    allSources.push(...extractFlagSources(area));
    allConsumers.push(...extractFlagConsumers(area));
  }

  for (const consumer of allConsumers) {
    for (const flagName of consumer.referencedFlags) {
      const matchingSources = allSources.filter(s => s.flagName === flagName);
      for (const source of matchingSources) {
        const srcBox = posMap.get(source.areaId);
        const dstBox = posMap.get(consumer.areaId);
        if (!srcBox || !dstBox) continue;

        const srcX = srcBox.x + padX + srcBox.w / 2;
        const srcY = srcBox.y + padY + srcBox.h + 10;
        const dstX = dstBox.x + padX + dstBox.w / 2;
        const dstY = dstBox.y + padY + dstBox.h + 10;

        const curveY = Math.max(srcY, dstY) + 40;

        const depLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        depLine.setAttribute('d', `M ${srcX} ${srcY} C ${srcX} ${curveY}, ${dstX} ${curveY}, ${dstX} ${dstY}`);
        depLine.setAttribute('stroke', FLAG_DEP_COLOR);
        depLine.setAttribute('stroke-width', '1.5');
        depLine.setAttribute('stroke-dasharray', '6,4');
        depLine.setAttribute('fill', 'none');
        svg.appendChild(depLine);

        // Flag name label
        const midLabelX = (srcX + dstX) / 2;
        const flagLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        flagLabel.setAttribute('x', String(midLabelX));
        flagLabel.setAttribute('y', String(curveY + 4));
        flagLabel.setAttribute('text-anchor', 'middle');
        flagLabel.setAttribute('fill', FLAG_DEP_COLOR);
        flagLabel.setAttribute('font-size', '9');
        flagLabel.setAttribute('font-family', 'monospace');
        flagLabel.textContent = `⚑ ${flagName}`;

        // Make flag dep line clickable via an invisible rect
        const clickRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clickRect.setAttribute('x', String(midLabelX - 50));
        clickRect.setAttribute('y', String(curveY - 10));
        clickRect.setAttribute('width', '100');
        clickRect.setAttribute('height', '20');
        clickRect.setAttribute('fill', 'transparent');
        clickRect.setAttribute('cursor', 'pointer');
        clickRect.style.pointerEvents = 'all';
        clickRect.addEventListener('click', () => {
          showDetail({
            type: 'flag_dependency',
            flag: flagName,
            setBy: `${source.areaId} / ${source.dialogueId} — "${source.choiceText}"`,
            consumedBy: `${consumer.areaId} / ${consumer.elementType}:${consumer.elementId}`,
            condition: consumer.condition,
          });
        });

        svg.appendChild(depLine);
        svg.appendChild(flagLabel);
        svg.appendChild(clickRect);
      }
    }
  }

  // Arrowhead marker
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  arrowPath.setAttribute('points', '0 0, 10 3.5, 0 7');
  arrowPath.setAttribute('fill', TRIGGER_COLORS.exit);
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.insertBefore(defs, svg.firstChild);

  canvas.appendChild(svg);

  // Draw area boxes
  for (const box of boxes) {
    const isDefault = box.area.id === defaultAreaId;
    const boxEl = document.createElement('div');
    boxEl.style.cssText = `
      position:absolute;left:${box.x + padX}px;top:${box.y + padY}px;width:${box.w}px;min-height:${box.h}px;
      background:#16213e;border:2px solid ${isDefault ? DEFAULT_BORDER : NORMAL_BORDER};
      border-radius:8px;padding:10px;cursor:pointer;
    `;

    // Area name header
    const header = document.createElement('div');
    header.style.cssText = 'font-size:13px;font-weight:bold;margin-bottom:8px;color:#e0e0e0;';
    header.textContent = box.area.name + (isDefault ? ' ★' : '');
    boxEl.appendChild(header);

    // Trigger list
    for (const trigger of box.area.triggers) {
      const trigEl = document.createElement('div');
      trigEl.style.cssText = 'font-size:10px;margin-bottom:3px;display:flex;align-items:center;gap:4px;';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;background:${TRIGGER_COLORS[trigger.type] || '#fff'};flex-shrink:0;`;
      const idText = document.createElement('span');
      idText.style.cssText = 'color:#8899aa;';
      idText.textContent = trigger.id;
      trigEl.appendChild(dot);
      trigEl.appendChild(idText);
      boxEl.appendChild(trigEl);
    }

    // Click navigates to Map tab with this area
    boxEl.addEventListener('click', () => {
      onNavigate(box.area.id);
    });

    canvas.appendChild(boxEl);
  }

  container.appendChild(canvas);
}
