import { BrowserWindow } from "electron";
import { IPC } from "./constants";

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null
) {
  const { ipcMain } = require("electron");

  ipcMain.on(IPC.WINDOW_MINIMIZE, () => {
    const win = getWindow();
    if (win) win.minimize();
  });

  ipcMain.on(IPC.WINDOW_CLOSE, () => {
    const win = getWindow();
    if (win) win.close();
  });

  ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });

  ipcMain.handle(IPC.DB_PING, () => "pong");

  ipcMain.handle(IPC.DB_GET_FRAMEWORK, async () => {
    const { getFrameworkTree } = require("./db/nodes");
    return getFrameworkTree();
  });

  ipcMain.handle(IPC.DB_GET_NODE, async (_: any, id: number) => {
    const { getNode } = require("./db/nodes");
    return getNode(id);
  });

  ipcMain.handle(IPC.DB_INIT_FRAMEWORK, async () => {
    const { initFramework } = require("./db/nodes");
    return initFramework();
  });

  ipcMain.handle(IPC.DB_SUBMIT_NOTE, async (_: any, content: string, tags?: string[], source?: string) => {
    const { submitNote, updateInboxNote } = require("./db/notes");
    const note = submitNote(content, tags, source);
    try {
      const { analyzeNote } = require("./ai-service");
      const aiResult = await analyzeNote(content);
      updateInboxNote(note.id, { status: "analyzed", ai_result: JSON.stringify(aiResult), result_node_id: aiResult.targetNodeId });
      return { ...note, status: "analyzed", aiResult };
    } catch (err: any) {
      return { ...note, aiError: err.message };
    }
  });

  ipcMain.handle(IPC.DB_CONFIRM_PLACEMENT, async (_: any, inboxId: number, nodeId: number | null, adjustments?: any) => {
    const { confirmPlacement } = require("./db/notes");
    return confirmPlacement(inboxId, nodeId, adjustments);
  });

  ipcMain.handle(IPC.DB_ADD_NODE, async (_: any, parentId: number | null, title: string, content: string, nodeType: string, sourceRef?: string) => {
    const { addNode } = require("./db/nodes");
    return addNode(parentId, title, content, nodeType, sourceRef);
  });

  ipcMain.handle(IPC.DB_UPDATE_NODE, async (_: any, id: number, updates: any) => {
    const { updateNode } = require("./db/nodes");
    return updateNode(id, updates);
  });

  ipcMain.handle(IPC.DB_DELETE_NODE, async (_: any, id: number) => {
    const { deleteNode } = require("./db/nodes");
    return deleteNode(id);
  });

  ipcMain.handle(IPC.DB_MOVE_NODE, async (_: any, nodeId: number, newParentId: number | null) => {
    const { moveNode } = require("./db/nodes");
    return moveNode(nodeId, newParentId);
  });

  ipcMain.handle(IPC.DB_SEARCH, async (_: any, query: string, tagIds?: number[], sourceRef?: string) => {
    const { searchNodes } = require("./db/search");
    return searchNodes(query, tagIds, sourceRef);
  });

  ipcMain.handle(IPC.DB_GET_TAGS, async () => {
    const { getAllTags } = require("./db/tags");
    return getAllTags();
  });

  ipcMain.handle(IPC.DB_EXPORT_DATA, async () => {
    const { exportData } = require("./db/database");
    return exportData();
  });

  ipcMain.handle(IPC.DB_IMPORT_DATA, async (_: any, data: any) => {
    const { importData } = require("./db/database");
    return importData(data);
  });

  ipcMain.handle(IPC.DB_GET_FRAMEWORKS, async () => {
    const { getAllFrameworks } = require("./db/database");
    return getAllFrameworks();
  });

  ipcMain.handle(IPC.DB_CREATE_FRAMEWORK, async (_: any, name: string, description?: string, icon?: string) => {
    const { createFramework } = require("./db/database");
    return createFramework(name, description, icon);
  });

  ipcMain.handle(IPC.DB_DELETE_FRAMEWORK, async (_: any, id: number) => {
    const { deleteFramework } = require("./db/database");
    try { return deleteFramework(id); } catch (err: any) { return { error: err.message }; }
  });

  ipcMain.handle(IPC.DB_RENAME_FRAMEWORK, async (_: any, id: number, name: string) => {
    const { renameFramework } = require("./db/database");
    return renameFramework(id, name);
  });

  ipcMain.handle(IPC.DB_SET_CURRENT_FRAMEWORK, async (_: any, id: number) => {
    const { setCurrentFrameworkId } = require("./db/nodes");
    setCurrentFrameworkId(id);
    const { setConfig } = require("./db/database");
    setConfig("current_framework_id", String(id));
    return true;
  });

  ipcMain.handle(IPC.DB_GET_CURRENT_FRAMEWORK, async () => {
    const { getCurrentFrameworkId } = require("./db/nodes");
    return getCurrentFrameworkId();
  });

  ipcMain.handle(IPC.DB_CREATE_SNAPSHOT, async (_: any, name: string, description?: string) => {
    const { createSnapshot } = require("./db/snapshots");
    return createSnapshot(name, description);
  });

  ipcMain.handle(IPC.DB_GET_SNAPSHOTS, async () => {
    const { getSnapshots } = require("./db/snapshots");
    return getSnapshots();
  });

  ipcMain.handle(IPC.DB_RESTORE_SNAPSHOT, async (_: any, snapshotId: number) => {
    const { restoreSnapshot } = require("./db/snapshots");
    return restoreSnapshot(snapshotId);
  });

  ipcMain.handle(IPC.DB_EXPORT_FRAMEWORK_MERMAID, async () => {
    const { exportFrameworkMermaid } = require("./db/export");
    return exportFrameworkMermaid();
  });

  ipcMain.handle(IPC.DB_EXPORT_FRAMEWORK_MARKDOWN, async () => {
    const { exportFrameworkMarkdown } = require("./db/export");
    return exportFrameworkMarkdown();
  });

  ipcMain.handle(IPC.AI_ANALYZE_NOTE, async (_: any, content: string) => {
    const { analyzeNote } = require("./ai-service");
    return analyzeNote(content);
  });

  ipcMain.handle(IPC.AI_INSPECT_FRAMEWORK, async () => {
    const { inspectFramework } = require("./ai-service");
    return inspectFramework();
  });

  ipcMain.handle(IPC.AI_SUMMARIZE_CONVERSATION, async (_: any, conversationText: string) => {
    const { summarizeConversation } = require("./ai-service");
    return summarizeConversation(conversationText);
  });

  ipcMain.handle(IPC.AI_SEARCH, async (_: any, query: string) => {
    const { aiSearch } = require("./ai-service");
    return aiSearch(query);
  });

  ipcMain.handle(IPC.AI_PRACTICE_REMINDER, async (_: any, projectDescription: string) => {
    const { getPracticeReminder } = require("./ai-service");
    return getPracticeReminder(projectDescription);
  });

  ipcMain.handle(IPC.AI_GENERATE_DOMAIN_FRAMEWORK, async (_: any, domainDescription: string) => {
    const { generateDomainFramework } = require("./ai-service");
    return generateDomainFramework(domainDescription);
  });

  ipcMain.handle(IPC.AI_REFINE_FRAMEWORK, async (_: any, currentFramework: any, userFeedback: string) => {
    const { refineFramework } = require("./ai-service");
    return refineFramework(currentFramework, userFeedback);
  });

  ipcMain.handle(IPC.APP_GET_CONFIG, async (_: any, key: string) => {
    const { getConfig } = require("./db/database");
    return getConfig(key);
  });

  ipcMain.handle(IPC.APP_SET_CONFIG, async (_: any, key: string, value: string) => {
    const { setConfig } = require("./db/database");
    return setConfig(key, value);
  });
}
