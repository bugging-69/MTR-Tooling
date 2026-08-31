import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(helmet());
const port = 3000;
const host = '127.0.0.1';

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
