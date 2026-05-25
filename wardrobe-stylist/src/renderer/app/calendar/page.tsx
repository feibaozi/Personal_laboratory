import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useWardrobeStore } from '../../stores/wardrobe-store';
import { LocalImage } from '../../components/shared/LocalImage';

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function CalendarPage() {
  const garments = useWardrobeStore((s) => s.garments);
  const loadGarments = useWardrobeStore((s) => s.loadGarments);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (garments.length === 0) loadGarments(); }, []);

  // Load records from database for visible month
  useEffect(() => {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    window.electronAPI.getRecordsByWeek(startDate, endDate).then((dbRecords: any[]) => {
      const map: Record<string, string[]> = {};
      for (const r of dbRecords) {
        if (r.garmentIds) {
          try { map[r.date] = JSON.parse(r.garmentIds); } catch {}
        }
      }
      setRecords(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [year, month]);

  const weeks = getMonthDays(year, month);
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const toggleGarment = (id: string) => {
    setSelectedGarments((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const saveRecord = async () => {
    if (!selectedDate || selectedGarments.length === 0) return;
    try {
      // Check if record exists for this date
      const existing = await window.electronAPI.getRecordByDate(selectedDate);
      if (existing) {
        await window.electronAPI.updateRecord(existing.id, { garmentIds: selectedGarments });
      } else {
        await window.electronAPI.createRecord({ date: selectedDate, garmentIds: selectedGarments });
      }
      setRecords((prev) => ({ ...prev, [selectedDate]: [...selectedGarments] }));
    } catch (e) {
      console.error('Failed to save record:', e);
    }
    setSelectedGarments([]);
    setSelectedDate(null);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in flex gap-8">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">穿搭日历</h1>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100"><ChevronLeft size={20} /></button>
            <span className="text-lg font-medium">{year}年{month}月</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-[var(--text-secondary)] py-2">{d}</div>
          ))}
        </div>

        <div className="border border-[var(--border-light)] rounded-xl overflow-hidden">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-[var(--border-light)] last:border-b-0">
              {week.map((day, di) => {
                if (day === null) return <div key={di} className="aspect-square bg-gray-50/50" />;
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const hasRecord = records[dateStr] && records[dateStr].length > 0;
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;

                return (
                  <div
                    key={di}
                    onClick={() => { setSelectedDate(dateStr); setSelectedGarments(records[dateStr] || []); }}
                    className={`aspect-square p-1.5 cursor-pointer border-r border-[var(--border-light)] last:border-r-0 transition-colors ${
                      isSelected ? 'bg-[var(--accent)]/10' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm ${isToday ? 'font-bold text-blue-600' : ''}`}>{day}</span>
                    {hasRecord && (
                      <div className="mt-1 flex gap-0.5 flex-wrap">
                        {records[dateStr].slice(0, 3).map((gid) => {
                          const g = garments.find((gg) => gg.id === gid);
                          return g ? (
                            <div key={gid} className="w-6 h-8 rounded overflow-hidden border">
                              <LocalImage path={g.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="w-72">
        {selectedDate ? (
          <div className="bg-white rounded-xl border border-[var(--border-light)] p-5 shadow-sm sticky top-8">
            <h3 className="font-semibold mb-1">{selectedDate}</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">选择当天穿的单品</p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto mb-4">
              {garments.filter((g) => g.status === 'active').map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGarment(g.id)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-colors ${
                    selectedGarments.includes(g.id)
                      ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                      : 'border border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-10 rounded overflow-hidden bg-gray-50 flex-shrink-0">
                    <LocalImage path={g.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <span className="truncate">{g.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={saveRecord}
              disabled={selectedGarments.length === 0}
              className="w-full py-2 rounded-lg bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-light)] disabled:opacity-50 transition-colors"
            >
              保存记录 ({selectedGarments.length} 件)
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[var(--border-light)] p-5 shadow-sm">
            <p className="text-sm text-[var(--text-secondary)]">点击日历上的某一天，记录当天的穿搭</p>
          </div>
        )}
      </div>
    </div>
  );
}
