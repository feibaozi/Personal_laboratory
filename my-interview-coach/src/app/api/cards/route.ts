import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Card } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const tag = searchParams.get('tag');
    const search = searchParams.get('search');

    let sql = 'SELECT * FROM cards WHERE 1=1';
    const params: (string | number)[] = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (tag) {
      sql += ' AND tags LIKE ?';
      params.push(`%"${tag}"%`);
    }
    if (search) {
      sql += ' AND (question LIKE ? OR answer LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY updated_at DESC';

    const db = getDb();
    const cards = db.prepare(sql).all(...params) as Card[];
    return NextResponse.json({ cards });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      question = '',
      answer,
      category = 'other',
      tags = [],
      source = 'manual',
      sourceChatId = null,
    } = body;

    if (!answer) {
      return NextResponse.json({ error: 'answer 是必填项' }, { status: 400 });
    }

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO cards (question, answer, category, tags, source, source_chat_id)
       VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(question, answer, category, JSON.stringify(tags), source, sourceChatId);

    const card = db
      .prepare('SELECT * FROM cards WHERE id = ?')
      .get(result.lastInsertRowid) as Card;

    return NextResponse.json({ card });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
