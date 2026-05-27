import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { ChatMessage } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { messageId, correctedContent } = await req.json();
    if (!messageId || correctedContent === undefined) {
      return NextResponse.json(
        { error: 'messageId 和 correctedContent 是必填项' },
        { status: 400 }
      );
    }

    const db = getDb();
    db.prepare(
      "UPDATE chat_messages SET is_corrected = 1, corrected_content = ? WHERE id = ?"
    ).run(correctedContent, Number(messageId));

    const message = db
      .prepare('SELECT * FROM chat_messages WHERE id = ?')
      .get(Number(messageId)) as ChatMessage;

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
