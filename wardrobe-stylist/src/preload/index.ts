import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

const api = {
  // Garments
  getGarments: () => ipcRenderer.invoke(IPC_CHANNELS.GARMENTS_GET_ALL),
  getGarment: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GARMENT_GET, id),
  createGarment: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.GARMENT_CREATE, data),
  updateGarment: (id: string, patch: any) => ipcRenderer.invoke(IPC_CHANNELS.GARMENT_UPDATE, id, patch),
  deleteGarment: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.GARMENT_DELETE, id),
  getGarmentStats: () => ipcRenderer.invoke(IPC_CHANNELS.GARMENT_STATS),

  // Outfits
  getOutfits: () => ipcRenderer.invoke(IPC_CHANNELS.OUTFITS_GET_ALL),
  getOutfit: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.OUTFIT_GET, id),
  createOutfit: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.OUTFIT_CREATE, data),
  updateOutfit: (id: string, patch: any) => ipcRenderer.invoke(IPC_CHANNELS.OUTFIT_UPDATE, id, patch),
  deleteOutfit: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.OUTFIT_DELETE, id),

  // Daily Records
  getRecords: () => ipcRenderer.invoke(IPC_CHANNELS.RECORDS_GET_ALL),
  getRecordByDate: (date: string) => ipcRenderer.invoke(IPC_CHANNELS.RECORD_GET_BY_DATE, date),
  getRecordsByWeek: (startDate: string, endDate: string) => ipcRenderer.invoke(IPC_CHANNELS.RECORD_GET_BY_WEEK, startDate, endDate),
  createRecord: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.RECORD_CREATE, data),
  updateRecord: (id: string, patch: any) => ipcRenderer.invoke(IPC_CHANNELS.RECORD_UPDATE, id, patch),
  deleteRecord: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.RECORD_DELETE, id),

  // Packing Lists
  getPackingLists: () => ipcRenderer.invoke(IPC_CHANNELS.PACKING_GET_ALL),
  createPackingList: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PACKING_CREATE, data),
  deletePackingList: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.PACKING_DELETE, id),

  // Body Profiles
  getBodyProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.BODY_PROFILES_GET_ALL),
  getBodyProfile: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BODY_PROFILE_GET, id),
  createBodyProfile: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.BODY_PROFILE_CREATE, data),
  updateBodyProfile: (id: string, patch: any) => ipcRenderer.invoke(IPC_CHANNELS.BODY_PROFILE_UPDATE, id, patch),
  deleteBodyProfile: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.BODY_PROFILE_DELETE, id),

  // Images
  importImage: (sourcePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_IMPORT, sourcePath),
  removeBackground: (imagePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_REMOVE_BG, imagePath),
  readImageDataUrl: (imagePath: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_READ_DATA_URL, imagePath),
  getTemplateData: (templateId: string) => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_GET_TEMPLATE_DATA, templateId),
  getTemplateList: () => ipcRenderer.invoke(IPC_CHANNELS.IMAGE_GET_TEMPLATES),

  // AI
  analyzeGarment: (imageBase64: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_ANALYZE_GARMENT, imageBase64),
  getRecommendations: (context: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_RECOMMEND, context),
  configureAI: (config: any) => ipcRenderer.invoke(IPC_CHANNELS.AI_CONFIGURE, config),
  getAIStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AI_GET_STATUS),

  // Weather
  getWeather: () => ipcRenderer.invoke(IPC_CHANNELS.WEATHER_GET),

  // Settings
  getSetting: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  setSetting: (key: string, value: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),

  // Window
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),

  // Data management
  exportData: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_EXPORT),
  importData: () => ipcRenderer.invoke(IPC_CHANNELS.DATA_IMPORT),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
