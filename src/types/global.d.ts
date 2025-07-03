// Global type declarations for the application

// Electron IPC types
declare global {
  interface Window {
    electronAPI: {
      // Add your electron API types here
      [key: string]: any;
    };
  }
}

export {};
