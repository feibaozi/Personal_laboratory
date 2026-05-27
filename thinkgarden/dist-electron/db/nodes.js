"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCurrentFrameworkId = setCurrentFrameworkId;
exports.getCurrentFrameworkId = getCurrentFrameworkId;
exports.getFrameworkTree = getFrameworkTree;
exports.getNode = getNode;
exports.addNode = addNode;
exports.updateNode = updateNode;
exports.deleteNode = deleteNode;
exports.moveNode = moveNode;
exports.initFramework = initFramework;
exports.getNodePath = getNodePath;
exports.getAllNodePaths = getAllNodePaths;
const database_1 = require("./database");
let currentFrameworkId = 1;
function setCurrentFrameworkId(id) {
    currentFrameworkId = id;
}
function getCurrentFrameworkId() {
    return currentFrameworkId;
}
function rowToNode(row) {
    return {
        id: row.id,
        framework_id: row.framework_id || currentFrameworkId,
        parent_id: row.parent_id,
        title: row.title,
        content: row.content,
        summary: row.summary,
        node_type: row.node_type,
        source_type: row.source_type,
        source_ref: row.source_ref,
        sort_order: row.sort_order,
        icon: row.icon,
        color: row.color,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
function buildTree(rows, parentId) {
    return rows
        .filter((r) => r.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((r) => ({
        ...r,
        children: buildTree(rows, r.id),
        tags: getNodeTags(r.id),
    }));
}
function getNodeTags(nodeId) {
    const d = (0, database_1.getDatabase)();
    const stmt = d.prepare("SELECT t.id, t.name, t.color FROM tags t JOIN node_tags nt ON t.id = nt.tag_id WHERE nt.node_id = ?");
    stmt.bind([nodeId]);
    const tags = [];
    while (stmt.step()) {
        const row = stmt.getAsObject();
        tags.push({ id: row.id, name: row.name, color: row.color });
    }
    stmt.free();
    return tags;
}
function getFrameworkTree(frameworkId) {
    const fwId = frameworkId || currentFrameworkId;
    const d = (0, database_1.getDatabase)();
    const rows = [];
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
function getNode(id) {
    const d = (0, database_1.getDatabase)();
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
function addNode(parentId, title, content, nodeType, sourceRef, frameworkId) {
    const fwId = frameworkId || currentFrameworkId;
    const d = (0, database_1.getDatabase)();
    let sortOrder = 0;
    if (parentId !== null) {
        const stmt = d.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM framework_nodes WHERE parent_id = ? AND framework_id = ?");
        stmt.bind([parentId, fwId]);
        if (stmt.step()) {
            sortOrder = stmt.getAsObject().next_order || 0;
        }
        stmt.free();
    }
    d.run("INSERT INTO framework_nodes (framework_id, parent_id, title, content, node_type, source_type, source_ref, sort_order) VALUES (?, ?, ?, ?, ?, 'user', ?, ?)", [fwId, parentId, title, content, nodeType, sourceRef || null, sortOrder]);
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const id = idResult.getAsObject().id;
    idResult.free();
    (0, database_1.saveDatabase)();
    return id;
}
function updateNode(id, updates) {
    const d = (0, database_1.getDatabase)();
    const allowedFields = ["title", "content", "summary", "node_type", "source_type", "source_ref", "sort_order", "icon", "color", "parent_id"];
    const setClauses = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }
    }
    if (setClauses.length === 0)
        return false;
    setClauses.push("updated_at = datetime('now','localtime')");
    values.push(id);
    d.run(`UPDATE framework_nodes SET ${setClauses.join(", ")} WHERE id = ?`, values);
    (0, database_1.saveDatabase)();
    return true;
}
function deleteNode(id) {
    const d = (0, database_1.getDatabase)();
    function collectDescendants(nodeId) {
        const ids = [nodeId];
        const stmt = d.prepare("SELECT id FROM framework_nodes WHERE parent_id = ?");
        stmt.bind([nodeId]);
        while (stmt.step()) {
            const childId = stmt.getAsObject().id;
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
    (0, database_1.saveDatabase)();
    return true;
}
function moveNode(nodeId, newParentId) {
    const d = (0, database_1.getDatabase)();
    let sortOrder = 0;
    if (newParentId !== null) {
        const stmt = d.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM framework_nodes WHERE parent_id = ?");
        stmt.bind([newParentId]);
        if (stmt.step()) {
            sortOrder = stmt.getAsObject().next_order || 0;
        }
        stmt.free();
    }
    d.run("UPDATE framework_nodes SET parent_id = ?, sort_order = ?, updated_at = datetime('now','localtime') WHERE id = ?", [newParentId, sortOrder, nodeId]);
    (0, database_1.saveDatabase)();
    return true;
}
function initFramework(frameworkId) {
    const fwId = frameworkId || currentFrameworkId;
    const d = (0, database_1.getDatabase)();
    d.run("DELETE FROM node_tags WHERE node_id IN (SELECT id FROM framework_nodes WHERE framework_id = ?)", [fwId]);
    d.run("DELETE FROM framework_nodes WHERE framework_id = ?", [fwId]);
    const rootId = addNode(null, "默认框架", "", "category", undefined, fwId);
    const categories = [
        { title: "基础入门", nodeType: "category", children: [
                { title: "了解核心概念", nodeType: "step" },
                { title: "搭建学习环境", nodeType: "step" },
                { title: "完成第一个实践", nodeType: "principle" },
            ] },
        { title: "知识积累", nodeType: "category", children: [
                { title: "关键知识点梳理", nodeType: "step" },
                { title: "常见误区与纠正", nodeType: "warning" },
                { title: "学习资源整理", nodeType: "step" },
            ] },
        { title: "实践应用", nodeType: "category", children: [
                { title: "动手项目记录", nodeType: "step" },
                { title: "踩坑经验总结", nodeType: "warning" },
                { title: "实用技巧收集", nodeType: "tip" },
            ] },
        { title: "反思与优化", nodeType: "category", children: [
                { title: "定期复盘心得", nodeType: "principle" },
                { title: "方法改进记录", nodeType: "step" },
                { title: "最佳实践提炼", nodeType: "principle" },
            ] },
    ];
    function insertCategoryItems(parentId, items) {
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
function getNodePath(nodeId) {
    const d = (0, database_1.getDatabase)();
    const path = [];
    let currentId = nodeId;
    while (currentId !== null) {
        const stmt = d.prepare("SELECT id, parent_id, title FROM framework_nodes WHERE id = ?");
        stmt.bind([currentId]);
        if (stmt.step()) {
            const row = stmt.getAsObject();
            path.unshift(row.title);
            currentId = row.parent_id;
        }
        else {
            stmt.free();
            break;
        }
        stmt.free();
    }
    return path;
}
function getAllNodePaths(frameworkId) {
    const fwId = frameworkId || currentFrameworkId;
    const d = (0, database_1.getDatabase)();
    const rows = [];
    const stmt = d.prepare("SELECT id FROM framework_nodes WHERE framework_id = ?");
    stmt.bind([fwId]);
    while (stmt.step()) {
        rows.push({ id: stmt.getAsObject().id });
    }
    stmt.free();
    return rows.map((r) => ({ id: r.id, path: getNodePath(r.id) }));
}
