import { getDatabase, saveDatabase } from "./database";
import { addNode, getNodePath, getAllNodePaths } from "./nodes";
import { setNodeTags } from "./tags";

export interface InboxNoteRow {
  id: number;
  content: string;
  status: string;
  ai_result: string | null;
  result_node_id: number | null;
  created_at: string;
}

export function submitNote(content: string, tags?: string[], source?: string): InboxNoteRow {
  const d = getDatabase();

  d.run(
    "INSERT INTO inbox_notes (content, status) VALUES (?, 'pending')",
    [content]
  );

  const idResult = d.prepare("SELECT last_insert_rowid() as id");
  idResult.step();
  const id = idResult.getAsObject().id as number;
  idResult.free();

  saveDatabase();

  return getInboxNote(id)!;
}

export function getInboxNote(id: number): InboxNoteRow | null {
  const d = getDatabase();
  const stmt = d.prepare("SELECT * FROM inbox_notes WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      id: row.id as number,
      content: row.content as string,
      status: row.status as string,
      ai_result: row.ai_result as string | null,
      result_node_id: row.result_node_id as number | null,
      created_at: row.created_at as string,
    };
  }
  stmt.free();
  return null;
}

export function getPendingNotes(): InboxNoteRow[] {
  const d = getDatabase();
  const notes: InboxNoteRow[] = [];
  const stmt = d.prepare("SELECT * FROM inbox_notes WHERE status = 'pending' ORDER BY created_at DESC");
  while (stmt.step()) {
    const row = stmt.getAsObject();
    notes.push({
      id: row.id as number,
      content: row.content as string,
      status: row.status as string,
      ai_result: row.ai_result as string | null,
      result_node_id: row.result_node_id as number | null,
      created_at: row.created_at as string,
    });
  }
  stmt.free();
  return notes;
}

export function updateInboxNote(id: number, updates: { status?: string; ai_result?: string; result_node_id?: number | null }): void {
  const d = getDatabase();
  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    setClauses.push("status = ?");
    values.push(updates.status);
  }
  if (updates.ai_result !== undefined) {
    setClauses.push("ai_result = ?");
    values.push(updates.ai_result);
  }
  if (updates.result_node_id !== undefined) {
    setClauses.push("result_node_id = ?");
    values.push(updates.result_node_id);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  d.run(`UPDATE inbox_notes SET ${setClauses.join(", ")} WHERE id = ?`, values);
  saveDatabase();
}

export function confirmPlacement(inboxId: number, nodeId: number | null, adjustments?: any): any {
  const d = getDatabase();
  const note = getInboxNote(inboxId);
  if (!note) return { error: "Note not found" };

  let aiResult: any = null;
  if (note.ai_result) {
    try {
      aiResult = JSON.parse(note.ai_result);
    } catch {
      aiResult = null;
    }
  }

  const targetParentId = nodeId || (aiResult?.targetNodeId as number) || null;
  const title = adjustments?.title || aiResult?.generatedTitle || note.content.substring(0, 50);
  const summary = adjustments?.summary || aiResult?.generatedSummary || null;
  const suggestedTags = adjustments?.tags || aiResult?.suggestedTags || [];

  const newNodeId = addNode(
    targetParentId,
    title,
    note.content,
    "user_note",
    undefined
  );

  if (summary) {
    d.run("UPDATE framework_nodes SET summary = ? WHERE id = ?", [summary, newNodeId]);
  }

  if (suggestedTags.length > 0) {
    setNodeTags(newNodeId, suggestedTags);
  }

  updateInboxNote(inboxId, { status: "confirmed", result_node_id: newNodeId });

  if (aiResult?.relatedSuggestions && adjustments?.acceptSuggestions) {
    for (const suggestion of aiResult.relatedSuggestions) {
      addNode(
        newNodeId,
        suggestion.title,
        suggestion.content || "",
        suggestion.nodeType || "tip"
      );
    }
  }

  saveDatabase();

  return {
    newNodeId,
    title,
    parentId: targetParentId,
  };
}

export function getFrameworkContextForAI(): string {
  const paths = getAllNodePaths();
  return paths
    .map((p) => `[${p.id}] ${p.path.join(" > ")}`)
    .join("\n");
}
