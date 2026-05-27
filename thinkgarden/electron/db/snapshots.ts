import { getDatabase, saveDatabase } from "./database";
import { getFrameworkTree, setCurrentFrameworkId, getCurrentFrameworkId } from "./nodes";

export function createSnapshot(name: string, description?: string): number {
  const d = getDatabase();
  const fwId = getCurrentFrameworkId();
  const tree = getFrameworkTree(fwId);
  const data = JSON.stringify(tree);

  d.run("INSERT INTO snapshots (framework_id, name, description, data) VALUES (?, ?, ?, ?)", [fwId, name, description || null, data]);

  const idResult = d.prepare("SELECT last_insert_rowid() as id");
  idResult.step();
  const id = idResult.getAsObject().id as number;
  idResult.free();

  saveDatabase();
  return id;
}

export function getSnapshots(frameworkId?: number): { id: number; name: string; description: string | null; createdAt: string }[] {
  const d = getDatabase();
  const fwId = frameworkId || getCurrentFrameworkId();
  const results: { id: number; name: string; description: string | null; createdAt: string }[] = [];
  const stmt = d.prepare("SELECT id, name, description, created_at FROM snapshots WHERE framework_id = ? ORDER BY created_at DESC");
  stmt.bind([fwId]);
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      id: row.id as number,
      name: row.name as string,
      description: row.description as string | null,
      createdAt: row.created_at as string,
    });
  }
  stmt.free();
  return results;
}

export function restoreSnapshot(snapshotId: number): boolean {
  const d = getDatabase();
  const stmt = d.prepare("SELECT data, framework_id FROM snapshots WHERE id = ?");
  stmt.bind([snapshotId]);
  if (!stmt.step()) {
    stmt.free();
    return false;
  }
  const data = stmt.getAsObject().data as string;
  const fwId = stmt.getAsObject().framework_id as number;
  stmt.free();

  d.run("DELETE FROM node_tags WHERE node_id IN (SELECT id FROM framework_nodes WHERE framework_id = ?)", [fwId]);
  d.run("DELETE FROM framework_nodes WHERE framework_id = ?", [fwId]);

  const tree = JSON.parse(data);

  function insertNode(node: any, parentId: number | null) {
    d.run(
      "INSERT INTO framework_nodes (framework_id, parent_id, title, content, summary, node_type, source_type, source_ref, sort_order, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [fwId, parentId, node.title, node.content || "", node.summary || null, node.node_type, node.source_type, node.source_ref || null, node.sort_order || 0, node.icon || null, node.color || null, node.created_at || new Date().toISOString(), node.updated_at || new Date().toISOString()]
    );
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const newId = idResult.getAsObject().id as number;
    idResult.free();

    if (node.children) {
      for (const child of node.children) {
        insertNode(child, newId);
      }
    }
  }

  insertNode(tree, null);
  saveDatabase();
  return true;
}
