import type { ExecutionResult, OperationId } from '../shared/operations';

export const executeOperation = async (operationId: OperationId): Promise<ExecutionResult> => {
  // If we are in the packaged Electron container, use the legacy bridge (if it still exists in the user's environment)
  if (window.mtrOperations) {
    return window.mtrOperations.execute(operationId);
  }

  // Otherwise, use the updated Express backend that removes the 10MB limit
  try {
    const response = await fetch('/api/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operationId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server responded with an error');
    }

    return await response.json();
  } catch (error: any) {
    return {
      executed: false,
      success: false,
      exitCode: null,
      stdout: '',
      stderr: `Failed to connect to backend execution service: ${error.message}`
    };
  }
};

export const executionFailureMessage = (result: ExecutionResult) => {
  if (result.success) return null;

  const status = result.exitCode === null
    ? 'Operation was not executed.'
    : `Operation failed with exit code ${result.exitCode}.`;
  return [status, result.stderr].filter(Boolean).join('\n');
};
