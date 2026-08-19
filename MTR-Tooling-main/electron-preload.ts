import { contextBridge, ipcRenderer } from 'electron';
import type { ExecutionResult, OperationId } from './src/shared/operations';

const operationsApi = Object.freeze({
  execute: (operationId: OperationId) =>
    ipcRenderer.invoke('operations:execute', operationId) as Promise<ExecutionResult>,
});

contextBridge.exposeInMainWorld('mtrOperations', operationsApi);
