import { chat } from './llm';
import type { PersonProfile } from './types';

const EXTRACTION_PROMPT = `你是一位专业的职业档案分析师。请从以下文档中提取求职者的完整档案信息。

## 文档内容
{document_text}

## 输出要求
请以严格的 JSON 格式输出（不要有 markdown 代码块标记），结构如下：

{
  "person": {
    "name": "姓名",
    "role": "当前/目标职位",
    "yearsOfExperience": 工作年限数字,
    "summary": "一句话概括这个人的职业定位（50字以内）"
  },
  "workHistory": [
    {
      "company": "公司名",
      "role": "职位",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM 或 至今" },
      "achievements": ["具体工作成果1", "成果2"],
      "techStack": ["技术1", "技术2"]
    }
  ],
  "projects": [
    {
      "name": "项目名",
      "company": "所属公司",
      "description": "一句话描述项目是什么（30字内）",
      "techStack": ["技术1", "技术2"],
      "outcome": "项目成果或影响",
      "highlights": ["亮点1（体现个人贡献）", "亮点2"]
    }
  ],
  "skills": [
    {
      "name": "技能名",
      "level": "expert/advanced/intermediate/familiar",
      "evidence": ["能证明这项技能的经历"]
    }
  ],
  "education": [
    {
      "school": "学校名",
      "degree": "学位",
      "major": "专业",
      "period": { "start": "YYYY-MM", "end": "YYYY-MM" }
    }
  ],
  "careerNarrative": "基于所有资料，用3-5句话写出这个人的职业故事：经历了一条什么样的成长路径，核心竞争力是什么，下一阶段想往哪个方向发展。像一个老练的职业顾问在描述这位求职者。",
  "coreStrengths": ["核心优势1", "核心优势2", "核心优势3"],
  "growthAreas": ["需要补充或强化的领域1", "领域2"],
  "targetRoles": ["适合投递的岗位1", "岗位2", "岗位3"]
}

## 重要规则
1. 只提取文档中明确提到或强烈暗示的信息，不要编造
2. 如果某项信息在文档中找不到，用空数组 [] 或空字符串 "" 代替
3. 数字和日期保持原始格式
4. achievements 要具体、量化（有数字就用数字）
5. careerNarrative 要体现逻辑连贯性：从过去经历到未来方向
6. coreStrengths 是基于证据的竞争优势，不是泛泛的优点
7. growthAreas 是面试中需要准备的弱点或空白领域
8. 整个 JSON 必须是一个合法的 JSON 对象，不要有任何注释`;

const MERGE_PROMPT = `你是一位职业档案分析师。现在有两份关于同一个人的档案数据，请将它们合并成一份完整的档案。

## 已有档案
{existing_profile}

## 新提取的档案
{new_profile}

## 合并规则
1. 如果新旧信息冲突，优先使用新提取的数据
2. workHistory、projects、skills、education 去重合并（按名称和公司判断重复）
3. 如果有同一段经历但细节不同，取更完整的一方
4. careerNarrative 重写为综合版本
5. coreStrengths 和 growthAreas 合并去重
6. yearsOfExperience 取更准确的值

直接输出合并后的 JSON，格式与输入相同。`;

const CORRECTION_PROMPT = `你正在维护一份个人职业档案。用户提供了一个修正信息，请据此更新档案中对应的字段。

## 当前档案
{current_profile}

## 用户修正
{correction_text}

## 更新规则
1. 理解用户修正的内容，找到档案中对应的字段进行更新
2. 如果修正涉及新的事实（新项目、新技能等），添加到对应数组中
3. 如果修正否定了已有信息，替换为正确的版本
4. 如果修正只是风格/措辞调整，更新 careerNarrative 和 person.summary
5. 保持 JSON 结构不变

直接输出更新后的完整 JSON。`;

