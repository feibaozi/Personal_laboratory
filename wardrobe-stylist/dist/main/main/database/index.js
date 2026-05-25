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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDb = getDb;
exports.save = save;
exports.queryAll = queryAll;
exports.queryOne = queryOne;
exports.execute = execute;
const sql_js_1 = __importDefault(require("sql.js"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs = __importStar(require("fs"));
let db = null;
let dbPath;
async function initDatabase() {
    const userDataPath = electron_1.app.getPath('userData');
    const dbDir = path_1.default.join(userDataPath, 'wardrobe-stylist');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    dbPath = path_1.default.join(dbDir, 'wardrobe.db');
    const SQL = await (0, sql_js_1.default)();
    if (fs.existsSync(dbPath)) {
        const buffer = fs.readFileSync(dbPath);
        db = new SQL.Database(buffer);
    }
    else {
        db = new SQL.Database();
    }
    db.run('PRAGMA journal_mode = WAL');
    db.run('PRAGMA foreign_keys = ON');
    // Create tables with camelCase-friendly column names
    db.run(`
    CREATE TABLE IF NOT EXISTS garments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      imageUrl TEXT NOT NULL,
      thumbnailUrl TEXT NOT NULL,
      stickerUrl TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      colors TEXT NOT NULL,
      patterns TEXT,
      materials TEXT,
      seasons TEXT NOT NULL,
      occasions TEXT NOT NULL,
      style TEXT,
      fit TEXT,
      garmentLength TEXT,
      brand TEXT,
      purchaseDate TEXT,
      price REAL,
      status TEXT DEFAULT 'active',
      favorite INTEGER DEFAULT 0,
      notes TEXT,
      wearCount INTEGER DEFAULT 0,
      lastWornDate TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS outfits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      garments TEXT NOT NULL,
      occasions TEXT,
      seasons TEXT,
      style TEXT,
      rating INTEGER DEFAULT 0,
      tags TEXT,
      isFavorite INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS daily_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      outfitId TEXT,
      garmentIds TEXT,
      occasion TEXT,
      temperature REAL,
      weatherCondition TEXT,
      mood TEXT,
      rating INTEGER DEFAULT 0,
      photoUrl TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS packing_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      destination TEXT,
      startDate TEXT,
      endDate TEXT,
      days INTEGER,
      outfits TEXT,
      garmentIds TEXT,
      checkedItems TEXT,
      createdAt TEXT NOT NULL
    )
  `);
    db.run(`
    CREATE TABLE IF NOT EXISTS body_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT NOT NULL,
      height REAL NOT NULL,
      weight REAL,
      measurements TEXT,
      bodyType TEXT,
      templateId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
    saveDb();
}
function saveDb() {
    if (!db || !dbPath)
        return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        const tmp = dbPath + '.tmp';
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, dbPath);
    }
    catch (err) {
        console.error('Failed to save database:', err);
    }
}
function getDb() {
    if (!db)
        throw new Error('Database not initialized. Call initDatabase() first.');
    return db;
}
function save() {
    saveDb();
}
function queryAll(sql, params) {
    const d = getDb();
    const stmt = d.prepare(sql);
    if (params)
        stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}
function queryOne(sql, params) {
    const rows = queryAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
}
function execute(sql, params) {
    const d = getDb();
    if (params) {
        d.run(sql, params);
    }
    else {
        d.run(sql);
    }
    saveDb();
}
//# sourceMappingURL=index.js.map