"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { NODE_TYPE_CONFIG, NodeType } from "@/lib/types";

interface MindMapNodeData {
  label: string;
  nodeType: NodeType;
  sourceType: string;
  summary: string | null;
  dbId: number;
  isHighlighted: boolean;
  onClick: (id: number) => void;
  level: number;
}

function MindMapNodeComponent({ data }: NodeProps) {
  const nodeData = data as unknown as MindMapNodeData;
  const config = NODE_TYPE_CONFIG[nodeData.nodeType] || NODE_TYPE_CONFIG.step;
  const isRoot = nodeData.level === 0;

  const borderClass = nodeData.isHighlighted
    ? "ring-2 ring-accent-blue ring-offset-2 ring-offset-bg-primary"
    : "";

  return (
    <div
      className={`rounded-xl ${borderClass} cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
        isRoot ? "px-5 py-3" : "px-3.5 py-2"
      } ${nodeData.nodeType === "user_note" ? "border-dashed" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${config.color}20, ${config.color}08)`,
        borderColor: config.color,
        borderWidth: isRoot ? 2 : 1.5,
        borderStyle: nodeData.nodeType === "user_note" ? "dashed" : "solid",
        minWidth: isRoot ? 140 : 100,
        maxWidth: isRoot ? 200 : 160,
      }}
      onClick={() => nodeData.onClick(nodeData.dbId)}
    >
      <Handle type="target" position={Position.Left} className="!bg-[var(--border-color)] !w-1.5 !h-1.5 !border-0" />

      <div className="flex items-center gap-1.5">
        <span className={`${isRoot ? "text-base" : "text-xs"} shrink-0`}>{config.icon}</span>
        <span className={`${isRoot ? "text-sm font-semibold" : "text-xs font-medium"} text-[var(--text-primary)] truncate`}>
          {nodeData.label}
        </span>
      </div>

      {nodeData.summary && (
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 line-clamp-2">
          {nodeData.summary}
        </p>
      )}

      {nodeData.sourceType === "user" && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-orange rounded-full border border-bg-primary" />
      )}

      <Handle type="source" position={Position.Right} className="!bg-[var(--border-color)] !w-1.5 !h-1.5 !border-0" />
    </div>
  );
}

export default memo(MindMapNodeComponent);
