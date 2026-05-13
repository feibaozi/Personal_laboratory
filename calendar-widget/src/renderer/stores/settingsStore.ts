import { create } from 'zustand';
import type { Settings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/constants';

interface SettingsState {
  settings: Settings;
  loaded: boolean;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  loaded: false,

  loadSettings: async () => {
    try {
      const settings = { ...DEFAULT_SETTINGS };
      const keys: (keyof Settings)[] = [
        'autoStart',
        'transparency',
        'alwaysOnTop',
        'clickThroughEmpty',
        'notificationsEnabled',
        'defaultView',
        'timeSlotInterval',
        'language',
        'syncStartDate',
        'syncEndDate',
        'systemFontFamily',
        'systemFontSize',
        'contentFontFamily',
        'contentFontSize',
        'windowBounds',
      ];

      for (const key of keys) {
        try {
          const raw = await window.electronAPI.getSetting(key);
          if (raw !== null && raw !== undefined) {
            try {
              (settings as any)[key] = JSON.parse(raw);
            } catch {
              (settings as any)[key] = raw;
            }
          }
        } catch {
          // Use default if IPC fails
        }
      }

      set({ settings, loaded: true });
    } catch {
      set({ loaded: true }); // Use defaults if all fails
    }
  },

  updateSetting: async (key, value) => {
    await window.electronAPI.setSetting(key, JSON.stringify(value));
    set((s) => ({
      settings: { ...s.settings, [key]: value },
    }));

    // Sync to Electron window behavior
    try {
      if (key === 'alwaysOnTop') {
        window.electronAPI.setAlwaysOnTop(value as boolean);
      } else if (key === 'autoStart') {
        window.electronAPI.setAutoStart(value as boolean);
      }
    } catch {
      // Non-critical window control, ignore errors
    }
  },
}));
