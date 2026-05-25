import { v4 as uuidv4 } from 'uuid';
import { queryAll, execute } from '../index';

export function getAllPackingLists() {
  return queryAll('SELECT * FROM packing_lists ORDER BY createdAt DESC');
}

export function createPackingList(data: { name: string; destination?: string; startDate?: string; endDate?: string; days?: number; outfits?: any[]; garmentIds?: string[] }) {
  const now = new Date().toISOString();
  const id = uuidv4();
  execute(
    `INSERT INTO packing_lists (id, name, destination, startDate, endDate, days, outfits, garmentIds, checkedItems, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
    [
      id, data.name, data.destination || null, data.startDate || null,
      data.endDate || null, data.days ?? null,
      data.outfits ? JSON.stringify(data.outfits) : null,
      data.garmentIds ? JSON.stringify(data.garmentIds) : null,
      now,
    ]
  );
  return queryAll('SELECT * FROM packing_lists WHERE id = ?', [id])[0];
}

export function deletePackingList(id: string) {
  execute('DELETE FROM packing_lists WHERE id = ?', [id]);
}
