"use client";

import { useState, useEffect } from "react";
import { NODE_TYPE_CONFIG, FrameworkNode, NodeType } from "@/lib/types";

interface NodeDetailProps {
  nodeId: number;
  onClose: () => void;
  onUpdate: () => void;
}

export default function NodeDetail({ nodeId, onClose, onUpdate }: NodeDetailProps) {
  const [node, setNode] = useState<FrameworkNode | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const api = typeof window !== "undefined" ? window.electronAPI : null;

  useEffect(() => {
    if (!api) return;
    api.dbGetNode(nodeId).then((data) => {
      if (data) {
        setNode(data);
        setEditTitle(data.title);
        setEditContent(data.content);
      }
    });
  }, [nodeId, api]);

  if (!node) return null;

  const config = NODE_TYPE_CONFIG[node.nodeType as NodeType] || NODE_TYPE_CONFIG.step;

  const handleSave = async () => {
    if (!api) return;
    await api.dbUpdateNode(nodeId, {
      title: editTitle,
      content: editContent,
    });
    setEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!api || !confirm("确定删除此节点及其所有子节点？")) return;
    await api.dbDeleteNode(nodeId);
    onClose();
    onUpdate();
  };

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-bg-secondary border-l border-[var(--border-color)] flex flex-col animate-slide-up z-10">
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <span className="text-sm">{config.icon}</span>
          <span className="text-xs text-[var(--text-muted)] uppercase">{config.label}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditing(!editing)}
            className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded transition-colors"
          >
            {editing ? "取消" : "编辑"}
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {editing ? (
          <>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-accent-blue/50"
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-accent-blue/50 resize-none"
            />
            <button
              onClick={handleSave}
              className="w-full py-2 bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium rounded-lg transition-colors"
            >
              保存
            </button>
          </>
        ) : (
          <>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {node.title}
            </h3>
            {node.summary && (
              <p className="text-sm text-accent-blue/80 italic">
                {node.summary}
              </p>
            )}
            {node.content && (
              <div className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                {node.content}
              </div>
            )}
          </>
        )}

        {node.tags && node.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map((tag) => (
              <span
                key={tag.id}
                className="px-2 py-0.5 text-xs bg-accent-blue/10 text-accent-blue rounded-full"
              >
                #{tag.name}
              </span>
            ))}
          </div>
        )}

        {node.sourceRef && (
          <div className="text-xs text-[var(--text-muted)]">
            来源: {node.sourceRef}
          </div>
        )}

        <div className="text-xs text-[var(--text-muted)]">
          创建: {node.createdAt}
        </div>
      </div>

      <div className="p-3 border-t border-[var(--border-color)]">
        <button
          onClick={handleDelete}
          className="w-full py-1.5 text-xs text-accent-red hover:bg-accent-red/10 rounded-lg transition-colors"
        >
          删除节点
        </button>
      </div>
    </div>
  );
}
