import { app, BrowserWindow } from 'electron';
import { initDatabase } from './database';
import { createMainWindow, getMainWindow } from './window';
import { registerIpcHandlers } from './ipc-handlers';
import { createTray } from './tray';
import { startNotificationScheduler } from './notification-scheduler';

// Prevent multiple instances
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

app.whenReady().then(() => {
  initDatabase();
  registerIpcHandlers();
  createTray();
  startNotificationScheduler();

  // Check for --dev flag
  const devUrl = process.argv.includes('--dev')
    ? process.argv[process.argv.indexOf('--dev-url') + 1] || 'http://localhost:5173'
    : undefined;

  createMainWindow(devUrl);

  // Apply click-through for empty areas
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(false);
  }
});

app.on('window-all-closed', () => {
  // Don't quit on window close; keep running in tray
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
