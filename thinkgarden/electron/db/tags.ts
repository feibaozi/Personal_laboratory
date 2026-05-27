import { getDatabase, saveDatabase } from "./database";

export interface TagRow {
  id: number;
  name: string;
  color: string | null;
  created_at: string;
}

export function getAllTags(): TagRow[] {
  const d = getDatabase();
  const tags: TagRow[] = [];
  const stmt = d.prepare("SELECT * FROM tags ORDER BY name");
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tags.push({
      id: row.id as number,
      name: row.name as string,
      color: row.color as string | null,
      created_at: row.created_at as string,
    });
  }
  stmt.free();
  return tags;
}

export function getOrCreateTag(name: string, color?: string): number {
  const d = getDatabase();

  const existing = d.prepare("SELECT id FROM tags WHERE name = ?");
  existing.bind([name]);
  if (existing.step()) {
    const id = existing.getAsObject().id as number;
    existing.free();
    return id;
  }
  existing.free();

  d.run("INSERT INTO tags (name, color) VALUES (?, ?)", [name, color || null]);

  const idResult = d.prepare("SELECT last_insert_rowid() as id");
  idResult.step();
  const id = idResult.getAsObject().id as number;
  idResult.free();

  saveDatabase();
  return id;
}

export function addTagToNode(nodeId: number, tagId: number): void {
  const d = getDatabase();
  d.run("INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)", [nodeId, tagId]);
  saveDatabase();
}

export function removeTagFromNode(nodeId: number, tagId: number): void {
  const d = getDatabase();
  d.run("DELETE FROM node_tags WHERE node_id = ? AND tag_id = ?", [nodeId, tagId]);
  saveDatabase();
}

export function deleteTag(tagId: number): void {
  const d = getDatabase();
  d.run("DELETE FROM node_tags WHERE tag_id = ?", [tagId]);
  d.run("DELETE FROM tags WHERE id = ?", [tagId]);
  saveDatabase();
}

export function setNodeTags(nodeId: number, tagNames: string[]): void {
  const d = getDatabase();

  d.run("DELETE FROM node_tags WHERE node_id = ?", [nodeId]);

  for (const name of tagNames) {
    const tagId = getOrCreateTag(name);
    d.run("INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)", [nodeId, tagId]);
  }

  saveDatabase();
}
