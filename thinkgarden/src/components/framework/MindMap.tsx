"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FrameworkNode, NODE_TYPE_CONFIG, InspectionResult, InspectionSuggestion, ConversationSummary, ConversationInsight } from "@/lib/types";
import { useFramework } from "@/hooks/useFramework";
import MindMapNodeComponent from "./MindMapNode";
import NodeDetail from "../common/NodeDetail";
import QuickInput from "../input/QuickInput";
import InspectionPanel from "../ai/InspectionPanel";
import ConversationSummaryPanel from "../ai/ConversationSummaryPanel";
import PracticeReminderPanel from "../ai/PracticeReminder";

const nodeTypes = { mindMapNode: MindMapNodeComponent };

interface LayoutMetrics {
  nodeWidth: number;
  nodeHeight: number;
  horizontalGap: number;
  verticalGap: number;
}

function calculateSubtreeHeight(node: FrameworkNode, metrics: LayoutMetrics): number {
  if (!node.children || node.children.length === 0) {
    return metrics.nodeHeight;
  }
  const childrenHeight = node.children.reduce(
    (sum, child) => sum + calculateSubtreeHeight(child, metrics),
    0
  );
  const gapsHeight = (node.children.length - 1) * metrics.verticalGap;
  return Math.max(metrics.nodeHeight, childrenHeight + gapsHeight);
}

function layoutTree(
  node: FrameworkNode,
  x: number,
  yStart: number,
  yEnd: number,
  level: number,
  highlightedIds: Set<number>,
  onNodeClick: (id: number) => void,
  metrics: LayoutMetrics
): { nodes: Node[]; edges: Edge[] } {
  const config = NODE_TYPE_CONFIG[node.nodeType as keyof typeof NODE_TYPE_CONFIG] || NODE_TYPE_CONFIG.step;

  const yCenter = (yStart + yEnd) / 2;
  const y = yCenter - metrics.nodeHeight / 2;

  const flowNode: Node = {
    id: String(node.id),
    type: "mindMapNode",
    position: { x, y },
    data: {
      label: node.title,
      nodeType: node.nodeType,
      sourceType: node.sourceType,
      summary: node.summary,
      dbId: node.id,
      isHighlighted: highlightedIds.has(node.id),
      onClick: onNodeClick,
      level,
    },
  };

  const nodes = [flowNode];
  const edges: Edge[] = [];

  if (node.children && node.children.length > 0) {
    const childX = x + metrics.nodeWidth + metrics.horizontalGap;
    const subtreeHeights = node.children.map((child) =>
      calculateSubtreeHeight(child, metrics)
    );
    const totalHeight = subtreeHeights.reduce((a, b) => a + b, 0) + (node.children.length - 1) * metrics.verticalGap;

    let currentY = yCenter - totalHeight / 2;

    node.children.forEach((child, index) => {
      const childHeight = subtreeHeights[index];
      const childYStart = currentY;
      const childYEnd = currentY + childHeight;

      edges.push({
        id: `${node.id}-${child.id}`,
        source: String(node.id),
        target: String(child.id),
        type: "smoothstep",
        style: {
          stroke: config.color || "#3B82F6",
          strokeWidth: level === 0 ? 2 : 1.5,
          opacity: 0.5,
        },
        animated: child.sourceType === "user",
      });

      const childResult = layoutTree(
        child,
        childX,
        childYStart,
        childYEnd,
        level + 1,
        highlightedIds,
        onNodeClick,
        metrics
      );
      nodes.push(...childResult.nodes);
      edges.push(...childResult.edges);

      currentY = childYEnd + metrics.verticalGap;
    });
  }

  return { nodes, edges };
}

