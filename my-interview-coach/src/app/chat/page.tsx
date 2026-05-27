'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ChatStartPage() {
  const router = useRouter();
  const { sessions, fetchSessions, createSession } = useChatStore();
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchSessions().then(() => setLoaded(true));
  }, [fetchSessions]);

  const handleCreate = async (mode: 'interviewer_role' | 'self_role') => {
    setCreating(true);
    try {
      const session = await createSession(mode);
      router.push(`/chat/${session.id}`);
    } catch (err) {
      console.error(err);
    }
    setCreating(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">模拟面试</h2>
      <p className="text-sm text-zinc-500 mb-8">
        Agent 将扮演你的数字分身，选择一种模式开始对话
      </p>

      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        <button
          onClick={() => handleCreate('interviewer_role')}
          disabled={creating}
          className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all text-left group"
        >
          <div className="text-3xl mb-3">🎤</div>
          <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-zinc-300">
            面试官身份
          </h3>
          <p className="text-sm text-zinc-500">
            你扮演面试官提问，Agent 扮演你回答。检验数字分身的临场表现
          </p>
        </button>

        <button
          onClick={() => handleCreate('self_role')}
          disabled={creating}
          className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 transition-all text-left group"
        >
          <div className="text-3xl mb-3">🔧</div>
          <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-zinc-300">
            本人身份
          </h3>
          <p className="text-sm text-zinc-500">
            校准数字分身，纠正回答、补充信息、调整风格
          </p>
        </button>
      </div>

      {creating && <LoadingSpinner text="创建会话中..." />}

      {/* Past Sessions */}
      <div>
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
          历史对话
        </h3>
        {!loaded ? (
          <LoadingSpinner />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-600 py-8 text-center">
            还没有对话记录
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/chat/${s.id}`)}
                className="w-full text-left px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">{s.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {s.mode === 'interviewer_role' ? '面试官身份' : '本人身份'}
                      {' · '}
                      {s.updated_at}
                    </p>
                  </div>
                  <span className="text-zinc-600">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
