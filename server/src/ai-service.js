/**
 * AI Service — 统一的多 Provider BYOK AI 接口层
 *
 * 支持的 Provider:
 * - openai-compatible: 任何 OpenAI 兼容 API（默认）
 * - openai: OpenAI 官方
 * - anthropic: Anthropic Claude
 * - google: Google Gemini
 * - deepseek: DeepSeek
 * - moonshot: Moonshot AI (Kimi)
 * - zhipu: 智谱 AI (GLM)
 * - qwen: 通义千问
 * - doubao: 豆包 (火山引擎)
 */

import { logger } from './logger.js';

// ─── Provider 预设配置 ───────────────────────────────────────────────────────

export const PROVIDER_PRESETS = {
  'openai-compatible': {
    label: 'OpenAI 兼容',
    baseUrl: '',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  anthropic: {
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    chatPath: '/v1/messages',
    modelsPath: '/v1/models',
    authHeader: 'x-api-key',
    authPrefix: '',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'anthropic',
    extraHeaders: {
      'anthropic-version': '2023-06-01'
    }
  },
  google: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    chatPath: '/v1beta/chat/completions',
    modelsPath: '/v1beta/openai/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: false,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  moonshot: {
    label: 'Moonshot AI (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  zhipu: {
    label: '智谱 AI (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  qwen: {
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  },
  doubao: {
    label: '豆包 (火山引擎)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    chatPath: '/chat/completions',
    modelsPath: '/models',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    supportsVision: true,
    supportsStreaming: true,
    messageFormat: 'openai'
  }
};

// ─── 工具函数 ────────────────────────────────────────────────────────────────

/**
 * 解析 provider 配置，合并用户自定义 URL
 */
export const resolveProviderConfig = (provider, customApiUrl) => {
  const preset = PROVIDER_PRESETS[provider] || PROVIDER_PRESETS['openai-compatible'];
  const baseUrl = String(customApiUrl || preset.baseUrl || '').trim().replace(/\/+$/, '');
  return { ...preset, baseUrl };
};

/**
 * 构建 chat completions 端点
 */
export const buildChatEndpoint = (provider, apiUrl) => {
  const config = resolveProviderConfig(provider, apiUrl);
  if (!config.baseUrl) return '';

  // 如果用户已经提供了完整的 chat/completions URL，直接使用
  const raw = config.baseUrl;
  if (raw.endsWith('/chat/completions') || raw.endsWith('/v1/messages')) {
    return raw;
  }

  return `${raw}${config.chatPath}`;
};

/**
 * 构建 models 列表端点
 */
export const buildModelsEndpoint = (provider, apiUrl) => {
  const config = resolveProviderConfig(provider, apiUrl);
  if (!config.baseUrl) return '';

  const raw = config.baseUrl;
  if (raw.endsWith('/models')) return raw;

  return `${raw}${config.modelsPath}`;
};

/**
 * 构建请求头
 */
export const buildHeaders = (provider, apiKey, customApiUrl) => {
  const config = resolveProviderConfig(provider, customApiUrl);
  const headers = {
    'Content-Type': 'application/json',
    ...(config.extraHeaders || {})
  };

  if (apiKey) {
    headers[config.authHeader] = `${config.authPrefix}${apiKey}`;
  }

  return headers;
};

/**
 * 将 OpenAI 格式的 messages 转换为 Anthropic 格式
 */
const convertToAnthropicFormat = (messages, model) => {
  let systemPrompt = '';
  const convertedMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = typeof msg.content === 'string'
        ? msg.content
        : (Array.isArray(msg.content) ? msg.content.map((p) => p.text || '').join('') : '');
      continue;
    }

    if (msg.role === 'user') {
      const content = [];
      if (typeof msg.content === 'string') {
        content.push({ type: 'text', text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            content.push({ type: 'text', text: part.text });
          } else if (part.type === 'image_url') {
            const url = part.image_url?.url || '';
            if (url.startsWith('data:')) {
              const match = url.match(/^data:([^;]+);base64,(.+)$/);
              if (match) {
                content.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: match[1],
                    data: match[2]
                  }
                });
              }
            } else {
              content.push({
                type: 'image',
                source: { type: 'url', url }
              });
            }
          }
        }
      }
      convertedMessages.push({ role: 'user', content });
    } else if (msg.role === 'assistant') {
      const text = typeof msg.content === 'string' ? msg.content : '';
      convertedMessages.push({ role: 'assistant', content: text });
    }
  }

  return {
    model,
    system: systemPrompt || undefined,
    messages: convertedMessages,
    max_tokens: 4096
  };
};

/**
 * 将 Anthropic 响应转换为 OpenAI 格式
 */
const convertFromAnthropicResponse = (data) => {
  const textParts = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text);

  return {
    choices: [{
      message: {
        role: 'assistant',
        content: textParts.join('')
      },
      finish_reason: data.stop_reason === 'end_turn' ? 'stop' : (data.stop_reason || 'stop')
    }],
    usage: data.usage ? {
      prompt_tokens: data.usage.input_tokens || 0,
      completion_tokens: data.usage.output_tokens || 0,
      total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
    } : undefined,
    model: data.model
  };
};

/**
 * 标准化模型列表响应
 */
