export interface Todo {
  id: string;
  title: string;
  notes: string;
  color: string;
  categoryId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: 'incomplete' | 'complete';
  groupId: string | null;
  notifyEnabled: boolean;
  notifyLeadMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  recurrenceType: 'none' | 'weekly' | 'monthly' | 'custom';
  recurrenceDays: number;
  createdAt: string;
}

export interface Settings {
  autoStart: boolean;
  transparency: number;
  alwaysOnTop: boolean;
  clickThroughEmpty: boolean;
  notificationsEnabled: boolean;
  defaultView: 'month' | 'week';
  timeSlotInterval: 15 | 30;
  language: 'zh' | 'en';
  syncStartDate: string;
  syncEndDate: string;
  systemFontFamily: string;
  systemFontSize: number;
  contentFontFamily: string;
  contentFontSize: number;
  windowBounds: WindowBounds;
}

export interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  todoCount: number;
  categoryCount: number;
  data: {
    todos: Todo[];
    categories: Category[];
    settings: Record<string, string>;
  };
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ViewState = {
  view: 'month';
  year: number;
  month: number;
} | {
  view: 'week';
  year: number;
  month: number;
  day: number;
};
