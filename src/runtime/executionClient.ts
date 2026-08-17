import type { ExecutionResult, OperationId } from '../shared/operations';

export const executeOperation = async (operationId: OperationId): Promise<ExecutionResult> => {
  if (!window.mtrOperations) {
    return {
      executed: false,
      success: false,
      exitCode: null,
      stdout: '[Preview only] The operation was not executed.',
      stderr: 'Real Windows execution is available only in the packaged Electron application.',
    };
  }

  return window.mtrOperations.execute(operationId);
};

export const executionFailureMessage = (result: ExecutionResult) => {
  if (result.success) return null;

  const status = result.exitCode === null
    ? 'Operation was not executed.'
    : `Operation failed with exit code ${result.exitCode}.`;
  return [status, result.stderr].filter(Boolean).join('\n');
};
