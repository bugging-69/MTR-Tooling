import { spawn } from 'node:child_process';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const TASKKILL_WAIT_MS = 5_000;

interface ProcessStream {
  on: (event: 'data', listener: (chunk: Buffer) => void) => unknown;
}

export interface SpawnedProcess {
  pid?: number;
  stdout: ProcessStream;
  stderr: ProcessStream;
  once: {
    (event: 'spawn', listener: () => void): unknown;
    (event: 'error', listener: (error: Error) => void): unknown;
    (event: 'close', listener: (exitCode: number | null) => void): unknown;
  };
  kill: () => boolean;
}

interface SpawnOptions {
  cwd: string;
  windowsHide: true;
  shell: false;
}

export interface ProcessRunnerDependencies {
  spawnProcess: (command: string, args: string[], options: SpawnOptions) => SpawnedProcess;
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (timer: unknown) => void;
}

export interface ProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputLimitExceeded: boolean;
}

const defaultDependencies: ProcessRunnerDependencies = {
  spawnProcess: (command, args, options) => spawn(command, args, options),
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (timer) => clearTimeout(timer as NodeJS.Timeout),
};

export const createProcessRunner = (
  timeoutMs: number,
  dependencies: ProcessRunnerDependencies = defaultDependencies,
) => (command: string, args: string[], workingDirectory = process.cwd()) =>
  new Promise<ProcessResult>((resolve, reject) => {
    const child = dependencies.spawnProcess(command, args, {
      cwd: workingDirectory,
      windowsHide: true,
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;
    let launched = false;
    let timedOut = false;
    let outputLimitExceeded = false;
    let terminating = false;
    let settled = false;
    let deadline: unknown;
    let taskkillDeadline: unknown;

    const clearDeadline = () => {
      if (deadline === undefined) return;
      dependencies.clearTimer(deadline);
      deadline = undefined;
    };

    const clearTaskkillDeadline = () => {
      if (taskkillDeadline === undefined) return;
      dependencies.clearTimer(taskkillDeadline);
      taskkillDeadline = undefined;
    };

    const output = () => ({
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    });

    const finish = (result: ProcessResult) => {
      if (settled) return;
      settled = true;
      clearDeadline();
      clearTaskkillDeadline();
      resolve(result);
    };

    const finishTermination = () => finish({
      exitCode: null,
      ...output(),
      timedOut,
      outputLimitExceeded,
    });

    const killOuterProcess = () => {
      try {
        child.kill();
      } catch {
        // Settlement must not depend on the last-resort kill being available.
      }
    };

    const terminateProcessTree = () => {
      if (settled || terminating) return;
      terminating = true;
      clearDeadline();

      if (child.pid === undefined) {
        killOuterProcess();
        finishTermination();
        return;
      }

      try {
        const taskkill = dependencies.spawnProcess(
          'taskkill.exe',
          ['/PID', String(child.pid), '/T', '/F'],
          { cwd: workingDirectory, windowsHide: true, shell: false },
        );
        let taskkillFinished = false;

        const finishTaskkill = (useFallback: boolean) => {
          if (taskkillFinished || settled) return;
          taskkillFinished = true;
          clearTaskkillDeadline();
          if (useFallback) killOuterProcess();
          finishTermination();
        };

        taskkill.once('error', () => finishTaskkill(true));
        taskkill.once('close', (exitCode) => finishTaskkill(exitCode !== 0));
        taskkillDeadline = dependencies.setTimer(() => {
          if (taskkillFinished || settled) return;
          taskkillFinished = true;
          clearTaskkillDeadline();
          try {
            taskkill.kill();
          } catch {
            // Continue to the outer-process fallback even if taskkill cannot be killed.
          }
          killOuterProcess();
          finishTermination();
        }, TASKKILL_WAIT_MS);
        if (taskkillFinished || settled) clearTaskkillDeadline();
      } catch {
        killOuterProcess();
        finishTermination();
      }
    };

    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      if (settled || terminating) return;

      const remainingBytes = MAX_OUTPUT_BYTES - outputBytes;
      if (chunk.length <= remainingBytes) {
        target.push(chunk);
        outputBytes += chunk.length;
        return;
      }

      if (remainingBytes > 0) {
        target.push(chunk.subarray(0, remainingBytes));
        outputBytes += remainingBytes;
      }
      outputLimitExceeded = true;
      terminateProcessTree();
    };

    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.once('spawn', () => {
      if (settled) return;
      launched = true;
      deadline = dependencies.setTimer(() => {
        if (settled || terminating) return;
        timedOut = true;
        terminateProcessTree();
      }, timeoutMs);
      if (settled || terminating) clearDeadline();
    });
    child.once('error', (error) => {
      if (terminating || settled) return;
      if (launched) {
        finish({
          exitCode: -1,
          ...output(),
          timedOut: false,
          outputLimitExceeded: false,
        });
        return;
      }
      settled = true;
      clearDeadline();
      clearTaskkillDeadline();
      reject(error);
    });
    child.once('close', (exitCode) => {
      if (!launched || settled || terminating) return;
      finish({
        exitCode: exitCode ?? -1,
        ...output(),
        timedOut: false,
        outputLimitExceeded: false,
      });
    });
  });
