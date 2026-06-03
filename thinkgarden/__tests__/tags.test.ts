import { describe, it, expect, beforeEach, vi } from 'vitest';
import './setup';
import { getAllTags, getOrCreateTag, setNodeTags } from '../electron/db/tags';
import { getDatabase, saveDatabase } from '../electron/db/database';

const mockGetDatabase = vi.mocked(getDatabase);
const mockSaveDatabase = vi.mocked(saveDatabase);

describe('Tags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllTags', () => {
    it('should return empty array when no tags exist', () => {
      const result = getAllTags();
      expect(result).toEqual([]);
    });

    it('should fetch and return all tags', () => {
      const mockPrepare = vi.fn().mockReturnValue({
        step: vi.fn()
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false),
        getAsObject: vi.fn()
          .mockReturnValueOnce({ id: 1, name: 'Tag1', color: '#ff0000', created_at: '2024-01-01' })
          .mockReturnValueOnce({ id: 2, name: 'Tag2', color: null, created_at: '2024-01-02' }),
        free: vi.fn(),
      });

      mockGetDatabase.mockReturnValue({
        prepare: mockPrepare,
        run: vi.fn(),
      } as any);

      const result = getAllTags();
      expect(result.length).toBe(2);
      expect(result[0]).toEqual({
        id: 1,
        name: 'Tag1',
        color: '#ff0000',
        created_at: '2024-01-01',
      });
      expect(mockPrepare).toHaveBeenCalledWith('SELECT * FROM tags ORDER BY name');
    });
  });

  describe('getOrCreateTag', () => {
    it('should return existing tag id when tag exists', () => {
      const mockPrepare = vi.fn().mockReturnValue({
        step: vi.fn().mockReturnValue(true),
        getAsObject: vi.fn().mockReturnValue({ id: 10 }),
        bind: vi.fn(),
        free: vi.fn(),
      });

      mockGetDatabase.mockReturnValue({
        prepare: mockPrepare,
        run: vi.fn(),
      } as any);

      const id = getOrCreateTag('ExistingTag');
      expect(id).toBe(10);
    });

    it('should create new tag when tag does not exist', () => {
      const mockStep1 = vi.fn().mockReturnValue(false);
      const mockStep2 = vi.fn().mockReturnValue(true);
      const mockGetAsObj = vi.fn().mockReturnValue({ id: 15 });
      const mockFree = vi.fn();
      const mockRun = vi.fn();

      const mockPrepare = vi.fn()
        .mockReturnValueOnce({ step: mockStep1, getAsObject: mockGetAsObj, bind: vi.fn(), free: mockFree })
        .mockReturnValueOnce({ step: mockStep2, getAsObject: mockGetAsObj, bind: vi.fn(), free: mockFree });

      mockGetDatabase.mockReturnValue({
        prepare: mockPrepare,
        run: mockRun,
      } as any);

      const id = getOrCreateTag('NewTag', '#00ff00');
      expect(id).toBe(15);
      expect(mockRun).toHaveBeenCalledWith(
        'INSERT INTO tags (name, color) VALUES (?, ?)',
        ['NewTag', '#00ff00']
      );
      expect(mockSaveDatabase).toHaveBeenCalled();
    });
  });

  describe('setNodeTags', () => {
    it('should delete existing tags and set new tags', () => {
      const mockRun = vi.fn();
      const mockStep1 = vi.fn().mockReturnValue(false);
      const mockStep2 = vi.fn().mockReturnValue(true);
      const mockGetAsObj = vi.fn().mockReturnValue({ id: 25 });
      const mockBind = vi.fn();
      const mockFree = vi.fn();

      const mockStmt1 = { step: mockStep1, getAsObject: mockGetAsObj, bind: mockBind, free: mockFree };
      const mockStmt2 = { step: mockStep2, getAsObject: mockGetAsObj, bind: mockBind, free: mockFree };
      
      const prepareCallCount = 2 * 2; // 2 tags * 2 prepares each
      const mockPrepare = vi.fn();
      for (let i = 0; i < prepareCallCount; i++) {
        mockPrepare.mockReturnValueOnce(i % 2 === 0 ? mockStmt1 : mockStmt2);
      }

      mockGetDatabase.mockReturnValue({
        prepare: mockPrepare,
        run: mockRun,
      } as any);

      setNodeTags(42, ['TagA', 'TagB']);

      expect(mockRun).toHaveBeenCalledWith('DELETE FROM node_tags WHERE node_id = ?', [42]);
      expect(mockSaveDatabase).toHaveBeenCalled();
    });
  });
});