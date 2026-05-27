'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChatStore } from '@/store';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = Number(params.sessionId);

  const {
    currentSession,
    messages,
    mode,
    streaming,
    loadSession,
    sendMessage,
    correctMessage,
    saveAsCard,
    deleteSession,
    setMode,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [correctingId, setCorrectingId] = useState<number | null>(null);
  const [correctText, setCorrectText] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession(sessionId).then(() => setLoading(false)).catch(() => setLoading(false));
  }, [sessionId, loadSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || streaming) return;
    setError('');
    try {
      await sendMessage(input.trim());
      setInput('');
    } catch (err) {
      setError(String(err));
    }
  }, [input, streaming, sendMessage]);

  const handleCorrect = useCallback(
    async (messageId: number) => {
      if (!correctText.trim()) return;
      setError('');
      try {
        await correctMessage(messageId, correctText.trim());
        setCorrectingId(null);
        setCorrectText('');
      } catch (err) {
        setError(String(err));
      }
    },
    [correctText, correctMessage]
  );

  const handleSaveAsCard = useCallback(
    async (messageId: number) => {
      setSavingId(messageId);
      setError('');
      try {
        await saveAsCard(messageId);
        setSavingId(null);
      } catch (err) {
        setError(String(err));
        setSavingId(null);
      }
    },
    [saveAsCard]
  );

  const handleDeleteSession = useCallback(async () => {
    await deleteSession(sessionId);
    setDeleteOpen(false);
    router.push('/chat');
  }, [sessionId, deleteSession, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)]">
        <LoadingSpinner text="加载对话..." />
      </div>
    );
  }

  const isInterviewer = mode === 'interviewer_role';

  return (
    <div className="flex flex-col h-[calc(100vh-0px)]">
      {/* Header with mode toggle */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <button
          onClick={() => router.push('/chat')}
          className="text-zinc-500 hover:text-zinc-300 text-sm"
        >
          ← 返回
        </button>

        {/* Mode Toggle */}
        <div className="flex items-center bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setMode('interviewer_role')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              isInterviewer
                ? 'bg-white text-black font-medium'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            🎤 面试官身份
          </button>
          <button
            onClick={() => setMode('self_role')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              !isInterviewer
                ? 'bg-white text-black font-medium'
                : 'text-zinc-400 hover:text-zinc-300'
            }`}
          >
            🔧 本人身份
          </button>
        </div>

        <button
          onClick={() => setDeleteOpen(true)}
          className="text-sm text-zinc-600 hover:text-red-400 transition-colors"
        >
          删除
        </button>
      </div>

      {/* Mode hint banner */}
      <div className="px-6 py-2 bg-zinc-900/50 border-b border-zinc-800/50">
        <p className="text-xs text-zinc-500">
          {isInterviewer
            ? '面试官身份：你扮演面试官提问，Agent 扮演你回答。随时可切换到本人身份纠正。'
            : '本人身份：你以本人身份纠正/补充 Agent 的回答。随时可切回面试官身份追问。'}
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-4xl mb-4">
                {isInterviewer ? '🎤' : '🔧'}
              </p>
              <p className="text-sm text-zinc-500 mb-2">
                {isInterviewer
                  ? '以面试官的身份向你的数字分身提问'
                  : '告诉你的数字分身关于你的更多信息'}
              </p>
              <p className="text-xs text-zinc-600">
                输入你的第一条消息开始对话
              </p>
            </div>
          </div>
        )}

        {messages
          .filter((m) => m.role !== 'system')
          .map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-white text-black'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-zinc-500">
                    {msg.role === 'user' ? '你' : '数字分身'}
                  </span>
                  {msg.is_corrected === 1 && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                      已校正
                    </span>
                  )}
                  {msg.saved_as_card_id && (
                    <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                      已保存为卡片
                    </span>
                  )}
                </div>

                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.is_corrected && msg.corrected_content
                    ? msg.corrected_content
                    : msg.content}
                </p>

                {msg.is_corrected && msg.corrected_content && (
                  <details className="mt-2">
                    <summary className="text-xs text-zinc-500 cursor-pointer">
                      查看原始回答
                    </summary>
                    <p className="text-xs text-zinc-500 mt-1 line-through">
                      {msg.content}
                    </p>
                  </details>
                )}

                {/* Actions always visible on assistant messages */}
                {msg.role === 'assistant' && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-zinc-800">
                    <button
                      onClick={() => {
                        setCorrectingId(msg.id);
                        setCorrectText(
                          msg.corrected_content || msg.content
                        );
                      }}
                      className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
                    >
                      纠正
                    </button>
                    <button
                      onClick={() => handleSaveAsCard(msg.id)}
                      disabled={savingId === msg.id || !!msg.saved_as_card_id}
                      className="text-xs text-zinc-500 hover:text-green-400 transition-colors disabled:opacity-50"
                    >
                      {msg.saved_as_card_id
                        ? '已保存'
                        : savingId === msg.id
                        ? '保存中...'
                        : '保存为卡片'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

        {streaming && (
          <div className="flex justify-start">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <span className="text-sm text-zinc-500">输入中...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-6 py-2">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              isInterviewer
                ? '以面试官身份提问...'
                : '纠正或补充信息...'
            }
            className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="px-5 py-2.5 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>

      {/* Correction Modal */}
      {correctingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setCorrectingId(null)}
          />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">纠正回答</h3>
            <textarea
              value={correctText}
              onChange={(e) => setCorrectText(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600 resize-none"
              placeholder="输入更新后的回答..."
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setCorrectingId(null)}
                className="px-4 py-2 text-sm text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={() => handleCorrect(correctingId)}
                disabled={!correctText.trim()}
                className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
              >
                保存纠正
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="删除对话"
        message="确定要删除这个对话及其所有消息吗？"
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
