import type { MapView } from '../map/MapView';
import { guarded } from './guard';
import { showMessage } from './Message';

export function installToolbar(view: MapView, fileName: () => string): void {
  const stem = () => fileName().replace(/\.[^.]+$/, '');
  document.querySelector<HTMLButtonElement>('#save')!.onclick = guarded('Saving the image', async () => {
    await window.api.savePng(await view.captureView(), `${stem()}-view.png`);
  }, showMessage);
  document.querySelector<HTMLButtonElement>('#copy')!.onclick = guarded('Copying the image', async () => {
    const png = new Blob([(await view.captureView()) as BlobPart], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }, showMessage);
  document.querySelector<HTMLButtonElement>('#overview')!.onclick = guarded('Exporting the overview', async () => {
    await window.api.savePng(await view.captureOverview(), `${stem()}-overview.png`);
  }, showMessage);
}

export function setToolbarEnabled(enabled: boolean): void {
  for (const id of ['#save', '#copy', '#overview', '#search']) {
    document.querySelector<HTMLInputElement>(id)!.disabled = !enabled;
  }
}
