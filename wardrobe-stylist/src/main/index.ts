import { app, BrowserWindow } from 'electron';
import { initDatabase } from './database';
import { createMainWindow, getMainWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on('second-instance', () => {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }
});

app.whenReady().then(async () => {
  await initDatabase();
  registerIpcHandlers();

  const devUrl = process.argv.includes('--dev')
    ? process.argv[process.argv.indexOf('--dev-url') + 1] || 'http://localhost:5173'
    : undefined;

  createMainWindow(devUrl);
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
