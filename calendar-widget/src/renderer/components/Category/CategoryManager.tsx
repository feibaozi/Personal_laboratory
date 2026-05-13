import { useState } from 'react';
import { useCategoryStore } from '../../stores/categoryStore';
import { DEFAULT_COLORS } from '../../../shared/constants';
import type { Category } from '../../../shared/types';

interface Props { onClose: () => void; }

const RECURRENCE_LABELS: Record<string, string> = { none: '不重复', weekly: '每周', monthly: '每月', custom: '自定义间隔' };
const BORDER = 'rgba(120,200,145,0.12)';
const INP: React.CSSProperties = { background: 'rgba(120,200,145,0.06)', border: `1px solid ${BORDER}`, borderRadius: '6px', outline: 'none' };

export function CategoryManager({ onClose }: Props) {
  const categories = useCategoryStore((s) => s.categories);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const updateCategory = useCategoryStore((s) => s.updateCategory);
  const deleteCategory = useCategoryStore((s) => s.deleteCategory);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<Category['recurrenceType']>('none');
  const [editDays, setEditDays] = useState(7);

  const handleAdd = async () => { if (!newName.trim()) return; await addCategory(newName.trim(), newColor); setNewName(''); };
  const startEdit = (cat: Category) => { setEditingId(cat.id); setEditType(cat.recurrenceType); setEditDays(cat.recurrenceDays); };
  const saveEdit = async (id: string) => { await updateCategory(id, { recurrenceType: editType, recurrenceDays: editDays }); setEditingId(null); };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(10,20,14,0.5)' }} onClick={onClose}>
      <div className="rounded-xl p-5 w-80 shadow-2xl" style={{ background: '#182a20', border: `1px solid ${BORDER}`, pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-medium mb-3" style={{ color: '#7dcc9a', fontFamily: 'var(--font-system-family)' }}>分类管理</h3>
        <div className="flex gap-2 mb-2">
          <input className="flex-1 rounded-md px-2 py-1.5 text-xs outline-none" style={{ ...INP, color: '#00e5ff', fontFamily: 'var(--font-content-family)', fontSize: 'var(--font-content-size)' }}
            placeholder="分类名称" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
          <button onClick={handleAdd} className="px-3 py-1.5 text-xs rounded-md transition-colors" style={{ background: '#3b9e6d', color: '#fff' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#4ab87f')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#3b9e6d')}>添加</button>
        </div>
        <div className="flex gap-1.5 mb-3">
          {DEFAULT_COLORS.map((c) => (
            <button key={c} className="w-5 h-5 rounded-full transition-transform hover:scale-105"
              style={{ backgroundColor: c, boxShadow: newColor === c ? `0 0 0 2px ${c}66` : 'none', transform: newColor === c ? 'scale(1.15)' : 'scale(1)' }}
              onClick={() => setNewColor(c)} />
          ))}
        </div>
        <div className="pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
          {categories.length === 0 && <p className="text-xs text-center py-2" style={{ color: '#5a8a6e', fontFamily: 'var(--font-system-family)' }}>暂无分类</p>}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-lg p-2" style={{ border: `1px solid ${BORDER}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-xs flex-1 truncate" style={{ color: '#7dcc9a', fontFamily: 'var(--font-system-family)' }}>{cat.name}</span>
                  {editingId === cat.id ? (
                    <button onClick={() => saveEdit(cat.id)} className="text-[10px] px-1" style={{ color: '#00e5ff' }}>保存</button>
                  ) : (
                    <button onClick={() => startEdit(cat)} className="text-[10px] px-1" style={{ color: '#5a8a6e' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#7dcc9a')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#5a8a6e')}>设置</button>
                  )}
                  <button onClick={() => deleteCategory(cat.id)} className="text-[10px] px-1" style={{ color: '#c0392b', opacity: 0.6 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}>删除</button>
                </div>
                {editingId === cat.id && (
                  <div className="mt-2 space-y-2">
                    <select className="w-full rounded-md px-2 py-1 text-xs outline-none" style={{ ...INP, color: '#7dcc9a', fontFamily: 'var(--font-system-family)' }}
                      value={editType} onChange={(e) => setEditType(e.target.value as Category['recurrenceType'])}>
                      {Object.entries(RECURRENCE_LABELS).map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
                    </select>
                    {editType === 'custom' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color: '#5a8a6e', fontFamily: 'var(--font-system-family)' }}>间隔</span>
                        <input type="number" min="1" max="365" className="w-16 rounded-md px-2 py-1 text-xs outline-none"
                          style={{ ...INP, color: '#00e5ff', fontFamily: 'var(--font-content-family)' }}
                          value={editDays} onChange={(e) => setEditDays(Number(e.target.value))} />
                        <span className="text-[10px]" style={{ color: '#5a8a6e', fontFamily: 'var(--font-system-family)' }}>天</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
