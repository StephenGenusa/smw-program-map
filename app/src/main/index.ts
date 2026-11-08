import { app, BrowserWindow } from 'electron';

app.whenReady().then(() => new BrowserWindow().loadURL('about:blank'));
