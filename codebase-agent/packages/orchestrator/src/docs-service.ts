import { LlmClient } from './llm-client.js';

function getLlmConfig() {
  return {
    provider: (process.env.LLM_PROVIDER || 'ollama') as 'openai' | 'ollama' | 'anthropic',
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
    model: process.env.LLM_MODEL || 'llama3',
  };
}

function buildSystemPrompt(graphJson: string, debtJson: any): string {
  const graph = JSON.parse(graphJson);
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  const modules = nodes.filter((n: any) => n.kind === 'Module');
  const functions = nodes.filter((n: any) => n.kind === 'Function');
  const classes = nodes.filter((n: any) => n.kind === 'Class');
  const imports = edges.filter((e: any) => e.kind === 'Import');
  const calls = edges.filter((e: any) => e.kind === 'Call');

  const debtSummary = debtJson
    ? `Overall debt score: ${(debtJson.overall || 0).toFixed(1)}/10, Grade: ${debtJson.grade || 'N/A'}`
    : 'No debt data available';

  return `You are a technical architect writing documentation for a codebase. Analyze the following codebase structure and generate a comprehensive architecture document in Markdown format.

## Codebase Summary
- Total modules: ${modules.length}
- Total functions: ${functions.length}
- Total classes: ${classes.length}
- Import relationships: ${imports.length}
- Function call relationships: ${calls.length}

## Technical Debt
${debtSummary}

## Module List
${modules.map((m: any) => `- ${m.name}`).join('\n')}

## Dependency Graph (edges)
${edges.map((e: any) => `- ${e.from_id} --[${e.kind}]--> ${e.to_id}`).join('\n')}

## Node Details
${nodes.map((n: any) => {
  return `### ${n.name} (${n.kind})
- File: ${n.file_path}
- Lines: ${n.start_line}-${n.end_line}
- Language: ${n.language}
- Cyclomatic Complexity: ${n.metrics?.cyclomatic_complexity || 0}
- Lines of Code: ${n.metrics?.lines_of_code || 0}
- Coupling: afferent=${n.metrics?.afferent_coupling || 0}, efferent=${n.metrics?.efferent_coupling || 0}`;
}).join('\n\n')}

Please generate a comprehensive architecture document with the following sections:
1. **Project Overview** - High-level description of the project
2. **Module Architecture** - Description of each module and its responsibilities
3. **Dependency Analysis** - Key dependencies between modules, potential issues
4. **Technical Debt Assessment** - Analysis of code quality metrics and recommendations
5. **Refactoring Recommendations** - Suggested improvements based on the analysis

Write in Chinese. Use proper Markdown formatting with headings, lists, and code blocks where appropriate.`;
}

export async function* generateArchitectureDocs(
  graphJson: string,
  debtJson: any
): AsyncGenerator<string> {
  const config = getLlmConfig();
  const client = new LlmClient(config);
  const systemPrompt = buildSystemPrompt(graphJson, debtJson);

  yield* client.chatStream([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请根据以上代码库分析数据，生成一份完整的架构文档。' },
  ]);
}

export async function generateArchitectureDocsSync(
  graphJson: string,
  debtJson: any
): Promise<string> {
  const config = getLlmConfig();
  const client = new LlmClient(config);
  const systemPrompt = buildSystemPrompt(graphJson, debtJson);

  return client.chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请根据以上代码库分析数据，生成一份完整的架构文档。' },
  ]);
}