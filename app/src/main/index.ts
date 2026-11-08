import { app, BrowserWindow, dialog, ipcMain, session } from 'electron';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watchFile } from './fileWatch';

const here = dirname(fileURLToPath(import.meta.url));
const devUrl = process.env.ELECTRON_RENDERER_URL;

const WATCHABLE = /\.(smw|umc|cmc)$/i;
let stopWatching: (() => void) | null = null;

function allowed(url: string): boolean {
  if (!/^https?:/.test(url)) return true;
  return Boolean(devUrl) && url.startsWith(devUrl!);
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'SMW Program Map',
    icon: join(here, '../../resources/icon.png'),
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

ipcMain.handle('watch-file', (event, path: string | null) => {
  stopWatching?.();
  stopWatching = null;
  if (path === null || !WATCHABLE.test(path)) return;
  stopWatching = watchFile(path, (bytes) => {
    if (!event.sender.isDestroyed()) event.sender.send('file-changed', path, bytes);
  });
});

void app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, done) => done({ cancel: !allowed(details.url) }));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
