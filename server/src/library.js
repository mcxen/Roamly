import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import fg from 'fast-glob';
import { imageSize } from 'image-size';
import mime from 'mime-types';
import { createClient } from 'webdav';
import { statements, withTransaction, removeMissingForSource } from './db.js';
import { findCityCoordinate, matchChinaCityByFilename } from './location-dict.js';
import { getMapLibraryDir, getStorageDriver, getWebdavSettings } from './runtime-settings.js';
import {
  PROJECT_DIR_NAME,
  PROJECT_FILE_NAME,
  batchMergeProjectMeta,
  loadProjectMetaSnapshot,
  pruneProjectMeta
} from './project-store.js';
import { logger } from './logger.js';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif'];
const GLOBAL_BASE_LOCATION = {
  scope_level: 'international',
  country_code: 'WORLD',
  country_name: '全球',
  province: null,
  city: null,
  district: null,
  latitude: null,
  longitude: null
};

const isImageFile = (filePath) => IMAGE_EXTS.includes(path.extname(filePath).slice(1).toLowerCase());
const hashId = (input) => crypto.createHash('sha1').update(input).digest('hex');
const nowIso = () => new Date().toISOString();

const normalizeTitle = (fileName) => {
  const base = fileName.replace(/\.[^/.]+$/, '');
  return base.replace(/[_-]+/g, ' ').trim();
};

const normalizeSegments = (rawPath) => {
  return String(rawPath || '')
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeWebdavRootPath = (inputPath) => {
  const raw = String(inputPath || '/').trim();
  if (!raw || raw === '.') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const compact = withSlash.replace(/\/+$/, '');
  return compact || '/';
};

const toRelativeWebdavPath = (rootPath, absolutePath) => {
  const root = normalizeWebdavRootPath(rootPath);
  const normalized = `/${String(absolutePath || '').replace(/^\/+/, '')}`;
  if (normalized === root) return '';
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  return normalized.replace(/^\/+/, '');
};

const joinWebdavPath = (rootPath, relativePath) => {
  const root = normalizeWebdavRootPath(rootPath);
  const rel = String(relativePath || '').replace(/^\/+/, '');
  if (!rel) return root;
  if (root === '/') return `/${rel}`;
  return `${root}/${rel}`.replace(/\/+/g, '/');
};

const parseScope = (segment) => {
  const value = (segment || '').toLowerCase();
  if (['national', 'china', 'cn', '国内', '中国'].includes(value)) return 'national';
  if (['international', 'global', 'world', 'intl', '国际', '海外'].includes(value)) return 'international';
  return null;
};

const inferByPath = (relativePath) => {
  const segments = normalizeSegments(String(relativePath || '').replace(/\\/g, '/'));
  if (!segments.length) {
    return { ...GLOBAL_BASE_LOCATION };
  }

  const dirSegments = segments.slice(0, -1);
  let scope = parseScope(dirSegments[0]);
  let countryName = null;
  let countryCode = null;
  let province = null;
  let city = null;
  let district = null;

  if (scope === 'national') {
    countryCode = 'CN';
    countryName = '中国';
    province = dirSegments[2] || dirSegments[1] || null;
    city = dirSegments[3] || null;
    district = dirSegments[4] || dirSegments[3] || null;
  } else if (scope === 'international') {
    countryName = dirSegments[1] || null;
    province = dirSegments[2] || null;
    city = dirSegments[3] || null;
    district = dirSegments[4] || dirSegments[3] || null;
  } else {
    countryName = dirSegments[0] || null;
    province = dirSegments[1] || null;
    city = dirSegments[2] || null;
    district = dirSegments[3] || null;
    if (countryName === '中国' || countryName === 'CN') {
      scope = 'national';
      countryCode = 'CN';
      countryName = '中国';
    } else if (countryName) {
      scope = 'international';
    }
  }

  const guess = findCityCoordinate({ countryCode, city });
  const inferred = {
    scope_level: scope,
    country_code: countryCode || (guess ? guess.country_code : null),
    country_name: countryName || (guess ? guess.country_name : null),
    province: province || (guess ? guess.province : null),
    city,
    district,
    latitude: guess ? guess.latitude : null,
    longitude: guess ? guess.longitude : null
  };

  if (!inferred.scope_level && !inferred.country_code && !inferred.country_name) {
    return { ...GLOBAL_BASE_LOCATION };
  }

  return inferred;
};

const mergeInferred = (pathInferred, fileNameInferred) => {
  if (!fileNameInferred) return pathInferred;
  const merged = {
    scope_level: pathInferred.scope_level || fileNameInferred.scope_level || null,
    country_code: pathInferred.country_code || fileNameInferred.country_code || null,
    country_name: pathInferred.country_name || fileNameInferred.country_name || null,
    province: pathInferred.province || fileNameInferred.province || null,
    city: pathInferred.city || fileNameInferred.city || null,
    district: pathInferred.district || fileNameInferred.district || null,
    latitude: pathInferred.latitude ?? fileNameInferred.latitude ?? null,
    longitude: pathInferred.longitude ?? fileNameInferred.longitude ?? null
  };

  if (!merged.scope_level && !merged.country_code && !merged.country_name) {
    return { ...GLOBAL_BASE_LOCATION };
  }

  return merged;
};

const ensurePathInsideRoot = (rootDir, targetPath) => {
  const normalizedRoot = path.resolve(rootDir);
  const normalizedTarget = path.resolve(targetPath);
  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error('目录越界，拒绝写入');
  }
  return normalizedTarget;
};

