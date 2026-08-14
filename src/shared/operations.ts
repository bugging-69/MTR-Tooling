export const operationIds = [
  'run-diagnostics',
  'scan-repair-updates',
  'install-mtr-update',
] as const;

export type OperationId = (typeof operationIds)[number];

export interface ExecutionResult {
  executed: boolean;
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export const parseOperationId = (value: unknown): OperationId | null =>
  typeof value === 'string'
    ? operationIds.find((operationId) => operationId === value) ?? null
    : null;
