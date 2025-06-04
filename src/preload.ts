import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),

  // Directory functions
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getCurrentDirectory: () => ipcRenderer.invoke('get-current-directory'),

  // File explorer functions
  getFileTree: (options: {
    path?: string;
    maxDepth?: number;
    showHidden?: boolean;
    excludePatterns?: string[];
  } = {}) => ipcRenderer.invoke('get-file-tree', options),
  getFileContent: (filePath: string) => ipcRenderer.invoke('get-file-content', filePath),

  onThinking: (callback: (isThinking: boolean) => void) => {
    ipcRenderer.on('thinking', (_, isThinking) => callback(isThinking));
    return () => {
      ipcRenderer.removeAllListeners('thinking');
    };
  },

  onAssistantMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('assistant-message', (_, message) => callback(message));
    return () => {
      ipcRenderer.removeAllListeners('assistant-message');
    };
  },

  onToolExecutionStart: (callback: (data: any) => void) => {
    ipcRenderer.on('tool-execution-start', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('tool-execution-start');
    };
  },

  onToolExecutionResult: (callback: (data: any) => void) => {
    ipcRenderer.on('tool-execution-result', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('tool-execution-result');
    };
  },

  onToolExecutionError: (callback: (data: any) => void) => {
    ipcRenderer.on('tool-execution-error', (_, data) => callback(data));
    return () => {
      ipcRenderer.removeAllListeners('tool-execution-error');
    };
  },

  onDirectoryChanged: (callback: (directory: string) => void) => {
    ipcRenderer.on('directory-changed', (_, directory) => callback(directory));
    return () => {
      ipcRenderer.removeAllListeners('directory-changed');
    };
  },

  onRepeatCommand: (callback: (command: string) => void) => {
    ipcRenderer.on('repeat-command', (_, command) => callback(command));
    return () => {
      ipcRenderer.removeAllListeners('repeat-command');
    };
  }
});