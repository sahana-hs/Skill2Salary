import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db';
import { createApp } from './server/app';
import { trainAndSaveSalaryModel } from './server/ml/salaryPipeline';

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  // Train/verify ML pipeline on startup so model artifact is always fresh
  const model = trainAndSaveSalaryModel();
  console.log(
    `[ML] Trained ${model.metrics.length} models on ${model.datasetStats.cleanedRows} cleaned rows. Best: ${model.bestModelName} (R2=${model.metrics.find((m) => m.isBest)?.r2})`
  );

  // Initialize SQLite database & seed sample data
  const db = initDatabase();
  const app = createApp(db);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Skill to Salary server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
