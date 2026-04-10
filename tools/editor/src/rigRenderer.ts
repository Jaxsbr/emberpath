import Phaser from 'phaser';
import { CharacterRig } from '@game/rig/CharacterRig';
import { foxRigDefinition } from '@game/rig/characters/fox';
import type { RigDefinition, Direction, BoneDefinition } from '@game/rig/types';

// --- Available rigs (add new rigs here) ---
const AVAILABLE_RIGS: RigDefinition[] = [foxRigDefinition];

// --- Module state ---
let game: Phaser.Game | null = null;
let previewScene: RigPreviewScene | null = null;
let rendered = false;

// Selection state shared between DOM and Phaser
let selectedPartName: string | null = null;
let onPartSelected: ((name: string | null) => void) | null = null;

// --- Phaser scene ---
class RigPreviewScene extends Phaser.Scene {
  private rig: CharacterRig | null = null;
  private definition: RigDefinition = AVAILABLE_RIGS[0];
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'RigPreview' });
  }

  preload(): void {
    // Load the atlas for the current rig definition
    this.load.atlas(
      this.definition.atlasKey,
      `characters/fox.png`,
      `characters/fox.json`,
    );
  }

  create(): void {
    this.drawGrid();
    this.createRig();
    this.setupPointerSelection();
  }

  private drawGrid(): void {
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(0);

    const w = this.scale.width;
    const h = this.scale.height;
    const cellSize = 16;
    const lightColor = 0x2a2a4a;
    const darkColor = 0x1e1e3a;

    for (let y = 0; y < h; y += cellSize) {
      for (let x = 0; x < w; x += cellSize) {
        const col = Math.floor(x / cellSize);
        const row = Math.floor(y / cellSize);
        const color = (col + row) % 2 === 0 ? lightColor : darkColor;
        this.gridGraphics.fillStyle(color, 1);
        this.gridGraphics.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  private createRig(): void {
    if (this.rig) {
      this.rig.destroy();
      this.rig = null;
    }

    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    this.rig = new CharacterRig(this, this.definition, cx, cy);
    this.rig.container.setScale(3);

    this.highlightGraphics = this.add.graphics();
    this.highlightGraphics.setDepth(1000);
  }

  private setupPointerSelection(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.rig) return;

      const container = this.rig.container;
      // Transform pointer to container-local coordinates
      const localX = (pointer.worldX - container.x) / container.scaleX;
      const localY = (pointer.worldY - container.y) / container.scaleY;

      // Find the topmost visible sprite under the pointer
      let bestPart: string | null = null;
      let bestDepth = -Infinity;

      const children = container.list as Phaser.GameObjects.Sprite[];
      for (const sprite of children) {
        if (!sprite.visible) continue;
        const hw = (sprite.displayWidth / Math.abs(sprite.scaleX)) * 0.5;
        const hh = (sprite.displayHeight / Math.abs(sprite.scaleY)) * 0.5;
        const sx = sprite.x;
        const sy = sprite.y;
        if (localX >= sx - hw && localX <= sx + hw && localY >= sy - hh && localY <= sy + hh) {
          if (sprite.depth > bestDepth) {
            bestDepth = sprite.depth;
            bestPart = sprite.frame.name;
          }
        }
      }

      selectedPartName = bestPart;
      this.updateHighlight();
      onPartSelected?.(selectedPartName);
    });
  }

  updateHighlight(): void {
    if (!this.highlightGraphics || !this.rig) return;
    this.highlightGraphics.clear();

    if (!selectedPartName) return;

    const container = this.rig.container;
    const children = container.list as Phaser.GameObjects.Sprite[];
    for (const sprite of children) {
      if (sprite.frame.name === selectedPartName && sprite.visible) {
        const hw = (sprite.displayWidth / Math.abs(sprite.scaleX)) * 0.5;
        const hh = (sprite.displayHeight / Math.abs(sprite.scaleY)) * 0.5;
        // Draw highlight at world coordinates
        const worldX = container.x + sprite.x * container.scaleX;
        const worldY = container.y + sprite.y * container.scaleY;
        this.highlightGraphics.lineStyle(2, 0xe94560, 0.9);
        this.highlightGraphics.strokeRect(
          worldX - hw * Math.abs(container.scaleX),
          worldY - hh * Math.abs(container.scaleY),
          hw * 2 * Math.abs(container.scaleX),
          hh * 2 * Math.abs(container.scaleY),
        );
        break;
      }
    }
  }

  setDirection(dir: Direction): void {
    this.rig?.setDirection(dir);
    this.updateHighlight();
  }

  setRigDefinition(def: RigDefinition): void {
    this.definition = def;
    // Reload the scene to load the new atlas and recreate the rig
    this.scene.restart();
  }

  selectPart(name: string | null): void {
    selectedPartName = name;
    this.updateHighlight();
  }

  getRig(): CharacterRig | null {
    return this.rig;
  }

  getDefinition(): RigDefinition {
    return this.definition;
  }
}

