import {
  app,
  BrowserWindow,
  screen,
  clipboard,
  nativeImage,
  protocol,
  net,
} from "electron";
import path from "path";
import { registerIpcHandlers } from "./ipc-handlers";
import { initDatabase, getConfig, setConfig } from "./db/database";
import { setCurrentFrameworkId } from "./db/nodes";

app.commandLine.appendSwitch("disable-gpu-sandbox");
app.commandLine.appendSwitch("no-sandbox");

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let clipboardWatcher: NodeJS.Timeout | null = null;
let lastClipboardText: string = "";

function getWindow(): BrowserWindow | null {
  return mainWindow;
}

function getDefaultBounds() {
  const primary = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = primary.workAreaSize;
  return {
    x: Math.round((sw - 1200) / 2),
    y: Math.round((sh - 800) / 2),
    width: 1200,
    height: 800,
  };
}

let savedBounds: { x: number; y: number; width: number; height: number } | null = null;

function isInterestingClipboard(text: string): boolean {
  if (!text || text.trim().length < 20) return false;
  if (text === lastClipboardText) return false;

  const codeIndicators = [
    /function\s+\w+/,
    /const\s+\w+\s*=/,
    /import\s+/,
    /class\s+\w+/,
    /Error:/,
    /error/i,
    /Exception/,
    /at\s+\w+\s*\(/,
    /\.ts\(\d+,\d+\)/,
    /npm\s+ERR!/,
    /TypeError/,
    /ReferenceError/,
    /SyntaxError/,
    /ENOENT/,
    /EPERM/,
    /Cannot read propert/,
    /is not defined/,
    /is not a function/,
    /Failed to compile/,
    /Module not found/,
  ];

  return codeIndicators.some((pattern) => pattern.test(text));
}

function startClipboardWatcher() {
  if (clipboardWatcher) return;

  const enabled = getConfig("clipboard_watch") !== "false";
  if (!enabled) return;

  lastClipboardText = clipboard.readText();

  clipboardWatcher = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const currentText = clipboard.readText();
    if (isInterestingClipboard(currentText)) {
      const snippet = currentText.length > 500 ? currentText.substring(0, 500) + "..." : currentText;
      mainWindow.webContents.send("clipboard:capture", snippet);
      lastClipboardText = currentText;
    }
  }, 2000);
}

function stopClipboardWatcher() {
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher);
    clipboardWatcher = null;
  }
}

function createMainWindow(devUrl?: string): BrowserWindow {
  const bounds = savedBounds || getDefaultBounds();

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: 900,
    minHeight: 600,
    transparent: false,
    frame: false,
    title: "ThinkGarden",
    skipTaskbar: false,
    resizable: true,
    hasShadow: true,
    show: true,
    backgroundColor: "#0f0f1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.setAlwaysOnTop(false);

  mainWindow.setTitle("ThinkGarden");
  mainWindow.on("page-title-updated", (e) => e.preventDefault());

  if (devUrl) {
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadURL("app://./index.html");
  }

  mainWindow.on("close", () => {
    if (mainWindow) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      savedBounds = { x, y, width, height };
    }
    stopClipboardWatcher();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopClipboardWatcher();
  });

  mainWindow.on("focus", () => {
    startClipboardWatcher();
  });

  mainWindow.on("blur", () => {
    stopClipboardWatcher();
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
  const outDir = path.join(__dirname, "../out");

  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const filePath = path.join(outDir, url.pathname);
    return net.fetch(`file:///${filePath.replace(/\\/g, "/")}`);
  });

  await initDatabase();

  const savedFwId = getConfig("current_framework_id");
  if (savedFwId) {
    setCurrentFrameworkId(parseInt(savedFwId, 10));
  }

  registerIpcHandlers(getWindow);

  const { ipcMain } = require("electron");
  ipcMain.handle("clipboard:toggle", async (_: any, enabled: boolean) => {
    setConfig("clipboard_watch", enabled ? "true" : "false");
    if (enabled) startClipboardWatcher();
    else stopClipboardWatcher();
    return true;
  });

  const cliArgs = process.argv.slice(1);
  const devIndex = cliArgs.indexOf("--dev");

  let devUrl: string | undefined;
  if (devIndex !== -1) {
    devUrl = "http://localhost:3002";
  }

  createMainWindow(devUrl);
});

app.on("window-all-closed", () => {
  app.quit();
});
