import { useState } from 'react';
import AISettings from './AISettings.jsx';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const normalizeDriver = (v) => (v === 'webdav' ? 'webdav' : v === 'server' ? 'server' : 'local');
const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', '未设置': '#94a3b8'
};

export default function SettingsDialog({
  onClose, uiSettings, setUiSettings,
  storageForm, setStorageForm, browserState, loadBrowser,
  applyStorageSettings, loadStorageFolders, busy, status,
  ocrStatus, handleOcrReindex,
  aiForm, setAIForm, aiModels, aiModelsBusy, aiBusy,
  aiTestBusy, aiTestResult, saveAISettings, fetchAIModels,
  testAIConnection, handleAIExtract, handleBatchAIExtract,
  selectedMap, maps, aiModelsKeyRef, stats
}) {
  const [tab, setTab] = useState('display');

  return (
    <div className="settings-mask" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>系统设置</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="settings-tabs">
          <button className={tab === 'display' ? 'active' : ''} onClick={() => setTab('display')}>显示</button>
          <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}>存储</button>
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>AI</button>
          <button className={tab === 'ocr' ? 'active' : ''} onClick={() => setTab('ocr')}>OCR</button>
        </div>
        <div className="settings-body">
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
              aiForm={aiForm} setAIForm={setAIForm} aiModels={aiModels}
              aiModelsBusy={aiModelsBusy} aiBusy={aiBusy} aiTestBusy={aiTestBusy}
              aiTestResult={aiTestResult} saveAISettings={saveAISettings}
              fetchAIModels={fetchAIModels} testAIConnection={testAIConnection}
              handleAIExtract={handleAIExtract} handleBatchAIExtract={handleBatchAIExtract}
              selectedMap={selectedMap} maps={maps} aiModelsKeyRef={aiModelsKeyRef}
            />
          ) : tab === 'ocr' ? (
            <div className="settings-block">
              <div className="settings-line">状态: {ocrStatus?.available ? '✓ 可用' : '✗ 不可用'}</div>
              <div className="settings-line">队列: {ocrStatus?.queueSize || 0}</div>
              <div className="settings-line">识别语言: {ocrStatus?.lang || '-'}</div>
              {!ocrStatus?.available ? <div className="settings-tip">请先安装 tesseract（mac: `brew install tesseract tesseract-lang`）。</div> : null}
              <button onClick={handleOcrReindex} disabled={busy || !ocrStatus?.available}>重建 OCR 索引</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
