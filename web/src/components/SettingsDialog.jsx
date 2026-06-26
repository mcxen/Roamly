import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3, Bot, Compass, Database, Globe, HardDrive, History,
  Image, PenLine, RefreshCw, Rss, ScanLine, Settings, Wifi
} from 'lucide-react';
import AISettings from './AISettings.jsx';
import { api } from '../api.js';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Switch } from './ui/switch.jsx';
import { Slider } from './ui/slider.jsx';
import { Checkbox } from './ui/checkbox.jsx';
import { Tabs } from './ui/tabs.jsx';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Dialog } from './ui/dialog.jsx';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', '未设置': '#94a3b8'
};

const SETTINGS_TABS = [
  { id: 'display', label: '显示', icon: <Image size={16} strokeWidth={2} /> },
  { id: 'storage', label: '存储', icon: <HardDrive size={16} strokeWidth={2} /> },
  { id: 'ai', label: 'AI', icon: <Bot size={16} strokeWidth={2} /> },
  { id: 'ocr', label: 'OCR', icon: <ScanLine size={16} strokeWidth={2} /> },
  { id: 'discover', label: '发现', icon: <Compass size={16} strokeWidth={2} /> },
  { id: 'rss', label: 'RSS', icon: <Rss size={16} strokeWidth={2} /> },
  { id: 'network', label: '服务器', icon: <Wifi size={16} strokeWidth={2} /> },
];

/* ── Display Settings Panel ── */
function DisplayPanel({ uiSettings, setUiSettings }) {
  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>缩略图设置</Card.Title>
          <Card.Description>调整地图库网格中缩略图的显示方式</Card.Description>
        </Card.Header>
        <Card.Content className="tw-space-y-5">
          <Switch
            label="显示缩略图文字"
            checked={Boolean(uiSettings.thumbnailLabelVisible)}
            onCheckedChange={(v) => setUiSettings((p) => ({ ...p, thumbnailLabelVisible: v }))}
          />

          <Slider
            label="文字大小"
            value={clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)}
            onValueChange={(v) => setUiSettings((p) => ({ ...p, thumbnailLabelSize: v }))}
            min={10}
            max={28}
            step={1}
            suffix="px"
          />

          <Slider
            label="缩略图宽度"
            value={clamp(Number(uiSettings.thumbnailWidth) || 180, 60, 320)}
            onValueChange={(v) => setUiSettings((p) => ({ ...p, thumbnailWidth: v }))}
            min={60}
            max={320}
            step={10}
            suffix="px"
          />

          <Slider
            label="缩略图高度"
            value={clamp(Number(uiSettings.thumbnailHeight) || 160, 60, 320)}
            onValueChange={(v) => setUiSettings((p) => ({ ...p, thumbnailHeight: v }))}
            min={60}
            max={320}
            step={10}
            suffix="px"
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>预览区域</Card.Title>
          <Card.Description>调整右侧详情面板中地图预览的高度</Card.Description>
        </Card.Header>
        <Card.Content>
          <Slider
            label="预览图高度"
            value={clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)}
            onValueChange={(v) => setUiSettings((p) => ({ ...p, detailPreviewHeight: v }))}
            min={320}
            max={860}
            step={20}
            suffix="px"
          />
        </Card.Content>
      </Card>
    </div>
  );
}

