import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { ChatSession, ChatMessage } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const db = getDb();
    const session = db
      .prepare('SELECT * FROM chat_sessions WHERE id = ?')
      .get(Number(sessionId)) as ChatSession | undefined;

    if (!session) {
      return NextResponse.json({ error: '会话不存在' }, { status: 404 });
    }

    const messages = db
      .prepare(
        'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC'
      )
      .all(Number(sessionId)) as ChatMessage[];

    return NextResponse.json({ session, messages });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const db = getDb();
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(Number(sessionId));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
