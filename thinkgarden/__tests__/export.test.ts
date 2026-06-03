import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exportFrameworkMermaid, exportFrameworkMarkdown } from '../electron/db/export';
import { getFrameworkTree, getCurrentFrameworkId } from '../electron/db/nodes';

vi.mock('../electron/db/nodes', () => ({
  getFrameworkTree: vi.fn(),
  getCurrentFrameworkId: vi.fn(),
}));

const mockGetFrameworkTree = vi.mocked(getFrameworkTree);
const mockGetCurrentFrameworkId = vi.mocked(getCurrentFrameworkId);

describe('Export Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportFrameworkMermaid', () => {
    it('should export simple tree as mermaid', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        icon: '📚',
        children: [],
      });

      const result = exportFrameworkMermaid();
      expect(result).toContain('mindmap');
      expect(result).toContain('📚 Root');
    });

    it('should export nested tree as mermaid', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        icon: '🌲',
        children: [
          {
            id: 2,
            title: 'Child1',
            children: [],
          },
          {
            id: 3,
            title: 'Child2',
            icon: '🎯',
            children: [
              {
                id: 4,
                title: 'GrandChild',
                children: [],
              },
            ],
          },
        ],
      });

      const result = exportFrameworkMermaid();
      expect(result).toContain('🌲 Root');
      expect(result).toContain('Child1');
      expect(result).toContain('🎯 Child2');
      expect(result).toContain('GrandChild');
    });

    it('should use provided framework id', () => {
      mockGetFrameworkTree.mockReturnValue({
        id: 100,
        title: 'Custom',
        children: [],
      });

      exportFrameworkMermaid(100);
      expect(mockGetFrameworkTree).toHaveBeenCalledWith(100);
    });
  });

  describe('exportFrameworkMarkdown', () => {
    it('should export simple tree as markdown', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        children: [],
      });

      const result = exportFrameworkMarkdown();
      expect(result).toContain('# Root');
    });

    it('should export tree with summary as markdown', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        summary: 'This is a summary',
        children: [],
      });

      const result = exportFrameworkMarkdown();
      expect(result).toContain('# Root');
      expect(result).toContain('> This is a summary');
    });

    it('should export tree with tags as markdown', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        tags: [
          { id: 1, name: 'Important' },
          { id: 2, name: 'Todo' },
        ],
        children: [],
      });

      const result = exportFrameworkMarkdown();
      expect(result).toContain('# Root');
      expect(result).toContain('#Important #Todo');
    });

    it('should export tree with node type as markdown', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Root',
        node_type: 'concept',
        children: [],
      });

      const result = exportFrameworkMarkdown();
      expect(result).toContain('# Root [concept]');
    });

    it('should export nested tree with correct heading levels', () => {
      mockGetCurrentFrameworkId.mockReturnValue(1);
      mockGetFrameworkTree.mockReturnValue({
        id: 1,
        title: 'Level1',
        children: [
          {
            id: 2,
            title: 'Level2',
            children: [
              {
                id: 3,
                title: 'Level3',
                children: [
                  {
                    id: 4,
                    title: 'Level4',
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      });

      const result = exportFrameworkMarkdown();
      expect(result).toContain('# Level1');
      expect(result).toContain('## Level2');
      expect(result).toContain('### Level3');
      expect(result).toContain('#### Level4');
    });
  });
});