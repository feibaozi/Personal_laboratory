import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

const api = {
  // Todos
  getTodosAll: () => ipcRenderer.invoke(IPC_CHANNELS.TODOS_GET_ALL),
  getTodosByDate: (date: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TODOS_GET_BY_DATE, date),
  getTodosByWeek: (startDate: string, endDate: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.TODOS_GET_BY_WEEK, startDate, endDate),
  createTodo: (todo: any) => ipcRenderer.invoke(IPC_CHANNELS.TODO_CREATE, todo),
  updateTodo: (id: string, patch: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.TODO_UPDATE, id, patch),
  deleteTodo: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TODO_DELETE, id),

  // Categories
  getCategoriesAll: () => ipcRenderer.invoke(IPC_CHANNELS.CATEGORIES_GET_ALL),
  createCategory: (cat: any) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_CREATE, cat),
  updateCategory: (id: string, patch: any) =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_UPDATE, id, patch),
  deleteCategory: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.CATEGORY_DELETE, id),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: string, value: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

  // Window
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  setIgnoreMouseEvents: (ignore: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_IGNORE_MOUSE, ignore),
  setAlwaysOnTop: (flag: boolean) =>
    ipcRenderer.send(IPC_CHANNELS.WINDOW_SET_ALWAYS_ON_TOP, flag),
  setAutoStart: (enable: boolean) =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_SET_AUTO_START, enable),

  // Notifications
  sendTestNotification: () => ipcRenderer.invoke(IPC_CHANNELS.NOTIFICATION_TEST),

  // Data management
  saveSnapshot: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.DATA_SAVE_SNAPSHOT, name),
  getSnapshots: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_GET_SNAPSHOTS),
  restoreSnapshot: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DATA_RESTORE_SNAPSHOT, id),
  deleteSnapshot: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.DATA_DELETE_SNAPSHOT, id),
  exportData: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT),
  importData: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
