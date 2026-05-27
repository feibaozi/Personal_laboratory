"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const constants_1 = require("./constants");
function registerIpcHandlers(getWindow) {
    const { ipcMain } = require("electron");
    ipcMain.on(constants_1.IPC.WINDOW_MINIMIZE, () => {
        const win = getWindow();
        if (win)
            win.minimize();
    });
    ipcMain.on(constants_1.IPC.WINDOW_CLOSE, () => {
        const win = getWindow();
        if (win)
            win.close();
    });
    ipcMain.on(constants_1.IPC.WINDOW_MAXIMIZE, () => {
        const win = getWindow();
        if (!win)
            return;
        if (win.isMaximized()) {
            win.unmaximize();
        }
        else {
            win.maximize();
        }
    });
    ipcMain.handle(constants_1.IPC.DB_PING, () => "pong");
    ipcMain.handle(constants_1.IPC.DB_GET_FRAMEWORK, async () => {
        const { getFrameworkTree } = require("./db/nodes");
        return getFrameworkTree();
    });
    ipcMain.handle(constants_1.IPC.DB_GET_NODE, async (_, id) => {
        const { getNode } = require("./db/nodes");
        return getNode(id);
    });
    ipcMain.handle(constants_1.IPC.DB_INIT_FRAMEWORK, async () => {
        const { initFramework } = require("./db/nodes");
        return initFramework();
    });
    ipcMain.handle(constants_1.IPC.DB_SUBMIT_NOTE, async (_, content, tags, source) => {
        const { submitNote, updateInboxNote } = require("./db/notes");
        const note = submitNote(content, tags, source);
        try {
            const { analyzeNote } = require("./ai-service");
            const aiResult = await analyzeNote(content);
            updateInboxNote(note.id, { status: "analyzed", ai_result: JSON.stringify(aiResult), result_node_id: aiResult.targetNodeId });
            return { ...note, status: "analyzed", aiResult };
        }
        catch (err) {
            return { ...note, aiError: err.message };
        }
    });
    ipcMain.handle(constants_1.IPC.DB_CONFIRM_PLACEMENT, async (_, inboxId, nodeId, adjustments) => {
        const { confirmPlacement } = require("./db/notes");
        return confirmPlacement(inboxId, nodeId, adjustments);
    });
    ipcMain.handle(constants_1.IPC.DB_ADD_NODE, async (_, parentId, title, content, nodeType, sourceRef) => {
        const { addNode } = require("./db/nodes");
        return addNode(parentId, title, content, nodeType, sourceRef);
    });
    ipcMain.handle(constants_1.IPC.DB_UPDATE_NODE, async (_, id, updates) => {
        const { updateNode } = require("./db/nodes");
        return updateNode(id, updates);
    });
    ipcMain.handle(constants_1.IPC.DB_DELETE_NODE, async (_, id) => {
        const { deleteNode } = require("./db/nodes");
        return deleteNode(id);
    });
    ipcMain.handle(constants_1.IPC.DB_MOVE_NODE, async (_, nodeId, newParentId) => {
        const { moveNode } = require("./db/nodes");
        return moveNode(nodeId, newParentId);
    });
    ipcMain.handle(constants_1.IPC.DB_SEARCH, async (_, query, tagIds, sourceRef) => {
        const { searchNodes } = require("./db/search");
        return searchNodes(query, tagIds, sourceRef);
    });
    ipcMain.handle(constants_1.IPC.DB_GET_TAGS, async () => {
        const { getAllTags } = require("./db/tags");
        return getAllTags();
    });
    ipcMain.handle(constants_1.IPC.DB_EXPORT_DATA, async () => {
        const { exportData } = require("./db/database");
        return exportData();
    });
    ipcMain.handle(constants_1.IPC.DB_IMPORT_DATA, async (_, data) => {
        const { importData } = require("./db/database");
        return importData(data);
    });
    ipcMain.handle(constants_1.IPC.DB_GET_FRAMEWORKS, async () => {
        const { getAllFrameworks } = require("./db/database");
        return getAllFrameworks();
    });
    ipcMain.handle(constants_1.IPC.DB_CREATE_FRAMEWORK, async (_, name, description, icon) => {
        const { createFramework } = require("./db/database");
        return createFramework(name, description, icon);
    });
    ipcMain.handle(constants_1.IPC.DB_DELETE_FRAMEWORK, async (_, id) => {
        const { deleteFramework } = require("./db/database");
        try {
            return deleteFramework(id);
        }
        catch (err) {
            return { error: err.message };
        }
    });
    ipcMain.handle(constants_1.IPC.DB_RENAME_FRAMEWORK, async (_, id, name) => {
        const { renameFramework } = require("./db/database");
        return renameFramework(id, name);
    });
    ipcMain.handle(constants_1.IPC.DB_SET_CURRENT_FRAMEWORK, async (_, id) => {
        const { setCurrentFrameworkId } = require("./db/nodes");
        setCurrentFrameworkId(id);
        const { setConfig } = require("./db/database");
        setConfig("current_framework_id", String(id));
        return true;
    });
    ipcMain.handle(constants_1.IPC.DB_GET_CURRENT_FRAMEWORK, async () => {
        const { getCurrentFrameworkId } = require("./db/nodes");
        return getCurrentFrameworkId();
    });
    ipcMain.handle(constants_1.IPC.DB_CREATE_SNAPSHOT, async (_, name, description) => {
        const { createSnapshot } = require("./db/snapshots");
        return createSnapshot(name, description);
    });
    ipcMain.handle(constants_1.IPC.DB_GET_SNAPSHOTS, async () => {
        const { getSnapshots } = require("./db/snapshots");
        return getSnapshots();
    });
    ipcMain.handle(constants_1.IPC.DB_RESTORE_SNAPSHOT, async (_, snapshotId) => {
        const { restoreSnapshot } = require("./db/snapshots");
        return restoreSnapshot(snapshotId);
    });
    ipcMain.handle(constants_1.IPC.DB_EXPORT_FRAMEWORK_MERMAID, async () => {
        const { exportFrameworkMermaid } = require("./db/export");
        return exportFrameworkMermaid();
    });
    ipcMain.handle(constants_1.IPC.DB_EXPORT_FRAMEWORK_MARKDOWN, async () => {
        const { exportFrameworkMarkdown } = require("./db/export");
        return exportFrameworkMarkdown();
    });
    ipcMain.handle(constants_1.IPC.AI_ANALYZE_NOTE, async (_, content) => {
        const { analyzeNote } = require("./ai-service");
        return analyzeNote(content);
    });
    ipcMain.handle(constants_1.IPC.AI_INSPECT_FRAMEWORK, async () => {
        const { inspectFramework } = require("./ai-service");
        return inspectFramework();
    });
    ipcMain.handle(constants_1.IPC.AI_SUMMARIZE_CONVERSATION, async (_, conversationText) => {
        const { summarizeConversation } = require("./ai-service");
        return summarizeConversation(conversationText);
    });
    ipcMain.handle(constants_1.IPC.AI_SEARCH, async (_, query) => {
        const { aiSearch } = require("./ai-service");
        return aiSearch(query);
    });
    ipcMain.handle(constants_1.IPC.AI_PRACTICE_REMINDER, async (_, projectDescription) => {
        const { getPracticeReminder } = require("./ai-service");
        return getPracticeReminder(projectDescription);
    });
    ipcMain.handle(constants_1.IPC.AI_GENERATE_DOMAIN_FRAMEWORK, async (_, domainDescription) => {
        const { generateDomainFramework } = require("./ai-service");
        return generateDomainFramework(domainDescription);
    });
    ipcMain.handle(constants_1.IPC.AI_REFINE_FRAMEWORK, async (_, currentFramework, userFeedback) => {
        const { refineFramework } = require("./ai-service");
        return refineFramework(currentFramework, userFeedback);
    });
    ipcMain.handle(constants_1.IPC.APP_GET_CONFIG, async (_, key) => {
        const { getConfig } = require("./db/database");
        return getConfig(key);
    });
    ipcMain.handle(constants_1.IPC.APP_SET_CONFIG, async (_, key, value) => {
        const { setConfig } = require("./db/database");
        return setConfig(key, value);
    });
}
