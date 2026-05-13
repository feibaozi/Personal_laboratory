import { useTranslation } from 'react-i18next';

export function DayOfWeekHeader() {
  const { t } = useTranslation();
  const days = t('days', { returnObjects: true }) as string[];
  return (
    <div className="grid grid-cols-7 gap-0 mb-1">
      {days.map((day, i) => (
        <div key={i} className="text-center text-[11px] font-medium py-1"
          style={{ color: '#5a8a6e', fontFamily: 'var(--font-system-family)' }}>
          {day}
        </div>
      ))}
    </div>
  );
}
