import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseOperationId } from '../src/shared/operations';
import { createOperationRunner, type OperationRunnerDependencies } from '../src/electron/operationRunner';
import { isAllowedExternalUrl, secureWebPreferences } from '../src/electron/windowSecurity';
import { executionFailureMessage } from '../src/runtime/executionClient';

const createDependencies = (overrides: Partial<OperationRunnerDependencies> = {}): OperationRunnerDependencies => ({
  isPackaged: true,
  platform: 'win32',
  isElevated: async () => true,
  makeTempDirectory: async () => 'C:\\private\\mtr-operation-random',
  secureDirectory: async () => undefined,
  writePrivateFile: async () => undefined,
  removeDirectory: async () => undefined,
  runProcess: async () => ({ exitCode: 0, stdout: 'done', stderr: '', timedOut: false, outputLimitExceeded: false }),
  ...overrides,
});

test('only fixed operation IDs cross the execution boundary', () => {
  assert.equal(parseOperationId('run-diagnostics'), 'run-diagnostics');
  assert.equal(parseOperationId('scan-repair-updates'), 'scan-repair-updates');
  assert.equal(parseOperationId('force-system-updates'), null);
  assert.equal(parseOperationId('install-mtr-update'), 'install-mtr-update');
  assert.equal(parseOperationId('powershell'), null);
  assert.equal(parseOperationId({ scriptContent: 'whoami', scriptType: 'powershell' }), null);
});

test('real execution is unavailable outside packaged Electron', async () => {
  let processRuns = 0;
  const runner = createOperationRunner(createDependencies({
    isPackaged: false,
    runProcess: async () => {
      processRuns += 1;
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, outputLimitExceeded: false };
    },
  }));

  const result = await runner('run-diagnostics');

  assert.equal(result.executed, false);
  assert.equal(result.success, false);
  assert.equal(result.exitCode, null);
  assert.match(result.stdout, /preview/i);
  assert.equal(processRuns, 0);
});

test('non-Windows packaged environments return an honest preview', async () => {
  const runner = createOperationRunner(createDependencies({ platform: 'linux' }));
  const result = await runner('run-diagnostics');

  assert.deepEqual(
    { executed: result.executed, success: result.success, exitCode: result.exitCode },
    { executed: false, success: false, exitCode: null },
  );
  assert.match(result.stderr, /Windows/i);
});

test('elevation is evaluated for every privileged operation request', async () => {
  let elevationChecks = 0;
  let processRuns = 0;
  const runner = createOperationRunner(createDependencies({
    isElevated: async () => {
      elevationChecks += 1;
      return false;
    },
    runProcess: async () => {
      processRuns += 1;
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, outputLimitExceeded: false };
    },
  }));

  const first = await runner('run-diagnostics');
  const second = await runner('scan-repair-updates');

  assert.equal(elevationChecks, 2);
  assert.equal(processRuns, 0);
  assert.equal(first.exitCode, 740);
  assert.equal(second.exitCode, 740);
});

test('elevation evaluation errors return a structured failure', async () => {
  const runner = createOperationRunner(createDependencies({
    isElevated: async () => {
      throw new Error('elevation probe failed');
    },
  }));

  const result = await runner('run-diagnostics');

  assert.deepEqual(
    { executed: result.executed, success: result.success, exitCode: result.exitCode },
    { executed: false, success: false, exitCode: null },
  );
  assert.match(result.stderr, /elevation probe failed/);
});

