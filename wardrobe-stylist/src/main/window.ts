import { BrowserWindow, screen } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(devUrl?: string): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;

  mainWindow = new BrowserWindow({
    x: Math.round((sw - 1280) / 2),
    y: Math.round((sh - 800) / 2),
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'Wardrobe Stylist',
    frame: true,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#FAFAF8',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Capture renderer console errors for debugging
  mainWindow.webContents.on('console-message', (_e, level, message) => {
    if (level >= 3) console.error(`[RENDERER] ${message}`);
  });

  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
