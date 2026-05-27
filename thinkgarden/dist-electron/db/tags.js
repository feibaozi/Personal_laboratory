"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllTags = getAllTags;
exports.getOrCreateTag = getOrCreateTag;
exports.addTagToNode = addTagToNode;
exports.removeTagFromNode = removeTagFromNode;
exports.deleteTag = deleteTag;
exports.setNodeTags = setNodeTags;
const database_1 = require("./database");
function getAllTags() {
    const d = (0, database_1.getDatabase)();
    const tags = [];
    const stmt = d.prepare("SELECT * FROM tags ORDER BY name");
    while (stmt.step()) {
        const row = stmt.getAsObject();
        tags.push({
            id: row.id,
            name: row.name,
            color: row.color,
            created_at: row.created_at,
        });
    }
    stmt.free();
    return tags;
}
function getOrCreateTag(name, color) {
    const d = (0, database_1.getDatabase)();
    const existing = d.prepare("SELECT id FROM tags WHERE name = ?");
    existing.bind([name]);
    if (existing.step()) {
        const id = existing.getAsObject().id;
        existing.free();
        return id;
    }
    existing.free();
    d.run("INSERT INTO tags (name, color) VALUES (?, ?)", [name, color || null]);
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const id = idResult.getAsObject().id;
    idResult.free();
    (0, database_1.saveDatabase)();
    return id;
}
function addTagToNode(nodeId, tagId) {
    const d = (0, database_1.getDatabase)();
    d.run("INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)", [nodeId, tagId]);
    (0, database_1.saveDatabase)();
}
function removeTagFromNode(nodeId, tagId) {
    const d = (0, database_1.getDatabase)();
    d.run("DELETE FROM node_tags WHERE node_id = ? AND tag_id = ?", [nodeId, tagId]);
    (0, database_1.saveDatabase)();
}
function deleteTag(tagId) {
    const d = (0, database_1.getDatabase)();
    d.run("DELETE FROM node_tags WHERE tag_id = ?", [tagId]);
    d.run("DELETE FROM tags WHERE id = ?", [tagId]);
    (0, database_1.saveDatabase)();
}
function setNodeTags(nodeId, tagNames) {
    const d = (0, database_1.getDatabase)();
    d.run("DELETE FROM node_tags WHERE node_id = ?", [nodeId]);
    for (const name of tagNames) {
        const tagId = getOrCreateTag(name);
        d.run("INSERT OR IGNORE INTO node_tags (node_id, tag_id) VALUES (?, ?)", [nodeId, tagId]);
    }
    (0, database_1.saveDatabase)();
}
