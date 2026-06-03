import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    step: vi.fn().mockReturnValue(false),
    getAsObject: vi.fn(),
    bind: vi.fn(),
    free: vi.fn(),
  }),
  run: vi.fn(),
};

vi.mock('../electron/db/database', () => ({
  getDatabase: vi.fn(() => mockDb),
  saveDatabase: vi.fn(),
}));

export { mockDb };