import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { useTodoStore, generateRecurringInstances } from '../../stores/todoStore';
import { useCategoryStore } from '../../stores/categoryStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { TodoCardCollapsed } from '../TodoCard/TodoCardCollapsed';
import { TodoCardExpanded } from '../TodoCard/TodoCardExpanded';
import { CategoryManager } from '../Category/CategoryManager';
import { getWeekDays } from '../../utils/calendarGrid';
import { yToTime, timeToY } from '../../utils/timeSlot';
import { HOUR_HEIGHT } from '../../../shared/constants';
import type { Todo } from '../../../shared/types';

interface WeekViewProps {
  year: number; month: number; day: number;
  onBack: () => void;
}

const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
const TEXT_PRIMARY = '#7dcc9a';
const TEXT_SUB = '#5a8a6e';
const TEXT_DIM = '#4a7a60';
const BORDER = 'rgba(120,200,145,0.08)';
const HOVER_BG = 'rgba(120,200,145,0.06)';
const TODAY_HIGHLIGHT = 'rgba(120,200,145,0.04)';

function DraggableCard({ todo, onDoubleClick, onToggleStatus, isDragging }: {
  todo: Todo; onDoubleClick: () => void; onToggleStatus: () => void; isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: todo.id, data: { todo } });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50, opacity: isDragging ? 0.3 : 1 } : undefined;
  return (
    <div ref={setNodeRef} style={style}>
      <TodoCardCollapsed todo={todo} columnWidth={100} onDoubleClick={onDoubleClick} onToggleStatus={onToggleStatus} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function DroppableColumn({ date, children }: { date: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: date, data: { date } });
  return (
    <div ref={setNodeRef} className="relative h-full"
      style={{ borderLeft: `1px solid ${BORDER}`, background: isOver ? 'rgba(120,200,145,0.04)' : 'transparent' }}>
      {children}
    </div>
  );
}

