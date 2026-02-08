import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import multer from 'multer';
import mime from 'mime-types';
import { config } from './config.js';
import { dbInstance, rowToMap, statements, toTagsJson } from './db.js';
import {
  listLocalDirectories,
  listWebdavDirectories,
  scanLibrary,
  getImageStream,
  saveUploadToStorage
} from './library.js';
import {
  suggestLocations,
  resolveLocationByCityInput,
  getChinaCityOptions
} from './location-dict.js';
import { logger } from './logger.js';
import { resolveOptimizedLocalImagePath } from './image-optimizer.js';
import {
  getMapLibraryDir,
  getRuntimeSettings,
  getStorageDriver,
  getWebdavSettings,
  setMapLibraryDir,
  setStorageDriver,
  setWebdavSettings,
  updateStorageSettings
} from './runtime-settings.js';
import { restartWatcher, stopWatcher } from './watcher.js';
import { getOcrStatus, queueOcrForCandidates } from './ocr.js';
import { forceReloadProjectMeta, getProjectStoreStatus, upsertProjectMeta } from './project-store.js';

const router = express.Router();

const uploadDir = path.resolve(config.dataDir, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

const normalizeNumber = (value, fallback) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
};

const isUnknownKeyword = (value) => {
  const text = String(value || '').trim().toLowerCase();
  return text === 'unknown' || text === '未设置' || text === '未知';
};

const resolveNullableNumber = (incoming, currentValue) => {
  if (incoming === undefined) return currentValue ?? null;
  if (incoming === null || incoming === '') return null;
  const parsed = Number(incoming);
  return Number.isNaN(parsed) ? (currentValue ?? null) : parsed;
};

const normalizeLocalPathInput = (inputPath) => {
  const value = String(inputPath || '').trim();
  if (!value) return '';
  if (value.startsWith('~')) {
    return path.resolve(process.env.HOME || os.homedir(), value.slice(1));
  }
  return path.resolve(value);
};

