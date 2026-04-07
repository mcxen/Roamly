import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { config, assertConfig } from './config.js';
import { logger } from './logger.js';
import apiRoutes from './routes.js';
import { scanLibrary } from './library.js';
import { startWatcher } from './watcher.js';
import { getMapLibraryDir, getStorageDriver, getWebdavSettings } from './runtime-settings.js';
import { initOcrService, queueOcrForCandidates } from './ocr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRoutes);

if (process.env.NODE_ENV === 'production') {
  const distDir = config.webDistDir;
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    logger.warn({ distDir }, '未找到前端构建产物');
  }
}

const start = async () => {
  const status = assertConfig();
  if (!status.ok && status.message) {
    logger.warn(status.message);
  }

  const mapLibraryDir = getMapLibraryDir();
  const storageDriver = getStorageDriver();
  const webdavSettings = getWebdavSettings(true);
  const shouldScan = storageDriver === 'webdav'
    ? Boolean(webdavSettings.url)
    : Boolean(mapLibraryDir);

  if (!shouldScan) {
    logger.warn('尚未配置有效存储目录，可在网页端设置后再扫描。');
  } else {
    try {
      await scanLibrary();
      logger.info('完成初次扫描');
      queueOcrForCandidates({ force: false, limit: 120 });
    } catch (err) {
      logger.error({ err }, '初次扫描失败');
    }
  }

  if (config.watchLibrary && storageDriver === 'local') {
    startWatcher();
  }

  app.listen(config.port, () => {
    logger.info(`Roamly API running on :${config.port}`);
  });

  await initOcrService();
};

start();
