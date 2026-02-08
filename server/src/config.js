import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({
  path: process.env.ENV_FILE || path.resolve(process.cwd(), '.env')
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

const storageDriver = process.env.STORAGE_DRIVER || 'local';
const mapLibraryDir = process.env.MAP_LIBRARY_DIR;

export const config = {
  rootDir,
  dataDir: path.resolve(rootDir, 'server', 'data'),
  dbPath: process.env.DB_PATH || path.resolve(rootDir, 'server', 'data', 'roamly.db'),
  port: Number(process.env.PORT || 4173),
  storageDriver,
  mapLibraryDir,
  watchLibrary: (process.env.WATCH_LIBRARY || 'false').toLowerCase() === 'true',
  webdav: {
    url: process.env.WEBDAV_URL,
    username: process.env.WEBDAV_USER,
    password: process.env.WEBDAV_PASS,
    rootPath: process.env.WEBDAV_ROOT_PATH || '/'
  },
  webDistDir: process.env.WEB_DIST_DIR || path.resolve(rootDir, 'web', 'dist')
};

export const assertConfig = () => {
  if (config.storageDriver === 'local' && !config.mapLibraryDir) {
    return { ok: true, message: 'MAP_LIBRARY_DIR 未设置，可在网页端运行后手动选择目录。' };
  }
  if (config.storageDriver === 'webdav' && !config.webdav.url) {
    return { ok: false, message: 'WebDAV 模式需要 WEBDAV_URL。' };
  }
  return { ok: true };
};