const sanitizeRelativeFolder = (folder) => {
  return String(folder || '')
    .replace(/\\/g, '/')
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .trim();
};

const ensureUniqueFilePath = async (basePath) => {
  if (!fs.existsSync(basePath)) {
    return basePath;
  }

  const parsed = path.parse(basePath);
  let index = 1;
  while (index < 10000) {
    const nextPath = path.join(parsed.dir, `${parsed.name}_${index}${parsed.ext}`);
    if (!fs.existsSync(nextPath)) {
      return nextPath;
    }
    index += 1;
  }

  throw new Error('同名文件过多，无法自动命名');
};

const normalizeUploadFileName = (originalName) => {
  const raw = String(originalName || '').trim();
  if (!raw) return 'unnamed';

  const hasCjk = /[\u4e00-\u9fff]/.test(raw);
  if (hasCjk) return raw;

  const maybeDecoded = Buffer.from(raw, 'latin1').toString('utf8');
  const decodedHasCjk = /[\u4e00-\u9fff]/.test(maybeDecoded);
  if (decodedHasCjk) return maybeDecoded;

  return raw;
};

const getWebdavContext = () => {
  const webdav = getWebdavSettings(true);
  if (!webdav.url) {
    throw new Error('WEBDAV_URL 未设置');
  }

  const rootPath = normalizeWebdavRootPath(webdav.rootPath || '/');
  const client = createClient(webdav.url, {
    username: webdav.username,
    password: webdav.password
  });

  return {
    client,
    rootPath,
    webdav
  };
};

const parseTagsValue = (tagsValue) => {
  if (!tagsValue) return [];
  if (Array.isArray(tagsValue)) {
    return tagsValue.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof tagsValue === 'string') {
    try {
      const parsed = JSON.parse(tagsValue);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch (_err) {
      // ignore
    }
  }
  return [];
};

const toRowFromProjectMeta = ({
  id,
  filePath,
  fileName,
  title,
  mimeType,
  width,
  height,
  sizeBytes,
  mtimeMs,
  source,
  inferred,
  nowIso,
  persistedMeta
}) => {
  const persistedTags = parseTagsValue(persistedMeta?.tags);

  const sameOcrMtime = persistedMeta?.ocr_mtime_ms !== null
    && persistedMeta?.ocr_mtime_ms !== undefined
    && mtimeMs !== null
    && mtimeMs !== undefined
    && Math.abs(Number(persistedMeta.ocr_mtime_ms) - Number(mtimeMs)) < 1;

  return {
    id,
    file_path: filePath,
    file_name: fileName,
    title: persistedMeta?.title || title,
    description: persistedMeta?.description || null,
    tags: persistedTags.length ? JSON.stringify(persistedTags) : null,
    collection_unit: persistedMeta?.collection_unit || null,
    scope_level: persistedMeta?.scope_level || inferred.scope_level || GLOBAL_BASE_LOCATION.scope_level,
    country_code: persistedMeta?.country_code || inferred.country_code || GLOBAL_BASE_LOCATION.country_code,
    country_name: persistedMeta?.country_name || inferred.country_name || GLOBAL_BASE_LOCATION.country_name,
    province: persistedMeta?.province || inferred.province,
    city: persistedMeta?.city || inferred.city,
    district: persistedMeta?.district || inferred.district,
    latitude: persistedMeta?.latitude ?? inferred.latitude,
    longitude: persistedMeta?.longitude ?? inferred.longitude,
    year_label: persistedMeta?.year_label || null,
    mime: mimeType,
    width,
    height,
    size_bytes: sizeBytes,
    mtime_ms: mtimeMs,
    source,
    favorite: persistedMeta?.favorite ? 1 : 0,
    ocr_text: sameOcrMtime ? (persistedMeta?.ocr_text || null) : null,
    ocr_status: sameOcrMtime ? (persistedMeta?.ocr_status || null) : null,
    ocr_error: sameOcrMtime ? (persistedMeta?.ocr_error || null) : null,
    ocr_updated_at: sameOcrMtime ? (persistedMeta?.ocr_updated_at || null) : null,
    ocr_mtime_ms: sameOcrMtime ? (persistedMeta?.ocr_mtime_ms ?? null) : null,
    created_at: nowIso,
    updated_at: nowIso
  };
};

const rowToProjectMeta = (row) => ({
  title: row.title || null,
  description: row.description || null,
  tags: parseTagsValue(row.tags),
  collection_unit: row.collection_unit || null,
  scope_level: row.scope_level || null,
  country_code: row.country_code || null,
  country_name: row.country_name || null,
  province: row.province || null,
  city: row.city || null,
  district: row.district || null,
  latitude: row.latitude ?? null,
  longitude: row.longitude ?? null,
  year_label: row.year_label || null,
  favorite: Boolean(row.favorite),
  ocr_text: row.ocr_text || null,
  ocr_status: row.ocr_status || null,
  ocr_error: row.ocr_error || null,
  ocr_updated_at: row.ocr_updated_at || null,
  ocr_mtime_ms: row.ocr_mtime_ms ?? null,
  updated_at: row.updated_at || nowIso()
});

const ensureUniqueWebdavPath = async (client, targetPath) => {
  const parsed = path.posix.parse(targetPath);
  let candidate = targetPath;
  let index = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const exists = await client.exists(candidate).catch(() => false);
    if (!exists) return candidate;

    candidate = `${parsed.dir}/${parsed.name}_${index}${parsed.ext}`.replace(/\/+/g, '/');
    index += 1;
    if (index > 10000) {
      throw new Error('同名 WebDAV 文件过多，无法自动命名');
    }
  }
};

