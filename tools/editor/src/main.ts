import { getArea, getAllAreaIds, getDefaultAreaId } from '@game/data/areas/registry';
import type { AreaDefinition } from '@game/data/areas/types';
import { TERRAINS, type TerrainId } from '@game/maps/terrain';
import { OBJECT_KINDS, type ObjectKindId } from '@game/maps/objects';
import { renderMap } from './mapRenderer';
import { renderDialogue } from './dialogueRenderer';
import { renderFlow } from './flowRenderer';
import {
  getState,
  setMode,
  setActiveTerrain,
  setActiveObjectKind,
  setShowConditionalAlternate,
  setShowImpassableOutlines,
  setZoom,
  subscribe,
} from './editorState';
import { serializeTerrainAndObjects } from './exportTypeScript';

type ViewName = 'map' | 'dialogue' | 'flow';

let activeAreaId: string = getDefaultAreaId();
let activeArea: AreaDefinition | undefined;
let activeView: ViewName = 'map';

const areaSelect = document.getElementById('area-select') as HTMLSelectElement;
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const views = document.querySelectorAll<HTMLElement>('.view');
const detailContent = document.getElementById('detail-content') as HTMLPreElement;
const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
const terrainPicker = document.getElementById('terrain-picker') as HTMLDivElement;
const objectPicker = document.getElementById('object-picker') as HTMLDivElement;
const conditionalAltToggle = document.getElementById('conditional-alt-toggle') as HTMLInputElement;
const impassableOutlineToggle = document.getElementById('impassable-outline-toggle') as HTMLInputElement;
const exportBtn = document.getElementById('export-ts-btn') as HTMLButtonElement;
const exportModal = document.getElementById('export-modal') as HTMLDivElement;
const exportModalClose = document.getElementById('export-modal-close') as HTMLButtonElement;
const exportTextarea = document.getElementById('export-textarea') as HTMLTextAreaElement;
const exportCopyBtn = document.getElementById('export-copy-btn') as HTMLButtonElement;
const zoomInBtn = document.getElementById('zoom-in-btn') as HTMLButtonElement;
const zoomOutBtn = document.getElementById('zoom-out-btn') as HTMLButtonElement;
const zoomResetBtn = document.getElementById('zoom-reset-btn') as HTMLButtonElement;
const zoomLabel = document.getElementById('zoom-label') as HTMLSpanElement;

function populateAreaSelector(): void {
  const areaIds = getAllAreaIds();
  areaSelect.innerHTML = '';
  for (const id of areaIds) {
    const area = getArea(id);
    if (!area) continue;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = area.name;
    if (id === activeAreaId) option.selected = true;
    areaSelect.appendChild(option);
  }
}

function populateTerrainPicker(): void {
  terrainPicker.innerHTML = '';
  for (const id of Object.keys(TERRAINS) as TerrainId[]) {
    const def = TERRAINS[id];
    const btn = document.createElement('button');
    btn.className = 'picker-btn';
    btn.dataset.terrain = id;
    btn.textContent = id;
    btn.title = `${def.description} (passable: ${def.passable})`;
    btn.addEventListener('click', () => {
      setActiveTerrain(id);
    });
    terrainPicker.appendChild(btn);
  }
}

function populateObjectPicker(): void {
  objectPicker.innerHTML = '';
  for (const id of Object.keys(OBJECT_KINDS) as ObjectKindId[]) {
    const def = OBJECT_KINDS[id];
    const btn = document.createElement('button');
    btn.className = 'picker-btn';
    btn.dataset.kind = id;
    btn.textContent = id;
    btn.title = `${def.assetPath} (passable: ${def.passable})`;
    btn.addEventListener('click', () => {
      setActiveObjectKind(id);
    });
    objectPicker.appendChild(btn);
  }
}

