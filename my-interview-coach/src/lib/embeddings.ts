import { getDb } from './db';
import { embedText } from './llm';
import type { ChunkResult } from './types';

export function chunkDocument(content: string, maxChunkSize: number = 500): string[] {
  // Split by paragraph boundaries first
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

  // For long paragraphs, split by single newline
  const lines = paragraphs.flatMap((p) => {
    if (p.length <= maxChunkSize) return [p];
    return p.split(/\n/).filter((l) => l.trim());
  });

  // For very long lines, split by sentence boundaries
  const chunks = lines.flatMap((line) => {
    if (line.length <= maxChunkSize) return [line];
    const sentences = line.split(/(?<=[。.?!！？\n])\s*/);
    const merged: string[] = [];
    let current = '';
    for (const s of sentences) {
      if (current.length + s.length > maxChunkSize && current) {
        merged.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) merged.push(current.trim());
    return merged;
  });

  return chunks.filter((c) => c.length > 0);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function embedAndStoreChunks(
  documentId: number,
  chunks: string[]
): Promise<void> {
  const db = getDb();
  const insert = db.prepare(
    'INSERT INTO chunks (document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?)'
  );

  for (let i = 0; i < chunks.length; i++) {
    try {
      const embedding = await embedText(chunks[i]);
      insert.run(documentId, i, chunks[i], JSON.stringify(embedding));
    } catch (err) {
      // Store without embedding on failure, will be skipped in search
      console.error(`Failed to embed chunk ${i} of doc ${documentId}:`, err);
      insert.run(documentId, i, chunks[i], null);
    }
  }
}

export async function retrieveRelevant(
  query: string,
  topK: number = 5
): Promise<ChunkResult[]> {
  const db = getDb();

  // Try embedding-based retrieval first
  let queryEmbedding: number[] | null = null;
  try {
    queryEmbedding = await embedText(query);
  } catch {
    console.warn('Embedding failed, falling back to keyword search');
  }

  if (queryEmbedding) {
    const embeddedChunks = db
      .prepare(
        `SELECT c.*, d.filename as document_filename
         FROM chunks c
         JOIN documents d ON c.document_id = d.id
         WHERE c.embedding IS NOT NULL`
      )
      .all() as (ChunkResult & { embedding: string })[];

    if (embeddedChunks.length > 0) {
      const scored = embeddedChunks
        .map((chunk) => {
          const emb = JSON.parse(chunk.embedding) as number[];
          const sim = cosineSimilarity(queryEmbedding!, emb);
          return { ...chunk, similarity: sim };
        })
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

      return scored;
    }
  }

  // Fallback: keyword-based search with word overlap scoring
  const queryWords = new Set(
    query
      .toLowerCase()
      .split(/[\s,，。？?！!]+/)
      .filter((w) => w.length > 0)
  );

  const allChunks = db
    .prepare(
      `SELECT c.*, d.filename as document_filename
       FROM chunks c
       JOIN documents d ON c.document_id = d.id`
    )
    .all() as ChunkResult[];

  const scored = allChunks
    .map((chunk) => {
      const chunkWords = chunk.content.toLowerCase().split(/[\s,，。？?！!]+/);
      let matchCount = 0;
      for (const w of chunkWords) {
        if (queryWords.has(w)) matchCount++;
      }
      // Bonus for exact phrase match
      const phraseBonus = chunk.content.toLowerCase().includes(query.toLowerCase()) ? 0.3 : 0;
      const overlap = chunkWords.length > 0
        ? matchCount / Math.max(queryWords.size, chunkWords.length)
        : 0;
      return { ...chunk, similarity: overlap + phraseBonus };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

export async function rebuildAllIndexes(): Promise<{ documentCount: number; chunkCount: number }> {
  const db = getDb();
  const documents = db.prepare('SELECT id, content FROM documents').all() as {
    id: number;
    content: string;
  }[];

  let totalChunks = 0;

  for (const doc of documents) {
    // Delete old chunks
    db.prepare('DELETE FROM chunks WHERE document_id = ?').run(doc.id);
    const chunks = chunkDocument(doc.content);
    await embedAndStoreChunks(doc.id, chunks);
    totalChunks += chunks.length;
  }

  return { documentCount: documents.length, chunkCount: totalChunks };
}
