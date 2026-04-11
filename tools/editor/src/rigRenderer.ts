import Phaser from 'phaser';
import { CharacterRig } from '@game/rig/CharacterRig';
import { WalkRunController } from '@game/rig/animations/walkRun';
import { IdleController } from '@game/rig/animations/idle';
import { foxRigDefinition } from '@game/rig/characters/fox';
import { PLAYER_SPEED } from '@game/maps/constants';
import type {
  RigDefinition,
  Direction,
  UniqueDirection,
  BoneDefinition,
  DirectionProfile,
  PartProfile,
} from '@game/rig/types';

// --- Available rigs (add new rigs here) ---
const AVAILABLE_RIGS: RigDefinition[] = [foxRigDefinition];

// --- Mirror map (matches CharacterRig logic) ---
const MIRROR_MAP: Record<string, UniqueDirection> = { W: 'E', SW: 'SE', NW: 'NE' };
const MIRRORED_DIRECTIONS = new Set<Direction>(['W', 'SW', 'NW']);
const UNIQUE_DIRECTIONS: UniqueDirection[] = ['S', 'N', 'E', 'SE', 'NE'];

// --- Module state ---
let game: Phaser.Game | null = null;
let previewScene: RigPreviewScene | null = null;
let rendered = false;
let activeRigIndex = 0;

// Selection & direction state
let selectedPartName: string | null = null;
let currentDirection: Direction = 'S';
let onPartSelected: ((name: string | null) => void) | null = null;
let onDirectionChanged: ((dir: Direction) => void) | null = null;

// Editor profiles — mutable working copy
let editorProfiles: Record<UniqueDirection, DirectionProfile> | null = null;

// Animation preview state
type AnimationMode = 'edit' | 'idle' | 'walk' | 'run';
let animationMode: AnimationMode = 'edit';
let onAnimationModeChanged: ((mode: AnimationMode) => void) | null = null;

function getUniqueDirection(dir: Direction): UniqueDirection {
  return (MIRRORED_DIRECTIONS.has(dir) ? MIRROR_MAP[dir] : dir) as UniqueDirection;
}

function isMirrored(dir: Direction): boolean {
  return MIRRORED_DIRECTIONS.has(dir);
}

function deepCloneProfiles(def: RigDefinition): Record<UniqueDirection, DirectionProfile> {
  return JSON.parse(JSON.stringify(def.profiles));
}

function getPartProfile(partName: string): PartProfile | null {
  if (!editorProfiles) return null;
  const uniqueDir = getUniqueDirection(currentDirection);
  return editorProfiles[uniqueDir]?.parts[partName] ?? null;
}

