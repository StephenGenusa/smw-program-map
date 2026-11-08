import { showMessage } from './Message';

const OPENABLE = /\.(smw|umc|cmc)$/i;

export function installDropZone(onFile: (file: File) => void): void {
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files ?? [])];
    const isFolder = [...(e.dataTransfer?.items ?? [])].some((i) => i.webkitGetAsEntry()?.isDirectory);
    if (files.length > 1 || isFolder) return showMessage('Drop one file at a time.');
    const file = files[0];
    if (!file) return;
    if (!OPENABLE.test(file.name)) return showMessage('Only .smw, .umc and .cmc files can be opened.');
    onFile(file);
  });
}
