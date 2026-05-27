import { getFrameworkContextForAI } from "./db/notes";
import { getConfig } from "./db/database";

interface PlacementResult {
  targetNodePath: string[];
  targetNodeId: number | null;
  confidence: number;
  generatedTitle: string;
  generatedSummary: string;
  suggestedTags: string[];
  relatedSuggestions: {
    title: string;
    content: string;
    nodeType: string;
    reason: string;
  }[];
}

export interface InspectionResult {
  healthScore: number;
  totalNodes: number;
  userNoteCount: number;
  aiNodeCount: number;
  issues: InspectionIssue[];
  suggestions: InspectionSuggestion[];
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

export interface ConversationSummary {
  keyInsights: {
    title: string;
    content: string;
    suggestedTags: string[];
    suggestedNodeType: string;
    suggestedParentPath: string[];
  }[];
  overallTheme: string;
  projectContext: string | null;
}

export interface AISearchResult {
  matchedNodeIds: number[];
  aiExplanation: string;
}

export interface PracticeReminder {
  warnings: {
    nodePath: string[];
    nodeId: number;
    title: string;
    content: string;
    nodeType: string;
  }[];
  principles: {
    nodePath: string[];
    nodeId: number;
    title: string;
    content: string;
  }[];
  tips: {
    nodePath: string[];
    nodeId: number;
    title: string;
    content: string;
  }[];
  advice: string;
}

const SYSTEM_PROMPT_ANALYZE = `你是一个知识管理助手。用户有一个实践框架（树形结构），
用户会写下一段自己的实践经验，你需要：

1. 分析这段经验属于框架中的哪个节点
2. 为用户生成一个合适的标题和摘要
3. 推荐 2-3 条用户可能还需要补充的相关知识

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "target_node_path": ["父节点", "目标节点"],
  "target_node_id": 123,
  "confidence": 0.85,
  "generated_title": "用 AI 生成代码前先让 AI 给方案",
  "generated_summary": "一条prompt技巧：...",
  "suggested_tags": ["prompt技巧", "代码生成"],
  "related_suggestions": [
    {
      "title": "如何写出好的 system prompt",
      "content": "...",
      "node_type": "tip",
      "reason": "你提到了 prompt 技巧，这条基础原则可能对你有帮助"
    }
  ]
}`;

const SYSTEM_PROMPT_INSPECT = `你是一个知识框架健康检查专家。用户有一个实践框架（树形结构），
你需要对框架进行全面巡检，找出问题并给出优化建议。

巡检维度：
1. 空洞检测：某个分类下只有 AI 生成的节点，没有用户的个人笔记（user_note）
2. 结构失衡：某些分支层级过深（>4层），或某分类下子节点过多（>8个）
3. 内容缺失：重要阶段（如"测试与验证"）内容过少
4. 重复检测：可能存在语义相似的节点

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "health_score": 75,
  "total_nodes": 30,
  "user_note_count": 5,
  "ai_node_count": 25,
  "issues": [
    {
      "type": "no_user_notes",
      "severity": "high",
      "node_path": ["迭代开发", "代码审查"],
      "node_id": 15,
      "description": "该分支只有AI生成的通用建议，缺少你的个人实践经验"
    }
  ],
  "suggestions": [
    {
      "action": "add_note",
      "target_node_path": ["迭代开发", "代码审查"],
      "target_node_id": 15,
      "title": "补充代码审查的个人经验",
      "description": "你在用AI生成代码后，通常做哪些检查？记录下来可以形成你自己的review清单",
      "priority": "high"
    }
  ]
}`;

const SYSTEM_PROMPT_SUMMARIZE = `你是一个实践经验提取专家。用户会粘贴一段与 AI 的对话记录，
你需要从中提取关键的经验和知识点。

提取规则：
1. 只提取有实践价值的经验，忽略闲聊和重复内容
2. 每条经验应该是独立可用的知识点
3. 为每条经验推荐合适的标签和节点类型
4. 推断这条经验应该放在框架的哪个位置

节点类型：category(分类), step(步骤), principle(原则), tip(技巧), warning(警告), user_note(个人笔记)

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "key_insights": [
    {
      "title": "Electron透明窗口配置要点",
      "content": "在Windows上需要同时设置transparent:true和backgroundColor:'#00000000'才能生效",
      "suggested_tags": ["electron", "windows", "踩坑记录"],
      "suggested_node_type": "warning",
      "suggested_parent_path": ["原型搭建", "配置开发环境"]
    }
  ],
  "overall_theme": "Electron桌面应用开发中的配置问题",
  "project_context": "mood-radio项目"
}`;

async function callLLM(systemPrompt: string, userMessage: string, maxTokens: number = 2000): Promise<string> {
  const endpoint = getConfig("api_endpoint") || "https://api.openai.com/v1/chat/completions";
  const apiKey = getConfig("api_key") || "";
  const model = getConfig("api_model") || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("API Key 未配置，请在设置中配置 API Key");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseJSONResponse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {}

  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  const braceMatch = raw.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {}
  }

  return null;
}

