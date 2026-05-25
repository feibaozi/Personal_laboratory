export const DEFAULT_COLORS = [
  '#c0392b', // 金属红
  '#c97e3b', // 古铜
  '#9e8d4b', // 橄榄金
  '#3b9e6d', // 翠绿
  '#4b8a9e', // 钢蓝
  '#8b5b9e', // 紫晶
  '#9e5b7d', // 玫金
  '#6b7d8a', // 岩灰
];

export const DEFAULT_CATEGORIES = [
  { name: '工作', color: '#3B82F6' },
  { name: '个人', color: '#22C55E' },
  { name: '学习', color: '#8B5CF6' },
  { name: '健康', color: '#EF4444' },
];

export const CATEGORY_NAMES = {
  work: '工作',
  personal: '个人',
  study: '学习',
  health: '健康',
};

export const DEFAULT_SETTINGS: import('./types').Settings = {
  autoStart: false,
  transparency: 0.75,
  alwaysOnTop: false,
  clickThroughEmpty: false,
  notificationsEnabled: false,
  defaultView: 'month',
  timeSlotInterval: 30,
  language: 'zh',
  syncStartDate: '',
  syncEndDate: '',
  systemFontFamily: 'Microsoft YaHei',
  systemFontSize: 13,
  contentFontFamily: 'Microsoft YaHei',
  contentFontSize: 13,
  windowBounds: {
    x: -1,
    y: -1,
    width: 700,
    height: 500,
  },
};

export const FONT_OPTIONS = [
  'Microsoft YaHei',  // 微软雅黑
  'KaiTi',            // 楷体
  'STXingkai',        // 行楷
  'SimSun',           // 宋体
  'SimHei',           // 黑体
  'FangSong',         // 仿宋
  'DengXian',         // 等线
  'Consolas',         // 等宽英文字体
];

// Brighter green theme colors
export const GREEN_PRIMARY = '#7dcc9a';
export const GREEN_SUB = '#5a8a6e';
export const GREEN_DIM = '#4a7a60';
export const GREEN_LIGHT = '#98d8ae';
export const GREEN_BORDER = 'rgba(120,200,145,';
export const PANEL_BG = 'rgba(16,28,20,0.88)';
export const CARD_BG = '#182a20';

export const TIME_SLOTS = 48; // 48 half-hour slots (00:00-23:30)
export const MIN_CARD_HEIGHT = 28; // px for minimum card (half hour)
export const HOUR_HEIGHT = 56; // px per hour in week view

export const IPC_CHANNELS = {
  // Todos
  TODOS_GET_ALL: 'todos:getAll',
  TODOS_GET_BY_DATE: 'todos:getByDate',
  TODOS_GET_BY_WEEK: 'todos:getByWeek',
  TODO_CREATE: 'todo:create',
  TODO_UPDATE: 'todo:update',
  TODO_DELETE: 'todo:delete',

  // Categories
  CATEGORIES_GET_ALL: 'categories:getAll',
  CATEGORY_CREATE: 'category:create',
  CATEGORY_UPDATE: 'category:update',
  CATEGORY_DELETE: 'category:delete',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Window
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_SET_IGNORE_MOUSE: 'window:setIgnoreMouse',
  WINDOW_SET_ALWAYS_ON_TOP: 'window:setAlwaysOnTop',
  WINDOW_SET_AUTO_START: 'window:setAutoStart',
  WINDOW_SET_TRANSPARENCY: 'window:setTransparency',

  // Notifications
  NOTIFICATION_TEST: 'notification:test',

  // Workbench
  LAUNCH_WORKBENCH: 'workbench:launch',

  // Data management
  DATA_SAVE_SNAPSHOT: 'data:saveSnapshot',
  DATA_GET_SNAPSHOTS: 'data:getSnapshots',
  DATA_RESTORE_SNAPSHOT: 'data:restoreSnapshot',
  DATA_DELETE_SNAPSHOT: 'data:deleteSnapshot',
  DATA_EXPORT: 'data:export',
  DATA_IMPORT: 'data:import',
} as const;
