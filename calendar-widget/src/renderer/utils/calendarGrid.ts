import dayjs from 'dayjs';

export interface CalendarDay {
  date: string;    // "YYYY-MM-DD"
  day: number;     // 1-31
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function generateMonthGrid(year: number, month: number): CalendarDay[][] {
  const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const startOfWeek = firstDay.day(); // 0=Sun

  // Start from the Sunday of the week containing the 1st
  const gridStart = firstDay.subtract(startOfWeek, 'day');
  const today = dayjs().format('YYYY-MM-DD');

  const weeks: CalendarDay[][] = [];
  let current = gridStart;

  for (let w = 0; w < 6; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.format('YYYY-MM-DD');
      week.push({
        date: dateStr,
        day: current.date(),
        isCurrentMonth: current.month() + 1 === month,
        isToday: dateStr === today,
      });
      current = current.add(1, 'day');
    }
    weeks.push(week);
  }

  return weeks;
}

export function getWeekStartDate(year: number, month: number, day: number): dayjs.Dayjs {
  const date = dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  return date.subtract(date.day(), 'day');
}

export function getWeekDays(weekStart: dayjs.Dayjs): CalendarDay[] {
  const today = dayjs().format('YYYY-MM-DD');
  const days: CalendarDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = weekStart.add(i, 'day');
    days.push({
      date: d.format('YYYY-MM-DD'),
      day: d.date(),
      isCurrentMonth: true,
      isToday: d.format('YYYY-MM-DD') === today,
    });
  }
  return days;
}