export function WeekView({ year, month, day, onBack }: WeekViewProps) {
  const { t } = useTranslation();
  const dayNames = t('days', { returnObjects: true }) as string[];
  const gridRef = useRef<HTMLDivElement>(null);

  const [weekStart, setWeekStart] = useState(() => {
    const date = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    return date.subtract(date.day(), 'day');
  });

  const days = getWeekDays(weekStart);
  const todos = useTodoStore((s) => s.todos);
  const addTodo = useTodoStore((s) => s.addTodo);
  const addTodoBatch = useTodoStore((s) => s.addTodoBatch);
  const updateTodo = useTodoStore((s) => s.updateTodo);
  const deleteTodo = useTodoStore((s) => s.deleteTodo);
  const toggleStatus = useTodoStore((s) => s.toggleStatus);
  const categories = useCategoryStore((s) => s.categories);
  const settings = useSettingsStore((s) => s.settings);

  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [creatingTodo, setCreatingTodo] = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);
  const [nowTime, setNowTime] = useState(() => dayjs().format('HH:mm'));

  const goPrev = () => setWeekStart(weekStart.subtract(7, 'day'));
  const goNext = () => setWeekStart(weekStart.add(7, 'day'));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setEditingTodo(null); setCreatingTodo(null); setShowCategories(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTime(dayjs().format('HH:mm')), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => { setActiveDragId(String(event.active.id)); }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const todoId = String(active.id);
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const targetDate = String(over.id);
    const delta = event.delta;
    const currentTop = timeToY(todo.startTime, TOTAL_HEIGHT);
    const newTop = currentTop + delta.y;
    const newStartTime = yToTime(newTop, TOTAL_HEIGHT);
    const [sh, sm] = todo.startTime.split(':').map(Number);
    const [eh, em] = todo.endTime.split(':').map(Number);
    const durationMin = (eh * 60 + em) - (sh * 60 + sm);
    const [nh, nm] = newStartTime.split(':').map(Number);
    const newEndMinutes = nh * 60 + nm + durationMin;
    const newEndTime = `${String(Math.floor(newEndMinutes / 60) % 24).padStart(2, '0')}:${String(newEndMinutes % 60).padStart(2, '0')}`;

    const baseDate = dayjs(todo.date);
    const targetDay = dayjs(targetDate);
    const dayOffset = targetDay.diff(baseDate, 'day');
    const [oldH, oldM] = todo.startTime.split(':').map(Number);
    const minOffset = (nh * 60 + nm) - (oldH * 60 + oldM);

    if (todo.date !== targetDate || todo.startTime !== newStartTime) {
      if (todo.groupId) {
        const groupTodos = todos.filter((t) => t.groupId === todo.groupId && t.id !== todoId);
        for (const gt of groupTodos) {
          const newGroupDate = dayjs(gt.date).add(dayOffset, 'day').format('YYYY-MM-DD');
          const [gh, gm] = gt.startTime.split(':').map(Number);
          const newGroupMin = gh * 60 + gm + minOffset;
          const newGroupTime = `${String(Math.floor(newGroupMin / 60) % 24).padStart(2, '0')}:${String(((newGroupMin % 60) + 60) % 60).padStart(2, '0')}`;
          const [geh, gem] = gt.endTime.split(':').map(Number);
          const newGroupEndMin = geh * 60 + gem + minOffset;
          const newGroupEnd = `${String(Math.floor(newGroupEndMin / 60) % 24).padStart(2, '0')}:${String(((newGroupEndMin % 60) + 60) % 60).padStart(2, '0')}`;
          updateTodo(gt.id, { date: newGroupDate, startTime: newGroupTime, endTime: newGroupEnd });
        }
      }
      updateTodo(todoId, { date: targetDate, startTime: newStartTime, endTime: newEndTime });
    }
  }, [todos, updateTodo]);

  const handleGridDoubleClick = useCallback((date: string, e: React.MouseEvent) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const startTime = yToTime(y, TOTAL_HEIGHT);
    const [h, m] = startTime.split(':').map(Number);
    const endTime = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setCreatingTodo({ date, startTime, endTime });
    setEditingTodo(null);
  }, []);

  const handleCardDoubleClick = useCallback((todo: Todo) => { setEditingTodo(todo); setCreatingTodo(null); }, []);

  const handleSaveNew = useCallback(async (data: { title: string; notes: string; color: string; date: string; startTime: string; endTime: string; categoryId: string | null; notifyEnabled: boolean; notifyLeadMinutes: number }) => {
    if (!data.title.trim()) return;
    const groupId = uuidv4();
    const baseTodo = await addTodo({ date: data.date, startTime: data.startTime, endTime: data.endTime, categoryId: data.categoryId, groupId: null });
    await updateTodo(baseTodo.id, { title: data.title, notes: data.notes, color: data.color, notifyEnabled: data.notifyEnabled, notifyLeadMinutes: data.notifyLeadMinutes });
    const category = categories.find((c) => c.id === data.categoryId);
    if (category && category.recurrenceType !== 'none') {
      await updateTodo(baseTodo.id, { groupId });
      const instances = generateRecurringInstances(data.date, data.startTime, data.endTime, category, settings.syncStartDate, settings.syncEndDate);
      if (instances.length > 0) {
        const newTodos: Todo[] = instances.map((inst) => ({
          id: uuidv4(), title: data.title, notes: data.notes, color: data.color,
          categoryId: data.categoryId, date: inst.date, startTime: inst.startTime,
          endTime: inst.endTime, status: 'incomplete' as const, groupId,
          notifyEnabled: data.notifyEnabled, notifyLeadMinutes: data.notifyLeadMinutes,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }));
        await addTodoBatch(newTodos);
      }
    }
    setCreatingTodo(null);
  }, [addTodo, addTodoBatch, updateTodo, categories, settings]);

  const handleSaveEdit = useCallback(async (data: { title: string; notes: string; color: string; date: string; startTime: string; endTime: string; categoryId: string | null; notifyEnabled: boolean; notifyLeadMinutes: number }) => {
    if (!editingTodo) return;
    await updateTodo(editingTodo.id, { title: data.title, notes: data.notes, color: data.color, date: data.date, startTime: data.startTime, endTime: data.endTime, categoryId: data.categoryId, notifyEnabled: data.notifyEnabled, notifyLeadMinutes: data.notifyLeadMinutes });
    setEditingTodo(null);
  }, [editingTodo, updateTodo]);

  const handleDelete = useCallback(async (id: string) => { await deleteTodo(id); setEditingTodo(null); }, [deleteTodo]);
  const handleToggleStatus = useCallback((id: string) => { toggleStatus(id); }, [toggleStatus]);

  const todosByDate: Record<string, Todo[]> = {};
  for (const d of days) todosByDate[d.date] = todos.filter((t) => t.date === d.date);
  const activeTodo = activeDragId ? todos.find((t) => t.id === activeDragId) : null;

  return (
    <div className="flex flex-col flex-1 p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <button onClick={onBack} className="text-sm px-2 py-1 rounded transition-colors"
          style={{ color: TEXT_SUB, background: 'transparent', fontFamily: 'var(--font-system-family)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_PRIMARY; e.currentTarget.style.background = HOVER_BG; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_SUB; e.currentTarget.style.background = 'transparent'; }}>
          &#x25C0; {t('week.backToMonth')}
        </button>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} className="text-xs px-1" style={{ color: TEXT_SUB, background: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SUB)}>&#x25C0;</button>
          <span className="text-sm" style={{ color: TEXT_PRIMARY, fontFamily: 'var(--font-system-family)' }}>{days[0].date} ~ {days[6].date}</span>
          <button onClick={goNext} className="text-xs px-1" style={{ color: TEXT_SUB, background: 'transparent' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = TEXT_PRIMARY)}
            onMouseLeave={(e) => (e.currentTarget.style.color = TEXT_SUB)}>&#x25B6;</button>
        </div>
        <button onClick={() => setShowCategories(true)} className="text-xs px-2 py-1 rounded transition-colors"
          style={{ color: TEXT_SUB, background: 'transparent', fontFamily: 'var(--font-system-family)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = TEXT_PRIMARY; e.currentTarget.style.background = HOVER_BG; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = TEXT_SUB; e.currentTarget.style.background = 'transparent'; }}>&#x2630;</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1 ml-10 flex-shrink-0">
        {days.map((d, i) => (
          <div key={i} className="text-center py-1 text-xs font-medium" style={{ color: d.isToday ? TEXT_PRIMARY : TEXT_SUB, fontFamily: 'var(--font-system-family)' }}>
            <div>{dayNames[i]}</div>
            <div>{d.day}</div>
          </div>
        ))}
      </div>

      {/* Time grid with DnD */}
      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-y-auto min-h-0">
          <div className="w-10 flex-shrink-0 relative">
            {Array.from({ length: 24 }, (_, i) => (
              <div key={i} className="absolute left-0 right-0 text-[10px] pr-2 text-right" style={{ top: i * HOUR_HEIGHT - 7, color: TEXT_DIM }}>
                {`${String(i).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          <div ref={gridRef} className="flex-1 grid grid-cols-7 relative" style={{ minHeight: TOTAL_HEIGHT }}>
            {/* Current time line */}
            <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: timeToY(nowTime, TOTAL_HEIGHT) }}>
              <div className="flex items-center">
                <div className="w-2 h-2 rounded-full -ml-1 -mt-1" style={{ background: '#00e5ff' }} />
                <div className="flex-1" style={{ borderTop: '1px solid rgba(0,229,255,0.4)' }} />
              </div>
            </div>

            {days.map((day, di) => (
              <DroppableColumn key={di} date={day.date}>
                {Array.from({ length: 25 }, (_, hi) => (
                  <div key={hi} className="absolute left-0 right-0" style={{ top: hi * HOUR_HEIGHT, borderTop: `1px solid ${BORDER}` }} />
                ))}
                {day.isToday && <div className="absolute inset-0" style={{ background: TODAY_HIGHLIGHT }} />}
                <div className="absolute inset-0" onDoubleClick={(e) => handleGridDoubleClick(day.date, e)} />
                {(todosByDate[day.date] || []).map((todo) => (
                  <div key={todo.id} className="absolute left-0.5 right-0.5" style={{ top: timeToY(todo.startTime, TOTAL_HEIGHT) }}>
                    <DraggableCard todo={todo} isDragging={activeDragId === todo.id}
                      onDoubleClick={() => handleCardDoubleClick(todo)}
                      onToggleStatus={() => handleToggleStatus(todo.id)} />
                  </div>
                ))}
              </DroppableColumn>
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeTodo && (
            <div className="opacity-80" style={{ width: 100 }}>
              <TodoCardCollapsed todo={activeTodo} columnWidth={100} onDoubleClick={() => {}} onToggleStatus={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {showCategories && <CategoryManager onClose={() => setShowCategories(false)} />}
      {(editingTodo || creatingTodo) && (
        <TodoCardExpanded todo={editingTodo} initialDate={creatingTodo?.date} initialStartTime={creatingTodo?.startTime}
          initialEndTime={creatingTodo?.endTime}
          onSave={creatingTodo ? handleSaveNew : handleSaveEdit}
          onDelete={editingTodo ? () => handleDelete(editingTodo.id) : undefined}
          onClose={() => { setEditingTodo(null); setCreatingTodo(null); }} />
      )}
    </div>
  );
}
