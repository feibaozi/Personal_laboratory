"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipc_handlers_1 = require("./ipc-handlers");
const database_1 = require("./db/database");
const nodes_1 = require("./db/nodes");
electron_1.app.commandLine.appendSwitch("disable-gpu-sandbox");
electron_1.app.commandLine.appendSwitch("no-sandbox");
electron_1.protocol.registerSchemesAsPrivileged([
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
let mainWindow = null;
let clipboardWatcher = null;
let lastClipboardText = "";
function getWindow() {
    return mainWindow;
}
function getDefaultBounds() {
    const primary = electron_1.screen.getPrimaryDisplay();
    const { width: sw, height: sh } = primary.workAreaSize;
    return {
        x: Math.round((sw - 1200) / 2),
        y: Math.round((sh - 800) / 2),
        width: 1200,
        height: 800,
    };
}
let savedBounds = null;
function isInterestingClipboard(text) {
    if (!text || text.trim().length < 20)
        return false;
    if (text === lastClipboardText)
        return false;
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
    if (clipboardWatcher)
        return;
    const enabled = (0, database_1.getConfig)("clipboard_watch") !== "false";
    if (!enabled)
        return;
    lastClipboardText = electron_1.clipboard.readText();
    clipboardWatcher = setInterval(() => {
        if (!mainWindow || mainWindow.isDestroyed())
            return;
        const currentText = electron_1.clipboard.readText();
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
function createMainWindow(devUrl) {
    const bounds = savedBounds || getDefaultBounds();
    mainWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, "preload.js"),
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
    }
    else {
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
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
electron_1.app.on("second-instance", () => {
    const win = getWindow();
    if (win && !win.isDestroyed()) {
        if (win.isMinimized())
            win.restore();
        if (!win.isVisible())
            win.show();
        win.focus();
    }
});
electron_1.app.whenReady().then(async () => {
    const outDir = path_1.default.join(__dirname, "../out");
    electron_1.protocol.handle("app", (request) => {
        const url = new URL(request.url);
        const filePath = path_1.default.join(outDir, url.pathname);
        return electron_1.net.fetch(`file:///${filePath.replace(/\\/g, "/")}`);
    });
    await (0, database_1.initDatabase)();
    const savedFwId = (0, database_1.getConfig)("current_framework_id");
    if (savedFwId) {
        (0, nodes_1.setCurrentFrameworkId)(parseInt(savedFwId, 10));
    }
    (0, ipc_handlers_1.registerIpcHandlers)(getWindow);
    const { ipcMain } = require("electron");
    ipcMain.handle("clipboard:toggle", async (_, enabled) => {
        (0, database_1.setConfig)("clipboard_watch", enabled ? "true" : "false");
        if (enabled)
            startClipboardWatcher();
        else
            stopClipboardWatcher();
        return true;
    });
    const cliArgs = process.argv.slice(1);
    const devIndex = cliArgs.indexOf("--dev");
    let devUrl;
    if (devIndex !== -1) {
        devUrl = "http://localhost:3002";
    }
    createMainWindow(devUrl);
});
electron_1.app.on("window-all-closed", () => {
    electron_1.app.quit();
});
