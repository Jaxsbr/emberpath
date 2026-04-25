import type { AreaDefinition, DialogueScript, DialogueNode } from '@game/data/areas/types';
import { showDetail } from './main';

// Note: DialogueScript.portraitId and DialogueNode.portraitId (optional) are
// surfaced in the node-detail panel below. A richer in-graph annotation
// ("[portrait: <id>]" on the node label) is intentionally deferred — the
// detail-panel exposure is enough for editor users to inspect and audit
// portrait wiring without crowding the graph view.

const NODE_W = 220;
const NODE_H = 60;
const H_GAP = 40;
const V_GAP = 80;
const START_COLOR = '#44ff88';
const TERMINAL_COLOR = '#ff6666';
const NODE_COLOR = '#2a3a5a';
const EDGE_COLOR = '#667788';
const FLAG_COLOR = '#ffaa44';

interface LayoutNode {
  node: DialogueNode;
  x: number;
  y: number;
  isStart: boolean;
  isTerminal: boolean;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function layoutGraph(script: DialogueScript): LayoutNode[] {
  const nodeMap = new Map<string, DialogueNode>();
  for (const n of script.nodes) nodeMap.set(n.id, n);

  // BFS from start node for top-down layout
  const levels: string[][] = [];
  const visited = new Set<string>();
  const queue: { id: string; depth: number }[] = [{ id: script.startNodeId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    while (levels.length <= depth) levels.push([]);
    levels[depth].push(id);

    const node = nodeMap.get(id);
    if (!node) continue;

    if (node.nextId && !visited.has(node.nextId)) {
      queue.push({ id: node.nextId, depth: depth + 1 });
    }
    if (node.choices) {
      for (const choice of node.choices) {
        if (!visited.has(choice.nextId)) {
          queue.push({ id: choice.nextId, depth: depth + 1 });
        }
      }
    }
  }

  // Add any unreachable nodes at the bottom
  for (const n of script.nodes) {
    if (!visited.has(n.id)) {
      levels.push([n.id]);
      visited.add(n.id);
    }
  }

  const layoutNodes: LayoutNode[] = [];
  for (let depth = 0; depth < levels.length; depth++) {
    const row = levels[depth];
    const totalW = row.length * NODE_W + (row.length - 1) * H_GAP;
    const startX = -totalW / 2;

    for (let i = 0; i < row.length; i++) {
      const node = nodeMap.get(row[i]);
      if (!node) continue;
      const isTerminal = !node.nextId && (!node.choices || node.choices.length === 0);
      layoutNodes.push({
        node,
        x: startX + i * (NODE_W + H_GAP),
        y: depth * (NODE_H + V_GAP),
        isStart: node.id === script.startNodeId,
        isTerminal,
      });
    }
  }

  return layoutNodes;
}

export function renderDialogue(container: HTMLElement, area: AreaDefinition): void {
  container.innerHTML = '';

  const dialogueKeys = Object.keys(area.dialogues);
  if (dialogueKeys.length === 0) {
    container.textContent = 'No dialogues in this area.';
    return;
  }

  // Dialogue selector
  const selectorWrap = document.createElement('div');
  selectorWrap.style.cssText = 'margin-bottom:12px;display:flex;align-items:center;gap:8px;';
  const label = document.createElement('label');
  label.textContent = 'Dialogue:';
  label.style.cssText = 'color:#8899aa;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;';
  const select = document.createElement('select');
  select.style.cssText = 'background:#1a1a2e;color:#e0e0e0;border:1px solid #2a2a4a;border-radius:4px;padding:4px 8px;font-family:inherit;font-size:13px;';
  for (const key of dialogueKeys) {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    select.appendChild(opt);
  }
  selectorWrap.appendChild(label);
  selectorWrap.appendChild(select);
  container.appendChild(selectorWrap);

  const graphWrap = document.createElement('div');
  graphWrap.style.cssText = 'position:relative;overflow:auto;flex:1;';
  container.appendChild(graphWrap);

  function renderGraph(scriptKey: string): void {
    graphWrap.innerHTML = '';
    const script = area.dialogues[scriptKey];
    if (!script) return;

    const layoutNodes = layoutGraph(script);
    if (layoutNodes.length === 0) return;

    // Compute bounding box
    let minX = Infinity, minY = 0, maxX = -Infinity, maxY = 0;
    for (const ln of layoutNodes) {
      if (ln.x < minX) minX = ln.x;
      if (ln.x + NODE_W > maxX) maxX = ln.x + NODE_W;
      if (ln.y + NODE_H > maxY) maxY = ln.y + NODE_H;
    }
    const padX = 40;
    const padY = 40;
    const svgW = maxX - minX + padX * 2;
    const svgH = maxY - minY + padY * 2;
    const offsetX = -minX + padX;
    const offsetY = padY;

    // Create SVG for edges
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(svgW));
    svg.setAttribute('height', String(svgH));
    svg.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';

    // Create node container
    const nodeContainer = document.createElement('div');
    nodeContainer.style.cssText = `position:relative;width:${svgW}px;height:${svgH}px;`;

    // Build position map for edges
    const posMap = new Map<string, { cx: number; topY: number; botY: number }>();
    for (const ln of layoutNodes) {
      const x = ln.x + offsetX;
      const y = ln.y + offsetY;
      posMap.set(ln.node.id, {
        cx: x + NODE_W / 2,
        topY: y,
        botY: y + NODE_H,
      });
    }

    // Draw edges
    for (const ln of layoutNodes) {
      const from = posMap.get(ln.node.id);
      if (!from) continue;

      if (ln.node.nextId) {
        const to = posMap.get(ln.node.nextId);
        if (to) drawEdge(svg, from.cx, from.botY, to.cx, to.topY);
      }

      if (ln.node.choices) {
        for (const choice of ln.node.choices) {
          const to = posMap.get(choice.nextId);
          if (!to) continue;
          drawEdge(svg, from.cx, from.botY, to.cx, to.topY);

          // Edge label — choice text
          const midX = (from.cx + to.cx) / 2;
          const midY = (from.botY + to.topY) / 2;
          const edgeLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          edgeLabel.setAttribute('x', String(midX));
          edgeLabel.setAttribute('y', String(midY - 6));
          edgeLabel.setAttribute('text-anchor', 'middle');
          edgeLabel.setAttribute('fill', '#8899aa');
          edgeLabel.setAttribute('font-size', '9');
          edgeLabel.setAttribute('font-family', 'monospace');
          edgeLabel.textContent = truncate(choice.text, 30);
          svg.appendChild(edgeLabel);

          // Flag annotation
          if (choice.setFlags) {
            const flagEntries = Object.entries(choice.setFlags);
            for (let fi = 0; fi < flagEntries.length; fi++) {
              const [flag, val] = flagEntries[fi];
              const flagLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
              flagLabel.setAttribute('x', String(midX));
              flagLabel.setAttribute('y', String(midY + 8 + fi * 12));
              flagLabel.setAttribute('text-anchor', 'middle');
              flagLabel.setAttribute('fill', FLAG_COLOR);
              flagLabel.setAttribute('font-size', '9');
              flagLabel.setAttribute('font-family', 'monospace');
              flagLabel.setAttribute('font-weight', 'bold');
              flagLabel.textContent = `⚑ ${flag}=${val}`;
              svg.appendChild(flagLabel);
            }
          }
        }
      }
    }

    // Draw nodes
    for (const ln of layoutNodes) {
      const x = ln.x + offsetX;
      const y = ln.y + offsetY;

      const nodeEl = document.createElement('div');
      nodeEl.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;width:${NODE_W}px;height:${NODE_H}px;
        background:${NODE_COLOR};border:2px solid ${ln.isStart ? START_COLOR : ln.isTerminal ? TERMINAL_COLOR : '#4a5a7a'};
        border-radius:6px;padding:6px 8px;cursor:pointer;overflow:hidden;
      `;

      const speakerEl = document.createElement('div');
      speakerEl.style.cssText = 'font-size:10px;color:#8899aa;margin-bottom:2px;';
      speakerEl.textContent = ln.node.speaker;

      const textEl = document.createElement('div');
      textEl.style.cssText = 'font-size:11px;color:#e0e0e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      textEl.textContent = truncate(ln.node.text, 50);

      nodeEl.appendChild(speakerEl);
      nodeEl.appendChild(textEl);

      nodeEl.addEventListener('click', () => {
        showDetail({
          id: ln.node.id,
          speaker: ln.node.speaker,
          text: ln.node.text,
          nextId: ln.node.nextId ?? null,
          choices: ln.node.choices ?? null,
          portraitId: ln.node.portraitId ?? script.portraitId ?? null,
          isStart: ln.isStart,
          isTerminal: ln.isTerminal,
        });
      });

      nodeContainer.appendChild(nodeEl);
    }

    graphWrap.appendChild(svg);
    graphWrap.appendChild(nodeContainer);
  }

  function drawEdge(svg: SVGSVGElement, x1: number, y1: number, x2: number, y2: number): void {
    const midY = (y1 + y2) / 2;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`);
    path.setAttribute('stroke', EDGE_COLOR);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');

    // Arrowhead (fixed downward triangle — edges flow top to bottom)
    const arrowSize = 6;
    const ax = x2;
    const ay = y2;
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrow.setAttribute('points', `${ax},${ay} ${ax - arrowSize},${ay - arrowSize} ${ax + arrowSize},${ay - arrowSize}`);
    arrow.setAttribute('fill', EDGE_COLOR);

    svg.appendChild(path);
    svg.appendChild(arrow);
  }

  select.addEventListener('change', () => renderGraph(select.value));
  renderGraph(dialogueKeys[0]);
}
