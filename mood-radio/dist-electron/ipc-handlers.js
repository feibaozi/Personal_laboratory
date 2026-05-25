"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const constants_1 = require("./constants");
let isAlwaysOnTop = false;
let dragStartPos = null;
function registerIpcHandlers(getWindow) {
    const { ipcMain } = require("electron");
    ipcMain.on(constants_1.IPC.WINDOW_MINIMIZE, () => {
        const win = getWindow();
        if (win)
            win.minimize();
    });
    ipcMain.on(constants_1.IPC.WINDOW_CLOSE, () => {
        const win = getWindow();
        if (win)
            win.close();
    });
    ipcMain.on(constants_1.IPC.WINDOW_TOGGLE_TOP, () => {
        const win = getWindow();
        if (!win)
            return;
        isAlwaysOnTop = !isAlwaysOnTop;
        win.setAlwaysOnTop(isAlwaysOnTop);
    });
    ipcMain.handle(constants_1.IPC.WINDOW_GET_IS_TOP, () => {
        return isAlwaysOnTop;
    });
    ipcMain.on(constants_1.IPC.WINDOW_START_DRAG, () => {
        const win = getWindow();
        if (!win)
            return;
        const { screen } = require("electron");
        const cursorPos = screen.getCursorScreenPoint();
        const winPos = win.getPosition();
        dragStartPos = {
            x: cursorPos.x,
            y: cursorPos.y,
            winX: winPos[0],
            winY: winPos[1],
        };
    });
    ipcMain.on(constants_1.IPC.WINDOW_UPDATE_POSITION, (_, deltaX, deltaY) => {
        const win = getWindow();
        if (!win || !dragStartPos)
            return;
        const newX = dragStartPos.winX + deltaX;
        const newY = dragStartPos.winY + deltaY;
        win.setPosition(newX, newY);
    });
}