export const listLocalDirectories = async ({ maxDepth = 6 } = {}) => {
  const rootDir = getMapLibraryDir();
  if (!rootDir) return [];
  if (!fs.existsSync(rootDir)) return [];

  const results = [''];

  const walk = async (absDir, relativeDir, depth) => {
    if (depth > maxDepth) return;

    let entries = [];
    try {
      entries = await fsp.readdir(absDir, { withFileTypes: true });
    } catch (_err) {
      return;
    }

    const folders = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== PROJECT_DIR_NAME)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));

    for (const folder of folders) {
      const nextRelative = relativeDir ? `${relativeDir}/${folder.name}` : folder.name;
      const nextAbs = path.join(absDir, folder.name);
      results.push(nextRelative);
      await walk(nextAbs, nextRelative, depth + 1);
    }
  };

  await walk(rootDir, '', 1);
  return results;
};

export const listWebdavDirectories = async ({ maxDepth = 6 } = {}) => {
  const { client, rootPath } = getWebdavContext();
  const items = await client.getDirectoryContents(rootPath, { deep: true });
  const set = new Set(['']);

  for (const item of items) {
    if (item.type !== 'directory') continue;
    const relativePath = toRelativeWebdavPath(rootPath, item.filename || '');
    if (!relativePath) continue;
    if (relativePath.startsWith(`${PROJECT_DIR_NAME}/`) || relativePath === PROJECT_DIR_NAME) {
      continue;
    }

    const depth = relativePath.split('/').length;
    if (depth <= maxDepth) {
      set.add(relativePath);
    }
  }

  return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-CN'));
};

