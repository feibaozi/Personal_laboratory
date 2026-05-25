import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../index';

export interface CreateOutfitDTO {
  name: string;
  garments: { garmentId: string; layer: number; position?: { x: number; y: number; width: number; height: number; zIndex: number } }[];
  occasions?: string[];
  seasons?: string[];
  style?: string;
  rating?: number;
  tags?: string[];
}

export function getAllOutfits() {
  return queryAll('SELECT * FROM outfits ORDER BY createdAt DESC');
}

export function getOutfit(id: string) {
  return queryOne('SELECT * FROM outfits WHERE id = ?', [id]);
}

export function createOutfit(data: CreateOutfitDTO) {
  const now = new Date().toISOString();
  const id = uuidv4();
  execute(
    `INSERT INTO outfits (id, name, garments, occasions, seasons, style, rating, tags, isFavorite, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id, data.name,
      JSON.stringify(data.garments),
      data.occasions ? JSON.stringify(data.occasions) : null,
      data.seasons ? JSON.stringify(data.seasons) : null,
      data.style || null,
      data.rating ?? 0,
      data.tags ? JSON.stringify(data.tags) : null,
      now, now,
    ]
  );
  return getOutfit(id);
}

export function updateOutfit(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: any[] = [];

  if ('name' in patch) { sets.push('name = ?'); vals.push(patch.name); }
  if ('garments' in patch) { sets.push('garments = ?'); vals.push(JSON.stringify(patch.garments)); }
  if ('occasions' in patch) { sets.push('occasions = ?'); vals.push(JSON.stringify(patch.occasions)); }
  if ('seasons' in patch) { sets.push('seasons = ?'); vals.push(JSON.stringify(patch.seasons)); }
  if ('style' in patch) { sets.push('style = ?'); vals.push(patch.style); }
  if ('rating' in patch) { sets.push('rating = ?'); vals.push(patch.rating); }
  if ('tags' in patch) { sets.push('tags = ?'); vals.push(JSON.stringify(patch.tags)); }
  if ('isFavorite' in patch) { sets.push('isFavorite = ?'); vals.push(patch.isFavorite ? 1 : 0); }

  if (sets.length === 0) return getOutfit(id);

  sets.push('updatedAt = ?');
  vals.push(new Date().toISOString());
  vals.push(id);

  execute(`UPDATE outfits SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getOutfit(id);
}

export function deleteOutfit(id: string) {
  execute('DELETE FROM outfits WHERE id = ?', [id]);
}
