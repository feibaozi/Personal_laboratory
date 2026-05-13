import { durationToHeight } from '../../utils/timeSlot';
import { HOUR_HEIGHT } from '../../../shared/constants';
import type { Todo } from '../../../shared/types';

interface Props {
  todo: Todo;
  columnWidth: number;
  onDoubleClick: () => void;
  onToggleStatus: () => void;
  dragHandleProps?: Record<string, any>;
}

const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;

export function TodoCardCollapsed({ todo, onDoubleClick, onToggleStatus, dragHandleProps }: Props) {
  const height = Math.max(durationToHeight(todo.startTime, todo.endTime, TOTAL_HEIGHT), 28);
  const isComplete = todo.status === 'complete';

  return (
    <div className="rounded-md overflow-hidden group relative"
      style={{ height, backgroundColor: `${todo.color}20`, borderLeft: `3px solid ${todo.color}`, opacity: isComplete ? 0.5 : 1 }}>
      <div className="absolute top-0 left-0 right-0 h-1.5 cursor-grab active:cursor-grabbing z-10 rounded-t-md"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        {...dragHandleProps} />
      <div className="px-1.5 py-0.5 flex flex-col justify-center h-full cursor-pointer"
        onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}>
        <span className="text-[11px] font-medium truncate"
          style={{
            fontFamily: 'var(--font-content-family)',
            fontSize: 'var(--font-content-size)',
            color: isComplete ? '#5a8a6e' : '#00e5ff',
            textDecoration: isComplete ? 'line-through' : 'none',
          }}>
          {todo.title || '无标题'}
        </span>
        {height > 40 && (
          <span className="mt-0.5" style={{ fontSize: '11px', fontFamily: 'var(--font-system-family)', color: '#7dcc9a' }}>
            {todo.startTime}-{todo.endTime}
          </span>
        )}
      </div>
      <button className="absolute right-1 bottom-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-10"
        style={{ backgroundColor: isComplete ? todo.color : 'transparent', borderColor: todo.color }}
        onClick={(e) => { e.stopPropagation(); onToggleStatus(); }} />
    </div>
  );
}
