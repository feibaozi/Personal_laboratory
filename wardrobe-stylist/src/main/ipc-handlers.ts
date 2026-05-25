import { ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import { IPC_CHANNELS } from '../shared/constants';
import * as garmentRepo from './database/repositories/garment';
import * as outfitRepo from './database/repositories/outfit';
import * as recordRepo from './database/repositories/daily-record';
import * as packingRepo from './database/repositories/packing-list';
import * as bodyProfileRepo from './database/repositories/body-profile';
import { importImage, removeBackground, getTemplateList, getTemplatePath } from './services/image-service';
import { analyzeGarment, getRecommendations, configureAI, isAIEnabled } from './services/ai-service';
import { getWeather } from './services/weather-service';

const settings: Record<string, string> = {};

export function registerIpcHandlers(): void {
  // ---- Garments ----
  ipcMain.handle(IPC_CHANNELS.GARMENTS_GET_ALL, () => garmentRepo.getAllGarments());
  ipcMain.handle(IPC_CHANNELS.GARMENT_GET, (_e, id: string) => garmentRepo.getGarment(id));
  ipcMain.handle(IPC_CHANNELS.GARMENT_CREATE, (_e, data: any) => garmentRepo.createGarment(data));
  ipcMain.handle(IPC_CHANNELS.GARMENT_UPDATE, (_e, id: string, patch: any) => garmentRepo.updateGarment(id, patch));
  ipcMain.handle(IPC_CHANNELS.GARMENT_DELETE, (_e, id: string) => garmentRepo.deleteGarment(id));
  ipcMain.handle(IPC_CHANNELS.GARMENT_STATS, () => garmentRepo.getGarmentStats());

  // ---- Outfits ----
  ipcMain.handle(IPC_CHANNELS.OUTFITS_GET_ALL, () => outfitRepo.getAllOutfits());
  ipcMain.handle(IPC_CHANNELS.OUTFIT_GET, (_e, id: string) => outfitRepo.getOutfit(id));
  ipcMain.handle(IPC_CHANNELS.OUTFIT_CREATE, (_e, data: any) => outfitRepo.createOutfit(data));
  ipcMain.handle(IPC_CHANNELS.OUTFIT_UPDATE, (_e, id: string, patch: any) => outfitRepo.updateOutfit(id, patch));
  ipcMain.handle(IPC_CHANNELS.OUTFIT_DELETE, (_e, id: string) => outfitRepo.deleteOutfit(id));

  // ---- Daily Records ----
  ipcMain.handle(IPC_CHANNELS.RECORDS_GET_ALL, () => recordRepo.getAllRecords());
  ipcMain.handle(IPC_CHANNELS.RECORD_GET_BY_DATE, (_e, date: string) => recordRepo.getRecordByDate(date));
  ipcMain.handle(IPC_CHANNELS.RECORD_GET_BY_WEEK, (_e, startDate: string, endDate: string) => recordRepo.getRecordsByWeek(startDate, endDate));
  ipcMain.handle(IPC_CHANNELS.RECORD_CREATE, (_e, data: any) => recordRepo.createRecord(data));
  ipcMain.handle(IPC_CHANNELS.RECORD_UPDATE, (_e, id: string, patch: any) => recordRepo.updateRecord(id, patch));
  ipcMain.handle(IPC_CHANNELS.RECORD_DELETE, (_e, id: string) => recordRepo.deleteRecord(id));

  // ---- Packing Lists ----
  ipcMain.handle(IPC_CHANNELS.PACKING_GET_ALL, () => packingRepo.getAllPackingLists());
  ipcMain.handle(IPC_CHANNELS.PACKING_CREATE, (_e, data: any) => packingRepo.createPackingList(data));
  ipcMain.handle(IPC_CHANNELS.PACKING_DELETE, (_e, id: string) => packingRepo.deletePackingList(id));

  // ---- Body Profiles ----
  ipcMain.handle(IPC_CHANNELS.BODY_PROFILES_GET_ALL, () => bodyProfileRepo.getAllBodyProfiles());
  ipcMain.handle(IPC_CHANNELS.BODY_PROFILE_GET, (_e, id: string) => bodyProfileRepo.getBodyProfile(id));
  ipcMain.handle(IPC_CHANNELS.BODY_PROFILE_CREATE, (_e, data: any) => bodyProfileRepo.createBodyProfile(data));
  ipcMain.handle(IPC_CHANNELS.BODY_PROFILE_UPDATE, (_e, id: string, patch: any) => bodyProfileRepo.updateBodyProfile(id, patch));
  ipcMain.handle(IPC_CHANNELS.BODY_PROFILE_DELETE, (_e, id: string) => bodyProfileRepo.deleteBodyProfile(id));

  // ---- Images ----
  ipcMain.handle(IPC_CHANNELS.IMAGE_IMPORT, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '选择服装图片',
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
      properties: ['openFile'],
    });
    if (canceled || filePaths.length === 0) return null;
    const result = await importImage(filePaths[0]);
    console.log('[IPC] importImage result:', result.original, 'sticker:', result.sticker, 'colors:', result.colors);
    return result;
  });
  ipcMain.handle(IPC_CHANNELS.IMAGE_REMOVE_BG, (_e, imagePath: string) => removeBackground(imagePath));
  ipcMain.handle(IPC_CHANNELS.IMAGE_GET_TEMPLATES, () => getTemplateList());
  ipcMain.handle(IPC_CHANNELS.IMAGE_GET_TEMPLATE_DATA, (_e, templateId: string) => {
    try {
      const templatePath = getTemplatePath(templateId);
      if (!templatePath) return null;
      const buffer = fs.readFileSync(templatePath);
      const ext = templatePath.split('.').pop()?.toLowerCase() || 'png';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  });
  ipcMain.handle(IPC_CHANNELS.IMAGE_READ_DATA_URL, (_e, imagePath: string) => {
    try {
      if (!fs.existsSync(imagePath)) return null;
      const buffer = fs.readFileSync(imagePath);
      const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpeg';
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch {
      return null;
    }
  });

  // ---- AI ----
  ipcMain.handle(IPC_CHANNELS.AI_ANALYZE_GARMENT, (_e, imageBase64: string) => analyzeGarment(imageBase64));
  ipcMain.handle(IPC_CHANNELS.AI_RECOMMEND, (_e, context: any) => getRecommendations(context));
  ipcMain.handle(IPC_CHANNELS.AI_CONFIGURE, (_e, config: any) => configureAI(config));
  ipcMain.handle(IPC_CHANNELS.AI_GET_STATUS, () => ({ enabled: isAIEnabled() }));

  // ---- Weather ----
  ipcMain.handle(IPC_CHANNELS.WEATHER_GET, () => getWeather());

  // ---- Settings ----
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (_e, key: string) => settings[key] ?? null);
  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_e, key: string, value: string) => {
    settings[key] = value;
  });

  // ---- Window ----
  ipcMain.on(IPC_CHANNELS.WINDOW_MINIMIZE, (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });
  ipcMain.on(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = require('electron').BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  // ---- Data management ----
  ipcMain.handle(IPC_CHANNELS.DATA_EXPORT, async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出数据',
      defaultPath: `wardrobe-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { success: false };
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
      // Clear existing data and import
      // Note: This is a simple implementation; full import with ID preservation would require more logic
      if (json.settings) {
        Object.assign(settings, json.settings);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
}
