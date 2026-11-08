import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const devUrl = process.env.ELECTRON_RENDERER_URL;

function allowed(url: string): boolean {
  if (!/^https?:/.test(url)) return true;
  return Boolean(devUrl) && url.startsWith(devUrl!);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'SMW Program Map',
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(join(here, '../renderer/index.html'));
}

ipcMain.handle('save-png', async (event, bytes: Uint8Array, suggestedName: string) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const options = { defaultPath: suggestedName, filters: [{ name: 'PNG image', extensions: ['png'] }] };
  const { canceled, filePath } = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return false;
  await writeFile(filePath, bytes);
  return true;
});

void app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, done) => done({ cancel: !allowed(details.url) }));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
