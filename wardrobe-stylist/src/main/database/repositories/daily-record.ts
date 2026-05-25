import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../index';

export interface CreateRecordDTO {
  date: string;
  outfitId?: string;
  garmentIds?: string[];
  occasion?: string;
  temperature?: number;
  weatherCondition?: string;
  mood?: string;
  rating?: number;
  photoUrl?: string;
  notes?: string;
}

export function getAllRecords() {
  return queryAll('SELECT * FROM daily_records ORDER BY date DESC');
}

export function getRecordByDate(date: string) {
  return queryOne('SELECT * FROM daily_records WHERE date = ?', [date]);
}

export function getRecordsByWeek(startDate: string, endDate: string) {
  return queryAll('SELECT * FROM daily_records WHERE date >= ? AND date <= ? ORDER BY date', [startDate, endDate]);
}

export function createRecord(data: CreateRecordDTO) {
  const now = new Date().toISOString();
  const id = uuidv4();
  execute(
    `INSERT INTO daily_records (id, date, outfitId, garmentIds, occasion, temperature, weatherCondition, mood, rating, photoUrl, notes, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, data.date, data.outfitId || null,
      data.garmentIds ? JSON.stringify(data.garmentIds) : null,
      data.occasion || null, data.temperature ?? null,
      data.weatherCondition || null, data.mood || null,
      data.rating ?? 0, data.photoUrl || null, data.notes || null, now,
    ]
  );
  return getRecordByDate(data.date);
}

export function updateRecord(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: any[] = [];
  const directFields = ['date', 'outfitId', 'occasion', 'temperature', 'weatherCondition', 'mood', 'rating', 'photoUrl', 'notes'];
  for (const f of directFields) {
    if (f in patch) { sets.push(`${f} = ?`); vals.push(patch[f]); }
  }
  if ('garmentIds' in patch) { sets.push('garmentIds = ?'); vals.push(JSON.stringify(patch.garmentIds)); }
  if (sets.length === 0) return queryOne('SELECT * FROM daily_records WHERE id = ?', [id]);
  vals.push(id);
  execute(`UPDATE daily_records SET ${sets.join(', ')} WHERE id = ?`, vals);
  return queryOne('SELECT * FROM daily_records WHERE id = ?', [id]);
}

export function deleteRecord(id: string) {
  execute('DELETE FROM daily_records WHERE id = ?', [id]);
}