// --- Direction picker ---
const DIRECTIONS: (Direction | null)[][] = [
  ['NW', 'N', 'NE'],
  ['W', null, 'E'],
  ['SW', 'S', 'SE'],
];

function createDirectionPicker(onDirection: (dir: Direction) => void): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'rig-direction-picker';

  let currentDir: Direction = 'S';

  for (const row of DIRECTIONS) {
    const rowEl = document.createElement('div');
    rowEl.className = 'dir-row';
    for (const dir of row) {
      const btn = document.createElement('button');
      btn.className = 'dir-btn';
      if (dir) {
        btn.textContent = dir;
        btn.dataset.dir = dir;
        if (dir === currentDir) btn.classList.add('active');
        btn.addEventListener('click', () => {
          currentDir = dir;
          picker.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          onDirection(dir);
        });
      } else {
        btn.textContent = '•';
        btn.disabled = true;
        btn.classList.add('dir-center');
      }
      rowEl.appendChild(btn);
    }
    picker.appendChild(rowEl);
  }

  return picker;
}

// --- Skeleton hierarchy ---
function createHierarchyPanel(
  bone: BoneDefinition,
  onSelect: (name: string) => void,
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'rig-hierarchy';

  const title = document.createElement('div');
  title.className = 'hierarchy-title';
  title.textContent = 'Skeleton';
  panel.appendChild(title);

  const tree = document.createElement('div');
  tree.className = 'hierarchy-tree';
  tree.appendChild(createBoneNode(bone, 0, onSelect));
  panel.appendChild(tree);

  return panel;
}

function createBoneNode(
  bone: BoneDefinition,
  depth: number,
  onSelect: (name: string) => void,
): HTMLElement {
  const node = document.createElement('div');
  node.className = 'bone-node';

  const label = document.createElement('div');
  label.className = 'bone-label';
  label.style.paddingLeft = `${depth * 12}px`;
  label.dataset.part = bone.name;

  const hasChildren = bone.children && bone.children.length > 0;

  if (hasChildren) {
    const toggle = document.createElement('span');
    toggle.className = 'bone-toggle';
    toggle.textContent = '▾';
    label.appendChild(toggle);
  } else {
    const spacer = document.createElement('span');
    spacer.className = 'bone-toggle';
    spacer.textContent = ' ';
    label.appendChild(spacer);
  }

  const nameSpan = document.createElement('span');
  nameSpan.className = 'bone-name';
  nameSpan.textContent = bone.name;
  label.appendChild(nameSpan);

  label.addEventListener('click', (e) => {
    e.stopPropagation();
    // Handle selection
    const tree = node.closest('.hierarchy-tree');
    tree?.querySelectorAll('.bone-label.selected').forEach(el => el.classList.remove('selected'));
    label.classList.add('selected');
    onSelect(bone.name);
  });

  node.appendChild(label);

  if (hasChildren) {
    const childContainer = document.createElement('div');
    childContainer.className = 'bone-children';
    for (const child of bone.children!) {
      childContainer.appendChild(createBoneNode(child, depth + 1, onSelect));
    }
    node.appendChild(childContainer);

    // Toggle collapse
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const toggle = label.querySelector('.bone-toggle');
      const isCollapsed = childContainer.classList.toggle('collapsed');
      if (toggle) toggle.textContent = isCollapsed ? '▸' : '▾';
    });
  }

  return node;
}

// --- Rig selector ---
function createRigSelector(
  rigs: RigDefinition[],
  onChange: (def: RigDefinition) => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'rig-selector-wrap';

  const lbl = document.createElement('label');
  lbl.textContent = 'Rig:';
  lbl.className = 'rig-selector-label';
  wrap.appendChild(lbl);

  const select = document.createElement('select');
  select.className = 'rig-selector';
  for (const def of rigs) {
    const opt = document.createElement('option');
    opt.value = def.name;
    opt.textContent = def.name;
    select.appendChild(opt);
  }
  select.addEventListener('change', () => {
    const def = rigs.find(r => r.name === select.value);
    if (def) onChange(def);
  });
  wrap.appendChild(select);

  return wrap;
}

