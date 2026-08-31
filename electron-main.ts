import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { createOperationRunner } from './src/electron/operationRunner';
import { createProcessRunner } from './src/electron/processRunner';
import { isAllowedExternalUrl, secureWebPreferences } from './src/electron/windowSecurity';

const OPERATION_TIMEOUT_MS = 30 * 60 * 1_000;
const runProcess = createProcessRunner(OPERATION_TIMEOUT_MS);

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
  makeTempDirectory: async (prefix) => {
    const base = path.resolve(tmpdir());
    const target = await mkdtemp(path.join(base, prefix));
    const targetResolved = path.resolve(base, target);
    const relative = path.relative(base, targetResolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid directory path');
    }
    return targetResolved;
  },
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
