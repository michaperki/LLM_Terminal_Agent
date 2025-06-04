import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  
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
  }
});