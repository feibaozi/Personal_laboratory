import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./constants";

const api = {
  minimizeWindow: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  toggleAlwaysOnTop: () => ipcRenderer.send(IPC.WINDOW_TOGGLE_TOP),
  getIsAlwaysOnTop: () => ipcRenderer.invoke(IPC.WINDOW_GET_IS_TOP),
  startDrag: () => ipcRenderer.send(IPC.WINDOW_START_DRAG),
  updateWindowPosition: (deltaX: number, deltaY: number) => 
    ipcRenderer.send(IPC.WINDOW_UPDATE_POSITION, deltaX, deltaY),
  isElectron: true,
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;