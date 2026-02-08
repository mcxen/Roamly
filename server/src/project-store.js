import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createClient } from 'webdav';
import { config } from './config.js';
import { logger } from './logger.js';
import { getStorageDriver, getMapLibraryDir, getWebdavSettings, getProjectKey } from './runtime-settings.js';

const PROJECT_DIR_NAME = '.roamly';
const PROJECT_FILE_NAME = 'project-data.json';
const CACHE_DIR = path.resolve(config.dataDir, 'projects');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const cache = {
  projectKey: '',
  descriptor: null,
  data: null
};

const nowIso = () => new Date().toISOString();

const normalizeRootPath = (inputPath) => {
  const raw = String(inputPath || '/').trim();
  if (!raw || raw === '.') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const compact = withSlash.replace(/\/+$/, '');
  return compact || '/';
};

const defaultProjectData = (descriptor) => ({
  version: 1,
  project: {
    key: descriptor.projectKey,
    source: descriptor.source,
    root: descriptor.root,
    created_at: nowIso(),
    updated_at: nowIso()
  },
  maps: {}
});

const safeParseJson = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.maps || typeof parsed.maps !== 'object') {
      parsed.maps = {};
    }
    return parsed;
  } catch (_err) {
    return null;
  }
};

const buildDescriptor = () => {
  const source = getStorageDriver();
  if (source === 'webdav') {
    const webdav = getWebdavSettings(true);
    const root = normalizeRootPath(webdav.rootPath || '/');
    return {
      source,
      projectKey: getProjectKey(),
      root,
      webdav,
      localRoot: ''
    };
  }

  return {
    source: 'local',
    projectKey: getProjectKey(),
    root: getMapLibraryDir() || '',
    webdav: null,
    localRoot: getMapLibraryDir() || ''
  };
};

const projectHash = (projectKey) => crypto.createHash('sha1').update(projectKey).digest('hex').slice(0, 16);

const getCacheFilePath = (descriptor) => {
  return path.resolve(CACHE_DIR, `${projectHash(descriptor.projectKey)}.json`);
};

const getLocalSidecarPath = (descriptor) => {
  if (descriptor.source !== 'local' || !descriptor.localRoot) return '';
  return path.resolve(descriptor.localRoot, PROJECT_DIR_NAME, PROJECT_FILE_NAME);
};

const getWebdavSidecarPath = (descriptor) => {
  const root = normalizeRootPath(descriptor.root || '/');
  return `${root}/${PROJECT_DIR_NAME}/${PROJECT_FILE_NAME}`.replace(/\/+/g, '/');
};

const createWebdavClient = (descriptor) => {
  const webdav = descriptor.webdav;
  if (!webdav?.url) {
    throw new Error('WEBDAV_URL 未设置');
  }
  return createClient(webdav.url, {
    username: webdav.username,
    password: webdav.password
  });
};

const readLocalJson = async (filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = await fsp.readFile(filePath, 'utf-8');
    return safeParseJson(raw);
  } catch (_err) {
    return null;
  }
};

const writeLocalJson = async (filePath, data) => {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

const readWebdavJson = async (descriptor) => {
  const client = createWebdavClient(descriptor);
  const filePath = getWebdavSidecarPath(descriptor);
  try {
    const raw = await client.getFileContents(filePath, { format: 'text' });
    return safeParseJson(raw);
  } catch (_err) {
    return null;
  }
};

const writeWebdavJson = async (descriptor, data) => {
  const client = createWebdavClient(descriptor);
  const filePath = getWebdavSidecarPath(descriptor);
  const dirPath = filePath.split('/').slice(0, -1).join('/') || '/';

  try {
    await client.createDirectory(dirPath, { recursive: true });
  } catch (_err) {
    // ignore already exists
  }

  await client.putFileContents(filePath, JSON.stringify(data, null, 2), {
    overwrite: true,
    contentType: 'application/json; charset=utf-8'
  });
};

const readPrimary = async (descriptor) => {
  if (descriptor.source === 'local') {
    return readLocalJson(getLocalSidecarPath(descriptor));
  }

  if (descriptor.source === 'webdav') {
    return readWebdavJson(descriptor);
  }

  return null;
};

const writePrimary = async (descriptor, data) => {
  if (descriptor.source === 'local') {
    const sidecarPath = getLocalSidecarPath(descriptor);
    if (!sidecarPath) return;
    await writeLocalJson(sidecarPath, data);
    return;
  }

  if (descriptor.source === 'webdav') {
    await writeWebdavJson(descriptor, data);
  }
};

const readCacheData = async (descriptor) => {
  return readLocalJson(getCacheFilePath(descriptor));
};

const writeCacheData = async (descriptor, data) => {
  await writeLocalJson(getCacheFilePath(descriptor), data);
};

const normalizeRelativePath = (value) => {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .trim();
};

const toRelativePath = (descriptor, source, filePath) => {
  if (!filePath) return '';

  if (source === 'local') {
    if (descriptor.source === 'local' && descriptor.localRoot) {
      return normalizeRelativePath(path.relative(descriptor.localRoot, filePath));
    }
    return normalizeRelativePath(filePath);
  }

  if (source === 'webdav') {
    const root = normalizeRootPath(descriptor.source === 'webdav' ? descriptor.root : '/');
    const normalized = `/${normalizeRelativePath(filePath)}`;
    if (normalized.startsWith(`${root}/`)) {
      return normalizeRelativePath(normalized.slice(root.length + 1));
    }
    if (normalized === root) {
      return '';
    }
    return normalizeRelativePath(filePath);
  }

  return normalizeRelativePath(filePath);
};

const sanitizeMapMeta = (meta = {}) => {
  const tags = Array.isArray(meta.tags)
    ? meta.tags.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    title: meta.title ?? null,
    description: meta.description ?? null,
    tags,
    collection_unit: meta.collection_unit ?? null,
    scope_level: meta.scope_level ?? null,
    country_code: meta.country_code ?? null,
    country_name: meta.country_name ?? null,
    province: meta.province ?? null,
    city: meta.city ?? null,
    district: meta.district ?? null,
    latitude: meta.latitude ?? null,
    longitude: meta.longitude ?? null,
    year_label: meta.year_label ?? null,
    favorite: Boolean(meta.favorite),
    ocr_text: meta.ocr_text ?? null,
    ocr_status: meta.ocr_status ?? null,
    ocr_error: meta.ocr_error ?? null,
    ocr_updated_at: meta.ocr_updated_at ?? null,
    ocr_mtime_ms: meta.ocr_mtime_ms ?? null,
    source: meta.source ?? null,
    updated_at: nowIso()
  };
};

