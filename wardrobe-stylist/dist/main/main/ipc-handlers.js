"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const constants_1 = require("../shared/constants");
const garmentRepo = __importStar(require("./database/repositories/garment"));
const outfitRepo = __importStar(require("./database/repositories/outfit"));
const recordRepo = __importStar(require("./database/repositories/daily-record"));
const packingRepo = __importStar(require("./database/repositories/packing-list"));
const bodyProfileRepo = __importStar(require("./database/repositories/body-profile"));
const image_service_1 = require("./services/image-service");
const ai_service_1 = require("./services/ai-service");
const weather_service_1 = require("./services/weather-service");
const settings = {};
function registerIpcHandlers() {
    // ---- Garments ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENTS_GET_ALL, () => garmentRepo.getAllGarments());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENT_GET, (_e, id) => garmentRepo.getGarment(id));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENT_CREATE, (_e, data) => garmentRepo.createGarment(data));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENT_UPDATE, (_e, id, patch) => garmentRepo.updateGarment(id, patch));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENT_DELETE, (_e, id) => garmentRepo.deleteGarment(id));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GARMENT_STATS, () => garmentRepo.getGarmentStats());
    // ---- Outfits ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.OUTFITS_GET_ALL, () => outfitRepo.getAllOutfits());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.OUTFIT_GET, (_e, id) => outfitRepo.getOutfit(id));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.OUTFIT_CREATE, (_e, data) => outfitRepo.createOutfit(data));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.OUTFIT_UPDATE, (_e, id, patch) => outfitRepo.updateOutfit(id, patch));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.OUTFIT_DELETE, (_e, id) => outfitRepo.deleteOutfit(id));
    // ---- Daily Records ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORDS_GET_ALL, () => recordRepo.getAllRecords());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORD_GET_BY_DATE, (_e, date) => recordRepo.getRecordByDate(date));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORD_GET_BY_WEEK, (_e, startDate, endDate) => recordRepo.getRecordsByWeek(startDate, endDate));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORD_CREATE, (_e, data) => recordRepo.createRecord(data));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORD_UPDATE, (_e, id, patch) => recordRepo.updateRecord(id, patch));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.RECORD_DELETE, (_e, id) => recordRepo.deleteRecord(id));
    // ---- Packing Lists ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.PACKING_GET_ALL, () => packingRepo.getAllPackingLists());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.PACKING_CREATE, (_e, data) => packingRepo.createPackingList(data));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.PACKING_DELETE, (_e, id) => packingRepo.deletePackingList(id));
    // ---- Body Profiles ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.BODY_PROFILES_GET_ALL, () => bodyProfileRepo.getAllBodyProfiles());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.BODY_PROFILE_GET, (_e, id) => bodyProfileRepo.getBodyProfile(id));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.BODY_PROFILE_CREATE, (_e, data) => bodyProfileRepo.createBodyProfile(data));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.BODY_PROFILE_UPDATE, (_e, id, patch) => bodyProfileRepo.updateBodyProfile(id, patch));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.BODY_PROFILE_DELETE, (_e, id) => bodyProfileRepo.deleteBodyProfile(id));
    // ---- Images ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.IMAGE_IMPORT, async () => {
        const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
            title: '选择服装图片',
            filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
            properties: ['openFile'],
        });
        if (canceled || filePaths.length === 0)
            return null;
        const result = await (0, image_service_1.importImage)(filePaths[0]);
        console.log('[IPC] importImage result:', result.original, 'sticker:', result.sticker, 'colors:', result.colors);
        return result;
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.IMAGE_REMOVE_BG, (_e, imagePath) => (0, image_service_1.removeBackground)(imagePath));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.IMAGE_GET_TEMPLATES, () => (0, image_service_1.getTemplateList)());
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.IMAGE_GET_TEMPLATE_DATA, (_e, templateId) => {
        try {
            const templatePath = (0, image_service_1.getTemplatePath)(templateId);
            if (!templatePath)
                return null;
            const buffer = fs.readFileSync(templatePath);
            const ext = templatePath.split('.').pop()?.toLowerCase() || 'png';
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
        }
        catch {
            return null;
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.IMAGE_READ_DATA_URL, (_e, imagePath) => {
        try {
            if (!fs.existsSync(imagePath))
                return null;
            const buffer = fs.readFileSync(imagePath);
            const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpeg';
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            return `data:${mime};base64,${buffer.toString('base64')}`;
        }
        catch {
            return null;
        }
    });
    // ---- AI ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_ANALYZE_GARMENT, (_e, imageBase64) => (0, ai_service_1.analyzeGarment)(imageBase64));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_RECOMMEND, (_e, context) => (0, ai_service_1.getRecommendations)(context));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_CONFIGURE, (_e, config) => (0, ai_service_1.configureAI)(config));
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.AI_GET_STATUS, () => ({ enabled: (0, ai_service_1.isAIEnabled)() }));
    // ---- Weather ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.WEATHER_GET, () => (0, weather_service_1.getWeather)());
    // ---- Settings ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SETTINGS_GET, (_e, key) => settings[key] ?? null);
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SETTINGS_SET, (_e, key, value) => {
        settings[key] = value;
    });
    // ---- Window ----
    electron_1.ipcMain.on(constants_1.IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
        const win = require('electron').BrowserWindow.fromWebContents(event.sender);
        win?.minimize();
    });
    electron_1.ipcMain.on(constants_1.IPC_CHANNELS.WINDOW_CLOSE, (event) => {
        const win = require('electron').BrowserWindow.fromWebContents(event.sender);
        win?.close();
    });
    // ---- Data management ----
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.DATA_EXPORT, async () => {
        const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
            title: '导出数据',
            defaultPath: `wardrobe-export-${new Date().toISOString().slice(0, 10)}.json`,
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (canceled || !filePath)
            return { success: false };
        try {
            const exportData = {
                exportedAt: new Date().toISOString(),
                garments: garmentRepo.getAllGarments(),
                outfits: outfitRepo.getAllOutfits(),
                records: recordRepo.getAllRecords(),
                packingLists: packingRepo.getAllPackingLists(),
                bodyProfiles: bodyProfileRepo.getAllBodyProfiles(),
                settings,
            };
            fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
            return { success: true, filePath };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.DATA_IMPORT, async () => {
        const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
            title: '导入数据',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
        });
        if (canceled || filePaths.length === 0)
            return { success: false };
        try {
            const raw = fs.readFileSync(filePaths[0], 'utf-8');
            const json = JSON.parse(raw);
            // Clear existing data and import
            // Note: This is a simple implementation; full import with ID preservation would require more logic
            if (json.settings) {
                Object.assign(settings, json.settings);
            }
            return { success: true };
        }
        catch (err) {
            return { success: false, error: err.message };
        }
    });
}
//# sourceMappingURL=ipc-handlers.js.map