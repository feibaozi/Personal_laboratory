"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const ipc_handlers_1 = require("./ipc-handlers");
electron_1.app.commandLine.appendSwitch("disable-gpu-sandbox");
electron_1.app.commandLine.appendSwitch("no-sandbox");
let mainWindow = null;
function getWindow() {
    return mainWindow;
}
function getDefaultBounds() {
    const primary = electron_1.screen.getPrimaryDisplay();
    const { width: sw, height: sh } = primary.workAreaSize;
    return {
        x: Math.round(sw - 420),
        y: Math.round(sh - 690),
        width: 400,
        height: 650,
    };
}
let savedBounds = null;
function createMainWindow(devUrl) {
    const bounds = savedBounds || getDefaultBounds();
    mainWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, "preload.js"),
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
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, "../out/index.html"));
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
electron_1.app.whenReady().then(() => {
    (0, ipc_handlers_1.registerIpcHandlers)(getWindow);
    const cliArgs = process.argv.slice(1);
    const devIndex = cliArgs.indexOf("--dev");
    let devUrl;
    if (devIndex !== -1) {
        devUrl = "http://localhost:3001";
    }
    createMainWindow(devUrl);
});
electron_1.app.on("window-all-closed", () => {
    electron_1.app.quit();
});
