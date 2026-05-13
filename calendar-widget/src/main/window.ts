import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { getSetting, setSetting } from './database';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(devUrl?: string): BrowserWindow {
  const bounds = getSavedBounds();

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 500,
    minHeight: 350,
    transparent: true,
    frame: false,
    title: '',
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../../preload/preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Widget layer: above desktop icons, below normal apps
  mainWindow.setAlwaysOnTop(false);

  // Prevent Windows 11 from showing native title bar
  mainWindow.setTitle(' ');
  mainWindow.on('page-title-updated', (e) => e.preventDefault());

  // Intercept WM_NCCALCSIZE to remove non-client area on Windows
  if (process.platform === 'win32') {
    mainWindow.hookWindowMessage(0x0083, () => {
      return { action: 'reset' };
    });
  }

  if (devUrl) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.setTitle(' ');
  });

  mainWindow.on('close', () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      saveBounds({ x, y, width, height });
    }
  });

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

function getSavedBounds() {
  try {
    const data = getSetting('windowBounds');
    if (data) {
      const bounds = JSON.parse(data);
      // Validate bounds are on a visible display
      const displays = screen.getAllDisplays();
      const visible = displays.some((d) => {
        const { x, y, width, height } = d.bounds;
        return (
          bounds.x >= x - 100 &&
          bounds.y >= y - 100 &&
          bounds.x + bounds.width <= x + width + 100 &&
          bounds.y + bounds.height <= y + height + 100
        );
      });
      if (visible && bounds.width > 0 && bounds.height > 0) {
        return bounds;
      }
    }
  } catch {
    // Use default
  }

  // Center on primary display
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  return {
    x: Math.round((sw - 700) / 2),
    y: Math.round((sh - 500) / 2),
    width: 700,
    height: 500,
  };
}

function saveBounds(bounds: { x: number; y: number; width: number; height: number }) {
  try {
    setSetting('windowBounds', JSON.stringify(bounds));
  } catch {
    // Ignore save errors
  }
}
