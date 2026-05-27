import { getDatabase } from "./database";
import { getNodePath, getCurrentFrameworkId } from "./nodes";

export interface SearchResultRow {
  nodeId: number;
  title: string;
  summary: string | null;
  nodeType: string;
  path: string[];
  snippet: string;
}

export function searchNodes(query: string, tagIds?: number[], sourceRef?: string): SearchResultRow[] {
  const d = getDatabase();
  const fwId = getCurrentFrameworkId();
  const results: SearchResultRow[] = [];

  let sql = "SELECT * FROM framework_nodes WHERE framework_id = ?";
  const params: any[] = [fwId];

  if (query.trim()) {
    const likeQuery = `%${query.trim()}%`;
    sql += " AND (title LIKE ? OR content LIKE ? OR summary LIKE ? OR source_ref LIKE ?)";
    params.push(likeQuery, likeQuery, likeQuery, likeQuery);
  }

  if (sourceRef) {
    sql += " AND source_ref = ?";
    params.push(sourceRef);
  }

  if (tagIds && tagIds.length > 0) {
    const placeholders = tagIds.map(() => "?").join(",");
    sql += ` AND id IN (SELECT node_id FROM node_tags WHERE tag_id IN (${placeholders}))`;
    params.push(...tagIds);
  }

  sql += " ORDER BY updated_at DESC LIMIT 50";

  const stmt = d.prepare(sql);
  stmt.bind(params);

  while (stmt.step()) {
    const row = stmt.getAsObject();
    const nodeId = row.id as number;
    const title = row.title as string;
    const content = row.content as string;
    const snippet = content.length > 100 ? content.substring(0, 100) + "..." : content;

    results.push({
      nodeId,
      title,
      summary: row.summary as string | null,
      nodeType: row.node_type as string,
      path: getNodePath(nodeId),
      snippet,
    });
  }
  stmt.free();

  return results;
}
