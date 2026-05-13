import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type { Todo, Category } from '../../shared/types';

interface TodoState {
  todos: Todo[];
  loaded: boolean;

  loadTodos: () => Promise<void>;
  addTodo: (data: Partial<Pick<Todo, 'date' | 'startTime' | 'endTime' | 'categoryId' | 'groupId'>>) => Promise<Todo>;
  addTodoBatch: (todos: Todo[]) => Promise<void>;
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<void>;
  updateGroup: (groupId: string, patch: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  getTodosByDate: (date: string) => Todo[];
  getTodosByWeek: (startDate: string, endDate: string) => Todo[];
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  loaded: false,

  loadTodos: async () => {
    try {
      const raw = await window.electronAPI.getTodosAll();
      const todos = raw.map((t: any) => ({
        id: t.id,
        title: t.title || '',
        notes: t.notes || '',
        color: t.color || '#3B82F6',
        categoryId: t.category_id ?? t.categoryId ?? null,
        date: t.date || '',
        startTime: t.start_time || t.startTime || '09:00',
        endTime: t.end_time || t.endTime || '10:00',
        status: t.status || 'incomplete',
        groupId: t.groupId || t.group_id || null,
        notifyEnabled: t.notify_enabled ?? t.notifyEnabled ?? false,
        notifyLeadMinutes: t.notify_lead_minutes ?? t.notifyLeadMinutes ?? 5,
        createdAt: t.created_at || t.createdAt || '',
        updatedAt: t.updated_at || t.updatedAt || '',
      }));
      set({ todos, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  addTodo: async (data) => {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: uuidv4(),
      title: '',
      notes: '',
      color: '#3B82F6',
      categoryId: data.categoryId ?? null,
      date: data.date ?? '',
      startTime: data.startTime ?? '09:00',
      endTime: data.endTime ?? '10:00',
      status: 'incomplete',
      groupId: data.groupId ?? null,
      notifyEnabled: false,
      notifyLeadMinutes: 5,
      createdAt: now,
      updatedAt: now,
    };

    await window.electronAPI.createTodo({
      ...todo,
      categoryId: todo.categoryId,
      startTime: todo.startTime,
      endTime: todo.endTime,
      groupId: todo.groupId,
      notifyEnabled: todo.notifyEnabled,
      notifyLeadMinutes: todo.notifyLeadMinutes,
      createdAt: todo.createdAt,
      updatedAt: todo.updatedAt,
    });

    set((s) => ({ todos: [...s.todos, todo] }));
    return todo;
  },

  addTodoBatch: async (todos) => {
    for (const todo of todos) {
      await window.electronAPI.createTodo({
        ...todo,
        categoryId: todo.categoryId,
        startTime: todo.startTime,
        endTime: todo.endTime,
        groupId: todo.groupId,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
      });
    }
    set((s) => ({ todos: [...s.todos, ...todos] }));
  },

  updateTodo: async (id, patch) => {
    const dbPatch: any = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes;
    if (patch.color !== undefined) dbPatch.color = patch.color;
    if (patch.categoryId !== undefined) dbPatch.categoryId = patch.categoryId;
    if (patch.date !== undefined) dbPatch.date = patch.date;
    if (patch.startTime !== undefined) dbPatch.startTime = patch.startTime;
    if (patch.endTime !== undefined) dbPatch.endTime = patch.endTime;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.groupId !== undefined) dbPatch.groupId = patch.groupId;
    if (patch.notifyEnabled !== undefined) dbPatch.notifyEnabled = patch.notifyEnabled;
    if (patch.notifyLeadMinutes !== undefined) dbPatch.notifyLeadMinutes = patch.notifyLeadMinutes;

    await window.electronAPI.updateTodo(id, dbPatch);

    set((s) => ({
      todos: s.todos.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
      ),
    }));
  },

  updateGroup: async (groupId, patch) => {
    const groupTodos = get().todos.filter((t) => t.groupId === groupId);
    for (const t of groupTodos) {
      await get().updateTodo(t.id, patch);
    }
  },

  deleteTodo: async (id) => {
    await window.electronAPI.deleteTodo(id);
    set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
  },

  deleteGroup: async (groupId) => {
    const ids = get().todos.filter((t) => t.groupId === groupId).map((t) => t.id);
    for (const id of ids) {
      await window.electronAPI.deleteTodo(id);
    }
    set((s) => ({ todos: s.todos.filter((t) => t.groupId !== groupId) }));
  },

  toggleStatus: async (id) => {
    const todo = get().todos.find((t) => t.id === id);
    if (!todo) return;
    const newStatus = todo.status === 'incomplete' ? 'complete' : 'incomplete';
    await get().updateTodo(id, { status: newStatus });
  },

  getTodosByDate: (date) => {
    return get().todos.filter((t) => t.date === date);
  },

  getTodosByWeek: (startDate, endDate) => {
    return get().todos.filter((t) => t.date >= startDate && t.date <= endDate);
  },
}));

// Helper to generate recurring todo dates
export function generateRecurringInstances(
  baseDate: string,
  baseStartTime: string,
  baseEndTime: string,
  category: Category,
  syncStart: string,
  syncEnd: string
): Array<{ date: string; startTime: string; endTime: string }> {
  const instances: Array<{ date: string; startTime: string; endTime: string }> = [];
  const baseDay = dayjs(baseDate);
  const syncStartDay = syncStart ? dayjs(syncStart) : baseDay;
  const start = baseDay.isAfter(syncStartDay) ? baseDay : syncStartDay;
  const end = syncEnd ? dayjs(syncEnd) : baseDay.add(3, 'month');

  if (category.recurrenceType === 'none') return instances;

  let current = dayjs(baseDate);
  const maxIterations = 500; // safety limit

  for (let i = 0; i < maxIterations; i++) {
    if (category.recurrenceType === 'weekly') {
      current = current.add(7, 'day');
    } else if (category.recurrenceType === 'monthly') {
      current = current.add(1, 'month');
    } else if (category.recurrenceType === 'custom') {
      current = current.add(category.recurrenceDays || 1, 'day');
    }

    if (current.isAfter(end)) break;

    const dateStr = current.format('YYYY-MM-DD');
    if (dateStr === baseDate) continue; // skip base date (already created)

    instances.push({
      date: dateStr,
      startTime: baseStartTime,
      endTime: baseEndTime,
    });
  }

  return instances;
}
