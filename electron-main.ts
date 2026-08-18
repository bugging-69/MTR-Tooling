import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import { generatePowerShellScript, generateUpdateScript, generateInstallTeamsRoomsScript } from './src/data/powershellTemplates';

const MAX_EXEC_BUFFER = 1024 * 1024 * 100;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  ipcMain.handle('execute-operation', async (_event, operationId: string) => {
    if (os.platform() !== 'win32') {
      return {
        executed: false,
        success: false,
        exitCode: null,
        stdout: '[Electron] The operation was not executed.\n\nNote: Real Windows execution is available only on a Windows machine.',
        stderr: '',
      };
    }

    let scriptContent = '';
    try {
      switch (operationId) {
        case 'run-diagnostics':
          scriptContent = generatePowerShellScript({
            targetPingHost: '8.8.8.8',
            targetPingPort: 53,
            minimumDisplayCount: 1,
            minimumDiskSpaceGB: 20
          });
          break;
        case 'scan-repair-updates':
          scriptContent = generateUpdateScript();
          break;
        case 'install-mtr-update':
          scriptContent = generateInstallTeamsRoomsScript();
          break;
        default:
          return {
            executed: false,
            success: false,
            exitCode: 1,
            stdout: '',
            stderr: 'Unknown operationId'
          };
      }
    } catch (err: any) {
      return {
        executed: false,
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: `Failed to generate script: ${err.message}`
      };
    }

    const scriptPath = path.join(os.tmpdir(), `mtr-op-${randomUUID()}.ps1`);
    
    try {
      await writeFile(scriptPath, scriptContent, 'utf-8');
      
      return await new Promise((resolve) => {
        exec(`powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${scriptPath}"`, { maxBuffer: MAX_EXEC_BUFFER }, async (error, stdout, stderr) => {
          try { await unlink(scriptPath); } catch (e) { /* ignore */ }
          resolve({
            executed: true,
            success: !error,
            exitCode: error ? (error as any).code ?? 1 : 0,
            stdout: stdout || '',
            stderr: stderr || (error ? error.message : '')
          });
        });
      });
    } catch (err: any) {
      return {
        executed: false,
        success: false,
        exitCode: 1,
        stdout: '',
        stderr: err.message
      };
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
