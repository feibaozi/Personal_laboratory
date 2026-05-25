"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMainWindow = createMainWindow;
exports.getMainWindow = getMainWindow;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
let mainWindow = null;
function createMainWindow(devUrl) {
    const primary = electron_1.screen.getPrimaryDisplay();
    const { width: sw, height: sh } = primary.workAreaSize;
    mainWindow = new electron_1.BrowserWindow({
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
            preload: path_1.default.join(__dirname, '../../preload/preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    // Capture renderer console errors for debugging
    mainWindow.webContents.on('console-message', (_e, level, message) => {
        if (level >= 3)
            console.error(`[RENDERER] ${message}`);
    });
    if (devUrl) {
        mainWindow.loadURL(devUrl);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../../renderer/index.html'));
    }
    return mainWindow;
}
function getMainWindow() {
    return mainWindow;
}
//# sourceMappingURL=window.js.map