export default function MindMap() {
  const { tree, loading, error, initFramework, loadFramework } = useFramework();
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [highlightedIds, setHighlightedIds] = useState<Set<number>>(new Set());
  const [inspecting, setInspecting] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<InspectionResult | null>(null);
  const [showConvSummary, setShowConvSummary] = useState(false);
  const [convText, setConvText] = useState("");
  const [convSummarizing, setConvSummarizing] = useState(false);
  const [convSummary, setConvSummary] = useState<ConversationSummary | null>(null);
  const [reminder, setReminder] = useState<any>(null);
  const [showReminderInput, setShowReminderInput] = useState(false);
  const [reminderProjectDesc, setReminderProjectDesc] = useState("");
  const [loadingReminder, setLoadingReminder] = useState(false);

  const api = typeof window !== "undefined" ? window.electronAPI : null;

  const handleNodeClick = useCallback((id: number) => {
    setSelectedNodeId(id);
  }, []);

  const handleInspect = async () => {
    if (!api) return;
    setInspecting(true);
    try {
      const result = await api.aiInspectFramework();
      setInspectionResult(result);
    } catch (err: any) {
      alert("巡检失败: " + err.message);
    } finally {
      setInspecting(false);
    }
  };

  const handleSuggestionAction = async (suggestion: InspectionSuggestion) => {
    if (!api) return;
    if (suggestion.action === "add_note" || suggestion.action === "fill_gap") {
      const parentId = suggestion.targetNodeId;
      if (parentId) {
        await api.dbAddNode(parentId, suggestion.title, "", "user_note");
        loadFramework();
      }
    }
    setInspectionResult(null);
  };

  const handleSummarizeConversation = async () => {
    if (!api || !convText.trim()) return;
    setConvSummarizing(true);
    try {
      const result = await api.aiSummarizeConversation(convText.trim());
      setConvSummary(result);
      setConvText("");
      setShowConvSummary(false);
    } catch (err: any) {
      alert("摘要失败: " + err.message);
    } finally {
      setConvSummarizing(false);
    }
  };

  const handleAddInsight = async (insight: ConversationInsight) => {
    if (!api) return;
    const framework = await api.dbGetFramework();
    let parentId: number | null = null;

    if (framework && insight.suggestedParentPath.length > 0) {
      function findNodeByPath(node: any, pathIndex: number): any {
        if (pathIndex >= insight.suggestedParentPath.length) return node;
        const targetTitle = insight.suggestedParentPath[pathIndex];
        const child = (node.children || []).find((c: any) => c.title === targetTitle);
        if (child) return findNodeByPath(child, pathIndex + 1);
        return node;
      }

      const targetNode = findNodeByPath(framework, 0);
      if (targetNode) parentId = targetNode.id;
    }

    await api.dbAddNode(
      parentId,
      insight.title,
      insight.content,
      insight.suggestedNodeType || "user_note"
    );
    loadFramework();
  };

  const handleAddAllInsights = async () => {
    if (!convSummary) return;
    for (const insight of convSummary.keyInsights) {
      await handleAddInsight(insight);
    }
    setConvSummary(null);
  };

  const handleGetReminder = async () => {
    if (!api || !reminderProjectDesc.trim()) return;
    setLoadingReminder(true);
    try {
      const result = await api.aiPracticeReminder(reminderProjectDesc.trim());
      setReminder(result);
      setReminderProjectDesc("");
      setShowReminderInput(false);
    } catch (err: any) {
      alert("获取提醒失败: " + err.message);
    } finally {
      setLoadingReminder(false);
    }
  };

  const { nodes: flowNodes, edges: flowEdges } = useMemo(() => {
    if (!tree || tree.id === 0) return { nodes: [], edges: [] };

    const metrics: LayoutMetrics = {
      nodeWidth: 160,
      nodeHeight: 50,
      horizontalGap: 60,
      verticalGap: 16,
    };

    const totalHeight = calculateSubtreeHeight(tree, metrics) + 100;
    return layoutTree(
      tree,
      50,
      0,
      totalHeight,
      0,
      highlightedIds,
      handleNodeClick,
      metrics
    );
  }, [tree, highlightedIds, handleNodeClick]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges]);

  const onNodesChange = useCallback((changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);
  const onEdgesChange = useCallback((changes: any) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

function AutoFitView({ nodeCount }: { nodeCount: number }) {
  const { fitView } = useReactFlow();
  const prevLen = useRef(0);

  useEffect(() => {
    if (nodeCount > 0 && nodeCount !== prevLen.current) {
      prevLen.current = nodeCount;
      const timer = setTimeout(() => fitView({ padding: 0.3 }), 50);
      return () => clearTimeout(timer);
    }
  }, [nodeCount, fitView]);

  return null;
}

function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange }: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: any) => void;
  onEdgesChange: (changes: any) => void;
}) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      connectionMode={ConnectionMode.Loose}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <AutoFitView nodeCount={nodes.length} />
      <Background color="#2d2d4a" gap={20} size={1} />
      <Controls
        showInteractive={false}
        className="!bg-bg-secondary !border-[var(--border-color)] !rounded-lg [&>button]:!bg-bg-secondary [&>button]:!border-[var(--border-color)] [&>button]:!text-[var(--text-secondary)] [&>button:hover]:!bg-bg-tertiary"
      />
      <MiniMap
        nodeColor={(n) => {
          const nodeType = n.data?.nodeType as string;
          const config = NODE_TYPE_CONFIG[nodeType as keyof typeof NODE_TYPE_CONFIG];
          return config?.color || "#3B82F6";
        }}
        maskColor="rgba(15, 15, 26, 0.8)"
        className="!bg-bg-secondary !border-[var(--border-color)] !rounded-lg"
      />
    </ReactFlow>
  );
}

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg-primary">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">加载框架中...</p>
        </div>
      </div>
    );
  }

  if (!tree || tree.id === 0) {
    return (
      <div className="flex-1 flex flex-col bg-bg-primary">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center animate-fade-in">
            <div className="text-6xl mb-4">🌱</div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              ThinkGarden
            </h2>
            <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs">
              AI 驱动的思维花园，让碎片经验长成知识体系
            </p>
            <button
              onClick={initFramework}
              className="px-5 py-2.5 bg-accent-blue hover:bg-accent-blue/80 text-white text-sm font-medium rounded-lg transition-colors"
            >
              生成初始框架
            </button>
          </div>
        </div>
        <QuickInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
      <div className="flex-1 relative">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
        />

        <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
          <button
            onClick={handleInspect}
            disabled={inspecting}
            className="px-3 py-1.5 bg-bg-secondary/90 border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-blue/30 rounded-lg backdrop-blur-sm transition-colors disabled:opacity-50"
          >
            {inspecting ? "🔍 巡检中..." : "🔍 巡检框架"}
          </button>
          <button
            onClick={() => setShowConvSummary(true)}
            className="px-3 py-1.5 bg-bg-secondary/90 border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-purple/30 rounded-lg backdrop-blur-sm transition-colors"
          >
            💬 对话摘要
          </button>
          <button
            onClick={() => setShowReminderInput(true)}
            className="px-3 py-1.5 bg-bg-secondary/90 border border-[var(--border-color)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-accent-yellow/30 rounded-lg backdrop-blur-sm transition-colors"
          >
            🔔 实践提醒
          </button>
        </div>
      </div>

      {selectedNodeId && (
        <NodeDetail
          nodeId={selectedNodeId}
          onClose={() => setSelectedNodeId(null)}
          onUpdate={loadFramework}
        />
      )}

      {inspectionResult && (
        <InspectionPanel
          result={inspectionResult}
          onClose={() => setInspectionResult(null)}
          onSuggestionAction={handleSuggestionAction}
        />
      )}

      {convSummary && (
        <ConversationSummaryPanel
          summary={convSummary}
          onClose={() => setConvSummary(null)}
          onAddInsight={handleAddInsight}
          onAddAll={handleAddAllInsights}
        />
      )}

      {showConvSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[520px] bg-bg-secondary border border-[var(--border-color)] rounded-xl shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">💬 粘贴 AI 对话记录</h3>
              <button
                onClick={() => setShowConvSummary(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={convText}
                onChange={(e) => setConvText(e.target.value)}
                rows={10}
                placeholder="粘贴你与 AI 的对话记录，AI 会自动提取关键经验和知识点..."
                className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-purple/50 resize-none"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowConvSummary(false)}
                  className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSummarizeConversation}
                  disabled={!convText.trim() || convSummarizing}
                  className="px-4 py-2 bg-accent-purple hover:bg-accent-purple/80 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {convSummarizing ? "分析中..." : "提取经验"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reminder && (
        <PracticeReminderPanel
          reminder={reminder}
          onClose={() => setReminder(null)}
          onNavigateToNode={(nodeId) => { setSelectedNodeId(nodeId); setReminder(null); }}
        />
      )}

      {showReminderInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[420px] bg-bg-secondary border border-[var(--border-color)] rounded-xl shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">🔔 新项目实践提醒</h3>
              <button
                onClick={() => setShowReminderInput(false)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >✕</button>
            </div>
            <div className="p-4">
              <textarea
                value={reminderProjectDesc}
                onChange={(e) => setReminderProjectDesc(e.target.value)}
                rows={4}
                placeholder="描述你即将开始的项目，AI 会根据你的实践框架给出提醒..."
                className="w-full px-3 py-2 text-sm bg-bg-tertiary border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-accent-yellow/50 resize-none"
              />
              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => setShowReminderInput(false)}
                  className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-lg transition-colors"
                >取消</button>
                <button
                  onClick={handleGetReminder}
                  disabled={!reminderProjectDesc.trim() || loadingReminder}
                  className="px-4 py-2 bg-accent-yellow hover:bg-accent-yellow/80 disabled:opacity-40 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  {loadingReminder ? "分析中..." : "获取提醒"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickInput />
    </div>
  );
}
