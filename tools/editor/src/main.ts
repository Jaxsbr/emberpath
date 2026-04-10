import { getArea, getAllAreaIds, getDefaultAreaId } from '@game/data/areas/registry';
import type { AreaDefinition } from '@game/data/areas/types';
import { renderMap } from './mapRenderer';
import { renderDialogue } from './dialogueRenderer';
import { renderFlow } from './flowRenderer';
import { renderRig, destroyRig } from './rigRenderer';

type ViewName = 'map' | 'dialogue' | 'flow' | 'rig';

let activeAreaId: string = getDefaultAreaId();
let activeArea: AreaDefinition | undefined;
let activeView: ViewName = 'map';

const areaSelect = document.getElementById('area-select') as HTMLSelectElement;
const tabs = document.querySelectorAll<HTMLButtonElement>('.tab');
const views = document.querySelectorAll<HTMLElement>('.view');
const detailContent = document.getElementById('detail-content') as HTMLPreElement;

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

function switchView(view: ViewName): void {
  activeView = view;
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.view === view);
  });
  views.forEach(v => {
    const viewName = v.id.replace('view-', '') as ViewName;
    v.classList.toggle('active', viewName === view);
  });
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
  // Destroy rig scene when switching away from rig tab
  if (activeView !== 'rig') {
    destroyRig();
  }

  if (activeView === 'rig') {
    const container = document.getElementById('view-rig');
    if (container) renderRig(container);
    return;
  }

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

// Event listeners
areaSelect.addEventListener('change', () => {
  loadArea(areaSelect.value);
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view as ViewName;
    if (view) switchView(view);
  });
});

// Initialize
populateAreaSelector();
loadArea(activeAreaId);
