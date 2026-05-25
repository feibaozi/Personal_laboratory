import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../index';

export function getAllBodyProfiles() {
  return queryAll('SELECT * FROM body_profiles ORDER BY createdAt DESC');
}

export function getBodyProfile(id: string) {
  return queryOne('SELECT * FROM body_profiles WHERE id = ?', [id]);
}

export function createBodyProfile(data: { name: string; gender: string; height: number; weight?: number; measurements?: Record<string, number>; bodyType?: string; templateId: string }) {
  const now = new Date().toISOString();
  const id = uuidv4();
  execute(
    `INSERT INTO body_profiles (id, name, gender, height, weight, measurements, bodyType, templateId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.name, data.gender, data.height, data.weight ?? null,
      data.measurements ? JSON.stringify(data.measurements) : null,
      data.bodyType || null, data.templateId, now, now,
    ]
  );
  return getBodyProfile(id);
}

export function updateBodyProfile(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: any[] = [];
  const directFields = ['name', 'gender', 'height', 'weight', 'bodyType', 'templateId'];
  for (const f of directFields) {
    if (f in patch) { sets.push(`${f} = ?`); vals.push(patch[f]); }
  }
  if ('measurements' in patch) { sets.push('measurements = ?'); vals.push(JSON.stringify(patch.measurements)); }
  if (sets.length === 0) return getBodyProfile(id);
  sets.push('updatedAt = ?'); vals.push(new Date().toISOString()); vals.push(id);
  execute(`UPDATE body_profiles SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getBodyProfile(id);
}

export function deleteBodyProfile(id: string) {
  execute('DELETE FROM body_profiles WHERE id = ?', [id]);
}
