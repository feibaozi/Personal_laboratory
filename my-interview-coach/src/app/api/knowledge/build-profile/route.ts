import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { extractProfile, mergeProfiles, buildProfileContext } from '@/lib/profile-engine';
import { getLatestProfile, saveProfile } from '@/lib/profile-store';
import type { Document } from '@/lib/types';

export async function POST() {
  try {
    const db = getDb();
    const documents = db
      .prepare('SELECT * FROM documents ORDER BY created_at DESC')
      .all() as Document[];

    if (documents.length === 0) {
      return NextResponse.json({ error: '请先上传文档' }, { status: 400 });
    }

    const documentTexts = documents.map((d) => d.content);
    const documentIds = documents.map((d) => d.id);

    // Extract profile from all documents
    const newProfile = await extractProfile(documentTexts);

    // Merge with existing profile if one exists
    const existing = getLatestProfile();
    const finalProfile = existing
      ? await mergeProfiles(existing, newProfile)
      : newProfile;

    // Save
    const record = saveProfile(finalProfile, documentIds);

    // Build context preview
    const context = buildProfileContext(finalProfile);

    return NextResponse.json({
      profile: finalProfile,
      context,
      version: record.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