/* ── Storage Settings Panel ── */
function StoragePanel({
  storageForm, setStorageForm, browserState, loadBrowser,
  applyStorageSettings, loadStorageFolders, busy, status, stats
}) {
  const normalizeDriver = (v) => (v === 'webdav' ? 'webdav' : v === 'server' ? 'server' : 'local');

  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>存储模式</Card.Title>
          <Card.Description>选择地图库的存储后端</Card.Description>
        </Card.Header>
        <Card.Content className="tw-space-y-3">
          <Label>存储模式</Label>
          <Select
            value={storageForm.storageDriver}
            onChange={(e) => setStorageForm((p) => ({ ...p, storageDriver: normalizeDriver(e.target.value) }))}
          >
            <option value="local">本地目录</option>
            <option value="server">服务端托管</option>
            <option value="webdav">WebDAV</option>
          </Select>

          <Separator />

          {storageForm.storageDriver === 'local' ? (
            <div className="tw-space-y-3">
              <div className="tw-flex tw-gap-2">
                <Input
                  value={storageForm.mapLibraryDir}
                  onChange={(e) => setStorageForm((p) => ({ ...p, mapLibraryDir: e.target.value }))}
                  placeholder="输入本地地图目录"
                  className="tw-flex-1"
                  size="sm"
                />
                <Button size="sm" onClick={applyStorageSettings} disabled={busy}>
                  <HardDrive size={14} /> 设置
                </Button>
                <Button size="sm" variant="outline" onClick={() => loadBrowser(browserState.currentPath || storageForm.mapLibraryDir, 'local')} disabled={busy}>
                  <RefreshCw size={14} /> 浏览
                </Button>
              </div>
              {browserState.currentPath && (
                <div className="tw-space-y-2">
                  <div className="tw-flex tw-items-center tw-gap-2">
                    <Button size="xs" variant="secondary" onClick={() => loadBrowser(browserState.parentPath, 'local')} disabled={!browserState.parentPath}>
                      上级目录
                    </Button>
                    <code className="tw-flex-1 tw-text-xs tw-text-[var(--kumo-subtle)] tw-border tw-border-dashed tw-border-[var(--kumo-line)] tw-rounded-md tw-px-2 tw-py-1 tw-truncate">
                      {browserState.currentPath}
                    </code>
                  </div>
                  <div className="tw-flex tw-flex-wrap tw-gap-1">
                    {browserState.children.map((item) => (
                      <Button
                        key={item.path}
                        size="xs"
                        variant="secondary"
                        onClick={() => { setStorageForm((p) => ({ ...p, mapLibraryDir: item.path })); loadBrowser(item.path, 'local'); }}
                        title={item.path}
                      >
                        {item.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : storageForm.storageDriver === 'server' ? (
            <div className="tw-space-y-3">
              <div className="tw-flex tw-gap-2">
                <Input
                  value={storageForm.serverMapDir}
                  onChange={(e) => setStorageForm((p) => ({ ...p, serverMapDir: e.target.value }))}
                  placeholder="输入服务端托管目录"
                  className="tw-flex-1"
                  size="sm"
                />
                <Button size="sm" onClick={applyStorageSettings} disabled={busy}>
                  <HardDrive size={14} /> 设置
                </Button>
              </div>
              <p className="tw-text-xs tw-text-[var(--kumo-muted)]">适合 Docker / 部署场景。</p>
            </div>
          ) : (
            <div className="tw-grid tw-grid-cols-2 tw-gap-3">
              <div className="tw-space-y-1">
                <Label size="sm">WebDAV URL</Label>
                <Input size="sm" value={storageForm.webdav.url} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, url: e.target.value } }))} placeholder="https://..." />
              </div>
              <div className="tw-space-y-1">
                <Label size="sm">用户名</Label>
                <Input size="sm" value={storageForm.webdav.username} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, username: e.target.value } }))} />
              </div>
              <div className="tw-space-y-1">
                <Label size="sm">密码</Label>
                <Input size="sm" type="password" value={storageForm.webdav.password} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, password: e.target.value } }))} />
              </div>
              <div className="tw-space-y-1">
                <Label size="sm">根目录</Label>
                <Input size="sm" value={storageForm.webdav.rootPath} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, rootPath: e.target.value } }))} placeholder="/maps" />
              </div>
            </div>
          )}
        </Card.Content>
        <Card.Footer>
          <Button size="sm" onClick={applyStorageSettings} disabled={busy}>
            保存并扫描
          </Button>
          <Button size="sm" variant="secondary" onClick={() => loadStorageFolders(storageForm.storageDriver)} disabled={busy}>
            <RefreshCw size={14} /> 刷新目录
          </Button>
        </Card.Footer>
      </Card>

      <Card>
        <Card.Header>
          <Card.Title>项目信息</Card.Title>
        </Card.Header>
        <Card.Content className="tw-space-y-2">
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">项目键</span>
            <code className="tw-text-xs tw-text-[var(--kumo-default)]">{status?.project?.projectKey || '-'}</code>
          </div>
          <div className="tw-flex tw-items-center tw-gap-2">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">根目录</span>
            <code className="tw-text-xs tw-text-[var(--kumo-default)] tw-break-all">{status?.project?.root || '-'}</code>
          </div>
        </Card.Content>
      </Card>

      {stats?.storageBands?.length ? (
        <Card>
          <Card.Header>
            <Card.Title>彩虹存储统计</Card.Title>
          </Card.Header>
          <Card.Content className="tw-space-y-2">
            {stats.storageBands.map((item) => (
              <div key={item.band} className="tw-flex tw-items-center tw-gap-3 tw-text-xs">
                <span className="tw-flex tw-items-center tw-gap-1.5 tw-w-16">
                  <span className="tw-size-2 tw-rounded-full tw-shrink-0" style={{ background: BAND_COLORS[item.band] || '#94a3b8' }} />
                  {item.band}
                </span>
                <div className="tw-flex-1 tw-h-1.5 tw-bg-[var(--kumo-recessed)] tw-rounded-full tw-overflow-hidden">
                  <div className="tw-h-full tw-rounded-full tw-transition-all" style={{ width: `${stats.total ? Math.round((item.count / stats.total) * 100) : 0}%`, background: BAND_COLORS[item.band] || '#94a3b8' }} />
                </div>
                <span className="tw-w-8 tw-text-right tw-text-[var(--kumo-muted)]">{item.count}</span>
              </div>
            ))}
          </Card.Content>
        </Card>
      ) : null}
    </div>
  );
}

