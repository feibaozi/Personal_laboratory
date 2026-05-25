import {
  app,
  BrowserWindow,
  screen,
} from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipc-handlers";

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");

let mainWindow: BrowserWindow | null = null;

function getWindow(): BrowserWindow | null {
  return mainWindow;
}

function getDefaultBounds() {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  return {
    x: Math.round(sw - 420),
    y: Math.round(sh - 690),
    width: 400,
    height: 650,
  };
}

let savedBounds: { x: number; y: number; width: number; height: number } | null = null;

function createMainWindow(devUrl?: string): BrowserWindow {
  const bounds = savedBounds || getDefaultBounds();

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 320,
    minHeight: 500,
    transparent: true,
    frame: false,
    title: "",
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    show: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setAlwaysOnTop(false);

  mainWindow.setTitle(" ");
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "../out/index.html")
    );
  }

  mainWindow.on("close", () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      savedBounds = { x, y, width, height };
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  const win = getWindow();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  }
});

app.whenReady().then(() => {
  registerIpcHandlers(getWindow);

  const cliArgs = process.argv.slice(1);
  const devIndex = cliArgs.indexOf("--dev");

  let devUrl: string | undefined;
  if (devIndex !== -1) {
    devUrl = "http://localhost:3001";
  }

  createMainWindow(devUrl);
});

app.on("window-all-closed", () => {
  app.quit();
});