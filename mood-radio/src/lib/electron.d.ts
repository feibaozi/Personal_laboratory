export {};

declare global {
  interface Window {
    electronAPI?: {
      minimizeWindow: () => void;
      closeWindow: () => void;
      toggleAlwaysOnTop: () => void;
      getIsAlwaysOnTop: () => Promise<boolean>;
      startDrag: () => void;
      updateWindowPosition: (deltaX: number, deltaY: number) => void;
      isElectron: boolean;
    };
  }
}