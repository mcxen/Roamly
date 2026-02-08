import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { createClient } from 'webdav';
import { dbInstance, rowToMap, statements, toTagsJson } from './db.js';
import { logger } from './logger.js';
import { getWebdavSettings } from './runtime-settings.js';
import { extractChinaRegionMentions, findCityCoordinate } from './location-dict.js';
import { upsertProjectMeta } from './project-store.js';

const execFileAsync = promisify(execFile);

const runtime = {
  enabled: (process.env.OCR_ENABLED || 'true').toLowerCase() === 'true',
  available: false,
  checking: false,
  processing: false,
  queue: [],
  queueSet: new Set(),
  lang: process.env.OCR_LANG || 'chi_sim+eng',
  lastError: '',
  workerSource: null
};

const KEYWORD_TAGS = [
  { regex: /铁路|站台|车站|中东铁路/g, tag: '铁路' },
  { regex: /建筑|街区|街道|城市规划/g, tag: '建筑' },
  { regex: /边界|边疆|疆域|版图/g, tag: '疆域' },
  { regex: /河|江|湖|海|湾|港/g, tag: '水系' },
  { regex: /军事|军舰|阵地|战役|兵/g, tag: '军事' },
  { regex: /旅游|景点|公园|博物馆/g, tag: '旅游' },
  { regex: /古|旧|清|民国|民國|明|元|唐|宋/g, tag: '历史' }
];

const COUNTRY_HINTS = [
  { code: 'CN', name: '中国', aliases: ['中国', '中华', '大陆'] },
  { code: 'JP', name: '日本', aliases: ['日本', '东京', '大阪', '北海道'] },
  { code: 'US', name: '美国', aliases: ['美国', '美利坚', 'united states', 'usa', 'u.s.'] },
  { code: 'RU', name: '俄罗斯', aliases: ['俄罗斯', '苏联', '俄国', 'russia'] },
  { code: 'GB', name: '英国', aliases: ['英国', '英格兰', 'britain', 'united kingdom'] },
  { code: 'FR', name: '法国', aliases: ['法国', 'france'] },
  { code: 'DE', name: '德国', aliases: ['德国', 'germany'] },
  { code: 'KR', name: '韩国', aliases: ['韩国', '朝鲜半岛', 'south korea'] },
  { code: 'KP', name: '朝鲜', aliases: ['朝鲜', 'north korea'] },
  { code: 'IN', name: '印度', aliases: ['印度', 'india'] },
  { code: 'CA', name: '加拿大', aliases: ['加拿大', 'canada'] },
  { code: 'AU', name: '澳大利亚', aliases: ['澳大利亚', '澳洲', 'australia'] },
  { code: 'BR', name: '巴西', aliases: ['巴西', 'brazil'] },
  { code: 'IT', name: '意大利', aliases: ['意大利', 'italy'] },
  { code: 'ES', name: '西班牙', aliases: ['西班牙', 'spain'] },
  { code: 'MX', name: '墨西哥', aliases: ['墨西哥', 'mexico'] }
];

const GLOBAL_SCOPE_REGEX = /世界|全球|global|world|international|洲际|跨洲|亚欧|欧亚/iu;

const normalizeText = (input) => {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F]/g, '')
    .trim();
};

const nowIso = () => new Date().toISOString();

