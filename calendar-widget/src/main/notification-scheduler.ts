import { getSetting, getAllTodos, getAllCategories } from './database';
import { showNotificationWindow } from './notification-window';

let intervalId: ReturnType<typeof setInterval> | null = null;
const notifiedIds = new Set<string>();
let lastDate = '';

export function startNotificationScheduler(): void {
  if (intervalId) return;

  const check = () => {
    try {
      const enabled = getSetting('notificationsEnabled');
      if (enabled !== 'true') return;

      const today = toDateStr(new Date());

      // Reset notified set when date changes
      if (today !== lastDate) {
        notifiedIds.clear();
        lastDate = today;
      }

      const todos = getAllTodos();
      const categories = getAllCategories();
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      for (const todo of todos) {
        if (todo.status === 'complete') continue;
        if (!todo.notifyEnabled) continue;
        if (todo.date !== today) continue;

        const key = todo.id;
        if (notifiedIds.has(key)) continue;

        const [sh, sm] = (todo.startTime || '00:00').split(':').map(Number);
        const todoMinutes = sh * 60 + sm;
        const lead = todo.notifyLeadMinutes || 5;
        const diff = todoMinutes - nowMinutes;

        if (diff >= 0 && diff <= lead) {
          notifiedIds.add(key);

          const category = categories.find((c: any) => c.id === (todo.category_id ?? todo.categoryId));
          showNotificationWindow(
            {
              title: todo.title || '',
              startTime: todo.startTime || todo.start_time || '00:00',
              endTime: todo.endTime || todo.end_time || '00:00',
              categoryName: category?.name,
            },
            lead,
          );
        }
      }
    } catch (err) {
      console.error('[NotificationScheduler] Error:', err);
    }
  };

  // Run immediately on start, then every 60 seconds
  check();
  intervalId = setInterval(check, 60000);
}

export function stopNotificationScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  notifiedIds.clear();
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
