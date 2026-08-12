import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to execute scripts
app.post('/api/execute', (req, res) => {
  const { scriptContent, scriptType } = req.body;

  if (!scriptContent || !scriptType) {
    return res.status(400).json({ error: 'Missing scriptContent or scriptType' });
  }

  const isWindows = os.platform() === 'win32';
  
  if (!isWindows) {
    // Return a mock success response for the Linux container preview environment
    console.log(`[Preview Environment] Mocking execution of ${scriptType} script.`);
    return res.json({
      output: `[Simulated Output]\nThis app is running in a Linux container (AI Studio Preview).\nActual script execution is bypassed.\n\nScript Type: ${scriptType}\nScript Content Length: ${scriptContent.length} bytes.\n\nTo run this for real, install and start the app on a Windows machine.`,
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
      // Clean up temp file
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute script' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
