"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSnapshot = createSnapshot;
exports.getSnapshots = getSnapshots;
exports.restoreSnapshot = restoreSnapshot;
const database_1 = require("./database");
const nodes_1 = require("./nodes");
function createSnapshot(name, description) {
    const d = (0, database_1.getDatabase)();
    const fwId = (0, nodes_1.getCurrentFrameworkId)();
    const tree = (0, nodes_1.getFrameworkTree)(fwId);
    const data = JSON.stringify(tree);
    d.run("INSERT INTO snapshots (framework_id, name, description, data) VALUES (?, ?, ?, ?)", [fwId, name, description || null, data]);
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const id = idResult.getAsObject().id;
    idResult.free();
    (0, database_1.saveDatabase)();
    return id;
}
function getSnapshots(frameworkId) {
    const d = (0, database_1.getDatabase)();
    const fwId = frameworkId || (0, nodes_1.getCurrentFrameworkId)();
    const results = [];
    const stmt = d.prepare("SELECT id, name, description, created_at FROM snapshots WHERE framework_id = ? ORDER BY created_at DESC");
    stmt.bind([fwId]);
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.created_at,
        });
    }
    stmt.free();
    return results;
}
function restoreSnapshot(snapshotId) {
    const d = (0, database_1.getDatabase)();
    const stmt = d.prepare("SELECT data, framework_id FROM snapshots WHERE id = ?");
    stmt.bind([snapshotId]);
    if (!stmt.step()) {
        stmt.free();
        return false;
    }
    const data = stmt.getAsObject().data;
    const fwId = stmt.getAsObject().framework_id;
    stmt.free();
    d.run("DELETE FROM node_tags WHERE node_id IN (SELECT id FROM framework_nodes WHERE framework_id = ?)", [fwId]);
    d.run("DELETE FROM framework_nodes WHERE framework_id = ?", [fwId]);
    const tree = JSON.parse(data);
    function insertNode(node, parentId) {
        d.run("INSERT INTO framework_nodes (framework_id, parent_id, title, content, summary, node_type, source_type, source_ref, sort_order, icon, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [fwId, parentId, node.title, node.content || "", node.summary || null, node.node_type, node.source_type, node.source_ref || null, node.sort_order || 0, node.icon || null, node.color || null, node.created_at || new Date().toISOString(), node.updated_at || new Date().toISOString()]);
        const idResult = d.prepare("SELECT last_insert_rowid() as id");
        idResult.step();
        const newId = idResult.getAsObject().id;
        idResult.free();
        if (node.children) {
            for (const child of node.children) {
                insertNode(child, newId);
            }
        }
    }
    insertNode(tree, null);
    (0, database_1.saveDatabase)();
    return true;
}
