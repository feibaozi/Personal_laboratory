export {};

declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => void;
      closeWindow: () => void;
      maximizeWindow: () => void;

      dbPing: () => Promise<string>;
      dbGetFramework: () => Promise<any>;
      dbGetNode: (id: number) => Promise<any>;
      dbInitFramework: () => Promise<any>;
      dbSubmitNote: (content: string, tags?: string[], source?: string) => Promise<any>;
      dbConfirmPlacement: (inboxId: number, nodeId: number | null, adjustments?: any) => Promise<any>;
      dbAddNode: (parentId: number | null, title: string, content: string, nodeType: string, sourceRef?: string) => Promise<any>;
      dbUpdateNode: (id: number, updates: any) => Promise<any>;
      dbDeleteNode: (id: number) => Promise<any>;
      dbMoveNode: (nodeId: number, newParentId: number | null) => Promise<any>;
      dbSearch: (query: string, tagIds?: number[], sourceRef?: string) => Promise<any>;
      dbGetTags: () => Promise<any[]>;
      dbExportData: () => Promise<any>;
      dbImportData: (data: any) => Promise<any>;

      dbGetFrameworks: () => Promise<any[]>;
      dbCreateFramework: (name: string, description?: string, icon?: string) => Promise<number>;
      dbDeleteFramework: (id: number) => Promise<any>;
      dbRenameFramework: (id: number, name: string) => Promise<void>;
      dbSetCurrentFramework: (id: number) => Promise<boolean>;
      dbGetCurrentFramework: () => Promise<number>;

      dbCreateSnapshot: (name: string, description?: string) => Promise<number>;
      dbGetSnapshots: () => Promise<any[]>;
      dbRestoreSnapshot: (snapshotId: number) => Promise<boolean>;

      dbExportFrameworkMermaid: () => Promise<string>;
      dbExportFrameworkMarkdown: () => Promise<string>;

      aiAnalyzeNote: (content: string) => Promise<any>;
      aiInspectFramework: () => Promise<any>;
      aiSummarizeConversation: (conversationText: string) => Promise<any>;
      aiSearch: (query: string) => Promise<any>;
      aiPracticeReminder: (projectDescription: string) => Promise<any>;
      aiGenerateDomainFramework: (domainDescription: string) => Promise<any>;
      aiRefineFramework: (currentFramework: any, userFeedback: string) => Promise<any>;

      appGetConfig: (key: string) => Promise<string | null>;
      appSetConfig: (key: string, value: string) => Promise<void>;

      isElectron: boolean;

      onClipboardCapture: (callback: (text: string) => void) => void;
      removeClipboardCapture: () => void;
      toggleClipboardWatch: (enabled: boolean) => Promise<boolean>;
    };
  }
}
