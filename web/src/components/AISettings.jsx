import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

const API_FORMATS = [
  { value: 'openai-compatible', label: 'openai-compatible', provider: 'openai-compatible' },
  { value: 'anthropic-messages', label: 'anthropic-messages', provider: 'anthropic' },
  { value: 'google-generative-ai', label: 'google-generative-ai', provider: 'google' }
];

const FALLBACK_PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'anthropic', label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com' },
  { id: 'google', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'moonshot', label: 'Moonshot AI (Kimi)', baseUrl: 'https://api.moonshot.cn/v1' },
  { id: 'zhipu', label: '智谱 AI (GLM)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  { id: 'qwen', label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'doubao', label: '豆包 (火山引擎)', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'openai-compatible', label: 'OpenAI 兼容', baseUrl: '' }
];

const emptyDraft = {
  id: '',
  name: '',
  provider: 'openai-compatible',
  apiUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  preset: false
};

const formatForProvider = (provider) => {
  if (provider === 'anthropic') return 'anthropic-messages';
  if (provider === 'google') return 'google-generative-ai';
  return 'openai-compatible';
};

const providerForFormat = (format) => {
  return API_FORMATS.find((item) => item.value === format)?.provider || 'openai-compatible';
};

const normalizeModel = (item) => {
  if (!item) return null;
  if (typeof item === 'string') return { id: item };
  return item.id ? item : null;
};

const hasCredential = (provider) => {
  const key = String(provider?.apiKey || '').trim();
  return Boolean(key);
};

const buildDraftFromProvider = (provider, presetMap) => {
  if (!provider) return emptyDraft;
  const preset = presetMap.get(provider.provider) || presetMap.get(provider.id);
  return {
    ...emptyDraft,
    ...provider,
    name: provider.name || preset?.label || provider.provider || 'Custom Provider',
    apiUrl: provider.apiUrl || preset?.baseUrl || '',
    apiKey: '',
    preset: Boolean(preset && provider.id === preset.id)
  };
};

const buildDraftFromPreset = (preset) => ({
  ...emptyDraft,
  id: preset.id,
  name: preset.label,
  provider: preset.id,
  apiUrl: preset.baseUrl || '',
  preset: true
});

function ProviderList({
  providers,
  presets,
  selectedId,
  activeProviderId,
  modelCounts,
  onSelect,
  onAddCustom
}) {
  const configuredPresetIds = new Set(providers.map((item) => item.id));
  const unregisteredPresets = presets.filter((item) => !configuredPresetIds.has(item.id));

  return (
    <div className="tw-flex tw-h-full tw-flex-col tw-border-r tw-border-slate-200 tw-bg-slate-50/70">
      <div className="tw-p-3 tw-space-y-2">
        <div className="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">
          Configured
        </div>
        <div className="tw-space-y-1">
          {providers.length ? providers.map((provider) => {
            const active = provider.id === activeProviderId;
            const selected = provider.id === selectedId;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => onSelect(provider.id)}
                className={[
                  'tw-flex tw-w-full tw-items-center tw-gap-2 tw-rounded-md tw-border tw-px-3 tw-py-2 tw-text-left tw-transition',
                  selected ? 'tw-border-slate-900 tw-bg-white tw-shadow-sm' : 'tw-border-transparent hover:tw-bg-white'
                ].join(' ')}
              >
                <span className={hasCredential(provider) ? 'tw-h-2 tw-w-2 tw-rounded-full tw-bg-green-500' : 'tw-h-2 tw-w-2 tw-rounded-full tw-bg-slate-300'} />
                <span className="tw-min-w-0 tw-flex-1">
                  <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-slate-900">
                    {provider.name || provider.provider}
                  </span>
                  <span className="tw-block tw-text-xs tw-text-slate-500">
                    {modelCounts[provider.id] || (provider.model ? 1 : 0)} models
                  </span>
                </span>
                {active ? <Badge variant="outline" className="tw-text-[10px]">Active</Badge> : null}
              </button>
            );
          }) : (
            <div className="tw-rounded-md tw-border tw-border-dashed tw-border-slate-200 tw-bg-white tw-p-3 tw-text-xs tw-text-slate-500">
              尚未配置 Provider
            </div>
          )}
        </div>
      </div>

      <Separator />

      <div className="tw-flex-1 tw-overflow-auto tw-p-3 tw-space-y-2">
        <div className="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.08em] tw-text-slate-500">
          Presets
        </div>
        <div className="tw-space-y-1">
          {unregisteredPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset.id)}
              className={[
                'tw-flex tw-w-full tw-items-center tw-gap-2 tw-rounded-md tw-border tw-px-3 tw-py-2 tw-text-left tw-opacity-70 tw-transition hover:tw-opacity-100',
                selectedId === preset.id ? 'tw-border-slate-900 tw-bg-white tw-shadow-sm' : 'tw-border-transparent hover:tw-bg-white'
              ].join(' ')}
            >
              <span className="tw-h-2 tw-w-2 tw-rounded-full tw-bg-slate-300" />
              <span className="tw-min-w-0 tw-flex-1">
                <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-slate-800">{preset.label}</span>
                <span className="tw-block tw-text-xs tw-text-slate-500">Not registered</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="tw-border-t tw-border-slate-200 tw-p-3">
        <Button variant="outline" size="sm" className="tw-w-full" onClick={onAddCustom}>
          <Plus className="tw-h-3.5 tw-w-3.5" />
          Add Custom Provider
        </Button>
      </div>
    </div>
  );
}

