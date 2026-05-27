'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCardsStore } from '@/store';
import { CARD_CATEGORY_LABELS } from '@/lib/types';
import type { Card } from '@/lib/types';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = Number(params.cardId);

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('other');
  const [tagsStr, setTagsStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const { updateCard } = useCardsStore();

  useEffect(() => {
    fetch(`/api/cards/${cardId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.card) {
          setCard(data.card);
          setQuestion(data.card.question);
          setAnswer(data.card.answer);
          setCategory(data.card.category);
          const tags = JSON.parse(data.card.tags || '[]') as string[];
          setTagsStr(tags.join(', '));
        }
        setLoading(false);
      });
  }, [cardId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateCard(cardId, {
        question,
        answer,
        category,
        tags: tagsStr
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setEditing(false);
      setMessage('保存成功');
      // Refresh card data
      setCard((prev) =>
        prev
          ? {
              ...prev,
              question,
              answer,
              category: category as Card['category'],
              tags: JSON.stringify(
                tagsStr
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
              ),
              updated_at: new Date().toISOString(),
            }
          : prev
      );
    } catch (err) {
      setMessage('保存失败: ' + String(err));
    }
    setSaving(false);
  }, [cardId, question, answer, category, tagsStr, updateCard]);

  const handleStartEdit = () => {
    if (card) {
      setQuestion(card.question);
      setAnswer(card.answer);
      setCategory(card.category);
      const tags = JSON.parse(card.tags || '[]') as string[];
      setTagsStr(tags.join(', '));
    }
    setEditing(true);
  };

  if (loading) return <LoadingSpinner text="加载中..." />;
  if (!card) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-8">
        <p className="text-zinc-500">卡片不存在</p>
      </div>
    );
  }

  const displayTags = JSON.parse(card.tags || '[]') as string[];

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <button
        onClick={() => router.back()}
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-6"
      >
        ← 返回
      </button>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.includes('失败')
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-green-500/10 text-green-400 border border-green-500/20'
          }`}
        >
          {message}
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">问题</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">回答</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-2">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none"
              >
                {Object.entries(CARD_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-zinc-400 mb-2">标签</label>
              <input
                type="text"
                value={tagsStr}
                onChange={(e) => setTagsStr(e.target.value)}
                placeholder="逗号分隔"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !answer.trim()}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
              {CARD_CATEGORY_LABELS[card.category] || card.category}
            </span>
            {displayTags.map((tag: string, i: number) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-zinc-800/50 text-zinc-500 rounded"
              >
                {tag}
              </span>
            ))}
          </div>

          <h2 className="text-xl font-bold text-white mb-6">
            {card.question || '(无问题)'}
          </h2>

          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {card.answer}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>创建: {card.created_at}</span>
            <span>更新: {card.updated_at}</span>
          </div>

          <button
            onClick={handleStartEdit}
            className="mt-6 px-4 py-2 text-sm bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
          >
            编辑
          </button>
        </div>
      )}
    </div>
  );
}
