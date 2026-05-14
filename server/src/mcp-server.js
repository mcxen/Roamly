import fsp from 'fs/promises';
import path from 'path';
import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { config } from './config.js';
import { dbInstance, rowToMap, statements } from './db.js';
import { getOcrStatus, queueOcrForCandidates } from './ocr.js';
import { scanLibrary, listLocalDirectories, listWebdavDirectories, saveUploadToStorage } from './library.js';
import { logger } from './logger.js';
import { getProjectStoreStatus } from './project-store.js';
import { getRuntimeSettings, getStorageDriver } from './runtime-settings.js';

export const MCP_TOOL_NAMES = [
  'roamly_status',
  'roamly_list_maps',
  'roamly_get_map',
  'roamly_scan_library',
  'roamly_list_folders',
  'roamly_queue_ocr',
  'roamly_import_local_files'
];

const toTextResult = (payload) => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(payload, null, 2)
    }
  ]
});

const buildListMapsQuery = ({ q, source, country, city, favorite, limit }) => {
  const where = [];
  const params = {
    limit: Math.min(Math.max(Number(limit) || 20, 1), 80)
  };

  if (q) {
    where.push('(title LIKE @q OR file_name LIKE @q OR city LIKE @q OR country_name LIKE @q OR ocr_text LIKE @q)');
    params.q = `%${q}%`;
  }
  if (source) {
    where.push('source = @source');
    params.source = source;
  }
  if (country) {
    where.push('(country_name LIKE @country OR related_countries LIKE @country)');
    params.country = `%${country}%`;
  }
  if (city) {
    where.push('city LIKE @city');
    params.city = `%${city}%`;
  }
  if (favorite !== undefined) {
    where.push('favorite = @favorite');
    params.favorite = favorite ? 1 : 0;
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
};

const makeServer = () => {
  const server = new McpServer({
    name: 'roamly-server',
    version: '1.0.0'
  });

  server.registerTool('roamly_status', {
    title: 'Roamly Status',
    description: '查看 Roamly 服务端、存储、OCR 与 MCP 工具状态。',
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  }, async () => toTextResult({
    ok: true,
    runtime: getRuntimeSettings(),
    ocr: getOcrStatus(),
    project: getProjectStoreStatus(),
    mcp: {
      endpoint: '/mcp',
      tools: MCP_TOOL_NAMES
    }
  }));

  server.registerTool('roamly_list_maps', {
    title: 'List Maps',
    description: '按关键词、国家、城市、来源或收藏状态检索地图库记录。',
    inputSchema: {
      q: z.string().optional().describe('关键词，匹配标题、文件名、城市、国家和 OCR 文本'),
      source: z.enum(['local', 'server', 'webdav']).optional().describe('存储来源'),
      country: z.string().optional().describe('国家/地区关键词'),
      city: z.string().optional().describe('城市关键词'),
      favorite: z.boolean().optional().describe('仅返回收藏或非收藏'),
      limit: z.number().int().min(1).max(80).default(20).describe('返回数量')
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  }, async (args) => {
    const { whereClause, params } = buildListMapsQuery(args || {});
    const rows = dbInstance.prepare(`
      SELECT * FROM maps
      ${whereClause}
      ORDER BY favorite DESC, mtime_ms DESC, file_name ASC
      LIMIT @limit
    `).all(params);

    return toTextResult({
      ok: true,
      total: rows.length,
      items: rows.map(rowToMap)
    });
  });

  server.registerTool('roamly_get_map', {
    title: 'Get Map',
    description: '读取单张地图的完整元数据和 OCR 摘要。',
    inputSchema: {
      id: z.string().min(1).describe('地图记录 ID')
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  }, async ({ id }) => {
    const row = statements.findById.get(id);
    if (!row) {
      return toTextResult({ ok: false, error: 'not_found' });
    }
    const item = rowToMap(row);
    return toTextResult({
      ok: true,
      item: {
        ...item,
        ocr_text: item.ocr_text ? String(item.ocr_text).slice(0, 8000) : ''
      }
    });
  });

  server.registerTool('roamly_scan_library', {
    title: 'Scan Library',
    description: '重新扫描当前存储目录并将新图片同步到数据库。',
    annotations: {
      readOnlyHint: false,
      openWorldHint: false
    }
  }, async () => {
    const result = await scanLibrary();
    const ocr = queueOcrForCandidates({ force: false, limit: 800 });
    return toTextResult({ ok: true, scan: result, ocr });
  });

  server.registerTool('roamly_list_folders', {
    title: 'List Folders',
    description: '列出当前存储下可上传或归档的文件夹。',
    inputSchema: {
      maxDepth: z.number().int().min(1).max(10).default(6)
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  }, async ({ maxDepth }) => {
    const folders = getStorageDriver() === 'webdav'
      ? await listWebdavDirectories({ maxDepth })
      : await listLocalDirectories({ maxDepth });
    return toTextResult({ ok: true, folders });
  });

  server.registerTool('roamly_queue_ocr', {
    title: 'Queue OCR',
    description: '将地图 OCR 识别任务加入后台队列。',
    inputSchema: {
      force: z.boolean().default(false).describe('是否强制重建已有 OCR'),
      limit: z.number().int().min(1).max(6000).default(800).describe('最多入队数量')
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false
    }
  }, async ({ force, limit }) => {
    const result = queueOcrForCandidates({ force, limit });
    return toTextResult({ ok: true, ...result, status: getOcrStatus() });
  });

  server.registerTool('roamly_import_local_files', {
    title: 'Import Local Files',
    description: '从服务端可访问的本地路径导入地图文件到当前存储，适合自动化批量入库。',
    inputSchema: {
      filePaths: z.array(z.string().min(1)).min(1).max(50).describe('服务端本机可访问的图片路径'),
      folder: z.string().optional().describe('目标相对文件夹，留空则自动分类')
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: false
    }
  }, async ({ filePaths, folder }) => {
    const tempDir = path.resolve(config.dataDir, 'mcp-imports');
    await fsp.mkdir(tempDir, { recursive: true });
    const savedPaths = [];

    for (const filePath of filePaths) {
      const absPath = path.resolve(filePath);
      const stat = await fsp.stat(absPath);
      if (!stat.isFile()) {
        throw new Error(`不是文件: ${absPath}`);
      }

      const tempPath = path.join(tempDir, `${randomUUID()}-${path.basename(absPath)}`);
      await fsp.copyFile(absPath, tempPath);
      const savedPath = await saveUploadToStorage({
        file: {
          path: tempPath,
          originalname: path.basename(absPath)
        },
        folder
      });
      savedPaths.push(savedPath);
    }

    const scan = await scanLibrary();
    const ocr = queueOcrForCandidates({ force: false, limit: 800 });
    return toTextResult({ ok: true, count: savedPaths.length, paths: savedPaths, scan, ocr });
  });

  return server;
};

export const mountMcpServer = (app) => {
  const transports = {};

  const handlePost = async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    try {
      let transport = sessionId ? transports[sessionId] : null;

      if (!transport && !sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (nextSessionId) => {
            transports[nextSessionId] = transport;
          }
        });

        transport.onclose = () => {
          const closedSessionId = transport.sessionId;
          if (closedSessionId) {
            delete transports[closedSessionId];
          }
        };

        const server = makeServer();
        await server.connect(transport);
      }

      if (!transport) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid MCP session'
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error({ err }, 'MCP request failed');
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: err.message || 'Internal server error'
          },
          id: null
        });
      }
    }
  };

  const handleSessionRequest = async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId ? transports[sessionId] : null;

    if (!transport) {
      res.status(400).send('Invalid or missing MCP session ID');
      return;
    }

    await transport.handleRequest(req, res);
  };

  app.get('/api/mcp/tools', (_req, res) => {
    res.json({
      ok: true,
      endpoint: '/mcp',
      tools: MCP_TOOL_NAMES
    });
  });

  app.post('/mcp', handlePost);
  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', handleSessionRequest);
};
