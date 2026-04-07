import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { logger } from './logger.js';

const CACHE_DIR = path.resolve(config.dataDir, 'image-cache');
const pending = new Map();
let sharpPromise = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const ensureCacheDir = async () => {
  if (!fs.existsSync(CACHE_DIR)) {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
  }
};

const getSharp = async () => {
  if (!sharpPromise) {
    sharpPromise = import('sharp')
      .then((mod) => mod.default || mod)
      .catch((err) => {
        logger.warn({ err }, 'sharp unavailable, image optimization disabled');
        return null;
      });
  }
  return sharpPromise;
};

const safeNumber = (value, fallback) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

const isSupportedLocalImage = (row) => {
  if (!row || row.source !== 'local') return false;
  const mime = String(row.mime || '').toLowerCase();
  if (!mime.startsWith('image/')) return false;
  if (mime === 'image/gif' || mime === 'image/svg+xml') return false;
  return true;
};

const buildVariantKey = (row, opts) => {
  const max = clamp(safeNumber(opts.max, 2600), 600, 7000);
  const quality = clamp(safeNumber(opts.quality, 82), 45, 95);
  const mtime = Math.max(0, Math.floor(safeNumber(row.mtime_ms, 0)));
  return `${row.id}-m${mtime}-w${max}-q${quality}`;
};

const buildVariantPath = (key) => path.resolve(CACHE_DIR, `${key}.jpg`);

const renderVariant = async (row, opts) => {
  const sharp = await getSharp();
  if (!sharp) {
    return null;
  }

  await ensureCacheDir();
  const key = buildVariantKey(row, opts);
  const outPath = buildVariantPath(key);

  if (fs.existsSync(outPath)) {
    return outPath;
  }

  const renderPromise = (async () => {
    const max = clamp(safeNumber(opts.max, 2600), 600, 7000);
    const quality = clamp(safeNumber(opts.quality, 82), 45, 95);

    await sharp(row.file_path, {
      failOn: 'none',
      limitInputPixels: false
    })
      .rotate()
      .resize({
        width: max,
        height: max,
        fit: 'inside',
        withoutEnlargement: true,
        fastShrinkOnLoad: true
      })
      .jpeg({
        quality,
        mozjpeg: true,
        chromaSubsampling: '4:2:0'
      })
      .toFile(outPath);

    return outPath;
  })();

  pending.set(key, renderPromise);
  try {
    return await renderPromise;
  } finally {
    pending.delete(key);
  }
};

export const resolveOptimizedLocalImagePath = async (row, options = {}) => {
  if (!isSupportedLocalImage(row)) {
    return null;
  }

  const key = buildVariantKey(row, options);
  if (pending.has(key)) {
    return pending.get(key);
  }

  const cachedPath = buildVariantPath(key);
  if (fs.existsSync(cachedPath)) {
    return cachedPath;
  }

  try {
    return await renderVariant(row, options);
  } catch (err) {
    logger.warn({ err, id: row.id, filePath: row.file_path }, 'render optimized image failed');
    return null;
  }
};