async function callLLMWithRetry(systemPrompt: string, userMessage: string, maxTokens: number = 2000): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await callLLM(systemPrompt, userMessage, maxTokens);
    } catch (err) {
      lastError = err as Error;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error("AI 调用失败");
}

export async function analyzeNote(content: string): Promise<PlacementResult> {
  const frameworkContext = getFrameworkContextForAI();

  const userMessage = `当前框架结构如下（节点ID > 路径）：
${frameworkContext}

用户笔记内容：
${content}`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_ANALYZE, userMessage);
  const parsed = parseJSONResponse(raw);

  if (!parsed) {
    throw new Error("AI 返回格式无法解析");
  }

  return {
    targetNodePath: parsed.target_node_path || [],
    targetNodeId: parsed.target_node_id || null,
    confidence: parsed.confidence || 0.5,
    generatedTitle: parsed.generated_title || content.substring(0, 50),
    generatedSummary: parsed.generated_summary || "",
    suggestedTags: parsed.suggested_tags || [],
    relatedSuggestions: (parsed.related_suggestions || []).map((s: any) => ({
      title: s.title || "",
      content: s.content || "",
      nodeType: s.node_type || "tip",
      reason: s.reason || "",
    })),
  };
}

export async function inspectFramework(): Promise<InspectionResult> {
  const frameworkContext = getFrameworkContextForAI();

  const userMessage = `当前框架结构如下（节点ID > 路径）：
${frameworkContext}

请对这个框架进行全面巡检。`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_INSPECT, userMessage, 3000);
  const parsed = parseJSONResponse(raw);

  if (!parsed) {
    throw new Error("AI 巡检结果格式无法解析");
  }

  return {
    healthScore: parsed.health_score || 0,
    totalNodes: parsed.total_nodes || 0,
    userNoteCount: parsed.user_note_count || 0,
    aiNodeCount: parsed.ai_node_count || 0,
    issues: (parsed.issues || []).map((i: any) => ({
      type: i.type || "empty_branch",
      severity: i.severity || "medium",
      nodePath: i.node_path || [],
      nodeId: i.node_id || null,
      description: i.description || "",
    })),
    suggestions: (parsed.suggestions || []).map((s: any) => ({
      action: s.action || "add_note",
      targetNodePath: s.target_node_path || [],
      targetNodeId: s.target_node_id || null,
      title: s.title || "",
      description: s.description || "",
      priority: s.priority || "medium",
    })),
  };
}

export async function summarizeConversation(conversationText: string): Promise<ConversationSummary> {
  const frameworkContext = getFrameworkContextForAI();

  const userMessage = `当前框架结构如下（节点ID > 路径）：
${frameworkContext}

以下是用户与AI的对话记录：
${conversationText}

请从中提取关键实践经验。`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_SUMMARIZE, userMessage, 3000);
  const parsed = parseJSONResponse(raw);

  if (!parsed) {
    throw new Error("AI 摘要结果格式无法解析");
  }

  return {
    keyInsights: (parsed.key_insights || []).map((i: any) => ({
      title: i.title || "",
      content: i.content || "",
      suggestedTags: i.suggested_tags || [],
      suggestedNodeType: i.suggested_node_type || "user_note",
      suggestedParentPath: i.suggested_parent_path || [],
    })),
    overallTheme: parsed.overall_theme || "",
    projectContext: parsed.project_context || null,
  };
}

const SYSTEM_PROMPT_SEARCH = `你是一个知识框架搜索助手。用户会用自然语言描述他们想找的知识，
你需要根据框架结构，找出最相关的节点。

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "matched_node_ids": [12, 15, 23],
  "explanation": "根据你的描述，以下节点可能相关：..."
}`;

export async function aiSearch(naturalLanguageQuery: string): Promise<AISearchResult> {
  const frameworkContext = getFrameworkContextForAI();

  const userMessage = `当前框架结构如下（节点ID > 路径）：
${frameworkContext}

用户搜索：${naturalLanguageQuery}

请找出最相关的节点ID。`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_SEARCH, userMessage, 1000);
  const parsed = parseJSONResponse(raw);

  if (!parsed) {
    return { matchedNodeIds: [], aiExplanation: "AI 搜索结果无法解析" };
  }

  return {
    matchedNodeIds: parsed.matched_node_ids || [],
    aiExplanation: parsed.explanation || "",
  };
}

const SYSTEM_PROMPT_REMINDER = `你是一个实践提醒助手。用户即将开始一个新项目，
你需要根据他们实践框架中的 warning 和 principle 节点，给出重要的提醒。

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "warnings": [
    {
      "node_path": ["迭代开发", "代码审查", "关注安全与边界情况"],
      "node_id": 18,
      "title": "关注安全与边界情况",
      "content": "...",
      "node_type": "warning"
    }
  ],
  "principles": [
    {
      "node_path": ["迭代开发", "代码审查", "AI 生成代码后必做 review"],
      "node_id": 17,
      "title": "AI 生成代码后必做 review",
      "content": "..."
    }
  ],
  "tips": [
    {
      "node_path": ["迭代开发", "调试与排错", "把报错直接贴给 AI"],
      "node_id": 20,
      "title": "把报错直接贴给 AI",
      "content": "..."
    }
  ],
  "advice": "开始新项目前的建议..."
}`;

