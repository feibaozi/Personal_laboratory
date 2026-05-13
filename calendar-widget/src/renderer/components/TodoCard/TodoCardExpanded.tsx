import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCategoryStore } from '../../stores/categoryStore';
import { DEFAULT_COLORS } from '../../../shared/constants';
import type { Todo } from '../../../shared/types';

interface Props {
  todo: Todo | null; initialDate?: string; initialStartTime?: string; initialEndTime?: string;
  onSave: (data: { title: string; notes: string; color: string; date: string; startTime: string; endTime: string; categoryId: string | null; notifyEnabled: boolean; notifyLeadMinutes: number }) => void;
  onDelete?: () => void; onClose: () => void;
}

const BORDER = 'rgba(120,200,145,0.12)';
const SYS_LABEL: React.CSSProperties = { fontSize: '10px', color: '#5a8a6e', fontFamily: 'var(--font-system-family)', display: 'block', marginBottom: '2px' };
const SYS_INPUT: React.CSSProperties = { background: 'rgba(120,200,145,0.06)', border: `1px solid ${BORDER}`, borderRadius: '6px', outline: 'none', color: '#7dcc9a', fontFamily: 'var(--font-system-family)', fontSize: '12px' };
const SECTION_DIVIDER: React.CSSProperties = { fontSize: '10px', color: '#4a7a60', fontFamily: 'var(--font-system-family)', textAlign: 'center' as const, margin: '8px 0', letterSpacing: '1px' };

const LEAD_OPTIONS = [1, 3, 5, 10, 15, 30];

export function TodoCardExpanded({ todo, initialDate, initialStartTime, initialEndTime, onSave, onDelete, onClose }: Props) {
  const { t } = useTranslation();
  const categories = useCategoryStore((s) => s.categories);
  const [title, setTitle] = useState(todo?.title ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const [color, setColor] = useState(todo?.color ?? DEFAULT_COLORS[0]);
  const [categoryId, setCategoryId] = useState(todo?.categoryId ?? '');
  const [date, setDate] = useState(todo?.date ?? initialDate ?? '');
  const [startTime, setStartTime] = useState(todo?.startTime ?? initialStartTime ?? '09:00');
  const [endTime, setEndTime] = useState(todo?.endTime ?? initialEndTime ?? '10:00');
  const [notifyEnabled, setNotifyEnabled] = useState(todo?.notifyEnabled ?? false);
  const [notifyLeadMinutes, setNotifyLeadMinutes] = useState(todo?.notifyLeadMinutes ?? 5);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), notes, color, date, startTime, endTime, categoryId: categoryId || null, notifyEnabled, notifyLeadMinutes });
  };
  const activeCategory = categories.find((c) => c.id === categoryId);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,20,14,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-5 w-80 shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: '#182a20', border: `1px solid ${BORDER}`, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <input style={{ ...SYS_INPUT, width: '100%', padding: '6px 10px', color: '#00e5ff', fontFamily: 'var(--font-content-family)', fontSize: 'var(--font-content-size)' }}
          placeholder={t('todo.title')} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div style={{ marginBottom: '10px' }} />
        <div className="grid grid-cols-2 gap-2" style={{ marginBottom: '10px' }}>
          <div>
            <label style={SYS_LABEL}>{t('todo.date')}</label>
            <input type="date" style={{ ...SYS_INPUT, width: '100%', padding: '4px 6px' }} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div><label style={SYS_LABEL}>{t('todo.startTime')}</label><input type="time" style={{ ...SYS_INPUT, width: '100%', padding: '4px 4px' }} value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><label style={SYS_LABEL}>{t('todo.endTime')}</label><input type="time" style={{ ...SYS_INPUT, width: '100%', padding: '4px 4px' }} value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
        </div>
        <label style={SYS_LABEL}>{t('todo.category')}</label>
        <select style={{ ...SYS_INPUT, width: '100%', padding: '4px 6px', background: activeCategory ? `${activeCategory.color}18` : 'rgba(120,200,145,0.06)' }}
          value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">--</option>
          {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
        </select>
        <div style={{ marginBottom: '10px' }} />
        <label style={SYS_LABEL}>{t('todo.color')}</label>
        <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: '10px' }}>
          {DEFAULT_COLORS.map((c) => (
            <button key={c} className="rounded-full transition-transform hover:scale-105"
              style={{ width: '24px', height: '24px', backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}66` : 'none', transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
              onClick={() => setColor(c)} />
          ))}
        </div>

        {/* Notification settings */}
        <div style={SECTION_DIVIDER}>── {t('todo.notify')} ──</div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px]" style={{ color: notifyEnabled ? '#7dcc9a' : '#4a7a60', fontFamily: 'var(--font-system-family)' }}>
            {t('todo.notifyEnabled')}
          </span>
          <button onClick={() => setNotifyEnabled(!notifyEnabled)} className="w-9 h-5 rounded-full transition-colors"
            style={{ background: notifyEnabled ? '#3b9e6d' : 'rgba(120,200,145,0.15)' }}>
            <div className="w-3.5 h-3.5 rounded-full bg-white transition-transform m-0.5"
              style={{ transform: notifyEnabled ? 'translateX(16px)' : 'none' }} />
          </button>
        </div>
        {notifyEnabled && (
          <div className="flex items-center gap-2" style={{ marginBottom: '10px' }}>
            <span className="text-[10px]" style={{ color: '#5a8a6e', fontFamily: 'var(--font-system-family)', flexShrink: 0 }}>
              {t('todo.notifyLead')}
            </span>
            <select style={{ ...SYS_INPUT, padding: '3px 5px', fontSize: '11px', width: '80px' }}
              value={notifyLeadMinutes} onChange={(e) => setNotifyLeadMinutes(Number(e.target.value))}>
              {LEAD_OPTIONS.map((min) => (
                <option key={min} value={min}>{min} {t('todo.minutes')}</option>
              ))}
            </select>
          </div>
        )}

        <label style={SYS_LABEL}>{t('todo.notes')}</label>
        <textarea style={{ ...SYS_INPUT, width: '100%', height: '80px', resize: 'none', marginBottom: '14px', color: '#5ce0ff', fontFamily: 'var(--font-content-family)', fontSize: 'var(--font-content-size)' }}
          placeholder={t('todo.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex-1 text-sm py-2 rounded-md transition-colors"
            style={{ background: '#3b9e6d', color: '#fff', border: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#4ab87f')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b9e6d')}>{t('todo.save')}</button>
          {onDelete && (
            <button onClick={onDelete} className="px-4 text-sm py-2 rounded-md transition-colors"
              style={{ background: 'rgba(192,57,43,0.15)', color: '#c0392b', border: 'none' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(192,57,43,0.15)')}>{t('todo.delete')}</button>
          )}
        </div>
      </div>
    </div>
  );
}
