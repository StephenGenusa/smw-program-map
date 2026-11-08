import type { MapView } from '../map/MapView';

export function installToolbar(view: MapView, fileName: () => string): void {
  const stem = () => fileName().replace(/\.[^.]+$/, '');
  document.querySelector<HTMLButtonElement>('#save')!.onclick = async () => {
    await window.api.savePng(await view.captureView(), `${stem()}-view.png`);
  };
  document.querySelector<HTMLButtonElement>('#copy')!.onclick = async () => {
    const png = new Blob([(await view.captureView()) as BlobPart], { type: 'image/png' });
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  };
  document.querySelector<HTMLButtonElement>('#overview')!.onclick = async () => {
    await window.api.savePng(await view.captureOverview(), `${stem()}-overview.png`);
  };
}

export function setToolbarEnabled(enabled: boolean): void {
  for (const id of ['#save', '#copy', '#overview', '#search']) {
    document.querySelector<HTMLInputElement>(id)!.disabled = !enabled;
  }
}