test('execution uses a private unique temp directory and always cleans it', async () => {
  const events: string[] = [];
  const runner = createOperationRunner(createDependencies({
    makeTempDirectory: async (prefix) => {
      events.push(`make:${prefix}`);
      return 'C:\\private\\mtr-operation-4f0c';
    },
    secureDirectory: async (directory) => {
      events.push(`secure:${directory}`);
    },
    writePrivateFile: async (file, content) => {
      assert.match(content, /^#Requires -RunAsAdministrator/m);
      events.push(`write:${file}`);
    },
    runProcess: async (_command, args) => {
      assert.deepEqual(args.slice(0, 5), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File']);
      events.push('run');
      return { exitCode: 9, stdout: 'partial output', stderr: 'operation failed', timedOut: false, outputLimitExceeded: false };
    },
    removeDirectory: async (directory) => {
      events.push(`remove:${directory}`);
    },
  }));

  const result = await runner('run-diagnostics');

  assert.equal(result.success, false);
  assert.equal(result.exitCode, 9);
  assert.equal(result.stdout, 'partial output');
  assert.equal(result.stderr, 'operation failed');
  assert.match(events[0], /^make:mtr-operation-/);
  assert.deepEqual(events.slice(-2), ['run', 'remove:C:\\private\\mtr-operation-4f0c']);
});

test('the fixed scan and repair operation exits non-zero when a step fails', async () => {
  let script = '';
  const runner = createOperationRunner(createDependencies({
    writePrivateFile: async (_file, content) => {
      script = content;
    },
  }));

  await runner('scan-repair-updates');

  assert.match(script, /\$OperationFailed = \$true/);
  assert.match(script, /if \(\$OperationFailed\) \{ exit 1 \}/);
});

test('the fixed MTR update uses only its private working directory', async () => {
  let script = '';
  const runner = createOperationRunner(createDependencies({
    writePrivateFile: async (_file, content) => {
      script = content;
    },
  }));

  await runner('install-mtr-update');

  assert.match(script, /\$PSScriptRoot/);
  assert.match(script, /finally/);
  assert.doesNotMatch(script, /Downloads|Get-ChildItem/);
});

test('temp directories are cleaned when process launch fails', async () => {
  let cleaned = false;
  const runner = createOperationRunner(createDependencies({
    runProcess: async () => {
      throw new Error('spawn failed');
    },
    removeDirectory: async () => {
      cleaned = true;
    },
  }));

  const result = await runner('install-mtr-update');

  assert.equal(result.success, false);
  assert.match(result.stderr, /spawn failed/);
  assert.equal(cleaned, true);
});

test('operation timeouts remain executed, preserve output, report the deadline, and clean up', async () => {
  let cleaned = false;
  const runner = createOperationRunner(createDependencies({
    runProcess: async () => ({
      exitCode: null,
      stdout: 'updater progress',
      stderr: 'last updater warning',
      timedOut: true,
      outputLimitExceeded: false,
    }),
    removeDirectory: async () => {
      cleaned = true;
    },
  }));

  const result = await runner('install-mtr-update');
  const message = executionFailureMessage(result);

  assert.equal(result.executed, true);
  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.exitCode, null);
  assert.equal(result.stdout, 'updater progress');
  assert.equal(result.stderr, 'last updater warning');
  assert.match(message ?? '', /timed out after 30 minutes/i);
  assert.match(message ?? '', /termination was requested/i);
  assert.doesNotMatch(message ?? '', /tree was terminated/i);
  assert.match(message ?? '', /last updater warning/i);
  assert.equal(cleaned, true);
});

test('output-limit failures remain executed and preserve process output', async () => {
  const runner = createOperationRunner(createDependencies({
    runProcess: async () => ({
      exitCode: null,
      stdout: 'bounded stdout',
      stderr: 'bounded stderr',
      timedOut: false,
      outputLimitExceeded: true,
    }),
  }));

  const result = await runner('install-mtr-update');
  const message = executionFailureMessage(result);

  assert.equal(result.executed, true);
  assert.equal(result.success, false);
  assert.equal(result.outputLimitExceeded, true);
  assert.equal(result.stdout, 'bounded stdout');
  assert.equal(result.stderr, 'bounded stderr');
  assert.match(message ?? '', /output exceeded the 10 MB limit/i);
  assert.doesNotMatch(message ?? '', /not executed/i);
});

test('window defaults isolate the renderer and deny unsafe external URLs', () => {
  assert.deepEqual(secureWebPreferences, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  assert.equal(isAllowedExternalUrl('https://go.microsoft.com/fwlink/?linkid=2151817'), true);
  assert.equal(isAllowedExternalUrl('http://go.microsoft.com/fwlink/?linkid=2151817'), false);
  assert.equal(isAllowedExternalUrl('https://go.microsoft.com.evil.example/'), false);
  assert.equal(isAllowedExternalUrl('https://example.com/'), false);
  assert.equal(isAllowedExternalUrl('file:///C:/Windows/System32/cmd.exe'), false);
});

test('non-zero execution failures remain visible even when stdout exists', () => {
  const message = executionFailureMessage({
    executed: true,
    success: false,
    timedOut: false,
    outputLimitExceeded: false,
    exitCode: 5,
    stdout: 'partial useful output',
    stderr: 'access denied',
  });

  assert.match(message ?? '', /exit code 5/i);
  assert.match(message ?? '', /access denied/i);
});

test('advanced tools are presented as visibility, not authentication', async () => {
  const header = await readFile(new URL('../src/components/Header.tsx', import.meta.url), 'utf8');
  assert.match(header, /Advanced tools/);
  assert.match(header, /not authentication/);
  assert.doesNotMatch(header, /Admin Login|Admin Mode|Lock Session/);
});

test('CMD launcher and EXE compiler are absent from runnable UI and templates', async () => {
  const [diagnostics, templates] = await Promise.all([
    readFile(new URL('../src/components/SystemDiagnostics.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/data/powershellTemplates.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(diagnostics, /Run CMD Launcher|Compile Standalone EXE/);
  assert.doesNotMatch(templates, /generateBatchLauncher|generateExeCompilerScript/);
});

test('preload exposes only the fixed operation bridge and child windows are denied', async () => {
  const [preload, electronMain] = await Promise.all([
    readFile(new URL('../electron-preload.ts', import.meta.url), 'utf8'),
    readFile(new URL('../electron-main.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(preload, /node:fs|node:child_process/);
  assert.match(preload, /exposeInMainWorld\('mtrOperations'/);
  assert.match(electronMain, /setWindowOpenHandler/);
  assert.match(electronMain, /action:\s*'deny'/);
  assert.match(electronMain, /will-attach-webview/);
});

test('standalone server has no execution route and binds to loopback', async () => {
  const [server, viteConfig] = await Promise.all([
    readFile(new URL('../server.ts', import.meta.url), 'utf8'),
    readFile(new URL('../vite.config.ts', import.meta.url), 'utf8'),
  ]);
  assert.doesNotMatch(server, /api\/execute|child_process|powershell\.exe|cmd\.exe/i);
  assert.match(server, /127\.0\.0\.1/);
  assert.match(viteConfig, /host:\s*['"]127\.0\.0\.1['"]/);
  assert.match(viteConfig, /preview:/);
});
