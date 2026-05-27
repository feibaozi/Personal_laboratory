"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const constants_1 = require("./constants");
const api = {
    minimizeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_MINIMIZE),
    closeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_CLOSE),
    maximizeWindow: () => electron_1.ipcRenderer.send(constants_1.IPC.WINDOW_MAXIMIZE),
    dbPing: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_PING),
    dbGetFramework: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_FRAMEWORK),
    dbGetNode: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_NODE, id),
    dbInitFramework: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_INIT_FRAMEWORK),
    dbSubmitNote: (content, tags, source) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_SUBMIT_NOTE, content, tags, source),
    dbConfirmPlacement: (inboxId, nodeId, adjustments) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_CONFIRM_PLACEMENT, inboxId, nodeId, adjustments),
    dbAddNode: (parentId, title, content, nodeType, sourceRef) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_ADD_NODE, parentId, title, content, nodeType, sourceRef),
    dbUpdateNode: (id, updates) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_UPDATE_NODE, id, updates),
    dbDeleteNode: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_DELETE_NODE, id),
    dbMoveNode: (nodeId, newParentId) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_MOVE_NODE, nodeId, newParentId),
    dbSearch: (query, tagIds, sourceRef) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_SEARCH, query, tagIds, sourceRef),
    dbGetTags: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_TAGS),
    dbExportData: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_EXPORT_DATA),
    dbImportData: (data) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_IMPORT_DATA, data),
    dbGetFrameworks: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_FRAMEWORKS),
    dbCreateFramework: (name, description, icon) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_CREATE_FRAMEWORK, name, description, icon),
    dbDeleteFramework: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_DELETE_FRAMEWORK, id),
    dbRenameFramework: (id, name) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_RENAME_FRAMEWORK, id, name),
    dbSetCurrentFramework: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_SET_CURRENT_FRAMEWORK, id),
    dbGetCurrentFramework: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_CURRENT_FRAMEWORK),
    dbCreateSnapshot: (name, description) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_CREATE_SNAPSHOT, name, description),
    dbGetSnapshots: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_GET_SNAPSHOTS),
    dbRestoreSnapshot: (snapshotId) => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_RESTORE_SNAPSHOT, snapshotId),
    dbExportFrameworkMermaid: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_EXPORT_FRAMEWORK_MERMAID),
    dbExportFrameworkMarkdown: () => electron_1.ipcRenderer.invoke(constants_1.IPC.DB_EXPORT_FRAMEWORK_MARKDOWN),
    aiAnalyzeNote: (content) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_ANALYZE_NOTE, content),
    aiInspectFramework: () => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_INSPECT_FRAMEWORK),
    aiSummarizeConversation: (conversationText) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_SUMMARIZE_CONVERSATION, conversationText),
    aiSearch: (query) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_SEARCH, query),
    aiPracticeReminder: (projectDescription) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_PRACTICE_REMINDER, projectDescription),
    aiGenerateDomainFramework: (domainDescription) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_GENERATE_DOMAIN_FRAMEWORK, domainDescription),
    aiRefineFramework: (currentFramework, userFeedback) => electron_1.ipcRenderer.invoke(constants_1.IPC.AI_REFINE_FRAMEWORK, currentFramework, userFeedback),
    appGetConfig: (key) => electron_1.ipcRenderer.invoke(constants_1.IPC.APP_GET_CONFIG, key),
    appSetConfig: (key, value) => electron_1.ipcRenderer.invoke(constants_1.IPC.APP_SET_CONFIG, key, value),
    isElectron: true,
    onClipboardCapture: (callback) => {
        electron_1.ipcRenderer.on("clipboard:capture", (_, text) => callback(text));
    },
    removeClipboardCapture: () => {
        electron_1.ipcRenderer.removeAllListeners("clipboard:capture");
    },
    toggleClipboardWatch: (enabled) => electron_1.ipcRenderer.invoke("clipboard:toggle", enabled),
};
electron_1.contextBridge.exposeInMainWorld("electronAPI", api);
