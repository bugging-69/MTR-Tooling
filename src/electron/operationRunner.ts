import path from 'node:path';
import type { ExecutionResult, OperationId } from '../shared/operations';
import { parseOperationId } from '../shared/operations';
import {
  generatePowerShellScript,
  generateUpdateScript,
} from '../data/powershellTemplates';

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface OperationRunnerDependencies {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  isElevated: () => Promise<boolean>;
  makeTempDirectory: (prefix: string) => Promise<string>;
  secureDirectory: (directory: string) => Promise<void>;
  writePrivateFile: (file: string, content: string) => Promise<void>;
  removeDirectory: (directory: string) => Promise<void>;
  runProcess: (command: string, args: string[], workingDirectory: string) => Promise<ProcessResult>;
}

interface OperationDefinition {
  requiresElevation: boolean;
  createScript: () => string;
}

const generateSecureMtrUpdateScript = () => `<#
.SYNOPSIS
    Runs the fixed official Microsoft Teams Rooms update.
#>
$ErrorActionPreference = "Stop"
$Url = "https://go.microsoft.com/fwlink/?linkid=2151817"
$TargetScript = Join-Path $PSScriptRoot "official-mtr-update.ps1"

try {
    Invoke-WebRequest -Uri $Url -OutFile $TargetScript -UseBasicParsing
    Unblock-File -Path $TargetScript
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Unrestricted -File $TargetScript
    if ($LASTEXITCODE -ne 0) {
        throw "Official MTR update failed with exit code $LASTEXITCODE."
    }
} finally {
    Remove-Item -LiteralPath $TargetScript -Force -ErrorAction SilentlyContinue
}
`;

const operations = {
  'run-diagnostics': {
    requiresElevation: true,
    createScript: () => generatePowerShellScript({
      minimumDiskSpaceGB: 15,
      minimumDisplayCount: 1,
      targetPingHost: 'teams.microsoft.com',
      targetPingPort: 443,
      requireIPv6: true,
      requireTPM: true,
      requireAzureAD: true,
      exportFormat: 'json_stdout',
      autoElevateAdmin: false,
      logToEventLog: false,
      webhookUrl: '',
    }),
  },
  'force-system-updates': {
    requiresElevation: true,
    createScript: generateUpdateScript,
  },
  'install-mtr-update': {
    requiresElevation: true,
    createScript: generateSecureMtrUpdateScript,
  },
} satisfies Record<OperationId, OperationDefinition>;

const notExecuted = (stdout: string, stderr: string, exitCode: number | null = null): ExecutionResult => ({
  executed: false,
  success: false,
  exitCode,
  stdout,
  stderr,
});

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const withElevationRequirement = (script: string) => {
  const withoutMalformedDirective = script.replace(/^#\s*Requires\s+-RunAsAdministrator\s*$/m, '');
  return `#Requires -RunAsAdministrator\n${withoutMalformedDirective.trimStart()}`;
};

export const createOperationRunner = (dependencies: OperationRunnerDependencies) =>
  async (requestedOperation: unknown): Promise<ExecutionResult> => {
    const operationId = parseOperationId(requestedOperation);
    if (!operationId) {
      return notExecuted('', 'Unknown operation. Only fixed operation IDs are accepted.');
    }

    if (!dependencies.isPackaged) {
      return notExecuted(
        '[Preview only] The operation was not executed.',
        'Real Windows execution is available only in the packaged Electron application.',
      );
    }

    if (dependencies.platform !== 'win32') {
      return notExecuted(
        '[Preview only] The operation was not executed.',
        'This fixed operation requires Windows and no command was started.',
      );
    }

    const operation = operations[operationId];
    if (operation.requiresElevation) {
      try {
        if (!await dependencies.isElevated()) {
          return notExecuted(
            '',
            'Administrator privileges are required for this operation. Restart the packaged application as Administrator.',
            740,
          );
        }
      } catch (error) {
        return notExecuted('', `Unable to evaluate Administrator privileges: ${errorMessage(error)}`);
      }
    }

    let workingDirectory: string | null = null;
    try {
      workingDirectory = await dependencies.makeTempDirectory('mtr-operation-');
      await dependencies.secureDirectory(workingDirectory);
      const scriptPath = path.join(workingDirectory, 'operation.ps1');
      await dependencies.writePrivateFile(scriptPath, withElevationRequirement(operation.createScript()));
      const processResult = await dependencies.runProcess(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
        workingDirectory,
      );

      return {
        executed: true,
        success: processResult.exitCode === 0,
        exitCode: processResult.exitCode,
        stdout: processResult.stdout,
        stderr: processResult.stderr,
      };
    } catch (error) {
      return {
        executed: false,
        success: false,
        exitCode: null,
        stdout: '',
        stderr: `Failed to start operation: ${errorMessage(error)}`,
      };
    } finally {
      if (workingDirectory) {
        try {
          await dependencies.removeDirectory(workingDirectory);
        } catch (error) {
          console.error('Failed to clean operation directory:', error);
        }
      }
    }
  };
