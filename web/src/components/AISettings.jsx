import { Bot, RefreshCw, Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

const AI_PROVIDER_OPTIONS = [
  { value: 'openai-compatible', label: 'OpenAI 兼容（自定义）' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'moonshot', label: 'Moonshot AI (Kimi)' },
  { value: 'zhipu', label: '智谱 AI (GLM)' },
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包 (火山引擎)' }
];

export default function AISettings({
  aiForm, setAIForm, aiModels, aiModelsBusy, aiBusy, aiTestBusy, aiTestResult,
  saveAISettings, fetchAIModels, testAIConnection, handleAIExtract, handleBatchAIExtract,
  selectedMap, maps, aiModelsKeyRef
}) {
  return (
    <Card>
      <CardHeader className="tw-pb-3">
        <CardTitle className="tw-flex tw-items-center tw-gap-2">
          <Bot className="tw-w-5 tw-h-5" />
          AI 编目 (BYOK)
        </CardTitle>
        <CardDescription>
          填入你自己的 API Key 即可使用任意兼容服务商。AI 会读取地图缩略图、OCR 文本和已有字段，回填元数据。
        </CardDescription>
      </CardHeader>
      <CardContent className="tw-space-y-4">
        {/* Provider & URL */}
        <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 tw-gap-3">
          <div className="tw-space-y-1.5">
            <Label>服务商</Label>
            <Select
              value={aiForm.provider}
              onChange={(e) => {
                setAIForm((p) => ({ ...p, provider: e.target.value }));
                if (aiModelsKeyRef) aiModelsKeyRef.current = '';
              }}
            >
              {AI_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </div>
          <div className="tw-space-y-1.5">
            <Label>API URL</Label>
            <Input
              value={aiForm.apiUrl}
              onChange={(e) => setAIForm((p) => ({ ...p, apiUrl: e.target.value }))}
              placeholder={aiForm.provider === 'openai-compatible' ? 'https://api.example.com/v1' : '留空使用默认端点'}
            />
            {aiForm.provider !== 'openai-compatible' && !aiForm.apiUrl && (
              <p className="tw-text-xs tw-text-slate-500">使用官方默认端点</p>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="tw-space-y-1.5">
          <Label>API Key</Label>
          <Input
            type="password"
            value={aiForm.apiKey}
            onChange={(e) => setAIForm((p) => ({ ...p, apiKey: e.target.value }))}
            placeholder="留空表示保持不变"
          />
        </div>

        {/* Model selection */}
        <div className="tw-space-y-1.5">
          <Label>模型</Label>
          <div className="tw-flex tw-gap-2">
            <div className="tw-flex-1 tw-relative">
              <Input
                value={aiForm.model}
                list="ai-model-datalist-new"
                onFocus={() => fetchAIModels(false)}
                onChange={(e) => setAIForm((p) => ({ ...p, model: e.target.value }))}
                placeholder="点击自动获取模型列表"
              />
              <datalist id="ai-model-datalist-new">
                {aiModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.owned_by ? `${item.id} · ${item.owned_by}` : item.id}
                  </option>
                ))}
              </datalist>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAIModels(true)}
              disabled={aiModelsBusy || (!aiForm.apiUrl.trim() && aiForm.provider === 'openai-compatible')}
            >
              {aiModelsBusy ? <Loader2 className="tw-w-3.5 tw-h-3.5 tw-animate-spin" /> : <RefreshCw className="tw-w-3.5 tw-h-3.5" />}
              获取模型
            </Button>
          </div>
          {aiModels.length > 0 && (
            <div className="tw-flex tw-flex-wrap tw-gap-1 tw-mt-2">
              {aiModels.slice(0, 20).map((item) => (
                <Badge
                  key={item.id}
                  variant={item.id === aiForm.model ? 'default' : 'secondary'}
                  className="tw-cursor-pointer tw-text-[10px]"
                  onClick={() => setAIForm((p) => ({ ...p, model: item.id }))}
                >
                  {item.id}
                </Badge>
              ))}
              {aiModels.length > 20 && (
                <Badge variant="outline" className="tw-text-[10px]">+{aiModels.length - 20} 更多</Badge>
              )}
            </div>
          )}
        </div>

        {/* System prompt */}
        <div className="tw-space-y-1.5">
          <Label>系统提示词</Label>
          <Textarea
            value={aiForm.systemPrompt}
            onChange={(e) => setAIForm((p) => ({ ...p, systemPrompt: e.target.value }))}
            rows={3}
            placeholder="留空使用默认历史地图编目提示词"
          />
        </div>

        <Separator />

        {/* Actions */}
        <div className="tw-flex tw-flex-wrap tw-gap-2">
          <Button size="sm" onClick={saveAISettings} disabled={aiBusy}>
            保存 AI 设置
          </Button>
          <Button variant="outline" size="sm" onClick={testAIConnection} disabled={aiTestBusy || !aiForm.model}>
            {aiTestBusy ? <Loader2 className="tw-w-3.5 tw-h-3.5 tw-animate-spin" /> : <Zap className="tw-w-3.5 tw-h-3.5" />}
            {aiTestBusy ? '测试中...' : '测试连接'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleAIExtract} disabled={!selectedMap || aiBusy}>
            {aiBusy ? '提取中...' : '提取当前地图'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleBatchAIExtract} disabled={!maps.length || aiBusy}>
            {aiBusy ? '批量提取中...' : `批量提取 (${Math.min(maps.length, 10)})`}
          </Button>
        </div>

        {/* Test result */}
        {aiTestResult && (
          <div className={`tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-p-3 tw-text-sm ${aiTestResult.ok ? 'tw-bg-green-50 tw-text-green-800 tw-border tw-border-green-200' : 'tw-bg-red-50 tw-text-red-800 tw-border tw-border-red-200'}`}>
            {aiTestResult.ok
              ? <><CheckCircle2 className="tw-w-4 tw-h-4 tw-shrink-0" /> 连接成功 · 模型: {aiTestResult.model} · 延迟: {aiTestResult.latency}ms</>
              : <><XCircle className="tw-w-4 tw-h-4 tw-shrink-0" /> 连接失败: {aiTestResult.error}</>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
