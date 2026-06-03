import { describe, it, expect } from 'vitest';
import { generateMonthGrid, getWeekStartDate, getWeekDays } from '../src/renderer/utils/calendarGrid';
import dayjs from 'dayjs';

describe('Calendar Grid Utilities', () => {
  describe('generateMonthGrid', () => {
    it('should generate 6 weeks grid', () => {
      const grid = generateMonthGrid(2025, 6);
      expect(grid.length).toBe(6);
      expect(grid[0].length).toBe(7);
    });

    it('should have current month marked correctly', () => {
      const grid = generateMonthGrid(2025, 6);
      const juneDays = grid.flat().filter(d => d.isCurrentMonth);
      expect(juneDays.length).toBeGreaterThanOrEqual(28);
      expect(juneDays.length).toBeLessThanOrEqual(31);
    });

    it('should have correct date format', () => {
      const grid = generateMonthGrid(2025, 6);
      const firstDay = grid[0][0];
      expect(firstDay.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getWeekStartDate', () => {
    it('should return Sunday as start of week', () => {
      // June 1, 2025 is Sunday
      const weekStart = getWeekStartDate(2025, 6, 1);
      expect(weekStart.format('YYYY-MM-DD')).toBe('2025-06-01');
    });

    it('should go back to previous Sunday', () => {
      // June 3, 2025 is Tuesday, week starts on June 1
      const weekStart = getWeekStartDate(2025, 6, 3);
      expect(weekStart.format('YYYY-MM-DD')).toBe('2025-06-01');
    });
  });

  describe('getWeekDays', () => {
    it('should generate 7 days', () => {
      const weekStart = dayjs('2025-06-01');
      const days = getWeekDays(weekStart);
      expect(days.length).toBe(7);
    });

    it('should have consecutive dates', () => {
      const weekStart = dayjs('2025-06-01');
      const days = getWeekDays(weekStart);
      
      expect(days[0].date).toBe('2025-06-01');
      expect(days[1].date).toBe('2025-06-02');
      expect(days[2].date).toBe('2025-06-03');
      expect(days[3].date).toBe('2025-06-04');
      expect(days[4].date).toBe('2025-06-05');
      expect(days[5].date).toBe('2025-06-06');
      expect(days[6].date).toBe('2025-06-07');
    });
  });
});