const buildListQuery = (query) => {
  const page = Math.max(normalizeNumber(query.page, 1), 1);
  const limit = Math.min(Math.max(normalizeNumber(query.limit, 24), 1), 120);
  const where = [];
  const filterParams = {};

  if (query.q) {
    where.push('(title LIKE @q OR file_name LIKE @q OR city LIKE @q OR country_name LIKE @q OR ocr_text LIKE @q)');
    filterParams.q = `%${query.q}%`;
  }

  if (query.scope) {
    if (isUnknownKeyword(query.scope)) {
      where.push(`(
        scope_level IS NULL
        OR TRIM(scope_level) = ''
        OR LOWER(TRIM(scope_level)) = 'unknown'
        OR TRIM(scope_level) = '未知'
        OR TRIM(scope_level) = '未设置'
      )`);
    } else {
      where.push('scope_level = @scope');
      filterParams.scope = query.scope;
    }
  }

  if (query.country) {
    const isGlobalCountry = String(query.country).trim() === '全球';
    if (isGlobalCountry) {
      where.push(`(
        country_name LIKE @country
        OR country_name IS NULL
        OR TRIM(country_name) = ''
        OR scope_level = 'international'
        OR tags LIKE @country_tag
        OR ocr_text LIKE @country_text
      )`);
      filterParams.country = `%${query.country}%`;
      filterParams.country_tag = `%"${query.country}"%`;
      filterParams.country_text = `%${query.country}%`;
    } else if (isUnknownKeyword(query.country)) {
      where.push(`(
        country_name IS NULL
        OR TRIM(country_name) = ''
        OR LOWER(TRIM(country_name)) = 'unknown'
        OR TRIM(country_name) = '未知'
        OR TRIM(country_name) = '未设置'
      )`);
    } else {
      where.push('(country_name LIKE @country OR tags LIKE @country_tag OR ocr_text LIKE @country_text)');
      filterParams.country = `%${query.country}%`;
      filterParams.country_tag = `%"${query.country}"%`;
      filterParams.country_text = `%${query.country}%`;
    }
  }

  if (query.province) {
    if (isUnknownKeyword(query.province)) {
      where.push(`(
        province IS NULL
        OR TRIM(province) = ''
        OR LOWER(TRIM(province)) = 'unknown'
        OR TRIM(province) = '未知'
        OR TRIM(province) = '未设置'
      )`);
    } else {
      where.push('province LIKE @province');
      filterParams.province = `%${query.province}%`;
    }
  }

  if (query.city) {
    if (isUnknownKeyword(query.city)) {
      where.push(`(
        city IS NULL
        OR TRIM(city) = ''
        OR LOWER(TRIM(city)) = 'unknown'
        OR TRIM(city) = '未知'
        OR TRIM(city) = '未设置'
      )`);
    } else {
      where.push('city LIKE @city');
      filterParams.city = `%${query.city}%`;
    }
  }

  if (query.source) {
    where.push('source = @source');
    filterParams.source = query.source;
  }

  if (query.favorite === 'true') {
    where.push('favorite = 1');
  }

  if (query.tag) {
    where.push('tags LIKE @tag');
    filterParams.tag = `%"${query.tag}"%`;
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const listParams = {
    ...filterParams,
    limit,
    offset: (page - 1) * limit
  };

  return { whereClause, filterParams, listParams, page, limit };
};

const ensureLocalDriver = (res) => {
  if (getStorageDriver() !== 'local') {
    res.status(400).json({ ok: false, error: 'only_available_in_local_driver' });
    return false;
  }
  return true;
};

const ensureWebdavDriver = (res) => {
  if (getStorageDriver() !== 'webdav') {
    res.status(400).json({ ok: false, error: 'only_available_in_webdav_driver' });
    return false;
  }
  return true;
};

const maybeRestartWatcher = async () => {
  if (!config.watchLibrary) return;
  if (getStorageDriver() === 'local') {
    await restartWatcher();
    return;
  }
  await stopWatcher();
};

const maybeScanAfterStorageChange = async () => {
  const storageDriver = getStorageDriver();
  if (storageDriver === 'local' && !getMapLibraryDir()) {
    return null;
  }
  if (storageDriver === 'webdav' && !getWebdavSettings(true).url) {
    return null;
  }

  const scan = await scanLibrary();
  queueOcrForCandidates({ force: false, limit: 800 });
  return scan;
};

router.get('/status', (_req, res) => {
  const runtime = getRuntimeSettings();
  res.json({
    ok: true,
    storageDriver: runtime.storageDriver,
    mapLibraryDir: runtime.mapLibraryDir,
    webdav: runtime.webdav,
    watchLibrary: config.watchLibrary,
    ocr: getOcrStatus(),
    project: getProjectStoreStatus()
  });
});

router.get('/ocr/status', (_req, res) => {
  res.json({
    ok: true,
    ...getOcrStatus()
  });
});

router.post('/ocr/reindex', (req, res) => {
  const force = Boolean(req.body?.force);
  const limit = Math.min(Math.max(normalizeNumber(req.body?.limit, 600), 1), 6000);
  const result = queueOcrForCandidates({ force, limit });
  res.json({ ok: true, ...result });
});

router.get('/storage/settings', (_req, res) => {
  res.json({
    ok: true,
    ...getRuntimeSettings(),
    project: getProjectStoreStatus()
  });
});

router.post('/storage/settings', async (req, res) => {
  try {
    const payload = req.body || {};

    if (payload.storageDriver !== undefined) {
      setStorageDriver(payload.storageDriver);
    }

    if (payload.mapLibraryDir !== undefined && String(payload.mapLibraryDir).trim()) {
      setMapLibraryDir(payload.mapLibraryDir);
    }

    if (payload.webdav && typeof payload.webdav === 'object') {
      setWebdavSettings(payload.webdav);
    }

    updateStorageSettings(payload);
    await forceReloadProjectMeta();
    await maybeRestartWatcher();

    const scan = await maybeScanAfterStorageChange();

    let folders = [];
    if (getStorageDriver() === 'local') {
      folders = await listLocalDirectories({ maxDepth: 6 });
    } else if (getStorageDriver() === 'webdav') {
      folders = await listWebdavDirectories({ maxDepth: 6 });
    }

    res.json({
      ok: true,
      settings: getRuntimeSettings(),
      scan,
      folders,
      project: getProjectStoreStatus()
    });
  } catch (err) {
    logger.error({ err }, 'Update storage settings failed');
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get('/storage/local/current', (_req, res) => {
  if (!ensureLocalDriver(res)) return;
  res.json({
    ok: true,
    mapLibraryDir: getMapLibraryDir()
  });
});

router.get('/storage/local/folders', async (req, res) => {
  if (!ensureLocalDriver(res)) return;

  try {
    const maxDepth = Math.min(Math.max(normalizeNumber(req.query.depth, 6), 1), 10);
    const folders = await listLocalDirectories({ maxDepth });
    res.json({
      ok: true,
      root: getMapLibraryDir(),
      folders
    });
  } catch (err) {
    logger.error({ err }, 'List local folders failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/storage/local/browse', async (req, res) => {
  if (!ensureLocalDriver(res)) return;

  try {
    const incoming = req.query.path || getMapLibraryDir() || process.env.HOME || os.homedir();
    const targetPath = normalizeLocalPathInput(incoming);
    const stat = await fsp.stat(targetPath);

    if (!stat.isDirectory()) {
      res.status(400).json({ ok: false, error: 'not_a_directory' });
      return;
    }

    const entries = await fsp.readdir(targetPath, { withFileTypes: true });
    const children = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(targetPath, entry.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    const parentPath = path.dirname(targetPath);

    res.json({
      ok: true,
      currentPath: targetPath,
      parentPath: parentPath !== targetPath ? parentPath : '',
      children
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post('/storage/local/select', async (req, res) => {
  try {
    setStorageDriver('local');
    const selected = setMapLibraryDir(req.body?.path || '');
    await forceReloadProjectMeta();
    await maybeRestartWatcher();

    const scan = await maybeScanAfterStorageChange();
    const folders = await listLocalDirectories({ maxDepth: 6 });

    res.json({
      ok: true,
      mapLibraryDir: selected,
      scan,
      folders,
      settings: getRuntimeSettings()
    });
  } catch (err) {
    logger.error({ err }, 'Set map directory failed');
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get('/storage/webdav/folders', async (req, res) => {
  if (!ensureWebdavDriver(res)) return;

  try {
    const maxDepth = Math.min(Math.max(normalizeNumber(req.query.depth, 6), 1), 10);
    const folders = await listWebdavDirectories({ maxDepth });
    res.json({
      ok: true,
      root: getWebdavSettings().rootPath,
      folders
    });
  } catch (err) {
    logger.error({ err }, 'List webdav folders failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/maps', (req, res) => {
  const { whereClause, filterParams, listParams, page, limit } = buildListQuery(req.query);

  const listStmt = dbInstance.prepare(`
    SELECT * FROM maps
    ${whereClause}
    ORDER BY favorite DESC, mtime_ms DESC, file_name ASC
    LIMIT @limit OFFSET @offset
  `);

  const countStmt = dbInstance.prepare(`SELECT COUNT(*) AS total FROM maps ${whereClause}`);

  const items = listStmt.all(listParams).map(rowToMap);
  const total = countStmt.get(filterParams).total;

  res.json({
    items,
    total,
    page,
    limit,
    hasMore: page * limit < total
  });
});

router.get('/maps/facets', (req, res) => {
  const source = req.query.source;
  const where = source ? 'WHERE source = @source' : '';
  const params = source ? { source } : {};

  const scope = dbInstance.prepare(`
    SELECT COALESCE(NULLIF(TRIM(scope_level), ''), 'unknown') AS value, COUNT(*) AS count
    FROM maps ${where}
    GROUP BY COALESCE(NULLIF(TRIM(scope_level), ''), 'unknown')
    ORDER BY count DESC
  `).all(params);

  const country = dbInstance.prepare(`
    SELECT
      CASE
        WHEN country_name IS NULL
          OR TRIM(country_name) = ''
          OR LOWER(TRIM(country_name)) = 'unknown'
          OR TRIM(country_name) = '未知'
          OR TRIM(country_name) = '未设置'
        THEN '全球'
        ELSE TRIM(country_name)
      END AS value,
      COUNT(*) AS count
    FROM maps ${where}
    GROUP BY
      CASE
        WHEN country_name IS NULL
          OR TRIM(country_name) = ''
          OR LOWER(TRIM(country_name)) = 'unknown'
          OR TRIM(country_name) = '未知'
          OR TRIM(country_name) = '未设置'
        THEN '全球'
        ELSE TRIM(country_name)
      END
    ORDER BY count DESC
    LIMIT 80
  `).all(params);

  const province = dbInstance.prepare(`
    SELECT
      CASE
        WHEN province IS NULL
          OR TRIM(province) = ''
          OR LOWER(TRIM(province)) = 'unknown'
          OR TRIM(province) = '未知'
          OR TRIM(province) = '未设置'
        THEN 'Unknown'
        ELSE TRIM(province)
      END AS value,
      COUNT(*) AS count
    FROM maps ${where}
    GROUP BY
      CASE
        WHEN province IS NULL
          OR TRIM(province) = ''
          OR LOWER(TRIM(province)) = 'unknown'
          OR TRIM(province) = '未知'
          OR TRIM(province) = '未设置'
        THEN 'Unknown'
        ELSE TRIM(province)
      END
    ORDER BY count DESC
    LIMIT 120
  `).all(params);

  const city = dbInstance.prepare(`
    SELECT
      CASE
        WHEN city IS NULL
          OR TRIM(city) = ''
          OR LOWER(TRIM(city)) = 'unknown'
          OR TRIM(city) = '未知'
          OR TRIM(city) = '未设置'
        THEN 'Unknown'
        ELSE TRIM(city)
      END AS value,
      COUNT(*) AS count
    FROM maps ${where}
    GROUP BY
      CASE
        WHEN city IS NULL
          OR TRIM(city) = ''
          OR LOWER(TRIM(city)) = 'unknown'
          OR TRIM(city) = '未知'
          OR TRIM(city) = '未设置'
        THEN 'Unknown'
        ELSE TRIM(city)
      END
    ORDER BY count DESC
    LIMIT 180
  `).all(params);

  res.json({ scope, country, province, city });
});

router.get('/maps/china-distribution', (req, res) => {
  const source = req.query.source;
  const where = source
    ? `WHERE (country_code = 'CN' OR country_name = '中国' OR scope_level = 'national') AND source = @source`
    : `WHERE (country_code = 'CN' OR country_name = '中国' OR scope_level = 'national')`;
  const params = source ? { source } : {};

  const rows = dbInstance.prepare(`
    SELECT COALESCE(province, 'Unknown') AS province, COUNT(*) AS count
    FROM maps
    ${where}
    GROUP BY COALESCE(province, 'Unknown')
    ORDER BY count DESC
  `).all(params);

  res.json({ ok: true, items: rows });
});

router.get('/maps/:id', (req, res) => {
  const row = statements.findById.get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(rowToMap(row));
});

router.put('/maps/:id', async (req, res) => {
  const row = statements.findById.get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const body = req.body || {};
  const current = rowToMap(row);

  const cityInput = body.city ?? current.city;
  const resolvedLocation = body.auto_resolve_city !== false
    ? resolveLocationByCityInput(cityInput)
    : null;

  const next = {
    id: req.params.id,
    title: body.title ?? row.title,
    description: body.description ?? row.description,
    tags: toTagsJson(body.tags ?? current.tags),
    collection_unit: body.collection_unit ?? row.collection_unit,
    scope_level: body.scope_level ?? row.scope_level ?? resolvedLocation?.scope_level,
    country_code: body.country_code ?? row.country_code ?? resolvedLocation?.country_code,
    country_name: body.country_name ?? row.country_name ?? resolvedLocation?.country_name,
    province: body.province ?? row.province ?? resolvedLocation?.province,
    city: body.city ?? row.city ?? resolvedLocation?.city,
    district: body.district ?? row.district ?? resolvedLocation?.district,
    latitude: body.latitude !== undefined
      ? resolveNullableNumber(body.latitude, row.latitude)
      : resolveNullableNumber(resolvedLocation?.latitude, row.latitude),
    longitude: body.longitude !== undefined
      ? resolveNullableNumber(body.longitude, row.longitude)
      : resolveNullableNumber(resolvedLocation?.longitude, row.longitude),
    year_label: body.year_label ?? row.year_label,
    updated_at: new Date().toISOString()
  };

  statements.updateMapMeta.run(next);
  const updated = rowToMap(statements.findById.get(req.params.id));

  await upsertProjectMeta({
    source: updated.source,
    filePath: updated.file_path,
    meta: {
      title: updated.title,
      description: updated.description,
      tags: updated.tags,
      collection_unit: updated.collection_unit,
      scope_level: updated.scope_level,
      country_code: updated.country_code,
      country_name: updated.country_name,
      province: updated.province,
      city: updated.city,
      district: updated.district,
      latitude: updated.latitude,
      longitude: updated.longitude,
      year_label: updated.year_label,
      favorite: updated.favorite,
      ocr_text: updated.ocr_text,
      ocr_status: updated.ocr_status,
      ocr_error: updated.ocr_error,
      ocr_updated_at: updated.ocr_updated_at,
      ocr_mtime_ms: updated.ocr_mtime_ms
    }
  });

  res.json(updated);
});

router.post('/maps/:id/favorite', async (req, res) => {
  const row = statements.findById.get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const favorite = typeof req.body?.favorite === 'boolean'
    ? req.body.favorite
    : !row.favorite;

  statements.toggleFavorite.run({
    id: req.params.id,
    favorite: favorite ? 1 : 0,
    updated_at: new Date().toISOString()
  });

  const updated = rowToMap(statements.findById.get(req.params.id));
  await upsertProjectMeta({
    source: updated.source,
    filePath: updated.file_path,
    meta: {
      favorite: updated.favorite
    }
  });

  res.json(updated);
});

router.post('/maps/scan', async (_req, res) => {
  try {
    const result = await scanLibrary();
    queueOcrForCandidates({ force: false, limit: 800 });

    let folders = [];
    if (getStorageDriver() === 'local') {
      folders = await listLocalDirectories({ maxDepth: 6 });
    } else if (getStorageDriver() === 'webdav') {
      folders = await listWebdavDirectories({ maxDepth: 6 });
    }

    res.json({ ok: true, ...result, folders });
  } catch (err) {
    logger.error({ err }, 'Scan failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/maps/upload', upload.array('files', 300), async (req, res) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      res.status(400).json({ error: 'missing_files' });
      return;
    }

    const folder = req.body?.folder || '';
    const savedPaths = [];

    for (const file of files) {
      const savedPath = await saveUploadToStorage({ file, folder });
      savedPaths.push(savedPath);
    }

    const scan = await scanLibrary();
    queueOcrForCandidates({ force: false, limit: 800 });
    res.json({ ok: true, count: savedPaths.length, paths: savedPaths, scan });
  } catch (err) {
    logger.error({ err }, 'Upload failed');
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/locations/suggest', (req, res) => {
  res.json({
    items: suggestLocations(req.query.q || '')
  });
});

router.get('/locations/resolve-city', (req, res) => {
  const keyword = req.query.q || '';
  const item = resolveLocationByCityInput(keyword);
  res.json({
    ok: true,
    item: item || null
  });
});

router.get('/locations/china-cities', (_req, res) => {
  res.json({
    ok: true,
    items: getChinaCityOptions()
  });
});

router.get('/files/:id', (req, res) => {
  const row = statements.findById.get(req.params.id);
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const max = Math.min(Math.max(normalizeNumber(req.query.max, 0), 0), 7000);
  const quality = Math.min(Math.max(normalizeNumber(req.query.quality, 82), 45), 95);

  const sendOriginal = () => {
    const contentType = row.mime || mime.lookup(row.file_name) || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const stream = getImageStream(row);

    stream.on('error', (err) => {
      logger.error({ err, id: req.params.id }, 'File stream failed');
      if (!res.headersSent) {
        res.status(404).json({ error: 'file_not_found' });
      }
    });

    stream.pipe(res);
  };

  if (max <= 0) {
    sendOriginal();
    return;
  }

  resolveOptimizedLocalImagePath(row, { max, quality })
    .then((optimizedPath) => {
      if (!optimizedPath) {
        sendOriginal();
        return;
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      const stream = fs.createReadStream(optimizedPath);
      stream.on('error', () => sendOriginal());
      stream.pipe(res);
    })
    .catch(() => sendOriginal());
});

export default router;
