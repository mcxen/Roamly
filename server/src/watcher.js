import chokidar from 'chokidar';
import { config } from './config.js';
import { scanLocalLibrary } from './library.js';
import { logger } from './logger.js';
import { getMapLibraryDir } from './runtime-settings.js';

let watcher = null;
let timer = null;

const scheduleRescan = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    scanLocalLibrary().catch((err) => {
      logger.error({ err }, 'Watcher rescan failed');
    });
  }, 900);
};

export const startWatcher = () => {
  const mapLibraryDir = getMapLibraryDir();
  if (config.storageDriver !== 'local' || !mapLibraryDir) {
    return;
  }

  watcher = chokidar.watch(mapLibraryDir, {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../
  });

  watcher.on('add', scheduleRescan);
  watcher.on('unlink', scheduleRescan);
  watcher.on('change', scheduleRescan);
  watcher.on('addDir', scheduleRescan);
  watcher.on('unlinkDir', scheduleRescan);

  logger.info({ dir: mapLibraryDir }, 'Map watcher started');
};

export const stopWatcher = async () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
};

export const restartWatcher = async () => {
  await stopWatcher();
  startWatcher();
};
