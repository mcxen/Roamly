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
import { resolveOptimizedLocalImagePath, prewarmOptimizedImages } from './image-optimizer.js';
import {
  getMapLibraryDir,
  getRuntimeSettings,
  getStorageDriver,
  getWebdavSettings,
  setMapLibraryDir,
  setServerMapDir,
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

const splitLocationValues = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
      } catch (_err) {
        // ignore
      }
    }
    return String(value)
      .split(/[;,，；/、|]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeFacetToken = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower === 'unknown' || trimmed === '未知' || trimmed === '未设置') return '';
  return trimmed;
};

const buildLocationFacet = (rows, fields, limit, fallbackValue) => {
  const counts = new Map();
  const fieldList = Array.isArray(fields) ? fields : [fields];

  for (const row of rows) {
    const parts = fieldList
      .flatMap((field) => splitLocationValues(row?.[field]))
      .map(normalizeFacetToken)
      .filter(Boolean);

    if (!parts.length) {
      if (fallbackValue) {
        counts.set(fallbackValue, (counts.get(fallbackValue) || 0) + 1);
      }
      continue;
    }

    const unique = new Set(parts);
    for (const value of unique) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return Array.from(counts, ([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

const resolveNullableNumber = (incoming, currentValue) => {
  if (incoming === undefined) return currentValue ?? null;
  if (incoming === null || incoming === '') return null;
  const parsed = Number(incoming);
  return Number.isNaN(parsed) ? (currentValue ?? null) : parsed;
};

const parseBooleanInput = (value, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const buildUploadBatchMeta = (body = {}) => {
  const cityInput = body.city;
  const shouldResolveCity = parseBooleanInput(body.auto_resolve_city, true);
  const resolvedLocation = shouldResolveCity ? resolveLocationByCityInput(cityInput) : null;

  return {
    title: body.title ?? null,
    description: body.description ?? null,
    tags: toTagsJson(body.tags),
    collection_unit: body.collection_unit ?? null,
    scope_level: body.scope_level ?? resolvedLocation?.scope_level ?? null,
    country_code: body.country_code ?? resolvedLocation?.country_code ?? null,
    country_name: body.country_name ?? resolvedLocation?.country_name ?? null,
    province: body.province ?? resolvedLocation?.province ?? null,
    related_countries: toTagsJson(body.related_countries),
    related_provinces: toTagsJson(body.related_provinces),
    city: body.city ?? resolvedLocation?.city ?? null,
    district: body.district ?? resolvedLocation?.district ?? null,
    latitude: resolveNullableNumber(body.latitude, resolvedLocation?.latitude),
    longitude: resolveNullableNumber(body.longitude, resolvedLocation?.longitude),
    year_label: body.year_label ?? null,
    campaign: body.campaign ?? null,
    teaching_use: body.teaching_use ?? null,
    teaching_note: body.teaching_note ?? null,
    security_level: body.security_level ?? null,
    storage_band: body.storage_band ?? null,
    favorite: parseBooleanInput(body.favorite, undefined)
  };
};

const applyBatchMetaToRows = async (filePaths = [], body = {}) => {
  const paths = Array.isArray(filePaths)
    ? filePaths.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (!paths.length) {
    return [];
  }

  const batchMeta = buildUploadBatchMeta(body);
  const now = new Date().toISOString();
  const selectByPath = dbInstance.prepare('SELECT * FROM maps WHERE file_path = ?');
  const touched = [];

  for (const filePath of paths) {
    const row = selectByPath.get(filePath);
    if (!row) continue;
    const current = rowToMap(row);
    const next = {
      id: current.id,
      title: batchMeta.title ?? row.title,
      description: batchMeta.description ?? row.description,
      tags: batchMeta.tags ?? row.tags,
      collection_unit: batchMeta.collection_unit ?? row.collection_unit,
      scope_level: batchMeta.scope_level ?? row.scope_level,
      country_code: batchMeta.country_code ?? row.country_code,
      country_name: batchMeta.country_name ?? row.country_name,
      province: batchMeta.province ?? row.province,
      related_countries: batchMeta.related_countries ?? row.related_countries,
      related_provinces: batchMeta.related_provinces ?? row.related_provinces,
      city: batchMeta.city ?? row.city,
      district: batchMeta.district ?? row.district,
      latitude: batchMeta.latitude ?? row.latitude,
      longitude: batchMeta.longitude ?? row.longitude,
      north_latitude: row.north_latitude,
      south_latitude: row.south_latitude,
      east_longitude: row.east_longitude,
      west_longitude: row.west_longitude,
      coverage_outline: row.coverage_outline,
      year_label: batchMeta.year_label ?? row.year_label,
      campaign: batchMeta.campaign ?? row.campaign,
      teaching_use: batchMeta.teaching_use ?? row.teaching_use,
      teaching_note: batchMeta.teaching_note ?? row.teaching_note,
      security_level: batchMeta.security_level ?? row.security_level,
      storage_band: batchMeta.storage_band ?? row.storage_band,
      updated_at: now
    };

    statements.updateMapMeta.run(next);
    if (batchMeta.favorite !== undefined) {
      statements.toggleFavorite.run({
        id: current.id,
        favorite: batchMeta.favorite ? 1 : 0,
        updated_at: now
      });
    }

    const updated = rowToMap(statements.findById.get(current.id));
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
        related_countries: updated.related_countries,
        related_provinces: updated.related_provinces,
        city: updated.city,
        district: updated.district,
        latitude: updated.latitude,
        longitude: updated.longitude,
        north_latitude: updated.north_latitude,
        south_latitude: updated.south_latitude,
        east_longitude: updated.east_longitude,
        west_longitude: updated.west_longitude,
        coverage_outline: updated.coverage_outline,
        year_label: updated.year_label,
        campaign: updated.campaign,
        teaching_use: updated.teaching_use,
        teaching_note: updated.teaching_note,
        security_level: updated.security_level,
        storage_band: updated.storage_band,
        favorite: updated.favorite
      }
    });
    touched.push(updated);
  }

  return touched;
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
    where.push('(title LIKE @q OR file_name LIKE @q OR city LIKE @q OR country_name LIKE @q OR related_countries LIKE @q OR related_provinces LIKE @q OR ocr_text LIKE @q OR campaign LIKE @q OR teaching_use LIKE @q OR teaching_note LIKE @q OR security_level LIKE @q OR storage_band LIKE @q)');
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
    const trimmedCountry = String(query.country).trim();
    const isGlobalCountry = trimmedCountry === '全球';
    const lowerCountry = trimmedCountry.toLowerCase();
    const isChina = trimmedCountry === '中国' || lowerCountry === 'china';
    if (isGlobalCountry) {
      where.push(`(
        country_name LIKE @country
        OR country_name IS NULL
        OR TRIM(country_name) = ''
        OR scope_level = 'international'
        OR related_countries LIKE @country
        OR tags LIKE @country_tag
        OR ocr_text LIKE @country_text
      )`);
      filterParams.country = `%${trimmedCountry}%`;
      filterParams.country_tag = `%"${trimmedCountry}"%`;
      filterParams.country_text = `%${trimmedCountry}%`;
    } else if (isUnknownKeyword(trimmedCountry)) {
      where.push(`(
        country_name IS NULL
        OR TRIM(country_name) = ''
        OR LOWER(TRIM(country_name)) = 'unknown'
        OR TRIM(country_name) = '未知'
        OR TRIM(country_name) = '未设置'
      )`);
    } else {
      if (isChina) {
        where.push(`(
          country_name LIKE @country
          OR country_name LIKE @country_alt
          OR country_code = 'CN'
          OR related_countries LIKE @country_related
          OR related_countries LIKE @country_related_alt
          OR tags LIKE @country_tag
          OR ocr_text LIKE @country_text
        )`);
        filterParams.country_alt = '%China%';
        filterParams.country_related_alt = '%"China"%';
      } else {
        where.push('(country_name LIKE @country OR related_countries LIKE @country_related OR tags LIKE @country_tag OR ocr_text LIKE @country_text)');
      }
      filterParams.country = `%${trimmedCountry}%`;
      filterParams.country_related = `%"${trimmedCountry}"%`;
      filterParams.country_tag = `%"${trimmedCountry}"%`;
      filterParams.country_text = `%${trimmedCountry}%`;
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
      where.push('(province LIKE @province OR related_provinces LIKE @province_related)');
      filterParams.province = `%${query.province}%`;
      filterParams.province_related = `%"${query.province}"%`;
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

const buildMobileFileUrls = (id) => ({
  original: `/api/files/${encodeURIComponent(id)}`,
  thumbnail: `/api/files/${encodeURIComponent(id)}?max=720&quality=72`
});

const buildMobileMapSummary = (row) => {
  const item = rowToMap(row);
  if (!item) return null;

  return {
    id: item.id,
    file_name: item.file_name,
    title: item.title || item.file_name,
    description: item.description || '',
    tags: item.tags,
    collection_unit: item.collection_unit,
    scope_level: item.scope_level,
    country_code: item.country_code,
    country_name: item.country_name,
    province: item.province,
    related_countries: item.related_countries,
    related_provinces: item.related_provinces,
    city: item.city,
    district: item.district,
    latitude: item.latitude,
    longitude: item.longitude,
    north_latitude: item.north_latitude,
    south_latitude: item.south_latitude,
    east_longitude: item.east_longitude,
    west_longitude: item.west_longitude,
    coverage_outline: item.coverage_outline,
    year_label: item.year_label,
    campaign: item.campaign || '',
    teaching_use: item.teaching_use || '',
    teaching_note: item.teaching_note || '',
    security_level: item.security_level || '',
    storage_band: item.storage_band || '',
    favorite: item.favorite,
    mime: item.mime,
    width: item.width,
    height: item.height,
    size_bytes: item.size_bytes,
    mtime_ms: item.mtime_ms,
    updated_at: item.updated_at,
    created_at: item.created_at,
    source: item.source,
    ocr_status: item.ocr_status,
    ocr_excerpt: item.ocr_text ? String(item.ocr_text).slice(0, 280) : '',
    files: buildMobileFileUrls(item.id)
  };
};

const buildMobileMapDetail = (row) => {
  const item = rowToMap(row);
  if (!item) return null;

  return {
    ...buildMobileMapSummary(row),
    ocr_text: item.ocr_text || '',
    ocr_blocks: item.ocr_blocks || [],
    ocr_error: item.ocr_error || '',
    ocr_updated_at: item.ocr_updated_at || ''
  };
};

const ensureLocalDriver = (res) => {
  if (!['local', 'server'].includes(getStorageDriver())) {
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
  if (storageDriver === 'server') {
    const scan = await scanLibrary();
    queueOcrForCandidates({ force: false, limit: 800 });
    return scan;
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
    serverMapDir: runtime.serverMapDir,
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
  res.json({ ok: true, ...result, status: getOcrStatus() });
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

    if (payload.serverMapDir !== undefined && String(payload.serverMapDir).trim()) {
      setServerMapDir(payload.serverMapDir);
    }

    if (payload.webdav && typeof payload.webdav === 'object') {
      setWebdavSettings(payload.webdav);
    }

    updateStorageSettings(payload);
    await forceReloadProjectMeta();
    await maybeRestartWatcher();

    const scan = await maybeScanAfterStorageChange();

    let folders = [];
    if (getStorageDriver() === 'local' || getStorageDriver() === 'server') {
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
  const countryFilter = req.query.country;
  const whereParts = [];
  const params = {};

  if (source) {
    whereParts.push('source = @source');
    params.source = source;
  }

  if (countryFilter) {
    const trimmed = String(countryFilter).trim();
    const lower = trimmed.toLowerCase();
    const isChina = trimmed === '中国' || lower === 'china';
    if (trimmed) {
      const isGlobalCountry = trimmed === '全球';
      if (isGlobalCountry) {
        whereParts.push(`(
          country_name LIKE @country
          OR country_name IS NULL
          OR TRIM(country_name) = ''
          OR scope_level = 'international'
          OR related_countries LIKE @country
          OR tags LIKE @country_tag
          OR ocr_text LIKE @country_text
        )`);
        params.country = `%${trimmed}%`;
        params.country_tag = `%"${trimmed}"%`;
        params.country_text = `%${trimmed}%`;
      } else if (isUnknownKeyword(trimmed)) {
        whereParts.push(`(
          country_name IS NULL
          OR TRIM(country_name) = ''
          OR LOWER(TRIM(country_name)) = 'unknown'
          OR TRIM(country_name) = '未知'
          OR TRIM(country_name) = '未设置'
        )`);
      } else {
        if (isChina) {
          whereParts.push(`(
            country_name LIKE @country
            OR country_name LIKE @country_alt
            OR country_code = 'CN'
            OR related_countries LIKE @country_related
            OR related_countries LIKE @country_related_alt
            OR tags LIKE @country_tag
            OR ocr_text LIKE @country_text
          )`);
          params.country_alt = '%China%';
          params.country_related_alt = '%"China"%';
        } else {
          whereParts.push('(country_name LIKE @country OR related_countries LIKE @country_related OR tags LIKE @country_tag OR ocr_text LIKE @country_text)');
        }
        params.country = `%${trimmed}%`;
        params.country_related = `%"${trimmed}"%`;
        params.country_tag = `%"${trimmed}"%`;
        params.country_text = `%${trimmed}%`;
      }
    }
  }

  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const scope = dbInstance.prepare(`
    SELECT COALESCE(NULLIF(TRIM(scope_level), ''), 'unknown') AS value, COUNT(*) AS count
    FROM maps ${where}
    GROUP BY COALESCE(NULLIF(TRIM(scope_level), ''), 'unknown')
    ORDER BY count DESC
  `).all(params);

  const countryRows = dbInstance.prepare(`
    SELECT country_name, related_countries FROM maps ${where}
  `).all(params);
  const country = buildLocationFacet(countryRows, ['country_name', 'related_countries'], 80, '全球');

  const provinceRows = dbInstance.prepare(`
    SELECT province, related_provinces FROM maps ${where}
  `).all(params);
  const province = buildLocationFacet(provinceRows, ['province', 'related_provinces'], 120, 'Unknown');

  const cityRows = dbInstance.prepare(`
    SELECT city FROM maps ${where}
  `).all(params);
  const city = buildLocationFacet(cityRows, 'city', 180, 'Unknown');

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

router.get('/mobile/manifest', (req, res) => {
  const includeOcr = String(req.query.include_ocr || '').trim() === 'true';
  const rows = dbInstance.prepare(`
    SELECT * FROM maps
    ORDER BY favorite DESC, updated_at DESC, file_name ASC
  `).all();

  const revision = dbInstance.prepare(`
    SELECT MAX(updated_at) AS revision, COUNT(*) AS total FROM maps
  `).get();

  const items = rows.map((row) => {
    const summary = buildMobileMapSummary(row);
    if (!includeOcr) return summary;
    return {
      ...summary,
      ocr_text: row.ocr_text || ''
    };
  });

  res.json({
    ok: true,
    revision: revision?.revision || '',
    total: revision?.total || 0,
    items
  });
});

router.get('/mobile/search', (req, res) => {
  const page = 1;
  const limit = Math.min(Math.max(normalizeNumber(req.query.limit, 60), 1), 120);
  const query = {
    ...req.query,
    page,
    limit
  };
  const { whereClause, filterParams, listParams } = buildListQuery(query);

  const rows = dbInstance.prepare(`
    SELECT * FROM maps
    ${whereClause}
    ORDER BY favorite DESC, mtime_ms DESC, file_name ASC
    LIMIT @limit OFFSET @offset
  `).all(listParams);

  const totalRow = dbInstance.prepare(`
    SELECT COUNT(*) AS total FROM maps ${whereClause}
  `).get(filterParams);

  res.json({
    ok: true,
    q: String(req.query.q || ''),
    total: totalRow?.total || 0,
    items: rows.map(buildMobileMapSummary)
  });
});

router.get('/mobile/maps/:id', (req, res) => {
  const row = statements.findById.get(req.params.id);
  if (!row) {
    res.status(404).json({ ok: false, error: 'not_found' });
    return;
  }

  res.json({
    ok: true,
    item: buildMobileMapDetail(row)
  });
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
  const nullable = (value) => value ?? null;

  const next = {
    id: req.params.id,
    title: nullable(body.title ?? row.title),
    description: nullable(body.description ?? row.description),
    tags: toTagsJson(body.tags ?? current.tags),
    collection_unit: nullable(body.collection_unit ?? row.collection_unit),
    scope_level: nullable(body.scope_level ?? row.scope_level ?? resolvedLocation?.scope_level),
    country_code: nullable(body.country_code ?? row.country_code ?? resolvedLocation?.country_code),
    country_name: nullable(body.country_name ?? row.country_name ?? resolvedLocation?.country_name),
    province: nullable(body.province ?? row.province ?? resolvedLocation?.province),
    related_countries: toTagsJson(body.related_countries ?? current.related_countries),
    related_provinces: toTagsJson(body.related_provinces ?? current.related_provinces),
    city: nullable(body.city ?? row.city ?? resolvedLocation?.city),
    district: nullable(body.district ?? row.district ?? resolvedLocation?.district),
    latitude: body.latitude !== undefined
      ? resolveNullableNumber(body.latitude, row.latitude)
      : resolveNullableNumber(resolvedLocation?.latitude, row.latitude),
    longitude: body.longitude !== undefined
      ? resolveNullableNumber(body.longitude, row.longitude)
      : resolveNullableNumber(resolvedLocation?.longitude, row.longitude),
    north_latitude: body.north_latitude !== undefined ? resolveNullableNumber(body.north_latitude, row.north_latitude) : row.north_latitude,
    south_latitude: body.south_latitude !== undefined ? resolveNullableNumber(body.south_latitude, row.south_latitude) : row.south_latitude,
    east_longitude: body.east_longitude !== undefined ? resolveNullableNumber(body.east_longitude, row.east_longitude) : row.east_longitude,
    west_longitude: body.west_longitude !== undefined ? resolveNullableNumber(body.west_longitude, row.west_longitude) : row.west_longitude,
    coverage_outline: Array.isArray(body.coverage_outline) ? JSON.stringify(body.coverage_outline) : row.coverage_outline,
    year_label: nullable(body.year_label ?? row.year_label),
    campaign: nullable(body.campaign ?? row.campaign),
    teaching_use: nullable(body.teaching_use ?? row.teaching_use),
    teaching_note: nullable(body.teaching_note ?? row.teaching_note),
    security_level: nullable(body.security_level ?? row.security_level),
    storage_band: nullable(body.storage_band ?? row.storage_band),
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
      related_countries: updated.related_countries,
      related_provinces: updated.related_provinces,
      city: updated.city,
      district: updated.district,
      latitude: updated.latitude,
      longitude: updated.longitude,
      north_latitude: updated.north_latitude,
      south_latitude: updated.south_latitude,
      east_longitude: updated.east_longitude,
      west_longitude: updated.west_longitude,
      coverage_outline: updated.coverage_outline,
      year_label: updated.year_label,
      campaign: updated.campaign,
      teaching_use: updated.teaching_use,
      teaching_note: updated.teaching_note,
      security_level: updated.security_level,
      storage_band: updated.storage_band,
      favorite: updated.favorite,
      ocr_text: updated.ocr_text,
      ocr_blocks: updated.ocr_blocks,
      ocr_status: updated.ocr_status,
      ocr_error: updated.ocr_error,
      ocr_updated_at: updated.ocr_updated_at,
      ocr_mtime_ms: updated.ocr_mtime_ms
    }
  });

  res.json(updated);
});

router.post('/maps/batch-update', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      res.status(400).json({ ok: false, error: 'missing_ids' });
      return;
    }

    const rows = ids
      .map((id) => statements.findById.get(id))
      .filter(Boolean);

    const touched = await applyBatchMetaToRows(rows.map((row) => row.file_path), req.body || {});
    res.json({ ok: true, total: touched.length, items: touched });
  } catch (err) {
    logger.error({ err }, 'Batch update maps failed');
    res.status(400).json({ ok: false, error: err.message });
  }
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

    const allRows = dbInstance.prepare('SELECT * FROM maps').all().map(rowToMap);
    const prewarm = await prewarmOptimizedImages(allRows, { limit: 120, max: 720, quality: 72 });

    let folders = [];
    if (getStorageDriver() === 'local' || getStorageDriver() === 'server') {
      folders = await listLocalDirectories({ maxDepth: 6 });
    } else if (getStorageDriver() === 'webdav') {
      folders = await listWebdavDirectories({ maxDepth: 6 });
    }

    res.json({ ok: true, ...result, folders, prewarm });
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
    const touched = await applyBatchMetaToRows(savedPaths, req.body || {});
    const prewarm = await prewarmOptimizedImages(touched, { limit: 120, max: 720, quality: 72 });
    queueOcrForCandidates({ force: false, limit: 800 });
    res.json({
      ok: true,
      count: savedPaths.length,
      paths: savedPaths,
      scan,
      prewarm,
      updated: touched.length,
      items: touched
    });
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
