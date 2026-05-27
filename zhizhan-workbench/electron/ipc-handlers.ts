import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "./constants";
import { isPythonRunning } from "./python-manager";

export function registerIpcHandlers(getWindow: () => BrowserWindow | null) {
  ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
    const win = getWindow();
    win?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
    const win = getWindow();
    win?.close();
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
    const win = getWindow();
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.PYTHON_STATUS, () => {
    return isPythonRunning();
  });
}