/* ── OCR Settings Panel ── */
function OCRPanel({ ocrStatus, busy, handleOcrReindex }) {
  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>OCR 引擎</Card.Title>
          <Card.Description>文字识别（Optical Character Recognition）设置</Card.Description>
        </Card.Header>
        <Card.Content className="tw-space-y-3">
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-16">状态</span>
            <Badge variant={ocrStatus?.available ? 'success' : 'destructive'} size="sm">
              {ocrStatus?.available ? '可用' : '不可用'}
            </Badge>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-16">队列</span>
            <span className="tw-text-sm tw-font-medium">{ocrStatus?.queueSize || 0} 个</span>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-16">语言</span>
            <Badge variant="outline" size="sm">{ocrStatus?.lang || '-'}</Badge>
          </div>
          {!ocrStatus?.available && (
            <p className="tw-text-xs tw-text-[var(--kumo-muted)] tw-bg-[var(--kumo-recessed)] tw-rounded-lg tw-p-3">
              请先安装 tesseract（macOS: <code>brew install tesseract tesseract-lang</code>）
            </p>
          )}
        </Card.Content>
        <Card.Footer>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleOcrReindex}
            disabled={busy || !ocrStatus?.available}
          >
            <RefreshCw size={14} /> 重建 OCR 索引
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