// --- CSS injection ---
function injectRigStyles(): void {
  if (document.getElementById('rig-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'rig-editor-styles';
  style.textContent = `
    #view-rig.active {
      display: flex !important;
      padding: 0;
    }
    .rig-sidebar {
      width: 220px;
      flex-shrink: 0;
      background: var(--bg-surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .rig-selector-wrap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .rig-selector-label {
      color: var(--text-muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .rig-selector {
      flex: 1;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 3px 6px;
      font-family: inherit;
      font-size: 12px;
    }
    .rig-direction-picker {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .dir-row {
      display: flex;
      justify-content: center;
      gap: 3px;
      margin-bottom: 3px;
    }
    .dir-btn {
      width: 36px;
      height: 28px;
      background: var(--bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 3px;
      font-family: inherit;
      font-size: 10px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }
    .dir-btn:hover:not(:disabled) {
      background: var(--bg-panel);
      color: var(--text);
    }
    .dir-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .dir-btn.dir-center {
      background: transparent;
      border-color: transparent;
      color: var(--text-muted);
      cursor: default;
    }
    .rig-hierarchy {
      flex: 1;
      overflow-y: auto;
    }
    .hierarchy-title {
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    .hierarchy-tree {
      padding: 6px 0;
    }
    .bone-label {
      display: flex;
      align-items: center;
      padding: 3px 8px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text);
      transition: background 0.1s;
      user-select: none;
    }
    .bone-label:hover {
      background: var(--bg-panel);
    }
    .bone-label.selected {
      background: var(--accent);
      color: #fff;
    }
    .bone-toggle {
      width: 14px;
      flex-shrink: 0;
      font-size: 10px;
      color: var(--text-muted);
    }
    .bone-name {
      flex: 1;
    }
    .bone-children.collapsed {
      display: none;
    }
    .rig-scene-container {
      flex: 1;
      position: relative;
      overflow: hidden;
    }
    .rig-scene-container canvas {
      display: block;
    }
  `;
  document.head.appendChild(style);
}

// --- Public API ---
export function renderRig(container: HTMLElement): void {
  if (rendered && game) return; // prevent duplicate creation

  injectRigStyles();
  container.innerHTML = '';

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'rig-sidebar';

  // Rig selector
  sidebar.appendChild(createRigSelector(AVAILABLE_RIGS, (def) => {
    previewScene?.setRigDefinition(def);
    // Rebuild hierarchy for new rig
    renderRig(container);
  }));

  // Direction picker
  sidebar.appendChild(createDirectionPicker((dir) => {
    previewScene?.setDirection(dir);
  }));

  // Hierarchy panel
  const currentDef = previewScene?.getDefinition() ?? AVAILABLE_RIGS[0];
  const hierarchy = createHierarchyPanel(currentDef.skeleton, (name) => {
    selectedPartName = name;
    previewScene?.selectPart(name);
    onPartSelected?.(name);
  });
  sidebar.appendChild(hierarchy);

  container.appendChild(sidebar);

  // Scene container
  const sceneContainer = document.createElement('div');
  sceneContainer.className = 'rig-scene-container';
  container.appendChild(sceneContainer);

  // Create Phaser game
  previewScene = new RigPreviewScene();

  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: sceneContainer,
    width: sceneContainer.clientWidth || 600,
    height: sceneContainer.clientHeight || 400,
    backgroundColor: '#1a1a2e',
    scene: previewScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      mouse: { preventDefaultWheel: false },
    },
  });

  // Wire up part selection callback to highlight hierarchy
  onPartSelected = (name) => {
    hierarchy.querySelectorAll('.bone-label.selected').forEach(el => el.classList.remove('selected'));
    if (name) {
      const label = hierarchy.querySelector(`.bone-label[data-part="${name}"]`);
      label?.classList.add('selected');
    }
  };

  rendered = true;
}

export function destroyRig(): void {
  if (game) {
    game.destroy(true);
    game = null;
  }
  previewScene = null;
  rendered = false;
  selectedPartName = null;
  onPartSelected = null;
}
