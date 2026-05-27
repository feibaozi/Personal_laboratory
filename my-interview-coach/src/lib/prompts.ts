import { getSetting } from './db';

export function buildKnowledgeQueryPrompt(
  question: string,
  chunkContext: string,
  cardContext: string
): { system: string; user: string } {
  return {
    system: `你是一个个人知识助手，你的知识完全来源于用户提供的资料。请根据以下资料回答用户的问题。

## 相关资料（来自用户上传的文档）
${chunkContext || '暂无相关文档'}

## 相关话题卡片
${cardContext || '暂无相关卡片'}

## 回答规则
1. 只基于提供的资料回答，不要编造信息
2. 如果资料中没有相关信息，明确说明"根据现有的资料，我无法回答这个问题"
3. 回答时引用资料来源（文档名或卡片标题）
4. 保持简洁清晰，用中文回答`,
    user: question,
  };
}

export function buildInterviewerRolePrompt(
  knowledgeContext: string,
  cardContext: string
): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身。你正在参加一场面试，面试官正在向你提问。
以第一人称"我"的口吻，像${userName}本人一样自然回答。

## ${userName}的背景资料
${knowledgeContext || '暂无上传的资料'}

## ${userName}准备过的面试问答
${cardContext || '暂无准备的卡片'}

## 回答准则
1. 使用真实经历、技能和项目细节回答，绝不编造
2. 不了解的领域诚实说明"这部分我还在学习中"
3. 保持自然口语化，用${userName}的表达方式
4. 回答要有结构：先给结论，再展开细节
5. 如果问题涉及的项目你有多个相关经历，选择最匹配的那个`;
}

export function buildSelfRolePrompt(
  knowledgeContext: string,
  cardContext: string
): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身。现在${userName}本人正在与你对话，帮助你校准回答内容和风格。

## ${userName}的背景资料
${knowledgeContext || '暂无上传的资料'}

## ${userName}准备过的面试问答
${cardContext || '暂无准备的卡片'}

## 当前对话目的
- 用户可能会纠正你之前的回答（"不对，我实际会说..."）
- 用户可能会补充新信息（"还有个项目没写进简历..."）
- 用户可能会调整你的风格（"太啰嗦了，简洁点"）

## 你的行为
1. 接受用户的所有纠正和补充，表示理解和感谢
2. 当你识别到用户提供了**可持久化的信息**（新事实、新项目、风格偏好、具体数据），主动询问是否保存
3. 当你识别到信息是**临时的**（聊天上下文、测试性问题），只保留在对话中
4. 根据纠正重新组织回答，让用户确认

## 判断标准（可持久化 vs 临时）
- 可持久化：项目细节、技能点、工作经历、数字/数据、风格要求
- 临时：闲聊、情绪表达、一次性的测试问题`;
}

export function buildContextFromChunks(
  chunks: { content: string; document_filename: string }[]
): string {
  if (chunks.length === 0) return '';
  return chunks
    .map(
      (c, i) =>
        `[来源: ${c.document_filename}]\n${c.content}`
    )
    .join('\n\n---\n\n');
}

export function buildContextFromCards(
  cards: { question: string; answer: string; category: string }[]
): string {
  if (cards.length === 0) return '';
  return cards
    .map(
      (c, i) =>
        `[卡片: ${c.question} (分类: ${c.category})]\n回答: ${c.answer}`
    )
    .join('\n\n---\n\n');
}
