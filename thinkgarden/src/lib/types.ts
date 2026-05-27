export type NodeType = 'category' | 'step' | 'principle' | 'tip' | 'warning' | 'user_note';

export type SourceType = 'ai' | 'user' | 'ai_suggested';

export type InboxStatus = 'pending' | 'analyzed' | 'confirmed' | 'rejected';

export interface FrameworkNode {
  id: number;
  parentId: number | null;
  title: string;
  content: string;
  summary: string | null;
  nodeType: NodeType;
  sourceType: SourceType;
  sourceRef: string | null;
  sortOrder: number;
  icon: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  children?: FrameworkNode[];
  tags?: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface InboxNote {
  id: number;
  content: string;
  status: InboxStatus;
  aiResult: string | null;
  resultNodeId: number | null;
  createdAt: string;
}

export interface PlacementResult {
  targetNodePath: string[];
  targetNodeId: number | null;
  confidence: number;
  generatedTitle: string;
  generatedSummary: string;
  suggestedTags: string[];
  relatedSuggestions: Suggestion[];
}

export interface Suggestion {
  title: string;
  content: string;
  nodeType: NodeType;
  reason: string;
}

export interface SearchResult {
  nodeId: number;
  title: string;
  summary: string | null;
  nodeType: NodeType;
  path: string[];
  snippet: string;
}

export interface InspectionIssue {
  type: "empty_branch" | "no_user_notes" | "deep_nesting" | "orphan" | "similar_nodes";
  severity: "high" | "medium" | "low";
  nodePath: string[];
  nodeId: number | null;
  description: string;
}

export interface InspectionSuggestion {
  action: "add_note" | "merge_nodes" | "restructure" | "add_category" | "fill_gap";
  targetNodePath: string[];
  targetNodeId: number | null;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

export interface InspectionResult {
  healthScore: number;
  totalNodes: number;
  userNoteCount: number;
  aiNodeCount: number;
  issues: InspectionIssue[];
  suggestions: InspectionSuggestion[];
}

export interface ConversationInsight {
  title: string;
  content: string;
  suggestedTags: string[];
  suggestedNodeType: string;
  suggestedParentPath: string[];
}

export interface ConversationSummary {
  keyInsights: ConversationInsight[];
  overallTheme: string;
  projectContext: string | null;
}

export const NODE_TYPE_CONFIG: Record<NodeType, { label: string; icon: string; color: string; shape: string }> = {
  category: { label: '分类', icon: '📁', color: '#3B82F6', shape: 'rounded' },
  step: { label: '步骤', icon: '📋', color: '#10B981', shape: 'rounded' },
  principle: { label: '原则', icon: '💡', color: '#8B5CF6', shape: 'diamond' },
  tip: { label: '技巧', icon: '✨', color: '#F59E0B', shape: 'rounded' },
  warning: { label: '警告', icon: '⚠️', color: '#EF4444', shape: 'hexagon' },
  user_note: { label: '我的笔记', icon: '👤', color: '#F97316', shape: 'dashed' },
};
