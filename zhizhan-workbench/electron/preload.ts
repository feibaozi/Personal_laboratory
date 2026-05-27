import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./constants";

contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  isElectron: true,
  onAlertUpdate: (callback: (alert: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, alert: unknown) => {
      callback(alert);
    };
    ipcRenderer.on(IPC_CHANNELS.ALERT_UPDATE, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.ALERT_UPDATE, handler);
    };
  },
  getPythonStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PYTHON_STATUS),
});
