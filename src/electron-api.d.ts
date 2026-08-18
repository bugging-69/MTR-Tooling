import type { ExecutionResult, OperationId } from './shared/operations';

declare global {
  interface Window {
    mtrOperations?: Readonly<{
      execute: (operationId: OperationId) => Promise<ExecutionResult>;
    }>;
  }
}

export {};
