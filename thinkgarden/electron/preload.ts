import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./constants";

const api = {
  minimizeWindow: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  closeWindow: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  maximizeWindow: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),

  dbPing: () => ipcRenderer.invoke(IPC.DB_PING),
  dbGetFramework: () => ipcRenderer.invoke(IPC.DB_GET_FRAMEWORK),
  dbGetNode: (id: number) => ipcRenderer.invoke(IPC.DB_GET_NODE, id),
  dbInitFramework: () => ipcRenderer.invoke(IPC.DB_INIT_FRAMEWORK),
  dbSubmitNote: (content: string, tags?: string[], source?: string) =>
    ipcRenderer.invoke(IPC.DB_SUBMIT_NOTE, content, tags, source),
  dbConfirmPlacement: (inboxId: number, nodeId: number | null, adjustments?: any) =>
    ipcRenderer.invoke(IPC.DB_CONFIRM_PLACEMENT, inboxId, nodeId, adjustments),
  dbAddNode: (parentId: number | null, title: string, content: string, nodeType: string, sourceRef?: string) =>
    ipcRenderer.invoke(IPC.DB_ADD_NODE, parentId, title, content, nodeType, sourceRef),
  dbUpdateNode: (id: number, updates: any) =>
    ipcRenderer.invoke(IPC.DB_UPDATE_NODE, id, updates),
  dbDeleteNode: (id: number) =>
    ipcRenderer.invoke(IPC.DB_DELETE_NODE, id),
  dbMoveNode: (nodeId: number, newParentId: number | null) =>
    ipcRenderer.invoke(IPC.DB_MOVE_NODE, nodeId, newParentId),
  dbSearch: (query: string, tagIds?: number[], sourceRef?: string) =>
    ipcRenderer.invoke(IPC.DB_SEARCH, query, tagIds, sourceRef),
  dbGetTags: () => ipcRenderer.invoke(IPC.DB_GET_TAGS),
  dbExportData: () => ipcRenderer.invoke(IPC.DB_EXPORT_DATA),
  dbImportData: (data: any) => ipcRenderer.invoke(IPC.DB_IMPORT_DATA, data),

  dbGetFrameworks: () => ipcRenderer.invoke(IPC.DB_GET_FRAMEWORKS),
  dbCreateFramework: (name: string, description?: string, icon?: string) =>
    ipcRenderer.invoke(IPC.DB_CREATE_FRAMEWORK, name, description, icon),
  dbDeleteFramework: (id: number) => ipcRenderer.invoke(IPC.DB_DELETE_FRAMEWORK, id),
  dbRenameFramework: (id: number, name: string) => ipcRenderer.invoke(IPC.DB_RENAME_FRAMEWORK, id, name),
  dbSetCurrentFramework: (id: number) => ipcRenderer.invoke(IPC.DB_SET_CURRENT_FRAMEWORK, id),
  dbGetCurrentFramework: () => ipcRenderer.invoke(IPC.DB_GET_CURRENT_FRAMEWORK),

  dbCreateSnapshot: (name: string, description?: string) =>
    ipcRenderer.invoke(IPC.DB_CREATE_SNAPSHOT, name, description),
  dbGetSnapshots: () => ipcRenderer.invoke(IPC.DB_GET_SNAPSHOTS),
  dbRestoreSnapshot: (snapshotId: number) => ipcRenderer.invoke(IPC.DB_RESTORE_SNAPSHOT, snapshotId),

  dbExportFrameworkMermaid: () => ipcRenderer.invoke(IPC.DB_EXPORT_FRAMEWORK_MERMAID),
  dbExportFrameworkMarkdown: () => ipcRenderer.invoke(IPC.DB_EXPORT_FRAMEWORK_MARKDOWN),

  aiAnalyzeNote: (content: string) =>
    ipcRenderer.invoke(IPC.AI_ANALYZE_NOTE, content),
  aiInspectFramework: () =>
    ipcRenderer.invoke(IPC.AI_INSPECT_FRAMEWORK),
  aiSummarizeConversation: (conversationText: string) =>
    ipcRenderer.invoke(IPC.AI_SUMMARIZE_CONVERSATION, conversationText),
  aiSearch: (query: string) =>
    ipcRenderer.invoke(IPC.AI_SEARCH, query),
  aiPracticeReminder: (projectDescription: string) =>
    ipcRenderer.invoke(IPC.AI_PRACTICE_REMINDER, projectDescription),
  aiGenerateDomainFramework: (domainDescription: string) =>
    ipcRenderer.invoke(IPC.AI_GENERATE_DOMAIN_FRAMEWORK, domainDescription),
  aiRefineFramework: (currentFramework: any, userFeedback: string) =>
    ipcRenderer.invoke(IPC.AI_REFINE_FRAMEWORK, currentFramework, userFeedback),

  appGetConfig: (key: string) => ipcRenderer.invoke(IPC.APP_GET_CONFIG, key),
  appSetConfig: (key: string, value: string) => ipcRenderer.invoke(IPC.APP_SET_CONFIG, key, value),

  isElectron: true,

  onClipboardCapture: (callback: (text: string) => void) => {
    ipcRenderer.on("clipboard:capture", (_: any, text: string) => callback(text));
  },
  removeClipboardCapture: () => {
    ipcRenderer.removeAllListeners("clipboard:capture");
  },
  toggleClipboardWatch: (enabled: boolean) =>
    ipcRenderer.invoke("clipboard:toggle", enabled),
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;
