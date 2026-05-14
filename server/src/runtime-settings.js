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

const ensureStorageDriver = (driver) => {
  const value = String(driver || '').trim().toLowerCase();
  if (!['local', 'server', 'webdav'].includes(value)) {
    throw new Error('storageDriver 仅支持 local、server 或 webdav');
  }
  return value;
};

const genId = () => Math.random().toString(36).slice(2, 10);

const migrateAISettings = (ai) => {
  if (ai && Array.isArray(ai.providers)) {
    return { providers: ai.providers, activeId: ai.activeId || ai.providers[0]?.id || '' };
  }
  // Migrate from old single-config format
  const apiUrl = process.env.AI_API_URL || ai?.apiUrl || '';
  const apiKey = process.env.AI_API_KEY || ai?.apiKey || '';
  const model = process.env.AI_MODEL || ai?.model || '';
  const provider = process.env.AI_PROVIDER || ai?.provider || 'openai-compatible';
  const systemPrompt = ai?.systemPrompt || '';
  if (!apiUrl && !apiKey && !model) {
    return { providers: [], activeId: '' };
  }
  const id = genId();
  return {
    providers: [{ id, name: provider, provider, apiUrl, apiKey, model, systemPrompt }],
    activeId: id
  };
};

const runtimeState = {
  storageDriver: ensureStorageDriver(process.env.STORAGE_DRIVER || persisted.storageDriver || config.storageDriver || 'local'),
  mapLibraryDir: normalizePath(process.env.MAP_LIBRARY_DIR || persisted.mapLibraryDir || config.mapLibraryDir || ''),
  serverMapDir: normalizePath(process.env.SERVER_MAP_DIR || persisted.serverMapDir || config.serverMapDir || path.resolve(config.dataDir, 'maps')),
  ai: migrateAISettings(persisted.ai),
  rss: {
    enabled: persisted.rss?.enabled ?? true,
    title: persisted.rss?.title || 'Roamly 每日地图推荐',
    description: persisted.rss?.description || '每日精选 10 张历史地图，附 AI 自动整理描述',
    history: Array.isArray(persisted.rss?.history) ? persisted.rss.history : []
  },
  discover: {
    showCard: persisted.discover?.showCard ?? true,
    prompt: persisted.discover?.prompt || '你是地图馆每日推荐助手。根据当前日期、时间和天气信息，用 2-3 句话推荐今天适合浏览的地图主题或方向，语气轻松有趣。只输出推荐语，不要输出其他内容。'
  },
  webdav: {
    url: process.env.WEBDAV_URL || persisted.webdav?.url || config.webdav.url || '',
    username: process.env.WEBDAV_USER || persisted.webdav?.username || config.webdav.username || '',
    password: process.env.WEBDAV_PASS || persisted.webdav?.password || config.webdav.password || '',
    rootPath: normalizeRootPath(process.env.WEBDAV_ROOT_PATH ?? persisted.webdav?.rootPath ?? config.webdav.rootPath ?? '/')
  }
};

