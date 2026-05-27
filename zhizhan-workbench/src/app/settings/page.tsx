"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store";
import { fetchApi, checkPythonHealth } from "@/lib/api";

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const pythonOnline = useAppStore((s) => s.pythonOnline);
  const setPythonOnline = useAppStore((s) => s.setPythonOnline);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    error?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const providerConfig: Record<string, { model: string; baseUrl: string }> = {
    deepseek: {
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
    },
    zhipu: {
      model: "glm-4-flash",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    },
    openai: {
      model: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
    },
  };

  const handleProviderChange = (provider: string) => {
    const config = providerConfig[provider];
    if (config) {
      updateSettings({
        llmProvider: provider as "deepseek" | "zhipu" | "openai",
        llmModel: config.model,
      });
    }
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await saveToBackend();
      const result = await fetchApi<{ ok: boolean; error?: string }>(
        "/api/settings/test-llm",
        { method: "POST" }
      );
      setTestResult(result);
    } catch (err) {
      setTestResult({ ok: false, error: "请求失败" });
    } finally {
      setTesting(false);
    }
  };

  const saveToBackend = async () => {
    try {
      await fetchApi("/api/settings/", {
        method: "PUT",
        body: JSON.stringify({
          llm_provider: settings.llmProvider,
          llm_api_key: settings.llmApiKey,
          llm_model: settings.llmModel,
          llm_base_url: providerConfig[settings.llmProvider]?.baseUrl,
          data_refresh_interval: settings.dataRefreshInterval,
        }),
      });
    } catch {
      // ignore
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveToBackend();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleCheckBackend = async () => {
    const online = await checkPythonHealth();
    setPythonOnline(online);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-text-primary">设置</h2>

      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">后端状态</h3>
          <button
            onClick={handleCheckBackend}
            className="text-xs text-brand hover:underline"
          >
            重新检测
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              pythonOnline ? "bg-sentiment-positive" : "bg-sentiment-negative"
            }`}
          />
          <span
            className={
              pythonOnline ? "text-sentiment-positive" : "text-sentiment-negative"
            }
          >
            {pythonOnline ? "Python 后端已连接" : "Python 后端未连接"}
          </span>
        </div>
      </div>

      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3 space-y-5">
        <h3 className="text-sm font-medium text-text-primary">LLM 配置</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">
              LLM 提供商
            </label>
            <select
              value={settings.llmProvider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
            >
              <option value="deepseek">DeepSeek</option>
              <option value="zhipu">智谱 (GLM)</option>
              <option value="openai">OpenAI 兼容</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              API Key
            </label>
            <input
              type="password"
              value={settings.llmApiKey}
              onChange={(e) => updateSettings({ llmApiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">
              模型名称
            </label>
            <input
              type="text"
              value={settings.llmModel}
              onChange={(e) => updateSettings({ llmModel: e.target.value })}
              className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={testConnection}
              disabled={testing || !settings.llmApiKey}
              className="bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-text-secondary px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {testing ? "测试中..." : "测试连接"}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              {saving ? "保存中..." : saved ? "已保存 ✓" : "保存设置"}
            </button>
          </div>

          {testResult && (
            <div
              className={`text-sm px-3 py-2 rounded-lg ${
                testResult.ok
                  ? "bg-sentiment-positive/15 text-sentiment-positive"
                  : "bg-sentiment-negative/15 text-sentiment-negative"
              }`}
            >
              {testResult.ok
                ? "连接成功！LLM 服务可用"
                : `连接失败：${testResult.error || "未知错误"}`}
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3 space-y-5">
        <h3 className="text-sm font-medium text-text-primary">数据配置</h3>

        <div>
          <label className="block text-xs text-text-muted mb-1">
            数据刷新间隔（分钟）
          </label>
          <input
            type="number"
            value={settings.dataRefreshInterval}
            onChange={(e) =>
              updateSettings({
                dataRefreshInterval: parseInt(e.target.value) || 30,
              })
            }
            min={5}
            max={120}
            className="w-full bg-surface-2 border border-surface-3 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand"
          />
          <p className="text-xs text-text-muted mt-1">
            控制舆情新闻自动采集的频率，建议 15-60 分钟
          </p>
        </div>
      </div>

      <div className="bg-surface-1 rounded-xl p-5 border border-surface-3 space-y-3">
        <h3 className="text-sm font-medium text-text-primary">关于</h3>
        <div className="text-xs text-text-muted space-y-1">
          <p>智研工作台 v0.1.0</p>
          <p>AI 驱动的智能投研+舆情一体化终端</p>
          <p>技术栈：Electron + Next.js + FastAPI + LangChain</p>
        </div>
      </div>
    </div>
  );
}
