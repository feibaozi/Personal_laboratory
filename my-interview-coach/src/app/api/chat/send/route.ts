import { NextRequest, NextResponse } from 'next/server';
import { getDb, getSetting } from '@/lib/db';
import { chat } from '@/lib/llm';
import { retrieveRelevant } from '@/lib/embeddings';
import { getLatestProfile } from '@/lib/profile-store';
import { buildProfileContext } from '@/lib/profile-engine';
import {
  buildInterviewerRolePrompt,
  buildSelfRolePrompt,
  buildContextFromChunks,
  buildContextFromCards,
} from '@/lib/prompts';
import type { ChatMessage, ChatSession } from '@/lib/types';

function buildInterviewerProfilePrompt(profileCtx: string, cardCtx: string): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身，正在参加一场面试。面试官正在向你提问。以第一人称"我"的口吻回答。

## ${userName}的完整档案（结构化知识库）
${profileCtx}

## ${userName}准备过的面试问答
${cardCtx || '暂无'}

## 回答准则
1. 基于档案中的真实经历、技能和项目细节回答，绝不编造
2. 如果不了解，诚实说明"这部分我还在学习中"
3. 回答要有结构：先给结论，再展开细节；用STAR法则讲项目经历
4. 保持自然口语化，像真正面试中的人一样说话`;
}

function buildSelfProfilePrompt(profileCtx: string, cardCtx: string): string {
  const userName = getSetting('user_name') || '求职者';

  return `你是 ${userName} 的数字分身。现在${userName}本人正在与你对话，帮助你校准回答内容和风格。

## ${userName}的完整档案（结构化知识库）
${profileCtx}

## ${userName}准备过的面试问答
${cardCtx || '暂无'}

## 当前对话目的
- 用户可能会纠正你之前的回答
- 用户可能会补充新信息
- 用户可能会调整你的风格

## 你的行为
1. 接受用户的纠正和补充，表示理解和感谢
2. 识别到可持久化的信息时，主动询问是否保存
3. 临时的聊天上下文只保留在对话中
4. 根据纠正重新组织回答，让用户确认

## 持久化 vs 临时
- 可持久化：项目细节、技能点、工作经历、数字/数据、风格要求
- 临时：闲聊、情绪表达、一次性的测试问题`;
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, message, mode } = await req.json();
    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'sessionId 和 message 是必填项' },
        { status: 400 }
      );
    }

    const currentMode = (mode === 'self_role' ? 'self_role' : 'interviewer_role') as 'interviewer_role' | 'self_role';
    const db = getDb();

    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(Number(sessionId)) as ChatSession | undefined;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    // Update session mode if switched
    if (session.mode !== currentMode) {
      db.prepare('UPDATE chat_sessions SET mode = ? WHERE id = ?').run(currentMode, Number(sessionId));
    }

    // Save user message
    db.prepare(
      'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)'
    ).run(Number(sessionId), 'user', message);

    // Get conversation history (skip system messages we add dynamically)
    const history = db
      .prepare(
        'SELECT role, content FROM chat_messages WHERE session_id = ? AND role != ? ORDER BY created_at ASC LIMIT 20'
      )
      .all(Number(sessionId), 'system') as { role: string; content: string }[];

    // Build context
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

    // Choose system prompt based on current mode
    let systemPrompt: string;
    if (profile) {
      const profileCtx = buildProfileContext(profile);
      systemPrompt = currentMode === 'interviewer_role'
        ? buildInterviewerProfilePrompt(profileCtx, cardContext)
        : buildSelfProfilePrompt(profileCtx, cardContext);
    } else {
      const chunkContext = buildContextFromChunks(relevantChunks);
      systemPrompt = currentMode === 'interviewer_role'
        ? buildInterviewerRolePrompt(chunkContext, cardContext)
        : buildSelfRolePrompt(chunkContext, cardContext);
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

    return NextResponse.json({ message: savedMessage, mode: currentMode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
