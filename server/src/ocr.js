import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { dbInstance, statements } from './db.js';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

const runtime = {
  enabled: (process.env.OCR_ENABLED || 'true').toLowerCase() === 'true',
  available: false,
  checking: false,
  processing: false,
  queue: [],
  queueSet: new Set(),
  lang: process.env.OCR_LANG || 'chi_sim+eng',
  lastError: ''
};

const normalizeText = (input) => {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]/g, '')
    .trim();
};

const nowIso = () => new Date().toISOString();

const detectTesseract = async () => {
  if (!runtime.enabled) {
    runtime.available = false;
    return false;
  }

  if (runtime.checking) return runtime.available;
  runtime.checking = true;

  try {
    await execFileAsync('tesseract', ['--version'], { timeout: 6000 });
    runtime.available = true;
    runtime.lastError = '';
  } catch (err) {
    runtime.available = false;
    runtime.lastError = err.message;
  } finally {
    runtime.checking = false;
  }

  return runtime.available;
};

const fetchCandidates = ({ force = false, limit = 100 } = {}) => {
  if (force) {
    return dbInstance.prepare(`
      SELECT id
      FROM maps
      WHERE source = 'local'
      ORDER BY mtime_ms DESC
      LIMIT @limit
    `).all({ limit });
  }

  return dbInstance.prepare(`
    SELECT id
    FROM maps
    WHERE source = 'local'
      AND (
        ocr_mtime_ms IS NULL
        OR ocr_mtime_ms != mtime_ms
        OR ocr_status IS NULL
        OR ocr_status = 'error'
      )
    ORDER BY mtime_ms DESC
    LIMIT @limit
  `).all({ limit });
};

const recognizeImageText = async (imagePath) => {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`image_missing:${imagePath}`);
  }

  const args = [imagePath, 'stdout', '-l', runtime.lang, '--psm', '6'];
  const { stdout } = await execFileAsync('tesseract', args, {
    maxBuffer: 12 * 1024 * 1024,
    timeout: 120000
  });

  return normalizeText(stdout);
};

const processQueue = async () => {
  if (runtime.processing) return;
  if (!runtime.available) return;

  runtime.processing = true;

  while (runtime.queue.length > 0) {
    const id = runtime.queue.shift();
    runtime.queueSet.delete(id);

    const row = statements.findById.get(id);
    if (!row || row.source !== 'local') {
      continue;
    }

    const tick = nowIso();
    statements.markOcrProcessing.run({
      id,
      ocr_updated_at: tick,
      updated_at: tick
    });

    try {
      const text = await recognizeImageText(row.file_path);
      const updateTime = nowIso();
      statements.updateOcrResult.run({
        id,
        ocr_text: text || null,
        ocr_status: text ? 'done' : 'empty',
        ocr_error: null,
        ocr_updated_at: updateTime,
        ocr_mtime_ms: row.mtime_ms ?? null,
        updated_at: updateTime
      });
    } catch (err) {
      const updateTime = nowIso();
      statements.updateOcrResult.run({
        id,
        ocr_text: null,
        ocr_status: 'error',
        ocr_error: String(err.message || err).slice(0, 800),
        ocr_updated_at: updateTime,
        ocr_mtime_ms: row.mtime_ms ?? null,
        updated_at: updateTime
      });
      logger.warn({ err, id, filePath: row.file_path }, 'OCR failed for map');
    }
  }

  runtime.processing = false;
};

const enqueue = (id) => {
  if (!id || runtime.queueSet.has(id)) return false;
  runtime.queue.push(id);
  runtime.queueSet.add(id);
  processQueue().catch((err) => {
    logger.error({ err }, 'OCR queue loop failed');
  });
  return true;
};

export const initOcrService = async () => {
  const available = await detectTesseract();
  if (!available) {
    logger.warn('OCR unavailable: tesseract not found, OCR search disabled');
    return;
  }

  queueOcrForCandidates({ force: false, limit: 80 });
};

export const queueOcrForCandidates = ({ force = false, limit = 100 } = {}) => {
  if (!runtime.enabled || !runtime.available) {
    return { queued: 0 };
  }

  const rows = fetchCandidates({ force, limit });
  let queued = 0;
  for (const row of rows) {
    if (enqueue(row.id)) queued += 1;
  }

  return { queued };
};

export const queueOcrForMapIds = (ids = []) => {
  if (!runtime.enabled || !runtime.available) {
    return { queued: 0 };
  }

  let queued = 0;
  for (const id of ids) {
    if (enqueue(id)) queued += 1;
  }
  return { queued };
};

export const getOcrStatus = () => ({
  enabled: runtime.enabled,
  available: runtime.available,
  processing: runtime.processing,
  queueSize: runtime.queue.length,
  lang: runtime.lang,
  lastError: runtime.lastError
});
