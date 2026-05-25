import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import path from 'path';
import * as fs from 'fs';

let db: SqlJsDatabase | null = null;
let dbPath: string;

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'wardrobe-stylist');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  dbPath = path.join(dbDir, 'wardrobe.db');

  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
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

function saveDb(): void {
  if (!db || !dbPath) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, buffer);
    fs.renameSync(tmp, dbPath);
  } catch (err) {
    console.error('Failed to save database:', err);
  }
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export function save() {
  saveDb();
}

export function queryAll(sql: string, params?: any[]): any[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params) stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(sql: string, params?: any[]): any | null {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params?: any[]) {
  const d = getDb();
  if (params) {
    d.run(sql, params);
  } else {
    d.run(sql);
  }
  saveDb();
}
