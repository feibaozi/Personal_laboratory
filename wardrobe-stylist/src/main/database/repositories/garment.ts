import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../index';

export interface CreateGarmentDTO {
  name: string;
  imageUrl: string;
  thumbnailUrl: string;
  stickerUrl?: string | null;
  category: string;
  subcategory?: string;
  colors: string[];
  patterns?: string[];
  materials?: string[];
  seasons: string[];
  occasions: string[];
  style?: string;
  fit?: string;
  garmentLength?: string;
  brand?: string;
  purchaseDate?: string;
  price?: number;
  notes?: string;
}

export function getAllGarments() {
  return queryAll('SELECT * FROM garments ORDER BY createdAt DESC');
}

export function getGarment(id: string) {
  return queryOne('SELECT * FROM garments WHERE id = ?', [id]);
}

export function createGarment(data: CreateGarmentDTO) {
  const now = new Date().toISOString();
  const id = uuidv4();
  execute(
    `INSERT INTO garments (id, name, imageUrl, thumbnailUrl, stickerUrl, category, subcategory, colors, patterns, materials, seasons, occasions, style, fit, garmentLength, brand, purchaseDate, price, status, favorite, notes, wearCount, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, 0, ?, ?)`,
    [
      id, data.name, data.imageUrl, data.thumbnailUrl, data.stickerUrl || null, data.category,
      data.subcategory || null,
      JSON.stringify(data.colors),
      data.patterns ? JSON.stringify(data.patterns) : null,
      data.materials ? JSON.stringify(data.materials) : null,
      JSON.stringify(data.seasons),
      JSON.stringify(data.occasions),
      data.style || null,
      data.fit || null,
      data.garmentLength || null,
      data.brand || null,
      data.purchaseDate || null,
      data.price ?? null,
      data.notes || null,
      now, now,
    ]
  );
  return getGarment(id);
}

export function updateGarment(id: string, patch: Record<string, unknown>) {
  const sets: string[] = [];
  const vals: any[] = [];

  const directFields = ['name', 'category', 'subcategory', 'style', 'fit', 'garmentLength', 'brand', 'status', 'notes'];
  for (const f of directFields) {
    if (f in patch) { sets.push(`${f} = ?`); vals.push(patch[f]); }
  }
  if ('imageUrl' in patch) { sets.push('imageUrl = ?'); vals.push(patch.imageUrl); }
  if ('thumbnailUrl' in patch) { sets.push('thumbnailUrl = ?'); vals.push(patch.thumbnailUrl); }
  if ('stickerUrl' in patch) { sets.push('stickerUrl = ?'); vals.push(patch.stickerUrl); }
  if ('purchaseDate' in patch) { sets.push('purchaseDate = ?'); vals.push(patch.purchaseDate); }
  if ('price' in patch) { sets.push('price = ?'); vals.push(patch.price); }
  if ('favorite' in patch) { sets.push('favorite = ?'); vals.push(patch.favorite ? 1 : 0); }
  if ('wearCount' in patch) { sets.push('wearCount = ?'); vals.push(patch.wearCount); }
  if ('colors' in patch) { sets.push('colors = ?'); vals.push(JSON.stringify(patch.colors)); }
  if ('patterns' in patch) { sets.push('patterns = ?'); vals.push(JSON.stringify(patch.patterns)); }
  if ('materials' in patch) { sets.push('materials = ?'); vals.push(JSON.stringify(patch.materials)); }
  if ('seasons' in patch) { sets.push('seasons = ?'); vals.push(JSON.stringify(patch.seasons)); }
  if ('occasions' in patch) { sets.push('occasions = ?'); vals.push(JSON.stringify(patch.occasions)); }

  if (sets.length === 0) return getGarment(id);

  sets.push('updatedAt = ?');
  vals.push(new Date().toISOString());
  vals.push(id);

  execute(`UPDATE garments SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getGarment(id);
}

export function deleteGarment(id: string) {
  execute('DELETE FROM garments WHERE id = ?', [id]);
}

export function getGarmentStats() {
  const all = getAllGarments();
  const byCategory: Record<string, number> = {};
  for (const g of all) {
    byCategory[g.category] = (byCategory[g.category] || 0) + 1;
  }
  return { total: all.length, byCategory };
}
