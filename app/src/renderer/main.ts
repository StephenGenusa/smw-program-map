import './styles.css';
import { boxPath } from '../core/connections';
import { buildIndex } from '../core/search';
import type { LoadResult } from '../worker/pipeline';
import { loadFile } from './load';
import { MapView } from './map/MapView';
import { occurrences } from './map/highlight';
import { clearMessage, showMessage } from './ui/Message';
import { installDropZone } from './ui/DropZone';
import { clearOccurrences, showOccurrences } from './ui/Occurrences';
import { SearchBox } from './ui/SearchBox';
import { installToolbar, setToolbarEnabled } from './ui/Toolbar';

type Loaded = Extract<LoadResult, { status: 'ok' }>;

const view = new MapView(document.querySelector<HTMLElement>('#map')!);
const title = document.querySelector<HTMLElement>('#title')!;
const empty = document.querySelector<HTMLElement>('#empty')!;
const progress = document.querySelector<HTMLElement>('#progress')!;
let current: Loaded | null = null;
let fileName = 'program';
let openedPath: string | null = null;
const autoReload = document.querySelector<HTMLInputElement>('#autoreload')!;

const STAGE_TEXT = { parse: 'Reading', connect: 'Connecting', layout: 'Arranging' };

function nodePath(id: number): string {
  return current ? boxPath(current.program, id) : '';
}

function selectSignal(signalId: number): void {
  if (!current) return;
  const places = occurrences(current.program, signalId);
  showOccurrences(current.program.signals.get(signalId)!.name, places.map((o) => ({ text: nodePath(o.nodeId), nodeId: o.nodeId })), (id) => view.flyTo(id));
}

const searchBox = new SearchBox({
  symbol(nodeId) {
    clearOccurrences();
    view.highlightNodes([nodeId]);
    view.flyTo(nodeId);
  },
  type(nodeIds, text) {
    view.highlightNodes(nodeIds);
    showOccurrences(text, nodeIds.map((id) => ({ text: nodePath(id), nodeId: id })), (id) => view.flyTo(id));
    view.flyTo(nodeIds[0]!);
  },
  signal(signalId) {
    view.highlightSignal(signalId);
    selectSignal(signalId);
    const first = current && occurrences(current.program, signalId)[0];
    if (first) view.flyTo(first.nodeId);
  },
});

view.onSignalClick = selectSignal;
view.onClear = clearOccurrences;
installToolbar(view, () => fileName);
installDropZone(async (file) => {
  if (!(await open(file))) return;
  openedPath = window.api.pathFor(file) || null;
  autoReload.disabled = openedPath === null;
  if (openedPath === null) autoReload.checked = false;
  syncWatch();
});
setToolbarEnabled(false);
autoReload.onchange = syncWatch;
window.api.onFileChanged((path, bytes) => {
  if (path === openedPath) void open(new File([bytes as BlobPart], fileName), true);
});

function syncWatch(): void {
  void window.api.watchFile(autoReload.checked ? openedPath : null);
}

/** Resolves to whether the file is now showing. A reload keeps the user's place on the map. */
async function open(file: File, reload = false): Promise<boolean> {
  clearMessage();
  progress.hidden = false;
  progress.textContent = 'Reading…';
  const result = await loadFile(file, (stage, done, total) => {
    progress.textContent = stage === 'layout' && total > 1 ? `${STAGE_TEXT[stage]} ${Math.round((done / total) * 100)}%` : `${STAGE_TEXT[stage]}…`;
  });
  if (result === 'superseded') return false;
  progress.hidden = true;
  if (result.status === 'protected') {
    showMessage(`${result.name ? `${result.name}: ` : ''}This file is protected and can't be displayed.`);
  } else if (result.status === 'unreadable') {
    showMessage("This isn't a readable SIMPL program.");
  } else {
    current = result;
    fileName = file.name;
    title.textContent = result.program.title;
    empty.hidden = true;
    clearOccurrences();
    setToolbarEnabled(true);
    await view.show(result, { keepView: reload });
    searchBox.setIndex(buildIndex(result.program));
    return true;
  }
  return false;
}
