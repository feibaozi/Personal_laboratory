import { BrowserWindow } from "electron";
import { IPC } from "./constants";

let isAlwaysOnTop = false;
let dragStartPos: { x: number; y: number; winX: number; winY: number } | null = null;

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null
) {
  const { ipcMain } = require("electron");

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    const win = getWindow();
    if (win) win.minimize();
  });

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    const win = getWindow();
    if (win) win.close();
  });

  ipcMain.on(IPC.WINDOW_TOGGLE_TOP, () => {
    const win = getWindow();
    if (!win) return;
    isAlwaysOnTop = !isAlwaysOnTop;
    win.setAlwaysOnTop(isAlwaysOnTop);
  });

  ipcMain.handle(IPC.WINDOW_GET_IS_TOP, () => {
    return isAlwaysOnTop;
  });

  ipcMain.on(IPC.WINDOW_START_DRAG, () => {
    const win = getWindow();
    if (!win) return;
    
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

  ipcMain.on(IPC.WINDOW_UPDATE_POSITION, (_: any, deltaX: number, deltaY: number) => {
    const win = getWindow();
    if (!win || !dragStartPos) return;
    
    const newX = dragStartPos.winX + deltaX;
    const newY = dragStartPos.winY + deltaY;
    
    win.setPosition(newX, newY);
  });
}