const ensureLoaded = async (forceReload = false) => {
  const descriptor = buildDescriptor();
  if (!forceReload && cache.data && cache.projectKey === descriptor.projectKey) {
    return { descriptor, data: cache.data };
  }

  let data = await readPrimary(descriptor);
  if (!data) {
    data = await readCacheData(descriptor);
  }

  if (!data) {
    data = defaultProjectData(descriptor);
  }

  cache.projectKey = descriptor.projectKey;
  cache.descriptor = descriptor;
  cache.data = data;

  return { descriptor, data };
};

const saveCurrent = async () => {
  if (!cache.data || !cache.descriptor) return;

  cache.data.project = {
    ...(cache.data.project || {}),
    key: cache.descriptor.projectKey,
    source: cache.descriptor.source,
    root: cache.descriptor.root,
    updated_at: nowIso()
  };

  await writeCacheData(cache.descriptor, cache.data);
  try {
    await writePrimary(cache.descriptor, cache.data);
  } catch (err) {
    logger.warn({ err, projectKey: cache.descriptor.projectKey }, 'write primary project file failed, cache retained');
  }
};

export const getProjectStoreStatus = () => {
  const descriptor = buildDescriptor();
  return {
    projectKey: descriptor.projectKey,
    source: descriptor.source,
    root: descriptor.root,
    cacheFile: getCacheFilePath(descriptor)
  };
};

export const loadProjectMetaSnapshot = async () => {
  const { descriptor, data } = await ensureLoaded();

  return {
    projectKey: descriptor.projectKey,
    source: descriptor.source,
    maps: data.maps || {},
    toRelativePath: (source, filePath) => toRelativePath(descriptor, source, filePath)
  };
};

export const getProjectMeta = async ({ source, filePath, relativePath }) => {
  const { descriptor, data } = await ensureLoaded();
  const key = normalizeRelativePath(relativePath || toRelativePath(descriptor, source, filePath));
  if (!key) return null;
  return data.maps?.[key] || null;
};

export const upsertProjectMeta = async ({ source, filePath, relativePath, meta }) => {
  const { descriptor, data } = await ensureLoaded();
  const key = normalizeRelativePath(relativePath || toRelativePath(descriptor, source, filePath));
  if (!key) return;

  const prev = data.maps?.[key] || {};
  data.maps[key] = {
    ...prev,
    ...sanitizeMapMeta({ ...prev, ...meta, source })
  };

  await saveCurrent();
};

export const batchMergeProjectMeta = async ({ source, entries = [] }) => {
  if (!Array.isArray(entries) || !entries.length) return;

  const { descriptor, data } = await ensureLoaded();

  for (const entry of entries) {
    const key = normalizeRelativePath(entry.relativePath || toRelativePath(descriptor, source, entry.filePath));
    if (!key) continue;
    const prev = data.maps?.[key] || {};
    data.maps[key] = {
      ...prev,
      ...sanitizeMapMeta({ ...prev, ...entry.meta, source })
    };
  }

  await saveCurrent();
};

export const pruneProjectMeta = async ({ source, presentRelativePaths = [] }) => {
  const { descriptor, data } = await ensureLoaded();
  const normalized = new Set(
    presentRelativePaths
      .map((item) => normalizeRelativePath(item || toRelativePath(descriptor, source, item)))
      .filter(Boolean)
  );

  let changed = false;
  const keys = Object.keys(data.maps || {});
  for (const key of keys) {
    const mapMeta = data.maps[key];
    if (mapMeta?.source === source && !normalized.has(key)) {
      delete data.maps[key];
      changed = true;
    }
  }

  if (changed) {
    await saveCurrent();
  }
};

export const forceReloadProjectMeta = async () => {
  await ensureLoaded(true);
};
