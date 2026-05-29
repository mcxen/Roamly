import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Compass, Database, Rss, ScanLine, Settings } from 'lucide-react';
import AISettings from './AISettings.jsx';
import { api } from '../api.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function DiscoverSettings() {
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
    <div className="settings-block">
      <h4>发现页设置</h4>
      <div className="settings-tip">控制发现页右上角 AI 推荐卡片的显示和提示词。</div>
      <label className="settings-check">
        <input type="checkbox" checked={form.showCard} onChange={(e) => setForm((p) => ({ ...p, showCard: e.target.checked }))} />
        显示 AI 推荐卡片
      </label>
      <label style={{ marginTop: 8 }}>
        AI 推荐提示词
        <textarea
          value={form.prompt}
          onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
          rows={4}
          placeholder="你是地图馆每日推荐助手..."
          style={{ width: '100%', marginTop: 4 }}
        />
      </label>
      <div className="settings-hint">AI 会接收当前日期、时间和图库样本，根据此提示词生成推荐语。</div>
      <div className="settings-actions">
        <button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存发现设置'}</button>
      </div>
      {msg && <div className="settings-line success">{msg}</div>}
    </div>
  );
}

function RssSettings() {
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
            // Refresh history
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
    <div className="settings-block">
      <h4>RSS 订阅</h4>
      <div className="settings-tip">启用后，可通过 RSS 阅读器订阅每日地图推荐（10 张/天，含 AI 描述）。</div>
      <label className="settings-check">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))} />
        启用 RSS Feed
      </label>
      <label>
        Feed 标题
        <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Roamly 每日地图推荐" />
      </label>
      <label style={{ marginTop: 8 }}>
        Feed 描述
        <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="每日精选 10 张历史地图" />
      </label>
      <div className="settings-actions">
        <button onClick={save} disabled={saving}>{saving ? '保存中...' : '保存 RSS 设置'}</button>
        <button onClick={generate} disabled={!form.enabled || (genTask?.status === 'running')}>
          {genTask?.status === 'running' ? `AI 生成中 (${genTask.completed}/${genTask.total})` : '手动生成 (AI 描述)'}
        </button>
      </div>
      {genTask?.status === 'running' && (
        <div style={{ marginTop: 8 }}>
          <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, background: '#0f172a', transition: 'width 0.3s', width: `${genTask.total ? (genTask.completed / genTask.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}
      {genTask?.status === 'done' && (
        <div className="settings-line success" style={{ marginTop: 6 }}>✓ 生成完成{genTask.errors ? `，${genTask.errors} 个失败` : ''}</div>
      )}
      {form.enabled && (
        <div className="settings-line" style={{ marginTop: 8 }}>
          订阅地址: <a href={rssUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb', wordBreak: 'break-all' }}>{rssUrl}</a>
        </div>
      )}
      {msg && <div className="settings-line success">{msg}</div>}
      {history.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h4 style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--muted)' }}>发布历史</h4>
          <div style={{ maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
            {history.map((h, i) => (
              <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)' }}>
                <span style={{ color: 'var(--muted)' }}>{new Date(h.date).toLocaleString()}</span>
                <span style={{ marginLeft: 8 }}>{h.count} 张</span>
                {h.titles?.length > 0 && <div style={{ color: '#475569', marginTop: 2 }}>{h.titles.join('、')}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
const normalizeDriver = (v) => (v === 'webdav' ? 'webdav' : v === 'server' ? 'server' : 'local');
const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', '未设置': '#94a3b8'
};

const SETTINGS_TABS = [
  { id: 'display', label: '显示', Icon: Settings },
  { id: 'storage', label: '存储', Icon: Database },
  { id: 'ai', label: 'AI', Icon: Bot },
  { id: 'ocr', label: 'OCR', Icon: ScanLine },
  { id: 'discover', label: '发现', Icon: Compass },
  { id: 'rss', label: 'RSS', Icon: Rss }
];

export default function SettingsDialog({
  onClose, uiSettings, setUiSettings,
  storageForm, setStorageForm, browserState, loadBrowser,
  applyStorageSettings, loadStorageFolders, busy, status,
  ocrStatus, handleOcrReindex,
  aiProviders, activeProviderId, providerPresets, selectedProviderId,
  setSelectedProviderId, aiModels, aiModelsBusy, aiBusy,
  aiTestBusy, aiTestResult, saveAIProvider, deleteAIProvider,
  activateAIProvider, fetchAIModels, testAIConnection,
  handleAIExtract, handleBatchAIExtract, selectedMap, maps,
  aiUsageData, refreshAIUsage, stats
}) {
  const [tab, setTab] = useState('display');

  return (
    <div className="settings-mask" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>系统设置</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="settings-layout">
          <nav className="settings-tabs settings-sidebar" aria-label="设置分类">
            {SETTINGS_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                className={`settings-nav-item ${tab === id ? 'settings-nav-active active' : ''}`}
                onClick={() => setTab(id)}
                type="button"
              >
                <Icon size={16} strokeWidth={2} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="settings-body settings-content">
            {tab === 'display' ? (
            <div className="settings-block">
              <label className="settings-check">
                <input type="checkbox" checked={Boolean(uiSettings.thumbnailLabelVisible)} onChange={(e) => setUiSettings((p) => ({ ...p, thumbnailLabelVisible: e.target.checked }))} />
                显示缩略图文字
              </label>
              <label className="settings-slider">
                缩略图文字大小: {clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)}
                <input type="range" min="10" max="28" value={clamp(Number(uiSettings.thumbnailLabelSize) || 14, 10, 28)} onChange={(e) => setUiSettings((p) => ({ ...p, thumbnailLabelSize: Number(e.target.value) }))} />
              </label>
              <label className="settings-slider">
                缩略图宽度: {clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320)} px
                <input type="range" min="10" max="320" value={clamp(Number(uiSettings.thumbnailWidth) || 180, 10, 320)} onChange={(e) => setUiSettings((p) => ({ ...p, thumbnailWidth: Number(e.target.value) }))} />
              </label>
              <label className="settings-slider">
                缩略图高度: {clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320)} px
                <input type="range" min="10" max="320" value={clamp(Number(uiSettings.thumbnailHeight) || 160, 10, 320)} onChange={(e) => setUiSettings((p) => ({ ...p, thumbnailHeight: Number(e.target.value) }))} />
              </label>
              <label className="settings-slider">
                右侧主图高度: {clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)} px
                <input type="range" min="320" max="860" value={clamp(Number(uiSettings.detailPreviewHeight) || 520, 320, 860)} onChange={(e) => setUiSettings((p) => ({ ...p, detailPreviewHeight: Number(e.target.value) }))} />
              </label>
            </div>
          ) : tab === 'storage' ? (
            <div className="settings-block">
              <label>
                存储模式
                <select value={storageForm.storageDriver} onChange={(e) => setStorageForm((p) => ({ ...p, storageDriver: normalizeDriver(e.target.value) }))}>
                  <option value="local">本地目录</option>
                  <option value="server">服务端托管</option>
                  <option value="webdav">WebDAV</option>
                </select>
              </label>
              {storageForm.storageDriver === 'local' ? (
                <>
                  <div className="library-row">
                    <input value={storageForm.mapLibraryDir} onChange={(e) => setStorageForm((p) => ({ ...p, mapLibraryDir: e.target.value }))} placeholder="输入本地地图目录" />
                    <button onClick={applyStorageSettings} disabled={busy}>设置目录</button>
                    <button onClick={() => loadBrowser(browserState.currentPath || storageForm.mapLibraryDir, 'local')} disabled={busy}>刷新浏览</button>
                  </div>
                  <div className="browser-row">
                    <button onClick={() => loadBrowser(browserState.parentPath, 'local')} disabled={!browserState.parentPath}>上级</button>
                    <span className="browser-path" title={browserState.currentPath}>{browserState.currentPath || '-'}</span>
                  </div>
                  <div className="browser-list">
                    {browserState.children.map((item) => (
                      <button key={item.path} onClick={() => { setStorageForm((p) => ({ ...p, mapLibraryDir: item.path })); loadBrowser(item.path, 'local'); }} title={item.path}>{item.name}</button>
                    ))}
                  </div>
                </>
              ) : storageForm.storageDriver === 'server' ? (
                <>
                  <div className="library-row">
                    <input value={storageForm.serverMapDir} onChange={(e) => setStorageForm((p) => ({ ...p, serverMapDir: e.target.value }))} placeholder="输入服务端托管目录" />
                    <button onClick={applyStorageSettings} disabled={busy}>设置目录</button>
                    <button onClick={() => loadBrowser(browserState.currentPath || storageForm.serverMapDir, 'server')} disabled={busy}>刷新浏览</button>
                  </div>
                  <div className="settings-tip">适合 Docker / 部署场景。</div>
                </>
              ) : (
                <div className="webdav-grid">
                  <label>WebDAV URL<input value={storageForm.webdav.url} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, url: e.target.value } }))} placeholder="https://..." /></label>
                  <label>用户名<input value={storageForm.webdav.username} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, username: e.target.value } }))} /></label>
                  <label>密码<input type="password" value={storageForm.webdav.password} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, password: e.target.value } }))} /></label>
                  <label>根目录<input value={storageForm.webdav.rootPath} onChange={(e) => setStorageForm((p) => ({ ...p, webdav: { ...p.webdav, rootPath: e.target.value } }))} placeholder="/maps" /></label>
                </div>
              )}
              <div className="settings-actions">
                <button onClick={applyStorageSettings} disabled={busy}>保存存储设置并扫描</button>
                <button onClick={() => loadStorageFolders(storageForm.storageDriver)} disabled={busy}>刷新目录列表</button>
              </div>
              <div className="settings-line">项目键: {status?.project?.projectKey || '-'}</div>
              <div className="settings-line">项目根目录: {status?.project?.root || '-'}</div>
              {stats?.storageBands?.length ? (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>彩虹存储统计</h4>
                  <div className="stats-bars">
                    {stats.storageBands.map((item) => (
                      <div key={item.band} className="stats-bar-row">
                        <span className="stats-bar-label"><span className="stats-dot" style={{ background: BAND_COLORS[item.band] || '#94a3b8' }} />{item.band}</span>
                        <div className="stats-bar-track"><div className="stats-bar-fill" style={{ width: `${stats.total ? Math.round((item.count / stats.total) * 100) : 0}%`, background: BAND_COLORS[item.band] || '#94a3b8' }} /></div>
                        <span className="stats-bar-count">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : tab === 'ai' ? (
            <AISettings
              providers={aiProviders} activeProviderId={activeProviderId}
              providerPresets={providerPresets} selectedProviderId={selectedProviderId}
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
          ) : tab === 'ocr' ? (
            <div className="settings-block">
              <div className="settings-line">状态: {ocrStatus?.available ? '✓ 可用' : '✗ 不可用'}</div>
              <div className="settings-line">队列: {ocrStatus?.queueSize || 0}</div>
              <div className="settings-line">识别语言: {ocrStatus?.lang || '-'}</div>
              {!ocrStatus?.available ? <div className="settings-tip">请先安装 tesseract（mac: `brew install tesseract tesseract-lang`）。</div> : null}
              <button onClick={handleOcrReindex} disabled={busy || !ocrStatus?.available}>重建 OCR 索引</button>
            </div>
          ) : tab === 'discover' ? (
            <DiscoverSettings />
          ) : tab === 'rss' ? (
            <RssSettings />
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
