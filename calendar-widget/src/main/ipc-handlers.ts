import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as db from './database';
import { showNotificationWindow } from './notification-window';
import { IPC_CHANNELS } from '../shared/constants';

export function registerIpcHandlers(): void {
  // ---- Todos ----

  ipcMain.handle(IPC_CHANNELS.TODOS_GET_ALL, () => {
    return db.getAllTodos();
  });

  ipcMain.handle(IPC_CHANNELS.TODOS_GET_BY_DATE, (_event, date: string) => {
    return db.getTodosByDate(date);
  });

  ipcMain.handle(
    IPC_CHANNELS.TODOS_GET_BY_WEEK,
    (_event, startDate: string, endDate: string) => {
      return db.getTodosByWeek(startDate, endDate);
    }
  );

  ipcMain.handle(IPC_CHANNELS.TODO_CREATE, (_event, todo: any) => {
    return db.createTodo(todo);
  });

  ipcMain.handle(IPC_CHANNELS.TODO_UPDATE, (_event, id: string, patch: any) => {
    return db.updateTodo(id, patch);
  });

  ipcMain.handle(IPC_CHANNELS.TODO_DELETE, (_event, id: string) => {
    db.deleteTodo(id);
  });

  // ---- Categories ----

  ipcMain.handle(IPC_CHANNELS.CATEGORIES_GET_ALL, () => {
    return db.getAllCategories();
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_CREATE, (_event, category: any) => {
    return db.createCategory(category);
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_UPDATE, (_event, id: string, patch: any) => {
    return db.updateCategory(id, patch);
  });

  ipcMain.handle(IPC_CHANNELS.CATEGORY_DELETE, (_event, id: string) => {
    db.deleteCategory(id);
  });

  // ---- Settings ----

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_event, key: string) => {
    return db.getSetting(key) ?? null;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, key: string, value: string) => {
    db.setSetting(key, value);
  });

  // ---- Window controls ----

  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, (event, flag: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.setAlwaysOnTop(flag);
  });

  ipcMain.on(IPC_CHANNELS.WINDOW_SET_IGNORE_MOUSE, (event, ignore: boolean) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (ignore) {
      win?.setIgnoreMouseEvents(true, { forward: true });
    } else {
      win?.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW_SET_AUTO_START, (_event, enable: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
    });
  });

  // ---- Notifications ----

  ipcMain.handle(IPC_CHANNELS.NOTIFICATION_TEST, () => {
    showNotificationWindow(
      {
        title: '测试提醒',
        startTime: '--:--',
        endTime: '--:--',
        categoryName: '测试',
      },
      0,
    );
  });

  // ---- Workbench ----

  ipcMain.handle(IPC_CHANNELS.LAUNCH_WORKBENCH, () => {
    const child = spawn('python', ['C:/Users/hexi/Desktop/WORKBENCH/main.py'], {
      detached: true,
      stdio: 'ignore',
      shell: true,
    });
    child.unref();
    return { success: true };
  });

  // ---- Data management ----

  ipcMain.handle(IPC_CHANNELS.DATA_SAVE_SNAPSHOT, (_event, name: string) => {
    return db.saveSnapshot(name);
  });

  ipcMain.handle(IPC_CHANNELS.DATA_GET_SNAPSHOTS, () => {
    return db.getSnapshots();
  });

  ipcMain.handle(IPC_CHANNELS.DATA_RESTORE_SNAPSHOT, (_event, id: string) => {
    return db.restoreSnapshot(id);
  });

  ipcMain.handle(IPC_CHANNELS.DATA_DELETE_SNAPSHOT, (_event, id: string) => {
    db.deleteSnapshot(id);
  });

  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出数据',
      defaultPath: `calendar-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false };
    try {
      const exportData = db.exportAllData();
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DATA_IMPORT, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '导入数据',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return { success: false };
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf-8');
      const json = JSON.parse(raw);
      db.importData(json);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
