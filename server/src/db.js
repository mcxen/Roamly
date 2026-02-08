import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const db = new DatabaseSync(config.dbPath);
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS maps (
    id TEXT PRIMARY KEY,
    file_path TEXT UNIQUE NOT NULL,
    file_name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    tags TEXT,
    collection_unit TEXT,
    scope_level TEXT,
    country_code TEXT,
    country_name TEXT,
    province TEXT,
    city TEXT,
    district TEXT,
    latitude REAL,
    longitude REAL,
    year_label TEXT,
    mime TEXT,
    width INTEGER,
    height INTEGER,
    size_bytes INTEGER,
    mtime_ms INTEGER,
    source TEXT NOT NULL,
    favorite INTEGER DEFAULT 0,
    ocr_text TEXT,
    ocr_status TEXT,
    ocr_error TEXT,
    ocr_updated_at TEXT,
    ocr_mtime_ms INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_maps_title ON maps(title);
  CREATE INDEX IF NOT EXISTS idx_maps_file_name ON maps(file_name);
  CREATE INDEX IF NOT EXISTS idx_maps_scope ON maps(scope_level);
  CREATE INDEX IF NOT EXISTS idx_maps_country ON maps(country_name);
  CREATE INDEX IF NOT EXISTS idx_maps_city ON maps(city);
  CREATE INDEX IF NOT EXISTS idx_maps_source ON maps(source);
`);

const maybeAddColumn = (columnSql) => {
  try {
    db.exec(`ALTER TABLE maps ADD COLUMN ${columnSql}`);
  } catch (_err) {
    // ignore migration conflict when column exists
  }
};

maybeAddColumn('description TEXT');
maybeAddColumn('collection_unit TEXT');
maybeAddColumn('scope_level TEXT');
maybeAddColumn('country_code TEXT');
maybeAddColumn('country_name TEXT');
maybeAddColumn('province TEXT');
maybeAddColumn('city TEXT');
maybeAddColumn('district TEXT');
maybeAddColumn('latitude REAL');
maybeAddColumn('longitude REAL');
maybeAddColumn('year_label TEXT');
maybeAddColumn('ocr_text TEXT');
maybeAddColumn('ocr_status TEXT');
maybeAddColumn('ocr_error TEXT');
maybeAddColumn('ocr_updated_at TEXT');
maybeAddColumn('ocr_mtime_ms INTEGER');

export const statements = {
  upsertMap: db.prepare(`
    INSERT INTO maps (
      id,
      file_path,
      file_name,
      title,
      description,
      tags,
      collection_unit,
      scope_level,
      country_code,
      country_name,
      province,
      city,
      district,
      latitude,
      longitude,
      year_label,
      mime,
      width,
      height,
      size_bytes,
      mtime_ms,
      source,
      favorite,
      ocr_text,
      ocr_status,
      ocr_error,
      ocr_updated_at,
      ocr_mtime_ms,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @file_path,
      @file_name,
      @title,
      @description,
      @tags,
      @collection_unit,
      @scope_level,
      @country_code,
      @country_name,
      @province,
      @city,
      @district,
      @latitude,
      @longitude,
      @year_label,
      @mime,
      @width,
      @height,
      @size_bytes,
      @mtime_ms,
      @source,
      @favorite,
      @ocr_text,
      @ocr_status,
      @ocr_error,
      @ocr_updated_at,
      @ocr_mtime_ms,
      @created_at,
      @updated_at
    )
    ON CONFLICT(file_path) DO UPDATE SET
      file_name = excluded.file_name,
      mime = excluded.mime,
      width = excluded.width,
      height = excluded.height,
      size_bytes = excluded.size_bytes,
      mtime_ms = excluded.mtime_ms,
      source = excluded.source,
      title = CASE
        WHEN maps.title IS NULL OR maps.title = '' THEN excluded.title
        ELSE maps.title
      END,
      scope_level = COALESCE(NULLIF(maps.scope_level, ''), excluded.scope_level),
      country_code = COALESCE(NULLIF(maps.country_code, ''), excluded.country_code),
      country_name = COALESCE(NULLIF(maps.country_name, ''), excluded.country_name),
      province = COALESCE(NULLIF(maps.province, ''), excluded.province),
      city = COALESCE(NULLIF(maps.city, ''), excluded.city),
      district = COALESCE(NULLIF(maps.district, ''), excluded.district),
      latitude = COALESCE(maps.latitude, excluded.latitude),
      longitude = COALESCE(maps.longitude, excluded.longitude),
      ocr_text = CASE
        WHEN maps.ocr_mtime_ms = excluded.mtime_ms THEN maps.ocr_text
        ELSE COALESCE(excluded.ocr_text, maps.ocr_text)
      END,
      ocr_status = CASE
        WHEN maps.ocr_mtime_ms = excluded.mtime_ms THEN maps.ocr_status
        ELSE COALESCE(excluded.ocr_status, maps.ocr_status)
      END,
      ocr_error = CASE
        WHEN maps.ocr_mtime_ms = excluded.mtime_ms THEN maps.ocr_error
        ELSE COALESCE(excluded.ocr_error, maps.ocr_error)
      END,
      ocr_updated_at = CASE
        WHEN maps.ocr_mtime_ms = excluded.mtime_ms THEN maps.ocr_updated_at
        ELSE COALESCE(excluded.ocr_updated_at, maps.ocr_updated_at)
      END,
      ocr_mtime_ms = CASE
        WHEN maps.ocr_mtime_ms = excluded.mtime_ms THEN maps.ocr_mtime_ms
        ELSE COALESCE(excluded.ocr_mtime_ms, maps.ocr_mtime_ms)
      END,
      updated_at = excluded.updated_at
  `),
  findById: db.prepare('SELECT * FROM maps WHERE id = ?'),
  updateMapMeta: db.prepare(`
    UPDATE maps
    SET title = @title,
        description = @description,
        tags = @tags,
        collection_unit = @collection_unit,
        scope_level = @scope_level,
        country_code = @country_code,
        country_name = @country_name,
        province = @province,
        city = @city,
        district = @district,
        latitude = @latitude,
        longitude = @longitude,
        year_label = @year_label,
        updated_at = @updated_at
    WHERE id = @id
  `),
  toggleFavorite: db.prepare(`
    UPDATE maps
    SET favorite = @favorite,
        updated_at = @updated_at
    WHERE id = @id
  `),
  markOcrProcessing: db.prepare(`
    UPDATE maps
    SET ocr_status = 'processing',
        ocr_error = NULL,
        ocr_updated_at = @ocr_updated_at,
        updated_at = @updated_at
    WHERE id = @id
  `),
  updateOcrResult: db.prepare(`
    UPDATE maps
    SET ocr_text = @ocr_text,
        ocr_status = @ocr_status,
        ocr_error = @ocr_error,
        ocr_updated_at = @ocr_updated_at,
        ocr_mtime_ms = @ocr_mtime_ms,
        updated_at = @updated_at
    WHERE id = @id
  `),
  listAllPathsBySource: db.prepare('SELECT file_path FROM maps WHERE source = ?'),
  deleteByPath: db.prepare('DELETE FROM maps WHERE source = ? AND file_path = ?')
};

export const dbInstance = db;

export const withTransaction = (fn) => {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

export const removeMissingForSource = ({ source, presentPaths }) => {
  const normalized = new Set(presentPaths);
  const rows = statements.listAllPathsBySource.all(source);

  withTransaction(() => {
    for (const row of rows) {
      if (!normalized.has(row.file_path)) {
        statements.deleteByPath.run(source, row.file_path);
      }
    }
  });
};

export const toTagsJson = (tags) => {
  if (tags === undefined || tags === null) return null;
  if (Array.isArray(tags)) {
    return JSON.stringify(tags.map((item) => String(item).trim()).filter(Boolean));
  }
  return JSON.stringify(String(tags).split(',').map((item) => item.trim()).filter(Boolean));
};

export const parseTags = (tagsJson) => {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
};

export const rowToMap = (row) => {
  if (!row) return null;
  return {
    ...row,
    tags: parseTags(row.tags),
    favorite: Boolean(row.favorite)
  };
};