const detectCountryMentions = (text) => {
  const raw = String(text || '');
  const lower = raw.toLowerCase();
  const found = [];

  for (const item of COUNTRY_HINTS) {
    const hit = item.aliases.some((alias) => {
      const token = String(alias || '').trim();
      if (!token) return false;
      const ascii = /^[a-z0-9.\s-]+$/i.test(token);
      if (ascii) {
        return lower.includes(token.toLowerCase());
      }
      return raw.includes(token);
    });

    if (hit) {
      found.push(item);
    }
  }

  return found;
};

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
      ORDER BY mtime_ms DESC
      LIMIT @limit
    `).all({ limit });
  }

  return dbInstance.prepare(`
    SELECT id
    FROM maps
    WHERE (
      ocr_mtime_ms IS NULL
      OR ocr_mtime_ms != mtime_ms
      OR ocr_status IS NULL
      OR ocr_status = 'error'
    )
    ORDER BY mtime_ms DESC
    LIMIT @limit
  `).all({ limit });
};

const readWebdavToTempFile = async (remotePath) => {
  const webdav = getWebdavSettings(true);
  if (!webdav.url) {
    throw new Error('webdav_not_configured');
  }

  const client = createClient(webdav.url, {
    username: webdav.username,
    password: webdav.password
  });

  const content = await client.getFileContents(remotePath, { format: 'binary' });
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

  const ext = path.extname(remotePath) || '.img';
  const tempPath = path.resolve(
    os.tmpdir(),
    `roamly-ocr-${crypto.randomBytes(8).toString('hex')}${ext}`
  );

  await fsp.writeFile(tempPath, buffer);
  return tempPath;
};

const recognizeImageText = async ({ source, imagePath }) => {
  let actualPath = imagePath;
  let cleanupPath = '';

  if (source === 'webdav') {
    actualPath = await readWebdavToTempFile(imagePath);
    cleanupPath = actualPath;
  }

  if (!fs.existsSync(actualPath)) {
    throw new Error(`image_missing:${actualPath}`);
  }

  try {
    const args = [actualPath, 'stdout', '-l', runtime.lang, '--psm', '6'];
    const { stdout } = await execFileAsync('tesseract', args, {
      maxBuffer: 12 * 1024 * 1024,
      timeout: 120000
    });

    return normalizeText(stdout);
  } finally {
    if (cleanupPath) {
      await fsp.unlink(cleanupPath).catch(() => {});
    }
  }
};

const deriveMetaFromText = (text) => {
  const value = String(text || '');
  if (!value) {
    return {
      tags: [],
      scope_level: null,
      country_code: null,
      country_name: null,
      province: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null
    };
  }

  const tags = [];
  for (const item of KEYWORD_TAGS) {
    if (item.regex.test(value)) {
      tags.push(item.tag);
    }
    item.regex.lastIndex = 0;
  }

  const chinaMentions = extractChinaRegionMentions(value);
  const mentionedCountries = detectCountryMentions(value);
  const hasChinaIndicators = /中国|中华|省|自治区|地级市|县志|府图/.test(value)
    || chinaMentions.provinces.length > 0
    || chinaMentions.cities.length > 0;

  const countries = [...mentionedCountries];
  if (hasChinaIndicators && !countries.some((item) => item.code === 'CN')) {
    countries.push({ code: 'CN', name: '中国' });
  }

  for (const country of countries) {
    tags.push(country.name);
  }

  const uniqueProvinces = Array.from(new Set(chinaMentions.provinces));
  const uniqueCities = Array.from(new Set(chinaMentions.cities));
  const isGlobal = GLOBAL_SCOPE_REGEX.test(value) || countries.length >= 2;

  if (isGlobal) {
    tags.push('全球');
    tags.push('国际');
    return {
      tags: Array.from(new Set(tags)).filter(Boolean),
      scope_level: 'international',
      country_code: 'WORLD',
      country_name: '全球',
      province: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null
    };
  }

  const country = countries[0] || null;
  if (country && country.code !== 'CN') {
    return {
      tags: Array.from(new Set(tags)).filter(Boolean),
      scope_level: 'international',
      country_code: country.code,
      country_name: country.name,
      province: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null
    };
  }

  if (country?.code === 'CN' || hasChinaIndicators) {
    tags.push('中国');
    for (const province of uniqueProvinces.slice(0, 8)) {
      tags.push(province);
    }

    if (uniqueProvinces.length >= 2) {
      return {
        tags: Array.from(new Set(tags)).filter(Boolean),
        scope_level: 'national',
        country_code: 'CN',
        country_name: '中国',
        province: null,
        city: null,
        district: null,
        latitude: null,
        longitude: null
      };
    }

    const province = uniqueProvinces[0] || null;
    const city = uniqueCities.length === 1 ? uniqueCities[0] : null;
    const coordinate = city
      ? findCityCoordinate({ countryCode: 'CN', city })
      : null;

    return {
      tags: Array.from(new Set(tags)).filter(Boolean),
      scope_level: 'national',
      country_code: 'CN',
      country_name: '中国',
      province,
      city,
      district: null,
      latitude: coordinate?.latitude ?? null,
      longitude: coordinate?.longitude ?? null
    };
  }

  return {
    tags: Array.from(new Set(tags)).filter(Boolean),
    scope_level: null,
    country_code: null,
    country_name: null,
    province: null,
    city: null,
    district: null,
    latitude: null,
    longitude: null
  };
};

const mergeArrayUnique = (a, b) => {
  return Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter(Boolean)));
};

const mergeLocationByPriority = (latest, derived) => {
  if (!derived?.scope_level) {
    return {
      scope_level: latest.scope_level || null,
      country_code: latest.country_code || null,
      country_name: latest.country_name || null,
      province: latest.province || null,
      city: latest.city || null,
      district: latest.district || null,
      latitude: latest.latitude ?? null,
      longitude: latest.longitude ?? null
    };
  }

  // OCR 命中跨国关键词时，强制收敛到全球范围，避免被旧的城市定位覆盖。
  if (derived.country_code === 'WORLD') {
    return {
      scope_level: 'international',
      country_code: 'WORLD',
      country_name: '全球',
      province: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null
    };
  }

  // OCR 命中多个中国省份时，收敛到中国层级。
  if (derived.country_code === 'CN' && !derived.province && !derived.city) {
    return {
      scope_level: 'national',
      country_code: 'CN',
      country_name: '中国',
      province: null,
      city: null,
      district: null,
      latitude: null,
      longitude: null
    };
  }

  return {
    scope_level: derived.scope_level || latest.scope_level || null,
    country_code: derived.country_code || latest.country_code || null,
    country_name: derived.country_name || latest.country_name || null,
    province: derived.province ?? latest.province ?? null,
    city: derived.city ?? latest.city ?? null,
    district: derived.district ?? latest.district ?? null,
    latitude: derived.latitude ?? latest.latitude ?? null,
    longitude: derived.longitude ?? latest.longitude ?? null
  };
};

const processQueue = async () => {
  if (runtime.processing) return;
  if (!runtime.available) return;

  runtime.processing = true;

  while (runtime.queue.length > 0) {
    const id = runtime.queue.shift();
    runtime.queueSet.delete(id);

    const rowRaw = statements.findById.get(id);
    if (!rowRaw) {
      continue;
    }

    const tick = nowIso();
    statements.markOcrProcessing.run({
      id,
      ocr_updated_at: tick,
      updated_at: tick
    });

    try {
      const text = await recognizeImageText({ source: rowRaw.source, imagePath: rowRaw.file_path });
      const updateTime = nowIso();
      const status = text ? 'done' : 'empty';

      statements.updateOcrResult.run({
        id,
        ocr_text: text || null,
        ocr_status: status,
        ocr_error: null,
        ocr_updated_at: updateTime,
        ocr_mtime_ms: rowRaw.mtime_ms ?? null,
        updated_at: updateTime
      });

      const latestRaw = statements.findById.get(id);
      const latest = rowToMap(latestRaw);

      const derived = deriveMetaFromText(text);
      const mergedTags = mergeArrayUnique(latest.tags, derived.tags);
      const mergedLocation = mergeLocationByPriority(latest, derived);

      const nextMeta = {
        id,
        title: latest.title,
        description: latest.description,
        tags: toTagsJson(mergedTags),
        collection_unit: latest.collection_unit,
        scope_level: mergedLocation.scope_level,
        country_code: mergedLocation.country_code,
        country_name: mergedLocation.country_name,
        province: mergedLocation.province,
        city: mergedLocation.city,
        district: mergedLocation.district,
        latitude: mergedLocation.latitude,
        longitude: mergedLocation.longitude,
        year_label: latest.year_label,
        updated_at: nowIso()
      };

      statements.updateMapMeta.run(nextMeta);

      const persistedRow = rowToMap(statements.findById.get(id));
      await upsertProjectMeta({
        source: persistedRow.source,
        filePath: persistedRow.file_path,
        meta: {
          title: persistedRow.title,
          description: persistedRow.description,
          tags: persistedRow.tags,
          collection_unit: persistedRow.collection_unit,
          scope_level: persistedRow.scope_level,
          country_code: persistedRow.country_code,
          country_name: persistedRow.country_name,
          province: persistedRow.province,
          city: persistedRow.city,
          district: persistedRow.district,
          latitude: persistedRow.latitude,
          longitude: persistedRow.longitude,
          year_label: persistedRow.year_label,
          favorite: persistedRow.favorite,
          ocr_text: persistedRow.ocr_text,
          ocr_status: persistedRow.ocr_status,
          ocr_error: persistedRow.ocr_error,
          ocr_updated_at: persistedRow.ocr_updated_at,
          ocr_mtime_ms: persistedRow.ocr_mtime_ms
        }
      });
    } catch (err) {
      const updateTime = nowIso();
      statements.updateOcrResult.run({
        id,
        ocr_text: null,
        ocr_status: 'error',
        ocr_error: String(err.message || err).slice(0, 800),
        ocr_updated_at: updateTime,
        ocr_mtime_ms: rowRaw.mtime_ms ?? null,
        updated_at: updateTime
      });
      logger.warn({ err, id, filePath: rowRaw.file_path }, 'OCR failed for map');

      const persistedRow = rowToMap(statements.findById.get(id));
      await upsertProjectMeta({
        source: persistedRow.source,
        filePath: persistedRow.file_path,
        meta: {
          ocr_text: persistedRow.ocr_text,
          ocr_status: persistedRow.ocr_status,
          ocr_error: persistedRow.ocr_error,
          ocr_updated_at: persistedRow.ocr_updated_at,
          ocr_mtime_ms: persistedRow.ocr_mtime_ms
        }
      });
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

  const safeLimit = Math.min(Math.max(Number(limit || 100), 1), 6000);
  const rows = fetchCandidates({ force, limit: safeLimit });
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
  lastError: runtime.lastError,
  workerSource: runtime.workerSource
});