function ProviderDetail({
  draft,
  setDraft,
  presets,
  isConfigured,
  isActive,
  aiBusy,
  aiModels,
  aiModelsBusy,
  aiTestBusy,
  aiTestResult,
  modelSearch,
  setModelSearch,
  showKey,
  setShowKey,
  onSave,
  onDelete,
  onActivate,
  onFetchModels,
  onTest,
  handleAIExtract,
  handleBatchAIExtract,
  selectedMap,
  maps
}) {
  const presetMap = useMemo(() => new Map(presets.map((item) => [item.id, item])), [presets]);
  const preset = presetMap.get(draft.provider);
  const isPreset = Boolean(draft.preset);
  const apiFormat = formatForProvider(draft.provider);
  const visibleModels = useMemo(() => {
    const q = modelSearch.trim().toLowerCase();
    return aiModels
      .map(normalizeModel)
      .filter(Boolean)
      .filter((item) => !q || item.id.toLowerCase().includes(q));
  }, [aiModels, modelSearch]);

  const addTypedModel = () => {
    const value = modelSearch.trim();
    if (!value) return;
    setDraft((prev) => ({ ...prev, model: value }));
    setModelSearch('');
  };

  return (
    <div className="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col">
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-border-b tw-border-slate-200 tw-p-4">
        <div className="tw-min-w-0">
          <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
            <h3 className="tw-m-0 tw-truncate tw-text-base tw-font-semibold tw-text-slate-950">
              {draft.name || 'Custom Provider'}
            </h3>
            {isActive ? <Badge variant="outline" className="tw-text-[10px]">Active</Badge> : null}
          </div>
          <p className="tw-mt-1 tw-text-xs tw-text-slate-500">
            {isPreset ? 'Preset provider' : 'Custom provider'} · {apiFormat}
          </p>
        </div>
        <div className="tw-flex tw-shrink-0 tw-gap-2">
          {isConfigured && !isActive ? (
            <Button variant="outline" size="sm" onClick={onActivate}>设为当前</Button>
          ) : null}
          {isConfigured ? (
            <Button variant="destructive" size="icon" onClick={onDelete} title="删除 Provider">
              <Trash2 className="tw-h-4 tw-w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="tw-flex-1 tw-overflow-auto tw-p-4 tw-space-y-4">
        <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-2 tw-gap-3">
          <div className="tw-space-y-1.5">
            <Label>Provider Name</Label>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              readOnly={isPreset}
              placeholder="Provider name"
            />
          </div>
          <div className="tw-space-y-1.5">
            <Label>API Format</Label>
            <Select
              value={apiFormat}
              disabled={isPreset}
              onChange={(event) => {
                const provider = providerForFormat(event.target.value);
                const nextPreset = presetMap.get(provider);
                setDraft((prev) => ({
                  ...prev,
                  provider,
                  apiUrl: nextPreset?.baseUrl || prev.apiUrl
                }));
              }}
            >
              {API_FORMATS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="tw-space-y-1.5">
          <Label>API Key</Label>
          <div className="tw-flex tw-gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={draft.apiKey}
              onChange={(event) => setDraft((prev) => ({ ...prev, apiKey: event.target.value }))}
              placeholder={isConfigured ? '留空表示保持不变' : '输入 API Key'}
            />
            <Button variant="outline" size="icon" onClick={() => setShowKey((value) => !value)} title={showKey ? '隐藏 API Key' : '显示 API Key'}>
              {showKey ? <EyeOff className="tw-h-4 tw-w-4" /> : <Eye className="tw-h-4 tw-w-4" />}
            </Button>
          </div>
        </div>

        <div className="tw-space-y-1.5">
          <Label>Base URL</Label>
          <Input
            value={draft.apiUrl}
            onChange={(event) => setDraft((prev) => ({ ...prev, apiUrl: event.target.value }))}
            readOnly={isPreset}
            placeholder={preset?.baseUrl || 'https://api.example.com/v1'}
          />
        </div>

        <div className="tw-space-y-1.5">
          <Label>System Prompt</Label>
          <Textarea
            value={draft.systemPrompt || ''}
            onChange={(event) => setDraft((prev) => ({ ...prev, systemPrompt: event.target.value }))}
            rows={3}
            placeholder="留空使用默认历史地图编目提示词"
          />
        </div>

        <Separator />

        <div className="tw-space-y-3">
          <div className="tw-flex tw-flex-wrap tw-items-end tw-gap-2">
            <div className="tw-min-w-[220px] tw-flex-1 tw-space-y-1.5">
              <Label>Model</Label>
              <Input
                value={draft.model}
                onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
                placeholder="选择或输入模型 ID"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => onFetchModels(true)} disabled={aiModelsBusy || !draft.apiUrl.trim()}>
              {aiModelsBusy ? <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin" /> : <RefreshCw className="tw-h-3.5 tw-w-3.5" />}
              获取模型
            </Button>
            <Button variant="outline" size="sm" onClick={onTest} disabled={aiTestBusy || !draft.model.trim()}>
              {aiTestBusy ? <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin" /> : <Zap className="tw-h-3.5 tw-w-3.5" />}
              测试连接
            </Button>
          </div>

          <div className="tw-flex tw-gap-2">
            <div className="tw-relative tw-flex-1">
              <Search className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw-h-4 tw-w-4 -tw-translate-y-1/2 tw-text-slate-400" />
              <Input
                className="tw-pl-9"
                value={modelSearch}
                onChange={(event) => setModelSearch(event.target.value)}
                placeholder="搜索模型，或输入新模型 ID 后添加"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addTypedModel} disabled={!modelSearch.trim()}>
              <Plus className="tw-h-3.5 tw-w-3.5" />
              添加
            </Button>
          </div>

          <div className="tw-flex tw-min-h-10 tw-flex-wrap tw-gap-1.5">
            {draft.model ? (
              <Badge variant="default" className="tw-gap-1 tw-text-[10px]">
                {draft.model}
                <button type="button" onClick={() => setDraft((prev) => ({ ...prev, model: '' }))} className="tw-ml-1">
                  <X className="tw-h-3 tw-w-3" />
                </button>
              </Badge>
            ) : null}
            {visibleModels.slice(0, 80).map((item) => (
              <Badge
                key={item.id}
                variant={item.id === draft.model ? 'default' : 'secondary'}
                className="tw-cursor-pointer tw-text-[10px]"
                onClick={() => setDraft((prev) => ({ ...prev, model: item.id }))}
                title={item.owned_by ? `${item.id} · ${item.owned_by}` : item.id}
              >
                {item.id}
              </Badge>
            ))}
            {!visibleModels.length && !draft.model ? (
              <span className="tw-text-xs tw-text-slate-500">暂无模型列表，先点击“获取模型”或手动输入模型 ID。</span>
            ) : null}
          </div>
        </div>

        {aiTestResult ? (
          <div className={`tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-p-3 tw-text-sm ${aiTestResult.ok ? 'tw-border-green-200 tw-bg-green-50 tw-text-green-800' : 'tw-border-red-200 tw-bg-red-50 tw-text-red-800'}`}>
            {aiTestResult.ok ? (
              <>
                <CheckCircle2 className="tw-h-4 tw-w-4 tw-shrink-0" />
                连接成功 · 模型: {aiTestResult.model} · 延迟: {aiTestResult.latency}ms
              </>
            ) : (
              <>
                <XCircle className="tw-h-4 tw-w-4 tw-shrink-0" />
                连接失败: {aiTestResult.error}
              </>
            )}
          </div>
        ) : null}
      </div>

      <div className="tw-flex tw-flex-wrap tw-gap-2 tw-border-t tw-border-slate-200 tw-p-4">
        <Button size="sm" onClick={onSave} disabled={aiBusy || !draft.name.trim()}>
          {aiBusy ? <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin" /> : null}
          保存 Provider
        </Button>
        <Button variant="outline" size="sm" onClick={handleAIExtract} disabled={!selectedMap || aiBusy}>
          {aiBusy ? '提取中...' : '提取当前地图'}
        </Button>
        <Button variant="outline" size="sm" onClick={handleBatchAIExtract} disabled={!maps.length || aiBusy}>
          {aiBusy ? '批量提取中...' : `批量提取 (${Math.min(maps.length, 10)})`}
        </Button>
      </div>
    </div>
  );
}

const formatNumber = (value) => Number(value || 0).toLocaleString();

const formatLatency = (value) => {
  const number = Number(value || 0);
  return number ? `${Math.round(number)}ms` : '-';
};

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function UsageSection({ providers, usageData, refreshUsage }) {
  const [providerFilter, setProviderFilter] = useState('');
  const [range, setRange] = useState('7');
  const days = range === 'all' ? 3650 : Number(range);
  const summary = usageData?.summary || {};
  const totals = summary.totals || {};
  const providerRows = Array.isArray(summary.byProvider) ? summary.byProvider : [];
  const recentRows = Array.isArray(usageData?.recent) ? usageData.recent : [];

  useEffect(() => {
    if (refreshUsage) {
      refreshUsage({ providerId: providerFilter, days, limit: 100 });
    }
  }, [days, providerFilter, refreshUsage]);

  return (
    <div className="tw-mt-4 tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white">
      <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-b tw-border-slate-200 tw-p-4">
        <div>
          <div className="tw-flex tw-items-center tw-gap-2 tw-text-base tw-font-semibold tw-text-slate-950">
            <BarChart3 className="tw-h-4 tw-w-4" />
            用量统计
          </div>
          <p className="tw-mt-1 tw-text-xs tw-text-slate-500">按 Provider、模型和调用记录查看 AI API 使用情况。</p>
        </div>
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)} className="tw-w-[180px]">
            <option value="">全部 Provider</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.name || provider.provider || provider.id}</option>
            ))}
          </Select>
          <Select value={range} onChange={(event) => setRange(event.target.value)} className="tw-w-[110px]">
            <option value="7">7d</option>
            <option value="30">30d</option>
            <option value="all">All</option>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refreshUsage?.({ providerId: providerFilter, days, limit: 100 })} disabled={usageData?.loading}>
            {usageData?.loading ? <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin" /> : <RefreshCw className="tw-h-3.5 tw-w-3.5" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="tw-space-y-4 tw-p-4">
        {usageData?.error ? (
          <div className="tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-border-red-200 tw-bg-red-50 tw-p-3 tw-text-sm tw-text-red-800">
            <AlertCircle className="tw-h-4 tw-w-4" />
            {usageData.error}
          </div>
        ) : null}

        <div className="tw-grid tw-grid-cols-1 tw-gap-3 md:tw-grid-cols-3">
          <div className="tw-rounded-md tw-border tw-border-slate-200 tw-p-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500"><BarChart3 className="tw-h-3.5 tw-w-3.5" />调用次数</div>
            <div className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-950">{formatNumber(totals.calls)}</div>
          </div>
          <div className="tw-rounded-md tw-border tw-border-slate-200 tw-p-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500"><Zap className="tw-h-3.5 tw-w-3.5" />Token 总量</div>
            <div className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-950">{formatNumber(totals.total_tokens)}</div>
          </div>
          <div className="tw-rounded-md tw-border tw-border-slate-200 tw-p-3">
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500"><Clock className="tw-h-3.5 tw-w-3.5" />平均延迟</div>
            <div className="tw-mt-2 tw-text-2xl tw-font-semibold tw-text-slate-950">{formatLatency(totals.avg_latency_ms)}</div>
          </div>
        </div>

        <div className="tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200">
          <div className="tw-border-b tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-slate-800">Provider breakdown</div>
          <div className="tw-overflow-auto">
            <table className="tw-w-full tw-min-w-[620px] tw-text-sm">
              <thead className="tw-bg-slate-50 tw-text-xs tw-text-slate-500">
                <tr>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Provider</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Calls</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Tokens</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Avg latency</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Errors</th>
                </tr>
              </thead>
              <tbody>
                {providerRows.length ? providerRows.map((row) => (
                  <tr key={row.provider_id} className="tw-border-t tw-border-slate-100">
                    <td className="tw-px-3 tw-py-2 tw-text-slate-900">{row.provider_name || row.provider_id}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatNumber(row.calls)}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatNumber(row.total_tokens)}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatLatency(row.avg_latency_ms)}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatNumber(row.errors)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="tw-px-3 tw-py-6 tw-text-center tw-text-slate-500">暂无用量记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tw-overflow-hidden tw-rounded-md tw-border tw-border-slate-200">
          <div className="tw-border-b tw-border-slate-200 tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-slate-800">Recent calls</div>
          <div className="tw-overflow-auto">
            <table className="tw-w-full tw-min-w-[760px] tw-text-sm">
              <thead className="tw-bg-slate-50 tw-text-xs tw-text-slate-500">
                <tr>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Time</th>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Provider</th>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Model</th>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Operation</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Tokens</th>
                  <th className="tw-px-3 tw-py-2 tw-text-right tw-font-medium">Latency</th>
                  <th className="tw-px-3 tw-py-2 tw-text-left tw-font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.length ? recentRows.map((row) => (
                  <tr key={row.id} className="tw-border-t tw-border-slate-100">
                    <td className="tw-px-3 tw-py-2 tw-text-slate-600">{formatTime(row.created_at)}</td>
                    <td className="tw-px-3 tw-py-2">{row.provider_name || row.provider_id}</td>
                    <td className="tw-max-w-[180px] tw-truncate tw-px-3 tw-py-2" title={row.model || ''}>{row.model || '-'}</td>
                    <td className="tw-px-3 tw-py-2">{row.operation}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatNumber(row.total_tokens)}</td>
                    <td className="tw-px-3 tw-py-2 tw-text-right">{formatLatency(row.latency_ms)}</td>
                    <td className="tw-px-3 tw-py-2">
                      <Badge variant={row.status === 'error' ? 'destructive' : 'outline'} className="tw-text-[10px]">
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="tw-px-3 tw-py-6 tw-text-center tw-text-slate-500">暂无调用记录</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AISettings({
  providers = [],
  activeProviderId,
  providerPresets = [],
  selectedProviderId,
  setSelectedProviderId,
  aiModels,
  aiModelsBusy,
  aiBusy,
  aiTestBusy,
  aiTestResult,
  saveAIProvider,
  deleteAIProvider,
  activateAIProvider,
  fetchAIModels,
  testAIConnection,
  handleAIExtract,
  handleBatchAIExtract,
  selectedMap,
  maps,
  usageData,
  refreshUsage
}) {
  const presets = providerPresets.length ? providerPresets : FALLBACK_PRESETS;
  const presetMap = useMemo(() => new Map(presets.map((item) => [item.id, item])), [presets]);
  const selectedConfigured = providers.find((item) => item.id === selectedProviderId);
  const selectedPreset = presetMap.get(selectedProviderId);
  const [draft, setDraft] = useState(emptyDraft);
  const [modelSearch, setModelSearch] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (!selectedProviderId) {
      const first = activeProviderId || providers[0]?.id || presets[0]?.id || '';
      if (first) setSelectedProviderId(first);
      return;
    }
    if (selectedConfigured) {
      setDraft(buildDraftFromProvider(selectedConfigured, presetMap));
      return;
    }
    if (selectedPreset) {
      setDraft(buildDraftFromPreset(selectedPreset));
      return;
    }
    if (selectedProviderId.startsWith('custom-') && draft.id === selectedProviderId) {
      return;
    }
    setSelectedProviderId(activeProviderId || providers[0]?.id || presets[0]?.id || '');
  }, [
    activeProviderId,
    draft.id,
    providers,
    presetMap,
    presets,
    selectedConfigured,
    selectedPreset,
    selectedProviderId,
    setSelectedProviderId
  ]);

  useEffect(() => {
    setModelSearch('');
  }, [draft.id]);

  useEffect(() => {
    const canUseSavedCredential = draft.id && draft.id === activeProviderId;
    if (!draft.apiUrl || !canUseSavedCredential) return;
    fetchAIModels(draft, false);
  }, [activeProviderId, draft.apiUrl, draft.id, draft.provider, fetchAIModels]);

  const modelCounts = useMemo(() => {
    const counts = {};
    providers.forEach((item) => {
      counts[item.id] = Array.isArray(item.models) ? item.models.length : (item.model ? 1 : 0);
    });
    if (draft.id && aiModels.length) {
      counts[draft.id] = aiModels.length;
    }
    return counts;
  }, [aiModels.length, draft.id, providers]);

  const addCustomProvider = () => {
    const id = `custom-${Date.now().toString(36)}`;
    setSelectedProviderId(id);
    setDraft({
      ...emptyDraft,
      id,
      name: 'Custom Provider',
      provider: 'openai-compatible',
      preset: false
    });
  };

  const saveCurrentProvider = () => {
    saveAIProvider({
      id: draft.id,
      name: draft.name,
      provider: draft.provider,
      apiUrl: draft.apiUrl,
      apiKey: draft.apiKey,
      model: draft.model,
      systemPrompt: draft.systemPrompt,
      activate: true
    });
  };

  const fetchCurrentModels = (force) => {
    fetchAIModels(draft, force);
  };

  const testCurrentConnection = () => {
    testAIConnection(draft);
  };

  const deleteCurrentProvider = () => {
    deleteAIProvider(draft.id);
  };

  const activateCurrentProvider = () => {
    activateAIProvider(draft.id);
  };

  return (
    <Card>
      <CardHeader className="tw-pb-3">
        <CardTitle className="tw-flex tw-items-center tw-gap-2">
          <Bot className="tw-h-5 tw-w-5" />
          AI 编目 (BYOK)
        </CardTitle>
        <CardDescription>
          管理多个 AI Provider，并选择当前用于地图提取、批量提取和聊天的连接。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="tw-grid tw-min-h-[620px] tw-overflow-hidden tw-rounded-lg tw-border tw-border-slate-200 lg:tw-grid-cols-[280px_minmax(0,1fr)]">
          <ProviderList
            providers={providers}
            presets={presets}
            selectedId={selectedProviderId}
            activeProviderId={activeProviderId}
            modelCounts={modelCounts}
            onSelect={setSelectedProviderId}
            onAddCustom={addCustomProvider}
          />
          <ProviderDetail
            draft={draft}
            setDraft={setDraft}
            presets={presets}
            isConfigured={Boolean(selectedConfigured)}
            isActive={draft.id === activeProviderId}
            aiBusy={aiBusy}
            aiModels={aiModels}
            aiModelsBusy={aiModelsBusy}
            aiTestBusy={aiTestBusy}
            aiTestResult={aiTestResult}
            modelSearch={modelSearch}
            setModelSearch={setModelSearch}
            showKey={showKey}
            setShowKey={setShowKey}
            onSave={saveCurrentProvider}
            onDelete={deleteCurrentProvider}
            onActivate={activateCurrentProvider}
            onFetchModels={fetchCurrentModels}
            onTest={testCurrentConnection}
            handleAIExtract={handleAIExtract}
            handleBatchAIExtract={handleBatchAIExtract}
            selectedMap={selectedMap}
            maps={maps}
          />
        </div>
        <UsageSection
          providers={providers}
          usageData={usageData}
          refreshUsage={refreshUsage}
        />
      </CardContent>
    </Card>
  );
}
