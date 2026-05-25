"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const database_1 = require("./database");
const window_1 = require("./window");
const ipc_handlers_1 = require("./ipc-handlers");
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
}
electron_1.app.on('second-instance', () => {
    const win = (0, window_1.getMainWindow)();
    if (win && !win.isDestroyed()) {
        if (win.isMinimized())
            win.restore();
        if (!win.isVisible())
            win.show();
        win.focus();
    }
});
electron_1.app.whenReady().then(async () => {
    await (0, database_1.initDatabase)();
    (0, ipc_handlers_1.registerIpcHandlers)();
    const devUrl = process.argv.includes('--dev')
        ? process.argv[process.argv.indexOf('--dev-url') + 1] || 'http://localhost:5173'
        : undefined;
    (0, window_1.createMainWindow)(devUrl);
});
electron_1.app.on('window-all-closed', () => {
    electron_1.app.quit();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        (0, window_1.createMainWindow)();
    }
});
//# sourceMappingURL=index.js.map