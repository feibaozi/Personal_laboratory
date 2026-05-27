import { NextResponse } from 'next/server';
import { rebuildAllIndexes } from '@/lib/embeddings';

export async function POST() {
  try {
    const result = await rebuildAllIndexes();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