const saveSettings = () => {
  fs.writeFileSync(settingsPath, JSON.stringify(runtimeState, null, 2));
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

export const getServerMapDir = () => runtimeState.serverMapDir || normalizePath(config.serverMapDir || path.resolve(config.dataDir, 'maps'));

export const setServerMapDir = (inputPath) => {
  const resolved = normalizePath(inputPath || config.serverMapDir || path.resolve(config.dataDir, 'maps'));
  if (!resolved) {
    throw new Error('服务端目录不能为空');
  }

  fs.mkdirSync(resolved, { recursive: true });
  runtimeState.serverMapDir = resolved;
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

  if (payload.serverMapDir !== undefined && String(payload.serverMapDir).trim()) {
    setServerMapDir(payload.serverMapDir);
  }

  if (payload.webdav && typeof payload.webdav === 'object') {
    setWebdavSettings(payload.webdav);
  }

  saveSettings();
  return getRuntimeSettings();
};

export const getAISettings = (withSecret = false) => {
  const active = runtimeState.ai.providers.find((p) => p.id === runtimeState.ai.activeId) || runtimeState.ai.providers[0];
  if (!active) {
    return { apiUrl: '', model: '', provider: 'openai-compatible', systemPrompt: '', apiKey: '' };
  }
  return {
    apiUrl: active.apiUrl || '',
    model: active.model || '',
    provider: active.provider || 'openai-compatible',
    systemPrompt: active.systemPrompt || '',
    apiKey: withSecret ? (active.apiKey || '') : (active.apiKey ? '********' : '')
  };
};

export const setAISettings = (payload = {}) => {
  const active = runtimeState.ai.providers.find((p) => p.id === runtimeState.ai.activeId);
  if (active) {
    if (payload.apiUrl !== undefined) active.apiUrl = String(payload.apiUrl || '').trim();
    if (payload.apiKey !== undefined && String(payload.apiKey || '').trim()) active.apiKey = String(payload.apiKey).trim();
    if (payload.model !== undefined) active.model = String(payload.model || '').trim();
    if (payload.provider !== undefined) active.provider = String(payload.provider || '').trim();
    if (payload.systemPrompt !== undefined) active.systemPrompt = String(payload.systemPrompt || '').trim();
  } else {
    const id = genId();
    runtimeState.ai.providers.push({
      id,
      name: payload.provider || 'openai-compatible',
      provider: String(payload.provider || 'openai-compatible').trim(),
      apiUrl: String(payload.apiUrl || '').trim(),
      apiKey: String(payload.apiKey || '').trim(),
      model: String(payload.model || '').trim(),
      systemPrompt: String(payload.systemPrompt || '').trim()
    });
    runtimeState.ai.activeId = id;
  }
  saveSettings();
  return getAISettings(false);
};

export const getAIProviderConfigs = (withSecret = false) => {
  return {
    activeId: runtimeState.ai.activeId,
    providers: runtimeState.ai.providers.map((p) => ({
      ...p,
      apiKey: withSecret ? (p.apiKey || '') : (p.apiKey ? '********' : '')
    }))
  };
};

export const saveAIProviderConfig = (payload = {}) => {
  const id = payload.id || genId();
  const existing = runtimeState.ai.providers.find((p) => p.id === id);
  if (existing) {
    if (payload.name !== undefined) existing.name = String(payload.name || '').trim();
    if (payload.provider !== undefined) existing.provider = String(payload.provider || '').trim();
    if (payload.apiUrl !== undefined) existing.apiUrl = String(payload.apiUrl || '').trim();
    if (payload.apiKey !== undefined && String(payload.apiKey || '').trim()) existing.apiKey = String(payload.apiKey).trim();
    if (payload.model !== undefined) existing.model = String(payload.model || '').trim();
    if (payload.systemPrompt !== undefined) existing.systemPrompt = String(payload.systemPrompt || '').trim();
  } else {
    runtimeState.ai.providers.push({
      id,
      name: String(payload.name || payload.provider || 'openai-compatible').trim(),
      provider: String(payload.provider || 'openai-compatible').trim(),
      apiUrl: String(payload.apiUrl || '').trim(),
      apiKey: String(payload.apiKey || '').trim(),
      model: String(payload.model || '').trim(),
      systemPrompt: String(payload.systemPrompt || '').trim()
    });
  }
  if (payload.activate || !runtimeState.ai.activeId) {
    runtimeState.ai.activeId = id;
  }
  saveSettings();
  return { id, ...getAIProviderConfigs(false) };
};

export const deleteAIProviderConfig = (id) => {
  runtimeState.ai.providers = runtimeState.ai.providers.filter((p) => p.id !== id);
  if (runtimeState.ai.activeId === id) {
    runtimeState.ai.activeId = runtimeState.ai.providers[0]?.id || '';
  }
  saveSettings();
  return getAIProviderConfigs(false);
};

export const activateAIProvider = (id) => {
  const found = runtimeState.ai.providers.find((p) => p.id === id);
  if (!found) throw new Error('Provider 配置不存在');
  runtimeState.ai.activeId = id;
  saveSettings();
  return getAIProviderConfigs(false);
};

export const getProjectKey = () => {
  if (runtimeState.storageDriver === 'webdav') {
    const rootPath = normalizeRootPath(runtimeState.webdav.rootPath || '/');
    const url = runtimeState.webdav.url || '';
    return `webdav:${url}|${rootPath}`;
  }
  if (runtimeState.storageDriver === 'server') {
    return `server:${runtimeState.serverMapDir || ''}`;
  }
  return `local:${runtimeState.mapLibraryDir || ''}`;
};

export const getRuntimeSettings = () => ({
  storageDriver: runtimeState.storageDriver,
  mapLibraryDir: runtimeState.mapLibraryDir || '',
  serverMapDir: getServerMapDir(),
  webdav: getWebdavSettings(false),
  ai: getAISettings(false),
  projectKey: getProjectKey()
});

export const getRssSettings = () => ({
  enabled: runtimeState.rss.enabled,
  title: runtimeState.rss.title,
  description: runtimeState.rss.description,
  history: runtimeState.rss.history
});

export const setRssSettings = (payload = {}) => {
  if (payload.enabled !== undefined) runtimeState.rss.enabled = Boolean(payload.enabled);
  if (payload.title !== undefined) runtimeState.rss.title = String(payload.title || '').trim();
  if (payload.description !== undefined) runtimeState.rss.description = String(payload.description || '').trim();
  saveSettings();
  return getRssSettings();
};

export const addRssHistory = (entry) => {
  runtimeState.rss.history.unshift(entry);
  if (runtimeState.rss.history.length > 50) runtimeState.rss.history.length = 50;
  saveSettings();
};

export const getDiscoverSettings = () => ({ ...runtimeState.discover });

export const setDiscoverSettings = (payload = {}) => {
  if (payload.showCard !== undefined) runtimeState.discover.showCard = Boolean(payload.showCard);
  if (payload.prompt !== undefined) runtimeState.discover.prompt = String(payload.prompt || '').trim();
  saveSettings();
  return getDiscoverSettings();
};

export const getSettingsPath = () => settingsPath;
