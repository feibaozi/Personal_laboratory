"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const constants_1 = require("./constants");
const api = {
    minimizeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_MINIMIZE),
    closeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_CLOSE),
    toggleAlwaysOnTop: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_TOGGLE_TOP),
    getIsAlwaysOnTop: () => electron_1.ipcRenderer.invoke(constants_1.IPC.WINDOW_GET_IS_TOP),
    startDrag: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_START_DRAG),
    updateWindowPosition: (deltaX, deltaY) => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_UPDATE_POSITION, deltaX, deltaY),
    isElectron: true,
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", api);
