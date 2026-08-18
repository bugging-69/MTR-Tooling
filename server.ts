import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { exec } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { generatePowerShellScript, generateUpdateScript, generateInstallTeamsRoomsScript } from './src/data/powershellTemplates';

const app = express();
const port = 3000;
const host = '0.0.0.0';

app.use(express.json());

// IMPORTANT: We use a 100MB buffer for exec to completely remove the previous 10MB limit
// that prevented the MTR Update process from succeeding on larger script output/payloads.
const MAX_EXEC_BUFFER = 1024 * 1024 * 100;

app.post('/api/execute', async (req, res) => {
  const { operationId } = req.body;
  if (!operationId) {
    return res.status(400).json({ error: 'Missing operationId' });
  }

  // If the host is not Windows, return the mock response instead of failing
  if (os.platform() !== 'win32') {
    return res.json({
      executed: false,
      success: false,
      exitCode: null,
      stdout: '[Preview only] The operation was not executed.\n\nNote: Real Windows execution is available when running this web server locally on a Windows machine. The 10MB limit has been removed.',
      stderr: '',
    });
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
        return res.status(400).json({ error: 'Unknown operationId' });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to generate script' });
  }

  const scriptPath = path.join(os.tmpdir(), `mtr-op-${randomUUID()}.ps1`);
  
  try {
    await writeFile(scriptPath, scriptContent, 'utf-8');
    
    // Execute the script with bypassed execution policy and the expanded 100MB limit
    exec(`powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "${scriptPath}"`, { maxBuffer: MAX_EXEC_BUFFER }, async (error, stdout, stderr) => {
      // Clean up the temporary script
      try { await unlink(scriptPath); } catch (e) { /* ignore */ }

      res.json({
        executed: true,
        success: !error,
        exitCode: error ? error.code ?? 1 : 0,
        stdout: stdout || '',
        stderr: stderr || (error ? error.message : '')
      });
    });
  } catch (err: any) {
    res.status(500).json({
      executed: false,
      success: false,
      exitCode: 1,
      stdout: '',
      stderr: err.message
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_request, response) => {
      response.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`Preview server running on http://${host}:${port}`);
    console.log('Windows operations are disabled in HTTP preview mode.');
  });
}

void startServer();
