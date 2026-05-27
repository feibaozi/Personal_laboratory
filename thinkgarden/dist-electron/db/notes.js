"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitNote = submitNote;
exports.getInboxNote = getInboxNote;
exports.getPendingNotes = getPendingNotes;
exports.updateInboxNote = updateInboxNote;
exports.confirmPlacement = confirmPlacement;
exports.getFrameworkContextForAI = getFrameworkContextForAI;
const database_1 = require("./database");
const nodes_1 = require("./nodes");
const tags_1 = require("./tags");
function submitNote(content, tags, source) {
    const d = (0, database_1.getDatabase)();
    d.run("INSERT INTO inbox_notes (content, status) VALUES (?, 'pending')", [content]);
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const id = idResult.getAsObject().id;
    idResult.free();
    (0, database_1.saveDatabase)();
    return getInboxNote(id);
}
function getInboxNote(id) {
    const d = (0, database_1.getDatabase)();
    const stmt = d.prepare("SELECT * FROM inbox_notes WHERE id = ?");
    stmt.bind([id]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return {
            id: row.id,
            content: row.content,
            status: row.status,
            ai_result: row.ai_result,
            result_node_id: row.result_node_id,
            created_at: row.created_at,
        };
    }
    stmt.free();
    return null;
}
function getPendingNotes() {
    const d = (0, database_1.getDatabase)();
    const notes = [];
    const stmt = d.prepare("SELECT * FROM inbox_notes WHERE status = 'pending' ORDER BY created_at DESC");
    while (stmt.step()) {
        const row = stmt.getAsObject();
        notes.push({
            id: row.id,
            content: row.content,
            status: row.status,
            ai_result: row.ai_result,
            result_node_id: row.result_node_id,
            created_at: row.created_at,
        });
    }
    stmt.free();
    return notes;
}
function updateInboxNote(id, updates) {
    const d = (0, database_1.getDatabase)();
    const setClauses = [];
    const values = [];
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
    if (setClauses.length === 0)
        return;
    values.push(id);
    d.run(`UPDATE inbox_notes SET ${setClauses.join(", ")} WHERE id = ?`, values);
    (0, database_1.saveDatabase)();
}
function confirmPlacement(inboxId, nodeId, adjustments) {
    const d = (0, database_1.getDatabase)();
    const note = getInboxNote(inboxId);
    if (!note)
        return { error: "Note not found" };
    let aiResult = null;
    if (note.ai_result) {
        try {
            aiResult = JSON.parse(note.ai_result);
        }
        catch {
            aiResult = null;
        }
    }
    const targetParentId = nodeId || aiResult?.targetNodeId || null;
    const title = adjustments?.title || aiResult?.generatedTitle || note.content.substring(0, 50);
    const summary = adjustments?.summary || aiResult?.generatedSummary || null;
    const suggestedTags = adjustments?.tags || aiResult?.suggestedTags || [];
    const newNodeId = (0, nodes_1.addNode)(targetParentId, title, note.content, "user_note", undefined);
    if (summary) {
        d.run("UPDATE framework_nodes SET summary = ? WHERE id = ?", [summary, newNodeId]);
    }
    if (suggestedTags.length > 0) {
        (0, tags_1.setNodeTags)(newNodeId, suggestedTags);
    }
    updateInboxNote(inboxId, { status: "confirmed", result_node_id: newNodeId });
    if (aiResult?.relatedSuggestions && adjustments?.acceptSuggestions) {
        for (const suggestion of aiResult.relatedSuggestions) {
            (0, nodes_1.addNode)(newNodeId, suggestion.title, suggestion.content || "", suggestion.nodeType || "tip");
        }
    }
    (0, database_1.saveDatabase)();
    return {
        newNodeId,
        title,
        parentId: targetParentId,
    };
}
function getFrameworkContextForAI() {
    const paths = (0, nodes_1.getAllNodePaths)();
    return paths
        .map((p) => `[${p.id}] ${p.path.join(" > ")}`)
        .join("\n");
}