export const scanLocalLibrary = async () => {
  const rootDir = getMapLibraryDir();
  if (!rootDir) {
    throw new Error('MAP_LIBRARY_DIR is required for local mode');
  }
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Map folder does not exist: ${rootDir}`);
  }

  const projectSnapshot = await loadProjectMetaSnapshot();

  const files = await fg(['**/*.*'], {
    cwd: rootDir,
    onlyFiles: true,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**', `**/${PROJECT_DIR_NAME}/**`]
  });

  const imageFiles = files.filter(isImageFile);
  const nowIsoValue = nowIso();
  const presentPaths = [];
  const presentRelativePaths = [];
  const projectEntries = [];

  withTransaction(() => {
    for (const absPath of imageFiles) {
      let stat;
      try {
        stat = fs.statSync(absPath);
      } catch (err) {
        logger.warn({ err, absPath }, 'Failed to stat local map file');
        continue;
      }

      const relativePath = path.relative(rootDir, absPath).replace(/\\/g, '/');
      const fileName = path.basename(absPath);
      const title = normalizeTitle(fileName);

      let width = null;
      let height = null;
      try {
        const dimensions = imageSize(absPath);
        width = dimensions.width || null;
        height = dimensions.height || null;
      } catch (_err) {
        // ignore invalid dimensions
      }

      const inferred = mergeInferred(inferByPath(relativePath), matchChinaCityByFilename(fileName));
      const persistedMeta = projectSnapshot.maps?.[relativePath] || null;

      const row = toRowFromProjectMeta({
        id: hashId(`local:${absPath}`),
        filePath: absPath,
        fileName,
        title,
        mimeType: mime.lookup(absPath) || 'application/octet-stream',
        width,
        height,
        sizeBytes: stat.size,
        mtimeMs: stat.mtimeMs,
        source: 'local',
        inferred,
        nowIso: nowIsoValue,
        persistedMeta
      });

      statements.upsertMap.run(row);
      presentPaths.push(absPath);
      presentRelativePaths.push(relativePath);
      projectEntries.push({
        relativePath,
        meta: rowToProjectMeta(row)
      });
    }
  });

  removeMissingForSource({ source: 'local', presentPaths });
  await pruneProjectMeta({ source: 'local', presentRelativePaths });
  await batchMergeProjectMeta({ source: 'local', entries: projectEntries });

  return { source: 'local', scanned: presentPaths.length };
};

export const scanWebdavLibrary = async () => {
  const { client, rootPath } = getWebdavContext();
  const projectSnapshot = await loadProjectMetaSnapshot();

  const items = await client.getDirectoryContents(rootPath, { deep: true });
  const files = items
    .filter((item) => item.type === 'file' && isImageFile(item.filename))
    .filter((item) => {
      const relative = toRelativeWebdavPath(rootPath, item.filename);
      return !relative.startsWith(`${PROJECT_DIR_NAME}/`) && relative !== PROJECT_FILE_NAME;
    });

  const nowIsoValue = nowIso();
  const presentPaths = [];
  const presentRelativePaths = [];
  const projectEntries = [];

  withTransaction(() => {
    for (const item of files) {
      const filePath = item.filename;
      const fileName = path.basename(filePath);
      const relativePath = toRelativeWebdavPath(rootPath, filePath);
      const inferred = mergeInferred(inferByPath(relativePath), matchChinaCityByFilename(fileName));
      const persistedMeta = projectSnapshot.maps?.[relativePath] || null;

      const row = toRowFromProjectMeta({
        id: hashId(`webdav:${filePath}`),
        filePath,
        fileName,
        title: normalizeTitle(fileName),
        mimeType: item.mime || mime.lookup(fileName) || 'application/octet-stream',
        width: null,
        height: null,
        sizeBytes: item.size || null,
        mtimeMs: item.lastmod ? new Date(item.lastmod).getTime() : null,
        source: 'webdav',
        inferred,
        nowIso: nowIsoValue,
        persistedMeta
      });

      statements.upsertMap.run(row);
      presentPaths.push(filePath);
      presentRelativePaths.push(relativePath);
      projectEntries.push({
        relativePath,
        meta: rowToProjectMeta(row)
      });
    }
  });

  removeMissingForSource({ source: 'webdav', presentPaths });
  await pruneProjectMeta({ source: 'webdav', presentRelativePaths });
  await batchMergeProjectMeta({ source: 'webdav', entries: projectEntries });

  return { source: 'webdav', scanned: presentPaths.length };
};

export const scanLibrary = async () => {
  if (getStorageDriver() === 'webdav') return scanWebdavLibrary();
  return scanLocalLibrary();
};

export const getImageStream = (mapRow) => {
  if (mapRow.source === 'webdav') {
    const { client } = getWebdavContext();
    return client.createReadStream(mapRow.file_path);
  }
  return fs.createReadStream(mapRow.file_path);
};

export const saveUploadToStorage = async ({ file, folder = '' }) => {
  const cleanFolder = sanitizeRelativeFolder(folder);
  const normalizedName = normalizeUploadFileName(file.originalname);

  if (getStorageDriver() === 'webdav') {
    const { client, rootPath } = getWebdavContext();
    const relativeTarget = cleanFolder ? `${cleanFolder}/${normalizedName}` : normalizedName;
    const desiredPath = joinWebdavPath(rootPath, relativeTarget);
    const targetPath = await ensureUniqueWebdavPath(client, desiredPath);

    const targetDir = targetPath.split('/').slice(0, -1).join('/') || '/';
    await client.createDirectory(targetDir, { recursive: true }).catch(() => {});

    const content = await fsp.readFile(file.path);
    await client.putFileContents(targetPath, content, { overwrite: false });
    await fsp.unlink(file.path).catch(() => {});
    return targetPath;
  }

  const rootDir = getMapLibraryDir();
  if (!rootDir) {
    throw new Error('MAP_LIBRARY_DIR is required for local uploads');
  }

  const targetDir = ensurePathInsideRoot(rootDir, path.resolve(rootDir, cleanFolder));
  await fsp.mkdir(targetDir, { recursive: true });

  const desiredPath = path.join(targetDir, normalizedName);
  const targetPath = await ensureUniqueFilePath(desiredPath);
  await fsp.copyFile(file.path, targetPath);
  await fsp.unlink(file.path).catch(() => {});

  return targetPath;
};