export const normalizeModelList = (payload, provider) => {
  // Anthropic 格式
  if (provider === 'anthropic' && Array.isArray(payload?.data)) {
    return payload.data
      .map((item) => ({
        id: item.id || '',
        owned_by: 'anthropic',
        object: 'model',
        supported_endpoint_types: []
      }))
      .filter((item) => item.id)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  // OpenAI 兼容格式
  const list = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.models) ? payload.models : []);

  return list
    .map((item) => {
      const id = typeof item === 'string' ? item : String(item?.id || '').trim();
      if (!id) return null;
      return {
        id,
        owned_by: typeof item === 'object' ? (item.owned_by || item.owner || '') : '',
        object: typeof item === 'object' ? (item.object || 'model') : 'model',
        supported_endpoint_types: Array.isArray(item?.supported_endpoint_types) ? item.supported_endpoint_types : []
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
};

// ─── 核心 API 调用 ───────────────────────────────────────────────────────────

/**
 * 获取模型列表
 */
export const fetchModels = async ({ provider, apiUrl, apiKey }) => {
  const endpoint = buildModelsEndpoint(provider, apiUrl);
  if (!endpoint) {
    throw new Error('请先填写 AI API URL。');
  }

  const headers = buildHeaders(provider, apiKey, apiUrl);
  delete headers['Content-Type']; // GET 请求不需要

  const response = await fetch(endpoint, { method: 'GET', headers });
  const text = await response.text();
  const data = safeParseJson(text);

  if (!response.ok) {
    const message = data?.error?.message || data?.error || `获取模型列表失败: HTTP ${response.status}`;
    throw new Error(message);
  }

  return normalizeModelList(data, provider);
};

/**
 * 发送 chat completions 请求（统一接口）
 */
export const chatCompletion = async ({ provider, apiUrl, apiKey, model, messages, options = {} }) => {
  const endpoint = buildChatEndpoint(provider, apiUrl);
  if (!endpoint) {
    throw new Error('请先在系统设置中填写 AI API URL。');
  }
  if (!model) {
    throw new Error('请先在系统设置中填写 AI 模型 ID。');
  }

  const config = resolveProviderConfig(provider, apiUrl);
  const headers = buildHeaders(provider, apiKey, apiUrl);

  let body;
  if (config.messageFormat === 'anthropic') {
    body = convertToAnthropicFormat(messages, model);
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
  } else {
    body = {
      model,
      messages,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.responseFormat ? { response_format: options.responseFormat } : {})
    };
  }

  logger.debug({ endpoint, model, provider, messageCount: messages.length }, 'AI chat request');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  const data = safeParseJson(responseText);

  if (!response.ok) {
    const message = data?.error?.message || data?.error || `AI 请求失败: HTTP ${response.status}`;
    logger.error({ status: response.status, error: message, provider }, 'AI chat request failed');
    throw new Error(message);
  }

  // 统一转换为 OpenAI 格式
  if (config.messageFormat === 'anthropic') {
    return convertFromAnthropicResponse(data);
  }

  return data;
};

/**
 * 流式 chat completions（返回 ReadableStream）
 */
export const chatCompletionStream = async ({ provider, apiUrl, apiKey, model, messages, options = {} }) => {
  const endpoint = buildChatEndpoint(provider, apiUrl);
  if (!endpoint) {
    throw new Error('请先在系统设置中填写 AI API URL。');
  }
  if (!model) {
    throw new Error('请先在系统设置中填写 AI 模型 ID。');
  }

  const config = resolveProviderConfig(provider, apiUrl);
  const headers = buildHeaders(provider, apiKey, apiUrl);

  let body;
  if (config.messageFormat === 'anthropic') {
    body = convertToAnthropicFormat(messages, model);
    body.stream = true;
    if (options.maxTokens) body.max_tokens = options.maxTokens;
    if (options.temperature !== undefined) body.temperature = options.temperature;
  } else {
    body = {
      model,
      messages,
      stream: true,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {})
    };
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    const data = safeParseJson(text);
    const message = data?.error?.message || data?.error || `AI 流式请求失败: HTTP ${response.status}`;
    throw new Error(message);
  }

  return {
    body: response.body,
    provider: config.messageFormat
  };
};

/**
 * 从 AI 响应中提取文本内容
 */
export const extractContent = (payload) => {
  // OpenAI 格式
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => part?.text || '').join('');
  }
  throw new Error('无法解析 AI 响应内容');
};

/**
 * 解析 AI 返回的 JSON
 */
export const parseAIJson = (content) => {
  const raw = String(content || '').trim();
  const stripped = raw.startsWith('```')
    ? raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
    : raw;
  return JSON.parse(stripped);
};

/**
 * 获取 provider 信息列表（供前端使用）
 */
export const getProviderList = () => {
  return Object.entries(PROVIDER_PRESETS).map(([key, preset]) => ({
    id: key,
    label: preset.label,
    baseUrl: preset.baseUrl,
    supportsVision: preset.supportsVision,
    supportsStreaming: preset.supportsStreaming
  }));
};

// ─── 内部工具 ────────────────────────────────────────────────────────────────

const safeParseJson = (text) => {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_err) {
    return { error: text };
  }
};