/* ── Discover Settings Panel ── */
function DiscoverPanel() {
  const [form, setForm] = useState({ showCard: true, prompt: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.discoverSettings().then((d) => {
      setForm({ showCard: d.showCard ?? true, prompt: d.prompt || '' });
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveDiscoverSettings(form);
      setMsg('已保存');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>发现页</Card.Title>
          <Card.Description>控制发现页右上角 AI 推荐卡片的显示和提示词</Card.Description>
        </Card.Header>
        <Card.Content className="tw-space-y-3">
          <Switch
            label="显示 AI 推荐卡片"
            checked={form.showCard}
            onCheckedChange={(v) => setForm((p) => ({ ...p, showCard: v }))}
          />
          <div className="tw-space-y-1.5">
            <Label size="sm">AI 推荐提示词</Label>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
              rows={3}
              placeholder="你是地图馆每日推荐助手..."
              className="tw-w-full tw-rounded-[var(--kumo-control-radius)] tw-border tw-border-[var(--kumo-control-border)] tw-bg-[var(--kumo-control-bg)] tw-text-sm tw-px-3 tw-py-2 tw-resize-y tw-text-[var(--kumo-control-text)] placeholder:tw-text-[var(--kumo-muted)] focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-[var(--kumo-focus)]"
            />
          </div>
          <p className="tw-text-xs tw-text-[var(--kumo-muted)]">AI 会接收当前日期、时间和图库样本，根据此提示词生成推荐语。</p>
        </Card.Content>
        <Card.Footer>
          <Button size="sm" onClick={save} loading={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
          {msg && <span className="tw-text-xs tw-text-[var(--kumo-success)]">{msg}</span>}
        </Card.Footer>
      </Card>
    </div>
  );
}

/* ── RSS Settings Panel ── */
function RSSPanel() {
  const [form, setForm] = useState({ enabled: true, title: '', description: '' });
  const [history, setHistory] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [genTask, setGenTask] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api.rssSettings().then((data) => {
      setForm({ enabled: data.enabled ?? true, title: data.title || '', description: data.description || '' });
      setHistory(data.history || []);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveRssSettings(form);
      setMsg('已保存');
      setTimeout(() => setMsg(''), 2000);
    } catch (e) { setMsg(e.message); }
    setSaving(false);
  };

  const generate = async () => {
    try {
      const data = await api.rssGenerate();
      setGenTask({ taskId: data.taskId, total: data.total, completed: 0, status: 'running' });
      pollRef.current = setInterval(async () => {
        try {
          const t = await api.aiTaskStatus(data.taskId);
          setGenTask({ taskId: data.taskId, total: t.total, completed: t.completed, status: t.status, errors: t.errors });
          if (t.status === 'done') {
            clearInterval(pollRef.current);
            pollRef.current = null;
            const fresh = await api.rssSettings();
            setHistory(fresh.history || []);
          }
        } catch (_) {}
      }, 1500);
    } catch (e) { setMsg(e.message); }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const rssUrl = `${window.location.origin}/api/feed/rss`;

  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>RSS 订阅</Card.Title>
          <Card.Description>启用后可通过 RSS 阅读器订阅每日地图推荐（10 张/天，含 AI 描述）</Card.Description>
        </Card.Header>
        <Card.Content className="tw-space-y-3">
          <Switch
            label="启用 RSS Feed"
            checked={form.enabled}
            onCheckedChange={(v) => setForm((p) => ({ ...p, enabled: v }))}
          />
          <div className="tw-grid tw-grid-cols-2 tw-gap-3">
            <div className="tw-space-y-1">
              <Label size="sm">Feed 标题</Label>
              <Input
                size="sm"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Roamly 每日地图推荐"
              />
            </div>
            <div className="tw-space-y-1">
              <Label size="sm">Feed 描述</Label>
              <Input
                size="sm"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="每日精选 10 张历史地图"
              />
            </div>
          </div>

          {genTask?.status === 'running' && (
            <div className="tw-space-y-1">
              <div className="tw-flex tw-items-center tw-justify-between tw-text-xs tw-text-[var(--kumo-subtle)]">
                <span>AI 生成中</span>
                <span>{genTask.completed}/{genTask.total}</span>
              </div>
              <div className="tw-h-1 tw-bg-[var(--kumo-recessed)] tw-rounded-full tw-overflow-hidden">
                <div className="tw-h-full tw-bg-[var(--kumo-brand)] tw-rounded-full tw-transition-all" style={{ width: `${genTask.total ? (genTask.completed / genTask.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {genTask?.status === 'done' && (
            <div className="tw-text-xs tw-text-[var(--kumo-success)] tw-bg-[var(--kumo-success)]/10 tw-rounded-lg tw-px-3 tw-py-2">
              生成完成{genTask.errors ? `，${genTask.errors} 个失败` : ''}
            </div>
          )}

          {form.enabled && (
            <div className="tw-space-y-1">
              <Label size="sm">订阅地址</Label>
              <a href={rssUrl} target="_blank" rel="noopener noreferrer" className="tw-text-xs tw-text-[var(--kumo-info)] tw-break-all tw-underline hover:tw-no-underline">
                {rssUrl}
              </a>
            </div>
          )}
        </Card.Content>
        <Card.Footer>
          <Button size="sm" onClick={save} loading={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={generate}
            loading={genTask?.status === 'running'}
            disabled={!form.enabled}
          >
            <PenLine size={14} />
            {genTask?.status === 'running' ? `生成中 (${genTask.completed}/${genTask.total})` : '手动生成 (AI)'}
          </Button>
          {msg && <span className="tw-text-xs tw-text-[var(--kumo-success)]">{msg}</span>}
        </Card.Footer>
      </Card>

      {history.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>
              <History size={14} className="tw-inline-block tw-mr-2" />
              发布历史
            </Card.Title>
          </Card.Header>
          <Card.Content>
            <div className="tw-space-y-2 tw-max-h-48 tw-overflow-auto tw-text-xs">
              {history.map((h, i) => (
                <div key={i} className="tw-flex tw-items-start tw-gap-3 tw-pb-2 tw-border-b tw-border-dashed tw-border-[var(--kumo-line)] last:tw-border-0 last:tw-pb-0">
                  <Badge variant="ghost" size="sm">{h.count} 张</Badge>
                  <div className="tw-min-w-0">
                    <span className="tw-text-[var(--kumo-muted)]">{new Date(h.date).toLocaleString()}</span>
                    {h.titles?.length > 0 && <div className="tw-text-[var(--kumo-subtle)] tw-truncate">{h.titles.join('、')}</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

/* ── Server/Network Info Panel ── */
function NetworkPanel({ status, stats }) {
  return (
    <div className="tw-space-y-4">
      <Card>
        <Card.Header>
          <Card.Title>服务器状态</Card.Title>
        </Card.Header>
        <Card.Content className="tw-space-y-3">
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">运行状态</span>
            <Badge variant="success" size="sm">运行中</Badge>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">图库模式</span>
            <Badge variant="outline" size="sm">{status?.storage?.driver || '-'}</Badge>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">图库存量</span>
            <span className="tw-text-sm tw-font-medium">{stats?.total || 0} 张地图</span>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">收藏</span>
            <span className="tw-text-sm tw-font-medium">{stats?.favorites || 0} 张</span>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">OCR已识别</span>
            <span className="tw-text-sm tw-font-medium">{stats?.ocrDone || 0} 张</span>
          </div>
          <div className="tw-flex tw-items-center tw-gap-3">
            <span className="tw-text-xs tw-text-[var(--kumo-muted)] tw-w-20">AI已分析</span>
            <span className="tw-text-sm tw-font-medium">{stats?.aiDone || 0} 张</span>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

/* ── Main Settings Dialog ── */
export default function SettingsDialog({
  open,
  onClose,
  uiSettings,
  setUiSettings,
  storageForm,
  setStorageForm,
  browserState,
  loadBrowser,
  applyStorageSettings,
  loadStorageFolders,
  busy,
  status,
  ocrStatus,
  handleOcrReindex,
  aiProviders,
  activeProviderId,
  providerPresets,
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
  aiUsageData,
  refreshAIUsage,
  stats,
}) {
  const [tab, setTab] = useState('display');

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Content size="xl" className="tw-p-0 tw-min-h-[70vh] tw-max-h-[85vh] tw-flex tw-flex-col">
        {/* Header */}
        <div className="tw-flex tw-items-center tw-justify-between tw-px-6 tw-py-4 tw-border-b tw-border-[var(--kumo-line)] tw-flex-shrink-0">
          <div>
            <Dialog.Title>系统设置</Dialog.Title>
            <Dialog.Description>管理 Roamly 地图库的所有配置</Dialog.Description>
          </div>
        </div>

        {/* Body: sidebar tabs + content */}
        <div className="tw-flex tw-flex-1 tw-min-h-0 tw-overflow-hidden">
          {/* Sidebar tabs */}
          <div className="tw-w-52 tw-flex-shrink-0 tw-border-r tw-border-[var(--kumo-line)] tw-bg-[var(--kumo-recessed)]/40 tw-p-3 tw-overflow-y-auto">
            <Tabs
              value={tab}
              onValueChange={setTab}
              defaultValue="display"
            >
              <Tabs.List variant="sidebar">
                {SETTINGS_TABS.map(({ id, label, icon }) => (
                  <Tabs.Trigger key={id} value={id} variant="sidebar" icon={icon}>
                    {label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs>
          </div>

          {/* Content area */}
          <div className="tw-flex-1 tw-overflow-y-auto tw-p-6">
            {tab === 'display' && (
              <DisplayPanel uiSettings={uiSettings} setUiSettings={setUiSettings} />
            )}
            {tab === 'storage' && (
              <StoragePanel
                storageForm={storageForm} setStorageForm={setStorageForm}
                browserState={browserState} loadBrowser={loadBrowser}
                applyStorageSettings={applyStorageSettings}
                loadStorageFolders={loadStorageFolders}
                busy={busy} status={status} stats={stats}
              />
            )}
            {tab === 'ai' && (
              <div className="tw--mx-6 tw--my-6">
                <AISettings
                  providers={aiProviders} activeProviderId={activeProviderId}
                  providerPresets={providerPresets}
                  selectedProviderId={selectedProviderId}
                  setSelectedProviderId={setSelectedProviderId}
                  aiModels={aiModels} aiModelsBusy={aiModelsBusy} aiBusy={aiBusy}
                  aiTestBusy={aiTestBusy} aiTestResult={aiTestResult}
                  saveAIProvider={saveAIProvider} deleteAIProvider={deleteAIProvider}
                  activateAIProvider={activateAIProvider}
                  fetchAIModels={fetchAIModels} testAIConnection={testAIConnection}
                  handleAIExtract={handleAIExtract} handleBatchAIExtract={handleBatchAIExtract}
                  selectedMap={selectedMap} maps={maps}
                  usageData={aiUsageData} refreshUsage={refreshAIUsage}
                />
              </div>
            )}
            {tab === 'ocr' && (
              <OCRPanel ocrStatus={ocrStatus} busy={busy} handleOcrReindex={handleOcrReindex} />
            )}
            {tab === 'discover' && <DiscoverPanel />}
            {tab === 'rss' && <RSSPanel />}
            {tab === 'network' && <NetworkPanel status={status} stats={stats} />}
          </div>
        </div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
