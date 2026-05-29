import { dbInstance } from './db.js';

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const sinceDate = (days) => {
  const normalizedDays = clampInteger(days, 7, 1, 3650);
  const date = new Date();
  date.setDate(date.getDate() - normalizedDays);
  return date.toISOString();
};

const normalizeUsage = (usage = {}) => {
  const promptTokens = clampInteger(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens,
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const completionTokens = clampInteger(
    usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens,
    0,
    0,
    Number.MAX_SAFE_INTEGER
  );
  const totalTokens = clampInteger(
    usage.total_tokens ?? usage.totalTokens,
    promptTokens + completionTokens,
    0,
    Number.MAX_SAFE_INTEGER
  );
  return { promptTokens, completionTokens, totalTokens };
};

const addSuccessRate = (row) => {
  const calls = Number(row.calls || 0);
  return {
    ...row,
    success_rate: calls ? Number(row.successes || 0) / calls : 0
  };
};

export const recordUsage = ({
  providerId,
  providerName,
  model,
  operation,
  usage,
  latencyMs,
  status = 'success',
  errorMessage
}) => {
  const normalizedProviderId = String(providerId || 'unknown').trim() || 'unknown';
  const normalizedOperation = String(operation || 'unknown').trim() || 'unknown';
  const tokens = normalizeUsage(usage || {});

  dbInstance.prepare(`
    INSERT INTO ai_usage (
      provider_id,
      provider_name,
      model,
      operation,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      latency_ms,
      status,
      error_message,
      created_at
    ) VALUES (
      @provider_id,
      @provider_name,
      @model,
      @operation,
      @prompt_tokens,
      @completion_tokens,
      @total_tokens,
      @latency_ms,
      @status,
      @error_message,
      @created_at
    )
  `).run({
    provider_id: normalizedProviderId,
    provider_name: providerName ? String(providerName) : null,
    model: model ? String(model) : null,
    operation: normalizedOperation,
    prompt_tokens: tokens.promptTokens,
    completion_tokens: tokens.completionTokens,
    total_tokens: tokens.totalTokens,
    latency_ms: clampInteger(latencyMs, 0, 0, Number.MAX_SAFE_INTEGER),
    status: status === 'error' ? 'error' : 'success',
    error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    created_at: new Date().toISOString()
  });
};

export const getUsageStats = ({ providerId, days = 7, limit = 100 } = {}) => {
  const normalizedLimit = clampInteger(limit, 100, 1, 1000);
  const params = {
    since: sinceDate(days),
    limit: normalizedLimit
  };
  const where = ['created_at >= @since'];
  if (providerId) {
    params.provider_id = String(providerId);
    where.push('provider_id = @provider_id');
  }

  return dbInstance.prepare(`
    SELECT *
    FROM ai_usage
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT @limit
  `).all(params);
};

export const getProviderUsage = (providerId, days = 7) => {
  if (!providerId) return null;
  const row = dbInstance.prepare(`
    SELECT
      provider_id,
      COALESCE(MAX(provider_name), provider_id) AS provider_name,
      COUNT(*) AS calls,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,
      SUM(total_tokens) AS total_tokens,
      ROUND(AVG(latency_ms)) AS avg_latency_ms,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage
    WHERE provider_id = @provider_id AND created_at >= @since
    GROUP BY provider_id
  `).get({ provider_id: String(providerId), since: sinceDate(days) });
  return row ? addSuccessRate(row) : null;
};

export const getUsageSummary = ({ days = 7 } = {}) => {
  const since = sinceDate(days);
  const totals = dbInstance.prepare(`
    SELECT
      COUNT(*) AS calls,
      SUM(prompt_tokens) AS prompt_tokens,
      SUM(completion_tokens) AS completion_tokens,
      SUM(total_tokens) AS total_tokens,
      ROUND(AVG(latency_ms)) AS avg_latency_ms,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage
    WHERE created_at >= @since
  `).get({ since });

  const byProvider = dbInstance.prepare(`
    SELECT
      provider_id,
      COALESCE(MAX(provider_name), provider_id) AS provider_name,
      COUNT(*) AS calls,
      SUM(total_tokens) AS total_tokens,
      ROUND(AVG(latency_ms)) AS avg_latency_ms,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS successes,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage
    WHERE created_at >= @since
    GROUP BY provider_id
    ORDER BY calls DESC, total_tokens DESC
  `).all({ since }).map(addSuccessRate);

  const byModel = dbInstance.prepare(`
    SELECT
      COALESCE(model, '-') AS model,
      COUNT(*) AS calls,
      SUM(total_tokens) AS total_tokens,
      ROUND(AVG(latency_ms)) AS avg_latency_ms,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage
    WHERE created_at >= @since
    GROUP BY COALESCE(model, '-')
    ORDER BY calls DESC, total_tokens DESC
  `).all({ since });

  const byDay = dbInstance.prepare(`
    SELECT
      substr(created_at, 1, 10) AS day,
      COUNT(*) AS calls,
      SUM(total_tokens) AS total_tokens,
      ROUND(AVG(latency_ms)) AS avg_latency_ms,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
    FROM ai_usage
    WHERE created_at >= @since
    GROUP BY substr(created_at, 1, 10)
    ORDER BY day ASC
  `).all({ since });

  return {
    totals: addSuccessRate(totals || {}),
    totalCost: null,
    byProvider,
    byModel,
    byDay
  };
};
