import { getDb } from './db';
import type { PersonProfile, ProfileRecord } from './types';

export function saveProfile(profile: PersonProfile, documentIds: number[]): ProfileRecord {
  const db = getDb();
  const result = db
    .prepare(
      'INSERT INTO profile_data (profile_json, source_document_ids) VALUES (?, ?)'
    )
    .run(JSON.stringify(profile), JSON.stringify(documentIds));

  return db
    .prepare('SELECT * FROM profile_data WHERE id = ?')
    .get(result.lastInsertRowid) as ProfileRecord;
}

export function getLatestProfile(): PersonProfile | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM profile_data ORDER BY id DESC LIMIT 1')
    .get() as ProfileRecord | undefined;

  if (!row) return null;

  try {
    return JSON.parse(row.profile_json) as PersonProfile;
  } catch {
    return null;
  }
}

export function getProfileWithRecord(): { profile: PersonProfile; record: ProfileRecord } | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM profile_data ORDER BY id DESC LIMIT 1')
    .get() as ProfileRecord | undefined;

  if (!row) return null;

  try {
    return { profile: JSON.parse(row.profile_json) as PersonProfile, record: row };
  } catch {
    return null;
  }
}

export function getProfileHistory(): ProfileRecord[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM profile_data ORDER BY id DESC')
    .all() as ProfileRecord[];
}

export function hasProfile(): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT COUNT(*) as count FROM profile_data')
    .get() as { count: number };
  return row.count > 0;
}
