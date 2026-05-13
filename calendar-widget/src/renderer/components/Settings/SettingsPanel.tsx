import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTodoStore } from '../../stores/todoStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { FONT_OPTIONS } from '../../../shared/constants';
import type { Snapshot } from '../../../shared/types';

interface Props { onClose: () => void; }

const TEXT1 = '#7dcc9a';
const TEXT2 = '#5a8a6e';
const TEXT3 = '#4a7a60';
const BG = '#182a20';
const BORDER = 'rgba(120,200,145,0.12)';
const INP_BG = 'rgba(120,200,145,0.06)';
const SECTION_COLOR = '#4a7a60';

const selectStyle: React.CSSProperties = {
  background: INP_BG, border: `1px solid ${BORDER}`, color: TEXT1,
  borderRadius: '6px', padding: '4px 6px', fontSize: '12px', outline: 'none',
};

const sectionHeader: React.CSSProperties = {
  fontSize: '10px', color: SECTION_COLOR, fontFamily: 'var(--font-system-family)',
  textAlign: 'center', letterSpacing: '1px', margin: '10px 0 6px',
};

type SnapshotMeta = Omit<Snapshot, 'data'>;

export function SettingsPanel({ onClose }: Props) {
  const { t, i18n } = useTranslation();
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const loadTodos = useTodoStore((s) => s.loadTodos);
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const loadSettingsFn = useSettingsStore((s) => s.loadSettings);

  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [snapshotName, setSnapshotName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  const refreshSnapshots = useCallback(async () => {
    try {
      const list = await window.electronAPI.getSnapshots();
      setSnapshots(list || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refreshSnapshots(); }, [refreshSnapshots]);

  const handleTransparencyChange = async (value: number) => {
    await updateSetting('transparency', value);
  };

  const handleToggle = async (key: 'autoStart' | 'alwaysOnTop' | 'notificationsEnabled') => {
    await updateSetting(key, !settings[key]);
  };

  const handleLanguageToggle = async () => {
    const newLang = settings.language === 'zh' ? 'en' : 'zh';
    await updateSetting('language', newLang);
    i18n.changeLanguage(newLang);
  };

  const handleTestNotification = async () => {
    try {
      await window.electronAPI.sendTestNotification();
    } catch { /* ignore */ }
  };

  const handleSaveSnapshot = async () => {
    try {
      await window.electronAPI.saveSnapshot(snapshotName);
      setShowSaveDialog(false);
      setSnapshotName('');
      await refreshSnapshots();
      showStatus(t('settings.exportSuccess'));
    } catch { showStatus(t('settings.exportFailed')); }
  };

  const handleRestoreSnapshot = async (id: string) => {
    try {
      await window.electronAPI.restoreSnapshot(id);
      setRestoringId(null);
      await Promise.all([loadTodos(), loadCategories(), loadSettingsFn()]);
      showStatus(t('settings.restoreDone'));
      await refreshSnapshots();
    } catch { showStatus(t('settings.exportFailed')); }
  };

  const handleDeleteSnapshot = async (id: string) => {
    try {
      await window.electronAPI.deleteSnapshot(id);
      await refreshSnapshots();
    } catch { /* ignore */ }
  };

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.exportData();
      if (result.success) {
        showStatus(t('settings.exportSuccess'));
      } else {
        showStatus(t('settings.exportFailed'));
      }
    } catch { showStatus(t('settings.exportFailed')); }
  };

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importData();
      if (result.success) {
        await Promise.all([loadTodos(), loadCategories(), loadSettingsFn()]);
        showStatus(t('settings.importSuccess'));
        await refreshSnapshots();
      } else {
        showStatus(result.error || t('settings.importFailed'));
      }
    } catch { showStatus(t('settings.importFailed')); }
  };

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 2000);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,20,14,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-5 w-80 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ background: BG, border: `1px solid ${BORDER}`, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium mb-4" style={{ color: TEXT1 }}>{t('settings.title')}</h3>

        {/* Transparency */}
        <div className="mb-4">
          <label className="text-xs flex justify-between" style={{ color: TEXT2 }}>
            {t('settings.transparency')}
            <span style={{ color: TEXT1 }}>{Math.round(settings.transparency * 100)}%</span>
          </label>
          <input type="range" min="35" max="95" value={Math.round(settings.transparency * 100)}
            onChange={(e) => handleTransparencyChange(Number(e.target.value) / 100)} className="w-full mt-1" />
        </div>

        {/* Sync range */}
        <div className="mb-4">
          <label className="text-xs block mb-1" style={{ color: TEXT2 }}>周期同步区间</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px]" style={{ color: TEXT2 }}>开始</span>
              <input type="date" className="w-full rounded-md px-2 py-1 text-xs mt-0.5 outline-none"
                style={selectStyle}
                value={settings.syncStartDate} onChange={(e) => updateSetting('syncStartDate', e.target.value)} />
            </div>
            <div>
              <span className="text-[10px]" style={{ color: TEXT2 }}>结束</span>
              <input type="date" className="w-full rounded-md px-2 py-1 text-xs mt-0.5 outline-none"
                style={selectStyle}
                value={settings.syncEndDate} onChange={(e) => updateSetting('syncEndDate', e.target.value)} />
            </div>
          </div>
        </div>

        {/* System font */}
        <div className="mb-4">
          <label className="text-xs block mb-1" style={{ color: TEXT2 }}>{t('settings.systemFont')}</label>
          <div className="flex gap-2">
            <select style={selectStyle} className="flex-1"
              value={settings.systemFontFamily}
              onChange={(e) => updateSetting('systemFontFamily', e.target.value)}>
              {FONT_OPTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
            <select style={{ ...selectStyle, width: '60px' }}
              value={settings.systemFontSize}
              onChange={(e) => updateSetting('systemFontSize', Number(e.target.value))}>
              {[10,11,12,13,14,15,16,18,20,22,24].map((s) => (<option key={s} value={s}>{s}px</option>))}
            </select>
          </div>
        </div>

        {/* Content font */}
        <div className="mb-4">
          <label className="text-xs block mb-1" style={{ color: TEXT2 }}>{t('settings.contentFont')}</label>
          <div className="flex gap-2">
            <select style={selectStyle} className="flex-1"
              value={settings.contentFontFamily}
              onChange={(e) => updateSetting('contentFontFamily', e.target.value)}>
              {FONT_OPTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
            <select style={{ ...selectStyle, width: '60px' }}
              value={settings.contentFontSize}
              onChange={(e) => updateSetting('contentFontSize', Number(e.target.value))}>
              {[10,11,12,13,14,15,16,18,20,22,24].map((s) => (<option key={s} value={s}>{s}px</option>))}
            </select>
          </div>
        </div>

        {/* ── Notifications ── */}
        <div style={sectionHeader}>── {t('settings.notifications')} ──</div>

        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-xs" style={{ color: TEXT2 }}>{t('settings.notificationsEnabled')}</span>
            <div className="text-[10px]" style={{ color: TEXT3 }}>{t('settings.notificationsHint')}</div>
          </div>
          <button onClick={() => handleToggle('notificationsEnabled')} className="w-9 h-5 rounded-full transition-colors flex-shrink-0"
            style={{ background: settings.notificationsEnabled ? '#3b9e6d' : 'rgba(120,200,145,0.15)' }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white transition-transform m-0.5"
              style={{ transform: settings.notificationsEnabled ? 'translateX(16px)' : 'none' }} />
          </button>
        </div>
        <button onClick={handleTestNotification} className="w-full text-xs py-1.5 rounded-md transition-colors mb-1"
          style={{ background: 'rgba(120,200,145,0.08)', color: TEXT2, border: `1px solid ${BORDER}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}>
          {t('settings.testNotification')}
        </button>

        {/* ── Data Management ── */}
        <div style={sectionHeader}>── {t('settings.data')} ──</div>

        <div className="text-[10px] mb-1" style={{ color: TEXT3 }}>💾 {t('settings.snapshots')}</div>
        <div className="max-h-24 overflow-y-auto mb-2" style={{ border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
          {snapshots.length === 0 ? (
            <div className="text-[10px] p-3 text-center" style={{ color: TEXT3 }}>{t('settings.noSnapshots')}</div>
          ) : (
            snapshots.map((snap) => (
              <div key={snap.id} className="px-2 py-1.5" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] truncate" style={{ color: TEXT1 }}>
                      📍 {snap.name}
                    </div>
                    <div className="text-[9px]" style={{ color: TEXT3 }}>
                      {snap.todoCount}{t('settings.snapshotInfo')}{snap.categoryCount}{t('settings.snapshotInfo2')}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 ml-1">
                    <button onClick={() => setRestoringId(snap.id)} className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                      style={{ background: 'rgba(120,200,145,0.08)', color: TEXT2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}>
                      {t('settings.restore')}
                    </button>
                    <button onClick={() => handleDeleteSnapshot(snap.id)} className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                      style={{ background: 'rgba(192,57,43,0.08)', color: '#c0392b' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.08)')}>
                      {t('settings.delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <button onClick={() => setShowSaveDialog(true)} className="w-full text-xs py-1.5 rounded-md transition-colors mb-3"
          style={{ background: 'rgba(120,200,145,0.06)', color: TEXT2, border: `1px solid ${BORDER}` }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.12)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.06)')}>
          ➕ {t('settings.saveSnapshot')}
        </button>

        <div className="text-[10px] mb-1" style={{ color: TEXT3 }}>📁 {t('settings.fileOps')}</div>
        <div className="flex gap-2 mb-2">
          <button onClick={handleExport} className="flex-1 text-xs py-1.5 rounded-md transition-colors"
            style={{ background: 'rgba(120,200,145,0.08)', color: TEXT2, border: `1px solid ${BORDER}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}>
            📤 {t('settings.exportData')}
          </button>
          <button onClick={handleImport} className="flex-1 text-xs py-1.5 rounded-md transition-colors"
            style={{ background: 'rgba(120,200,145,0.08)', color: TEXT2, border: `1px solid ${BORDER}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}>
            📥 {t('settings.importData')}
          </button>
        </div>

        {/* Toggles */}
        {(['alwaysOnTop', 'autoStart'] as const).map((key) => (
          <div key={key} className="flex items-center justify-between mb-3">
            <span className="text-xs" style={{ color: TEXT2 }}>{t(`settings.${key === 'alwaysOnTop' ? 'alwaysOnTop' : 'autoStart'}`)}</span>
            <button onClick={() => handleToggle(key)} className="w-9 h-5 rounded-full transition-colors"
              style={{ background: settings[key] ? '#3b9e6d' : 'rgba(120,200,145,0.15)' }}>
              <div className="w-3.5 h-3.5 rounded-full bg-white transition-transform m-0.5"
                style={{ transform: settings[key] ? 'translateX(16px)' : 'none' }} />
            </button>
          </div>
        ))}

        {/* Language */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs" style={{ color: TEXT2 }}>{t('settings.language')}</span>
          <button onClick={handleLanguageToggle} className="text-xs px-2 py-1 rounded transition-colors"
            style={{ background: 'rgba(120,200,145,0.08)', color: TEXT1 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}>
            {settings.language === 'zh' ? '中文' : 'English'}
          </button>
        </div>

        {/* Status message */}
        {statusMsg && (
          <div className="text-center text-[10px] mt-2" style={{ color: '#3b9e6d' }}>{statusMsg}</div>
        )}

        {/* Save snapshot dialog overlay */}
        {showSaveDialog && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(10,20,14,0.6)' }} onClick={() => setShowSaveDialog(false)}>
            <div className="rounded-lg p-4 w-64" style={{ background: BG, border: `1px solid ${BORDER}`, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="text-xs mb-3" style={{ color: TEXT1 }}>💾 {t('settings.saveSnapshot')}</div>
              <input
                className="w-full rounded-md px-2 py-1.5 text-xs outline-none mb-3"
                style={{ ...selectStyle, color: '#00e5ff' }}
                placeholder={t('settings.snapshotPlaceholder')}
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveSnapshot(); }}
              />
              <div className="flex gap-2">
                <button onClick={() => setShowSaveDialog(false)} className="flex-1 text-xs py-1.5 rounded-md"
                  style={{ background: 'rgba(120,200,145,0.06)', color: TEXT2 }}>取消</button>
                <button onClick={handleSaveSnapshot} className="flex-1 text-xs py-1.5 rounded-md"
                  style={{ background: '#3b9e6d', color: '#fff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#4ab87f')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#3b9e6d')}>💾 {t('settings.saveSnapshot')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Restore confirmation dialog */}
        {restoringId && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'rgba(10,20,14,0.6)' }} onClick={() => setRestoringId(null)}>
            <div className="rounded-lg p-4 w-64" style={{ background: BG, border: `1px solid ${BORDER}`, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="text-xs mb-2" style={{ color: '#c0392b' }}>⚠ {t('settings.restoreConfirm')}</div>
              <div className="text-[10px] mb-3" style={{ color: TEXT2 }}>
                {t('settings.restoreWarning')}{snapshots.find((s) => s.id === restoringId)?.name}{t('settings.restoreWarning2')}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRestoringId(null)} className="flex-1 text-xs py-1.5 rounded-md"
                  style={{ background: 'rgba(120,200,145,0.06)', color: TEXT2 }}>取消</button>
                <button onClick={() => handleRestoreSnapshot(restoringId)} className="flex-1 text-xs py-1.5 rounded-md"
                  style={{ background: '#c0392b', color: '#fff' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e0473b')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#c0392b')}>🔄 {t('settings.restore')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