export async function getPracticeReminder(projectDescription: string): Promise<PracticeReminder> {
  const frameworkContext = getFrameworkContextForAI();

  const userMessage = `当前框架结构如下（节点ID > 路径）：
${frameworkContext}

用户即将开始的项目：${projectDescription}

请给出实践提醒，重点推荐 warning 和 principle 类型的节点。`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_REMINDER, userMessage, 2000);
  const parsed = parseJSONResponse(raw);

  if (!parsed) {
    return { warnings: [], principles: [], tips: [], advice: "" };
  }

  return {
    warnings: (parsed.warnings || []).map((w: any) => ({
      nodePath: w.node_path || [],
      nodeId: w.node_id || 0,
      title: w.title || "",
      content: w.content || "",
      nodeType: w.node_type || "warning",
    })),
    principles: (parsed.principles || []).map((p: any) => ({
      nodePath: p.node_path || [],
      nodeId: p.node_id || 0,
      title: p.title || "",
      content: p.content || "",
    })),
    tips: (parsed.tips || []).map((t: any) => ({
      nodePath: t.node_path || [],
      nodeId: t.node_id || 0,
      title: t.title || "",
      content: t.content || "",
    })),
    advice: parsed.advice || "",
  };
}

export interface DomainFrameworkNode {
  title: string;
  nodeType: string;
  content?: string;
  summary?: string;
  children?: DomainFrameworkNode[];
}

export interface DomainFrameworkResult {
  framework: DomainFrameworkNode;
  aiMessage: string;
  questions: string[];
}

const SYSTEM_PROMPT_GENERATE_FRAMEWORK = `你是一个知识框架设计专家。用户想建立某个领域的知识框架，
你需要根据用户描述的领域，生成一份结构化的知识框架。

要求：
1. 框架应该覆盖该领域从入门到精通的完整路径
2. 每个节点使用合适的类型：category(大类/阶段), step(具体步骤), principle(核心原则), tip(实用技巧), warning(常见误区/避坑)
3. 框架要有 3-5 个主要阶段，每个阶段下有 3-5 个子节点
4. 同时给出 2-3 个向用户确认的问题，帮助进一步优化框架

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "framework": {
    "title": "领域名称",
    "node_type": "category",
    "children": [
      {
        "title": "阶段一",
        "node_type": "category",
        "summary": "简短描述",
        "children": [
          { "title": "具体步骤", "node_type": "step", "summary": "简短描述" },
          { "title": "核心原则", "node_type": "principle", "summary": "简短描述" },
          { "title": "常见误区", "node_type": "warning", "summary": "简短描述" }
        ]
      }
    ]
  },
  "ai_message": "我为你生成了初步框架，请查看并提出修改意见",
  "questions": [
    "你更关注理论还是实践？",
    "你目前处于什么水平？",
    "有没有特别想深入的方向？"
  ]
}`;

export async function generateDomainFramework(domainDescription: string): Promise<DomainFrameworkResult> {
  const userMessage = `我想建立以下领域的知识框架：${domainDescription}`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_GENERATE_FRAMEWORK, userMessage, 4000);
  const parsed = parseJSONResponse(raw);

  if (!parsed || !parsed.framework) {
    throw new Error("AI 框架生成结果无法解析");
  }

  return {
    framework: parsed.framework,
    aiMessage: parsed.ai_message || "框架已生成",
    questions: parsed.questions || [],
  };
}

const SYSTEM_PROMPT_REFINE_FRAMEWORK = `你是一个知识框架设计专家。用户有一个初步的知识框架，
根据用户的反馈意见，你需要修改和优化这个框架。

要求：
1. 根据用户意见调整框架结构（增删改节点、调整层级）
2. 保持 JSON 结构与输入一致
3. 继续给出 2-3 个进一步优化的问题（如果框架已经足够好，questions 返回空数组）

请严格按以下 JSON 格式返回（不要包含其他文字，不要用 markdown 代码块包裹）：

{
  "framework": { ... 修改后的框架 ... },
  "ai_message": "根据你的意见，我做了以下调整：...",
  "questions": ["还有其他想调整的吗？"]
}`;

export async function refineFramework(
  currentFramework: DomainFrameworkNode,
  userFeedback: string
): Promise<DomainFrameworkResult> {
  const userMessage = `当前框架：
${JSON.stringify(currentFramework, null, 2)}

用户的修改意见：${userFeedback}`;

  const raw = await callLLMWithRetry(SYSTEM_PROMPT_REFINE_FRAMEWORK, userMessage, 4000);
  const parsed = parseJSONResponse(raw);

  if (!parsed || !parsed.framework) {
    throw new Error("AI 框架优化结果无法解析");
  }

  return {
    framework: parsed.framework,
    aiMessage: parsed.ai_message || "框架已更新",
    questions: parsed.questions || [],
  };
}
