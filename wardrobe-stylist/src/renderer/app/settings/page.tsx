import { useState, useEffect } from 'react';
import { Download, Upload, Sparkles, Eye, Brain } from 'lucide-react';

export function SettingsPage() {
  const [tab, setTab] = useState<'data' | 'ai'>('ai');
  const [exportStatus, setExportStatus] = useState('');
  const [importStatus, setImportStatus] = useState('');

  // AI config
  const [aiEnabled, setAiEnabled] = useState(false);
  const [qwenKey, setQwenKey] = useState('');
  const [qwenModel, setQwenModel] = useState('qwen-vl-plus');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [deepseekModel, setDeepseekModel] = useState('deepseek-chat');
  const [aiSaved, setAiSaved] = useState(false);

  useEffect(() => {
    // Load AI status on mount
    window.electronAPI.getAIStatus().then((s: any) => {
      if (s?.enabled) setAiEnabled(true);
    }).catch(() => {});
  }, []);

  const handleSaveAI = async () => {
    await window.electronAPI.configureAI({
      enabled: aiEnabled,
      qwenApiKey: qwenKey,
      qwenModel,
      deepseekApiKey: deepseekKey,
      deepseekModel,
    });
    setAiSaved(true);
    setTimeout(() => setAiSaved(false), 3000);
  };

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.exportData();
      if (result.success) setExportStatus(`已导出到: ${result.filePath}`);
      else setExportStatus('导出已取消');
    } catch { setExportStatus('导出失败'); }
  };

  const handleImport = async () => {
    try {
      const result = await window.electronAPI.importData();
      if (result.success) setImportStatus('导入成功，请重启应用');
      else if (result.error) setImportStatus(`导入失败: ${result.error}`);
      else setImportStatus('导入已取消');
    } catch { setImportStatus('导入失败'); }
  };

  return (
    <div className="p-8 animate-fade-in max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab('ai')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === 'ai' ? 'bg-white shadow-sm font-medium' : 'text-[var(--text-secondary)]'
          }`}
        ><Sparkles size={14} className="inline mr-1" />AI 配置</button>
        <button
          onClick={() => setTab('data')}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === 'data' ? 'bg-white shadow-sm font-medium' : 'text-[var(--text-secondary)]'
          }`}
        ><Download size={14} className="inline mr-1" />数据管理</button>
      </div>

      {tab === 'ai' && (
        <div className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[var(--border-light)]">
            <div>
              <p className="font-medium text-sm">启用 AI 功能</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">开启后可使用 AI 识别和智能推荐</p>
            </div>
            <button
              onClick={() => setAiEnabled(!aiEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                aiEnabled ? 'bg-[var(--accent)]' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                aiEnabled ? 'left-5' : 'left-0.5'
              }`} />
            </button>
          </div>

          {/* Qwen VL */}
          <div className="p-4 bg-white rounded-xl border border-[var(--border-light)]">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={16} className="text-purple-500" />
              <h3 className="font-semibold text-sm">千问 VL（视觉识别）</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500">图片理解</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">API Key</label>
                <input
                  type="password" value={qwenKey} onChange={(e) => setQwenKey(e.target.value)}
                  placeholder="sk-... (百炼平台 DashScope)"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">模型</label>
                <select value={qwenModel} onChange={(e) => setQwenModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg">
                  <option value="qwen-vl-plus">qwen-vl-plus（推荐，性价比）</option>
                  <option value="qwen-vl-max">qwen-vl-max（最强）</option>
                </select>
              </div>
            </div>
          </div>

          {/* DeepSeek */}
          <div className="p-4 bg-white rounded-xl border border-[var(--border-light)]">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-blue-500" />
              <h3 className="font-semibold text-sm">DeepSeek（文本推理）</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-500">搭配推荐</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">API Key</label>
                <input
                  type="password" value={deepseekKey} onChange={(e) => setDeepseekKey(e.target.value)}
                  placeholder="sk-... (platform.deepseek.com)"
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">模型</label>
                <select value={deepseekModel} onChange={(e) => setDeepseekModel(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-light)] rounded-lg">
                  <option value="deepseek-chat">deepseek-chat（V3，推荐）</option>
                  <option value="deepseek-reasoner">deepseek-reasoner（R1，深度推理）</option>
                </select>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAI}
            className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
              aiSaved ? 'bg-green-500 text-white' : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-light)]'
            }`}
          >
            {aiSaved ? '✓ 已保存' : '保存 AI 配置'}
          </button>

          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            API Key 仅在本地主进程使用，不会上传到任何第三方服务器（除对应的 AI 服务商）
          </p>
        </div>
      )}

      {tab === 'data' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[var(--border-light)]">
            <div>
              <p className="font-medium text-sm">导出数据</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">所有衣物、搭配、记录导出为 JSON</p>
            </div>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              <Download size={16} /> 导出
            </button>
          </div>
          {exportStatus && <p className="text-xs text-green-600">{exportStatus}</p>}

          <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-[var(--border-light)]">
            <div>
              <p className="font-medium text-sm">导入数据</p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">从 JSON 备份恢复</p>
            </div>
            <button onClick={handleImport} className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">
              <Upload size={16} /> 导入
            </button>
          </div>
          {importStatus && <p className="text-xs text-blue-600">{importStatus}</p>}

          <div className="p-4 bg-white rounded-xl border border-[var(--border-light)] text-sm">
            <p><span className="font-medium">版本:</span> 0.1.0 (MVP)</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">Electron + React + sql.js + Qwen VL + DeepSeek</p>
          </div>
        </div>
      )}
    </div>
  );
}
