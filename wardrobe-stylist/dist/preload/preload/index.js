"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const constants_1 = require("../shared/constants");
const api = {
    // Garments
    getGarments: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENTS_GET_ALL),
    getGarment: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENT_GET, id),
    createGarment: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENT_CREATE, data),
    updateGarment: (id, patch) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENT_UPDATE, id, patch),
    deleteGarment: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENT_DELETE, id),
    getGarmentStats: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GARMENT_STATS),
    // Outfits
    getOutfits: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.OUTFITS_GET_ALL),
    getOutfit: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.OUTFIT_GET, id),
    createOutfit: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.OUTFIT_CREATE, data),
    updateOutfit: (id, patch) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.OUTFIT_UPDATE, id, patch),
    deleteOutfit: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.OUTFIT_DELETE, id),
    // Daily Records
    getRecords: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORDS_GET_ALL),
    getRecordByDate: (date) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORD_GET_BY_DATE, date),
    getRecordsByWeek: (startDate, endDate) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORD_GET_BY_WEEK, startDate, endDate),
    createRecord: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORD_CREATE, data),
    updateRecord: (id, patch) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORD_UPDATE, id, patch),
    deleteRecord: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.RECORD_DELETE, id),
    // Packing Lists
    getPackingLists: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.PACKING_GET_ALL),
    createPackingList: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.PACKING_CREATE, data),
    deletePackingList: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.PACKING_DELETE, id),
    // Body Profiles
    getBodyProfiles: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.BODY_PROFILES_GET_ALL),
    getBodyProfile: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.BODY_PROFILE_GET, id),
    createBodyProfile: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.BODY_PROFILE_CREATE, data),
    updateBodyProfile: (id, patch) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.BODY_PROFILE_UPDATE, id, patch),
    deleteBodyProfile: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.BODY_PROFILE_DELETE, id),
    // Images
    importImage: (sourcePath) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.IMAGE_IMPORT, sourcePath),
    removeBackground: (imagePath) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.IMAGE_REMOVE_BG, imagePath),
    readImageDataUrl: (imagePath) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.IMAGE_READ_DATA_URL, imagePath),
    getTemplateData: (templateId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.IMAGE_GET_TEMPLATE_DATA, templateId),
    getTemplateList: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.IMAGE_GET_TEMPLATES),
    // AI
    analyzeGarment: (imageBase64) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_ANALYZE_GARMENT, imageBase64),
    getRecommendations: (context) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_RECOMMEND, context),
    configureAI: (config) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_CONFIGURE, config),
    getAIStatus: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_GET_STATUS),
    // Weather
    getWeather: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.WEATHER_GET),
    // Settings
    getSetting: (key) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SETTINGS_GET, key),
    setSetting: (key, value) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SETTINGS_SET, key, value),
    // Window
    minimizeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC_CHANNELS.WINDOW_MINIMIZE),
    closeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC_CHANNELS.WINDOW_CLOSE),
    // Data management
    exportData: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.DATA_EXPORT),
    importData: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.DATA_IMPORT),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
//# sourceMappingURL=index.js.map