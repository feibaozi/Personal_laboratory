"use client";

import { useState, useEffect } from "react";

interface SettingsProps {
  onClose: () => void;
}

const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    models: ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    keyPrefix: "sk-",
  },
  {
    id: "openai",
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
    defaultModel: "gpt-4o-mini",
    keyPrefix: "sk-",
  },
  {
    id: "zhipu",
    name: "智谱 AI (GLM)",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    models: ["glm-4-flash", "glm-4-air", "glm-4-plus"],
    defaultModel: "glm-4-flash",
    keyPrefix: "",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    models: ["moonshot-v1-8k", "moonshot-v1-32k"],
    defaultModel: "moonshot-v1-8k",
    keyPrefix: "sk-",
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    models: ["qwen-turbo", "qwen-plus", "qwen-max"],
    defaultModel: "qwen-turbo",
    keyPrefix: "sk-",
  },
  {
    id: "doubao",
    name: "豆包 (Doubao)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    models: ["doubao-1.5-pro-32k", "doubao-1.5-lite-32k"],
    defaultModel: "doubao-1.5-pro-32k",
    keyPrefix: "",
  },
  {
    id: "ollama",
    name: "Ollama (本地)",
    endpoint: "http://localhost:11434/v1/chat/completions",
    models: ["qwen2.5:7b", "llama3.1:8b", "deepseek-r1:7b"],
    defaultModel: "qwen2.5:7b",
    keyPrefix: "ollama",
  },
  {
    id: "custom",
    name: "自定义",
    endpoint: "",
    models: [],
    defaultModel: "",
    keyPrefix: "",
  },
];

export default function Settings({ onClose }: SettingsProps) {
  const [providerId, setProviderId] = useState("deepseek");
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  useEffect(() => {
    if (!api) return;
    (async () => {
      const savedProviderId = await api.appGetConfig("api_provider");
      const ep = await api.appGetConfig("api_endpoint");
      const key = await api.appGetConfig("api_key");
      const m = await api.appGetConfig("api_model");

      if (savedProviderId) setProviderId(savedProviderId);
      if (ep) setEndpoint(ep);
      else {
        const p = PROVIDERS.find((p) => p.id === (savedProviderId || "deepseek"));
        setEndpoint(p?.endpoint || "");
      }
      if (key) setApiKey(key);
      if (m) setModel(m);
      else {
        const p = PROVIDERS.find((p) => p.id === (savedProviderId || "deepseek"));
        setModel(p?.defaultModel || "");
      }
    })();
  }, [api]);

  const currentProvider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[PROVIDERS.length - 1];

  const handleProviderChange = (newId: string) => {
    setProviderId(newId);
    const p = PROVIDERS.find((pr) => pr.id === newId);
    if (p && p.id !== "custom") {
      setEndpoint(p.endpoint);
      if (!model || !p.models.includes(model)) {
        setModel(p.defaultModel);
      }
    }
  };

  const handleSave = async () => {
    if (!api) return;
    setSaving(true);
    try {
      await api.appSetConfig("api_provider", providerId);
      await api.appSetConfig("api_endpoint", endpoint);
      await api.appSetConfig("api_key", apiKey);
      await api.appSetConfig("api_model", model);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] max-h-[85vh] bg-bg-secondary border border-[var(--border-color)] rounded-xl shadow-2xl animate-slide-up flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">⚙️ AI 模型设置</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >✕</button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              AI 服务商
            </label>
            <select
              value={providerId}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-accent-blue/50 appearance-none cursor-pointer"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              API Endpoint
            </label>
            <input
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.deepseek.com/v1/chat/completions"
              readOnly={providerId !== "custom"}
              className={`w-full h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 ${
                providerId !== "custom" ? "opacity-60 cursor-not-allowed" : ""
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={currentProvider.keyPrefix ? `${currentProvider.keyPrefix}...` : "输入你的 API Key"}
              className="w-full h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50"
            />
            {providerId === "ollama" && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1">Ollama 本地模型无需 API Key，留空即可</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              模型
            </label>
            {currentProvider.models.length > 0 ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-accent-blue/50 appearance-none cursor-pointer"
              >
                {currentProvider.models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="模型名称"
                className="w-full h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50"
              />
            )}
          </div>

          <div className="text-xs text-[var(--text-muted)] bg-bg-tertiary p-3 rounded-lg space-y-1.5">
            <p className="font-medium text-[var(--text-secondary)]">💡 各厂商获取 API Key：</p>
            <div className="space-y-0.5">
              <p>• DeepSeek: <span className="text-accent-blue">platform.deepseek.com</span></p>
              <p>• 智谱 AI: <span className="text-accent-blue">open.bigmodel.cn</span></p>
              <p>• Moonshot: <span className="text-accent-blue">platform.moonshot.cn</span></p>
              <p>• 通义千问: <span className="text-accent-blue">dashscope.console.aliyun.com</span></p>
              <p>• 豆包: <span className="text-accent-blue">console.volcengine.com/ark</span></p>
              <p>• Ollama: 本地安装后自动运行，无需 Key</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--border-color)] shrink-0">
          {saved && <span className="text-xs text-accent-green">✓ 已保存</span>}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors"
          >取消</button>
          <button
            onClick={handleSave}
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
