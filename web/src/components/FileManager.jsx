import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, FolderOpen, RefreshCw, Server, FileText, Bot, CheckCircle2, Loader2, Image, BarChart3, Sparkles, Camera, FileJson } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { api } from '../api.js';

const STORAGE_BAND_OPTIONS = [
  { value: '', label: '未设置' },
  { value: 'red', label: '红条' },
  { value: 'orange', label: '橙条' },
  { value: 'yellow', label: '黄条' },
  { value: 'green', label: '绿条' },
  { value: 'cyan', label: '青条' },
  { value: 'blue', label: '蓝条' },
  { value: 'purple', label: '紫条' }
];

const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', '未设置': '#94a3b8'
};

function ProgressBar({ value, max = 100, className = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`tw-h-2 tw-w-full tw-overflow-hidden tw-rounded-full tw-border tw-border-[#cbb58a] tw-bg-[#f5ead1] ${className}`}>
      <div className="tw-h-full tw-rounded-full tw-bg-[#8f3f28] tw-transition-all tw-duration-300 tw-ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

function AITaskPanel({ tasks, onRefresh }) {
  if (!tasks.length) return null;
  return (
    <Card className="tw-animate-in tw-slide-in-from-top-2 tw-duration-300">
      <CardHeader className="tw-py-3 tw-px-4">
        <div className="tw-flex tw-items-center tw-justify-between">
          <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
            <Bot className="tw-w-4 tw-h-4" />
            AI 识别任务
          </CardTitle>
          <Button variant="ghost" size="icon" className="tw-h-7 tw-w-7" onClick={onRefresh}>
            <RefreshCw className="tw-w-3.5 tw-h-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="tw-pt-0 tw-px-4 tw-pb-3 tw-space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className="tw-space-y-2 tw-rounded-xl tw-border tw-border-[#c8b590] tw-bg-[#fffaf0] tw-p-3">
            <div className="tw-flex tw-items-center tw-justify-between tw-text-xs">
              <span className="tw-text-[#5d564d]">
                {task.status === 'running' ? <Loader2 className="tw-mr-1 tw-inline tw-h-3 tw-w-3 tw-animate-spin" /> : <CheckCircle2 className="tw-mr-1 tw-inline tw-h-3 tw-w-3 tw-text-[#3f6a4d]" />}
                {task.status === 'running' ? '识别中' : '已完成'}
              </span>
              <span className="tw-text-[#7c735d]">{task.completed}/{task.total}</span>
            </div>
            <ProgressBar value={task.completed} max={task.total} />
            {task.errors > 0 && <p className="tw-text-xs tw-text-[#a33f26]">失败: {task.errors}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function FileManager({
  status, busy, uploadFiles, setUploadFiles, uploadFolder, setUploadFolder,
  uploadMeta, setUploadMeta, folderOptions, handleScan, handleUpload: _handleUpload,
  handleFileDrop, loadStorageFolders, mcpInfo, maps, setSelectedId, setViewMode,
  setMessage, setError, ocrStatus, stats, handleBatchAIExtract, handleOcrReindex, aiBusy
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  const [aiTasks, setAITasks] = useState([]);
  const [viewImage, setViewImage] = useState(null);
  const pollRef = useRef(null);

  const handleUploadWithProgress = useCallback(async () => {
    if (!uploadFiles.length) return;
    setUploading(true);
    setOverallProgress(0);
    const form = new FormData();
    uploadFiles.forEach((file) => form.append('files', file));
    form.append('folder', uploadFolder || '');
    Object.entries(uploadMeta || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      form.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
    });
    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/maps/upload');
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) setOverallProgress((e.loaded / e.total) * 100); };
        xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`));
        xhr.onerror = () => reject(new Error('网络错误'));
        xhr.send(form);
      });
      setMessage?.('上传完成');
      setUploadFiles([]);
    } catch (err) { setError?.(err.message); }
    finally { setTimeout(() => { setUploading(false); setOverallProgress(0); }, 1200); }
  }, [uploadFiles, uploadFolder, uploadMeta, setUploadFiles, setMessage, setError]);

  const refreshAITasks = useCallback(async () => {
    try { const d = await api.aiTasks(); setAITasks(d.tasks || []); } catch (_) {}
  }, []);

  useEffect(() => {
    refreshAITasks();
    pollRef.current = setInterval(refreshAITasks, 3000);
    return () => clearInterval(pollRef.current);
  }, [refreshAITasks]);

  useEffect(() => {
    const hasRunning = aiTasks.some((t) => t.status === 'running');
    if (!hasRunning && pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    else if (hasRunning && !pollRef.current) { pollRef.current = setInterval(refreshAITasks, 3000); }
  }, [aiTasks, refreshAITasks]);

  return (
    <div className="tw-flex-1 tw-min-h-0 tw-overflow-auto tw-bg-[linear-gradient(180deg,rgba(255,248,235,0.42),rgba(238,225,191,0.28))]">
      <div className="tw-grid tw-grid-cols-1 tw-gap-4 tw-p-4 lg:tw-grid-cols-[1fr_340px]">
      {/* Main column */}
      <div className="tw-flex tw-flex-col tw-gap-4 tw-min-w-0">
        {/* Upload card */}
        <Card>
          <CardHeader className="tw-flex-row tw-items-center tw-justify-between tw-space-y-0 tw-pb-3">
            <div>
              <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-lg">
                <FolderOpen className="tw-w-5 tw-h-5" />
                文件管理
              </CardTitle>
              <CardDescription className="tw-mt-2 tw-text-xs tw-uppercase tw-tracking-[0.18em]">
                {status?.storageDriver === 'webdav'
                  ? `WebDAV: ${status?.webdav?.rootPath || '/'}`
                  : `目录: ${status?.storageDriver === 'server' ? (status?.serverMapDir || '未设置') : (status?.mapLibraryDir || '未设置')}`}
              </CardDescription>
            </div>
            <div className="tw-flex tw-gap-2 tw-flex-wrap">
              <Button variant="outline" size="sm" onClick={handleScan} disabled={busy}>
                <RefreshCw className="tw-w-3.5 tw-h-3.5" /> 重扫
              </Button>
              <Button variant="outline" size="sm" onClick={() => loadStorageFolders(status?.storageDriver)} disabled={busy}>
                <FolderOpen className="tw-w-3.5 tw-h-3.5" /> 刷新
              </Button>
            </div>
          </CardHeader>
          <CardContent className="tw-space-y-4">
            <div
              className={`tw-rounded-[16px] tw-border-2 tw-border-dashed tw-p-6 tw-text-center tw-transition-all tw-duration-200 ${dragOver ? 'tw-scale-[1.01] tw-border-[#8f3f28] tw-bg-[#f2dfad]' : 'tw-border-[#bfae90] tw-bg-[#fffaf0]'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { setDragOver(false); handleFileDrop(e); }}
            >
              <Upload className={`tw-mx-auto tw-mb-2 tw-h-7 tw-w-7 tw-transition-transform tw-duration-200 ${dragOver ? 'tw-scale-110 tw-text-[#8f3f28]' : 'tw-text-[#8d7c61]'}`} />
              <p className="tw-text-sm tw-font-semibold tw-tracking-[0.1em] tw-text-[#213449]">{uploadFiles.length ? `已选择 ${uploadFiles.length} 个文件` : '拖入或选择地图文件'}</p>
              <p className="tw-mt-1 tw-text-[11px] tw-text-[#6f6758]">采用档案接收台式布局，先入库，再补元数据。</p>
              <input type="file" accept="image/*" multiple className="tw-mt-3 tw-text-xs tw-file:mr-2 tw-file:rounded-md tw-file:border-0 tw-file:bg-[#213449] tw-file:px-2.5 tw-file:py-1 tw-file:text-xs tw-file:text-[#fbf6ea] tw-cursor-pointer" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
              <div className="tw-mt-3 tw-flex tw-items-center tw-justify-center tw-gap-3 tw-flex-wrap">
                <label className="tw-inline-flex tw-cursor-pointer tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-[var(--kumo-brand)] tw-bg-[var(--kumo-brand)] tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-[var(--kumo-brand-text)] tw-shadow-[var(--kumo-shadow-sm)] tw-transition-colors hover:tw-bg-[var(--kumo-brand-hover)]">
                  <Camera className="tw-size-3.5" />
                  拍照导入
                  <input type="file" accept="image/*" capture="environment" className="tw-hidden" onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} />
                </label>
                <label className="tw-inline-flex tw-cursor-pointer tw-items-center tw-gap-1.5 tw-rounded-lg tw-border tw-border-[var(--kumo-control-border)] tw-bg-[var(--kumo-control-bg)] tw-px-3 tw-py-1.5 tw-text-xs tw-font-semibold tw-text-[var(--kumo-control-text)] tw-shadow-[var(--kumo-shadow-sm)] tw-transition-colors hover:tw-bg-[var(--kumo-control-bg-hover)]">
                  <FileJson className="tw-size-3.5" />
                  导入 GeoJSON
                  <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="tw-hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const geojson = JSON.parse(text);
                      const result = await api.importGeoJSON(geojson);
                      setMessage?.(`导入成功: ${result.imported} 条记录`);
                      handleScan?.();
                    } catch (err) {
                      setError?.(err.message);
                    }
                  }} />
                </label>
                <Button size="xs" variant="secondary" onClick={async () => {
                  try {
                    const geojson = await api.exportGeoJSON({ hasCoords: true, limit: 5000 });
                    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `roamly-geo-export-${new Date().toISOString().slice(0, 10)}.geojson`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setMessage?.(`已导出 ${geojson.features?.length || 0} 个要素`);
                  } catch (err) {
                    setError?.(err.message);
                  }
                }}>
                  <FileJson className="tw-size-3" /> 导出 GeoJSON
                </Button>
              </div>
            </div>
            {uploading && (
              <div className="tw-space-y-1">
                <div className="tw-flex tw-justify-between tw-text-xs tw-text-[#6f6758]"><span>上传中</span><span>{Math.round(overallProgress)}%</span></div>
                <ProgressBar value={overallProgress} />
              </div>
            )}
            <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-4 tw-gap-2">
              <div className="tw-space-y-1"><Label className="tw-text-[11px]">文件夹</Label><Select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>{folderOptions.map((i) => <option key={i || '_'} value={i}>{i || '/ (自动)'}</option>)}</Select></div>
              <div className="tw-space-y-1"><Label className="tw-text-[11px]">城市</Label><Input value={uploadMeta.city} onChange={(e) => setUploadMeta((p) => ({ ...p, city: e.target.value }))} placeholder="可选" /></div>
              <div className="tw-space-y-1"><Label className="tw-text-[11px]">年代</Label><Input value={uploadMeta.year_label} onChange={(e) => setUploadMeta((p) => ({ ...p, year_label: e.target.value }))} placeholder="可选" /></div>
              <div className="tw-space-y-1"><Label className="tw-text-[11px]">标签</Label><Input value={uploadMeta.tags} onChange={(e) => setUploadMeta((p) => ({ ...p, tags: e.target.value }))} placeholder="逗号分隔" /></div>
            </div>
            <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
              <Button size="sm" onClick={handleUploadWithProgress} disabled={!uploadFiles.length || busy || uploading}>
                {uploading ? <Loader2 className="tw-h-3.5 tw-w-3.5 tw-animate-spin" /> : <Upload className="tw-h-3.5 tw-w-3.5" />}
                {uploading ? '上传中...' : '上传'}
              </Button>
              {uploadFiles.length > 0 && !uploading && (
                <span className="tw-text-xs tw-text-[#6f6758]">{uploadFiles.map((f) => f.name).slice(0, 2).join('、')}{uploadFiles.length > 2 ? ` 等${uploadFiles.length}个` : ''}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* File list */}
        <Card>
          <CardHeader className="tw-py-3 tw-px-4">
              <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
                <Image className="tw-w-4 tw-h-4" />
                图片文件列表
                {stats?.total ? <Badge variant="secondary" className="tw-text-[10px] tw-uppercase">{stats.total}</Badge> : null}
              </CardTitle>
            </CardHeader>
          <CardContent className="tw-pt-0 tw-px-4 tw-pb-3">
            <div className="tw-grid tw-grid-cols-1 tw-gap-1.5 tw-max-h-[420px] tw-overflow-y-auto">
              {maps.map((item) => (
                <div
                  key={item.id}
                  className="tw-group tw-flex tw-cursor-pointer tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-[#d3c3a7] tw-bg-[#fffaf0] tw-p-2.5 tw-transition-colors hover:tw-bg-[#f3e7c7]"
                  onClick={() => setViewImage(item)}
                >
                  <img
                    src={`/api/files/${item.id}?max=80&quality=60`}
                    alt=""
                    className="tw-h-12 tw-w-12 tw-shrink-0 tw-rounded-md tw-border tw-border-[#c8b590] tw-object-cover"
                    loading="lazy"
                  />
                  <div className="tw-flex-1 tw-min-w-0">
                    <p className="tw-truncate tw-text-sm tw-font-semibold tw-text-[#213449]">{item.title || item.file_name}</p>
                    <p className="tw-truncate tw-text-[11px] tw-uppercase tw-tracking-[0.14em] tw-text-[#756c5c]">{[item.country_name, item.city, item.year_label].filter(Boolean).join(' · ') || item.source}</p>
                  </div>
                  {item.storage_band && <span className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-shrink-0" style={{ background: BAND_COLORS[item.storage_band] || '#94a3b8' }} />}
                </div>
              ))}
              {!maps.length && <p className="tw-py-6 tw-text-center tw-text-sm tw-text-[#7a715e]">暂无文件</p>}
            </div>
          </CardContent>
        </Card>

        {/* AI Tasks */}
        <AITaskPanel tasks={aiTasks} onRefresh={refreshAITasks} />
      </div>

      {/* Sidebar */}
      <div className="tw-flex tw-flex-col tw-gap-4">
        {/* Storage stats */}
        {stats && (
          <Card>
            <CardHeader className="tw-py-3 tw-px-4">
              <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
                <BarChart3 className="tw-w-4 tw-h-4" />
                彩虹存储统计
              </CardTitle>
            </CardHeader>
            <CardContent className="tw-pt-0 tw-px-4 tw-pb-3 tw-space-y-3">
              <div className="tw-grid tw-grid-cols-3 tw-gap-2 tw-text-center">
                <div className="tw-rounded-xl tw-border tw-border-[#ccb992] tw-bg-[#fffaf0] tw-p-2"><p className="tw-text-lg tw-font-semibold tw-text-[#213449]">{stats.total}</p><p className="tw-text-[10px] tw-uppercase tw-tracking-[0.14em] tw-text-[#6f6758]">总计</p></div>
                <div className="tw-rounded-xl tw-border tw-border-[#ccb992] tw-bg-[#fffaf0] tw-p-2"><p className="tw-text-lg tw-font-semibold tw-text-[#213449]">{stats.favorites}</p><p className="tw-text-[10px] tw-uppercase tw-tracking-[0.14em] tw-text-[#6f6758]">收藏</p></div>
                <div className="tw-rounded-xl tw-border tw-border-[#ccb992] tw-bg-[#fffaf0] tw-p-2"><p className="tw-text-lg tw-font-semibold tw-text-[#213449]">{stats.withAI}</p><p className="tw-text-[10px] tw-uppercase tw-tracking-[0.14em] tw-text-[#6f6758]">AI 已处理</p></div>
              </div>
              <Separator />
              <div className="tw-space-y-1.5">
                {(stats.storageBands || []).map((item) => (
                  <div key={item.band} className="tw-flex tw-items-center tw-gap-2 tw-text-xs">
                    <span className="tw-w-2.5 tw-h-2.5 tw-rounded-full tw-shrink-0" style={{ background: BAND_COLORS[item.band] || '#94a3b8' }} />
                    <span className="tw-w-10 tw-text-[#675e4e]">{item.band}</span>
                    <div className="tw-flex-1 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-[#eadfc5]">
                      <div className="tw-h-full tw-rounded-full tw-transition-all tw-duration-500" style={{ width: `${stats.total ? (item.count / stats.total) * 100 : 0}%`, background: BAND_COLORS[item.band] || '#94a3b8' }} />
                    </div>
                    <span className="tw-w-8 tw-text-right tw-text-[#7b725f]">{item.count}</span>
                  </div>
                ))}
              </div>
              {stats.countries?.length > 0 && (
                <>
                  <Separator />
                  <div className="tw-flex tw-flex-wrap tw-gap-1">
                    {stats.countries.slice(0, 8).map((c) => (
                      <Badge key={c.name} variant="outline" className="tw-text-[10px]">{c.name} {c.count}</Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Assist */}
        <Card>
          <CardHeader className="tw-py-3 tw-px-4">
            <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
              <Sparkles className="tw-w-4 tw-h-4" />
              AI 辅助
            </CardTitle>
          </CardHeader>
          <CardContent className="tw-pt-0 tw-px-4 tw-pb-3 tw-space-y-2">
            <p className="tw-text-xs tw-text-[#6f6758]">AI 自动识别地图内容，提取国家、城市、年代、经纬度范围等元数据。</p>
            <div className="tw-flex tw-flex-col tw-gap-2">
              <Button variant="outline" size="sm" onClick={handleBatchAIExtract} disabled={!maps.length || aiBusy} className="tw-w-full tw-justify-start">
                <Bot className="tw-w-3.5 tw-h-3.5" />
                {aiBusy ? '批量提取中...' : `批量 AI 提取 (${Math.min(maps.length, 10)})`}
              </Button>
              <Button variant="outline" size="sm" onClick={handleOcrReindex} disabled={busy || !ocrStatus?.available} className="tw-w-full tw-justify-start">
                <FileText className="tw-w-3.5 tw-h-3.5" />
                重建 OCR 索引
              </Button>
            </div>
            <div className="tw-grid tw-grid-cols-2 tw-gap-2 tw-text-center tw-mt-2">
              <div className="tw-rounded-xl tw-border tw-border-[#ccb992] tw-bg-[#fffaf0] tw-p-2"><p className="tw-text-sm tw-font-medium tw-text-[#213449]">{stats?.withOcr || 0}</p><p className="tw-text-[10px] tw-uppercase tw-tracking-[0.14em] tw-text-[#6f6758]">OCR 完成</p></div>
              <div className="tw-rounded-xl tw-border tw-border-[#ccb992] tw-bg-[#fffaf0] tw-p-2"><p className="tw-text-sm tw-font-medium tw-text-[#213449]">{stats?.withCoords || 0}</p><p className="tw-text-[10px] tw-uppercase tw-tracking-[0.14em] tw-text-[#6f6758]">有坐标</p></div>
            </div>
          </CardContent>
        </Card>

        {/* MCP */}
        <Card>
          <CardHeader className="tw-py-3 tw-px-4">
            <CardTitle className="tw-flex tw-items-center tw-gap-2 tw-text-sm">
              <Server className="tw-w-4 tw-h-4" /> MCP
            </CardTitle>
          </CardHeader>
          <CardContent className="tw-pt-0 tw-px-4 tw-pb-3">
            <p className="tw-text-xs tw-text-[#6f6758]">工具: {mcpInfo?.tools?.length || 0}</p>
            <div className="tw-flex tw-flex-wrap tw-gap-1 tw-mt-2">
              {(mcpInfo?.tools || []).map((t) => <Badge key={t} variant="secondary" className="tw-text-[10px] tw-uppercase tw-tracking-[0.08em]">{t}</Badge>)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Image lightbox */}
      {viewImage && (
        <div className="tw-fixed tw-inset-0 tw-z-50 tw-bg-black/80 tw-flex tw-items-center tw-justify-center tw-p-4 tw-animate-in tw-fade-in tw-duration-200" onClick={() => setViewImage(null)}>
          <div className="tw-relative tw-max-w-[90vw] tw-max-h-[90vh] tw-flex tw-flex-col tw-items-center" onClick={(e) => e.stopPropagation()}>
            <img src={`/api/files/${viewImage.id}`} alt={viewImage.title || viewImage.file_name} className="tw-max-h-[80vh] tw-max-w-full tw-rounded-[18px] tw-border tw-border-[#d8c59c] tw-object-contain tw-bg-[#fbf6ea] tw-p-2 tw-shadow-2xl" />
            <div className="tw-mt-3 tw-rounded-full tw-border tw-border-[#d8c59c] tw-bg-[#1d2b38]/85 tw-px-5 tw-py-2 tw-text-center tw-text-white">
              <p className="tw-font-medium">{viewImage.title || viewImage.file_name}</p>
              <p className="tw-mt-1 tw-text-sm tw-text-white/70">{[viewImage.country_name, viewImage.city, viewImage.year_label].filter(Boolean).join(' · ')}</p>
            </div>
            <button className="tw-absolute tw-top-2 tw-right-2 tw-flex tw-h-8 tw-w-8 tw-cursor-pointer tw-items-center tw-justify-center tw-rounded-full tw-border-0 tw-bg-white/20 tw-text-lg tw-text-white tw-transition-colors hover:tw-bg-white/40" onClick={() => setViewImage(null)}>✕</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
