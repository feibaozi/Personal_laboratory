export interface SourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface UnifiedNode {
  kind: string;
  name: string;
  range: SourceRange;
  children: UnifiedNode[];
  language: 'python' | 'typescript' | 'go';
}

export type NodeKind = 'module' | 'class' | 'function' | 'variable' | 'interface';

export type EdgeKind = 'import' | 'call' | 'extends' | 'implements' | 'references';

export interface NodeInfo {
  id: string;
  kind: NodeKind;
  name: string;
  filePath: string;
  range: SourceRange;
  metrics: CodeMetrics;
}

export interface EdgeInfo {
  from: string;
  to: string;
  kind: EdgeKind;
}

export interface DependencyGraph {
  nodes: NodeInfo[];
  edges: EdgeInfo[];
}

export interface CodeMetrics {
  cyclomaticComplexity: number;
  linesOfCode: number;
  commentDensity: number;
  afferentCoupling: number;
  efferentCoupling: number;
  instability: number;
  abstractness: number;
  distanceFromMainSequence: number;
}

export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DebtScore {
  overall: number;
  grade: HealthGrade;
  dimensions: {
    complexity: { score: number; weight: number };
    coupling: { score: number; weight: number };
    commentDensity: { score: number; weight: number };
    testCoverage: { score: number; weight: number };
    duplication: { score: number; weight: number };
  };
}

export interface LineageNode {
  symbolId: string;
  name: string;
  kind: NodeKind;
  filePath: string;
  range: SourceRange;
  depth: number;
  relation: 'direct' | 'indirect';
}

export interface LineageResult {
  symbol: string;
  downstream: LineageNode[];
  upstream: LineageNode[];
}

export interface DuplicationGroup {
  id: string;
  files: Array<{
    filePath: string;
    startLine: number;
    endLine: number;
  }>;
  duplicatedLines: number;
  fingerprint: string;
}

export interface CodeSmell {
  id: string;
  type: 'god_class' | 'long_function' | 'high_coupling' | 'circular_dependency' | 'shotgun_surgery' | 'feature_envy' | 'duplication';
  severity: 'info' | 'warning' | 'error';
  description: string;
  filePath: string;
  range: SourceRange;
  symbolName: string;
  metrics: Partial<CodeMetrics>;
}

export interface RefactorTask {
  id: string;
  title: string;
  description: string;
  strategy: string;
  affectedFiles: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  priority: number;
  safeToAutomate: boolean;
  relatedSmells: string[];
}

export interface ArchitectureDocument {
  overview: string;
  directoryStructure: string;
  modules: Array<{
    name: string;
    responsibility: string;
    dependencies: string[];
    keySymbols: string[];
  }>;
  dataFlows: string[];
  externalDependencies: string[];
  riskAreas: string[];
  mermaidDiagrams: Record<string, string>;
}

export interface AnalyzeRequest {
  projectPath: string;
  languages?: ('python' | 'typescript' | 'go')[];
  incremental?: boolean;
}

export interface AnalyzeStatus {
  projectId: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  totalFiles: number;
  parsedFiles: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}