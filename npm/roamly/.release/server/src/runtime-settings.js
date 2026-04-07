import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const settingsPath = path.resolve(config.dataDir, 'runtime-settings.json');

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const loadSettings = () => {
  if (!fs.existsSync(settingsPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_err) {
    return {};
  }
};

const normalizeRootPath = (inputPath) => {
  const raw = String(inputPath || '/').trim();
  if (!raw || raw === '.') return '/';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const compact = withSlash.replace(/\/+$/, '');
  return compact || '/';
};

const normalizePath = (inputPath) => {
  const value = String(inputPath || '').trim();
  if (!value) return '';
  if (value.startsWith('~')) {
    return path.resolve(process.env.HOME || '', value.slice(1));
  }
  return path.resolve(value);
};

const persisted = loadSettings();

const runtimeState = {
  storageDriver: persisted.storageDriver || config.storageDriver || 'local',
  mapLibraryDir: persisted.mapLibraryDir || config.mapLibraryDir || '',
  webdav: {
    url: persisted.webdav?.url || config.webdav.url || '',
    username: persisted.webdav?.username || config.webdav.username || '',
    password: persisted.webdav?.password || config.webdav.password || '',
    rootPath: normalizeRootPath(persisted.webdav?.rootPath || '/')
  }
};

const saveSettings = () => {
  fs.writeFileSync(settingsPath, JSON.stringify(runtimeState, null, 2));
};

const ensureStorageDriver = (driver) => {
  const value = String(driver || '').trim().toLowerCase();
  if (!['local', 'webdav'].includes(value)) {
    throw new Error('storageDriver 仅支持 local 或 webdav');
  }
  return value;
};

export const getStorageDriver = () => runtimeState.storageDriver;

export const setStorageDriver = (driver) => {
  runtimeState.storageDriver = ensureStorageDriver(driver);
  saveSettings();
  return runtimeState.storageDriver;
};

export const getMapLibraryDir = () => runtimeState.mapLibraryDir || '';

export const setMapLibraryDir = (inputPath) => {
  const resolved = normalizePath(inputPath);
  if (!resolved) {
    throw new Error('目录不能为空');
  }

  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch (_err) {
    throw new Error(`目录不存在: ${resolved}`);
  }

  if (!stat.isDirectory()) {
    throw new Error(`不是有效目录: ${resolved}`);
  }

  runtimeState.mapLibraryDir = resolved;
  saveSettings();
  return resolved;
};

export const getWebdavSettings = (withSecret = false) => {
  const base = {
    url: runtimeState.webdav.url || '',
    username: runtimeState.webdav.username || '',
    rootPath: normalizeRootPath(runtimeState.webdav.rootPath || '/')
  };

  if (withSecret) {
    return {
      ...base,
      password: runtimeState.webdav.password || ''
    };
  }

  return {
    ...base,
    password: runtimeState.webdav.password ? '********' : ''
  };
};

export const setWebdavSettings = (payload = {}) => {
  const next = {
    url: payload.url !== undefined ? String(payload.url || '').trim() : runtimeState.webdav.url,
    username: payload.username !== undefined ? String(payload.username || '').trim() : runtimeState.webdav.username,
    password: payload.password !== undefined
      ? String(payload.password || '').trim()
      : runtimeState.webdav.password,
    rootPath: payload.rootPath !== undefined
      ? normalizeRootPath(payload.rootPath)
      : normalizeRootPath(runtimeState.webdav.rootPath)
  };

  runtimeState.webdav = next;
  saveSettings();
  return getWebdavSettings(false);
};

export const updateStorageSettings = (payload = {}) => {
  if (payload.storageDriver !== undefined) {
    runtimeState.storageDriver = ensureStorageDriver(payload.storageDriver);
  }

  if (payload.mapLibraryDir !== undefined && String(payload.mapLibraryDir).trim()) {
    setMapLibraryDir(payload.mapLibraryDir);
  }

  if (payload.webdav && typeof payload.webdav === 'object') {
    setWebdavSettings(payload.webdav);
  }

  saveSettings();
  return getRuntimeSettings();
};

export const getProjectKey = () => {
  if (runtimeState.storageDriver === 'webdav') {
    const rootPath = normalizeRootPath(runtimeState.webdav.rootPath || '/');
    const url = runtimeState.webdav.url || '';
    return `webdav:${url}|${rootPath}`;
  }
  return `local:${runtimeState.mapLibraryDir || ''}`;
};

export const getRuntimeSettings = () => ({
  storageDriver: runtimeState.storageDriver,
  mapLibraryDir: runtimeState.mapLibraryDir || '',
  webdav: getWebdavSettings(false),
  projectKey: getProjectKey()
});

export const getSettingsPath = () => settingsPath;
