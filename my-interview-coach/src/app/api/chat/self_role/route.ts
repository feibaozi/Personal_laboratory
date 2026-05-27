import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chat } from '@/lib/llm';
import { retrieveRelevant } from '@/lib/embeddings';
import { getLatestProfile } from '@/lib/profile-store';
import { buildProfileContext } from '@/lib/profile-engine';
import {
  buildSelfRolePrompt,
  buildContextFromChunks,
  buildContextFromCards,
} from '@/lib/prompts';
import { getSetting } from '@/lib/db';
import type { ChatMessage, ChatSession } from '@/lib/types';

function buildSelfProfilePrompt(profileCtx: string, cardCtx: string): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身。现在${userName}本人正在与你对话，帮助你校准回答内容和风格。

## ${userName}的完整档案（结构化知识库）
${profileCtx}

## ${userName}准备过的面试问答
${cardCtx || '暂无'}

## 当前对话目的
- 用户可能会纠正你之前的回答（"不对，我实际会说..."）
- 用户可能会补充新信息（"还有个项目没写进简历..."）
- 用户可能会调整你的风格（"太啰嗦了，简洁点"）

## 你的行为
1. 接受用户的所有纠正和补充，表示理解和感谢
2. 当识别到用户提供了**可持久化的信息**（新事实、新项目、风格偏好、具体数据），主动询问是否保存
3. 当识别到信息是**临时的**（聊天上下文、测试性问题），只保留在对话中
4. 根据纠正重新组织回答，让用户确认

## 判断标准（可持久化 vs 临时）
- 可持久化：项目细节、技能点、工作经历、数字/数据、风格要求
- 临时：闲聊、情绪表达、一次性的测试问题`;
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
        'SELECT role, content, is_corrected, corrected_content FROM chat_messages WHERE session_id = ? AND role != ? ORDER BY created_at ASC LIMIT 20'
      )
      .all(Number(sessionId), 'system') as ChatMessage[];

    // Use structured profile if available
    const profile = getLatestProfile();
    const relevantChunks = await retrieveRelevant(message, 5);

    const cards = db
      .prepare('SELECT question, answer, category FROM cards ORDER BY updated_at DESC LIMIT 10')
      .all() as { question: string; answer: string; category: string }[];

    const cardContext = buildContextFromCards(cards);

    let systemPrompt: string;
    if (profile) {
      const profileCtx = buildProfileContext(profile);
      systemPrompt = buildSelfProfilePrompt(profileCtx, cardContext);
    } else {
      const chunkContext = buildContextFromChunks(relevantChunks);
      systemPrompt = buildSelfRolePrompt(chunkContext, cardContext);
    }

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({
        role: m.role,
        content: m.is_corrected && m.corrected_content
          ? m.corrected_content
          : m.content,
      })),
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
