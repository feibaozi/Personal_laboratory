import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { retrieveRelevant } from '@/lib/embeddings';
import { chat } from '@/lib/llm';
import { getLatestProfile } from '@/lib/profile-store';
import { buildProfileContext } from '@/lib/profile-engine';
import {
  buildKnowledgeQueryPrompt,
  buildContextFromChunks,
  buildContextFromCards,
} from '@/lib/prompts';
export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();
    if (!question) {
      return NextResponse.json(
        { error: 'question 是必填项' },
        { status: 400 }
      );
    }

    const db = getDb();

    // 1. Check for structured profile (primary context)
    const profile = getLatestProfile();

    // 2. Retrieve relevant chunks from knowledge base (supplementary)
    const relevantChunks = await retrieveRelevant(question, 5);

    // 3. Search cards for relevant Q&A
    const cards = db
      .prepare(
        `SELECT * FROM cards WHERE question LIKE ? OR answer LIKE ? LIMIT 3`
      )
      .all(`%${question}%`, `%${question}%`) as {
      question: string;
      answer: string;
      category: string;
    }[];

    const chunkContext = buildContextFromChunks(relevantChunks);
    const cardContext = buildContextFromCards(cards);

    // 4. Build system prompt with profile as primary source if available
    let system: string;
    let user: string;

    if (profile) {
      const profileCtx = buildProfileContext(profile);
      system = `你是 ${profile.person.name} 的个人知识助手。以下是关于 ta 的完整档案，所有事实均来源于此。

## 个人档案（结构化知识库）
${profileCtx}

## 补充文档片段
${chunkContext || '无'}

## 相关话题卡片
${cardContext || '无'}

## 回答规则
1. 优先使用个人档案中的结构化信息
2. 档案中找不到的细节，再参考补充文档片段
3. 诚实说明信息来源，区分"明确的"和"推断的"
4. 用中文回答，保持清晰简洁`;
      user = question;
    } else {
      const prompt = buildKnowledgeQueryPrompt(question, chunkContext, cardContext);
      system = prompt.system;
      user = prompt.user;
    }

    let answer: string;
    try {
      answer = await chat([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ]);
    } catch (llmErr) {
      const msg = llmErr instanceof Error ? llmErr.message : String(llmErr);
      if (profile) {
        answer = `(LLM 调用失败: ${msg})\n\n以下是根据档案中已知信息的回答:\n\n${buildProfileContext(profile)}`;
      } else if (relevantChunks.length > 0) {
        answer = `(LLM 调用失败: ${msg})\n\n以下是检索到的相关内容:\n\n${chunkContext}`;
      } else {
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    const sources = relevantChunks.map((c) => ({
      documentId: c.document_id,
      filename: c.document_filename,
      chunkIndex: c.chunk_index,
      content: c.content.substring(0, 200),
      similarity: c.similarity,
    }));

    return NextResponse.json({ answer, sources });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
