const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;
let serverApp;
let serverInstance;

function startExpressServer() {
  serverApp = express();
  serverApp.use(express.json());

  serverApp.post('/api/execute', (req, res) => {
    const { scriptContent, scriptType } = req.body;
    if (!scriptContent || !scriptType) {
      return res.status(400).json({ error: 'Missing scriptContent or scriptType' });
    }

    const isWindows = os.platform() === 'win32';
    if (!isWindows) {
      return res.json({
        output: `[Simulated Output]\nThis app is running in a non-Windows environment.\nActual script execution is bypassed.`,
        error: ''
      });
    }

    try {
      const tempDir = os.tmpdir();
      const ext = scriptType === 'powershell' ? '.ps1' : '.cmd';
      const filePath = path.join(tempDir, `script_${Date.now()}${ext}`);
      
      fs.writeFileSync(filePath, scriptContent, 'utf8');

      let command = '';
      if (scriptType === 'powershell') {
        command = `powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${filePath}"`;
      } else {
        command = `cmd.exe /c "${filePath}"`;
      }

      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupErr) {
          console.error('Failed to clean up temp script:', cleanupErr);
        }

        res.json({
          output: stdout,
          error: stderr || (error ? error.message : '')
        });
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Failed to execute script' });
    }
  });

  const distPath = path.join(__dirname, 'dist');
  serverApp.use(express.static(distPath));
  serverApp.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  return new Promise((resolve) => {
    // Find an available port or just use 3000
    serverInstance = serverApp.listen(3000, "127.0.0.1", () => {
      console.log('Express server running on http://127.0.0.1:3000');
      resolve();
    });
    serverInstance.on('error', (e) => {
      if (e.code === 'EADDRINUSE') {
        // Fallback to random port if 3000 is taken
        serverInstance = serverApp.listen(0, "127.0.0.1", () => {
          resolve();
        });
      }
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  await startExpressServer();
  const port = serverInstance.address().port;
  mainWindow.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverInstance) {
    serverInstance.close();
  }
});
