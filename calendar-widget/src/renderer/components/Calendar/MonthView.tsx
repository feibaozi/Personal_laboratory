import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { DayCell } from './DayCell';
import { DayOfWeekHeader } from './DayOfWeekHeader';
import { generateMonthGrid } from '../../utils/calendarGrid';
import type { CalendarDay } from '../../utils/calendarGrid';

interface MonthViewProps { onDayClick: (day: CalendarDay) => void; }

const SYS_FONT: React.CSSProperties = { fontFamily: 'var(--font-system-family)', fontSize: 'var(--font-system-size)' };

export function MonthView({ onDayClick }: MonthViewProps) {
  const { t } = useTranslation();
  const now = dayjs();
  const [year, setYear] = useState(now.year());
  const [month, setMonth] = useState(now.month() + 1);
  const weeks = generateMonthGrid(year, month);

  const goPrev = () => { if (month === 1) { setYear(year - 1); setMonth(12); } else setMonth(month - 1); };
  const goNext = () => { if (month === 12) { setYear(year + 1); setMonth(1); } else setMonth(month + 1); };
  const goToday = () => { setYear(now.year()); setMonth(now.month() + 1); };

  return (
    <div className="flex flex-col flex-1 p-3">
      <div className="flex items-center justify-between mb-3">
        <button onClick={goPrev} className="text-sm px-2 py-1 rounded transition-colors"
          style={{ ...SYS_FONT, color: '#5a8a6e', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#7dcc9a'; e.currentTarget.style.background = 'rgba(120,200,145,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5a8a6e'; e.currentTarget.style.background = 'transparent'; }}>&#x25C0;</button>
        <button onClick={goToday} className="text-sm font-medium px-2 py-1 rounded transition-colors"
          style={{ ...SYS_FONT, color: '#7dcc9a', background: 'transparent' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(120,200,145,0.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {year} {t('month.today')} {String(month).padStart(2, '0')}
        </button>
        <button onClick={goNext} className="text-sm px-2 py-1 rounded transition-colors"
          style={{ ...SYS_FONT, color: '#5a8a6e', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#7dcc9a'; e.currentTarget.style.background = 'rgba(120,200,145,0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#5a8a6e'; e.currentTarget.style.background = 'transparent'; }}>&#x25B6;</button>
      </div>
      <DayOfWeekHeader />
      <div className="flex flex-col flex-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0 flex-1">
            {week.map((day, di) => (<DayCell key={di} day={day} onClick={onDayClick} />))}
          </div>
        ))}
      </div>
    </div>
  );
}
