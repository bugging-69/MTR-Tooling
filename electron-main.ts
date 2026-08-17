import { spawn } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { createOperationRunner } from './src/electron/operationRunner';
import { isAllowedExternalUrl, secureWebPreferences } from './src/electron/windowSecurity';

const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

const runProcess = (command: string, args: string[], workingDirectory = process.cwd()) =>
  new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workingDirectory,
      windowsHide: true,
      shell: false,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let outputBytes = 0;

    const collect = (target: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        reject(new Error('Operation output exceeded the 10 MB limit.'));
        return;
      }
      target.push(chunk);
    };

    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.once('error', reject);
    child.once('close', (exitCode) => resolve({
      exitCode: exitCode ?? -1,
      stdout: Buffer.concat(stdout).toString('utf8'),
      stderr: Buffer.concat(stderr).toString('utf8'),
    }));
  });

const isElevated = async () => {
  const result = await runProcess('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
  ]);
  return result.exitCode === 0 && result.stdout.trim().toLowerCase() === 'true';
};

const runOperation = createOperationRunner({
  isPackaged: app.isPackaged,
  platform: process.platform,
  isElevated,
  makeTempDirectory: (prefix) => mkdtemp(path.join(tmpdir(), prefix)),
  secureDirectory: (directory) => chmod(directory, 0o700),
  writePrivateFile: (file, content) => writeFile(file, content, { encoding: 'utf8', mode: 0o600, flag: 'wx' }),
  removeDirectory: (directory) => rm(directory, { recursive: true, force: true }),
  runProcess,
});

const openAllowedExternalUrl = async (url: string) => {
  if (isAllowedExternalUrl(url)) await shell.openExternal(url);
};

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      ...secureWebPreferences,
      preload: path.join(__dirname, 'electron-preload.cjs'),
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void openAllowedExternalUrl(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      void openAllowedExternalUrl(url);
    }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  void window.loadFile(path.join(__dirname, 'index.html'));
};

ipcMain.handle('operations:execute', (_event, operationId: unknown) => runOperation(operationId));

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
