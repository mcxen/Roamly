import { useState } from 'react';
import { Upload, FolderOpen, RefreshCw, Server, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

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

export default function FileManager({
  status, busy, uploadFiles, setUploadFiles, uploadFolder, setUploadFolder,
  uploadMeta, setUploadMeta, folderOptions, handleScan, handleUpload,
  handleFileDrop, loadStorageFolders, mcpInfo, maps, setSelectedId, setViewMode,
  ocrStatus, stats
}) {
  const [dragOver, setDragOver] = useState(false);

  const indexPct = stats?.total ? 100 : 0;
  const ocrPct = stats?.total ? Math.round((stats.withOcr / stats.total) * 100) : 0;
  const aiPct = stats?.total ? Math.round((stats.withAI / stats.total) * 100) : 0;

  return (
    <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-[1fr_320px] tw-gap-4 tw-p-4 tw-flex-1 tw-min-h-0">
      <Card className="tw-flex tw-flex-col tw-min-w-0">
        <CardHeader className="tw-flex-row tw-items-center tw-justify-between tw-space-y-0 tw-pb-3">
          <div>
            <CardTitle className="tw-text-xl tw-flex tw-items-center tw-gap-2">
              <FolderOpen className="tw-w-5 tw-h-5" />
              文件管理
            </CardTitle>
            <CardDescription className="tw-mt-1">
              {status?.storageDriver === 'webdav'
                ? `WebDAV: ${status?.webdav?.rootPath || '/'}`
                : `服务端目录: ${status?.storageDriver === 'server' ? (status?.serverMapDir || '未设置') : (status?.mapLibraryDir || '未设置')}`}
            </CardDescription>
          </div>
          <div className="tw-flex tw-gap-2 tw-flex-wrap">
            <Button variant="outline" size="sm" onClick={handleScan} disabled={busy}>
              <RefreshCw className="tw-w-3.5 tw-h-3.5" />
              重扫目录
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadStorageFolders(status?.storageDriver)} disabled={busy}>
              <FolderOpen className="tw-w-3.5 tw-h-3.5" />
              刷新文件夹
            </Button>
          </div>
        </CardHeader>

        <CardContent className="tw-flex tw-flex-col tw-gap-4 tw-flex-1">
          {/* Progress indicators */}
          {stats ? (
            <div className="tw-flex tw-flex-col tw-gap-2">
              <div className="progress-row">
                <span className="progress-label">文件索引</span>
                <div className="progress-track"><div className={`progress-fill${indexPct >= 100 ? ' done' : ''}`} style={{ width: `${indexPct}%` }} /></div>
                <span className="progress-value">{stats.total} 张</span>
              </div>
              <div className="progress-row">
                <span className="progress-label">OCR 识别</span>
                <div className="progress-track"><div className={`progress-fill${ocrPct >= 100 ? ' done' : ''}`} style={{ width: `${ocrPct}%` }} /></div>
                <span className="progress-value">{stats.withOcr}/{stats.total} ({ocrPct}%)</span>
              </div>
              <div className="progress-row">
                <span className="progress-label">AI 提取</span>
                <div className="progress-track"><div className={`progress-fill${aiPct >= 100 ? ' done' : ''}`} style={{ width: `${aiPct}%` }} /></div>
                <span className="progress-value">{stats.withAI}/{stats.total} ({aiPct}%)</span>
              </div>
              {ocrStatus?.queueSize > 0 ? (
                <div className="progress-row">
                  <span className="progress-label">OCR 队列</span>
                  <span className="progress-value">{ocrStatus.queueSize} 待处理</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Drop zone */}
          <div
            className={`tw-border-2 tw-border-dashed tw-rounded-lg tw-p-6 tw-text-center tw-transition-colors ${dragOver ? 'tw-border-slate-900 tw-bg-slate-50' : 'tw-border-slate-200 tw-bg-slate-50/50'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { setDragOver(false); handleFileDrop(e); }}
          >
            <Upload className="tw-w-8 tw-h-8 tw-mx-auto tw-text-slate-400 tw-mb-3" />
            <p className="tw-font-medium tw-text-slate-700">
              {uploadFiles.length ? `已选择 ${uploadFiles.length} 个文件` : '选择或拖入地图文件'}
            </p>
            <p className="tw-text-xs tw-text-slate-500 tw-mt-1">支持 jpg、png、webp、tif 等图片；留空文件夹时会按文件名自动归类</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="tw-mt-3 tw-text-sm tw-file:mr-3 tw-file:rounded-md tw-file:border-0 tw-file:bg-slate-900 tw-file:px-3 tw-file:py-1.5 tw-file:text-sm tw-file:text-white hover:tw-file:bg-slate-800 tw-cursor-pointer"
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
            />
          </div>

          {/* Metadata form */}
          <div className="tw-grid tw-grid-cols-1 sm:tw-grid-cols-2 lg:tw-grid-cols-4 tw-gap-3">
            <div className="tw-space-y-1.5">
              <Label>目标文件夹</Label>
              <Select value={uploadFolder} onChange={(e) => setUploadFolder(e.target.value)}>
                {folderOptions.map((item) => (
                  <option key={item || '__root__'} value={item}>{item || '/ (自动/根目录)'}</option>
                ))}
              </Select>
            </div>
            <div className="tw-space-y-1.5">
              <Label>城市</Label>
              <Input value={uploadMeta.city} onChange={(e) => setUploadMeta((p) => ({ ...p, city: e.target.value }))} placeholder="可选，自动补全定位" />
            </div>
            <div className="tw-space-y-1.5">
              <Label>年代</Label>
              <Input value={uploadMeta.year_label} onChange={(e) => setUploadMeta((p) => ({ ...p, year_label: e.target.value }))} placeholder="可选" />
            </div>
            <div className="tw-space-y-1.5">
              <Label>标签</Label>
              <Input value={uploadMeta.tags} onChange={(e) => setUploadMeta((p) => ({ ...p, tags: e.target.value }))} placeholder="逗号分隔" />
            </div>
            <div className="tw-space-y-1.5">
              <Label>专题 / 战役</Label>
              <Input value={uploadMeta.campaign} onChange={(e) => setUploadMeta((p) => ({ ...p, campaign: e.target.value }))} placeholder="可选" />
            </div>
            <div className="tw-space-y-1.5">
              <Label>收藏单位</Label>
              <Input value={uploadMeta.collection_unit} onChange={(e) => setUploadMeta((p) => ({ ...p, collection_unit: e.target.value }))} placeholder="可选" />
            </div>
            <div className="tw-space-y-1.5">
              <Label>色条</Label>
              <Select value={uploadMeta.storage_band} onChange={(e) => setUploadMeta((p) => ({ ...p, storage_band: e.target.value }))}>
                {STORAGE_BAND_OPTIONS.map((item) => (
                  <option key={item.value || 'none'} value={item.value}>{item.label}</option>
                ))}
              </Select>
            </div>
            <div className="tw-space-y-1.5">
              <Label>密级</Label>
              <Select value={uploadMeta.security_level} onChange={(e) => setUploadMeta((p) => ({ ...p, security_level: e.target.value }))}>
                <option value="">默认</option>
                <option value="内部教学">内部教学</option>
                <option value="内部资料">内部资料</option>
                <option value="保密审看">保密审看</option>
              </Select>
            </div>
            <div className="tw-space-y-1.5 sm:tw-col-span-2">
              <Label>批量描述</Label>
              <Textarea value={uploadMeta.description} onChange={(e) => setUploadMeta((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="可选" />
            </div>
            <div className="tw-flex tw-items-center tw-gap-4 tw-col-span-full">
              <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer">
                <input type="checkbox" className="tw-rounded" checked={uploadMeta.favorite} onChange={(e) => setUploadMeta((p) => ({ ...p, favorite: e.target.checked }))} />
                上传后收藏
              </label>
              <label className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-cursor-pointer">
                <input type="checkbox" className="tw-rounded" checked={uploadMeta.auto_resolve_city} onChange={(e) => setUploadMeta((p) => ({ ...p, auto_resolve_city: e.target.checked }))} />
                根据城市自动定位
              </label>
            </div>
          </div>

          {/* Footer */}
          <Separator />
          <div className="tw-flex tw-items-center tw-gap-3 tw-flex-wrap">
            <Button onClick={handleUpload} disabled={!uploadFiles.length || busy} className="tw-min-w-[120px]">
              <Upload className="tw-w-4 tw-h-4" />
              上传到服务端
            </Button>
            {uploadFiles.length > 0 && (
              <span className="tw-text-xs tw-text-slate-500">
                {uploadFiles.map((f) => f.name).slice(0, 3).join('、')}{uploadFiles.length > 3 ? ` 等 ${uploadFiles.length} 个` : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar */}
      <div className="tw-flex tw-flex-col tw-gap-4">
        <Card>
          <CardHeader className="tw-pb-3">
            <CardTitle className="tw-text-sm tw-flex tw-items-center tw-gap-2">
              <Server className="tw-w-4 tw-h-4" />
              MCP 服务端
            </CardTitle>
          </CardHeader>
          <CardContent className="tw-space-y-2">
            <p className="tw-text-xs tw-text-slate-500">Endpoint: /mcp</p>
            <p className="tw-text-xs tw-text-slate-500">工具数: {mcpInfo?.tools?.length || 0}</p>
            <div className="tw-flex tw-flex-wrap tw-gap-1.5 tw-mt-2">
              {(mcpInfo?.tools || []).map((tool) => (
                <Badge key={tool} variant="secondary" className="tw-text-[10px]">{tool}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="tw-flex-1 tw-min-h-0 tw-overflow-hidden">
          <CardHeader className="tw-pb-3">
            <CardTitle className="tw-text-sm tw-flex tw-items-center tw-gap-2">
              <FileText className="tw-w-4 tw-h-4" />
              最近文件
            </CardTitle>
          </CardHeader>
          <CardContent className="tw-space-y-1 tw-overflow-y-auto tw-max-h-[400px]">
            {maps.slice(0, 12).map((item) => (
              <button
                key={item.id}
                className="tw-w-full tw-flex tw-items-center tw-justify-between tw-gap-2 tw-rounded-md tw-px-2.5 tw-py-2 tw-text-left tw-text-sm hover:tw-bg-slate-100 tw-transition-colors tw-border-0 tw-bg-transparent tw-cursor-pointer"
                onClick={() => { setSelectedId(item.id); setViewMode('library'); }}
              >
                <span className="tw-truncate tw-text-slate-700">{item.title || item.file_name}</span>
                <span className="tw-text-xs tw-text-slate-400 tw-shrink-0">{item.city || item.country_name || item.source}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