function reflectStateInUI(): void {
  const s = getState();
  modeButtons.forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === s.mode);
  });
  terrainPicker.querySelectorAll<HTMLButtonElement>('.picker-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.terrain === s.activeTerrain);
  });
  objectPicker.querySelectorAll<HTMLButtonElement>('.picker-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.kind === s.activeObjectKind);
  });
  conditionalAltToggle.checked = s.showConditionalAlternate;
  impassableOutlineToggle.checked = s.showImpassableOutlines;
  zoomLabel.textContent = `${s.zoom.toFixed(1)}×`;
}

function switchView(view: ViewName): void {
  activeView = view;
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  views.forEach((v) => {
    const viewName = v.id.replace('view-', '') as ViewName;
    v.classList.toggle('active', viewName === view);
  });
  // Hide map tools panel on non-map views.
  const mapTools = document.getElementById('map-tools');
  if (mapTools) mapTools.style.display = view === 'map' ? '' : 'none';
  renderActiveView();
}

function loadArea(areaId: string): void {
  const area = getArea(areaId);
  if (!area) return;
  activeAreaId = areaId;
  activeArea = area;
  detailContent.textContent = 'Select an element to inspect.';
  renderActiveView();
}

function renderActiveView(): void {
  if (!activeArea) return;
  const container = document.getElementById(`view-${activeView}`);
  if (!container) return;

  switch (activeView) {
    case 'map':
      renderMap(container, activeArea);
      break;
    case 'dialogue':
      renderDialogue(container, activeArea);
      break;
    case 'flow':
      renderFlow(container, (areaId: string) => {
        areaSelect.value = areaId;
        loadArea(areaId);
        switchView('map');
      });
      break;
  }
}

export function showDetail(data: Record<string, unknown>): void {
  detailContent.textContent = JSON.stringify(data, null, 2);
}

function openExportModal(): void {
  if (!activeArea) return;
  const s = getState();
  exportTextarea.value = serializeTerrainAndObjects(s.terrain, s.objects);
  exportModal.classList.remove('hidden');
}

function closeExportModal(): void {
  exportModal.classList.add('hidden');
}

async function copyExportToClipboard(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportTextarea.value);
    exportCopyBtn.textContent = 'Copied ✓';
    setTimeout(() => { exportCopyBtn.textContent = 'Copy to clipboard'; }, 1500);
  } catch {
    exportTextarea.select();
    document.execCommand('copy');
    exportCopyBtn.textContent = 'Copied ✓';
    setTimeout(() => { exportCopyBtn.textContent = 'Copy to clipboard'; }, 1500);
  }
}

// Event listeners
areaSelect.addEventListener('change', () => {
  loadArea(areaSelect.value);
});

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view as ViewName;
    if (view) switchView(view);
  });
});

modeButtons.forEach((b) => {
  b.addEventListener('click', () => {
    const m = b.dataset.mode as ReturnType<typeof getState>['mode'];
    if (m) setMode(m);
  });
});

conditionalAltToggle.addEventListener('change', () => {
  setShowConditionalAlternate(conditionalAltToggle.checked);
});

impassableOutlineToggle.addEventListener('change', () => {
  setShowImpassableOutlines(impassableOutlineToggle.checked);
});

zoomInBtn.addEventListener('click', () => setZoom(getState().zoom * 1.2));
zoomOutBtn.addEventListener('click', () => setZoom(getState().zoom / 1.2));
zoomResetBtn.addEventListener('click', () => setZoom(1));
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return;
  if (e.key === '=' || e.key === '+') { e.preventDefault(); setZoom(getState().zoom * 1.2); }
  else if (e.key === '-') { e.preventDefault(); setZoom(getState().zoom / 1.2); }
  else if (e.key === '0') { e.preventDefault(); setZoom(1); }
});

exportBtn.addEventListener('click', openExportModal);
exportModalClose.addEventListener('click', closeExportModal);
exportCopyBtn.addEventListener('click', copyExportToClipboard);
exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) closeExportModal();
});

subscribe(reflectStateInUI);

// Initialise
populateAreaSelector();
populateTerrainPicker();
populateObjectPicker();
reflectStateInUI();
loadArea(activeAreaId);
