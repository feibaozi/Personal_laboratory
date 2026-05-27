"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getDatabase = getDatabase;
exports.saveDatabase = saveDatabase;
exports.getConfig = getConfig;
exports.setConfig = setConfig;
exports.getAllFrameworks = getAllFrameworks;
exports.createFramework = createFramework;
exports.deleteFramework = deleteFramework;
exports.renameFramework = renameFramework;
exports.exportData = exportData;
exports.importData = importData;
const sql_js_1 = __importDefault(require("sql.js"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
let db = null;
let dbPath = "";
const SQL_INIT = `
CREATE TABLE IF NOT EXISTS frameworks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT DEFAULT '⚡',
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS framework_nodes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id  INTEGER NOT NULL DEFAULT 1 REFERENCES frameworks(id) ON DELETE CASCADE,
  parent_id     INTEGER REFERENCES framework_nodes(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT '',
  summary       TEXT,
  node_type     TEXT NOT NULL DEFAULT 'step'
                  CHECK(node_type IN ('category','step','principle','tip','warning','user_note')),
  source_type   TEXT NOT NULL DEFAULT 'ai'
                  CHECK(source_type IN ('ai','user','ai_suggested')),
  source_ref    TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  icon          TEXT,
  color         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS node_tags (
  node_id INTEGER NOT NULL REFERENCES framework_nodes(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (node_id, tag_id)
);

CREATE TABLE IF NOT EXISTS inbox_notes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id   INTEGER NOT NULL DEFAULT 1 REFERENCES frameworks(id) ON DELETE CASCADE,
  content        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK(status IN ('pending','analyzed','confirmed','rejected')),
  ai_result      TEXT,
  result_node_id INTEGER REFERENCES framework_nodes(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  framework_id INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  data         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_nodes_framework ON framework_nodes(framework_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent    ON framework_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_type      ON framework_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_source    ON framework_nodes(source_type);
CREATE INDEX IF NOT EXISTS idx_nodes_sort      ON framework_nodes(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_nodes_created   ON framework_nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_inbox_status    ON inbox_notes(status);
CREATE INDEX IF NOT EXISTS idx_inbox_framework ON inbox_notes(framework_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_fw    ON snapshots(framework_id);
`;
function runMigrations(d) {
    const tableCheck = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='frameworks'");
    const hasFrameworksTable = tableCheck.step();
    tableCheck.free();
    if (!hasFrameworksTable) {
        d.run(`CREATE TABLE frameworks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      icon        TEXT DEFAULT '⚡',
      is_default  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )`);
        d.run("INSERT INTO frameworks (name, description, icon, is_default) VALUES ('默认框架', 'AI 驱动的知识框架', '🌱', 1)");
        const colCheck = d.prepare("PRAGMA table_info(framework_nodes)");
        const columns = [];
        while (colCheck.step()) {
            const row = colCheck.getAsObject();
            columns.push(row.name);
        }
        colCheck.free();
        if (!columns.includes("framework_id")) {
            d.run("ALTER TABLE framework_nodes ADD COLUMN framework_id INTEGER NOT NULL DEFAULT 1 REFERENCES frameworks(id) ON DELETE CASCADE");
            d.run("CREATE INDEX IF NOT EXISTS idx_nodes_framework ON framework_nodes(framework_id)");
        }
        const inboxColCheck = d.prepare("PRAGMA table_info(inbox_notes)");
        const inboxColumns = [];
        while (inboxColCheck.step()) {
            const row = inboxColCheck.getAsObject();
            inboxColumns.push(row.name);
        }
        inboxColCheck.free();
        if (!inboxColumns.includes("framework_id")) {
            d.run("ALTER TABLE inbox_notes ADD COLUMN framework_id INTEGER NOT NULL DEFAULT 1 REFERENCES frameworks(id) ON DELETE CASCADE");
            d.run("CREATE INDEX IF NOT EXISTS idx_inbox_framework ON inbox_notes(framework_id)");
        }
        const snapCheck = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='snapshots'");
        const hasSnapshots = snapCheck.step();
        snapCheck.free();
        if (!hasSnapshots) {
            d.run(`CREATE TABLE snapshots (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        framework_id INTEGER NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        description  TEXT,
        data         TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      )`);
            d.run("CREATE INDEX IF NOT EXISTS idx_snapshots_fw ON snapshots(framework_id)");
        }
        saveDatabase();
    }
}
async function initDatabase() {
    if (db)
        return db;
    const userDataPath = electron_1.app.getPath("userData");
    dbPath = path_1.default.join(userDataPath, "thinkgarden.db");
    const wasmPath = path_1.default.join(__dirname, "../../node_modules/sql.js/dist/sql-wasm.wasm");
    const SQL = await (0, sql_js_1.default)({
        locateFile: () => wasmPath,
    });
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
        runMigrations(db);
    }
    else {
        db = new SQL.Database();
        db.run(SQL_INIT);
        saveDatabase();
    }
    return db;
}
function getDatabase() {
    if (!db)
        throw new Error("Database not initialized. Call initDatabase() first.");
    return db;
}
function saveDatabase() {
    if (!db || !dbPath)
        return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs_1.default.writeFileSync(dbPath, buffer);
}
function getConfig(key) {
    const d = getDatabase();
    const stmt = d.prepare("SELECT value FROM app_config WHERE key = ?");
    stmt.bind([key]);
    if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row.value;
    }
    stmt.free();
    return null;
}
function setConfig(key, value) {
    const d = getDatabase();
    d.run("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)", [key, value]);
    saveDatabase();
}
function getAllFrameworks() {
    const d = getDatabase();
    const results = [];
    const stmt = d.prepare("SELECT * FROM frameworks ORDER BY is_default DESC, created_at ASC");
    while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push({
            id: row.id,
            name: row.name,
            description: row.description,
            icon: row.icon,
            isDefault: row.is_default,
            createdAt: row.created_at,
        });
    }
    stmt.free();
    return results;
}
function createFramework(name, description, icon) {
    const d = getDatabase();
    d.run("INSERT INTO frameworks (name, description, icon) VALUES (?, ?, ?)", [name, description || null, icon || "⚡"]);
    const idResult = d.prepare("SELECT last_insert_rowid() as id");
    idResult.step();
    const id = idResult.getAsObject().id;
    idResult.free();
    saveDatabase();
    return id;
}
function deleteFramework(id) {
    const d = getDatabase();
    const defaultCheck = d.prepare("SELECT is_default FROM frameworks WHERE id = ?");
    defaultCheck.bind([id]);
    if (defaultCheck.step()) {
        const isDefault = defaultCheck.getAsObject().is_default;
        defaultCheck.free();
        if (isDefault)
            throw new Error("不能删除默认框架");
    }
    else {
        defaultCheck.free();
        return;
    }
    d.run("DELETE FROM node_tags WHERE node_id IN (SELECT id FROM framework_nodes WHERE framework_id = ?)", [id]);
    d.run("DELETE FROM framework_nodes WHERE framework_id = ?", [id]);
    d.run("DELETE FROM inbox_notes WHERE framework_id = ?", [id]);
    d.run("DELETE FROM snapshots WHERE framework_id = ?", [id]);
    d.run("DELETE FROM frameworks WHERE id = ?", [id]);
    saveDatabase();
}
function renameFramework(id, name) {
    const d = getDatabase();
    d.run("UPDATE frameworks SET name = ?, updated_at = datetime('now','localtime') WHERE id = ?", [name, id]);
    saveDatabase();
}
function exportData() {
    const d = getDatabase();
    const frameworks = [];
    const fwStmt = d.prepare("SELECT * FROM frameworks ORDER BY id");
    while (fwStmt.step()) {
        frameworks.push(fwStmt.getAsObject());
    }
    fwStmt.free();
    const nodes = [];
    const nodeStmt = d.prepare("SELECT * FROM framework_nodes ORDER BY id");
    while (nodeStmt.step()) {
        nodes.push(nodeStmt.getAsObject());
    }
    nodeStmt.free();
    const tags = [];
    const tagStmt = d.prepare("SELECT * FROM tags ORDER BY id");
    while (tagStmt.step()) {
        tags.push(tagStmt.getAsObject());
    }
    tagStmt.free();
    const nodeTags = [];
    const ntStmt = d.prepare("SELECT * FROM node_tags");
    while (ntStmt.step()) {
        nodeTags.push(ntStmt.getAsObject());
    }
    ntStmt.free();
    const inbox = [];
    const inboxStmt = d.prepare("SELECT * FROM inbox_notes ORDER BY id");
    while (inboxStmt.step()) {
        inbox.push(inboxStmt.getAsObject());
    }
    inboxStmt.free();
    const snapshots = [];
    const snapStmt = d.prepare("SELECT * FROM snapshots ORDER BY id");
    while (snapStmt.step()) {
        snapshots.push(snapStmt.getAsObject());
    }
    snapStmt.free();
    const config = [];
    const configStmt = d.prepare("SELECT * FROM app_config");
    while (configStmt.step()) {
        config.push(configStmt.getAsObject());
    }
    configStmt.free();
    return { frameworks, nodes, tags, nodeTags, inbox, snapshots, config, exportedAt: new Date().toISOString() };
}
function importData(data) {
    const d = getDatabase();
    d.run("DELETE FROM node_tags");
    d.run("DELETE FROM snapshots");
    d.run("DELETE FROM inbox_notes");
    d.run("DELETE FROM framework_nodes");
    d.run("DELETE FROM frameworks");
    d.run("DELETE FROM tags");
    d.run("DELETE FROM app_config");
    if (data.frameworks) {
        const stmt = d.prepare("INSERT INTO frameworks (id, name, description, icon, is_default, created_at, updated_at) VALUES (?,?,?,?,?,?,?)");
        for (const f of data.frameworks) {
            stmt.run([f.id, f.name, f.description, f.icon, f.is_default, f.created_at, f.updated_at]);
        }
        stmt.free();
    }
    if (data.tags) {
        const stmt = d.prepare("INSERT INTO tags (id, name, color, created_at) VALUES (?,?,?,?)");
        for (const t of data.tags) {
            stmt.run([t.id, t.name, t.color, t.created_at]);
        }
        stmt.free();
    }
    if (data.nodes) {
        const stmt = d.prepare("INSERT INTO framework_nodes (id, framework_id, parent_id, title, content, summary, node_type, source_type, source_ref, sort_order, icon, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
        for (const n of data.nodes) {
            stmt.run([n.id, n.framework_id || 1, n.parent_id, n.title, n.content, n.summary, n.node_type, n.source_type, n.source_ref, n.sort_order, n.icon, n.color, n.created_at, n.updated_at]);
        }
        stmt.free();
    }
    if (data.nodeTags) {
        const stmt = d.prepare("INSERT INTO node_tags (node_id, tag_id) VALUES (?,?)");
        for (const nt of data.nodeTags) {
            stmt.run([nt.node_id, nt.tag_id]);
        }
        stmt.free();
    }
    if (data.inbox) {
        const stmt = d.prepare("INSERT INTO inbox_notes (id, framework_id, content, status, ai_result, result_node_id, created_at) VALUES (?,?,?,?,?,?,?)");
        for (const i of data.inbox) {
            stmt.run([i.id, i.framework_id || 1, i.content, i.status, i.ai_result, i.result_node_id, i.created_at]);
        }
        stmt.free();
    }
    if (data.snapshots) {
        const stmt = d.prepare("INSERT INTO snapshots (id, framework_id, name, description, data, created_at) VALUES (?,?,?,?,?,?)");
        for (const s of data.snapshots) {
            stmt.run([s.id, s.framework_id, s.name, s.description, s.data, s.created_at]);
        }
        stmt.free();
    }
    if (data.config) {
        const stmt = d.prepare("INSERT INTO app_config (key, value) VALUES (?,?)");
        for (const c of data.config) {
            stmt.run([c.key, c.value]);
        }
        stmt.free();
    }
    saveDatabase();
}
