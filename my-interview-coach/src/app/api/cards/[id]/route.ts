import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Card } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(Number(id)) as Card | undefined;

    if (!card) {
      return NextResponse.json({ error: '卡片不存在' }, { status: 404 });
    }

    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { question, answer, category, tags } = body;

    const db = getDb();
    const existing = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(Number(id)) as Card | undefined;

    if (!existing) {
      return NextResponse.json({ error: '卡片不存在' }, { status: 404 });
    }

    const newQuestion = question ?? existing.question;
    const newAnswer = answer ?? existing.answer;
    const newCategory = category ?? existing.category;
    const newTags =
      tags !== undefined ? JSON.stringify(tags) : existing.tags;

    db.prepare(
      `UPDATE cards SET question = ?, answer = ?, category = ?, tags = ?, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(newQuestion, newAnswer, newCategory, newTags, Number(id));

    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(Number(id)) as Card;

    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    db.prepare('DELETE FROM cards WHERE id = ?').run(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
