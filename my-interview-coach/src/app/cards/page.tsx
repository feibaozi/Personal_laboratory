'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useCardsStore } from '@/store';
import { CARD_CATEGORY_LABELS } from '@/lib/types';
import EmptyState from '@/components/common/EmptyState';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function CardsPage() {
  const {
    cards,
    loading,
    filterCategory,
    filterTag,
    searchQuery,
    fetchCards,
    createCard,
    deleteCard,
    setFilter,
    setSearch,
  } = useCardsStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newTags, setNewTags] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCreate = useCallback(async () => {
    if (!newAnswer.trim()) return;
    setError('');
    try {
      await createCard({
        question: newQuestion.trim(),
        answer: newAnswer.trim(),
        category: newCategory,
        tags: newTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setCreateOpen(false);
      setNewQuestion('');
      setNewAnswer('');
      setNewTags('');
      setNewCategory('other');
      fetchCards();
    } catch (err) {
      setError(String(err));
    }
  }, [newQuestion, newAnswer, newCategory, newTags, createCard, fetchCards]);

  const handleDelete = useCallback(async () => {
    if (deleteId === null) return;
    await deleteCard(deleteId);
    setDeleteId(null);
    fetchCards();
  }, [deleteId, deleteCard, fetchCards]);

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">话题卡片</h2>
          <p className="text-sm text-zinc-500 mt-1">
            管理面试问答素材，分类整理你的回答
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 transition-colors"
        >
          新建卡片
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearch(e.target.value);
            setTimeout(() => fetchCards(), 0);
          }}
          placeholder="搜索卡片..."
          className="w-64 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
        />
        <select
          value={filterCategory || ''}
          onChange={(e) => {
            setFilter(e.target.value || null, filterTag);
            setTimeout(() => fetchCards(), 0);
          }}
          className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none"
        >
          <option value="">全部分类</option>
          {Object.entries(CARD_CATEGORY_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Card List */}
      {loading ? (
        <LoadingSpinner text="加载中..." />
      ) : cards.length === 0 ? (
        <EmptyState
          icon="🃏"
          title="还没有话题卡片"
          description="创建面试问答卡片，整理你的回答素材"
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
            >
              创建第一张卡片
            </button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {cards.map((card) => {
            const tags = JSON.parse(card.tags || '[]') as string[];
            return (
              <Link
                key={card.id}
                href={`/cards/${card.id}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                        {CARD_CATEGORY_LABELS[card.category] || card.category}
                      </span>
                      {tags.map((tag: string, i: number) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 bg-zinc-800/50 text-zinc-500 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {card.source === 'from_chat' && (
                        <span className="text-xs text-zinc-600">
                          来自对话
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-white mb-1 line-clamp-2">
                      {card.question || '(无问题)'}
                    </h3>
                    <p className="text-xs text-zinc-500 line-clamp-2">
                      {card.answer}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteId(card.id);
                    }}
                    className="text-sm text-zinc-600 hover:text-red-400 transition-colors shrink-0"
                  >
                    删除
                  </button>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setCreateOpen(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">新建卡片</h3>

            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">问题</label>
              <input
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="面试问题..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">回答</label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                placeholder="你的回答..."
                rows={6}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
              />
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="block text-sm text-zinc-400 mb-2">分类</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none"
                >
                  {Object.entries(CARD_CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-zinc-400 mb-2">
                  标签（逗号分隔）
                </label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Python, 量化, 风控"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 mb-4">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newAnswer.trim()}
                className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="删除卡片"
        message="确定要删除这张卡片吗？此操作不可撤销。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
