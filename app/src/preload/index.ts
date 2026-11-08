import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  savePng: (bytes: Uint8Array, suggestedName: string): Promise<boolean> =>
    ipcRenderer.invoke('save-png', bytes, suggestedName),
});
