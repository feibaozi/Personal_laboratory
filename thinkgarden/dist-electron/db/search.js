"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchNodes = searchNodes;
const database_1 = require("./database");
const nodes_1 = require("./nodes");
function searchNodes(query, tagIds, sourceRef) {
    const d = (0, database_1.getDatabase)();
    const fwId = (0, nodes_1.getCurrentFrameworkId)();
    const results = [];
    let sql = "SELECT * FROM framework_nodes WHERE framework_id = ?";
    const params = [fwId];
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
        const nodeId = row.id;
        const title = row.title;
        const content = row.content;
        const snippet = content.length > 100 ? content.substring(0, 100) + "..." : content;
        results.push({
            nodeId,
            title,
            summary: row.summary,
            nodeType: row.node_type,
            path: (0, nodes_1.getNodePath)(nodeId),
            snippet,
        });
    }
    stmt.free();
    return results;
}
