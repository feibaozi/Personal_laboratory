import {
  app,
  BrowserWindow,
  screen,
} from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipc-handlers";
import { startPythonBackend, stopPythonBackend } from "./python-manager";

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");

let mainWindow: BrowserWindow | null = null;

function getWindow(): BrowserWindow | null {
  return mainWindow;
}

function createMainWindow(devUrl?: string): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  const winWidth = Math.min(1400, sw - 100);
  const winHeight = Math.min(900, sh - 100);
  const x = Math.round((sw - winWidth) / 2);
  const y = Math.round((sh - winHeight) / 2);

  mainWindow = new BrowserWindow({
    x,
    y,
    width: winWidth,
    height: winHeight,
    minWidth: 1024,
    minHeight: 700,
    title: "智研工作台",
    show: false,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setTitle("智研工作台");

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../out/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
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

app.whenReady().then(async () => {
  registerIpcHandlers(getWindow);

  try {
    await startPythonBackend();
  } catch (err) {
    console.error("[Main] Python backend failed to start:", err);
  }

  const cliArgs = process.argv.slice(1);
  const devIndex = cliArgs.indexOf("--dev");

  let devUrl: string | undefined;
  if (devIndex !== -1) {
    devUrl = "http://localhost:3001";
  }

  createMainWindow(devUrl);
});

app.on("window-all-closed", () => {
  stopPythonBackend();
  app.quit();
});

app.on("before-quit", () => {
  stopPythonBackend();
});