// --- Phaser scene ---
class RigPreviewScene extends Phaser.Scene {
  private rig: CharacterRig | null = null;
  private definition: RigDefinition = AVAILABLE_RIGS[activeRigIndex];
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super({ key: 'RigPreview' });
  }

  preload(): void {
    this.load.atlas(
      this.definition.atlasKey,
      `characters/${this.definition.name}.png`,
      `characters/${this.definition.name}.json`,
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

    // Apply editor profiles if they exist
    if (editorProfiles) {
      this.applyEditorProfiles();
    }
  }

  private setupPointerSelection(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.rig) return;

      const container = this.rig.container;
      const localX = (pointer.worldX - container.x) / container.scaleX;
      const localY = (pointer.worldY - container.y) / container.scaleY;

      let bestPart: string | null = null;
      let bestDepth = -Infinity;

      const children = container.list as Phaser.GameObjects.Sprite[];
      for (const sprite of children) {
        if (!sprite.visible) continue;
        const hw = (sprite.displayWidth / Math.abs(sprite.scaleX)) * 0.5;
        const hh = (sprite.displayHeight / Math.abs(sprite.scaleY)) * 0.5;
        if (
          localX >= sprite.x - hw && localX <= sprite.x + hw &&
          localY >= sprite.y - hh && localY <= sprite.y + hh
        ) {
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
    currentDirection = dir;
    this.rig?.setDirection(dir);
    // Only apply editor profiles in edit mode — animation mode uses its own update loop
    if (animationMode === 'edit' && editorProfiles) {
      this.applyEditorProfiles();
    }
    this.updateHighlight();
    onDirectionChanged?.(dir);
  }

  /** Apply editor profiles via tree-walk resolver — editing a parent visually moves all descendants. */
  applyEditorProfiles(): void {
    if (!this.rig || !editorProfiles) return;
    this.rig.applyProfiles(editorProfiles, currentDirection);
    this.updateHighlight();
  }

  /** Update a single part's property and re-render it. */
  updatePartProperty(partName: string, prop: keyof PartProfile, value: number | boolean): void {
    if (!editorProfiles) return;
    const uniqueDir = getUniqueDirection(currentDirection);
    const pp = editorProfiles[uniqueDir].parts[partName];
    if (!pp) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (pp as any)[prop] = value;
    this.applyEditorProfiles();
  }

  /** Phaser update loop — drives animation controllers when not in edit mode. */
  update(_time: number, delta: number): void {
    if (animationMode === 'edit' || !this.rig) return;
    this.rig.update(delta);
    this.updateHighlight();
  }

  /** Attach animation controllers and set velocity for the given mode. */
  startAnimation(mode: 'idle' | 'walk' | 'run'): void {
    if (!this.rig) return;
    this.stopAnimation();

    const def = this.definition;

    // Override walkToRunDelay to prevent unwanted transitions:
    // walk mode: never transition to run (infinite delay)
    // run mode: start running immediately (zero delay)
    const walkRunParams = { ...def.walkRunParams };
    if (mode === 'walk') walkRunParams.walkToRunDelay = Infinity;
    if (mode === 'run') walkRunParams.walkToRunDelay = 0;

    const walkRun = new WalkRunController(walkRunParams);
    const idle = new IdleController(def.idleParams);
    this.rig.addAnimationController(walkRun);
    this.rig.addAnimationController(idle);

    // Re-apply current direction (createRig resets to S)
    this.rig.setDirection(currentDirection);

    // Set velocity to trigger the correct animation state
    const velocity = mode === 'idle' ? 0 : PLAYER_SPEED;
    this.rig.setVelocity(velocity);
  }

  /** Remove all animation controllers and reapply static editor profiles. */
  stopAnimation(): void {
    if (!this.rig) return;
    // Remove controllers by recreating the rig's controller list
    // CharacterRig doesn't expose a clearControllers(), so we destroy and recreate
    // the rig to get a clean state, then reapply editor profiles.
    this.createRig();
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
const DIRECTION_GRID: (Direction | null)[][] = [
  ['NW', 'N', 'NE'],
  ['W', null, 'E'],
  ['SW', 'S', 'SE'],
];

function createDirectionPicker(onDirection: (dir: Direction) => void): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'rig-direction-picker';

  for (const row of DIRECTION_GRID) {
    const rowEl = document.createElement('div');
    rowEl.className = 'dir-row';
    for (const dir of row) {
      const btn = document.createElement('button');
      btn.className = 'dir-btn';
      if (dir) {
        btn.textContent = dir;
        btn.dataset.dir = dir;
        if (dir === currentDirection) btn.classList.add('active');
        btn.addEventListener('click', () => {
          picker.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          onDirection(dir);
        });
      } else {
        btn.textContent = '\u2022';
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

  const toggle = document.createElement('span');
  toggle.className = 'bone-toggle';
  toggle.textContent = hasChildren ? '\u25BE' : ' ';
  label.appendChild(toggle);

  const nameSpan = document.createElement('span');
  nameSpan.className = 'bone-name';
  nameSpan.textContent = bone.name;
  label.appendChild(nameSpan);

  label.addEventListener('click', (e) => {
    e.stopPropagation();
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

    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const isCollapsed = childContainer.classList.toggle('collapsed');
      toggle.textContent = isCollapsed ? '\u25B8' : '\u25BE';
    });
  }

  return node;
}

// --- Animation mode picker ---
const ANIMATION_MODES: { mode: AnimationMode; label: string }[] = [
  { mode: 'edit', label: 'Edit' },
  { mode: 'idle', label: 'Idle' },
  { mode: 'walk', label: 'Walk' },
  { mode: 'run', label: 'Run' },
];

function createAnimationModePicker(onMode: (mode: AnimationMode) => void): HTMLElement {
  const picker = document.createElement('div');
  picker.className = 'rig-animation-picker';

  const label = document.createElement('div');
  label.className = 'animation-picker-label';
  label.textContent = 'Preview';
  picker.appendChild(label);

  const btnRow = document.createElement('div');
  btnRow.className = 'animation-btn-row';

  for (const { mode, label: text } of ANIMATION_MODES) {
    const btn = document.createElement('button');
    btn.className = 'animation-mode-btn';
    btn.textContent = text;
    btn.dataset.mode = mode;
    if (mode === animationMode) btn.classList.add('active');
    btn.addEventListener('click', () => {
      btnRow.querySelectorAll('.animation-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onMode(mode);
    });
    btnRow.appendChild(btn);
  }

  picker.appendChild(btnRow);
  return picker;
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

// --- Persistence toolbar ---
function createPersistenceToolbar(getDefinition: () => RigDefinition): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'rig-persistence-toolbar';

  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'rig-toolbar-btn';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => {
    const profiles = getEditorProfiles();
    if (!profiles) return;
    const json = JSON.stringify(profiles, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getDefinition().name}-profiles.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  toolbar.appendChild(saveBtn);

  // Load button
  const loadBtn = document.createElement('button');
  loadBtn.className = 'rig-toolbar-btn';
  loadBtn.textContent = 'Load';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const profiles = JSON.parse(reader.result as string) as Record<UniqueDirection, DirectionProfile>;
        const warnings = setEditorProfiles(profiles, getDefinition());
        if (warnings.length > 0) {
          alert(`Warning: these parts are not in the current rig skeleton:\n${warnings.join(', ')}`);
        }
        // Refresh property panel
        onPartSelected?.(selectedPartName);
      } catch (err) {
        alert(`Failed to load profiles: ${(err as Error).message}`);
      }
      // Reset file input so re-selecting the same file triggers change
      fileInput.value = '';
    };
    reader.readAsText(file);
  });
  loadBtn.addEventListener('click', () => fileInput.click());
  toolbar.appendChild(loadBtn);
  toolbar.appendChild(fileInput);

  // Export TS button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'rig-toolbar-btn';
  exportBtn.textContent = 'Export TS';
  exportBtn.addEventListener('click', () => {
    const profiles = getEditorProfiles();
    if (!profiles) return;
    const ts = generateTypeScript(profiles);
    const blob = new Blob([ts], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getDefinition().name}-profiles.ts`;
    a.click();
    URL.revokeObjectURL(url);
  });
  toolbar.appendChild(exportBtn);

  return toolbar;
}

function generateTypeScript(profiles: Record<UniqueDirection, DirectionProfile>): string {
  const lines: string[] = [];
  lines.push("import type { UniqueDirection, DirectionProfile } from '../types';");
  lines.push('');
  lines.push('export const profiles: Record<UniqueDirection, DirectionProfile> = {');

  for (const dir of UNIQUE_DIRECTIONS) {
    const profile = profiles[dir];
    if (!profile) continue;
    lines.push(`  ${dir}: {`);
    lines.push('    parts: {');
    for (const [partName, pp] of Object.entries(profile.parts)) {
      const alpha = pp.alpha !== undefined ? `, alpha: ${pp.alpha}` : '';
      lines.push(
        `      '${partName}': { x: ${pp.x}, y: ${pp.y}, scaleX: ${pp.scaleX}, scaleY: ${pp.scaleY}, rotation: ${pp.rotation}, depth: ${pp.depth}, visible: ${pp.visible}${alpha} },`,
      );
    }
    lines.push('    },');
    lines.push('  },');
  }

  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

// --- Property editor panel ---
const NUMERIC_PROPS: { key: keyof PartProfile; label: string; step: number }[] = [
  { key: 'x', label: 'X', step: 1 },
  { key: 'y', label: 'Y', step: 1 },
  { key: 'scaleX', label: 'Scale X', step: 0.05 },
  { key: 'scaleY', label: 'Scale Y', step: 0.05 },
  { key: 'rotation', label: 'Rotation', step: 0.05 },
  { key: 'depth', label: 'Depth', step: 1 },
  { key: 'alpha', label: 'Alpha', step: 0.05 },
];

function createPropertyPanel(): {
  element: HTMLElement;
  update: (partName: string | null, dir: Direction) => void;
} {
  const panel = document.createElement('div');
  panel.className = 'rig-property-panel';

  // Prevent pointer events from reaching Phaser
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  panel.addEventListener('pointerup', (e) => e.stopPropagation());
  panel.addEventListener('click', (e) => e.stopPropagation());

  const title = document.createElement('div');
  title.className = 'prop-title';
  title.textContent = 'Properties';
  panel.appendChild(title);

  const content = document.createElement('div');
  content.className = 'prop-content';
  panel.appendChild(content);

  const mirrorIndicator = document.createElement('div');
  mirrorIndicator.className = 'prop-mirror-indicator';
  mirrorIndicator.style.display = 'none';

  const partLabel = document.createElement('div');
  partLabel.className = 'prop-part-label';

  const inputs: Map<string, HTMLInputElement> = new Map();
  let visibleCheckbox: HTMLInputElement | null = null;

  function rebuild(partName: string | null, dir: Direction): void {
    content.innerHTML = '';
    inputs.clear();
    visibleCheckbox = null;

    if (!partName) {
      const hint = document.createElement('div');
      hint.className = 'prop-hint';
      hint.textContent = animationMode !== 'edit'
        ? 'Switch to Edit mode to modify properties.'
        : 'Select a part to edit its properties.';
      content.appendChild(hint);
      return;
    }

    // Part name label
    partLabel.textContent = partName;
    content.appendChild(partLabel);

    // Animation mode indicator
    if (animationMode !== 'edit') {
      const animHint = document.createElement('div');
      animHint.className = 'prop-mirror-indicator';
      animHint.textContent = `Playing: ${animationMode} — switch to Edit to modify`;
      content.appendChild(animHint);
    }

    // Mirror indicator
    const mirrored = isMirrored(dir);
    const sourceDir = mirrored ? MIRROR_MAP[dir] : null;
    mirrorIndicator.textContent = mirrored ? `Mirrored from ${sourceDir}` : '';
    mirrorIndicator.style.display = mirrored ? 'block' : 'none';
    content.appendChild(mirrorIndicator);

    const pp = getPartProfile(partName);
    if (!pp) {
      const noProfile = document.createElement('div');
      noProfile.className = 'prop-hint';
      noProfile.textContent = 'No profile for this part in current direction.';
      content.appendChild(noProfile);
      return;
    }

    // Visible checkbox
    const visRow = document.createElement('div');
    visRow.className = 'prop-row';
    const visLabel = document.createElement('label');
    visLabel.className = 'prop-label';
    visLabel.textContent = 'Visible';
    visRow.appendChild(visLabel);
    visibleCheckbox = document.createElement('input');
    visibleCheckbox.type = 'checkbox';
    visibleCheckbox.className = 'prop-checkbox';
    const inputsDisabled = mirrored || animationMode !== 'edit';
    visibleCheckbox.checked = pp.visible;
    visibleCheckbox.disabled = inputsDisabled;
    visibleCheckbox.addEventListener('change', () => {
      if (!visibleCheckbox || inputsDisabled) return;
      previewScene?.updatePartProperty(partName, 'visible', visibleCheckbox.checked);
    });
    visRow.appendChild(visibleCheckbox);
    content.appendChild(visRow);

    // Numeric properties
    for (const { key, label, step } of NUMERIC_PROPS) {
      const row = document.createElement('div');
      row.className = 'prop-row';

      const lbl = document.createElement('label');
      lbl.className = 'prop-label';
      lbl.textContent = label;
      row.appendChild(lbl);

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'prop-input';
      input.step = String(step);
      input.value = String(pp[key] ?? (key === 'alpha' ? 1 : 0));
      input.disabled = inputsDisabled;
      inputs.set(key, input);

      input.addEventListener('input', () => {
        if (inputsDisabled) return;
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          previewScene?.updatePartProperty(partName, key, val);
        }
      });

      row.appendChild(input);
      content.appendChild(row);
    }
  }

  return {
    element: panel,
    update: rebuild,
  };
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
    /* Animation mode picker */
    .rig-animation-picker {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .animation-picker-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    .animation-btn-row {
      display: flex;
      gap: 3px;
    }
    .animation-mode-btn {
      flex: 1;
      background: var(--bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 5px 4px;
      font-family: inherit;
      font-size: 10px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }
    .animation-mode-btn:hover {
      background: var(--bg-panel);
      color: var(--text);
    }
    .animation-mode-btn.active {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
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
    /* Persistence toolbar */
    .rig-persistence-toolbar {
      display: flex;
      gap: 4px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .rig-toolbar-btn {
      flex: 1;
      background: var(--bg);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 5px 8px;
      font-family: inherit;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s;
    }
    .rig-toolbar-btn:hover {
      background: var(--bg-panel);
      color: var(--text);
    }
    /* Property panel */
    .rig-property-panel {
      width: 240px;
      flex-shrink: 0;
      background: var(--bg-surface);
      border-left: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .prop-title {
      padding: 8px 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }
    .prop-content {
      padding: 8px 12px;
    }
    .prop-hint {
      color: var(--text-muted);
      font-size: 12px;
      padding: 8px 0;
    }
    .prop-part-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--accent);
      margin-bottom: 8px;
    }
    .prop-mirror-indicator {
      font-size: 11px;
      color: var(--text-muted);
      font-style: italic;
      margin-bottom: 8px;
      padding: 4px 8px;
      background: var(--bg);
      border-radius: 3px;
    }
    .prop-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .prop-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
      width: 70px;
    }
    .prop-input {
      width: 100px;
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 3px 6px;
      font-family: inherit;
      font-size: 12px;
      text-align: right;
    }
    .prop-input:focus {
      outline: 1px solid var(--accent);
      border-color: var(--accent);
    }
    .prop-input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .prop-checkbox {
      accent-color: var(--accent);
    }
    .prop-checkbox:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);
}

// --- Public API ---
export function renderRig(container: HTMLElement): void {
  if (rendered && game) return;

  injectRigStyles();
  container.innerHTML = '';

  const currentDef = AVAILABLE_RIGS[activeRigIndex];

  // Initialize editor profiles (deep clone)
  if (!editorProfiles) {
    editorProfiles = deepCloneProfiles(currentDef);
  }

  // Sidebar (left)
  const sidebar = document.createElement('div');
  sidebar.className = 'rig-sidebar';

  sidebar.appendChild(createRigSelector(AVAILABLE_RIGS, (def) => {
    activeRigIndex = AVAILABLE_RIGS.indexOf(def);
    editorProfiles = deepCloneProfiles(def);
    currentDirection = 'S';
    selectedPartName = null;
    animationMode = 'edit';
    destroyRig();
    renderRig(container);
  }));

  // Persistence toolbar
  sidebar.appendChild(createPersistenceToolbar(() => currentDef));

  sidebar.appendChild(createDirectionPicker((dir) => {
    previewScene?.setDirection(dir);
  }));

  // Animation mode picker
  sidebar.appendChild(createAnimationModePicker((mode) => {
    animationMode = mode;
    if (mode === 'edit') {
      previewScene?.stopAnimation();
    } else {
      previewScene?.startAnimation(mode);
    }
    onAnimationModeChanged?.(mode);
  }));

  const hierarchy = createHierarchyPanel(currentDef.skeleton, (name) => {
    selectedPartName = name;
    previewScene?.selectPart(name);
    onPartSelected?.(name);
    propertyPanel.update(name, currentDirection);
  });
  sidebar.appendChild(hierarchy);

  container.appendChild(sidebar);

  // Scene container (center)
  const sceneContainer = document.createElement('div');
  sceneContainer.className = 'rig-scene-container';
  container.appendChild(sceneContainer);

  // Property panel (right)
  const propertyPanel = createPropertyPanel();
  container.appendChild(propertyPanel.element);

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

  // Wire up callbacks
  onPartSelected = (name) => {
    hierarchy.querySelectorAll('.bone-label.selected').forEach(el => el.classList.remove('selected'));
    if (name) {
      const label = hierarchy.querySelector(`.bone-label[data-part="${name}"]`);
      label?.classList.add('selected');
    }
    propertyPanel.update(name, currentDirection);
  };

  onDirectionChanged = (dir) => {
    propertyPanel.update(selectedPartName, dir);
  };

  onAnimationModeChanged = (mode) => {
    // Refresh property panel — it shows a disabled hint during animation
    propertyPanel.update(selectedPartName, currentDirection);
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
  animationMode = 'edit';
  onPartSelected = null;
  onDirectionChanged = null;
  onAnimationModeChanged = null;
}

/** Get the current editor profiles (for save/export). */
export function getEditorProfiles(): Record<UniqueDirection, DirectionProfile> | null {
  return editorProfiles;
}

/** Set editor profiles (for load). */
export function setEditorProfiles(
  profiles: Record<UniqueDirection, DirectionProfile>,
  definition: RigDefinition,
): string[] {
  const warnings: string[] = [];
  const allParts = collectAllPartNames(definition.skeleton);
  const partSet = new Set(allParts);

  // Check for mismatches
  for (const dir of UNIQUE_DIRECTIONS) {
    const loaded = profiles[dir];
    if (!loaded) continue;
    for (const partName of Object.keys(loaded.parts)) {
      if (!partSet.has(partName)) {
        warnings.push(partName);
      }
    }
  }

  editorProfiles = profiles;
  previewScene?.applyEditorProfiles();
  return [...new Set(warnings)];
}

function collectAllPartNames(bone: BoneDefinition): string[] {
  const names = [bone.name];
  if (bone.children) {
    for (const child of bone.children) {
      names.push(...collectAllPartNames(child));
    }
  }
  return names;
}
