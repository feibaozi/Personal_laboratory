import { HOUR_HEIGHT, TIME_SLOTS } from '../../shared/constants';

export function timeToY(time: string | undefined, containerHeight: number): number {
  if (!time || typeof time !== 'string') return 0;
  const parts = time.split(':');
  if (parts.length < 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  const totalMinutes = h * 60 + m;
  const slotHeight = containerHeight / TIME_SLOTS;
  return (totalMinutes / 30) * slotHeight;
}

export function yToTime(y: number, containerHeight: number): string {
  const slotHeight = containerHeight / TIME_SLOTS;
  const slotIndex = Math.round(y / slotHeight);
  const clamped = Math.max(0, Math.min(TIME_SLOTS - 1, slotIndex));
  const hours = Math.floor(clamped / 2);
  const minutes = (clamped % 2) * 30;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function durationToHeight(startTime: string | undefined, endTime: string | undefined, containerHeight: number): number {
  if (!startTime || !endTime || typeof startTime !== 'string' || typeof endTime !== 'string') return 28;
  const startParts = startTime.split(':');
  const endParts = endTime.split(':');
  if (startParts.length < 2 || endParts.length < 2) return 28;
  const [sh, sm] = startParts.map(Number);
  const [eh, em] = endParts.map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 28;
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = Math.max(30, endMinutes - startMinutes);
  const slotHeight = containerHeight / TIME_SLOTS;
  return (diff / 30) * slotHeight;
}