export async function extractProfile(documentTexts: string[]): Promise<PersonProfile> {
  const combinedText = documentTexts
    .map((t, i) => `## 文档${i + 1}\n${t}`)
    .join('\n\n---\n\n');

  const prompt = EXTRACTION_PROMPT.replace('{document_text}', combinedText);

  const response = await chat(
    [
      {
        role: 'system',
        content:
          '你是一个精确的 JSON 输出引擎。只输出合法的 JSON，不要有任何 markdown 标记、解释或额外文字。',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 4000 }
  );

  return parseProfileResponse(response);
}

export async function mergeProfiles(
  existing: PersonProfile,
  incoming: PersonProfile
): Promise<PersonProfile> {
  const prompt = MERGE_PROMPT.replace(
    '{existing_profile}',
    JSON.stringify(existing, null, 2)
  ).replace('{new_profile}', JSON.stringify(incoming, null, 2));

  const response = await chat(
    [
      {
        role: 'system',
        content: '只输出合法的 JSON，不要有任何 markdown 标记。',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 4000 }
  );

  return parseProfileResponse(response);
}

export async function applyCorrection(
  current: PersonProfile,
  correctionText: string
): Promise<PersonProfile> {
  const prompt = CORRECTION_PROMPT.replace(
    '{current_profile}',
    JSON.stringify(current, null, 2)
  ).replace('{correction_text}', correctionText);

  const response = await chat(
    [
      {
        role: 'system',
        content: '只输出合法的 JSON，不要有任何 markdown 标记。',
      },
      { role: 'user', content: prompt },
    ],
    { temperature: 0.3, maxTokens: 4000 }
  );

  return parseProfileResponse(response);
}

export function buildProfileContext(profile: PersonProfile): string {
  const parts: string[] = [];

  parts.push(`## 个人信息\n${profile.person.name}，${profile.person.role}，${profile.person.yearsOfExperience}年经验。${profile.person.summary}`);

  if (profile.workHistory.length > 0) {
    parts.push(
      `\n## 工作经历\n${profile.workHistory
        .map(
          (w) =>
            `- **${w.company}** · ${w.role} (${w.period.start} ~ ${w.period.end})\n  成果: ${w.achievements.join('; ')}\n  技术栈: ${w.techStack.join(', ')}`
        )
        .join('\n')}`
    );
  }

  if (profile.projects.length > 0) {
    parts.push(
      `\n## 项目经历\n${profile.projects
        .map(
          (p) =>
            `- **${p.name}** (${p.company})\n  ${p.description}\n  技术: ${p.techStack.join(', ')}\n  亮点: ${p.highlights.join('; ')}`
        )
        .join('\n')}`
    );
  }

  if (profile.skills.length > 0) {
    parts.push(
      `\n## 技能\n${profile.skills
        .map((s) => `- ${s.name} (${s.level}) — ${s.evidence.join('; ')}`)
        .join('\n')}`
    );
  }

  if (profile.education.length > 0) {
    parts.push(
      `\n## 教育\n${profile.education
        .map((e) => `- ${e.school} · ${e.degree} in ${e.major} (${e.period.start} ~ ${e.period.end})`)
        .join('\n')}`
    );
  }

  if (profile.careerNarrative) {
    parts.push(`\n## 职业叙事\n${profile.careerNarrative}`);
  }

  if (profile.coreStrengths.length > 0) {
    parts.push(`\n## 核心优势\n${profile.coreStrengths.map((s) => `- ${s}`).join('\n')}`);
  }

  if (profile.targetRoles.length > 0) {
    parts.push(`\n## 适合岗位\n${profile.targetRoles.join('、')}`);
  }

  return parts.join('\n');
}

function parseProfileResponse(response: string): PersonProfile {
  // Strip markdown code fences if present
  let json = response.trim();
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    return JSON.parse(json) as PersonProfile;
  } catch {
    // Retry with more aggressive cleanup
    const firstBrace = json.indexOf('{');
    const lastBrace = json.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      json = json.slice(firstBrace, lastBrace + 1);
    }
    return JSON.parse(json) as PersonProfile;
  }
}
