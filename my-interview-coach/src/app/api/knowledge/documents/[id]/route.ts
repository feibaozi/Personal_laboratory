import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { Document, Chunk } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();
    const document = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(Number(id)) as Document | undefined;

    if (!document) {
      return NextResponse.json({ error: '文档不存在' }, { status: 404 });
    }

    const chunks = db
      .prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY chunk_index')
      .all(Number(id)) as Chunk[];

    return NextResponse.json({ document, chunks });
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
    // CASCADE will delete chunks too
    db.prepare('DELETE FROM documents WHERE id = ?').run(Number(id));
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
