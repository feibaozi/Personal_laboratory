"use client";

import { useState } from "react";
import { NODE_TYPE_CONFIG, NodeType } from "@/lib/types";

interface FrameworkWizardProps {
  onClose: () => void;
  onConfirm: (frameworkName: string, frameworkData: any) => void;
}

interface ChatMessage {
  role: "ai" | "user";
  content: string;
}

export default function FrameworkWizard({ onClose, onConfirm }: FrameworkWizardProps) {
  const [step, setStep] = useState<"describe" | "chat" | "preview">("describe");
  const [domainDesc, setDomainDesc] = useState("");
  const [frameworkName, setFrameworkName] = useState("");
  const [frameworkIcon, setFrameworkIcon] = useState("🌱");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentFramework, setCurrentFramework] = useState<any>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [userInput, setUserInput] = useState("");

  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const handleGenerate = async () => {
    if (!api || !domainDesc.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.aiGenerateDomainFramework(domainDesc.trim());
      setCurrentFramework(result.framework);
      setQuestions(result.questions || []);
      setChatMessages([
        { role: "ai", content: result.aiMessage || "框架已生成！请查看并提出修改意见。" },
      ]);
      if (!frameworkName) {
        setFrameworkName(result.framework.title || domainDesc.trim());
      }
      setStep("chat");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async () => {
    if (!api || !userInput.trim() || !currentFramework) return;
    setLoading(true);
    setError(null);
    const userMsg = userInput.trim();
    setUserInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);

    try {
      const result = await api.aiRefineFramework(currentFramework, userMsg);
      setCurrentFramework(result.framework);
      setQuestions(result.questions || []);
      setChatMessages((prev) => [...prev, { role: "ai", content: result.aiMessage || "框架已更新" }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!currentFramework) return;
    onConfirm(frameworkName || currentFramework.title, currentFramework);
  };

  const renderPreviewNode = (node: any, depth: number = 0) => {
    const config = NODE_TYPE_CONFIG[node.node_type as NodeType] || NODE_TYPE_CONFIG.step;
    return (
      <div key={node.title + depth} className="ml-2">
        <div className="flex items-center gap-1.5 py-0.5">
          <span className="text-xs" style={{ marginLeft: depth * 16 }}>{config.icon}</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{node.title}</span>
          <span className="text-[10px] text-[var(--text-muted)]">{config.label}</span>
        </div>
        {node.summary && (
          <p className="text-[10px] text-[var(--text-muted)] ml-6" style={{ marginLeft: depth * 16 + 24 }}>
            {node.summary}
          </p>
        )}
        {node.children?.map((child: any) => renderPreviewNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[640px] max-h-[85vh] bg-bg-secondary border border-[var(--border-color)] rounded-xl shadow-2xl animate-slide-up flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">🌱 创建新框架</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >✕</button>
        </div>

        {step === "describe" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">框架名称</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={frameworkIcon}
                  onChange={(e) => setFrameworkIcon(e.target.value)}
                  className="w-10 h-9 text-center text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg focus:outline-none"
                />
                <input
                  type="text"
                  value={frameworkName}
                  onChange={(e) => setFrameworkName(e.target.value)}
                  placeholder="如：Rust 学习路径"
                  className="flex-1 h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">描述你想建立的领域</label>
              <textarea
                value={domainDesc}
                onChange={(e) => setDomainDesc(e.target.value)}
                rows={5}
                placeholder="描述你想建立知识框架的领域，比如：&#10;&#10;我想学习 Rust 编程语言，从零基础到能写实际项目&#10;&#10;或者：我想建立健身增肌的训练体系，包含饮食、训练和恢复"
                className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50 resize-none"
              />
            </div>

            {error && (
              <div className="text-xs text-accent-red bg-accent-red/5 p-2 rounded">⚠️ {error}</div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors">取消</button>
              <button
                onClick={handleGenerate}
                disabled={!domainDesc.trim() || loading}
                className="px-4 py-2 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? "AI 生成中..." : "🪄 AI 生成框架"}
              </button>
            </div>
          </div>
        )}

        {step === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: "400px" }}>
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                    msg.role === "user"
                      ? "bg-accent-blue/10 text-accent-blue"
                      : "bg-bg-tertiary text-[var(--text-secondary)]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {currentFramework && (
                <div className="bg-bg-tertiary border border-[var(--border-color)] rounded-lg p-3">
                  <div className="text-xs font-medium text-[var(--text-primary)] mb-2">📋 当前框架预览</div>
                  {renderPreviewNode(currentFramework)}
                </div>
              )}

              {questions.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-[var(--text-muted)]">💡 你可以回答这些问题帮助优化：</div>
                  {questions.map((q, i) => (
                    <div key={i} className="text-xs text-accent-purple bg-accent-purple/5 px-2 py-1 rounded">• {q}</div>
                  ))}
                </div>
              )}

              {error && (
                <div className="text-xs text-accent-red bg-accent-red/5 p-2 rounded">⚠️ {error}</div>
              )}
            </div>

            <div className="p-3 border-t border-[var(--border-color)] space-y-2 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRefine(); } }}
                  placeholder="输入修改意见或回答问题..."
                  className="flex-1 h-9 px-3 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-blue/50"
                />
                <button
                  onClick={handleRefine}
                  disabled={!userInput.trim() || loading}
                  className="h-9 px-3 bg-accent-blue hover:bg-accent-blue/80 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
                >发送</button>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setStep("preview")} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors">
                  预览确认 →
                </button>
              </div>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: "400px" }}>
              <div className="text-center">
                <span className="text-2xl">{frameworkIcon}</span>
                <h3 className="text-base font-semibold text-[var(--text-primary)] mt-1">{frameworkName}</h3>
              </div>
              {currentFramework && (
                <div className="bg-bg-tertiary border border-[var(--border-color)] rounded-lg p-3">
                  {renderPreviewNode(currentFramework)}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-[var(--border-color)] flex justify-between shrink-0">
              <button onClick={() => setStep("chat")} className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors">
                ← 继续修改
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 bg-accent-green hover:bg-accent-green/80 text-white text-sm font-medium rounded-lg transition-colors"
              >
                ✅ 确认创建
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
