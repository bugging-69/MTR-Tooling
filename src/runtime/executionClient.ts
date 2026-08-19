import type { ExecutionResult, OperationId } from '../shared/operations';

export const executeOperation = async (operationId: OperationId): Promise<ExecutionResult> => {
  if (!window.mtrOperations) {
    return {
      executed: false,
      success: false,
      timedOut: false,
      outputLimitExceeded: false,
      exitCode: null,
      stdout: '[Preview only] The operation was not executed.',
      stderr: 'Real Windows execution is available only in the packaged Electron application.',
    };
  }

  return window.mtrOperations.execute(operationId);
};

export const executionFailureMessage = (result: ExecutionResult) => {
  if (result.success) return null;

  const status = result.outputLimitExceeded
    ? 'Operation stopped because its output exceeded the 10 MB limit. Process-tree termination was requested.'
    : result.timedOut
      ? 'Operation timed out after 30 minutes. Process-tree termination was requested.'
      : result.exitCode === null
        ? result.executed ? 'Operation failed after it started.' : 'Operation was not executed.'
        : `Operation failed with exit code ${result.exitCode}.`;
  return [status, result.stderr].filter(Boolean).join('\n');
};
