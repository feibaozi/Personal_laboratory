import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { Snapshot } from '../shared/types';

interface DBData {
  todos: any[];
  categories: any[];
  settings: Record<string, string>;
  snapshots: Snapshot[];
}

let dbPath: string;
let data: DBData = { todos: [], categories: [], settings: {}, snapshots: [] };

export function initDatabase(): void {
  dbPath = path.join(app.getPath('userData'), 'calendar-widget.json');
  loadData();
}

function loadData(): void {
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      data = JSON.parse(raw);
      data.todos = data.todos ?? [];
      data.categories = data.categories ?? [];
      data.settings = data.settings ?? {};
      data.snapshots = data.snapshots ?? [];
    }
  } catch {
    data = { todos: [], categories: [], settings: {}, snapshots: [] };
  }
}

function saveData(): void {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmp = dbPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, dbPath);
  } catch (err) {
    console.error('Failed to save data:', err);
  }
}

// ---- Todos ----

export function getAllTodos(): any[] {
  return data.todos;
}

export function getTodosByDate(date: string): any[] {
  return data.todos.filter((t: any) => t.date === date);
}

export function getTodosByWeek(startDate: string, endDate: string): any[] {
  return data.todos.filter((t: any) => t.date >= startDate && t.date <= endDate);
}

export function createTodo(todo: any): any {
  data.todos.push(todo);
  saveData();
  return todo;
}

export function updateTodo(id: string, patch: Record<string, any>): any {
  const idx = data.todos.findIndex((t: any) => t.id === id);
  if (idx === -1) return null;

  for (const [key, value] of Object.entries(patch)) {
    data.todos[idx][key] = value;
    const snakeKey: Record<string, string> = {
      categoryId: 'category_id',
      startTime: 'start_time',
      endTime: 'end_time',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      notifyEnabled: 'notify_enabled',
      notifyLeadMinutes: 'notify_lead_minutes',
    };
    if (snakeKey[key]) {
      data.todos[idx][snakeKey[key]] = value;
    }
  }
  data.todos[idx].updated_at = new Date().toISOString();
  saveData();
  return data.todos[idx];
}

export function deleteTodo(id: string): void {
  data.todos = data.todos.filter((t: any) => t.id !== id);
  saveData();
}

// ---- Categories ----

export function getAllCategories(): any[] {
  return data.categories;
}

export function createCategory(category: any): any {
  data.categories.push(category);
  saveData();
  return category;
}

export function updateCategory(id: string, patch: Record<string, any>): any {
  const idx = data.categories.findIndex((c: any) => c.id === id);
  if (idx === -1) return null;
  if (patch.name) data.categories[idx].name = patch.name;
  if (patch.color) data.categories[idx].color = patch.color;
  saveData();
  return data.categories[idx];
}

export function deleteCategory(id: string): void {
  for (const todo of data.todos) {
    if (todo.category_id === id) {
      todo.category_id = null;
    }
  }
  data.categories = data.categories.filter((c: any) => c.id !== id);
  saveData();
}

// ---- Settings ----

export function getSetting(key: string): string | undefined {
  return data.settings[key];
}

export function setSetting(key: string, value: string): void {
  data.settings[key] = value;
  saveData();
}

// ---- Snapshots ----

export function saveSnapshot(name: string): Snapshot {
  const snapshot: Snapshot = {
    id: uuidv4(),
    name: name || new Date().toLocaleString('zh-CN'),
    createdAt: new Date().toISOString(),
    todoCount: data.todos.length,
    categoryCount: data.categories.length,
    data: {
      todos: JSON.parse(JSON.stringify(data.todos)),
      categories: JSON.parse(JSON.stringify(data.categories)),
      settings: JSON.parse(JSON.stringify(data.settings)),
    },
  };
  data.snapshots.push(snapshot);
  saveData();
  return snapshot;
}

export function getSnapshots(): Omit<Snapshot, 'data'>[] {
  return data.snapshots.map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    todoCount: s.todoCount,
    categoryCount: s.categoryCount,
  }));
}

export function getSnapshotById(id: string): Snapshot | null {
  return data.snapshots.find((s) => s.id === id) ?? null;
}

export function restoreSnapshot(id: string): boolean {
  const snapshot = data.snapshots.find((s) => s.id === id);
  if (!snapshot) return false;
  data.todos = JSON.parse(JSON.stringify(snapshot.data.todos));
  data.categories = JSON.parse(JSON.stringify(snapshot.data.categories));
  data.settings = JSON.parse(JSON.stringify(snapshot.data.settings));
  saveData();
  return true;
}

export function deleteSnapshot(id: string): void {
  data.snapshots = data.snapshots.filter((s) => s.id !== id);
  saveData();
}

// ---- Export / Import ----

export function exportAllData(): object {
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0',
    todos: data.todos,
    categories: data.categories,
    settings: data.settings,
    snapshots: data.snapshots.map((s) => ({
      id: s.id,
      name: s.name,
      createdAt: s.createdAt,
      todoCount: s.todoCount,
      categoryCount: s.categoryCount,
      data: s.data,
    })),
  };
}

export function importData(json: any): void {
  if (!json || typeof json !== 'object') throw new Error('Invalid data');
  if (!Array.isArray(json.todos)) throw new Error('Missing todos array');
  if (!Array.isArray(json.categories)) throw new Error('Missing categories array');
  if (!json.settings || typeof json.settings !== 'object') throw new Error('Missing settings');

  data.todos = json.todos;
  data.categories = json.categories;
  data.settings = json.settings;
  data.snapshots = Array.isArray(json.snapshots) ? json.snapshots : [];
  saveData();
}
