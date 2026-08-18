import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('mtrOperations', {
  execute: (operationId: string) => ipcRenderer.invoke('execute-operation', operationId),
});
