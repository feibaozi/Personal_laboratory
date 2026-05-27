export interface ElectronAPI {
  minimizeWindow: () => void;
  closeWindow: () => void;
  isElectron: boolean;
  onAlertUpdate: (callback: (alert: unknown) => void) => () => void;
  getPythonStatus: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
