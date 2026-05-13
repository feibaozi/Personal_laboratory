import { useMemo } from 'react';
import { useTodoStore } from '../../stores/todoStore';
import { ColorDot } from '../common/ColorDot';
import type { CalendarDay } from '../../utils/calendarGrid';

interface DayCellProps { day: CalendarDay; onClick: (day: CalendarDay) => void; }

const DAY_FONT: React.CSSProperties = { fontFamily: 'var(--font-system-family)', fontSize: 'var(--font-system-size)' };

export function DayCell({ day, onClick }: DayCellProps) {
  const allTodos = useTodoStore((s) => s.todos);
  const todos = useMemo(() => allTodos.filter((t) => t.date === day.date), [allTodos, day.date]);

  const colorCounts: Record<string, { incomplete: number; complete: number }> = {};
  for (const todo of todos) {
    if (!colorCounts[todo.color]) colorCounts[todo.color] = { incomplete: 0, complete: 0 };
    if (todo.status === 'incomplete') colorCounts[todo.color].incomplete++;
    else colorCounts[todo.color].complete++;
  }

  const maxDots = 5;
  const dots: { color: string; filled: boolean }[] = [];
  for (const [color, counts] of Object.entries(colorCounts)) {
    for (let i = 0; i < counts.incomplete && dots.length < maxDots; i++) dots.push({ color, filled: true });
  }
  for (const [color, counts] of Object.entries(colorCounts)) {
    for (let i = 0; i < counts.complete && dots.length < maxDots; i++) dots.push({ color, filled: false });
  }
  const overflow = Math.max(0, todos.length - dots.length);

  return (
    <div onClick={() => onClick(day)}
      className={`flex flex-col items-center py-1 cursor-pointer rounded-md transition-colors ${day.isCurrentMonth ? '' : 'opacity-30'}`}
      style={day.isToday
        ? { background: 'rgba(120,200,145,0.08)', boxShadow: 'inset 0 0 0 1px rgba(125,204,154,0.4)' }
        : { background: 'transparent' }}
      onMouseEnter={(e) => { if (!day.isToday) e.currentTarget.style.background = 'rgba(120,200,145,0.04)'; }}
      onMouseLeave={(e) => { if (!day.isToday) e.currentTarget.style.background = 'transparent'; }}>
      <span className="text-xs mb-0.5"
        style={day.isToday ? { ...DAY_FONT, color: '#7dcc9a', fontWeight: 'bold' } : { ...DAY_FONT, color: '#98d8ae' }}>
        {day.day}
      </span>
      <div className="flex flex-wrap justify-center gap-0.5 px-1 min-h-[14px]">
        {dots.map((dot, i) => (<ColorDot key={i} color={dot.color} filled={dot.filled} size={6} />))}
        {overflow > 0 && <span className="text-[10px] leading-[12px]" style={{ color: '#5a8a6e' }}>+{overflow}</span>}
      </div>
    </div>
  );
}
