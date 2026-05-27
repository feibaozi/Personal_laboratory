import { getDatabase, saveDatabase } from "./database";

let currentFrameworkId: number = 1;

export function setCurrentFrameworkId(id: number): void {
  currentFrameworkId = id;
}

export function getCurrentFrameworkId(): number {
  return currentFrameworkId;
}

interface NodeRow {
  id: number;
  framework_id: number;
  parent_id: number | null;
  title: string;
  content: string;
  summary: string | null;
  node_type: string;
  source_type: string;
  source_ref: string | null;
  sort_order: number;
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface FrameworkTreeNode extends NodeRow {
  children: FrameworkTreeNode[];
  tags: { id: number; name: string; color: string | null }[];
}

function rowToNode(row: any): NodeRow {
  return {
    id: row.id as number,
    framework_id: (row.framework_id as number) || currentFrameworkId,
    parent_id: row.parent_id as number | null,
    title: row.title as string,
    content: row.content as string,
    summary: row.summary as string | null,
    node_type: row.node_type as string,
    source_type: row.source_type as string,
    source_ref: row.source_ref as string | null,
    sort_order: row.sort_order as number,
    icon: row.icon as string | null,
    color: row.color as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function buildTree(rows: NodeRow[], parentId: number | null): FrameworkTreeNode[] {
  return rows
    .filter((r) => r.parent_id === parentId)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => ({
      ...r,
      children: buildTree(rows, r.id),
      tags: getNodeTags(r.id),
    }));
}

function getNodeTags(nodeId: number): { id: number; name: string; color: string | null }[] {
  const d = getDatabase();
  const stmt = d.prepare(
    "SELECT t.id, t.name, t.color FROM tags t JOIN node_tags nt ON t.id = nt.tag_id WHERE nt.node_id = ?"
  );
  stmt.bind([nodeId]);
  const tags: { id: number; name: string; color: string | null }[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    tags.push({ id: row.id as number, name: row.name as string, color: row.color as string | null });
  }
  stmt.free();
  return tags;
}

export function getFrameworkTree(frameworkId?: number): FrameworkTreeNode {
  const fwId = frameworkId || currentFrameworkId;
  const d = getDatabase();
  const rows: NodeRow[] = [];
  const stmt = d.prepare("SELECT * FROM framework_nodes WHERE framework_id = ? ORDER BY sort_order, id");
  stmt.bind([fwId]);
  while (stmt.step()) {
    rows.push(rowToNode(stmt.getAsObject()));
  }
  stmt.free();

  const tree = buildTree(rows, null);

  if (tree.length === 0) {
    return {
      id: 0,
      framework_id: fwId,
      parent_id: null,
      title: "默认框架",
      content: "",
      summary: "AI 驱动的知识框架",
      node_type: "category",
      source_type: "ai",
      source_ref: null,
      sort_order: 0,
      icon: "🌱",
      color: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      children: [],
      tags: [],
    };
  }

  return tree[0];
}

export function getNode(id: number): NodeRow | null {
  const d = getDatabase();
  const stmt = d.prepare("SELECT * FROM framework_nodes WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const node = rowToNode(stmt.getAsObject());
    stmt.free();
    return node;
  }
  stmt.free();
  return null;
}

export function addNode(
  parentId: number | null,
  title: string,
  content: string,
  nodeType: string,
  sourceRef?: string,
  frameworkId?: number
): number {
  const fwId = frameworkId || currentFrameworkId;
  const d = getDatabase();

  let sortOrder = 0;
  if (parentId !== null) {
    const stmt = d.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM framework_nodes WHERE parent_id = ? AND framework_id = ?");
    stmt.bind([parentId, fwId]);
    if (stmt.step()) {
      sortOrder = (stmt.getAsObject().next_order as number) || 0;
    }
    stmt.free();
  }

  d.run(
    "INSERT INTO framework_nodes (framework_id, parent_id, title, content, node_type, source_type, source_ref, sort_order) VALUES (?, ?, ?, ?, ?, 'user', ?, ?)",
    [fwId, parentId, title, content, nodeType, sourceRef || null, sortOrder]
  );

  const idResult = d.prepare("SELECT last_insert_rowid() as id");
  idResult.step();
  const id = idResult.getAsObject().id as number;
  idResult.free();

  saveDatabase();
  return id;
}

export function updateNode(id: number, updates: Record<string, any>): boolean {
  const d = getDatabase();
  const allowedFields = ["title", "content", "summary", "node_type", "source_type", "source_ref", "sort_order", "icon", "color", "parent_id"];
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClauses.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClauses.length === 0) return false;

  setClauses.push("updated_at = datetime('now','localtime')");
  values.push(id);

  d.run(
    `UPDATE framework_nodes SET ${setClauses.join(", ")} WHERE id = ?`,
    values
  );

  saveDatabase();
  return true;
}

export function deleteNode(id: number): boolean {
  const d = getDatabase();

  function collectDescendants(nodeId: number): number[] {
    const ids = [nodeId];
    const stmt = d.prepare("SELECT id FROM framework_nodes WHERE parent_id = ?");
    stmt.bind([nodeId]);
    while (stmt.step()) {
      const childId = stmt.getAsObject().id as number;
      ids.push(...collectDescendants(childId));
    }
    stmt.free();
    return ids;
  }

  const allIds = collectDescendants(id);
  for (const nid of allIds) {
    d.run("DELETE FROM node_tags WHERE node_id = ?", [nid]);
  }
  d.run("DELETE FROM framework_nodes WHERE id = ?", [id]);

  saveDatabase();
  return true;
}

export function moveNode(nodeId: number, newParentId: number | null): boolean {
  const d = getDatabase();

  let sortOrder = 0;
  if (newParentId !== null) {
    const stmt = d.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM framework_nodes WHERE parent_id = ?");
    stmt.bind([newParentId]);
    if (stmt.step()) {
      sortOrder = (stmt.getAsObject().next_order as number) || 0;
    }
    stmt.free();
  }

  d.run(
    "UPDATE framework_nodes SET parent_id = ?, sort_order = ?, updated_at = datetime('now','localtime') WHERE id = ?",
    [newParentId, sortOrder, nodeId]
  );

  saveDatabase();
  return true;
}

export function initFramework(frameworkId?: number): FrameworkTreeNode {
  const fwId = frameworkId || currentFrameworkId;
  const d = getDatabase();

  d.run("DELETE FROM node_tags WHERE node_id IN (SELECT id FROM framework_nodes WHERE framework_id = ?)", [fwId]);
  d.run("DELETE FROM framework_nodes WHERE framework_id = ?", [fwId]);

  const rootId = addNode(null, "默认框架", "", "category", undefined, fwId);

  const categories = [
    { title: "基础入门", nodeType: "category", children: [
      { title: "了解核心概念", nodeType: "step" },
      { title: "搭建学习环境", nodeType: "step" },
      { title: "完成第一个实践", nodeType: "principle" },
    ]},
    { title: "知识积累", nodeType: "category", children: [
      { title: "关键知识点梳理", nodeType: "step" },
      { title: "常见误区与纠正", nodeType: "warning" },
      { title: "学习资源整理", nodeType: "step" },
    ]},
    { title: "实践应用", nodeType: "category", children: [
      { title: "动手项目记录", nodeType: "step" },
      { title: "踩坑经验总结", nodeType: "warning" },
      { title: "实用技巧收集", nodeType: "tip" },
    ]},
    { title: "反思与优化", nodeType: "category", children: [
      { title: "定期复盘心得", nodeType: "principle" },
      { title: "方法改进记录", nodeType: "step" },
      { title: "最佳实践提炼", nodeType: "principle" },
    ]},
  ];

  function insertCategoryItems(parentId: number, items: any[]) {
    for (const item of items) {
      const id = addNode(parentId, item.title, "", item.nodeType || "category", undefined, fwId);
      if (item.children) {
        insertCategoryItems(id, item.children);
      }
    }
  }

  for (const cat of categories) {
    const catId = addNode(rootId, cat.title, "", "category", undefined, fwId);
    if (cat.children) {
      insertCategoryItems(catId, cat.children);
    }
  }

  return getFrameworkTree(fwId);
}

export function getNodePath(nodeId: number): string[] {
  const d = getDatabase();
  const path: string[] = [];

  let currentId: number | null = nodeId;
  while (currentId !== null) {
    const stmt = d.prepare("SELECT id, parent_id, title FROM framework_nodes WHERE id = ?");
    stmt.bind([currentId]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      path.unshift(row.title as string);
      currentId = row.parent_id as number | null;
    } else {
      stmt.free();
      break;
    }
    stmt.free();
  }

  return path;
}

export function getAllNodePaths(frameworkId?: number): { id: number; path: string[] }[] {
  const fwId = frameworkId || currentFrameworkId;
  const d = getDatabase();
  const rows: { id: number }[] = [];
  const stmt = d.prepare("SELECT id FROM framework_nodes WHERE framework_id = ?");
  stmt.bind([fwId]);
  while (stmt.step()) {
    rows.push({ id: stmt.getAsObject().id as number });
  }
  stmt.free();

  return rows.map((r) => ({ id: r.id, path: getNodePath(r.id) }));
}
