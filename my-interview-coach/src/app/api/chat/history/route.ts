import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { ChatSession } from '@/lib/types';

export async function GET() {
  try {
    const db = getDb();
    const sessions = db
      .prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC')
      .all() as ChatSession[];
    return NextResponse.json({ sessions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mode, title } = await req.json();
    if (!mode) {
      return NextResponse.json({ error: 'mode 是必填项' }, { status: 400 });
    }

    const db = getDb();
    const sessionTitle =
      title ||
      (mode === 'interviewer_role' ? '模拟面试' : '校准对话');

    const result = db
      .prepare(
        'INSERT INTO chat_sessions (title, mode) VALUES (?, ?)'
      )
      .run(sessionTitle, mode);

    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(result.lastInsertRowid) as ChatSession;

    return NextResponse.json({ session });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
