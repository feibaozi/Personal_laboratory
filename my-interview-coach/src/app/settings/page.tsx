'use client';

import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store';

export default function SettingsPage() {
  const { settings, loading, fetchSettings, updateSetting } = useSettingsStore();
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (key: string, value: string) => {
    setSaving((s) => ({ ...s, [key]: true }));
    setMessage('');
    try {
      await updateSetting(key, value);
      setMessage('保存成功');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('保存失败: ' + String(err));
    }
    setSaving((s) => ({ ...s, [key]: false }));
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-8 py-8">
        <p className="text-sm text-zinc-500">加载中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">设置</h2>
      <p className="text-sm text-zinc-500 mb-8">配置 DeepSeek API 和个人信息</p>

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm ${
            message.includes('失败')
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-green-500/10 text-green-400 border border-green-500/20'
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* API Key */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-white mb-2">
            DeepSeek API Key
          </label>
          <div className="flex gap-3">
            <input
              type="password"
              value={settings.llm_api_key || ''}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, llm_api_key: e.target.value },
                })
              }
              placeholder="sk-..."
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 font-mono"
            />
            <button
              onClick={() => handleSave('llm_api_key', settings.llm_api_key || '')}
              disabled={saving.llm_api_key}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving.llm_api_key ? '保存中...' : '保存'}
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-2">
            支持 DeepSeek 或任何 OpenAI 兼容的 API
          </p>
        </div>

        {/* Base URL */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-white mb-2">
            API Base URL
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.llm_base_url || 'https://api.deepseek.com'}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, llm_base_url: e.target.value },
                })
              }
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600 font-mono"
            />
            <button
              onClick={() => handleSave('llm_base_url', settings.llm_base_url || '')}
              disabled={saving.llm_base_url}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving.llm_base_url ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-white mb-2">
            LLM Model
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.llm_model || 'deepseek-chat'}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, llm_model: e.target.value },
                })
              }
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() => handleSave('llm_model', settings.llm_model || '')}
              disabled={saving.llm_model}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving.llm_model ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* Embedding Model */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-white mb-2">
            Embedding Model
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.embedding_model || 'deepseek-chat'}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, embedding_model: e.target.value },
                })
              }
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() =>
                handleSave('embedding_model', settings.embedding_model || '')
              }
              disabled={saving.embedding_model}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving.embedding_model ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* User Name */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <label className="block text-sm font-medium text-white mb-2">
            你的名字（用于数字分身）
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              value={settings.user_name || ''}
              onChange={(e) =>
                useSettingsStore.setState({
                  settings: { ...settings, user_name: e.target.value },
                })
              }
              placeholder="输入你的名字"
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() =>
                handleSave('user_name', settings.user_name || '')
              }
              disabled={saving.user_name}
              className="px-4 py-2 text-sm bg-white text-black rounded-lg font-medium hover:bg-zinc-200 disabled:opacity-50"
            >
              {saving.user_name ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
