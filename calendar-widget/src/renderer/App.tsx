import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { TitleBar } from './components/TitleBar';
import { MonthView } from './components/Calendar/MonthView';
import { WeekView } from './components/Calendar/WeekView';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { useTodoStore } from './stores/todoStore';
import { useCategoryStore } from './stores/categoryStore';
import { useSettingsStore } from './stores/settingsStore';
import { useKeyboard } from './hooks/useKeyboard';
import { setDayjsLocale } from './utils/dateUtils';
import type { CalendarDay } from './utils/calendarGrid';

type View =
  | { view: 'month'; year: number; month: number }
  | { view: 'week'; year: number; month: number; day: number };

export function App() {
  const { i18n } = useTranslation();
  const [view, setView] = useState<View>({ view: 'month', year: 2026, month: 5 });
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadTodos = useTodoStore((s) => s.loadTodos);
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    async function init() {
      await loadSettings();
      await Promise.all([loadTodos(), loadCategories()]);
      setReady(true);
    }
    init();
  }, []);

  // Apply settings to Electron window on load
  useEffect(() => {
    if (!ready) return;
    try {
      window.electronAPI.setAlwaysOnTop(settings.alwaysOnTop);
      if (settings.autoStart) {
        window.electronAPI.setAutoStart(true);
      }
    } catch {
      // Window controls not critical
    }
  }, [ready]);

  // Apply font CSS variables from settings
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-system-family', settings.systemFontFamily);
    root.style.setProperty('--font-system-size', `${settings.systemFontSize}px`);
    root.style.setProperty('--font-content-family', settings.contentFontFamily);
    root.style.setProperty('--font-content-size', `${settings.contentFontSize}px`);
  }, [settings.systemFontFamily, settings.systemFontSize, settings.contentFontFamily, settings.contentFontSize]);

  // Sync i18n language with settings
  useEffect(() => {
    if (settings.language) {
      i18n.changeLanguage(settings.language);
      setDayjsLocale(settings.language);
    }
  }, [settings.language]);

  const handleDayClick = (day: CalendarDay) => {
    if (!day?.date) return;
    const [y, m, d] = day.date.split('-').map(Number);
    setView({ view: 'week', year: y, month: m, day: d });
  };

  const handleBackToMonth = useCallback(() => {
    const now = new Date();
    setView({ view: 'month', year: now.getFullYear(), month: now.getMonth() + 1 });
  }, []);

  // Keyboard shortcuts
  useKeyboard({
    'Ctrl+,': () => setShowSettings((v) => !v),
    Escape: () => {
      if (view.view === 'week') {
        handleBackToMonth();
      }
    },
  });

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="glass-panel w-full h-full m-2 flex items-center justify-center">
          <span className="text-white/40 text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <div
        className="glass-panel w-full h-full flex flex-col overflow-hidden"
        style={{
          background: `rgba(14, 24, 18, ${settings.transparency || 0.88})`,
          pointerEvents: 'auto',
        }}
      >
        <TitleBar>
          <button
            onClick={() => setShowSettings(true)}
            className="text-white/50 hover:text-white/80 text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Settings"
          >
            &#x2699;
          </button>
        </TitleBar>
        {view.view === 'month' ? (
          <MonthView onDayClick={handleDayClick} />
        ) : (
          <WeekView
            year={view.year}
            month={view.month}
            day={view.day}
            onBack={handleBackToMonth}
          />
        )}

        {/* Settings overlay */}
        {showSettings && (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        )}
      </div>
    </div>
  );
}
