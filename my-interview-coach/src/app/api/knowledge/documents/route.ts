import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { chunkDocument, embedAndStoreChunks } from '@/lib/embeddings';
import { parseFile } from '@/lib/file-parser';
import type { Document } from '@/lib/types';

export async function GET() {
  try {
    const db = getDb();
    const documents = db
      .prepare('SELECT * FROM documents ORDER BY created_at DESC')
      .all() as Document[];
    return NextResponse.json({ documents });
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    let filename: string;
    let content: string;
    let fileType: string;

    if (contentType.includes('multipart/form-data')) {
      // Binary file upload (PDF, DOCX, etc.)
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { error: '未找到上传文件' },
          { status: 400 }
        );
      }

      filename = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await parseFile(buffer, filename);
      content = result.content;
      fileType = result.fileType;
    } else {
      // JSON text upload (paste content directly)
      const body = await req.json();
      filename = body.filename;
      content = body.content;
      if (!filename || !content) {
        return NextResponse.json(
          { error: 'filename 和 content 是必填项' },
          { status: 400 }
        );
      }
      fileType = filename.endsWith('.txt') ? 'txt' : 'md';
    }

    if (!content.trim()) {
      return NextResponse.json(
        { error: '文件内容为空，无法解析' },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = db
      .prepare(
        'INSERT INTO documents (filename, content, file_type) VALUES (?, ?, ?)'
      )
      .run(filename, content, fileType);

    const documentId = result.lastInsertRowid as number;

    // Chunk and embed asynchronously
    const chunks = chunkDocument(content);
    await embedAndStoreChunks(documentId, chunks);

    const document = db
      .prepare('SELECT * FROM documents WHERE id = ?')
      .get(documentId) as Document;

    return NextResponse.json({ document, chunkCount: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
