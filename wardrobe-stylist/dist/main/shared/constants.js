"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPC_CHANNELS = void 0;
exports.IPC_CHANNELS = {
    // Garments
    GARMENTS_GET_ALL: 'garments:getAll',
    GARMENT_GET: 'garment:get',
    GARMENT_CREATE: 'garment:create',
    GARMENT_UPDATE: 'garment:update',
    GARMENT_DELETE: 'garment:delete',
    GARMENT_STATS: 'garment:stats',
    // Outfits
    OUTFITS_GET_ALL: 'outfits:getAll',
    OUTFIT_GET: 'outfit:get',
    OUTFIT_CREATE: 'outfit:create',
    OUTFIT_UPDATE: 'outfit:update',
    OUTFIT_DELETE: 'outfit:delete',
    // Daily Records
    RECORDS_GET_ALL: 'records:getAll',
    RECORD_GET_BY_DATE: 'record:getByDate',
    RECORD_GET_BY_WEEK: 'record:getByWeek',
    RECORD_CREATE: 'record:create',
    RECORD_UPDATE: 'record:update',
    RECORD_DELETE: 'record:delete',
    // Packing Lists
    PACKING_GET_ALL: 'packing:getAll',
    PACKING_GET: 'packing:get',
    PACKING_CREATE: 'packing:create',
    PACKING_UPDATE: 'packing:update',
    PACKING_DELETE: 'packing:delete',
    // Body Profiles
    BODY_PROFILES_GET_ALL: 'bodyProfiles:getAll',
    BODY_PROFILE_GET: 'bodyProfile:get',
    BODY_PROFILE_CREATE: 'bodyProfile:create',
    BODY_PROFILE_UPDATE: 'bodyProfile:update',
    BODY_PROFILE_DELETE: 'bodyProfile:delete',
    // Try-on Configs
    TRYON_CONFIGS_GET: 'tryonConfigs:get',
    TRYON_CONFIGS_SAVE: 'tryonConfigs:save',
    // Images
    IMAGE_IMPORT: 'image:import',
    IMAGE_REMOVE_BG: 'image:removeBg',
    IMAGE_GET_TEMPLATES: 'image:getTemplates',
    IMAGE_READ_DATA_URL: 'image:readDataUrl',
    IMAGE_GET_TEMPLATE_DATA: 'image:getTemplateData',
    // AI
    AI_ANALYZE_GARMENT: 'ai:analyzeGarment',
    AI_RECOMMEND: 'ai:recommend',
    AI_CONFIGURE: 'ai:configure',
    AI_GET_STATUS: 'ai:getStatus',
    // Weather
    WEATHER_GET: 'weather:get',
    // Settings
    SETTINGS_GET: 'settings:get',
    SETTINGS_SET: 'settings:set',
    // Window
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_CLOSE: 'window:close',
    // Data management
    DATA_EXPORT: 'data:export',
    DATA_IMPORT: 'data:import',
};
//# sourceMappingURL=constants.js.map