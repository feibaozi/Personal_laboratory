import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chat } from '@/lib/llm';
import { retrieveRelevant } from '@/lib/embeddings';
import { getLatestProfile } from '@/lib/profile-store';
import { buildProfileContext } from '@/lib/profile-engine';
import {
  buildInterviewerRolePrompt,
  buildContextFromChunks,
  buildContextFromCards,
} from '@/lib/prompts';
import { getSetting } from '@/lib/db';
import type { ChatMessage, ChatSession } from '@/lib/types';

function buildProfileSystemPrompt(profileCtx: string, cardCtx: string): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身，正在参加一场面试。面试官正在向你提问。以第一人称"我"的口吻回答。

## ${userName}的完整档案（结构化知识库 — 所有事实均来自此档案）
${profileCtx}

## ${userName}准备过的面试问答
${cardCtx || '暂无'}

## 回答准则
1. 基于档案中的真实经历、技能和项目细节回答，绝不编造
2. 如果不了解，诚实说明"这部分我还在学习中"
3. 回答要有结构：先给结论，再展开细节；用STAR法则讲项目经历
4. 保持自然口语化，像真正面试中的人一样说话
5. 主动关联你的核心优势和职业叙事`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message } = await req.json();
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId 和 message 是必填项' },
        { status: 400 }
      );
    }

    const db = getDb();

    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(Number(sessionId)) as ChatSession | undefined;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(Number(sessionId), 'user', message);

    const history = db
      .prepare(
        'SELECT role, content FROM chat_messages WHERE session_id = ? AND role != ? ORDER BY created_at ASC LIMIT 20'
      )
      .all(Number(sessionId), 'system') as { role: string; content: string }[];

    // Use structured profile if available, fall back to RAG
    const profile = getLatestProfile();
    const relevantChunks = await retrieveRelevant(message, 5);

    const cards = db
      .prepare(
        'SELECT question, answer, category FROM cards WHERE question LIKE ? OR answer LIKE ? LIMIT 5'
      )
      .all(`%${message}%`, `%${message}%`) as {
      question: string;
      answer: string;
      category: string;
    }[];

    const cardContext = buildContextFromCards(cards);

    let systemPrompt: string;
    if (profile) {
      const profileCtx = buildProfileContext(profile);
      systemPrompt = buildProfileSystemPrompt(profileCtx, cardContext);
    } else {
      const chunkContext = buildContextFromChunks(relevantChunks);
      systemPrompt = buildInterviewerRolePrompt(chunkContext, cardContext);
    }

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const reply = await chat(llmMessages, { temperature: 0.7 });

    const result = db
      .prepare(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
      )
      .run(Number(sessionId), 'assistant', reply);

    db.prepare(
      "UPDATE chat_sessions SET updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(Number(sessionId));

    const savedMessage = db
      .prepare('SELECT * FROM chat_messages WHERE id = ?')
      .get(result.lastInsertRowid) as ChatMessage;

    return NextResponse.json({ message: savedMessage });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
