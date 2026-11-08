import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('api', {
  savePng: (bytes: Uint8Array, suggestedName: string): Promise<boolean> =>
    ipcRenderer.invoke('save-png', bytes, suggestedName),
  pathFor: (file: File): string => webUtils.getPathForFile(file),
  watchFile: (path: string | null): Promise<void> => ipcRenderer.invoke('watch-file', path),
  onFileChanged: (listener: (path: string, bytes: Uint8Array) => void): void => {
    ipcRenderer.on('file-changed', (_event, path: string, bytes: Uint8Array) => listener(path, bytes));
  },
});
