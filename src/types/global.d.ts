// Global type declarations for the application

// Electron IPC types
declare global {
  interface Window {
    electronAPI: {
      selectDirectory?: () => Promise<string | null>;
      getUserHome?: () => Promise<string>;
      // Add other electron API methods here as needed
      [key: string]: any;
    };
  }
}

export {};
